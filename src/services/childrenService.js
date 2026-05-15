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
import {
  addChildToDefaultPlan,
  removeChildFromDefaultPlan,
} from './routePlanService';
import { playSound } from './soundService';

// Estados simplificados pra 4. Cada criança passa por:
//   home → onboard → atSchool → onboard → delivered
// O segundo "onboard" reaproveita o mesmo estado, mudando o que o tio faz
// com base no turno atual (pickup vs dropoff).
export const STATUS_CYCLE = ['home', 'onboard', 'atSchool', 'delivered'];

export const STATUS_LABELS = {
  home: 'Em casa',
  onboard: 'Na perua',
  atSchool: 'Na escola',
  delivered: 'Entregue',
};

export function getNextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return 'home';
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

/**
 * Retorna o status "efetivo" levando em conta o reset diário automático.
 * Se statusUpdatedAt é de outro dia, considera 'home' (criança recomeça
 * o dia em casa). Evita Cloud Function pra resetar à meia-noite.
 */
export function getEffectiveStatus(child) {
  if (!child) return 'home';
  const updated = child.statusUpdatedAt?.toDate?.();
  if (!updated) return child.status || 'home';

  const today = new Date();
  const sameDay =
    updated.getFullYear() === today.getFullYear() &&
    updated.getMonth() === today.getMonth() &&
    updated.getDate() === today.getDate();

  return sameDay ? child.status || 'home' : 'home';
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
    gender: data.gender || 'male',
    birthDate: data.birthDate?.trim() || '', // YYYY-MM-DD
    parentName: data.parentName?.trim() || '',
    parentEmail: data.parentEmail?.trim().toLowerCase() || '',
    parentPhone: data.parentPhone?.trim() || '',
    parent2Name: data.parent2Name?.trim() || '',
    parent2Phone: data.parent2Phone?.trim() || '',
    address: data.address?.trim() || '',
    lat: Number(data.lat),
    lng: Number(data.lng),
    school: data.school?.trim() || '',
    schoolAddress: data.schoolAddress?.trim() || '',
    schoolLat: data.schoolLat != null ? Number(data.schoolLat) : null,
    schoolLng: data.schoolLng != null ? Number(data.schoolLng) : null,
    period: data.period || 'morning',
    pickupPeriod: data.pickupPeriod || data.period || 'morning',
    dropoffPeriod: data.dropoffPeriod || 'afternoon',
    monthlyFee: Number(data.monthlyFee) || 0,
    dueDay: clampDueDay(data.dueDay),
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

  // Auto-adiciona a criança no fim das filas dos turnos relevantes da rota
  // padrão. Não-bloqueante: erro aqui não impede o cadastro.
  try {
    await addChildToDefaultPlan({
      childId: docRef.id,
      pickupPeriod: payload.pickupPeriod,
      dropoffPeriod: payload.dropoffPeriod,
    });
  } catch (err) {
    console.error('Falha ao adicionar criança ao plano padrão:', err);
  }

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
  if (updates.schoolLat != null) updates.schoolLat = Number(updates.schoolLat);
  if (updates.schoolLng != null) updates.schoolLng = Number(updates.schoolLng);
  if (updates.monthlyFee != null) updates.monthlyFee = Number(updates.monthlyFee);
  if (updates.dueDay != null) updates.dueDay = clampDueDay(updates.dueDay);
  await updateDoc(doc(db, 'children', id), updates);
}

/**
 * Restringe o dueDay pro intervalo 1-28 (evita problemas com fevereiro).
 * Pra meses com mais dias, o paymentsService já clampa pro último dia.
 */
function clampDueDay(value) {
  const n = Math.round(Number(value) || 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(1, n), 28);
}

export async function updateChildStatus(id, status) {
  await updateDoc(doc(db, 'children', id), {
    status,
    statusUpdatedAt: serverTimestamp(),
  });
  // Som de mudança de status — feedback pro Tio ao avançar na rota
  playSound('status_change');
}

/**
 * Define ou remove a foto da criança. Null reseta pro avatar gerado.
 */
export async function setChildPhotoURL(id, photoURL) {
  await updateDoc(doc(db, 'children', id), { photoURL: photoURL || null });
}

export async function deactivateChild(id) {
  // Soft delete — preserva histórico de pagamentos e rotas.
  await updateDoc(doc(db, 'children', id), { active: false });
  // Tira da rota padrão também — fire-and-forget pra não falhar a desativação.
  try {
    await removeChildFromDefaultPlan(id);
  } catch (err) {
    console.error('Falha ao remover criança do plano padrão:', err);
  }
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
