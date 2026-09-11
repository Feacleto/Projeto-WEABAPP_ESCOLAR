const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');

const REGION = 'southamerica-east1';

/**
 * ⚠️ O PRAZO, E DE ONDE ELE VEM.
 *
 * 60 dias, e o número foi decidido pelo dono em 11/09/2026 — não derivado de
 * nada. O argumento: a discussão sobre entrega é sempre sobre esta semana ou
 * o mês passado; ninguém discute março em outubro. Guardar para sempre é
 * arquivo que ninguém lê e todo mundo responde por; apagar no dia seguinte
 * tira a defesa do motorista na única janela em que ela serve.
 *
 * ⚠️ SE MUDAR AQUI, MUDA NA POLÍTICA DE PRIVACIDADE na mesma alteração — a
 * seção de retenção promete exatamente "60 (sessenta) dias", e das duas
 * versões a que vale contra a plataforma é a escrita. Mesmo acordo de
 * `RETENTION_MONTHS` em `billing.js`.
 */
const DIAS_DE_RETENCAO = 60;

/** O Firestore recusa lotes acima de 500. 400 deixa folga. */
const LOTE = 400;

/**
 * APAGA AS VIAGENS ANTIGAS — `children/{id}/rides/{AAAA-MM-DD}`.
 *
 * ── O QUE ESSES DOCUMENTOS GUARDAM
 * Um por criança por dia, com a hora de cada marco (embarcou, chegou na
 * escola, entregue) e a posição dela na fila. **Nenhum dado de localização**:
 * o mapa de `checkpoints` saiu em 11/09/2026.
 *
 * ── POR QUE APAGAR, SE NÃO TEM LOCALIZAÇÃO
 * Porque nada os lê depois do dia. A única tela que abre uma viagem é o
 * painel do responsável, e ela pede **o dia de hoje** (`useRide(child.id,
 * todayKey)`). A página pública de acompanhar também só lê o dia. Um
 * documento por criança por dia letivo, para sempre, é arquivo que cresce
 * sozinho e que ninguém consulta.
 *
 * ⚠️ O QUE SE PERDE, DITO POR INTEIRO: é o único registro que sabe se a
 * criança REALMENTE rodou num dia. O calendário de faltas mostra o que foi
 * AVISADO (`absenceDeclarations`), e ele próprio confessa a diferença na
 * tela: *"só aparece aqui o que foi avisado pelo app"*. Fechar esse buraco —
 * distinguir "avisou que ia faltar" de "não apareceu" — só é possível dentro
 * da janela de retenção.
 *
 * ⚠️ E ELE NÃO TOCA NO CALENDÁRIO. `absenceDeclarations` é outra coleção e
 * não tem prazo nenhum: o histórico de faltas do responsável continua andando
 * meses para trás, intacto.
 *
 * ── POR QUE `collectionGroup`
 * `rides` é subcoleção de cada criança. Varrer criança por criança seria uma
 * consulta por documento, e a conta cresce com o CALENDÁRIO, não com a turma.
 */
function makeApagarViagensAntigas(db) {
  return onSchedule(
    {
      // 4h30 — antes do fechamento do mês (5h) e bem longe das duas rotas do
      // dia. Varredura de escrita não divide a manhã com a operação.
      schedule: '30 4 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
    },
    async () => {
      const limite = new Date();
      limite.setDate(limite.getDate() - DIAS_DE_RETENCAO);
      // O id do documento é a data — comparar STRING 'AAAA-MM-DD' é comparar
      // data, e não precisa de índice nem de campo paralelo. É a mesma
      // propriedade que torna a viagem idempotente.
      const corte = limite.toISOString().slice(0, 10);

      let apagados = 0;
      let lote = db.batch();
      let noLote = 0;

      // `dateKey` é gravado em todo documento por `anotarMarco`, então a
      // consulta é por campo e não por id — `__name__` num collectionGroup
      // compara o caminho inteiro, não o último segmento.
      const antigas = await db
        .collectionGroup('rides')
        .where('dateKey', '<', corte)
        .get();

      for (const doc of antigas.docs) {
        lote.delete(doc.ref);
        noLote += 1;
        apagados += 1;
        if (noLote >= LOTE) {
          await lote.commit();
          lote = db.batch();
          noLote = 0;
        }
      }
      if (noLote > 0) await lote.commit();

      logger.info('[retencao] viagens antigas apagadas', {
        corte,
        apagados,
        diasDeRetencao: DIAS_DE_RETENCAO,
      });
      return null;
    }
  );
}

module.exports = { makeApagarViagensAntigas, DIAS_DE_RETENCAO };
