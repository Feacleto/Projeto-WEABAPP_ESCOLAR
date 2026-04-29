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

/**
 * Gera pagamentos do mês para todas as crianças ativas que ainda não têm.
 * Idempotente — se já existir doc pra (childId, month), pula.
 *
 * Crianças sem parentUid (convite ainda pendente) são puladas — o admin
 * pode rodar de novo após o pai criar a conta.
 *
 * @param monthKey "YYYY-MM"
 * @param dueDay   dia do mês para vencimento (default: 10)
 * @returns { created, skipped, withoutParent }
 */
export async function generateMonthlyPayments(monthKey, dueDay = 10) {
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

  // 3. Cria os faltantes em batch (até 500 writes; pra essa escala basta)
  const dueDate = Timestamp.fromDate(new Date(year, month - 1, dueDay));
  const batch = writeBatch(db);
  let created = 0;
  let withoutParent = 0;

  for (const child of children) {
    if (existingChildIds.has(child.id)) continue;
    if (!child.parentUid) {
      withoutParent++;
      continue;
    }

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
 * Dá baixa num pagamento — admin only.
 */
export async function markAsPaid(paymentId) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'paid',
    paidAt: serverTimestamp(),
  });
}

/**
 * Reverte uma baixa (em caso de erro do admin).
 */
export async function markAsPending(paymentId) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'pending',
    paidAt: null,
  });
}

/**
 * Calcula o status de exibição (paid | pending | overdue).
 *
 * O Firestore só armazena "paid" ou "pending" — "overdue" é derivado
 * comparando dueDate com a data atual, evitando precisar de Cloud Functions
 * pra rodar um cron que atualizaria o status.
 */
export function computeDisplayStatus(payment) {
  if (!payment) return 'pending';
  if (payment.status === 'paid') return 'paid';
  const due = payment.dueDate?.toDate?.()?.getTime();
  if (due && due < Date.now()) return 'overdue';
  return 'pending';
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
