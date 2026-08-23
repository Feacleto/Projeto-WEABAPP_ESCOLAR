/**
 * Envio de push quando nasce uma notificação.
 *
 * Amarramos no gatilho de criação de `notifications/{id}` em vez de mandar
 * push em cada lugar que cria notificação: assim todo aviso do app ganha
 * push de graça, e não há risco de um caminho novo esquecer de enviar.
 *
 * Tokens inválidos (app desinstalado, token expirado) são removidos do doc
 * do usuário na mesma passada — sem isso a lista cresce pra sempre e o
 * envio fica mais lento a cada mês.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';

// Pra onde o toque na notificação leva, por tipo de aviso.
const URL_BY_TYPE = {
  payment_claimed: '/tio/finance',
  payment_confirmed: '/pai/finance',
  payment_due: '/pai/finance',
  contract_accepted: '/tio',
  absence: '/tio',
  agenda: '/pai',
};

function makeSendPushOnNotification(db) {
  return onDocumentCreated(
    { document: 'notifications/{notifId}', region: REGION },
    async (event) => {
      const notif = event.data?.data();
      if (!notif?.userId || !notif.title) return;

      const userSnap = await db.doc(`users/${notif.userId}`).get();
      if (!userSnap.exists) return;

      const tokens = userSnap.data().fcmTokens;
      if (!Array.isArray(tokens) || tokens.length === 0) return;

      const url = notif.url || URL_BY_TYPE[notif.type] || '/';

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: notif.title,
          body: notif.body || '',
        },
        data: {
          url,
          type: String(notif.type || ''),
          notifId: event.params.notifId,
        },
        webpush: {
          fcmOptions: { link: url },
          notification: { icon: '/icon.png', badge: '/icon.png' },
        },
      });

      // Limpa o que não vale mais.
      const dead = [];
      response.responses.forEach((r, i) => {
        if (r.success) return;
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument') ||
          code.includes('invalid-registration-token')
        ) {
          dead.push(tokens[i]);
        }
      });

      if (dead.length) {
        await userSnap.ref.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead),
        });
      }

      logger.info(
        `Push: ok=${response.successCount} falhou=${response.failureCount} removidos=${dead.length}`
      );
    }
  );
}

module.exports = { makeSendPushOnNotification };
