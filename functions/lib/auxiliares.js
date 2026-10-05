/**
 * A CONTA DA AUXILIAR — as quatro callables da fase 1 (05/10/2026).
 *
 *   convidarAuxiliar           o MOTORISTA cria o convite (nome, WhatsApp,
 *                              quanto vai pagar, se quiser) e recebe o código
 *   cancelarConviteDeAuxiliar  ele desiste de um convite que ninguém usou
 *   verConviteDeAuxiliar       PÚBLICA: a tela do link mostra quem chamou
 *   aceitarConviteDeAuxiliar   a pessoa, já com sessão, vira auxiliar dele
 *   desativarAuxiliar          ele encerra o acesso dela, na hora
 *
 * ── POR QUE É TUDO NO SERVIDOR
 * O cliente não escreve `role` (foi assim que a auto-promoção fechou), e a
 * ligação auxiliar → motorista é o que vai abrir a turma dele para ela. Se o
 * cliente escrevesse `auxiliares/{uid}`, qualquer conta se ligaria a qualquer
 * motorista. As rules fecham `convitesDeAuxiliar` e a escrita de `auxiliares`
 * a todo cliente.
 *
 * ── O QUE A CONTA DELA GUARDA
 * `users/{uid}`: role 'auxiliar', nome, e-mail, WhatsApp e `motoristaUid`.
 * `auxiliares/{uid}`: o vínculo — de quem, desde quando, se está ativa e até
 * quando. É ele que o histórico do motorista ("quem já trabalhou comigo") lê.
 *
 * A régua (validade, teto de 2, formato) é pura: `reguaDoAuxiliar.js`.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const R = require('./reguaDoAuxiliar');
const { idValido } = require('./reguaDosIds');
const { copiarTurmaParaAuxiliar, apagarTurmaDaAuxiliar } = require('./turmaDaAuxiliar');
const { estaLigada } = require('./reguaDaCobranca');

const REGION = 'southamerica-east1';
const FRASE_DO_LINK_QUE_NAO_VALE = 'Este convite não vale mais. Peça ao motorista um link novo.';

const FRASE_DA_CONTA_PAUSADA = 'A conta do motorista está pausada. Fale com ele.';

/**
 * ⚠️ A AUXILIAR NÃO OPERA CONTA TRANCADA (achado da QA). Estas callables
 * escrevem com o Admin SDK, por cima do `isAdmin()` das rules; sem esta
 * conferência, a auxiliar seria o jeito de operar uma conta suspensa ou
 * bloqueada. O predicado é o mesmo das rules (`contaDoMotoristaOpera`).
 */
async function exigirContaDoMotoristaOperando(db, motoristaUid) {
  const [tio, config] = await Promise.all([
    db.doc(`users/${motoristaUid}`).get(),
    db.doc('platformConfig/app').get(),
  ]);
  const opera = R.contaDoMotoristaOpera(tio.exists ? tio.data() : null, {
    cobrancaLigada: estaLigada(config.exists ? config.data() : null),
  });
  if (!opera) throw new HttpsError('failed-precondition', FRASE_DA_CONTA_PAUSADA);
}

function nomeLimpo(bruto) {
  return String(bruto || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

function makeConvidarAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    await exigirContaDoMotoristaOperando(db, uid);
    const nome = nomeLimpo(request.data?.nome);
    const telefone = R.telefoneLimpo(request.data?.telefone);
    const valor = Number(request.data?.valorMensal);
    const valorMensal = Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
    if (!nome) throw new HttpsError('invalid-argument', 'Qual o nome dela?');
    if (!telefone) throw new HttpsError('invalid-argument', 'WhatsApp com DDD, só números.');

    const ativas = await db.collection('auxiliares').where('motoristaUid', '==', uid).where('ativa', '==', true).count().get();
    if (!R.cabeMaisUma(ativas.data().count)) {
      throw new HttpsError('failed-precondition', `São até ${R.MAX_AUXILIARES_ATIVAS} auxiliares ao mesmo tempo. Desative uma para chamar outra.`);
    }

    for (let i = 0; i < 5; i++) {
      const codigo = R.gerarCodigoDoConvite();
      const ref = db.doc(`convitesDeAuxiliar/${codigo}`);
      try {
        await ref.create({
          motoristaUid: uid,
          nome,
          telefone,
          valorMensal,
          criadoEm: FieldValue.serverTimestamp(),
          criadoEmMs: Date.now(),
          usadoPor: null,
          canceladoEm: null,
        });
        return { codigo };
      } catch (err) {
        if (err?.code !== 6) throw err; // 6 = ALREADY_EXISTS: sorteia outro
      }
    }
    throw new HttpsError('resource-exhausted', 'Não deu pra criar o convite agora. Tente de novo.');
  });
}

function makeCancelarConviteDeAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const codigo = String(request.data?.codigo || '');
    if (!idValido(codigo) || !R.codigoValido(codigo)) throw new HttpsError('invalid-argument', 'Convite desconhecido.');
    const ref = db.doc(`convitesDeAuxiliar/${codigo}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().motoristaUid !== uid) throw new HttpsError('permission-denied', 'Este convite não é seu.');
    if (snap.data().usadoPor) throw new HttpsError('failed-precondition', 'Ela já aceitou. Para encerrar, desative o acesso.');
    await ref.update({ canceladoEm: FieldValue.serverTimestamp() });
    return { ok: true };
  });
}

/**
 * PÚBLICA, e devolve o mínimo: a marca do motorista e o primeiro nome de quem
 * foi chamada. Nada de telefone, valor ou uid — quem tem o link na mão pode
 * não ser ela.
 */
function makeVerConviteDeAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const codigo = String(request.data?.codigo || '');
    if (!idValido(codigo) || !R.codigoValido(codigo)) return { vale: false, frase: FRASE_DO_LINK_QUE_NAO_VALE };
    const snap = await db.doc(`convitesDeAuxiliar/${codigo}`).get();
    const convite = snap.exists ? snap.data() : null;
    if (!R.conviteVale(convite, Date.now()).vale) return { vale: false, frase: FRASE_DO_LINK_QUE_NAO_VALE };
    const tio = await db.doc(`users/${convite.motoristaUid}`).get();
    const t = tio.exists ? tio.data() : {};
    return {
      vale: true,
      marca: t.marcaNome || t.name || 'O motorista',
      primeiroNome: String(convite.nome || '').split(' ')[0],
    };
  });
}

function makeAceitarConviteDeAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta primeiro.');
    const codigo = String(request.data?.codigo || '');
    if (!idValido(codigo) || !R.codigoValido(codigo)) throw new HttpsError('not-found', FRASE_DO_LINK_QUE_NAO_VALE);
    const versao = typeof request.data?.acceptedLegalVersion === 'string' ? request.data.acceptedLegalVersion.slice(0, 10) : null;

    const conviteRef = db.doc(`convitesDeAuxiliar/${codigo}`);
    const userRef = db.doc(`users/${uid}`);
    const vinculoRef = db.doc(`auxiliares/${uid}`);

    const previo = await conviteRef.get();
    if (previo.exists && previo.data().motoristaUid) await exigirContaDoMotoristaOperando(db, previo.data().motoristaUid);

    const resultado = await db.runTransaction(async (tx) => {
      const [cSnap, uSnap, vSnap] = await Promise.all([tx.get(conviteRef), tx.get(userRef), tx.get(vinculoRef)]);
      const convite = cSnap.exists ? cSnap.data() : null;
      const usuario = uSnap.exists ? uSnap.data() : null;

      // Clicou duas vezes: a segunda acha a conta já pronta e segue.
      if (convite?.usadoPor === uid && usuario?.role === 'auxiliar') return { ok: true, jaEra: true, motoristaUid: convite.motoristaUid };
      if (!R.conviteVale(convite, Date.now()).vale) throw new HttpsError('not-found', FRASE_DO_LINK_QUE_NAO_VALE);

      // ⚠️ UMA CONTA, UM PAPEL. A mãe que já usa o app como família, ou o
      // motorista, não vira auxiliar com a mesma conta: o papel decide o
      // painel inteiro, e misturar daria a ela a turma de outro motorista
      // dentro da conta de responsável.
      if (usuario?.role && usuario.role !== 'auxiliar') {
        throw new HttpsError('failed-precondition', 'Esta conta já é usada no app como motorista ou família. Entre com outra conta para ser auxiliar.');
      }
      if (vSnap.exists && vSnap.data().ativa && vSnap.data().motoristaUid !== convite.motoristaUid) {
        throw new HttpsError('failed-precondition', 'Você já é auxiliar de outro motorista. Peça para ele encerrar antes.');
      }

      const agora = FieldValue.serverTimestamp();
      const email = request.auth.token?.email || usuario?.email || '';
      tx.set(userRef, {
        role: 'auxiliar',
        name: usuario?.name || convite.nome,
        email,
        phone: usuario?.phone || convite.telefone,
        motoristaUid: convite.motoristaUid,
        ...(usuario ? {} : { createdAt: agora }),
        ...(versao ? { termsVersion: versao, termsAcceptedAt: agora, privacyVersion: versao, privacyAcceptedAt: agora } : {}),
      }, { merge: true });
      tx.set(vinculoRef, {
        motoristaUid: convite.motoristaUid,
        nome: convite.nome,
        telefone: convite.telefone,
        valorMensal: convite.valorMensal ?? null,
        desde: agora,
        ativa: true,
        ate: null,
      });
      tx.update(conviteRef, { usadoPor: uid, usadoEm: agora });
      return { ok: true, jaEra: false, motoristaUid: convite.motoristaUid };
    });

    // A TURMA DELA (fase 2): a primeira auxiliar ativa liga a cópia que o
    // servidor mantém. Fora da transação: copiar a turma não pode fazer o
    // aceite falhar — os gatilhos completam o que faltar.
    try {
      await copiarTurmaParaAuxiliar(db, resultado.motoristaUid);
    } catch (err) {
      console.error('[auxiliar] não deu para copiar a turma', err);
    }
    return { ok: true, jaEra: resultado.jaEra };
  });
}

/**
 * O MOTORISTA ENCERRA O ACESSO, NA HORA. O vínculo fica (`ativa: false` e
 * `ate`) porque é ele que conta o histórico e a rotatividade; a conta dela
 * continua existindo — os pagamentos dela são dela.
 */
function makeDesativarAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const auxUid = String(request.data?.auxUid || '');
    if (!idValido(auxUid)) throw new HttpsError('invalid-argument', 'Qual auxiliar?');
    const ref = db.doc(`auxiliares/${auxUid}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().motoristaUid !== uid) throw new HttpsError('permission-denied', 'Esta auxiliar não é sua.');
    if (!snap.data().ativa) return { ok: true };
    await ref.update({ ativa: false, ate: FieldValue.serverTimestamp() });
    // A última saiu: a cópia da turma some. Dado de criança não fica parado
    // num lugar que ninguém usa.
    const restam = await db.collection('auxiliares').where('motoristaUid', '==', uid).where('ativa', '==', true).count().get();
    if (restam.data().count === 0) await apagarTurmaDaAuxiliar(db, uid);
    return { ok: true };
  });
}

