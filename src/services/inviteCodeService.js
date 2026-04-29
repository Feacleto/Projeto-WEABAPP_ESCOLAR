import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Busca a criança por invite code, exigindo inviteStatus = 'pending'.
 *
 * O filtro inviteStatus alinha com firestore.rules: signed-in users só
 * leem children quando inviteStatus == 'pending'. Códigos já usados retornam
 * empty (mensagem genérica) — UX aceitável e evita listar children alheios.
 *
 * Retorna { id, ...data } da criança ou lança erro descritivo.
 */
export async function findChildByInviteCode(rawCode) {
  const code = (rawCode || '').trim().toUpperCase();
  if (!/^TN\d{4}$/.test(code)) {
    throw new Error(
      'Código inválido. Use o formato TN + 4 dígitos (ex: TN4582).'
    );
  }

  const q = query(
    collection(db, 'children'),
    where('inviteCode', '==', code),
    where('inviteStatus', '==', 'pending'),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Código não encontrado ou já utilizado.');
  }

  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

/**
 * Verifica se já existe ao menos um administrador no app.
 *
 * Lê o doc público appState/init (criado por createFirstAdmin).
 * Não consulta a coleção users — assim podemos manter as rules estritas.
 */
export async function adminExists() {
  const snap = await getDoc(doc(db, 'appState', 'init'));
  return snap.exists() && snap.data().hasAdmin === true;
}

/**
 * Verifica se um inviteCode específico já existe em qualquer children doc.
 * Usado pelo admin ao gerar novos códigos pra evitar colisão.
 */
export async function inviteCodeExists(code) {
  const q = query(
    collection(db, 'children'),
    where('inviteCode', '==', code),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
