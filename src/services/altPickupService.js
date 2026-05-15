import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
  getDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Responsáveis alternativos — quem pode buscar a criança no lugar do pai.
 *
 * Estrutura:
 *   children/{childId}.altResponsibles  — lista pré-cadastrada pelo pai
 *     [{ id, name, phone, relationship }]
 *
 *   altPickups/{dateKey}_{childId}      — indicação diária de quem vai pegar
 *     { dateKey, childId, parentUid, name, phone, relationship, createdAt }
 *
 * - Pai cadastra/edita/remove `altResponsibles` no doc da criança.
 * - Pai cria/atualiza/remove `altPickups` quando precisa indicar outra pessoa
 *   pra um dia específico.
 * - Tio só lê — vê no card da criança "Hoje quem pega: X · (11) 99999-9999".
 */

function buildId(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

// ─────────────── Lista pré-cadastrada (em children/{childId}) ───────────────

/**
 * Adiciona um responsável alternativo na lista do pai.
 * Cada item ganha id estável client-side pra facilitar edição/remoção.
 */
export async function addAltResponsible(childId, data) {
  if (!childId) throw new Error('Sem childId.');
  const newItem = {
    id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name?.trim() || '',
    phone: data.phone?.trim() || '',
    relationship: data.relationship?.trim() || '',
  };
  await updateDoc(doc(db, 'children', childId), {
    altResponsibles: arrayUnion(newItem),
  });
  return newItem;
}

/**
 * Remove um responsável alt da lista. Como arrayRemove exige objeto exato,
 * fazemos read → filter → write.
 */
export async function removeAltResponsible(childId, altId) {
  if (!childId || !altId) return;
  const snap = await getDoc(doc(db, 'children', childId));
  if (!snap.exists()) return;
  const current = snap.data().altResponsibles || [];
  const next = current.filter((r) => r.id !== altId);
  await updateDoc(doc(db, 'children', childId), {
    altResponsibles: next,
  });
}

/**
 * Atualiza um responsável alt (edita nome/telefone/parentesco).
 */
export async function updateAltResponsible(childId, altId, data) {
  if (!childId || !altId) return;
  const snap = await getDoc(doc(db, 'children', childId));
  if (!snap.exists()) return;
  const current = snap.data().altResponsibles || [];
  const next = current.map((r) =>
    r.id === altId
      ? {
          ...r,
          name: data.name?.trim() ?? r.name,
          phone: data.phone?.trim() ?? r.phone,
          relationship: data.relationship?.trim() ?? r.relationship,
        }
      : r
  );
  await updateDoc(doc(db, 'children', childId), { altResponsibles: next });
}

// ─────────────── Indicação diária (altPickups/{dateKey_childId}) ───────────────

/**
 * Indica quem vai buscar a criança hoje (substituindo o pai padrão).
 * Idempotente — sobrescreve se já existir indicação pra o dia.
 */
export async function setDailyAltPickup({
  dateKey,
  childId,
  parentUid,
  name,
  phone,
  relationship,
}) {
  if (!dateKey || !childId) throw new Error('Dados insuficientes.');
  const id = buildId(dateKey, childId);
  await setDoc(doc(db, 'altPickups', id), {
    dateKey,
    childId,
    parentUid: parentUid || null,
    name: name?.trim() || '',
    phone: phone?.trim() || '',
    relationship: relationship?.trim() || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function clearDailyAltPickup({ dateKey, childId }) {
  if (!dateKey || !childId) return;
  await deleteDoc(doc(db, 'altPickups', buildId(dateKey, childId)));
}

/**
 * Subscribe à indicação do dia pra uma criança específica (uso do Pai).
 */
export function watchDailyAltPickup(dateKey, childId, onUpdate, onError) {
  if (!dateKey || !childId) {
    onUpdate(null);
    return () => {};
  }
  const ref = doc(db, 'altPickups', buildId(dateKey, childId));
  return onSnapshot(
    ref,
    (snap) => onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error('watchDailyAltPickup error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe a todos os altPickups do dia — uso do Tio.
 * Retorna mapa childId → pickup pra lookup rápido.
 */
export function watchAllAltPickupsByDate(dateKey, onUpdate, onError) {
  if (!dateKey) {
    onUpdate({});
    return () => {};
  }
  const q = query(
    collection(db, 'altPickups'),
    where('dateKey', '==', dateKey)
  );
  return onSnapshot(
    q,
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.childId) map[data.childId] = { id: d.id, ...data };
      });
      onUpdate(map);
    },
    (err) => {
      console.error('watchAllAltPickupsByDate error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Cria notificação pro Tio quando o pai indica responsável alternativo.
 */
export async function notifyAltPickup({ childName, name, phone, dateKey }) {
  try {
    // Resolver adminUid via appState/init (público)
    const initSnap = await getDoc(doc(db, 'appState', 'init'));
    const adminUid = initSnap.exists()
      ? initSnap.data().adminUid || null
      : null;
    if (!adminUid) return;

    const dateLabel = formatDateLabel(dateKey);
    const phoneText = phone ? ` (${phone})` : '';
    await addDoc(collection(db, 'notifications'), {
      userId: adminUid,
      type: 'alt_pickup',
      title: `Outro responsável vai buscar`,
      body: `${childName}: hoje quem pega é ${name}${phoneText}. Aviso para ${dateLabel}.`,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação alt_pickup:', err);
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
