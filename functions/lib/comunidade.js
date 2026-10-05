/**
 * A COMUNIDADE — o que só o servidor pode fazer (etapa 1, 05/10/2026).
 * A régua e o porquê estão em `reguaDaComunidade.js`.
 *
 * - `publicarFotoDaTurma`: confere o "sim" de CADA família marcada (as rules
 *   não conseguem ler criança por criança de uma lista) e só então grava a
 *   foto. O arquivo já subiu para `fotosDaTurma/{uid}/…` pelo app; aqui ele
 *   ganha o link de leitura, e o link só vai para o documento que as rules
 *   protegem (só as famílias daquele tio leem, e só até `expiraEm`).
 * - `apagarFotoDaTurma`: o tio tira a foto antes do prazo.
 * - `meusParceiros`: os tios parceiros (pela indicação) e os posts deles.
 *   Mora no servidor porque a consulta de `indicacoes` por uid não é
 *   escopada por dono nas rules — abri-la entregaria a base inteira.
 * - `limparFotosVencidas`: agendada, apaga documento e arquivo vencidos.
 *
 * FASE 1 DA REDE (05/10/2026): `meusParceiros` passa a dizer as escolas de
 * cada parceiro, `avisarParceiroIndicado` avisa o parceiro que o tio o
 * indicou a uma família (sem dado nenhum dela), e a foto da turma para as
 * famílias toca no celular delas, uma vez por época.
 */

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const {
  PUBLICO,
  caminhoValido,
  validarPublicacao,
  parceirosDe,
  expiraEmMs,
  escolasDoParceiro,
  idDoAvisoAoParceiro,
  avisoAoParceiro,
  idDoAvisoDaFoto,
  avisoDaFoto,
  familiasDaTurma,
  semestreDe,
  semestreAnterior,
  resumoParaOTio,
} = require('./reguaDaComunidade');

const REGION = 'southamerica-east1';
const COLECAO = 'fotosDaTurma';

function linkDeLeitura(bucket, caminho, token) {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

function makePublicarFotoDaTurma(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const d = request.data || {};
    if (!caminhoValido(uid, d.caminho)) throw new HttpsError('invalid-argument', 'A foto não chegou. Tente de novo.');

    // Id que não passa na régua não vira caminho (e a validação recusa a
    // lista por estar errada, em vez de publicar sem a criança).
    const criancas = Array.isArray(d.criancas) ? d.criancas : [];
    if (!criancas.every(idValido)) throw new HttpsError('invalid-argument', 'A lista de crianças está errada.');
    const docs = criancas.length ? await db.getAll(...criancas.map((id) => db.doc(`children/${id}`))) : [];
    const turma = Object.fromEntries(docs.filter((s) => s.exists).map((s) => [s.id, s.data()]));
    const legenda = typeof d.legenda === 'string' ? d.legenda.trim() : null;
    const v = validarPublicacao({
      uid,
      publico: d.publico,
      criancas,
      epoca: d.epoca,
      legenda: legenda || null,
      todasMarcadas: d.todasMarcadas,
      semCrianca: d.semCrianca,
      turma,
    });
    if (!v.ok) throw new HttpsError('failed-precondition', v.erro, v.semSim ? { semSim: v.semSim } : undefined);

    const bucket = getStorage().bucket();
    const arquivo = bucket.file(d.caminho);
    const [existe] = await arquivo.exists();
    if (!existe) throw new HttpsError('not-found', 'A foto não chegou. Tente de novo.');
    const token = crypto.randomUUID();
    await arquivo.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });

    const agora = Date.now();
    const ref = db.collection(COLECAO).doc();
    await ref.set({
      adminUid: uid,
      publico: d.publico,
      criancas,
      epoca: d.epoca,
      legenda: legenda || null,
      caminho: d.caminho,
      url: linkDeLeitura(bucket, d.caminho, token),
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm: Timestamp.fromMillis(expiraEmMs(agora)),
    });
    if (d.publico === PUBLICO.FAMILIAS) await avisarFamiliasDaFoto(db, uid, d.epoca);
    return { id: ref.id };
  });
}

/**
 * Cria o aviso só se ele ainda não existe: o id é o que impede o segundo
 * toque (`create` falha com ALREADY_EXISTS, e isso é o caminho normal).
 */
