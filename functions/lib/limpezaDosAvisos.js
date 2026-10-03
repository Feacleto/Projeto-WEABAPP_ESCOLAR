const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const {
  DIAS_DE_RETENCAO_DOS_AVISOS,
  LOTE_DA_LIMPEZA,
  ORCAMENTO_DA_LIMPEZA_MS,
  corteDosAvisos,
} = require('./reguaDosAvisosAntigos');

const REGION = 'southamerica-east1';

/**
 * APAGA OS AVISOS COM MAIS DE 90 DIAS — `notifications/{id}` (03/10/2026).
 *
 * O prazo e o corte são da régua (`reguaDosAvisosAntigos.js`), que é pura e
 * testada em `npm run testar:notificacoes`; este arquivo só varre.
 *
 * ── POR QUE PAGINADO, E NÃO UM `get()` SÓ
 * A primeira execução encontra todo o acúmulo desde o início da plataforma.
 * Baixar tudo de uma vez é memória que cresce com a idade do projeto; aqui
 * cada volta lê no máximo `LOTE_DA_LIMPEZA` documentos, apaga e pergunta de
 * novo. Como o que foi apagado não volta na consulta, não há cursor a
 * guardar — e rodar duas vezes no mesmo dia é inofensivo.
 *
 * ── O ÍNDICE
 * `where('createdAt', '<', …)` com `orderBy('createdAt')` é campo único:
 * o índice automático do Firestore atende, sem composto novo.
 *
 * ⚠️ Aviso sem `createdAt` (nenhum gravador do projeto faz isso) não casa com
 * a consulta e nunca é apagado. É o erro do lado seguro.
 */
async function apagarAvisosAntigos(db, agora = new Date()) {
  const corte = corteDosAvisos(agora);
  const inicio = Date.now();
  let apagados = 0;
  let sobrou = false;

  for (;;) {
    const snap = await db
      .collection('notifications')
      .where('createdAt', '<', corte)
      .orderBy('createdAt')
      .limit(LOTE_DA_LIMPEZA)
      .get();
    if (snap.empty) break;

    const lote = db.batch();
    snap.docs.forEach((d) => lote.delete(d.ref));
    await lote.commit();
    apagados += snap.size;

    if (snap.size < LOTE_DA_LIMPEZA) break;
    if (Date.now() - inicio > ORCAMENTO_DA_LIMPEZA_MS) {
      sobrou = true;
      break;
    }
  }

  return { corte: corte.toISOString(), apagados, sobrou };
}

function makeLimparAvisosAntigos(db) {
  return onSchedule(
    {
      // 4h — antes das viagens (4h30) e do fechamento (5h), longe das rotas.
      // Varredura de escrita não divide a manhã com a operação.
      schedule: '0 4 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      // Uma execução por vez: duas varreduras paralelas brigariam pelos
      // mesmos documentos e uma veria o lote da outra sumir no meio.
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const resultado = await apagarAvisosAntigos(db);
      logger.info('[retencao] avisos antigos apagados', {
        ...resultado,
        diasDeRetencao: DIAS_DE_RETENCAO_DOS_AVISOS,
      });
      if (resultado.sobrou) {
        logger.warn('[retencao] o orçamento de tempo acabou; o resto sai amanhã', resultado);
      }
      return null;
    }
  );
}

module.exports = { makeLimparAvisosAntigos, apagarAvisosAntigos };
