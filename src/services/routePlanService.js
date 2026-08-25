import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

/**
 * Sistema de rota baseado em turnos.
 *
 * Cada criança tem `pickupPeriod` (quando o tio busca em casa) e
 * `dropoffPeriod` (quando o tio devolve em casa). Os valores possíveis
 * são 'morning', 'afternoon', 'evening'.
 *
 * Cada combinação (period, direction) é um TURNO único, identificado por
 * uma chave 'morning-pickup' / 'afternoon-dropoff' / etc. Total: 6 turnos.
 *
 * Estrutura:
 *   - routePlans/{uid}_default        — ordem fixa por turno, POR MOTORISTA
 *   - dailyRoutes/{uid}_{YYYY-MM-DD}  — override do dia, POR MOTORISTA
 *
 * Resolução: ao ler "ordem de hoje pro turno X", buscamos primeiro
 * dailyRoutes/{uid}_{hoje}.X. Se não existe, caímos pra routePlans/{uid}_default.X.
 */

// ============================================================================
// Constantes de turno
// ============================================================================

export const PERIODS = ['morning', 'afternoon', 'evening'];
export const DIRECTIONS = ['pickup', 'dropoff'];

// Opções "ricas" pros selectors da UI — fonte única em vez de redefinir
// listas idênticas em cada formulário.
export const PERIOD_OPTIONS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noite' },
];

export const TURNO_LABELS = {
  'morning-pickup': 'Manhã · Ida (casa → escola)',
  'morning-dropoff': 'Manhã · Volta (escola → casa)',
  'afternoon-pickup': 'Tarde · Ida (casa → escola)',
  'afternoon-dropoff': 'Tarde · Volta (escola → casa)',
  'evening-pickup': 'Noite · Ida (casa → escola)',
  'evening-dropoff': 'Noite · Volta (escola → casa)',
};

export const TURNO_SHORT_LABELS = {
  'morning-pickup': 'Manhã · Ida',
  'morning-dropoff': 'Manhã · Volta',
  'afternoon-pickup': 'Tarde · Ida',
  'afternoon-dropoff': 'Tarde · Volta',
  'evening-pickup': 'Noite · Ida',
  'evening-dropoff': 'Noite · Volta',
};

// Janelas de tempo (horas locais). Define qual período o relógio está agora.
const TIME_WINDOWS = [
  { period: 'morning', start: 4, end: 9 },
  { period: 'afternoon', start: 11, end: 14 },
  { period: 'evening', start: 16, end: 19 },
];

export function getCurrentPeriod(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();
  const decimalH = h + m / 60;
  for (const w of TIME_WINDOWS) {
    if (decimalH >= w.start && decimalH < w.end) return w.period;
  }
  return null; // fora dos horários de turno
}

export function turnoKey(period, direction) {
  return `${period}-${direction}`;
}

/**
 * Retorna a chave 'YYYY-MM-DD' usando hora local.
 */
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// routePlans/{uid}_default — ordem padrão por turno, por motorista
// ============================================================================

/**
 * O ID DA ROTA CARREGA O DONO. E isso não é organização, é integridade.
 *
 * Antes era `routePlans/default` e `dailyRoutes/{data}` — IDs FIXOS. Com um
 * motorista funcionava; com dois, os dois escrevem no MESMO documento.
 *
 * Testado contra produção com duas contas reais: o motorista 2 sobrescreveu
 * o `dailyRoutes` do motorista 1 com HTTP 200. Não é vazamento de leitura —
 * é DESTRUIÇÃO: o segundo abre o app e a rota do dia do primeiro, com as
 * crianças já embarcadas e a ordem ajustada na hora, vira a rota dele.
 *
 * `{uid}_default` e `{uid}_{data}` resolvem sem join e sem consulta extra: o
 * caminho do documento já é o escopo. E a rule confere `adminUid` dentro,
 * porque ID bonito não é permissão.
 *
 * E o `adminUid` VAI TAMBÉM NO CORPO, não só no id. Id bonito não é
 * permissão: a rule precisa de um campo pra conferir, senão qualquer
 * motorista que souber o uid do outro monta o caminho na mão e escreve.
 *
 * Consertado com o banco VAZIO, que é o momento em que isto custa zero.
 * Depois de vinte motoristas seria migração com rota em andamento.
 */
function uidAtual() {
  return auth.currentUser?.uid || '_sem_sessao';
}

function defaultDoc() {
  return doc(db, 'routePlans', `${uidAtual()}_default`);
}

/**
 * Adiciona uma criança aos turnos relevantes (pickup + dropoff) na rota
 * padrão. Idempotente: arrayUnion não duplica.
 *
 * Chamado dentro de addChild — assim novas crianças automaticamente
 * entram no fim das filas dos seus turnos.
 */
export async function addChildToDefaultPlan({
  childId,
  pickupPeriod,
  dropoffPeriod,
}) {
  const updates = {};
  if (pickupPeriod) {
    updates[turnoKey(pickupPeriod, 'pickup')] = arrayUnion(childId);
  }
  if (dropoffPeriod) {
    updates[turnoKey(dropoffPeriod, 'dropoff')] = arrayUnion(childId);
  }
  updates.updatedAt = serverTimestamp();

  // setDoc com merge cria o doc se não existir e mescla campos
  await setDoc(defaultDoc(), { ...updates, adminUid: uidAtual() }, { merge: true });
}

