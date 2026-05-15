import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Sistema de "ligação" Tio → Pai pra avisar urgência.
 *
 * Caso de uso: o Tio chegou na casa do pai mas o pai não saiu pra pegar a
 * criança. Em vez de ficar buzinando e atrapalhar a rota, ele dispara uma
 * "chamada" no app. O pai vê um modal fullscreen com ringtone tocando.
 *
 * Estados:
 *   ringing       — Tio criou, pai ainda não viu ou não respondeu
 *   acknowledged  — Pai confirmou "estou indo" → ringtone para
 *   resolved      — Tio encerrou ("pai apareceu") ou pai cancelou
 *
 * Modelo:
 *   pendingCalls/{id}
 *     adminUid, parentUid, childId, childName,
 *     status, createdAt, acknowledgedAt, resolvedAt, resolvedBy
 */

export const CALL_STATUS = {
  RINGING: 'ringing',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
};

/**
 * Cria uma chamada. Antes de criar, encerra qualquer chamada antiga
 * (ringing/ack) entre os mesmos admin/parent — evita acúmulo.
 */
export async function createCall({
  adminUid,
  parentUid,
  childId,
  childName,
}) {
  if (!adminUid || !parentUid || !childId) {
    throw new Error('Dados insuficientes pra criar chamada.');
  }

  // Encerra chamadas anteriores ativas pro mesmo pai
  try {
    const existing = await getDocs(
      query(
        collection(db, 'pendingCalls'),
        where('parentUid', '==', parentUid),
        where('status', 'in', [CALL_STATUS.RINGING, CALL_STATUS.ACKNOWLEDGED])
      )
    );
    await Promise.all(
      existing.docs.map((d) =>
        updateDoc(d.ref, {
          status: CALL_STATUS.RESOLVED,
          resolvedAt: serverTimestamp(),
          resolvedBy: 'replaced',
        })
      )
    );
  } catch (err) {
    console.error('Falha ao limpar chamadas anteriores:', err);
  }

  const ref = await addDoc(collection(db, 'pendingCalls'), {
    adminUid,
    parentUid,
    childId,
    childName: childName || '',
    status: CALL_STATUS.RINGING,
    createdAt: serverTimestamp(),
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  });
  return ref.id;
}

export async function acknowledgeCall(callId) {
  if (!callId) return;
  await updateDoc(doc(db, 'pendingCalls', callId), {
    status: CALL_STATUS.ACKNOWLEDGED,
    acknowledgedAt: serverTimestamp(),
  });
}

export async function resolveCall(callId, resolvedBy = 'admin') {
  if (!callId) return;
  await updateDoc(doc(db, 'pendingCalls', callId), {
    status: CALL_STATUS.RESOLVED,
    resolvedAt: serverTimestamp(),
    resolvedBy,
  });
}

/**
 * Subscribe à chamada ativa do Pai (status ringing ou acknowledged).
 * Retorna o doc mais recente ou null.
 */
export function watchActiveCallForParent(parentUid, onUpdate, onError) {
  if (!parentUid) {
    onUpdate(null);
    return () => {};
  }
  const q = query(
    collection(db, 'pendingCalls'),
    where('parentUid', '==', parentUid),
    where('status', 'in', [CALL_STATUS.RINGING, CALL_STATUS.ACKNOWLEDGED])
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onUpdate(null);
        return;
      }
      // Pega a mais recente (sort client-side)
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      onUpdate(list[0]);
    },
    (err) => {
      console.error('watchActiveCallForParent error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe às chamadas ativas que o Tio disparou — pro pop-up no Tio.
 */
export function watchActiveCallsForAdmin(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'pendingCalls'),
    where('adminUid', '==', adminUid),
    where('status', 'in', [CALL_STATUS.RINGING, CALL_STATUS.ACKNOWLEDGED])
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      onUpdate(list);
    },
    (err) => {
      console.error('watchActiveCallsForAdmin error:', err);
      if (onError) onError(err);
    }
  );
}
