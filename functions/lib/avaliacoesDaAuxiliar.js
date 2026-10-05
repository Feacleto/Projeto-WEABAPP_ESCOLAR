/**
 * AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR — as callables (05/10/2026). A régua
 * e o porquê de cada trava estão em `reguaDaAvaliacaoDaAuxiliar.js`.
 *
 *   recomendarAuxiliar           o TIO cria ou edita a recomendação (volta a
 *                                pendente) e ela é avisada
 *   retirarRecomendacao          o tio apaga a dele
 *   responderRecomendacao        ELA aprova, oculta ou apaga
 *   removerRecomendacaoAbusiva   o DONO tira, com motivo gravado
 *   avaliarTio                   ELA dá as estrelas ao tio (uma por par)
 *   minhaNotaDasAuxiliares       o tio vê só a média, com 3 auxiliares ou mais
 *   limparAvaliacoesDaContaApagada  gatilho: conta apagada leva as dela/dele
 *
 * ── TUDO PELO SERVIDOR (trava 2 da QA)
 * As rules de `recomendacoesDeAuxiliar` e `notasDaAuxiliarAoTio` são
 * `allow write: if false`. A recomendação depende de três coisas que o
 * cliente não pode provar: os 30 dias de vínculo (a PROVA é o histórico
 * `auxiliares/{tio}_{aux}`, lido aqui — nunca um número do cliente), a frase
 * limpa (o filtro lê a turma do tio) e a assinatura (sai do doc dele).
 *
 * ── QUEM LÊ (nesta etapa)
 * A recomendação: só o autor e ela, e o dono. Aprovada também — o
 * `aprovadaEm` deixa pronto o dia em que outros tios lerem (quando ela se
 * puser disponível ou for indicada, etapa futura da Comunidade); até lá,
 * nenhuma leitura de terceiro existe, nem nas rules nem aqui.
 * A nota: só o dono lê documento por documento; o tio recebe a média por
 * `minhaNotaDasAuxiliares`, como `minhaNotaDasFamilias`.
 *
 * ── A CONTA DO TIO PRECISA ESTAR OPERANDO? NÃO, E É DECISÃO.
 * `exigirContaDoMotoristaOperando` existe porque as callables da auxiliar
 * escrevem por cima do `isAdmin()` e não podem virar o jeito de OPERAR uma
 * conta trancada. Recomendar não opera nada da perua: é o tio dizendo como
 * foi trabalhar com ela, e o momento natural de fazer isso é justamente
 * quando a relação acaba — às vezes porque ele pausou ou saiu do app.
 * Recusar ali tiraria dela a recomendação por um motivo que não é dela.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista, exigirAuxiliar, exigirDono } = require('./papeis');
const R = require('./reguaDoAuxiliar');
const A = require('./reguaDaAvaliacaoDaAuxiliar');
const { idValido } = require('./reguaDosIds');

const REGION = 'southamerica-east1';
const RECOMENDACOES = 'recomendacoesDeAuxiliar';
const NOTAS = 'notasDaAuxiliarAoTio';
const FRASE_SEM_VINCULO = 'Vocês não trabalharam juntos pelo app.';

/** O vínculo do par, ou `null`. Os dois uids do corpo precisam bater com o id. */
async function vinculoDoPar(db, motoristaUid, auxiliarUid) {
  const snap = await db.doc(`auxiliares/${R.idDoVinculo(motoristaUid, auxiliarUid)}`).get();
  const v = snap.exists ? snap.data() : null;
  if (!v || v.motoristaUid !== motoristaUid || v.auxiliarUid !== auxiliarUid) return null;
  return v;
}

