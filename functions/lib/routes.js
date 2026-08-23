/**
 * Encerramento automático de rota abandonada.
 *
 * O tracking web grava em `liveLocation/current` a cada 30 s enquanto a aba
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
      const ref = db.doc('liveLocation/current');
      const snap = await ref.get();
      if (!snap.exists) return;

      const data = snap.data();
      if (!data.routeActive) return;

      const updatedMs = data.updatedAt?.toMillis?.() || 0;
      const age = Date.now() - updatedMs;
      if (age < ABANDON_MS) return;

      // merge preserva lat/lng — a "última posição conhecida" continua
      // disponível, só deixa de ser apresentada como posição atual.
      await ref.set(
        {
          routeActive: false,
          closedBy: 'auto-timeout',
          closedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info(
        `Rota encerrada por inatividade: ${Math.round(age / 60000)} min sem posição.`
      );
    }
  );
}

module.exports = { makeCloseStaleRoutes };
