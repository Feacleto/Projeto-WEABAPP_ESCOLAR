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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
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
const {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
} = require('./lib/billing');
const { makeGetInvitePreview } = require('./lib/invitePreview');
const { makeFlagDuplicateReceipts } = require('./lib/receiptGuard');

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
async function processReminders(apiKey, now = new Date()) {
  const today = startOfDay(now);

  const paymentsSnap = await db
    .collection('payments')
    .where('status', 'in', ['pending', 'claimed'])
    .get();

  let evaluated = 0;
  let sent = 0;
  let skipped = 0;
  const errors = [];

  // Cache simples de parents/children/admin pra evitar N reads quando
  // tem várias mensalidades do mesmo pai/criança/admin.
  const parentCache = new Map();
  const childCache = new Map();
  let adminCache = null;

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

      // Carrega admin (motorista) — cacheia 1x
      if (!adminCache) {
        const initSnap = await db.doc('appState/init').get();
        const adminUid = initSnap.exists ? initSnap.data().adminUid : null;
        if (adminUid) {
          const as = await db.doc(`users/${adminUid}`).get();
          if (as.exists) adminCache = as.data();
        }
        adminCache = adminCache || {};
      }

      // Monta payload do template
      const monthLabel = p.monthLabel || formatMonthLabel(dueDate);
      const pixKey = adminCache.pixKey || null;
      const pixKeyType = pixKey
        ? PIX_TYPE_LABELS[adminCache.pixKeyType] || ''
        : '';
      const adminName = adminCache.name || '';
      const companyName = adminCache.companyName || 'Alô Buzinou!';

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
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Login obrigatório.');
    }
    // Só admin pode disparar manualmente
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas admin.');
    }
    const apiKey = RESEND_API_KEY.value();
    return await processReminders(apiKey);
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
