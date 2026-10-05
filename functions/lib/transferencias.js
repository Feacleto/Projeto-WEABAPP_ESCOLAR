/**
 * PASSAR A FAMÍLIA PARA OUTRO TIO — o que só o servidor pode fazer (fase 2 da
 * rede, 05/10/2026). A régua e o porquê de cada decisão estão em
 * `reguaDaTransferencia.js`.
 *
 * Quatro callables, uma por toque:
 * - `pedirTransferencia` (o tio de agora, na ficha da criança);
 * - `responderTransferencia` (o parceiro aceita ou recusa);
 * - `cancelarTransferencia` (o tio de agora desiste antes do aceite da família);
 * - `aceitarTransferencia` (a FAMÍLIA, e é aqui que a criança nova nasce).
 *
 * `transferenciasDeFamilia/{id}` é escrita só daqui (as rules fecham para
 * todo cliente). O parceiro lê o pedido, que guarda só o primeiro nome e a
 * escola: nada da família chega a ele antes de ELA aceitar.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const { cobrancaLigada } = require('./cobrancaLigada');
const { parceirosDe } = require('./reguaDaComunidade');
const R = require('./reguaDaTransferencia');

const REGION = 'southamerica-east1';
const COLECAO = 'transferenciasDeFamilia';

function marcaDe(u) {
  return u?.marcaNome || u?.name || null;
}

async function saoParceiros(db, uid, outroUid) {
  const [feitas, recebidas] = await Promise.all([
    db.collection('indicacoes').where('indicadorUid', '==', uid).where('indicadoUid', '==', outroUid).limit(1).get(),
    db.collection('indicacoes').where('indicadorUid', '==', outroUid).where('indicadoUid', '==', uid).limit(1).get(),
  ]);
  return parceirosDe(uid, {
    feitas: feitas.docs.map((s) => s.data()),
    recebidas: recebidas.docs.map((s) => s.data()),
  }).some((p) => p.uid === outroUid);
}

function aviso(userId, dados, extra = {}) {
  return { userId, ...dados, ...extra, read: false, createdAt: FieldValue.serverTimestamp() };
}

function makePedirTransferencia(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const { childId, parceiroUid } = request.data || {};
    if (!idValido(childId) || !idValido(parceiroUid)) throw new HttpsError('invalid-argument', 'Escolha um dos seus tios parceiros.');

    const agora = Date.now();
    const [ligada, tioSnap, criancaSnap, parceiroSnap, ehParceiro] = await Promise.all([
      cobrancaLigada(db),
      db.doc(`users/${uid}`).get(),
      db.doc(`children/${childId}`).get(),
      db.doc(`users/${parceiroUid}`).get(),
      saoParceiros(db, uid, parceiroUid),
    ]);
    const crianca = criancaSnap.exists ? criancaSnap.data() : null;
    const ref = db.collection(COLECAO).doc();
    const previa = R.previaDoParceiro(crianca);

    /*
     * ⚠️ O TETO E O "JÁ EXISTE UM PEDIDO" CONTAM DENTRO DA MESMA TRANSAÇÃO
     * QUE CRIA O PEDIDO. Contados fora, dois toques simultâneos (dois
     * aparelhos, ou o 10º e o 11º disparados juntos) leriam os dois "9 no
     * mês" e passariam os dois. As transações do Admin SDK aceitam CONSULTA
     * (`tx.get(query)`) e são serializáveis: a leitura trava o conjunto
     * consultado, e a segunda transação que tentar criar um pedido dentro
     * dele espera ou é refeita — e, refeita, já vê o primeiro. O que não
     * muda em segundos (cobrança, os dois tios, a criança, a parceria) fica
     * fora, lido uma vez; consulta de parceria dentro travaria `indicacoes`.
     *
     * O mês sai de `criadoEm`, e o pedido nasce com `serverTimestamp` —
     * sempre dentro da faixa consultada pelo pedido seguinte.
     */
    await db.runTransaction(async (tx) => {
      const [abertas, doMes] = await Promise.all([
        tx.get(db.collection(COLECAO).where('deUid', '==', uid).where('childId', '==', childId)
          .where('estado', 'in', R.ABERTOS).limit(5)),
        // Só os pedidos DELE, criados neste mês (fuso de Brasília). Índice
        // composto deUid + criadoEm (firestore.indexes.json). O limite passa
        // do teto com folga: a conta de quem conta é da régua.
        tx.get(db.collection(COLECAO).where('deUid', '==', uid)
          .where('criadoEm', '>=', Timestamp.fromMillis(R.inicioDoMesMs(agora)))
          .select('estado', 'expiraEm', 'criadoEm').limit(R.TETO_POR_MES * 5)),
      ]);
      const v = R.podePedir({
        cobrancaLigada: ligada,
        uid,
        tio: tioSnap.data(),
        crianca,
        parceiroUid,
        parceiro: parceiroSnap.exists ? parceiroSnap.data() : null,
        ehParceiro,
        temAberta: abertas.docs.some((d) => R.estaAberta(d.data(), agora)),
        // Lista cheia (50 pedidos no mês) é teto, sem contar: a página cortada
        // poderia deixar de fora justamente os que contam.
        pedidasNoMes: doMes.size >= R.TETO_POR_MES * 5
          ? R.TETO_POR_MES
          : R.pedidosQueContam(doMes.docs.map((d) => d.data()), agora),
      });
      if (!v.ok) throw new HttpsError('failed-precondition', v.erro);

      tx.set(ref, {
        deUid: uid,
        paraUid: parceiroUid,
        familiaUid: crianca.parentUid,
        childId,
        previa,
        marcaDe: marcaDe(tioSnap.data()),
        marcaPara: marcaDe(parceiroSnap.data()),
        estado: R.ESTADO.PEDIDO,
        // A família não vê o pedido até o parceiro aceitar (rules).
        familiaVe: false,
        criadoEm: FieldValue.serverTimestamp(),
        expiraEm: Timestamp.fromMillis(R.expiraEmMs(agora)),
      });
      tx.set(db.collection('notifications').doc(), aviso(parceiroUid, R.avisoAoParceiro({ marcaDe: marcaDe(tioSnap.data()), previa }), { transferenciaId: ref.id }));
    });
    return { id: ref.id };
  });
}

