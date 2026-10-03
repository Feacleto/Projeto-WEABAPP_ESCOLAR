/**
 * O LINK DO DIA — quem vai pegar a criança acompanha a entrega, sem conta.
 *
 * O PROBLEMA
 * O pai indica que hoje quem pega é a avó. O app avisa o MOTORISTA
 * (`alt_pickup`) e não avisa a avó de nada: ela fica na calçada sem saber se a
 * perua já saiu, se a criança embarcou, se falta muito. O telefone dela já
 * está no app — o pai acabou de digitar — e mesmo assim o único jeito de ela
 * saber alguma coisa é ligar pro pai, que liga pro motorista.
 *
 * ── ⚠️ POR QUE ELA NÃO GANHA UMA CONTA
 * Ela vai pegar a criança UMA TARDE. Uma conta é uma credencial que sobrevive
 * à tarde, e ninguém remove o que criou pra uma tarde. O link morre à
 * meia-noite sozinho.
 *
 * ── ⚠️ E POR QUE ELE NÃO ABRE SESSÃO NO FIREBASE
 * Sessão significa rules decidindo o que ela alcança, e rules são um alfabeto
 * de "pode ler o documento X". O que ela pode ver não é um documento: é meia
 * dúzia de campos de três documentos diferentes. Uma callable pública
 * devolvendo uma lista fechada é a única forma de a resposta ser exatamente
 * essa — o mesmo desenho do `getInvitePreview`, e pelo mesmo motivo.
 *
 * ── ⚠️ O TOKEN CARREGA O ENDEREÇO E GUARDA O SEGREDO SEPARADO
 * Formato: `AAAA-MM-DD_childId.SEGREDO`. A primeira metade é só endereçamento
 * — ela diz qual documento abrir, e não protege nada. Quem protege é o
 * SEGREDO: 32 bytes aleatórios, comparados contra um SHA-256 guardado no
 * documento da indicação.
 *
 * Isso evita uma coleção inteira: sem a metade endereçável, achar o documento
 * exigiria consultar por hash, o que pede índice, regra e mais superfície. E
 * evita o pior detalhe — guardar o token em claro no banco.
 *
 * ── ⚠️ A REVOGAÇÃO JÁ EXISTIA, E NÃO PRECISOU DE CÓDIGO
 * O hash mora em `altPickups/{dia}_{crianca}`, que é o documento que o pai
 * apaga quando toca em "Trocar" (`clearDailyAltPickup`) e que ele SOBRESCREVE
 * quando indica outra pessoa (`setDailyAltPickup` usa `setDoc` sem merge).
 * Nos dois casos o hash some junto e o link para de responder no mesmo
 * instante. Gerar de novo também invalida o anterior, pelo mesmo caminho.
 *
 * ── ⚠️ O CAMINHO PÚBLICO NUNCA ESCREVE
 * `verAcompanhamento` só lê. Contador de acesso seria uma escrita disparada
 * por quem não tem conta — ou seja, um endpoint público que grava, que é como
 * se paga uma conta de Firestore sem ninguém ter feito nada errado.
 */

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const crypto = require('node:crypto');
const LIMITES = require('./limites');
const { idValido } = require('./reguaDosIds');
const {
  chaveDoDia,
  acessoValido,
  montarAcompanhamento,
} = require('./reguaDoAcompanhamento');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  DURACAO_DO_ACESSO_MS,
  MAXIMO_DE_APARELHOS,
  PREFIXO,
  acessoTemporarioValendo,
  lerTokenTemporario,
  podeGerar,
} = require('./reguaDoAcessoTemporario');

const REGION = 'southamerica-east1';

/** Bytes de segredo. 32 = 256 bits: varredura não é um plano. */
const BYTES_DO_SEGREDO = 32;

function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

/**
 * Comparação de tempo constante.
 *
 * `a === b` num hash vaza, pelo tempo de resposta, quantos caracteres
 * bateram. É defesa barata e o caso aqui é público — vale pagar.
 */
