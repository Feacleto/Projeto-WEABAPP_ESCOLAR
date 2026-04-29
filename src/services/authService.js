import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { findChildByInviteCode, adminExists } from './inviteCodeService';

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  return credential.user;
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

// Lê o documento users/{uid}. Retorna null se ainda não existe (caso normal
// no instante seguinte ao createUserWithEmailAndPassword).
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Cadastro do pai via código de convite.
 *
 * IMPORTANTE: ordem dos passos foi escolhida pra alinhar com as Firestore
 * Security Rules (que exigem auth pra ler children):
 *   1. createUserWithEmailAndPassword (auto-login, sem profile ainda)
 *   2. findChildByInviteCode (agora autenticado, rule permite ler pending)
 *   3. setDoc users/{uid} com role:'parent' + childId
 *   4. setDoc children/{childId} merge {parentUid, inviteStatus:'used'}
 *
 * Se qualquer passo após o (1) falhar, tentamos apagar a conta auth recém-
 * criada pra evitar "limbo" (best-effort — não relança erro do cleanup).
 */
export async function signupWithInvite({ inviteCode, email, password, name }) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const user = credential.user;

  try {
    const child = await findChildByInviteCode(inviteCode);

    await setDoc(doc(db, 'users', user.uid), {
      role: 'parent',
      name: name?.trim() || child.parentName || '',
      email: email.trim(),
      phone: child.parentPhone || '',
      childId: child.id,
      createdAt: serverTimestamp(),
    });

    await setDoc(
      doc(db, 'children', child.id),
      {
        inviteStatus: 'used',
        parentUid: user.uid,
      },
      { merge: true }
    );

    return user;
  } catch (err) {
    // Cleanup best-effort: usuário recém-criado deleta a si mesmo.
    try {
      await user.delete();
    } catch (cleanupErr) {
      console.error('Falha ao limpar conta órfã:', cleanupErr);
    }
    throw err;
  }
}

/**
 * Bootstrap do primeiro administrador.
 *
 * Só funciona enquanto appState/init não existir. Após criar a conta admin,
 * grava appState/init com hasAdmin: true (público) — isso gata o link
 * "Configurar primeiro administrador" no Login pra futuras visitas.
 */
export async function createFirstAdmin({ email, password, name, phone }) {
  if (await adminExists()) {
    throw new Error(
      'Já existe um administrador. Use o login normal ou cadastre via Firebase Console.'
    );
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const user = credential.user;

  try {
    await setDoc(doc(db, 'users', user.uid), {
      role: 'admin',
      name: name?.trim() || '',
      email: email.trim(),
      phone: phone?.trim() || '',
      createdAt: serverTimestamp(),
    });

    // Marca o app como inicializado — gates futuras chamadas a /first-admin
    await setDoc(doc(db, 'appState', 'init'), {
      hasAdmin: true,
      adminUid: user.uid,
      createdAt: serverTimestamp(),
    });

    return user;
  } catch (err) {
    try {
      await user.delete();
    } catch (cleanupErr) {
      console.error('Falha ao limpar conta órfã:', cleanupErr);
    }
    throw err;
  }
}
