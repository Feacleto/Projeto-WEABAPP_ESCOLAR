/**
 * Encerramento automático de rota abandonada.
 *
 * O tracking web grava em `liveLocation/{uid}` a cada 30 s enquanto a aba
 * está visível. Se o motorista fecha a aba sem tocar em "Encerrar rota",
 * `routeActive` fica `true` indefinidamente — e o painel do pai passa a
 * mostrar uma perua parada no mapa como se aquilo fosse a posição atual.
 *
 * O cliente não pode resolver isso sozinho: `beforeunload` não é confiável
 * em mobile (o sistema mata a aba sem avisar). Então quem fecha é o servidor.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';

// 20 minutos = ~40 gravações perdidas. Folgado o suficiente pra não encerrar
// rota de quem passou por um túnel ou ficou sem sinal num vale.
const ABANDON_MS = 20 * 60 * 1000;

function makeCloseStaleRoutes(db) {
  return onSchedule(
    {
      schedule: 'every 15 minutes',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
    },
    async () => {
      // UM DOCUMENTO POR MOTORISTA, não mais `liveLocation/current`.
      //
      // Com o doc único, esta função encerrava a rota dos DOIS motoristas
      // quando qualquer um deles ficasse 20 minutos sem sinal — e o que
      // seguia rodando sumia do mapa dos pais dele no meio do trajeto.
      //
      // A varredura filtra `routeActive` no servidor pra não baixar o
      // histórico de quem não está em rota: fora do horário escolar isso é
      // quase a coleção inteira, quatro vezes por hora, todo dia.
      const ativos = await db
        .collection('liveLocation')
        .where('routeActive', '==', true)
        .get();
      if (ativos.empty) return;

      const agora = Date.now();
      let encerradas = 0;

      for (const docSnap of ativos.docs) {
        const data = docSnap.data();
        const updatedMs = data.updatedAt?.toMillis?.() || 0;
        const age = agora - updatedMs;
        if (age < ABANDON_MS) continue;

        // merge preserva lat/lng — a "última posição conhecida" continua
        // disponível, só deixa de ser apresentada como posição atual.
        await docSnap.ref.set(
          {
            routeActive: false,
            closedBy: 'auto-timeout',
            closedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        encerradas += 1;
        logger.info(
          `Rota encerrada por inatividade: motorista=${docSnap.id}, ${Math.round(age / 60000)} min sem posição.`
        );
      }

      if (encerradas === 0) return;
      logger.info(`closeStaleRoutes: ${encerradas} rota(s) encerrada(s).`);
    }
  );
}

module.exports = { makeCloseStaleRoutes };