function makeResponderTransferencia(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const { id, aceito } = request.data || {};
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Pedido não encontrado.');
    const ref = db.doc(`${COLECAO}/${id}`);
    // Os contratos da assinatura dele: o aceite exige que o MAIS RECENTE
    // esteja aceito e seja do plano de agora (`contratoAceitoDoPlano`).
    // Igualdade só no tioUid: índice de campo único, e são poucos por tio —
    // a ordem é feita na régua, pela emissão.
    const [snap, eu, ligada, contratos] = await Promise.all([
      ref.get(),
      db.doc(`users/${uid}`).get(),
      cobrancaLigada(db),
      db.collection('contratosAssociacao').where('tioUid', '==', uid).select('aceitoEm', 'emitidoEm', 'conteudo.plano').limit(50).get(),
    ]);
    const t = snap.exists ? snap.data() : null;
    if (!t || t.paraUid !== uid) throw new HttpsError('not-found', 'Pedido não encontrado.');

    if (aceito !== true) {
      if (R.estadoEfetivo(t) !== R.ESTADO.PEDIDO) throw new HttpsError('failed-precondition', 'Este pedido não está mais aberto.');
      const lote = db.batch();
      lote.update(ref, { estado: R.ESTADO.RECUSADA_PARCEIRO, respondidoEm: FieldValue.serverTimestamp() });
      lote.set(db.collection('notifications').doc(), aviso(t.deUid, R.avisoDeResposta({ marcaPara: t.marcaPara, nome: t.previa?.primeiroNome, aceito: false }), { transferenciaId: id, childId: t.childId }));
      await lote.commit();
      return { ok: true, estado: R.ESTADO.RECUSADA_PARCEIRO };
    }

    const v = R.podeAceitarParceiro({
      cobrancaLigada: ligada,
      uid,
      t,
      parceiro: eu.data(),
      contratoAceito: R.contratoAceitoDoPlano(contratos.docs.map((s) => ({ id: s.id, ...s.data() })), eu.get('plano')),
    });
    if (!v.ok) throw new HttpsError('failed-precondition', v.erro, v.precisaAssinar ? { precisaAssinar: true } : undefined);
    const lote = db.batch();
    lote.update(ref, { estado: R.ESTADO.PARCEIRO_ACEITOU, familiaVe: true, respondidoEm: FieldValue.serverTimestamp(), parceiroAceitouEm: FieldValue.serverTimestamp() });
    lote.set(db.collection('notifications').doc(), aviso(t.deUid, R.avisoDeResposta({ marcaPara: t.marcaPara, nome: t.previa?.primeiroNome, aceito: true }), { transferenciaId: id, childId: t.childId }));
    lote.set(db.collection('notifications').doc(), aviso(t.familiaUid, R.avisoAFamilia({ marcaDe: t.marcaDe, marcaPara: t.marcaPara, nome: t.previa?.primeiroNome }), { transferenciaId: id, childId: t.childId }));
    await lote.commit();
    return { ok: true, estado: R.ESTADO.PARCEIRO_ACEITOU };
  });
}