/** As palavras dos nomes da turma DELE (crianças e responsáveis). */
async function nomesDaTurma(db, motoristaUid, nomeDaAuxiliar) {
  const snap = await db.collection('children').where('adminUid', '==', motoristaUid)
    .select('name', 'parentName', 'parent2Name', 'altResponsibles').limit(1000).get();
  const nomes = [];
  for (const s of snap.docs) {
    const c = s.data();
    nomes.push(c.name, c.parentName, c.parent2Name);
    for (const r of Array.isArray(c.altResponsibles) ? c.altResponsibles : []) nomes.push(r?.name);
  }
  return A.palavrasDosNomes(nomes.filter(Boolean), nomeDaAuxiliar);
}

function makeRecomendarAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const auxiliarUid = String(request.data?.auxiliarUid || '');
    if (!idValido(auxiliarUid)) throw new HttpsError('invalid-argument', 'Qual auxiliar?');
    const p = A.validarPontos(request.data?.pontos);
    if (!p.ok) throw new HttpsError('invalid-argument', p.erro);
    const frase = A.fraseLimpa(request.data?.frase);

    const v = await vinculoDoPar(db, uid, auxiliarUid);
    if (!v) throw new HttpsError('permission-denied', FRASE_SEM_VINCULO);
    if (!A.podeRecomendar(R.diasDeVinculo(v.periodos, Date.now()))) {
      throw new HttpsError('failed-precondition', `Recomendar fica disponível com ${A.MIN_DIAS_PARA_RECOMENDAR} dias de trabalho.`);
    }
    const problema = A.problemaNaFrase(frase, frase ? await nomesDaTurma(db, uid, v.nome) : new Set());
    if (problema) throw new HttpsError('invalid-argument', problema.mensagem);

    const tio = await db.doc(`users/${uid}`).get();
    const assinatura = A.assinaturaDoTio(tio.exists ? tio.data() : {});
    const ref = db.doc(`${RECOMENDACOES}/${A.idDaAvaliacao(uid, auxiliarUid)}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existente = snap.exists ? snap.data() : null;
      // A retirada pelo dono é o registro dele (com o motivo): o tio não a
      // apaga nem a ressuscita editando.
      if (existente?.removidaPeloDono) {
        throw new HttpsError('failed-precondition', 'Esta recomendação foi retirada pela equipe do Alô Buzinou.');
      }
      const agora = FieldValue.serverTimestamp();
      tx.set(ref, A.documentoDaRecomendacao({
        existente, motoristaUid: uid, auxiliarUid, assinatura, pontos: p.pontos, frase, agora,
      }));
      tx.set(db.collection('notifications').doc(), {
        userId: auxiliarUid,
        type: 'recomendacao_recebida',
        title: existente ? `${assinatura} mudou a recomendação` : `${assinatura} recomendou você`,
        body: 'Leia e decida se ela aparece.',
        read: false,
        createdAt: agora,
      });
    });
    return { ok: true };
  });
}

function makeRetirarRecomendacao(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const auxiliarUid = String(request.data?.auxiliarUid || '');
    if (!idValido(auxiliarUid)) throw new HttpsError('invalid-argument', 'Qual auxiliar?');
    const ref = db.doc(`${RECOMENDACOES}/${A.idDaAvaliacao(uid, auxiliarUid)}`);
    const snap = await ref.get();
    if (!snap.exists) return { ok: true };
    if (snap.data().motoristaUid !== uid) throw new HttpsError('permission-denied', 'Esta recomendação não é sua.');
    if (snap.data().removidaPeloDono) return { ok: true }; // o registro do dono fica
    await ref.delete();
    return { ok: true };
  });
}

function makeResponderRecomendacao(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirAuxiliar(db, request);
    const motoristaUid = String(request.data?.motoristaUid || '');
    const acao = String(request.data?.acao || '');
    if (!idValido(motoristaUid)) throw new HttpsError('invalid-argument', 'De qual motorista?');
    if (!A.ACOES_DELA.includes(acao)) throw new HttpsError('invalid-argument', 'Escolha mostrar, não mostrar ou apagar.');
    const ref = db.doc(`${RECOMENDACOES}/${A.idDaAvaliacao(motoristaUid, uid)}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const r = snap.exists ? snap.data() : null;
      if (!r || r.auxiliarUid !== uid || r.motoristaUid !== motoristaUid || r.removidaPeloDono) {
        throw new HttpsError('not-found', 'Esta recomendação não existe mais.');
      }
      const estado = A.estadoDaResposta(acao);
      if (!estado) {
        tx.delete(ref);
        return;
      }
      tx.update(ref, {
        estado,
        aprovadaEm: estado === A.ESTADO.APROVADA ? FieldValue.serverTimestamp() : null,
      });
    });
    return { ok: true };
  });
}