/**
 * Remove uma criança de TODOS os turnos da rota padrão.
 * Usado quando uma criança é desativada ou tem os períodos alterados.
 */
export async function removeChildFromDefaultPlan(childId) {
  const updates = { updatedAt: serverTimestamp() };
  for (const period of PERIODS) {
    for (const direction of DIRECTIONS) {
      updates[turnoKey(period, direction)] = arrayRemove(childId);
    }
  }
  await setDoc(defaultDoc(), { ...updates, adminUid: uidAtual() }, { merge: true });
}

export async function getDefaultPlan() {
  const snap = await getDoc(defaultDoc());
  return snap.exists() ? snap.data() : {};
}

/**
 * Salva a ordem de um turno específico no plano padrão (rota base).
 * Cresce automaticamente ao adicionar crianças (addChildToDefaultPlan) e
 * pode ser reorganizada manualmente pela tela "Planejar rota padrão".
 */
export async function setDefaultTurnoOrder(turno, order) {
  await setDoc(
    defaultDoc(),
    {
      adminUid: uidAtual(),
      [turno]: order,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function watchDefaultPlan(onUpdate, onError) {
  return onSnapshot(
    defaultDoc(),
    (snap) => onUpdate(snap.exists() ? snap.data() : {}),
    (err) => {
      console.error('watchDefaultPlan error:', err);
      if (onError) onError(err);
    }
  );
}

// ============================================================================
// dailyRoutes/{uid}_{YYYY-MM-DD} — override do dia, por motorista
// ============================================================================

function dailyDoc(dateKey) {
  // Mesmo motivo do defaultDoc: sem o uid no id, dois motoristas dividem o
  // documento do dia e o último a escrever apaga o trabalho do outro.
  return doc(db, 'dailyRoutes', `${uidAtual()}_${dateKey}`);
}

export async function getDailyRoute(dateKey) {
  const snap = await getDoc(dailyDoc(dateKey));
  return snap.exists() ? snap.data() : null;
}

export function watchDailyRoute(dateKey, onUpdate, onError) {
  if (!dateKey) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    dailyDoc(dateKey),
    (snap) => onUpdate(snap.exists() ? snap.data() : null),
    (err) => {
      console.error('watchDailyRoute error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Salva a ordem de um turno específico no dia.
 * Cria o doc se não existir.
 */
export async function setDailyTurnoOrder(dateKey, turno, order) {
  await setDoc(
    dailyDoc(dateKey),
    {
      adminUid: uidAtual(),
      [turno]: { order, absent: [] },
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Marca/desmarca uma criança como ausente em um turno do dia.
 * `mode` = 'add' | 'remove'.
 *
 * Importante: como `arrayUnion` exige o doc existir com a estrutura, usamos
 * setDoc merge com leitura prévia pra garantir que o turno tenha order.
 */
export async function toggleAbsence(dateKey, turno, childId, mode) {
  const ref = dailyDoc(dateKey);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  const turnoData = existing[turno] || { order: [], absent: [] };

  let absent = turnoData.absent || [];
  if (mode === 'add') {
    if (!absent.includes(childId)) absent = [...absent, childId];
  } else {
    absent = absent.filter((id) => id !== childId);
  }

  await setDoc(
    ref,
    {
      adminUid: uidAtual(),
      [turno]: {
        order: turnoData.order || [],
        absent,
      },
      updatedAt: serverTimestamp(),
      createdAt: existing.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}

// ============================================================================
// Resolução de ordem efetiva (default vs daily)
// ============================================================================

/**
 * Combina o plano default com o override do dia pra produzir a "rota efetiva"
 * pra um turno específico.
 *
 * Retorna: { order: [childIds], absent: [childIds] }
 *
 * - Se daily existe e tem `order` para o turno: usa essa ordem
 * - Senão: usa default
 * - `absent` SEMPRE vem do daily (existe só hoje)
 */
export function resolveTurnoOrder(defaultPlan, dailyRoute, turno) {
  const dailyTurno = dailyRoute?.[turno];
  const defaultOrder = defaultPlan?.[turno] || [];

  const order =
    Array.isArray(dailyTurno?.order) && dailyTurno.order.length > 0
      ? dailyTurno.order
      : defaultOrder;

  const absent = Array.isArray(dailyTurno?.absent) ? dailyTurno.absent : [];
  return { order, absent };
}

/**
 * Remove uma criança da daily route do dia (de todos os turnos).
 * Útil quando criança é desativada DURANTE o dia.
 */
export async function removeChildFromDailyRoute(dateKey, childId) {
  const ref = dailyDoc(dateKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  const updates = { updatedAt: serverTimestamp() };
  for (const period of PERIODS) {
    for (const direction of DIRECTIONS) {
      const k = turnoKey(period, direction);
      const turnoData = data[k];
      if (!turnoData) continue;
      const newOrder = (turnoData.order || []).filter((id) => id !== childId);
      const newAbsent = (turnoData.absent || []).filter((id) => id !== childId);
      updates[k] = { order: newOrder, absent: newAbsent };
    }
  }
  await updateDoc(ref, { ...updates, adminUid: uidAtual() });
}
