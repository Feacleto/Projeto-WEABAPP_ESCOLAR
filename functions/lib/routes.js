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
const LIMITES = require('./limites');
// `FieldValue` pelo caminho modular (03/10/2026): `admin.firestore.FieldValue`
// chegava `undefined` no emulador — derrubou o `redeemInvite` no teste R1.
const { FieldValue } = require('firebase-admin/firestore');

const REGION = 'southamerica-east1';

// ⚠️ 90 MINUTOS, E ERAM 20 (03/10/2026, o dono achou pouco — e era). Vinte
// minutos parado no portão da escola com a tela apagada já bastavam para
// encerrar a rota no meio do caminho: o celular não gravava nada com a perua
// parada nem com a tela desligada. Hoje ele grava a cada minuto enquanto o app
// está aberto (o PULSO e a TELA ACESA de `locationService`), e o que sobra é o
// motorista que saiu do app por um tempo. Enquanto isso a família já vê "sem
// sinal" (`routePresence`) — fechar cedo trocaria um aviso honesto por uma
// rota encerrada que não encerrou.
const ABANDON_MS = 90 * 60 * 1000;

function makeCloseStaleRoutes(db) {
  return onSchedule(
    {
      schedule: 'every 15 minutes',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
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

        await docSnap.ref.set(
          {
            routeActive: false,
            // A ÚLTIMA POSIÇÃO SAI JUNTO, como no "Encerrar" do motorista
            // (`stopTracking`): o ponto onde ele parou não fica legível pelas
            // famílias a noite inteira. Antes o merge a preservava.
            lat: FieldValue.delete(),
            lng: FieldValue.delete(),
            accuracy: FieldValue.delete(),
            closedBy: 'auto-timeout',
            closedAt: FieldValue.serverTimestamp(),
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
