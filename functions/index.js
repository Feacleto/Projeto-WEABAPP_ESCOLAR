/**
 * Cloud Functions — envio de lembrete de mensalidade por email.
 *
 * Fluxo:
 *   1. Função agendada roda diariamente (9h da manhã, horário BR).
 *   2. Busca payments com status != 'paid'.
 *   3. Pra cada um, calcula a distância em dias até dueDate e define
 *      qual "milestone" se aplica (reminder_3d, due_today, overdue_3d).
 *   4. Verifica se já enviou esse milestone (campo emailSentMilestones).
 *      Idempotente — não dispara duas vezes.
 *   5. Monta o email com template HTML e envia via Resend.
 *   6. Marca o milestone como enviado no doc do payment.
 *
 * Configuração necessária (1x):
 *   firebase functions:secrets:set RESEND_API_KEY
 *   firebase deploy --only functions
 *
 * Trigger manual pra testar:
 *   firebase functions:shell  (depois) sendPaymentReminders()
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { exigirMotorista } = require('./lib/papeis');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./lib/limites');
const admin = require('firebase-admin');

const { buildEmailHtml, buildEmailText, subjectFor } = require('./lib/emailTemplate');
const { sendEmail } = require('./lib/resend');
const {
  makeLookupInvite,
  makeRedeemInvite,
  makeJoinDriverWaitlist,
  makeGetShowcase,
} = require('./lib/invites');
const { makeCloseStaleRoutes } = require('./lib/routes');
const { makeSendPushOnNotification } = require('./lib/push');
const { makeConfirmarAusencias } = require('./lib/confirmarAusencias');
const {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
} = require('./lib/billing');
const { makeGetInvitePreview } = require('./lib/invitePreview');
const { makeSpinEntryBonus } = require('./lib/entryBonus');
const { makeFlagDuplicateReceipts } = require('./lib/receiptGuard');
const {
  makeBackfillTestimonialPrivacy,
} = require('./lib/privacyBackfill');

admin.initializeApp();
const db = admin.firestore();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Configuração — ajustar se trocar de domínio.
//
// FROM_EMAIL: enquanto não há domínio próprio configurado no Resend,
//   usa o sandbox `onboarding@resend.dev`. Quando configurar domínio
//   (ex: alobuzinou.com.br), trocar pra `cobranca@alobuzinou.com.br`.
//
// APP_URL: URL de produção da hospedagem (Firebase Hosting).
//   Trocar pelo domínio próprio quando configurar.
const FROM_EMAIL = 'Alô Buzinou! <onboarding@resend.dev>';
const APP_URL = 'https://projeto-tio-nino-digital.web.app';

// Milestones de cobrança (dias em relação ao vencimento).
//   diffDays positivo = ainda falta vencer
//   diffDays zero     = vence hoje
//   diffDays negativo = já venceu
const MILESTONES = [
  { key: 'reminder_3d', diffDays: 3 },
  { key: 'due_today', diffDays: 0 },
  { key: 'overdue_3d', diffDays: -3 },
];

// ===== Helpers =====

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffInDays(due, today) {
  const a = startOfDay(due);
  const b = startOfDay(today);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function formatMonthLabel(date) {
  if (!date) return '';
  const MONTHS = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

// ATENÇÃO: as chaves aqui têm que casar com userService.PIX_KEY_TYPES no
// cliente. Antes esta tabela usava 'aleatoria' enquanto o app grava
// 'random', e o email de cobrança saía com o rótulo do tipo em branco.
const PIX_TYPE_LABELS = {
  phone: 'Celular',
  email: 'Email',
  random: 'Chave aleatória',
  // Aceitos por compatibilidade caso o cadastro venha de outra origem.
  cpf: 'CPF',
  cnpj: 'CNPJ',
};

// ===== Lógica principal =====

/**
 * Processa todos os pagamentos pendentes/claimed e envia emails dos
 * milestones aplicáveis. Retorna sumário com contagens.
 */
/**
 * `adminUid` OPCIONAL — mesma divisão de `generateForMonth`:
 * ausente é o modo da AGENDADA (a plataforma inteira, que é o certo pra ela);
 * presente é o disparo MANUAL, limitado à base de quem disparou.
 *
 * Sem isso, o botão de um parceiro mandava e-mail de cobrança para as famílias
 * de todos os outros — e o gate da callable era `role === 'admin'`, que neste
 * projeto significa qualquer motorista.
 */
