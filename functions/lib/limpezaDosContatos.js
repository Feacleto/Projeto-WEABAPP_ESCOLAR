const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { deveSair } = require('./reguaDosContatos');
const { LOTE_DA_LIMPEZA, ORCAMENTO_DA_LIMPEZA_MS } = require('./reguaDosAvisosAntigos');

const REGION = 'southamerica-east1';

/**
 * APAGA OS CONTATOS DO DONO CUJA CONTA ACABOU HÁ MAIS DE 5 ANOS.
 * A decisão é da régua (`reguaDosContatos.js`); aqui só se varre.
 *
 * Paginado por `em` (campo único, índice automático): a coleção não tem
 * `where` de corte porque o corte depende do usuário, não do contato. Cada
 * página lê os documentos de `users` dos motoristas que aparecem nela.
 */
async function apagarContatosAntigos(db, agora = new Date()) {
  const inicio = Date.now();
  let apagados = 0;
  let lidos = 0;
  let sobrou = false;
  let cursor = null;

  for (;;) {
    let q = db.collection('contatosDoDono').orderBy('em').limit(LOTE_DA_LIMPEZA);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    lidos += snap.size;
    cursor = snap.docs[snap.docs.length - 1];

    const uids = [...new Set(snap.docs.map((d) => d.get('motoristaUid')).filter(Boolean))];
    const docs = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
    const motoristas = new Map(docs.map((u) => [u.id, u.exists ? u.data() : null]));

    const lote = db.batch();
    let n = 0;
    snap.docs.forEach((d) => {
      const uid = d.get('motoristaUid');
      if (!uid) return;
      if (deveSair({ contato: d.data(), motorista: motoristas.get(uid) ?? null, agora })) {
        lote.delete(d.ref);
        n += 1;
      }
    });
    if (n) await lote.commit();
    apagados += n;

    if (snap.size < LOTE_DA_LIMPEZA) break;
    if (Date.now() - inicio > ORCAMENTO_DA_LIMPEZA_MS) {
      sobrou = true;
      break;
    }
  }
  return { lidos, apagados, sobrou };
}

function makeLimparContatosAntigos(db) {
  return onSchedule(
    {
      // 4h15 — entre os avisos (4h) e as viagens (4h30).
      schedule: '15 4 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const r = await apagarContatosAntigos(db);
      logger.info('[retencao] contatos do dono apagados', r);
      if (r.sobrou) logger.warn('[retencao] o orçamento de tempo acabou; o resto sai amanhã', r);
      return null;
    }
  );
}

module.exports = { makeLimparContatosAntigos, apagarContatosAntigos };