/**
 * O DONO TIRA O QUE FOR ABUSIVO, com motivo. O documento FICA, com
 * `removidaPeloDono` — é o registro da decisão —, e as rules o fecham para os
 * dois (`removida == true`).
 */
function makeRemoverRecomendacaoAbusiva(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const dono = await exigirDono(db, request);
    const id = String(request.data?.id || '');
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Recomendação desconhecida.');
    const motivo = String(request.data?.motivo || '').trim();
    if (!A.motivoValido(motivo)) {
      throw new HttpsError('invalid-argument', `O motivo tem de ${A.MOTIVO_MIN} a ${A.MOTIVO_MAX} letras.`);
    }
    const ref = db.doc(`${RECOMENDACOES}/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Recomendação desconhecida.');
    await ref.update({
      removida: true,
      removidaPeloDono: { motivo, em: FieldValue.serverTimestamp(), por: dono },
    });
    return { ok: true };
  });
}

function makeAvaliarTio(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirAuxiliar(db, request);
    const motoristaUid = String(request.data?.motoristaUid || '');
    if (!idValido(motoristaUid)) throw new HttpsError('invalid-argument', 'De qual motorista?');
    const estrelas = Number(request.data?.estrelas);
    if (!A.estrelasValidas(estrelas)) throw new HttpsError('invalid-argument', 'De 1 a 5 estrelas.');
    // O par precisa existir — ativo ou não: quem já trabalhou com ele também avalia.
    if (!(await vinculoDoPar(db, motoristaUid, uid))) throw new HttpsError('permission-denied', FRASE_SEM_VINCULO);
    await db.doc(`${NOTAS}/${A.idDaAvaliacao(motoristaUid, uid)}`).set({
      motoristaUid,
      auxiliarUid: uid,
      estrelas,
      em: FieldValue.serverTimestamp(),
    });
    return { ok: true, estrelas };
  });
}

function makeMinhaNotaDasAuxiliares(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const snap = await db.collection(NOTAS).where('motoristaUid', '==', uid)
      .select('auxiliarUid', 'estrelas').limit(500).get();
    return A.resumoDasNotas(snap.docs.map((s) => s.data()));
  });
}

/**
 * A CONTA APAGADA LEVA AS RECOMENDAÇÕES. Uma recomendação assinada por quem
 * não existe mais não tem quem responda por ela; e a recebida por quem
 * apagou a conta era dela. As notas ao tio não saem daqui: são da equipe.
 */
function makeLimparAvaliacoesDaContaApagada(db) {
  return onDocumentDeleted({ document: 'users/{uid}', region: REGION, maxInstances: LIMITES.GATILHO }, async (event) => {
    const uid = event.params.uid;
    for (const campo of ['motoristaUid', 'auxiliarUid']) {
      const snap = await db.collection(RECOMENDACOES).where(campo, '==', uid).limit(400).get();
      if (snap.empty) continue;
      const lote = db.batch();
      snap.docs.forEach((s) => lote.delete(s.ref));
      await lote.commit();
    }
  });
}

module.exports = {
  makeRecomendarAuxiliar,
  makeRetirarRecomendacao,
  makeResponderRecomendacao,
  makeRemoverRecomendacaoAbusiva,
  makeAvaliarTio,
  makeMinhaNotaDasAuxiliares,
  makeLimparAvaliacoesDaContaApagada,
};
