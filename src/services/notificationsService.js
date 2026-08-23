import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './../firebase/config';
import { computeDisplayStatus } from './paymentsService';

/**
 * Helper: busca adminUid de appState/init (público, sempre disponível).
 * Usado pelas notifs que vão pro admin — evita race condition de quem
 * chama estar dependendo do useAdminProfile carregar primeiro.
 */
async function resolveAdminUid() {
  try {
    const snap = await getDoc(doc(db, 'appState', 'init'));
    return snap.exists() ? snap.data().adminUid || null : null;
  } catch (err) {
    console.error('[notifications] Falha ao resolver adminUid:', err);
    return null;
  }
}

/**
 * Notificações = união de duas fontes:
 *
 * 1. **Eventos** (docs reais em /notifications/{id}):
 *    - 'payment_claimed'   — pai marcou pagamento como pago (vai pro tio)
 *    - 'payment_confirmed' — tio confirmou recebimento (vai pro pai)
 *
 * 2. **Lembretes derivados** dos pagamentos (calculados client-side, sem doc):
 *    - 'payment_due_5d'     — 5 dias antes do vencimento
 *    - 'payment_due_3d'     — 3 dias antes
 *    - 'payment_due_0d'     — no dia do vencimento
 *    - 'payment_overdue_3d' — 3 dias após (só se NÃO claimed)
 *    - 'payment_overdue_7d' — 7 dias após (só se NÃO claimed)
 *
 * Por que client-side? Sem Cloud Functions / scheduler, calcular na hora que
 * o usuário abre o app é mais barato e direto. Trade-off: o pai só "vê" o
 * lembrete quando abre a aba — não há push real. Aceito pra MVP.
 */

// =============================================================================
// Eventos persistidos (criados no momento da ação)
// =============================================================================

/**
 * Cria notificação pro tio quando o pai marca pagamento como pago.
 * Não bloqueia: erros são logados mas não estouram pro chamador.
 *
 * @param method 'pix' | 'cash' — como o pai disse que pagou
 */
export async function notifyPaymentClaimed({
  adminUid,
  paymentId,
  childName,
  monthLabel,
  amount,
  method = 'pix',
}) {
  // Fallback: se o caller não conseguiu carregar adminUid (race condition),
  // busca do appState/init (público, sempre disponível).
  const targetUid = adminUid || (await resolveAdminUid());
  if (!targetUid) {
    console.warn('[notifyPaymentClaimed] Sem adminUid — notif não criada.');
    return;
  }
  const methodLabel = method === 'cash' ? 'em dinheiro' : 'via PIX';
  const followup =
    method === 'cash'
      ? 'Confirme o recebimento quando estiver com o dinheiro em mãos.'
      : 'Confirme o recebimento após verificar o comprovante.';
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: targetUid,
      type: 'payment_claimed',
      title: 'Novo pagamento informado',
      body: `${childName} informou pagamento de ${formatBRL(amount)} (${monthLabel}) ${methodLabel}. ${followup}`,
      paymentId,
      paymentMethod: method,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação payment_claimed:', err);
  }
}

/**
 * Cria notificação pro Tio quando o Pai aceita o contrato de transporte.
 */
export async function notifyContractAccepted({ adminUid, parentName, childName }) {
  const targetUid = adminUid || (await resolveAdminUid());
  if (!targetUid) {
    console.warn('[notifyContractAccepted] Sem adminUid — notif não criada.');
    return;
  }
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: targetUid,
      type: 'contract_accepted',
      title: 'Contrato aceito',
      body: `${parentName} aceitou o contrato de transporte de ${childName}.`,
      childName,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação contract_accepted:', err);
  }
}

/**
 * Cria notificação pro pai quando o tio confirma recebimento.
 */
export async function notifyPaymentConfirmed({
  parentUid,
  paymentId,
  monthLabel,
  amount,
  childName,
}) {
  try {
    // O nome da criança entra no corpo porque um responsável pode ter dois
    // filhos: "pagamento confirmado" sem dizer de quem não informa nada.
    const who = childName ? ` da mensalidade de ${childName}` : '';
    await addDoc(collection(db, 'notifications'), {
      userId: parentUid,
      type: 'payment_confirmed',
      title: 'Pagamento confirmado',
      body: `O motorista confirmou o recebimento${who}: ${formatBRL(amount)} (${monthLabel}).`,
      paymentId,
      childName: childName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação payment_confirmed:', err);
  }
}

// =============================================================================
// Subscribe / mark read
// =============================================================================

export function watchUserNotifications(userId, onUpdate, onError) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort por createdAt desc (mais recente primeiro)
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      onUpdate(list);
    },
    (err) => {
      console.error('watchUserNotifications error:', err);
      if (onError) onError(err);
    }
  );
}

