import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O KANBAN DO DONO, do lado do app.
 *
 * O QUADRO É DE TODOS OS DONOS: a regra é `isOwner()`, o papel, e não quem
 * criou. `criadoPor` guarda quem abriu o tema, mas não dá a ele exclusividade —
 * dois donos mexem no mesmo quadro, como no registro de ações.
 *
 * O documento é o tema inteiro, atividades dentro: o que se grava é sempre o
 * tema novo calculado pela régua, nunca um pedaço — um array de até 50 itens
 * não aceita atualização parcial sem corrida.
 */
export const TEMAS_NO_PAINEL = 200;

/** 'AAAA-MM-DD' no fuso de Brasília — o dia do dono, não o do servidor. */
export function hojeEmBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export function observarTemas(onUpdate, onError) {
  return onSnapshot(
    query(collection(db, 'kanbanDoDono'), limit(TEMAS_NO_PAINEL)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[admin] kanban não carregou:', err);
      if (onError) onError(err);
    }
  );
}

export async function criarTemaNoBanco(tema) {
  const campos = { ...tema };
  delete campos.id;
  const ref = await addDoc(collection(db, 'kanbanDoDono'), {
    ...campos,
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarTemaNoBanco(tema) {
  const campos = { ...tema };
  const { id } = campos;
  delete campos.id;
  delete campos.atualizadoEm;
  await setDoc(doc(db, 'kanbanDoDono', id), { ...campos, atualizadoEm: serverTimestamp() });
}

export async function apagarTemaNoBanco(id) {
  await deleteDoc(doc(db, 'kanbanDoDono', id));
}