async function processReminders(apiKey, now = new Date(), adminUid = null) {
  const today = startOfDay(now);

  let consulta = db
    .collection('payments')
    .where('status', 'in', ['pending', 'claimed']);
  if (adminUid) consulta = consulta.where('adminUid', '==', adminUid);
  const paymentsSnap = await consulta.get();

  let evaluated = 0;
  let sent = 0;
  let skipped = 0;
  const errors = [];

  // Cache simples de parents/children/admin pra evitar N reads quando
  // tem várias mensalidades do mesmo pai/criança/admin.
  //
  // `adminCache` É UM MAPA, E NÃO UM SÓ — o motivo vale dinheiro.
  // Ele era `let adminCache = null`, preenchido UMA vez a partir de
  // `appState/init.adminUid` e reusado no laço inteiro. Ou seja: a chave PIX
  // de UM motorista ia no e-mail de cobrança de TODOS os pagamentos da
  // plataforma. Com dois parceiros, o responsável do B recebia a chave do A e
  // pagava nela — o dinheiro ia pra conta errada e nada no sistema saberia.
  //
  // É o mesmo bug que o cliente já tinha consertado e documentado em
  // src/services/userService.js:76-86; a cópia do servidor ficou pra trás.
  const parentCache = new Map();
  const childCache = new Map();
  const adminCache = new Map();

  for (const paymentDoc of paymentsSnap.docs) {
    evaluated += 1;
    try {
      const p = paymentDoc.data();
      const dueDate =
        p.dueDate?.toDate?.() ||
        (p.dueDate ? new Date(p.dueDate) : null);
      if (!dueDate) {
        skipped += 1;
        continue;
      }
      const diff = diffInDays(dueDate, today);
      const milestone = MILESTONES.find((m) => m.diffDays === diff);
      if (!milestone) {
        skipped += 1;
        continue;
      }

      const sentMap = p.emailSentMilestones || {};
      if (sentMap[milestone.key]) {
        skipped += 1;
        continue;
      }

      // Carrega dados do pai (email) — cacheia
      const parentUid = p.parentUid;
      if (!parentUid) {
        skipped += 1;
        continue;
      }
      let parent = parentCache.get(parentUid);
      if (!parent) {
        const ps = await db.doc(`users/${parentUid}`).get();
        if (!ps.exists) {
          skipped += 1;
          continue;
        }
        parent = ps.data();
        parentCache.set(parentUid, parent);
      }
      if (!parent.email) {
        skipped += 1;
        continue;
      }

      // Carrega dados da criança — cacheia
      const childId = p.childId;
      let child = childId ? childCache.get(childId) : null;
      if (!child && childId) {
        const cs = await db.doc(`children/${childId}`).get();
        if (cs.exists) {
          child = cs.data();
          childCache.set(childId, child);
        }
      }

      // Carrega o motorista DESTE pagamento — cacheia por uid.
      //
      // `p.adminUid` é a verdade: billing.js:99 grava e se RECUSA a gerar
      // mensalidade sem ele (:91). `child.adminUid` cobre pagamento antigo,
      // e a criança já foi carregada logo acima. Os dois são por inquilino;
      // `appState/init` saiu daqui e não volta.
      const adminUid = p.adminUid || child?.adminUid || null;
      let admin = adminUid ? adminCache.get(adminUid) : null;
      if (!admin && adminUid) {
        const as = await db.doc(`users/${adminUid}`).get();
        admin = as.exists ? as.data() : {};
        adminCache.set(adminUid, admin);
      }
      admin = admin || {};

      // Monta payload do template
      const monthLabel = p.monthLabel || formatMonthLabel(dueDate);
      // SEM MOTORISTA RESOLVIDO, SEM CHAVE — e é a falha para o lado certo.
      // O e-mail sai sem o PIX (o template já trata `pixKey: null`) e o
      // responsável cobra o motorista pelo caminho de sempre. Mandar a chave
      // de outra pessoa seria pior que não mandar chave nenhuma.
      const pixKey = admin.pixKey || null;
      const pixKeyType = pixKey ? PIX_TYPE_LABELS[admin.pixKeyType] || '' : '';
      const adminName = admin.name || '';
      const companyName = admin.companyName || 'Alô Buzinou!';

      const html = buildEmailHtml({
        milestone: milestone.key,
        parentName: parent.name || '',
        childName: child?.name || p.childName || 'sua criança',
        amount: p.amount,
        dueDate,
        monthLabel,
        appUrl: APP_URL,
        pixKey,
        pixKeyType,
        adminName,
        companyName,
      });
      const text = buildEmailText({
        milestone: milestone.key,
        parentName: parent.name || '',
        childName: child?.name || p.childName || 'sua criança',
        amount: p.amount,
        dueDate,
        monthLabel,
        appUrl: APP_URL,
        pixKey,
        adminName,
      });
      const subject = subjectFor(
        milestone.key,
        child?.name || p.childName,
        monthLabel
      );

      await sendEmail({
        apiKey,
        from: FROM_EMAIL,
        to: parent.email,
        subject,
        html,
        text,
      });

      // Marca como enviado pra não duplicar (idempotência).
      // Usa merge pra preservar outros milestones já enviados.
      await paymentDoc.ref.set(
        {
          emailSentMilestones: {
            [milestone.key]: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      sent += 1;
      logger.info(
        `Email enviado: payment=${paymentDoc.id} milestone=${milestone.key} to=${parent.email}`
      );
    } catch (err) {
      errors.push({ paymentId: paymentDoc.id, error: err?.message || String(err) });
      logger.error(`Falha ao processar payment ${paymentDoc.id}:`, err);
    }
  }

  return { evaluated, sent, skipped, errors };
}

// ===== Cloud Function agendada =====

exports.sendPaymentReminders = onSchedule(
  {
    schedule: '0 9 * * *', // todo dia às 9h
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [RESEND_API_KEY],
    retryCount: 2,
    maxInstances: LIMITES.AGENDADO,
  },
  async () => {
    const apiKey = RESEND_API_KEY.value();
    const result = await processReminders(apiKey);
    logger.info('sendPaymentReminders concluído', result);
  }
);

// ===== Trigger manual (admin-only) pra testar/forçar envio =====

exports.runPaymentRemindersNow = onCall(
  {
    region: 'southamerica-east1',
    secrets: [RESEND_API_KEY],
    maxInstances: LIMITES.AUTENTICADO,
  },
  async (request) => {
    // O ESCOPO SAI DO CHAMADOR. Ver o cabeçalho de `processReminders`: sem
    // ele, o botão de um parceiro disparava e-mail de cobrança para as
    // famílias de todos os outros.
    const uid = await exigirMotorista(db, request);
    const apiKey = RESEND_API_KEY.value();
    return await processReminders(apiKey, new Date(), uid);
  }
);

// ===== Convites e lista de espera (ver functions/lib/invites.js) =====
//
// O resgate de convite saiu do cliente por segurança: as rules precisavam
// liberar leitura de toda criança pendente pra o app achar o código, e a
// landing autentica anonimamente — então qualquer visitante conseguia
// listar as crianças com endereço e telefone dos responsáveis.

exports.lookupInvite = makeLookupInvite(db);
exports.redeemInvite = makeRedeemInvite(db);
exports.joinDriverWaitlist = makeJoinDriverWaitlist(db);
exports.getShowcase = makeGetShowcase(db);

/**
 * A roleta de entrada. O SERVIDOR sorteia e grava antes de responder — a
 * animação do cliente encena um resultado que já existe. Uma vez por conta,
 * garantido pelo id do documento ser o uid.
 */
exports.spinEntryBonus = makeSpinEntryBonus(db);

// ===== Rota abandonada (ver functions/lib/routes.js) =====
//
// Fecha routeActive quando o motorista some sem encerrar. Sem isto o painel
// do pai mostrava a perua parada no mapa como se fosse a posição atual.

exports.closeStaleRoutes = makeCloseStaleRoutes(db);

// ===== Push (ver functions/lib/push.js) =====
//
// Amarrado na criação de notifications/{id}: todo aviso do app ganha push
// sem que cada caminho precise lembrar de enviar.

exports.sendPushOnNotification = makeSendPushOnNotification(db);

// ===== Confirmação de véspera (ver functions/lib/confirmarAusencias.js) =====
//
// Às 19h pergunta ao responsável se a ausência marcada pra amanhã continua
// valendo. O app já pergunta isso na tela — mas quem esquece de desmarcar é,
// por definição, quem não está abrindo o app.

exports.confirmarAusencias = makeConfirmarAusencias(db);

// ===== Faturamento (ver functions/lib/billing.js) =====
//
// Saiu do cliente: rodava no hook useAutoBilling quando o tio abria o
// app, com trava em localStorage. Mes em que ele nao abrisse, ninguem
// era cobrado — e a limpeza de historico era exclusao em massa disparada
// sem confirmacao no carregamento da tela.

exports.generateMonthlyPayments = makeGenerateMonthlyPayments(db);
exports.runBillingNow = makeRunBillingNow(db);

// ===== Previa do convite (ver functions/lib/invitePreview.js) =====
//
// Chamavel SEM autenticacao: o pai abre o link e ja ve o que o app tem,
// antes de criar conta. Abrir NAO consome o convite — importante porque o
// WhatsApp busca a URL pra montar o cartao de previa.

exports.getInvitePreview = makeGetInvitePreview(db);

// ===== Comprovante reusado (ver functions/lib/receiptGuard.js) =====
//
// Nao verifica se o pagamento existiu — so a conciliacao com o extrato do
// banco faz isso. Detecta DUPLICATA: o mesmo arquivo em dois meses. E o
// resultado e um aviso pro tio, nao um bloqueio.

exports.flagDuplicateReceipts = makeFlagDuplicateReceipts(db);

// ===== Backfill de privacidade (ver functions/lib/privacyBackfill.js) =====
//
// O commit e005363 fechou a ESCRITA de nome completo e foto sem consentimento
// no documento publico de depoimento. Isto recolhe o que ja estava gravado —
// fechar a porta nao traz de volta o que ficou do lado de fora.
//
// Padrao e dry-run. Pra aplicar: { apply: true }.

exports.backfillTestimonialPrivacy = makeBackfillTestimonialPrivacy(db);
