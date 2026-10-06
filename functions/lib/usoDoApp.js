const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const R = require('./reguaDoUso');

const REGION = 'southamerica-east1';
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * O USO DO APP — `usoDoApp/{AAAA-MM-DD}` (05/10/2026, painel do dono).
 *
 * ── O QUE ELA LÊ E O QUE GRAVA
 * Para cada recurso da lista fechada de `reguaDoUso.js`, lê com o Admin SDK o
 * que o app JÁ gravou nos últimos 30 dias (só os campos de que a conta precisa,
 * `select`), conta os motoristas distintos e as vezes, e grava UM documento só
 * de números. Os uids existem apenas dentro de um Set em memória, durante a
 * conta: nenhum array de uid, nem temporário, chega ao documento.
 *
 * ── ⚠️ SEM ÍNDICE NOVO
 * Cada leitura filtra por UM campo (a data) — índice simples automático; o que
 * é filtro de status ou categoria acontece em memória, na régua. `rides` é
 * collection group por `dateKey`, que já tem o `fieldOverride` da retenção das
 * viagens. `expenses` é lida uma vez e serve a "despesas" e a "abastecer".
 *
 * ── ⚠️ O ID É O DIA DE BRASÍLIA, e rodar de novo no mesmo dia sobrescreve.
 * As rules: só o dono lê, ninguém escreve pelo cliente.
 */
async function lerRecurso(db, recurso, agora) {
  const campos = [
    recurso.campoUid,
    recurso.campoData,
    recurso.filtro?.campo,
    // `abastecer` filtra por categoria em memória; a leitura é a das despesas.
    recurso.colecao === 'expenses' ? 'category' : null,
  ].filter(Boolean);
  let q = recurso.grupo ? db.collectionGroup(recurso.colecao) : db.collection(recurso.colecao);
  if (recurso.campoData) {
    const inicio =
      recurso.tipoData === 'dia'
        ? R.inicioDaJanela(agora)
        : new Date(agora.getTime() - R.DIAS_DO_USO * DIA_MS);
    q = q.where(recurso.campoData, '>=', inicio);
  } else if (recurso.filtro) {
    q = q.where(recurso.filtro.campo, '==', recurso.filtro.valor);
  }
  const snap = await q.select(...campos).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function medirUso(db, agora = new Date()) {
  const motoristas = (
    await db.collection('users').where('role', '==', 'admin').select('ultimaRota', 'role').get()
  ).docs.map((d) => ({ id: d.id, ...d.data() }));
  const base = R.baseDoUso(motoristas, agora);

  const leituras = new Map();
  const contagens = {};
  for (const recurso of R.RECURSOS) {
    try {
      let docs;
      if (recurso.id === 'rotas') {
        docs = motoristas;
      } else {
        const chave = `${recurso.colecao}|${recurso.campoData}`;
        if (!leituras.has(chave)) leituras.set(chave, lerRecurso(db, recurso, agora));
        docs = await leituras.get(chave);
      }
      contagens[recurso.id] = R.contarRecurso(recurso, docs, agora);
    } catch (err) {
      // Um recurso que falha não derruba os outros: fica zerado e vai ao log.
      logger.error('[uso] um recurso falhou', { recurso: recurso.id, err: err?.message });
      contagens[recurso.id] = { motoristas: 0, vezes: recurso.contaVezes ? 0 : null };
    }
  }

  const doc = R.usoDoDia(contagens, base, agora);
  await db
    .collection('usoDoApp')
    .doc(R.chaveDoDia(agora))
    .set({ ...doc, gravadaEm: agora });
  return doc;
}

function makeContarUsoDoApp(db) {
  return onSchedule(
    {
      // 23h55 — depois da foto da base (23h50), com o dia de rota fechado.
      schedule: '55 23 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const doc = await medirUso(db);
      logger.info('[uso] uso do app contado', { dia: doc.dia, base: doc.baseMotoristas });
      return null;
    }
  );
}

module.exports = { makeContarUsoDoApp, medirUso };
