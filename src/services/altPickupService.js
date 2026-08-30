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
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { resolveAdminUid } from './notificationsService';

/**
 * Responsáveis alternativos — quem pode buscar a criança no lugar do pai.
 *
 * Estrutura:
 *   children/{childId}.altResponsibles  — o ÚLTIMO avulso, e só ele
 *     [{ id, name, phone, relationship }]  (array de no máximo 1)
 *
 *   altPickups/{dateKey}_{childId}      — indicação diária de quem vai pegar
 *     { dateKey, childId, parentUid, name, phone, relationship, createdAt }
 *
 * - Pai grava o último avulso em `altResponsibles` (sobrescreve o anterior).
 * - Pai cria/atualiza/remove `altPickups` quando precisa indicar outra pessoa
 *   pra um dia específico.
 * - Tio só lê — vê no card da criança "Hoje quem pega: X · (11) 99999-9999".
 */

function buildId(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

// ─────────────── O último avulso (em children/{childId}) ───────────────

/**
 * GUARDA UM SÓ — o último avulso, e nada antes dele.
 *
 * Era uma LISTA que só crescia (`altResponsibles`, com arrayUnion), mais uma
 * tela pra gerenciá-la. Duas coisas estavam erradas nisso:
 *
 *   1. Ninguém mantém lista. O pai indicava a vizinha uma vez, a tia noutra,
 *      o cuidador noutra — e seis meses depois escolhia entre nove nomes,
 *      metade deles gente que não pega mais a criança. A tela de "gerenciar"
 *      existia pra limpar uma bagunça que o próprio desenho criava.
 *   2. É dado de TERCEIRO. Nome e telefone de quem não é usuário do app,
 *      entregue pra resolver uma tarde. Guardar nove desses pra sempre é
 *      acumular o que ninguém consentiu em deixar guardado — e a LGPD chama
 *      isso de retenção sem finalidade.
 *
 * O caso real é quase sempre a mesma pessoa duas vezes seguidas: a avó que
 * pega quando o pai não pode. Um slot cobre isso e o resto é digitar de novo,
 * que leva quinze segundos e é o comportamento certo pra quem só vai pegar a
 * criança uma vez.
 *
 * ESCREVE NO MESMO CAMPO `altResponsibles`, e de propósito: as rules já
 * liberam exatamente essa chave pro responsável (`hasOnly(['altResponsibles'])`).
 * Guardar um array de UM item mantém a permissão intacta e apaga o histórico
 * na mesma escrita -- sobrescrever é o que faz o banco esquecer os anteriores.
 */
export async function lembrarAvulso(childId, data) {
  if (!childId) throw new Error('Sem childId.');
  const unico = {
    id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name?.trim() || '',
    phone: data.phone?.trim() || '',
    relationship: data.relationship?.trim() || '',
  };
  // Array de um item, e não `arrayUnion`: a substituição é o recurso.
  await updateDoc(doc(db, 'children', childId), { altResponsibles: [unico] });
  return unico;
}

/** O último avulso guardado, ou `null`. Lê o mesmo campo, pega o primeiro. */
export function ultimoAvulso(child) {
  const lista = child?.altResponsibles;
  return Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
}

/** Esquece o último avulso. O pai decide não guardar mais aquele nome. */
export async function esquecerAvulso(childId) {
  if (!childId) return;
  await updateDoc(doc(db, 'children', childId), { altResponsibles: [] });
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
  adminUid,
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
    // DE QUEM É ESTA OPERAÇÃO — mesmo desenho de absenceDeclarations, e
    // pelo mesmo motivo: vem da CRIANÇA, não da sessão. Quem indica quem
    // vai buscar costuma ser o responsável, e o uid dele não diz qual
    // motorista precisa enxergar a troca.
    //
    // Sem o campo, a rule só sabia perguntar `isAdmin()` — e aí qualquer
    // motorista lia NOME E TELEFONE de quem busca a criança das famílias
    // de todos os outros. É dado de terceiro, que o pai entregou pensando
    // num motorista só.
    adminUid: adminUid || null,
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
 *
 * O DESTINATÁRIO SAI DA CRIANÇA, E NÃO DE `appState/init`.
 * Mesmo conserto de `notifyAbsence`, pelo mesmo motivo: o ponteiro global
 * resolve UM motorista pra plataforma inteira, e a rule de `notifications`
 * (firestore.rules:869-872) só deixa quem não é motorista escrever para o
 * próprio `userDoc().adminUid`. Com dois motoristas a escrita era negada e
 * caía no `catch` abaixo — o pai avisava que outra pessoa ia buscar a criança
 * e o motorista nunca recebia. Esse é o aviso que não pode se perder.
 *
 * `adminUidDaCrianca` vem do chamador (que já tem a criança); o fallback lê o
 * doc do próprio responsável. Nenhum dos dois é global.
 */
export async function notifyAltPickup({
  childName,
  name,
  phone,
  dateKey,
  adminUid: adminUidDaCrianca,
}) {
  try {
    const adminUid = adminUidDaCrianca || (await resolveAdminUid());
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
