import {
  collection,
  doc,
  addDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateInviteCode } from '../utils/generateInviteCode';
import { inviteCodeExists } from './inviteCodeService';

// Ordem do ciclo de status. Após "delivered", clicar avança pra "home"
// (próximo dia / nova rodada).
export const STATUS_CYCLE = [
  'home',
  'waiting',
  'onboard',
  'atSchool',
  'returning',
  'delivered',
];

export const STATUS_LABELS = {
  home: 'Em casa',
  waiting: 'Aguardando',
  onboard: 'Embarcado',
  atSchool: 'Na escola',
  returning: 'Voltando',
  delivered: 'Entregue',
};

export function getNextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return 'home';
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

// Garante invite code único consultando o Firestore.
// Probabilidade de colisão é baixa (1/9000), mas vale checar antes de salvar.
async function generateUniqueInviteCode(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode();
    if (!(await inviteCodeExists(code))) return code;
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

/**
 * Cadastra uma nova criança e retorna { id, inviteCode }.
 * Status inicial: "home", inviteStatus: "pending", active: true.
 */
export async function addChild(data) {
  const inviteCode = await generateUniqueInviteCode();

  const payload = {
    name: data.name?.trim() || '',
    parentName: data.parentName?.trim() || '',
    parentEmail: data.parentEmail?.trim().toLowerCase() || '',
    parentPhone: data.parentPhone?.trim() || '',
    address: data.address?.trim() || '',
    lat: Number(data.lat),
    lng: Number(data.lng),
    school: data.school?.trim() || '',
    period: data.period || 'morning',
    monthlyFee: Number(data.monthlyFee) || 0,
    notes: data.notes?.trim() || '',
    inviteCode,
    inviteStatus: 'pending',
    parentUid: null,
    status: 'home',
    statusUpdatedAt: serverTimestamp(),
    active: true,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'children'), payload);
  return { id: docRef.id, inviteCode };
}

export async function getChild(id) {
  const snap = await getDoc(doc(db, 'children', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Atualiza dados gerais (não usar pra mudar status — use updateChildStatus).
export async function updateChild(id, data) {
  const updates = { ...data };
  if (updates.lat != null) updates.lat = Number(updates.lat);
  if (updates.lng != null) updates.lng = Number(updates.lng);
  if (updates.monthlyFee != null) updates.monthlyFee = Number(updates.monthlyFee);
  await updateDoc(doc(db, 'children', id), updates);
}

export async function updateChildStatus(id, status) {
  await updateDoc(doc(db, 'children', id), {
    status,
    statusUpdatedAt: serverTimestamp(),
  });
}

export async function deactivateChild(id) {
  // Soft delete — preserva histórico de pagamentos e rotas.
  await updateDoc(doc(db, 'children', id), { active: false });
}

/**
 * Subscribe à lista de crianças ativas via onSnapshot.
 * Retorna a função de unsubscribe (chame no cleanup do useEffect).
 *
 * Ordenação é client-side pra evitar índice composto no Firestore.
 */
export function watchActiveChildren(onUpdate, onError) {
  const q = query(collection(db, 'children'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      console.error('watchActiveChildren error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe a um doc específico de criança (usado pelo painel do Pai).
 */
export function watchChild(id, onUpdate, onError) {
  return onSnapshot(
    doc(db, 'children', id),
    (snap) => {
      onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => {
      console.error('watchChild error:', err);
      if (onError) onError(err);
    }
  );
}
