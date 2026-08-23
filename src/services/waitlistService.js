import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase/config';

/**
 * Listas de espera / interesse — formulários públicos da landing.
 *
 * Como o Firestore exige auth pra writes (rules), fazemos `signInAnonymously`
 * antes do submit caso o usuário não esteja logado. Isso permite captar
 * leads sem exigir cadastro completo, e mantém as rules apertadas.
 *
 * O admin vê os leads via console do Firebase ou (futuramente) numa tela
 * privada — a leitura está restrita a `isAdmin()` nas rules.
 */

async function ensureSignedIn() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

export async function submitDriverWaitlist({ name, email, phone, city, message }) {
  await ensureSignedIn();
  await addDoc(collection(db, 'waitlistDrivers'), {
    name: name?.trim() || '',
    email: email?.trim().toLowerCase() || '',
    phone: phone?.trim() || '',
    city: city?.trim() || '',
    message: message?.trim() || '',
    createdAt: serverTimestamp(),
  });
}

export async function submitParentWaitlist({
  name,
  email,
  phone,
  city,
  childName,
  message,
}) {
  await ensureSignedIn();
  await addDoc(collection(db, 'waitlistParents'), {
    name: name?.trim() || '',
    email: email?.trim().toLowerCase() || '',
    phone: phone?.trim() || '',
    city: city?.trim() || '',
    childName: childName?.trim() || '',
    message: message?.trim() || '',
    createdAt: serverTimestamp(),
  });
}

// ============================================================================
// Leitura pelo admin — leads de motoristas interessados
// ============================================================================

/**
 * Observa os motoristas que pediram acesso, mais recentes primeiro.
 *
 * `orderBy('createdAt')` sozinho não exige índice composto (campo único).
 * Rules: `waitlistDrivers` libera read só pra isAdmin().
 *
 * Retorna função de unsubscribe.
 */
export function watchDriverLeads(onUpdate, onError) {
  const q = query(
    collection(db, 'waitlistDrivers'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchDriverLeads:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Marca/desmarca um lead como já contatado. Só admin (rules).
 * Guardamos quem falou e quando pra não perder o histórico.
 */
export async function setLeadContacted(id, contacted, adminUid) {
  if (!id) throw new Error('Sem id do lead.');
  await updateDoc(doc(db, 'waitlistDrivers', id), {
    contacted: !!contacted,
    contactedAt: contacted ? serverTimestamp() : null,
    contactedBy: contacted ? adminUid || null : null,
  });
}
