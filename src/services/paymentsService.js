import {
  collection,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { playSound } from './soundService';

// NOTA: a geracao das mensalidades do mes e a limpeza do historico
// antigo NAO vivem mais aqui. Foram pra functions/lib/billing.js,
// agendadas pra 6h todo dia: rodando no cliente, o mes em que o tio nao
// abrisse o app ficava sem cobranca, e a limpeza era exclusao em massa
// disparada sem confirmacao no carregamento da tela.

/**
 * Pai marca o pagamento como "paguei" (aguardando confirmação do tio).
 * O Firestore Rules garante que pai só pode escrever 'pending' -> 'claimed'.
 *
 * @param method 'pix' | 'cash' — como ele pagou (opcional, default 'pix')
 */
export async function claimPayment(paymentId, method = 'pix', receiptURL = null) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'claimed',
    claimedAt: serverTimestamp(),
    paymentMethod: method,
    // Comprovante anexado fecha o ciclo dentro do app: sem ele, "paguei"
    // virava conversa paralela no WhatsApp com print de tela.
    receiptURL: receiptURL || null,
  });
  // Som "pagar" — feedback pro pai que marcou como pago
  playSound('pay');
}


/**
 * Anexa (ou troca) o comprovante de um pagamento já existente.
 *
 * POR QUE O TIO PRECISA DISTO
 * O caminho ideal é o pai anexar ao avisar que pagou. Mas o caminho real,
 * na maioria das vezes, é ele pagar pelo banco e mandar o print no
 * WhatsApp — porque foi assim que ele sempre fez. Sem uma forma de o tio
 * anexar aquilo, o comprovante fica fora do app e o histórico do mês
 * mente: aparece como pago sem lastro nenhum.
 *
 * Não muda o STATUS, só o anexo. Confirmar recebimento continua sendo uma
 * decisão separada e explícita do tio.
 */
export async function attachReceipt(paymentId, receiptURL) {
  if (!paymentId) throw new Error('Sem paymentId.');
  await updateDoc(doc(db, 'payments', paymentId), {
    receiptURL: receiptURL || null,
    receiptAttachedAt: serverTimestamp(),
  });
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
    receiptURL: null,
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
 * Janela em que o Tio pode reverter um pagamento PIX/dinheiro recebido.
 * Depois disso, a confirmação fica definitiva — evita zicas tipo o pai
 * recolher o dinheiro 1 mês depois ou o Tio se confundir muito tempo
 * após o fato. Cartão de crédito não tem reversão manual em momento
 * nenhum (é reconhecido automaticamente pelo gateway).
 */
export const UNDO_WINDOW_HOURS = 24;
const UNDO_WINDOW_MS = UNDO_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Diz se um pagamento ainda pode ser revertido pelo Tio. Combina:
 *   - método (cartão nunca pode ser desfeito manualmente)
 *   - tempo desde a confirmação (limite UNDO_WINDOW_HOURS)
 *
 * Retorna { allowed, reason } pra UI exibir mensagem clara.
 */
export function canUndoReceipt(payment) {
  if (!payment) return { allowed: false, reason: 'Pagamento não encontrado.' };
  if (payment.status !== 'paid') {
    return { allowed: false, reason: 'Pagamento ainda não foi confirmado.' };
  }
  if (payment.paymentMethod === 'card') {
    return {
      allowed: false,
      reason:
        'Pagamentos por cartão são reconhecidos automaticamente — não dá pra desfazer.',
    };
  }
  const paidAt =
    payment.paidAt?.toDate?.() ||
    (payment.paidAt ? new Date(payment.paidAt) : null);
  if (!paidAt) {
    // Sem timestamp → pagamento antigo. Permite desfazer (compatibilidade).
    return { allowed: true, reason: null };
  }
  const elapsed = Date.now() - paidAt.getTime();
  if (elapsed > UNDO_WINDOW_MS) {
    const hours = Math.round(elapsed / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `Já se passaram ${hours}h da confirmação. Reversão liberada só em até ${UNDO_WINDOW_HOURS}h pra evitar erros.`,
    };
  }
  return { allowed: true, reason: null };
}

/**
 * Reverte uma confirmação (em caso de erro do tio). Sujeito às regras
 * de `canUndoReceipt` — joga erro se não for permitido (a UI evita o
 * caminho mas a verificação aqui é a fonte da verdade).
 *
 * Volta pra 'pending' — perde o claim do pai (ele precisa marcar de novo).
 */
export async function undoReceipt(paymentId, payment = null) {
  if (payment) {
    const { allowed, reason } = canUndoReceipt(payment);
    if (!allowed) throw new Error(reason || 'Reversão não permitida.');
  }
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
 * Busca todos os pagamentos desde `fromMonthKey` (YYYY-MM) inclusive.
 * Uso no relatório financeiro do Tio — one-shot, não-reativo.
 */
export async function getPaymentsSince(fromMonthKey) {
  if (!fromMonthKey) return [];
  const q = query(
    collection(db, 'payments'),
    where('month', '>=', fromMonthKey)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
