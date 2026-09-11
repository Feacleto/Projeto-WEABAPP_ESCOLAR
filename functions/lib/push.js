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
const LIMITES = require('./limites');
const admin = require('firebase-admin');
const { tocaNoAparelho } = require('./avisos');

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
  /* ⚠️ OS CINCO NOMES REAIS, e não `payment_due`.
   *
   * Havia `payment_due` aqui, e tipo nenhum se chama assim: os lembretes são
   * `payment_due_5d`, `_3d`, `_0d`, `payment_overdue_3d` e `_7d`. Nenhum
   * casava, então o push deles nasceria caindo em '/' em vez do financeiro
   * dela — uma armadilha armada esperando o dia em que eles virassem
   * documento. Esse dia é hoje. */
  payment_due_5d: '/pai/finance',
  payment_due_3d: '/pai/finance',
  payment_due_0d: '/pai/finance',
  payment_overdue_3d: '/pai/finance',
  payment_overdue_7d: '/pai/finance',

  // A oferta da primeira rota — o toque que leva ao plano dele.
  oferta_primeira_rota: '/tio/planos',

  // Os avisos de gesto.
  rota_iniciada: '/pai',
  proxima_parada: '/pai',
  nao_embarcou: '/pai',
  rota_atrasada: '/pai',
  contrato_pronto: '/pai/contrato',
  indicacao_ativou: '/tio/indicar',
  indicacao_cadastrou: '/tio/indicar',
  // ⚠️ SEM DESTINO FIXO: quem abre chamado pode ser o motorista OU o
  // responsável, e o mapa é por TIPO, não por pessoa. Mandar os dois pra
  // `/tio` jogaria a mãe numa tela que ela não pode ver. Sem entrada aqui, o
  // padrão é '/', que o `painelDe` resolve pro painel de cada um.
  //   chamado_respondido — de propósito ausente

  // Os avisos de tempo do motorista.
  convite_parado: '/tio/children',
  fatura_vence: '/tio/taxa',
  alvara_vence: '/tio/selo',
  contract_accepted: '/tio',

  // O toque cai no Início dela, que é onde `HorarioDoDia` mostra a hora.
  // Sem esta linha o padrão é '/', que resolve pra `/pai` pelo `painelDe` —
  // funciona, mas passa pelo roteador antes de chegar onde ela quer olhar.
  schedule_changed: '/pai',

  absence_declared: '/tio',
  absence_confirm: '/pai',
  alt_pickup: '/tio',
  school_no_class: '/pai',

  agenda_entry: '/pai',
  agenda_school_entry: '/pai',
  agenda_broadcast: '/pai',

  child_arrived_school: '/pai',
  child_arrived_home: '/pai',

  // ⚠️ OS AVISOS COMERCIAIS PRECISAM DE ROTA, senão o push abre o app na tela
  // inicial e a pessoa que tocou nele por causa de um desconto não encontra o
  // desconto. Todos levam a `/tio/planos`, que é onde a decisão acontece —
  // inclusive o de conta pausada, porque o caminho de voltar é contratar.
  comercial_teste_comecou: '/tio/planos',
  comercial_degrau_vira: '/tio/planos',
  comercial_retorno: '/tio/planos',
  comercial_indicacao: '/tio/indicar',
};

function makeSendPushOnNotification(db) {
  return onDocumentCreated(
    {
      document: 'notifications/{notifId}',
      region: REGION,
      maxInstances: LIMITES.GATILHO,
    },
    async (event) => {
      const notif = event.data?.data();
      if (!notif?.userId || !notif.title) return;

      const userSnap = await db.doc(`users/${notif.userId}`).get();
      if (!userSnap.exists) return;

      // ⚠️ O ÚNICO GUARDA DE PREFERÊNCIA DO PROJETO MORA AQUI, e é de
      // propósito: este gatilho é o ponto por onde TODO aviso passa antes de
      // chegar num aparelho. Espalhar a checagem pelos dez remetentes faria
      // o próximo remetente nascer sem ela — e o sintoma seria a pessoa
      // desligar uma categoria e continuar recebendo, que é pior que não ter
      // preferência nenhuma.
      //
      // ⚠️ SILENCIA O TOQUE, NÃO O REGISTRO. O documento em `notifications`
      // já foi escrito quando este gatilho roda, e continua no sino. Quem
      // pediu silêncio não pediu amnésia — e ela precisa poder conferir
      // depois o que foi dito sobre o dinheiro dela.
      if (!tocaNoAparelho(notif.type, userSnap.data().avisosDesligados)) {
        logger.info('[push] calado por preferência', {
          tipo: notif.type,
          notifId: event.params.notifId,
        });
        return;
      }

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
