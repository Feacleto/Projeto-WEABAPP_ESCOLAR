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

/**
 * Pra onde o toque na notificação leva, por tipo de aviso.
 *
 * ESTE MAPA ESTAVA DESATUALIZADO E FALHAVA CALADO.
 * As chaves `absence` e `agenda` não existem: os tipos gravados são
 * `absence_declared`, `agenda_entry`, `agenda_school_entry`. Chave que não bate
 * cai no `|| '/'` e o push abre a raiz do app — a pessoa toca no aviso "novo
 * recado sobre a Ana" e chega numa tela genérica, sem nada indicando que
 * errou. Aviso que não leva a lugar nenhum ensina a não tocar em aviso.
 *
 * Espelha o `onClickNotif` de `NotificationsBody`: os dois respondem a mesma
 * pergunta, um pra quem toca no push e outro pra quem toca na lista.
 */
const URL_BY_TYPE = {
  payment_claimed: '/tio/finance',
  payment_confirmed: '/pai/finance',
  payment_due: '/pai/finance',
  contract_accepted: '/tio',

  absence_declared: '/tio',
  absence_confirm: '/pai',
  alt_pickup: '/tio',
  school_no_class: '/pai',

  agenda_entry: '/pai',
  agenda_school_entry: '/pai',
  agenda_broadcast: '/pai',

  child_arrived_school: '/pai',
  child_arrived_home: '/pai',
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
          // badge é tingido pelo alfa pelo Android — tem que ser a silhueta
          // monocromática, não o ícone colorido.
          notification: {
            icon: '/brand/icon-192.png',
            badge: '/brand/notification-badge-96.png',
          },
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