export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), {
    readAt: serverTimestamp(),
  });
}

/**
 * Marca todas as notificações não-lidas do usuário como lidas (batch).
 */
export async function markAllNotificationsRead(userId) {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId))
  );
  const unread = snap.docs.filter((d) => !d.data().readAt);
  if (unread.length === 0) return 0;

  const batch = writeBatch(db);
  const now = new Date();
  unread.forEach((d) => {
    batch.update(d.ref, { readAt: now });
  });
  await batch.commit();
  return unread.length;
}

// =============================================================================
// Lembretes derivados (não persistidos)
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gera lembretes virtuais a partir dos pagamentos do pai.
 * Cada lembrete tem id estável (`${paymentId}-${kind}`) pra que a UI consiga
 * mesclar com eventos reais e marcar leitura via localStorage.
 */
export function deriveParentReminders(payments, now = Date.now()) {
  const reminders = [];

  for (const p of payments) {
    const display = computeDisplayStatus(p);
    if (display === 'paid') continue;

    const due = p.dueDate?.toDate?.()?.getTime();
    if (!due) continue;

    const monthLabel = formatMonthLabel(p.month);
    const amount = formatBRL(p.amount);
    // Prefixo com o nome da criança quando o pagamento tem essa informação
    // denormalizada — necessário pra quem acompanha dois filhos.
    const who = p.childName ? `${String(p.childName).split(/s+/)[0]}: ` : '';
    const diffDays = Math.floor((due - now) / DAY_MS);
    const overdueDays = Math.floor((now - due) / DAY_MS);

    // Pré-vencimento: pendente ou claimed (pai já adiantou)
    if (display !== 'paid') {
      if (diffDays === 5) {
        reminders.push(reminder(p, 'payment_due_5d', due, {
          title: 'Vencimento em 5 dias',
          body: `${who}sua mensalidade de ${amount} (${monthLabel}) vence em 5 dias.`,
        }));
      }
      if (diffDays === 3) {
        reminders.push(reminder(p, 'payment_due_3d', due, {
          title: 'Vencimento em 3 dias',
          body: `${who}sua mensalidade de ${amount} (${monthLabel}) vence em 3 dias.`,
        }));
      }
      if (diffDays === 0) {
        reminders.push(reminder(p, 'payment_due_0d', due, {
          title: 'Vencimento hoje',
          body: `${who}sua mensalidade de ${amount} (${monthLabel}) vence hoje.`,
        }));
      }
    }

    // Pós-vencimento: SÓ se não-claimed (regra do produto: pai informou
    // pagamento -> sem alertas de atraso até o tio confirmar/recusar)
    if (display === 'overdue') {
      if (overdueDays === 3) {
        reminders.push(reminder(p, 'payment_overdue_3d', due + 3 * DAY_MS, {
          title: 'Pagamento atrasado',
          body: `${who}sua mensalidade de ${amount} (${monthLabel}) está 3 dias atrasada.`,
        }));
      }
      if (overdueDays === 7) {
        reminders.push(reminder(p, 'payment_overdue_7d', due + 7 * DAY_MS, {
          title: 'Pagamento atrasado há uma semana',
          body: `${who}sua mensalidade de ${amount} (${monthLabel}) está 7 dias atrasada.`,
        }));
      }
    }
  }

  return reminders;
}

function reminder(payment, type, atMs, { title, body }) {
  return {
    id: `derived:${payment.id}:${type}`,
    derived: true,
    type,
    title,
    body,
    paymentId: payment.id,
    createdAt: { toMillis: () => atMs, toDate: () => new Date(atMs) },
  };
}

// =============================================================================
// Read tracking pra lembretes derivados (localStorage)
// =============================================================================

const READ_KEY = 'tn_derived_reads_v1';

function loadDerivedReads() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDerivedReads(set) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Falha ao salvar leituras derivadas:', err);
  }
}

export function getDerivedReadIds() {
  return loadDerivedReads();
}

export function markDerivedRead(id) {
  const set = loadDerivedReads();
  set.add(id);
  saveDerivedReads(set);
}

export function markAllDerivedRead(ids) {
  const set = loadDerivedReads();
  ids.forEach((id) => set.add(id));
  saveDerivedReads(set);
}

// =============================================================================
// Helpers locais (evita dependência circular com utils/formatters)
// =============================================================================

function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}