function mesmoHash(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length || x.length === 0) return false;
  return crypto.timingSafeEqual(x, y);
}

function idDaIndicacao(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

/** `AAAA-MM-DD_childId.SEGREDO` → as três partes, ou null. */
function lerToken(bruto) {
  const texto = String(bruto || '').trim();
  const ponto = texto.indexOf('.');
  if (ponto < 1 || ponto === texto.length - 1) return null;
  const endereco = texto.slice(0, ponto);
  const segredo = texto.slice(ponto + 1);
  const corte = endereco.indexOf('_');
  if (corte < 1) return null;
  const dateKey = endereco.slice(0, corte);
  const childId = endereco.slice(corte + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  // `idValido`: o childId vira caminho (`children/${childId}/rides/...`), e
  // uma barra nele endereçaria outro documento (reguaDosIds.js).
  if (!idValido(childId) || !segredo || segredo.length > 200) return null;
  return { dateKey, childId, segredo, endereco };
}

/**
 * gerarAcessoDoDia — o pai cria o link para quem vai pegar hoje.
 *
 * Exige que a indicação do dia JÁ EXISTA: o link é sobre uma pessoa concreta,
 * e sem ela não há o que compartilhar nem o que revogar depois.
 */
function makeGerarAcessoDoDia(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');

    const childId = String((request.data && request.data.childId) || '').trim();
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Criança não informada.');

    const childSnap = await db.doc(`children/${childId}`).get();
    if (!childSnap.exists) throw new HttpsError('not-found', 'Criança não encontrada.');

    // ⚠️ O ESCOPO É O `parentUid` DA CRIANÇA, e vem do BANCO — nunca de
    // `request.data`. É a mesma regra dos outros callables do projeto.
    if (childSnap.data().parentUid !== uid) {
      throw new HttpsError('permission-denied', 'Esta criança não é da sua conta.');
    }

    const dateKey = chaveDoDia();
    const ref = db.doc(`altPickups/${idDaIndicacao(dateKey, childId)}`);
    const indicacao = await ref.get();
    if (!indicacao.exists) {
      throw new HttpsError(
        'failed-precondition',
        'Indique primeiro quem vai pegar a criança hoje.'
      );
    }

    const segredo = crypto.randomBytes(BYTES_DO_SEGREDO).toString('base64url');
    // Só o HASH vai pro banco. O segredo existe uma vez, nesta resposta.
    // Gerar de novo troca o hash e derruba o link anterior — é a rotação.
    await ref.update({ acessoHash: sha256(segredo) });

    logger.info(`acesso do dia gerado: child=${childId} dia=${dateKey}`);
    return { token: `${idDaIndicacao(dateKey, childId)}.${segredo}` };
  });
}

/**
 * verAcompanhamento — a página pública lê por aqui.
 *
 * ⚠️ UMA MENSAGEM SÓ PARA TODAS AS RECUSAS. Link inexistente, link de ontem,
 * indicação removida e segredo errado respondem a mesma coisa. Diferenciar
 * conta a quem está sondando que o endereço existe — a mesma discrição que o
 * `lookupInvite` já pratica.
 */
function makeVerAcompanhamento(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const recusa = () =>
      new HttpsError('not-found', 'Este link não vale mais. Peça um novo a quem te mandou.');

    // O ACESSO DE 24 HORAS do segundo responsável tem token próprio (`t_`).
    const temporario = lerTokenTemporario(request.data && request.data.token);
    if (temporario) return verAcessoTemporario(db, temporario, recusa);

    const partes = lerToken(request.data && request.data.token);
    if (!partes) throw recusa();

    const ref = db.doc(`altPickups/${partes.endereco}`);
    const snap = await ref.get();
    if (!snap.exists) throw recusa();
    const indicacao = snap.data();

    if (!mesmoHash(indicacao.acessoHash, sha256(partes.segredo))) throw recusa();

    const veredito = acessoValido({
      acesso: { dateKey: partes.dateKey, childId: partes.childId },
      altPickup: indicacao,
    });
    if (!veredito.ok) {
      logger.info(`acesso recusado: ${veredito.motivo} dia=${partes.dateKey}`);
      throw recusa();
    }

    const childSnap = await db.doc(`children/${partes.childId}`).get();
    if (!childSnap.exists) throw recusa();
    const child = childSnap.data();

    // Criança desativada não tem mais acompanhamento — e o link não pode
    // sobreviver à saída dela da perua.
    if (child.active === false) throw recusa();

    const [rideSnap, motoristaSnap] = await Promise.all([
      db.doc(`children/${partes.childId}/rides/${partes.dateKey}`).get(),
      child.adminUid ? db.doc(`users/${child.adminUid}`).get() : Promise.resolve(null),
    ]);

    return montarAcompanhamento({
      child,
      ride: rideSnap.exists ? rideSnap.data() : null,
      motorista: motoristaSnap && motoristaSnap.exists ? motoristaSnap.data() : null,
    });
  });
}

