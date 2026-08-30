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
import { playSound } from './soundService';
import { resolveAdminUid } from './notificationsService';

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
  // JÁ PEGUEI — o fato consumado, não o plano.
  //
  // O efeito na rota é o mesmo de `no-dropoff`: o motorista não busca à tarde.
  // Mas o responsável que está NA ESCOLA com a criança na mão não encontrava a
  // frase certa: "eu vou buscar à tarde" se lê como intenção, e ele acabava
  // não avisando — ou avisando por WhatsApp, fora do app, onde a rota não vê.
  ALREADY_PICKED: 'picked-up',
};

export const ABSENCE_LABELS = {
  full: 'Não vai hoje',
  'no-pickup': 'Pai vai levar de manhã',
  'no-dropoff': 'Pai vai buscar à tarde',
  'picked-up': 'Pai já pegou na escola',
};

export const ABSENCE_SHORT = {
  full: 'Falta',
  'no-pickup': 'Sem ida',
  'no-dropoff': 'Sem volta',
  'picked-up': 'Já pegou',
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
  adminUid,
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
    // DE QUEM É ESTA OPERAÇÃO. Vem da CRIANÇA, não da sessão: quem declara
    // costuma ser o responsável, e o uid dele não diz nada sobre qual
    // motorista precisa enxergar a falta.
    //
    // Sem este campo a rule de leitura só sabia perguntar `isAdmin()` — e aí
    // qualquer motorista lia as declarações das famílias de todos os outros.
    adminUid: adminUid || null,
    type,
    declaredBy,
    note,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Som de "gravou". Mora no serviço e não na tela porque o mesmo fato é
  // disparado de mais de um lugar — e um som que só toca em metade dos
  // caminhos ensina que o silêncio às vezes também é sucesso.
  playSound('salvo');
  return id;
}

export async function removeAbsence({ dateKey, childId }) {
  const id = buildId(dateKey, childId);
  await deleteDoc(doc(db, 'absenceDeclarations', id));
}

/**
 * Subscribe a todas as ausências de uma data (uso do Tio).
 */
export function watchAbsencesByDate(dateKey, adminUid, onUpdate, onError) {
  if (!dateKey || !adminUid) {
    onUpdate([]);
    return () => {};
  }
  // O `adminUid` no WHERE não é otimização, é requisito.
  //
  // A rule de leitura passou a exigir que a declaração seja deste motorista, e
  // rule que exige campo obriga a CONSULTA a provar o filtro: sem esta linha o
  // Firestore recusa a consulta INTEIRA e a tela vem vazia — que na lista de
  // rota se confunde com "ninguém faltou hoje", que é a pior forma de errar
  // aqui: o motorista deixa de buscar quem avisou que não vai, ou espera na
  // porta de quem não vem.
  const q = query(
    collection(db, 'absenceDeclarations'),
    where('adminUid', '==', adminUid),
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
 * Todas as ausências de um INTERVALO de dias, deste motorista.
 *
 * POR QUE UM INTERVALO E NÃO UM DIA
 * O app só sabia responder "quem falta hoje". Mas o aviso útil é o que chega
 * ANTES: o pai avisa na segunda que na quinta tem consulta, e o motorista só
 * descobria na quinta de manhã — sem tempo de reorganizar nada.
 *
 * A consulta leva `adminUid` E o intervalo de `dateKey`. Os dois filtros são
 * obrigatórios: o primeiro porque a regra exige (rule que pede campo obriga a
 * consulta a provar o filtro), e o índice composto (adminUid, dateKey) já
 * existe pra isso — uma igualdade mais um intervalo cabem nele.
 */
export function watchAbsencesRange(adminUid, deKey, ateKey, onUpdate, onError) {
  if (!adminUid || !deKey || !ateKey) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'absenceDeclarations'),
    where('adminUid', '==', adminUid),
    where('dateKey', '>=', deKey),
    where('dateKey', '<=', ateKey)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchAbsencesRange error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe a TODAS as ausências de uma criança ao longo do tempo.
 * Usado pelo Pai pra ver histórico de faltas (semana/mês).
 * Filtragem por período é feita no client.
 */
export function watchAllAbsencesForChild(childId, onUpdate, onError) {
  if (!childId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'absenceDeclarations'),
    where('childId', '==', childId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordena por dateKey desc (mais recentes primeiro)
      list.sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchAllAbsencesForChild error:', err);
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
 *
 * Quem é o destinatário é determinado por `declaredBy`:
 *   - 'parent' → o motorista DESTA criança (`child.adminUid`)
 *   - 'admin'  → pai (usa parentUid passado em child)
 *
 * O DESTINATÁRIO SAI DA CRIANÇA, E NÃO DE `appState/init`.
 * Até 30/08/2026 esta função lia `appState/init.adminUid` — um ponteiro ÚNICO
 * pra plataforma inteira. Com um motorista dava no mesmo; com dois, o efeito
 * não era entregar ao motorista errado, era não entregar a ninguém: a rule de
 * `notifications` (firestore.rules:869-872) exige que quem não é motorista só
 * escreva para o próprio `userDoc().adminUid`. A escrita era NEGADA, caía no
 * `catch` abaixo, e a tela do pai mostrava sucesso — o motorista nunca ficava
 * sabendo da falta e o pai achava que tinha avisado.
 *
 * `child.adminUid` é a verdade por criança e o chamador já tem; o fallback
 * `resolveAdminUid()` lê o doc do próprio responsável, que também é por
 * inquilino. Nenhum dos dois é global.
 *
 * A resolução acontece DENTRO da função pra evitar race condition (se o pai
 * abre o sheet antes do useAdminProfile carregar, a notif ainda funciona).
 */
export async function notifyAbsence({
  child, // { parentUid, name, adminUid }
  type,
  dateKey,
  declaredBy,
}) {
  // Pai declarando → o motorista DESTA criança.
  // Tio declarando → o pai vinculado.
  const targetUid =
    declaredBy === 'parent'
      ? child?.adminUid || (await resolveAdminUid())
      : child?.parentUid || null;

  if (!targetUid) {
    console.warn('[notifyAbsence] Sem destinatário — notif não criada.');
    return;
  }

  const typeLabel = ABSENCE_LABELS[type] || 'Ausência registrada';
  const who = declaredBy === 'parent' ? 'O responsável' : 'O motorista';
  const dateLabel = formatDateLabel(dateKey);
  const childName = child?.name || 'Aluno';

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
