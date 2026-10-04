const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const {
  URL_DO_IPCA_12M,
  lerIpcaDoSidra,
  indiceMudou,
} = require('./reguaDosIndices');

const REGION = 'southamerica-east1';

/** O SIDRA às vezes demora; preso aqui, a agendada morreria no teto dela. */
const PRAZO_DA_API_MS = 20000;

/**
 * O IPCA DOS ÚLTIMOS 12 MESES — `indicesEconomicos/ipca` (03/10/2026).
 *
 * Referência para o "Preciso aumentar?" do Financeiro: o motorista vê a
 * inflação oficial ao lado do custo dele. O app INFORMA — nunca sugere
 * quanto reajustar.
 *
 * ── POR QUE NO SERVIDOR, E NÃO NO CELULAR
 * O celular de cada motorista chamando o IBGE seria uma chamada por
 * abertura de tela contra uma API pública que não é nossa, e o número é o
 * mesmo para todo mundo. Uma agendada busca uma vez por dia e grava num
 * documento que todos leem.
 *
 * ── SÓ GRAVA SE MUDOU
 * O IBGE publica uma vez por mês. A comparação é da régua (`indiceMudou`).
 *
 * ── FALHA NÃO APAGA NADA
 * API fora, resposta em outro formato, número absurdo: `logger.error` e o
 * documento fica com o último valor bom (que carrega o próprio `mes`, então
 * a tela nunca apresenta um número velho como se fosse de agora). Não
 * relança: o retry do Scheduler bateria de novo na mesma API quebrada, e
 * amanhã há outra execução.
 */
async function atualizarIpca(db, { buscar = fetch } = {}) {
  let json;
  try {
    const res = await buscar(URL_DO_IPCA_12M, {
      signal: AbortSignal.timeout(PRAZO_DA_API_MS),
    });
    if (!res.ok) {
      logger.error('[indices] o SIDRA respondeu com erro', { status: res.status });
      return { gravou: false, motivo: 'http' };
    }
    json = await res.json();
  } catch (err) {
    logger.error('[indices] a chamada ao SIDRA falhou', { erro: String(err?.message || err) });
    return { gravou: false, motivo: 'rede' };
  }

  const novo = lerIpcaDoSidra(json);
  if (!novo) {
    logger.error('[indices] a resposta do SIDRA não está no formato esperado', {
      amostra: JSON.stringify(json).slice(0, 500),
    });
    return { gravou: false, motivo: 'formato' };
  }

  const ref = db.collection('indicesEconomicos').doc('ipca');
  const atual = await ref.get();
  if (!indiceMudou(atual.exists ? atual.data() : null, novo)) {
    return { gravou: false, motivo: 'igual', ...novo };
  }

  await ref.set({
    mes: novo.mes,
    ipca12m: novo.ipca12m,
    fonte: 'IBGE',
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return { gravou: true, ...novo };
}

function makeAtualizarIndicesEconomicos(db) {
  return onSchedule(
    {
      // 6h — depois das varreduras da madrugada, antes das rotas da manhã.
      schedule: '0 6 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      concurrency: LIMITES.CONCORRENCIA_AGENDADO,
      maxInstances: LIMITES.AGENDADO,
    },
    async () => {
      const resultado = await atualizarIpca(db);
      logger.info('[indices] IPCA conferido', resultado);
      return null;
    }
  );
}

module.exports = { makeAtualizarIndicesEconomicos, atualizarIpca };
