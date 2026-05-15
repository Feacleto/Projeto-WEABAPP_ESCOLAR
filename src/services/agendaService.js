import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Cria uma notificação simples pro usuário-alvo. Usado pra avisar o pai
 * que tem aviso novo na agenda — fire-and-forget, erros não bloqueiam.
 */
async function pushNotification({ userId, type, title, body, meta = {} }) {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      body,
      ...meta,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[agenda] notificação falhou:', err);
  }
}

/**
 * "Agenda digital" — avisos do Tio pro Pai sobre uma criança específica
 * OU sobre todas as crianças de uma escola. Substitui o WhatsApp/papel.
 *
 * Cada entrada vive em `agendaEntries/{id}` com a forma:
 *
 *   {
 *     scope: 'child' | 'school',
 *     type: <TYPE>,                  // categoria (sick, conflict, …)
 *     message: string,               // texto livre (Tio pode editar o template)
 *     adminUid: string,
 *     // se scope = 'child':
 *     childId: string,
 *     childName: string,
 *     parentUid: string | null,      // facilita query do Pai
 *     // se scope = 'school':
 *     schoolName: string,
 *     createdAt: Timestamp
 *   }
 *
 * Visualização do Pai = mês corrente (resetado por filtro client-side).
 * Meses anteriores ficam acessíveis via índice (ainda existem no Firestore).
 */

export const AGENDA_COLLECTION = 'agendaEntries';

// Tipos pré-definidos com label + emoji + template. Tio escolhe um e o
// template aparece já preenchido — ele pode editar antes de enviar.
export const AGENDA_TYPES = {
  sick: {
    label: 'Criança não tá bem',
    emoji: '🤒',
    color: 'from-amber-500 to-orange-600',
    template: (name) =>
      `${name} não tá se sentindo bem hoje. Vale ficar atento(a) quando chegar em casa.`,
  },
  conflict: {
    label: 'Conflito / briga',
    emoji: '😡',
    color: 'from-rose-500 to-red-600',
    template: (name) =>
      `${name} se desentendeu com um colega hoje. Conversei com a turma — fica bom acompanhar em casa também.`,
  },
  read_agenda: {
    label: 'Professora pediu ler a agenda',
    emoji: '📓',
    color: 'from-blue-500 to-indigo-600',
    template: () =>
      'A professora pediu que vocês leiam a agenda da escola hoje. Tem aviso novo lá.',
  },
  teacher_request: {
    label: 'Professora pediu algo',
    emoji: '📋',
    color: 'from-violet-500 to-purple-600',
    template: () =>
      'A professora pediu um recado pra vocês. Verificar a agenda da escola pra ver o que é.',
  },
  meeting: {
    label: 'Reunião de pais',
    emoji: '👨‍👩‍👧',
    color: 'from-emerald-500 to-green-700',
    template: () =>
      'Vai ter reunião de pais. Confira o dia e horário na agenda da escola.',
  },
  event: {
    label: 'Evento da escola',
    emoji: '🎉',
    color: 'from-fuchsia-500 to-pink-600',
    template: () =>
      'A escola vai ter um evento. Detalhes na agenda — confirma se a criança vai participar.',
  },
  no_class: {
    label: 'Não vai ter aula',
    emoji: '🏫',
    color: 'from-slate-500 to-slate-700',
    template: () =>
      'A escola avisou que não vai ter aula. Confirma direitinho na agenda escolar.',
  },
  other: {
    label: 'Outro aviso',
    emoji: '✏️',
    color: 'from-cyan-500 to-blue-600',
    template: () => '',
  },
};

/**
 * Cria um aviso pra UMA criança. Notifica o pai dela em paralelo (não-bloq).
 *
 * @param {object} params
 * @param {string} params.adminUid
 * @param {object} params.child   — doc da criança ({ id, name, parentUid })
 * @param {string} params.type    — chave em AGENDA_TYPES
 * @param {string} params.message
 */
export async function createChildEntry({ adminUid, child, type, message }) {
  if (!adminUid) throw new Error('Sem adminUid.');
  if (!child?.id) throw new Error('Sem criança.');
  if (!type || !AGENDA_TYPES[type]) throw new Error('Tipo inválido.');

  const docRef = await addDoc(collection(db, AGENDA_COLLECTION), {
    scope: 'child',
    type,
    message: (message || '').trim().slice(0, 1500),
    adminUid,
    childId: child.id,
    childName: child.name || '',
    parentUid: child.parentUid || null,
    createdAt: serverTimestamp(),
  });

  // Notifica o pai (se vinculado). Fire-and-forget — agenda não pode falhar
  // se o sistema de notificação tiver problema.
  if (child.parentUid) {
    pushNotification({
      userId: child.parentUid,
      type: 'agenda_entry',
      title: `Novo aviso sobre ${child.name?.split(' ')[0] || 'a criança'}`,
      body: AGENDA_TYPES[type].label,
      meta: { agendaId: docRef.id, childId: child.id },
    });
  }

  return docRef.id;
}

