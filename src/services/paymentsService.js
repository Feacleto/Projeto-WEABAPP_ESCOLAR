import {
  collection,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { playSound } from './soundService';

/**
 * Gera pagamentos do mês para todas as crianças ativas que ainda não têm.
 * Idempotente — se já existir doc pra (childId, month), pula.
 *
 * Cada pagamento usa o `dueDay` configurado individualmente na criança
 * (cadastrado no ChildForm). Famílias com rendas em datas diferentes têm
 * vencimentos diferentes. Fallback global de 10 pra crianças antigas.
 *
 * Crianças sem parentUid (convite ainda pendente) são puladas.
 *
 * @param monthKey "YYYY-MM"
 * @param fallbackDueDay dia padrão quando a criança não tem dueDay configurado
 * @returns { created, skipped, withoutParent }
 */
export async function generateMonthlyPayments(monthKey, fallbackDueDay = 10) {
  const [year, month] = (monthKey || '').split('-').map(Number);
  if (!year || !month) {
    throw new Error('monthKey inválido (esperado: "YYYY-MM").');
  }

  // 1. Crianças ativas
  const childrenSnap = await getDocs(
    query(collection(db, 'children'), where('active', '==', true))
  );
  const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 2. Pagamentos já existentes do mês — usado pra deduplicar
  const existingSnap = await getDocs(
    query(collection(db, 'payments'), where('month', '==', monthKey))
  );
  const existingChildIds = new Set(
    existingSnap.docs.map((d) => d.data().childId)
  );

  // Último dia do mês — usado pra clampar dueDays maiores (ex: 31/fev)
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const batch = writeBatch(db);
  let created = 0;
  let withoutParent = 0;

  for (const child of children) {
    if (existingChildIds.has(child.id)) continue;
    if (!child.parentUid) {
      withoutParent++;
      continue;
    }

    // dueDay individual da criança (com clamp pro último dia do mês)
    const childDueDay = Number(child.dueDay) || fallbackDueDay;
    const safeDueDay = Math.min(
      Math.max(1, childDueDay),
      lastDayOfMonth
    );
    const dueDate = Timestamp.fromDate(new Date(year, month - 1, safeDueDay));

    const ref = doc(collection(db, 'payments'));
    batch.set(ref, {
      childId: child.id,
      childName: child.name, // denormalizado pra evitar join no read
      parentUid: child.parentUid,
      month: monthKey,
      amount: Number(child.monthlyFee) || 0,
      dueDate,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    created++;
  }

  if (created > 0) await batch.commit();

  return {
    created,
    skipped: existingChildIds.size,
    withoutParent,
  };
}

/**
 * Pai marca o pagamento como "paguei" (aguardando confirmação do tio).
 * O Firestore Rules garante que pai só pode escrever 'pending' -> 'claimed'.
 *
 * @param method 'pix' | 'cash' — como ele pagou (opcional, default 'pix')
 */
export async function claimPayment(paymentId, method = 'pix') {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'claimed',
    claimedAt: serverTimestamp(),
    paymentMethod: method,
  });
  // Som "pagar" — feedback pro pai que marcou como pago
  playSound('pay');
}

/**
 * Pai desfaz "marquei como pago" (caso tenha clicado errado e o tio ainda
 * não confirmou). Volta pra 'pending'.
 */
export async function unclaimPayment(paymentId) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'pending',
    claimedAt: null,
    paymentMethod: null,
  });
}

/**
 * Tio confirma que recebeu o pagamento — admin only.
 * Funciona tanto pra dar baixa direto ('pending' -> 'paid') quanto pra
 * confirmar um claim do pai ('claimed' -> 'paid').
 *
 * `method` ('pix' | 'cash' | 'card') registra como o tio recebeu — preserva
 * o método declarado pelo pai (se houver) ou sobrescreve com o que o tio
 * informar na hora de dar baixa.
 */
export async function confirmReceipt(paymentId, method = null) {
  const updates = {
    status: 'paid',
    paidAt: serverTimestamp(),
  };
  if (method) updates.paymentMethod = method;
  await updateDoc(doc(db, 'payments', paymentId), updates);
  // Som "caixa registrando" — feedback pro Tio que deu baixa
  playSound('cash_in');
}

/**
 * Reverte uma confirmação (em caso de erro do tio).
 * Volta pra 'pending' — perde o claim do pai (ele precisa marcar de novo).
 */
export async function undoReceipt(paymentId) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'pending',
    paidAt: null,
    claimedAt: null,
  });
}

/**
 * Calcula o status de exibição.
 *
 * Estados possíveis:
 *   - 'paid'     — pago e confirmado pelo tio
 *   - 'claimed'  — pai marcou como pago, aguardando confirmação do tio
 *   - 'overdue'  — pendente E dueDate < hoje
 *   - 'pending'  — pendente E dueDate >= hoje (ou sem dueDate)
 *
 * 'overdue' é derivado em runtime — evita Cloud Function pra atualizar status.
 * 'claimed' tem prioridade sobre 'overdue': se o pai marcou como pago, mesmo
 * que esteja após a data, o tio precisa confirmar antes de virar 'paid'.
 */
export function computeDisplayStatus(payment) {
  if (!payment) return 'pending';
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'claimed') return 'claimed';
  const due = payment.dueDate?.toDate?.()?.getTime();
  if (due && due < Date.now()) return 'overdue';
  return 'pending';
}

/**
 * Apaga pagamentos com `month` anterior ao limite de retenção (default: 12 meses).
 * Útil pra manter o histórico em um ano rolling — chamado pelo useAutoBilling.
 *
 * Idempotente. Retorna a quantidade apagada.
 */
export async function cleanOldPayments(retentionMonths = 12) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;

  const snap = await getDocs(
    query(collection(db, 'payments'), where('month', '<', cutoffKey))
  );
  if (snap.empty) return 0;

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const slice = docs.slice(i, i + 450);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/**
 * Subscribe aos pagamentos de um mês específico (visão do Tio).
 * Ordena por nome da criança (client-side, evita índice composto).
 */
export function watchPaymentsByMonth(monthKey, onUpdate, onError) {
  const q = query(collection(db, 'payments'), where('month', '==', monthKey));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        (a.childName || '').localeCompare(b.childName || '', 'pt-BR')
      );
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByMonth error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe aos pagamentos de uma criança específica.
 * Útil pro admin ver o histórico individual de uma criança.
 */
export function watchPaymentsByChild(childId, onUpdate, onError) {
  const q = query(collection(db, 'payments'), where('childId', '==', childId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByChild error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe aos pagamentos de um responsável (visão do Pai).
 *
 * Filtra por parentUid pra alinhar com as Firestore Security Rules
 * (que liberam read se parentUid == request.auth.uid). Ordena por mês desc.
 */
export function watchPaymentsByParent(parentUid, onUpdate, onError) {
  const q = query(
    collection(db, 'payments'),
    where('parentUid', '==', parentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByParent error:', err);
      if (onError) onError(err);
    }
  );
}