// ════════════════════════════════════════════════════════════════════════
// O ACESSO DE 24 HORAS DO SEGUNDO RESPONSÁVEL (03/10/2026)
// A régua e o porquê estão em `reguaDoAcessoTemporario.js`.
// ════════════════════════════════════════════════════════════════════════

async function lerAcessoValido(db, temporario) {
  const ref = db.doc(`acessosTemporarios/${temporario.id}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const acesso = snap.data();
  if (!mesmoHash(acesso.acessoHash, sha256(temporario.segredo))) return null;
  if (!acessoTemporarioValendo(acesso)) return null;
  return { ref, acesso };
}

async function verAcessoTemporario(db, temporario, recusa) {
  const achado = await lerAcessoValido(db, temporario);
  if (!achado) throw recusa();
  const { acesso } = achado;
  const childSnap = await db.doc(`children/${acesso.childId}`).get();
  if (!childSnap.exists) throw recusa();
  const child = childSnap.data();
  // A criança mudou de família ou saiu da perua: o acesso morre junto.
  if (child.active === false || child.parentUid !== acesso.parentUid) throw recusa();
  const hoje = chaveDoDia();
  const [rideSnap, motoristaSnap] = await Promise.all([
    db.doc(`children/${acesso.childId}/rides/${hoje}`).get(),
    child.adminUid ? db.doc(`users/${child.adminUid}`).get() : Promise.resolve(null),
  ]);
  return {
    ...montarAcompanhamento({
      child,
      ride: rideSnap.exists ? rideSnap.data() : null,
      motorista: motoristaSnap && motoristaSnap.exists ? motoristaSnap.data() : null,
    }),
    // Só o que a página precisa para dizer "este link vale até tal hora".
    temporario: { expiraEm: acesso.expiraEm.toMillis() },
  };
}

/**
 * A titular ou o motorista gera o link de 24h para o SEGUNDO RESPONSÁVEL da
 * criança (`parent2Name`/`parent2Phone`). Gerar de novo encerra o anterior.
 */
function makeGerarAcessoTemporario(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String((request.data && request.data.childId) || '').trim();
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Criança não informada.');

    const childSnap = await db.doc(`children/${childId}`).get();
    if (!childSnap.exists) throw new HttpsError('not-found', 'Criança não encontrada.');
    const crianca = childSnap.data();
    // Escopo pelo uid AUTENTICADO, nunca por `request.data` (papeis.js).
    if (!podeGerar({ uid, crianca })) {
      throw new HttpsError('permission-denied', 'Esta criança não é sua.');
    }
    if (!crianca.parentUid) {
      throw new HttpsError('failed-precondition', 'A família ainda não entrou no app.');
    }
    if (!String(crianca.parent2Phone || '').replace(/\D/g, '')) {
      throw new HttpsError('failed-precondition', 'Cadastre o WhatsApp do segundo responsável antes.');
    }

    const anteriores = await db
      .collection('acessosTemporarios')
      .where('childId', '==', childId)
      .where('revogadoEm', '==', null)
      .get();
    const lote = db.batch();
    for (const d of anteriores.docs) {
      lote.update(d.ref, { revogadoEm: FieldValue.serverTimestamp(), fcmTokens: [] });
    }

    const ref = db.collection('acessosTemporarios').doc();
    const segredo = crypto.randomBytes(BYTES_DO_SEGREDO).toString('base64url');
    const expiraEm = Timestamp.fromMillis(Date.now() + DURACAO_DO_ACESSO_MS);
    const peloMotorista = crianca.adminUid === uid;
    lote.set(ref, {
      childId,
      parentUid: crianca.parentUid,
      adminUid: crianca.adminUid || null,
      nome: String(crianca.parent2Name || '').slice(0, 80),
      telefone: String(crianca.parent2Phone || '').replace(/\D/g, ''),
      criadoPor: peloMotorista ? 'motorista' : 'familia',
      criadoEm: FieldValue.serverTimestamp(),
      expiraEm,
      revogadoEm: null,
      acessoHash: sha256(segredo),
      fcmTokens: [],
    });
    // Quem não gerou fica sabendo: alguém novo acompanha a criança.
    const nome = String(crianca.parent2Name || '').trim().split(/\s+/)[0] || 'O segundo responsável';
    const filho = String(crianca.name || '').trim().split(/\s+/)[0] || 'a criança';
    const destinatario = peloMotorista ? crianca.parentUid : crianca.adminUid;
    if (destinatario) {
      lote.set(db.collection('notifications').doc(), {
        userId: destinatario,
        type: 'acesso_temporario',
        childId,
        title: `${nome} acompanha ${filho} por 24 horas`,
        body: peloMotorista
          ? 'O motorista mandou o link. Ele vê o dia na perua, sem endereço nem mensalidade.'
          : 'A família mandou o link. Ele vê o dia na perua, sem endereço nem mensalidade.',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await lote.commit();
    logger.info(`acesso de 24h gerado: child=${childId}`);
    return { token: `${PREFIXO}${ref.id}.${segredo}`, expiraEm: expiraEm.toMillis() };
  });
}

/** Encerra antes da hora — a titular ou o motorista. */
function makeEncerrarAcessoTemporario(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String((request.data && request.data.childId) || '').trim();
    const childSnap = idValido(childId) ? await db.doc(`children/${childId}`).get() : null;
    if (!childSnap || !childSnap.exists || !podeGerar({ uid, crianca: childSnap.data() })) {
      throw new HttpsError('permission-denied', 'Esta criança não é sua.');
    }
    const abertos = await db
      .collection('acessosTemporarios')
      .where('childId', '==', childId)
      .where('revogadoEm', '==', null)
      .get();
    const lote = db.batch();
    for (const d of abertos.docs) {
      lote.update(d.ref, { revogadoEm: FieldValue.serverTimestamp(), fcmTokens: [] });
    }
    await lote.commit();
    return { encerrados: abertos.size };
  });
}

/**
 * Quem abriu o link aceita receber os avisos: o aparelho dele entra no
 * acesso. Pública como a página — quem prova o direito é o token.
 */
function makeInscreverAvisosDoAcesso(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const temporario = lerTokenTemporario(request.data && request.data.token);
    const fcm = String((request.data && request.data.fcmToken) || '').trim();
    if (!temporario || !fcm || fcm.length > 400) {
      throw new HttpsError('invalid-argument', 'Link ou aparelho inválido.');
    }
    const achado = await lerAcessoValido(db, temporario);
    if (!achado) throw new HttpsError('not-found', 'Este link não vale mais.');
    const atuais = (achado.acesso.fcmTokens || []).filter((t) => t !== fcm);
    const novos = [...atuais, fcm].slice(-MAXIMO_DE_APARELHOS);
    await achado.ref.update({ fcmTokens: novos });
    return { ok: true };
  });
}

module.exports = {
  makeGerarAcessoDoDia,
  makeVerAcompanhamento,
  makeGerarAcessoTemporario,
  makeEncerrarAcessoTemporario,
  makeInscreverAvisosDoAcesso,
  lerToken,
  sha256,
};