/**
 * Cria um aviso geral pra TODAS as crianças de uma escola.
 * Pais com filhos nessa escola veem no caderno.
 *
 * @param {object} params
 * @param {string} params.adminUid
 * @param {string} params.schoolName
 * @param {string} params.type
 * @param {string} params.message
 * @param {Array<{parentUid: string}>} [params.childrenInSchool] — pra notificar
 */
export async function createSchoolEntry({
  adminUid,
  schoolName,
  type,
  message,
  childrenInSchool = [],
}) {
  if (!adminUid) throw new Error('Sem adminUid.');
  if (!schoolName?.trim()) throw new Error('Sem escola.');
  if (!type || !AGENDA_TYPES[type]) throw new Error('Tipo inválido.');

  const docRef = await addDoc(collection(db, AGENDA_COLLECTION), {
    scope: 'school',
    type,
    message: (message || '').trim().slice(0, 1500),
    adminUid,
    schoolName: schoolName.trim(),
    createdAt: serverTimestamp(),
  });

  // Notifica todos os pais com criança na escola. Erros individuais não
  // bloqueiam — caso pior, alguns pais não recebem push e veem só no app.
  const uniqueParents = [
    ...new Set(
      childrenInSchool.map((c) => c.parentUid).filter((u) => !!u)
    ),
  ];
  for (const parentUid of uniqueParents) {
    pushNotification({
      userId: parentUid,
      type: 'agenda_school_entry',
      title: 'Novo aviso da escola',
      body: `${AGENDA_TYPES[type].label} · ${schoolName}`,
      meta: { agendaId: docRef.id, schoolName },
    });
  }

  return docRef.id;
}

/**
 * Subscribe a TODAS as entradas da agenda (pro Tio ver o histórico).
 * Ordenado por data desc — Firestore exige índice composto se quiser
 * filtrar + ordenar. Como queremos só a lista geral, basta orderBy.
 */
export function watchAdminAgenda(adminUid, onUpdate, onError) {
  if (!adminUid) return () => {};
  const q = query(
    collection(db, AGENDA_COLLECTION),
    where('adminUid', '==', adminUid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate(list);
    },
    (err) => {
      console.error('watchAdminAgenda error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe às entradas relevantes pro Pai:
 *   - Específicas do filho (parentUid == uid)
 *   - Da escola do filho (scope == 'school' AND schoolName == school)
 *
 * Como o SDK do Firestore não suporta OR em campos diferentes, fazemos
 * 2 listeners e combinamos client-side.
 */
export function watchParentAgenda({ parentUid, schoolName }, onUpdate, onError) {
  if (!parentUid) return () => {};
  let childList = [];
  let schoolList = [];

  const emit = () => {
    const merged = [...childList, ...schoolList].sort((a, b) => {
      const ta = a.createdAt?.toDate?.() || new Date(0);
      const tb = b.createdAt?.toDate?.() || new Date(0);
      return tb - ta;
    });
    onUpdate(merged);
  };

  const unsubChild = onSnapshot(
    query(
      collection(db, AGENDA_COLLECTION),
      where('scope', '==', 'child'),
      where('parentUid', '==', parentUid),
      orderBy('createdAt', 'desc')
    ),
    (snap) => {
      childList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (err) => {
      console.error('watchParentAgenda (child) error:', err);
      if (onError) onError(err);
    }
  );

  let unsubSchool = () => {};
  if (schoolName) {
    unsubSchool = onSnapshot(
      query(
        collection(db, AGENDA_COLLECTION),
        where('scope', '==', 'school'),
        where('schoolName', '==', schoolName),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        schoolList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emit();
      },
      (err) => {
        console.error('watchParentAgenda (school) error:', err);
        if (onError) onError(err);
      }
    );
  }

  return () => {
    unsubChild();
    unsubSchool();
  };
}

/**
 * Filtra entradas pra mostrar só as do mês atual (reset mensal).
 * Demais ficam no "índice" pro pai navegar manualmente.
 */
export function filterByMonth(entries, year, month) {
  return entries.filter((e) => {
    const d = e.createdAt?.toDate?.();
    if (!d) return false;
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

/**
 * Agrupa entradas por chave "YYYY-MM" pra construir o índice de meses.
 * Retorna [{ key, year, month, count }] ordenado desc.
 */
export function groupByMonth(entries) {
  const map = new Map();
  for (const e of entries) {
    const d = e.createdAt?.toDate?.();
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map.get(key) || {
      key,
      year: d.getFullYear(),
      month: d.getMonth(),
      count: 0,
    };
    entry.count += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}
