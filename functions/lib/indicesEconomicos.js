const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const {
  URL_DO_IPCA_12M,
  lerSerieDoIpca,
  indiceMudou,
  SERIES_DO_BC,
  diaEmBrasilia,
  urlDaSerieDoBc,
  lerSerieDoBc,
  serieMudou,
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

  const novo = lerSerieDoIpca(json);
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
    // O mesmo mês um ano antes (05/10/2026): a seta "Subiu/Desceu em 12
    // meses" da Economia do mês. `null` quando o IBGE não o devolveu.
    mesAntes: novo.mesAntes,
    ipca12mAntes: novo.ipca12mAntes,
    fonte: 'IBGE',
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  return { gravou: true, ...novo };
}

/**
 * SELIC META E DÓLAR PTAX — `indicesEconomicos/selic` e `/dolar`
 * (05/10/2026, tela "Economia do mês" do motorista). Mesmo desenho do IPCA:
 * busca uma vez por dia, só grava se mudou, e falha não apaga nada. A régua
 * (formato do SGS, datas no futuro da Selic, dia útil do dólar) está em
 * `reguaDosIndices.js`.
 *
 * As duas séries são independentes: o Banco Central fora para uma não pode
 * calar a outra nem o IPCA — por isso cada uma tem o seu `try`, e quem chama
 * roda as três em sequência sem parar na primeira falha.
 */
async function atualizarSerieDoBc(db, chave, { buscar = fetch, agora = new Date() } = {}) {
  const serie = SERIES_DO_BC[chave];
  const hoje = diaEmBrasilia(agora);
  const url = urlDaSerieDoBc(serie.codigo, hoje);
  let json;
  try {
    const res = await buscar(url, { signal: AbortSignal.timeout(PRAZO_DA_API_MS) });
    if (!res.ok) {
      // 404 é "nenhum ponto no período" — a janela é de 400 dias, então na
      // prática é a API mudando, não o feriado.
      logger.error('[indices] o Banco Central respondeu com erro', { chave, status: res.status });
      return { gravou: false, motivo: 'http' };
    }
    json = await res.json();
  } catch (err) {
    logger.error('[indices] a chamada ao Banco Central falhou', { chave, erro: String(err?.message || err) });
    return { gravou: false, motivo: 'rede' };
  }

  const novo = lerSerieDoBc(json, { ...serie, hoje });
  if (!novo) {
    logger.error('[indices] a resposta do Banco Central não está no formato esperado', {
      chave,
      amostra: JSON.stringify(json).slice(0, 500),
    });
    return { gravou: false, motivo: 'formato' };
  }

  const ref = db.collection('indicesEconomicos').doc(chave);
  const atual = await ref.get();
  // A Selic é preenchida todo dia com o mesmo número: comparar a data
  // regravaria o documento diariamente sem nada novo para a tela.
  const comData = chave !== 'selic';
  if (!serieMudou(atual.exists ? atual.data() : null, novo, { comData })) {
    return { gravou: false, motivo: 'igual', ...novo };
  }

  await ref.set({
    ...novo,
    serie: serie.codigo,
    fonte: 'Banco Central',
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
      // Uma falha de banco numa série não pode calar as outras.
      const tarefas = [
        ['ipca', () => atualizarIpca(db)],
        ...Object.keys(SERIES_DO_BC).map((chave) => [chave, () => atualizarSerieDoBc(db, chave)]),
      ];
      for (const [chave, tarefa] of tarefas) {
        try {
          logger.info(`[indices] ${chave} conferido`, await tarefa());
        } catch (err) {
          logger.error(`[indices] ${chave} falhou`, { erro: String(err?.message || err) });
        }
      }
      return null;
    }
  );
}

module.exports = { makeAtualizarIndicesEconomicos, atualizarIpca, atualizarSerieDoBc };