function makeCancelarTransferencia(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const id = request.data?.id;
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Pedido não encontrado.');
    const ref = db.doc(`${COLECAO}/${id}`);
    const snap = await ref.get();
    const t = snap.exists ? snap.data() : null;
    if (!t || t.deUid !== uid) throw new HttpsError('not-found', 'Pedido não encontrado.');
    if (!R.estaAberta(t)) throw new HttpsError('failed-precondition', 'Este pedido não está mais aberto.');
    await ref.update({ estado: R.ESTADO.CANCELADA, canceladoEm: FieldValue.serverTimestamp() });
    return { ok: true };
  });
}

/**
 * O ACEITE DA FAMÍLIA — numa transação, para a criança não nascer duas vezes
 * nem a antiga ficar ativa ao lado da nova. As leituras de fora (escolas do
 * parceiro, outras crianças e mensalidades em aberto com o tio de antes)
 * vêm antes, porque consulta dentro da transação travaria coleções
 * inteiras; o que pode mudar no meio (o pedido, a criança, o parceiro e a
 * família) é lido de novo lá dentro.
 */
function makeAceitarTransferencia(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatório.');
    const id = request.data?.id;
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Pedido não encontrado.');
    const ref = db.doc(`${COLECAO}/${id}`);
    const primeiro = await ref.get();
    const t0 = primeiro.exists ? primeiro.data() : null;
    if (!t0 || t0.familiaUid !== uid || !idValido(t0.childId) || !idValido(t0.paraUid) || !idValido(t0.deUid)) {
      throw new HttpsError('not-found', 'Pedido não encontrado.');
    }

    const [ligada, escolas, outrasComDe, emAberto] = await Promise.all([
      cobrancaLigada(db),
      db.collection('schools').where('adminUid', '==', t0.paraUid).select('nome').limit(100).get(),
      db.collection('children').where('adminUid', '==', t0.deUid).where('parentUid', '==', uid).select('active').limit(20).get(),
      db.collection('payments').where('adminUid', '==', t0.deUid).where('parentUid', '==', uid)
        .where('status', 'in', ['pending', 'claimed']).select().limit(1).get(),
    ]);
    const listaDeEscolas = escolas.docs.map((s) => ({ id: s.id, nome: s.get('nome') }));
    const outrasAtivas = outrasComDe.docs.filter((s) => s.id !== t0.childId && s.get('active') !== false).length;

    const novaRef = db.collection('children').doc();
    const resultado = await db.runTransaction(async (tx) => {
      const [snap, criancaSnap, parceiroSnap, familiaSnap] = await Promise.all([
        tx.get(ref),
        tx.get(db.doc(`children/${t0.childId}`)),
        tx.get(db.doc(`users/${t0.paraUid}`)),
        tx.get(db.doc(`users/${uid}`)),
      ]);
      const t = snap.data();
      const antiga = criancaSnap.exists ? { id: criancaSnap.id, ...criancaSnap.data() } : null;
      const v = R.podeAceitarFamilia({
        cobrancaLigada: ligada,
        uid,
        t,
        crianca: antiga,
        parceiro: parceiroSnap.exists ? parceiroSnap.data() : null,
      });
      if (!v.ok) throw new HttpsError('failed-precondition', v.erro);

      const nova = R.criancaNova({
        antiga,
        paraUid: t.paraUid,
        transferenciaId: id,
        schoolId: R.escolaDoParceiro(antiga.school, listaDeEscolas),
      });
      tx.set(novaRef, { ...nova, createdAt: FieldValue.serverTimestamp(), statusUpdatedAt: FieldValue.serverTimestamp() });
      tx.update(criancaSnap.ref, {
        active: false,
        inativadoEm: FieldValue.serverTimestamp(),
        deactivatedAt: FieldValue.serverTimestamp(),
        transferidaPara: { uid: t.paraUid, em: Timestamp.now(), transferenciaId: id },
      });
      const vinculo = R.vinculoDaFamilia({
        familia: familiaSnap.data() || {},
        antigaId: antiga.id,
        novaId: novaRef.id,
        deUid: t.deUid,
        paraUid: t.paraUid,
        outrasAtivasComDe: outrasAtivas,
        emAbertoComDe: emAberto.size,
      });
      tx.set(familiaSnap.ref, { ...vinculo, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(ref, { estado: R.ESTADO.CONCLUIDA, novaCriancaId: novaRef.id, concluidaEm: FieldValue.serverTimestamp() });
      const avisos = R.avisosDaConclusao({ marcaPara: t.marcaPara, nome: antiga.name });
      tx.set(db.collection('notifications').doc(), aviso(t.deUid, avisos.aoTioDeAntes, { transferenciaId: id, childId: antiga.id }));
      tx.set(db.collection('notifications').doc(), aviso(t.paraUid, avisos.aoTioNovo, { transferenciaId: id, childId: novaRef.id }));
      return { novaCriancaId: novaRef.id, antigaId: antiga.id, deUid: t.deUid };
    });

    // Fora da transação, e sem derrubar o aceite: as faltas marcadas para a
    // frente e o "quem busca" da criança antiga não valem para o tio novo, e
    // ficariam acesas na rota do tio de antes.
    try {
      const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
      const [faltas, buscas] = await Promise.all([
        db.collection('absenceDeclarations').where('childId', '==', resultado.antigaId).where('adminUid', '==', resultado.deUid).limit(100).get(),
        db.collection('altPickups').where('adminUid', '==', resultado.deUid).where('childId', '==', resultado.antigaId).limit(100).get(),
      ]);
      const lote = db.batch();
      for (const s of faltas.docs) if (String(s.get('dateKey') || '') >= hoje) lote.delete(s.ref);
      for (const s of buscas.docs) lote.delete(s.ref);
      await lote.commit();
    } catch (err) {
      logger.warn('transferência: faltas/buscas da criança antiga ficaram', { id, erro: err?.message });
    }
    return { ok: true, novaCriancaId: resultado.novaCriancaId };
  });
}

module.exports = {
  makePedirTransferencia,
  makeResponderTransferencia,
  makeCancelarTransferencia,
  makeAceitarTransferencia,
};
