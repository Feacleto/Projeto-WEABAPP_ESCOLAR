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
import { auth, db } from '../firebase/config';
import { generateInviteCode } from '../utils/generateInviteCode';
import { inviteCodeExists } from './inviteCodeService';
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
    // Sem `|| 'male'`: completar o silêncio com um chute é como o campo
    // ficou errado em toda base antiga. Null é a resposta honesta pra
    // "ninguém respondeu", e o avatar sabe lidar com ela.
    gender: data.gender || null,
    birthDate: data.birthDate?.trim() || '', // YYYY-MM-DD
    parentName: data.parentName?.trim() || '',
    parentEmail: data.parentEmail?.trim().toLowerCase() || '',
    parentPhone: data.parentPhone?.trim() || '',
    parent2Name: data.parent2Name?.trim() || '',
    parent2Phone: data.parent2Phone?.trim() || '',
    address: data.address?.trim() || '',
    // ATENÇÃO: Number('') é 0 — sem o coalesce abaixo, uma criança salva sem
    // geocoding ficava em lat/lng 0,0 (golfo da Guiné) e o mapa desenhava
    // aquilo como se fosse a casa dela. Ausente tem que ser null.
    lat: toCoord(data.lat),
    lng: toCoord(data.lng),
    // true = endereço salvo sem coordenada; o tio resolve depois.
    geoPending: toCoord(data.lat) == null || toCoord(data.lng) == null,
    // O vínculo com a entidade escola. O nome e as coordenadas continuam
    // copiados aqui de propósito: é o que a rota usa e o que o pai vê, então
    // uma escola apagada por engano não apaga o endereço de entrega de
    // ninguém no meio da rota.
    schoolId: data.schoolId || null,
    school: data.school?.trim() || '',
    schoolAddress: data.schoolAddress?.trim() || '',
    schoolLat: toCoord(data.schoolLat),
    schoolLng: toCoord(data.schoolLng),
    // O COMBINADO COM O RESPONSÁVEL — a hora em que a perua encosta na porta
    // e a hora em que a criança volta. É o que organiza o dia do motorista e
    // o que o pai lê pra saber quando esperar. Vazio é aceitável no cadastro
    // (ele muitas vezes cadastra no meio da rota); até ser preenchido, a
    // criança opera com horário PRESUMIDO pelo período — e a tela cobra.
    horaPega: data.horaPega?.trim() || '',
    horaEntrega: data.horaEntrega?.trim() || '',
    // Preenchidos pelo RESPONSÁVEL na ficha da criança: o motorista não sabe
    // a turma nem a sala, e perguntar a ele seria perguntar pra quem não tem
    // a resposta.
    turma: '',
    sala: '',
    period: data.period || 'morning',
    pickupPeriod: data.pickupPeriod || data.period || 'morning',
    // A VOLTA SEGUE A IDA, e o default 'afternoon' era uma viagem inventada.
    //
    // Todo cadastro sem `dropoffPeriod` explícito nascia 'afternoon', e
    // 'afternoon' presume entrega às 17h30 (horariosService). Resultado: uma
    // criança da manhã, que volta ~12h30, ganhava uma volta fantasma às 17h30
    // no dia do motorista — e ao meio-dia, entregando de verdade, a tela
    // apontava pra ela.
    //
    // Sem `data.dropoffPeriod`, a volta é do MESMO período da ida: quem é
    // pego de manhã volta no fim da manhã. Continua chute, e continua saindo
    // com `presumido: true` pra tela cobrar a confirmação.
    dropoffPeriod:
      data.dropoffPeriod || data.pickupPeriod || data.period || 'morning',
    monthlyFee: Number(data.monthlyFee) || 0,
    dueDay: clampDueDay(data.dueDay),
    notes: data.notes?.trim() || '',
    inviteCode,
    inviteStatus: 'pending',
    parentUid: null,
    // DE QUEM É ESTA CRIANÇA — o vínculo que faltava.
    //
    // Sem este campo, `children` era uma coleção sem dono: as rules liberavam
    // qualquer `isAdmin()` a ler e escrever QUALQUER criança, e o segundo
    // motorista da plataforma leria o endereço, a escola e o telefone das
    // famílias do primeiro. Passava despercebido porque só existia um.
    //
    // O uid vem do login, e não de parâmetro: quem cadastra é quem opera, e
    // deixar isso configurável seria criar um jeito de cadastrar criança na
    // conta de outro motorista.
    adminUid: auth.currentUser?.uid || null,
    status: 'home',
    statusUpdatedAt: serverTimestamp(),
    active: true,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'children'), payload);

  // Aqui havia um `addChildToDefaultPlan`, que enfileirava a criança nos seis
  // turnos de `routePlans`. Saiu junto com os turnos: a fila não é mais uma
  // lista salva que precisa ser mantida em dia, é o resultado de ordenar quem
  // tem horário. Criança nova aparece na rota por existir, não por ter sido
  // inscrita — que era exatamente o passo que falhava calado.
  return { id: docRef.id, inviteCode };
}

export async function getChild(id) {
  const snap = await getDoc(doc(db, 'children', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Atualiza dados gerais (não usar pra mudar status — use updateChildStatus).
export async function updateChild(id, data) {
  const updates = { ...data };
  if ('lat' in updates) updates.lat = toCoord(updates.lat);
  if ('lng' in updates) updates.lng = toCoord(updates.lng);
  if ('schoolLat' in updates) updates.schoolLat = toCoord(updates.schoolLat);
  if ('schoolLng' in updates) updates.schoolLng = toCoord(updates.schoolLng);
  // Mantém geoPending coerente sempre que a coordenada de casa é tocada.
  if ('lat' in updates || 'lng' in updates) {
    updates.geoPending = updates.lat == null || updates.lng == null;
  }
  if (updates.monthlyFee != null) updates.monthlyFee = Number(updates.monthlyFee);
  if (updates.dueDay != null) updates.dueDay = clampDueDay(updates.dueDay);
  await updateDoc(doc(db, 'children', id), updates);
}

/**
 * Normaliza coordenada: string vazia, null, undefined e NaN viram null.
 * Nunca 0 — 0 é uma coordenada válida no meio do Atlântico e o mapa a desenha.
 */
function toCoord(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  // `active: false` basta: a fila do dia filtra por ele. Não há mais lista
  // salva de onde a criança precise ser retirada — e portanto não há mais
  // como ela sobrar numa rota depois de desativada.
}

/**
 * Subscribe à lista de crianças ativas DESTE motorista.
 *
 * O `adminUid` NÃO É OPCIONAL, e o motivo é o formato da negativa: as rules
 * exigem que a consulta prove o escopo, e uma consulta sem o filtro é
 * rejeitada INTEIRA — não vem "as que ele pode ver", vem erro de permissão e
 * a tela fica vazia. Sem uid, então, não adianta nem chamar: devolvemos lista
 * vazia e um unsubscribe inerte, que é o mesmo resultado sem gastar uma
 * consulta negada e sem poluir o console de quem for depurar outra coisa.
 *
 * Ordenação é client-side pra evitar índice composto no Firestore.
 */
export function watchActiveChildren(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'children'),
    where('adminUid', '==', adminUid),
    where('active', '==', true)
  );
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