/**
 * A AUXILIAR MARCA NA ROTA (fase 3, 05/10/2026) — EMBARQUEI, ENTREGUEI NA
 * ESCOLA e ENTREGUEI, pelo celular dela, enquanto o tio dirige.
 *
 * É callable porque ela não escreve em `children` (mensalidade e saúde moram
 * lá). O servidor faz o mesmo que `advanceChild` faz no aparelho do motorista,
 * num lote só: o status com a hora, o marco do dia em `rides/{dia}` e o aviso
 * à família. A cópia dela se atualiza sozinha pelo gatilho da turma.
 *
 * Só para a frente (`passoValido`); desfazer é do motorista.
 *
 * Ela marca mesmo antes de o tio tocar em "Iniciar a rota", DE PROPÓSITO: é
 * comum ela pôr a criança na perua enquanto ele ainda está ligando o app, e
 * recusar ali faria a família perder o aviso.
 */
const chaveDoDia = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
const horaDeBrasilia = (ms) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

function makeMarcarParadaPelaAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    const proximo = String(request.data?.proximo || '');
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Qual criança?');

    const vinculo = await db.doc(`auxiliares/${uid}`).get();
    if (!vinculo.exists || !vinculo.data().ativa) {
      throw new HttpsError('permission-denied', 'O seu acesso foi encerrado pelo motorista.');
    }
    const motoristaUid = vinculo.data().motoristaUid;
    await exigirContaDoMotoristaOperando(db, motoristaUid);
    const childRef = db.doc(`children/${childId}`);

    // ⚠️ NUMA TRANSAÇÃO (achado da QA): a auxiliar e o motorista marcando
    // quase juntos, ou um toque duplo, passariam os dois no `passoValido` com
    // o status velho e mandariam dois avisos à família. Lendo dentro, o
    // segundo vê o passo já dado e é recusado.
    const agora = Date.now();
    const hoje = chaveDoDia(agora);
    const aviso = await db.runTransaction(async (tx) => {
      const snap = await tx.get(childRef);
      const child = snap.exists ? snap.data() : null;
      if (!child || child.adminUid !== motoristaUid || child.active !== true) {
        throw new HttpsError('permission-denied', 'Esta criança não é da sua perua.');
      }
      const anterior = R.statusDeHoje(child, hoje, chaveDoDia);
      if (!R.passoValido(anterior, proximo)) {
        throw new HttpsError('failed-precondition', 'Este passo já foi marcado. Atualize a tela.');
      }
      const marca = FieldValue.serverTimestamp();
      tx.update(childRef, { status: proximo, statusUpdatedAt: marca });
      tx.set(db.doc(`children/${childId}/rides/${hoje}`), {
        dateKey: hoje,
        childId,
        adminUid: motoristaUid,
        parentUid: child.parentUid || null,
        marcos: {
          [proximo]: marca,
          ...(proximo === 'onboard' && anterior === 'home' ? { embarqueEmCasa: marca } : {}),
        },
        marcadoPelaAuxiliar: true,
        atualizadoEm: marca,
      }, { merge: true });
      const texto = child.parentUid ? R.avisoDaMarcacao({ proximo, anterior, nome: child.name, hora: horaDeBrasilia(agora) }) : null;
      if (texto) {
        tx.set(db.collection('notifications').doc(), { userId: child.parentUid, ...texto, childId, createdAt: marca });
      }
      return texto;
    });
    return { ok: true, avisou: !!aviso };
  });
}

module.exports = {
  makeMarcarParadaPelaAuxiliar,
  makeConvidarAuxiliar,
  makeCancelarConviteDeAuxiliar,
  makeVerConviteDeAuxiliar,
  makeAceitarConviteDeAuxiliar,
  makeDesativarAuxiliar,
};
