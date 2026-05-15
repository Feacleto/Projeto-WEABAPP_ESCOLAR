import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Ausências declaradas — coleção separada de `dailyRoutes` pra deixar as rules
 * simples e permitir que tanto pai quanto admin declarem ausência sem mexer
 * na ordem da rota.
 *
 * Document id estável: `${YYYY-MM-DD}_${childId}` — idempotente, pai/admin
 * podem sobrescrever a declaração do dia sem duplicar.
 *
 * Tipos:
 *   - 'full'        → criança não vai à escola hoje (nem ida nem volta)
 *   - 'no-pickup'   → pai vai LEVAR de manhã (Tio não busca, mas Tio devolve à tarde)
 *   - 'no-dropoff'  → pai vai BUSCAR na escola (Tio leva, mas pai pega no fim)
 *
 * `declaredBy`: 'parent' | 'admin' — só pra UI mostrar quem registrou.
 */

export const ABSENCE_TYPES = {
  FULL: 'full',
  NO_PICKUP: 'no-pickup',
  NO_DROPOFF: 'no-dropoff',
};

export const ABSENCE_LABELS = {
  full: 'Não vai hoje',
  'no-pickup': 'Pai vai levar de manhã',
  'no-dropoff': 'Pai vai buscar à tarde',
};

export const ABSENCE_SHORT = {
  full: 'Falta',
  'no-pickup': 'Sem ida',
  'no-dropoff': 'Sem volta',
};

function buildId(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

/**
 * Declara/atualiza ausência. Sobrescreve se já existir (idempotente).
 */
export async function declareAbsence({
  dateKey,
  childId,
  childName,
  parentUid,
  type,
  declaredBy,
  note = '',
}) {
  const id = buildId(dateKey, childId);
  await setDoc(doc(db, 'absenceDeclarations', id), {
    dateKey,
    childId,
    childName: childName || '',
    parentUid: parentUid || null,
    type,
    declaredBy,
    note,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function removeAbsence({ dateKey, childId }) {
  const id = buildId(dateKey, childId);
  await deleteDoc(doc(db, 'absenceDeclarations', id));
}

/**
 * Subscribe a todas as ausências de uma data (uso do Tio).
 */
export function watchAbsencesByDate(dateKey, onUpdate, onError) {
  if (!dateKey) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'absenceDeclarations'),
    where('dateKey', '==', dateKey)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(list);
    },
    (err) => {
      console.error('watchAbsencesByDate error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe à ausência de uma criança específica em uma data (uso do Pai).
 * Retorna o doc ou null.
 */
export function watchAbsenceForChild(dateKey, childId, onUpdate, onError) {
  if (!dateKey || !childId) {
    onUpdate(null);
    return () => {};
  }
  const ref = doc(db, 'absenceDeclarations', buildId(dateKey, childId));
  return onSnapshot(
    ref,
    (snap) => onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error('watchAbsenceForChild error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Cria notificação informando a declaração de ausência.
 * Quem declarou e quem recebe é decidido pelo chamador.
 */
export async function notifyAbsence({
  targetUid,
  childName,
  type,
  dateKey,
  declaredBy,
}) {
  if (!targetUid) return;
  const typeLabel = ABSENCE_LABELS[type] || 'Ausência registrada';
  const who = declaredBy === 'parent' ? 'O responsável' : 'O motorista';
  const dateLabel = formatDateLabel(dateKey);
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: targetUid,
      type: 'absence_declared',
      title: `Ausência: ${childName}`,
      body: `${who} avisou: "${typeLabel}" em ${dateLabel}.`,
      childName,
      absenceType: type,
      dateKey,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação de ausência:', err);
  }
}

function formatDateLabel(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(y, m - 1, d));
}
