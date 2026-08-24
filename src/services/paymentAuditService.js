import {
  collection,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Trilha de eventos de um pagamento — append-only.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * Um pagamento guardava só o estado FINAL. Pior: `undoReceipt` zerava o
 * `claimedAt`, ou seja, o registro de que o pai um dia declarou o pagamento
 * simplesmente desaparecia. Numa discussão — "eu avisei que paguei em julho"
 * — a prova do pai tinha sido apagada pela ação do tio.
 *
 * Não é acusação de má-fé: é que sem histórico, discordância honesta não tem
 * como ser resolvida. Alguém tem que ceder por cansaço, e normalmente é quem
 * tem menos poder na relação.
 *
 * A GARANTIA
 * As rules permitem CREATE e nada mais: nem update, nem delete, pra ninguém
 * — nem pro admin. Um evento escrito é definitivo. É o que faz a trilha valer
 * como prova em vez de valer como opinião.
 *
 * Cada evento fica em `payments/{paymentId}/events/{eventId}`. Subcoleção, e
 * não coleção separada, porque a vida do log é a vida do pagamento: apagar a
 * criança leva os dois juntos.
 */

export const PAYMENT_EVENTS = {
  CREATED: 'created',
  CLAIMED: 'claimed',
  UNCLAIMED: 'unclaimed',
  CONFIRMED: 'confirmed',
  REVERTED: 'reverted',
  RECEIPT_ATTACHED: 'receipt_attached',
  RECEIPT_REPLACED: 'receipt_replaced',
};

const EVENT_LABELS = {
  created: 'Mensalidade gerada',
  claimed: 'Responsável informou o pagamento',
  unclaimed: 'Responsável desfez o aviso de pagamento',
  confirmed: 'Motorista confirmou o recebimento',
  reverted: 'Motorista desfez a confirmação',
  receipt_attached: 'Comprovante anexado',
  receipt_replaced: 'Comprovante substituído',
};

export function eventLabel(type) {
  return EVENT_LABELS[type] || type;
}

/**
 * Registra um evento. NUNCA lança pra fora: falhar em gravar o log não pode
 * impedir a operação em si — um pagamento que não é confirmado porque o log
 * falhou é pior que um log com um buraco.
 *
 * @param actorRole 'parent' | 'admin' — quem agiu, não quem é dono do doc
 */
export async function logPaymentEvent(
  paymentId,
  { type, actorUid, actorRole, note = null, meta = null }
) {
  if (!paymentId || !type) return;
  try {
    await addDoc(collection(db, 'payments', paymentId, 'events'), {
      type,
      actorUid: actorUid || null,
      actorRole: actorRole || null,
      note: note ? String(note).slice(0, 300) : null,
      meta: meta || null,
      at: serverTimestamp(),
    });
  } catch (err) {
    console.error('logPaymentEvent:', err);
  }
}

/** Eventos de um pagamento, do mais antigo pro mais novo. */
export async function listPaymentEvents(paymentId) {
  if (!paymentId) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'payments', paymentId, 'events'), orderBy('at', 'asc'))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('listPaymentEvents:', err);
    return [];
  }
}
