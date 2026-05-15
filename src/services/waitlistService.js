import {
  collection,
  addDoc,
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