async function criarSeNaoExiste(ref, dados) {
  try {
    await ref.create(dados);
    return true;
  } catch (err) {
    if (err?.code === 6 || /already exists/i.test(String(err?.message))) return false;
    throw err;
  }
}

/**
 * ⚠️ FALHAR AQUI NÃO DESFAZ A FOTO. Ela já foi gravada e as famílias a veem
 * no Início; o aviso é um toque a mais, e perder o toque é melhor do que
 * dizer ao tio que a publicação falhou quando ela está no ar.
 */
async function avisarFamiliasDaFoto(db, uid, epoca) {
  try {
    const [tio, turma] = await Promise.all([
      db.doc(`users/${uid}`).get(),
      db.collection('children').where('adminUid', '==', uid).select('parentUid', 'active').limit(300).get(),
    ]);
    const aviso = avisoDaFoto(tio.get('marcaNome') || tio.get('name'), epoca);
    const familias = familiasDaTurma(turma.docs.map((s) => s.data()));
    await Promise.all(familias.map((parentUid) => {
      const id = idDoAvisoDaFoto(uid, epoca, parentUid);
      if (!id) return null;
      return criarSeNaoExiste(db.doc(`notifications/${id}`), {
        userId: parentUid,
        ...aviso,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }));
  } catch (err) {
    logger.warn('comunidade: aviso da foto não saiu', { uid, erro: err?.message });
  }
}

async function apagarFoto(db, ref, dados) {
  try {
    await getStorage().bucket().file(dados.caminho).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn('comunidade: arquivo não apagado', { id: ref.id, erro: err?.message });
  }
  await ref.delete();
}

function makeApagarFotoDaTurma(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const id = request.data?.id;
    // Todo id vindo do cliente passa pela régua antes de virar caminho.
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Foto não encontrada.');
    const ref = db.doc(`${COLECAO}/${id}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().adminUid !== uid) throw new HttpsError('not-found', 'Foto não encontrada.');
    await apagarFoto(db, ref, snap.data());
    return { ok: true };
  });
}

function makeMeusParceiros(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const [feitas, recebidas] = await Promise.all([
      db.collection('indicacoes').where('indicadorUid', '==', uid).limit(200).get(),
      db.collection('indicacoes').where('indicadoUid', '==', uid).limit(50).get(),
    ]);
    const lista = parceirosDe(uid, {
      feitas: feitas.docs.map((s) => s.data()),
      recebidas: recebidas.docs.map((s) => s.data()),
    }).slice(0, 60);
    if (!lista.length) return { parceiros: [], fotos: [] };

    const [perfis, escolas] = await Promise.all([
      db.getAll(...lista.map((p) => db.doc(`users/${p.uid}`))),
      // As escolas são o que o tio pergunta antes de indicar ("ele passa na
      // escola da Ana?"). Só o NOME: endereço e telefone da escola ficam
      // com o parceiro.
      Promise.all(lista.map((p) =>
        db.collection('schools').where('adminUid', '==', p.uid).select('nome').limit(12).get()
          .then((snap) => escolasDoParceiro(snap.docs.map((s) => s.get('nome'))))
          .catch(() => [])
      )),
    ]);
    const parceiros = lista.map((p, i) => {
      const u = perfis[i].exists ? perfis[i].data() : {};
      // SÓ o que ele já mostra às famílias dele: a marca, o logo e a região.
      return {
        uid: p.uid,
        papel: p.papel,
        marca: u.marcaNome || u.name || 'Motorista',
        logoURL: u.marcaLogoURL || null,
        lugar: [u.regiao, u.city].filter(Boolean).join(' · ') || null,
        escolas: escolas[i],
        // O WhatsApp é o que o tio passa à família quando INDICA o parceiro
        // (etapa 2). Os dois se conhecem pela indicação, e é o número com
        // que o parceiro já atende as famílias dele.
        whatsapp: String(u.phone || '').replace(/\D/g, '') || null,
      };
    });

    const agora = Timestamp.now();
    const fotos = [];
    for (let i = 0; i < lista.length; i += 30) {
      const pedaco = lista.slice(i, i + 30).map((p) => p.uid);
      const snap = await db
        .collection(COLECAO)
        .where('adminUid', 'in', pedaco)
        .where('publico', '==', PUBLICO.PARCEIROS)
        .where('expiraEm', '>', agora)
        .limit(60)
        .get();
      for (const s of snap.docs) {
        const f = s.data();
        fotos.push({ id: s.id, adminUid: f.adminUid, epoca: f.epoca, legenda: f.legenda || null, url: f.url, expiraEmMs: f.expiraEm.toMillis(), criadaEmMs: f.criadaEm?.toMillis?.() || null });
      }
    }
    fotos.sort((a, b) => (b.criadaEmMs || 0) - (a.criadaEmMs || 0));
    return { parceiros, fotos: fotos.slice(0, 60) };
  });
}

/**
 * O tio indicou um parceiro a uma família (o WhatsApp já abriu no aparelho
 * dele): o parceiro recebe o aviso. A parceria é conferida de novo aqui —
 * sem isso, qualquer motorista mandaria aviso com o nome dele para qualquer
 * outro.
 */
function makeAvisarParceiroIndicado(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const parceiroUid = request.data?.parceiroUid;
    if (!idValido(parceiroUid) || parceiroUid === uid) throw new HttpsError('invalid-argument', 'Parceiro não encontrado.');
    const [feitas, recebidas] = await Promise.all([
      db.collection('indicacoes').where('indicadorUid', '==', uid).where('indicadoUid', '==', parceiroUid).limit(1).get(),
      db.collection('indicacoes').where('indicadorUid', '==', parceiroUid).where('indicadoUid', '==', uid).limit(1).get(),
    ]);
    const parceiros = parceirosDe(uid, {
      feitas: feitas.docs.map((s) => s.data()),
      recebidas: recebidas.docs.map((s) => s.data()),
    });
    if (!parceiros.some((p) => p.uid === parceiroUid)) throw new HttpsError('permission-denied', 'Parceiro não encontrado.');
    const tio = await db.doc(`users/${uid}`).get();
    const novo = await criarSeNaoExiste(db.doc(`notifications/${idDoAvisoAoParceiro(parceiroUid, uid)}`), {
      userId: parceiroUid,
      ...avisoAoParceiro(tio.get('marcaNome') || tio.get('name')),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, avisado: novo };
  });
}

/**
 * A NOTA DAS FAMÍLIAS — o que o tio pode ver (etapa 2). Mora no servidor
 * porque as rules não deixam o tio ler as avaliações uma a uma (é o que
 * mantém o anonimato): daqui sai só a média do semestre FECHADO, com o
 * mínimo de respostas, e quantas famílias já responderam no corrente.
 */
function makeMinhaNotaDasFamilias(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const semestre = semestreDe(new Date());
    const [anterior, atual] = await Promise.all([
      db.collection('avaliacoesDoTio').where('adminUid', '==', uid)
        .where('semestre', '==', semestreAnterior(semestre)).select('nota').limit(500).get(),
      db.collection('avaliacoesDoTio').where('adminUid', '==', uid)
        .where('semestre', '==', semestre).select().limit(500).get(),
    ]);
    return resumoParaOTio({
      semestre,
      notasDoAnterior: anterior.docs.map((s) => s.get('nota')),
      totalAtual: atual.size,
    });
  });
}

function makeLimparFotosVencidas(db) {
  return onSchedule(
    {
      // 3h30, longe das rotas e antes das outras limpezas.
      schedule: '30 3 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      let apagadas = 0;
      for (let rodada = 0; rodada < 20; rodada += 1) {
        const snap = await db.collection(COLECAO).where('expiraEm', '<=', Timestamp.now()).limit(200).get();
        if (snap.empty) break;
        for (const s of snap.docs) {
          await apagarFoto(db, s.ref, s.data());
          apagadas += 1;
        }
      }
      logger.info('comunidade: fotos vencidas apagadas', { apagadas });
    }
  );
}

module.exports = {
  makePublicarFotoDaTurma,
  makeApagarFotoDaTurma,
  makeMeusParceiros,
  makeLimparFotosVencidas,
  makeMinhaNotaDasFamilias,
  makeAvisarParceiroIndicado,
};
