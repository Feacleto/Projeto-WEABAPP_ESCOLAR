import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { adminExists } from './inviteCodeService';
import { LEGAL_VERSION } from '../pages/legal/legalContent';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

// O link enviado pelo Firebase aponta de volta pra nossa rota /auth-action
// (em vez da página hospedada do Firebase em inglês). handleCodeInApp:true
// preserva o oobCode na query string ao invés de processá-lo automaticamente.
export async function resetPassword(email) {
  const actionCodeSettings = {
    url: `${window.location.origin}/auth-action`,
    handleCodeInApp: true,
  };
  return sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
}

// Valida o oobCode recebido na URL. Retorna o email associado ao código
// (útil pra mostrar "Redefinindo senha de fulano@...") ou lança se inválido/expirado.
export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode);
}

// Conclui o reset: salva a nova senha. Após isso, o oobCode fica inválido.
export async function confirmReset(oobCode, newPassword) {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

// Verifica e aplica códigos de outras ações (verificação de email, etc.).
export async function inspectActionCode(oobCode) {
  return checkActionCode(auth, oobCode);
}

export async function applyAuthActionCode(oobCode) {
  return applyActionCode(auth, oobCode);
}

// Lê o documento users/{uid}. Retorna null se ainda não existe (caso normal
// no instante seguinte ao createUserWithEmailAndPassword).
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Login com Google via popup. Apenas autentica — NÃO cria users/{uid}.
 * Usado em /login: caller verifica se profile existe; se não, faz logout
 * e orienta o usuário a usar /first-access com invite code.
 */
export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/**
 * NOTA: `signupWithInvite` e `signupWithGoogleInvite` foram removidas.
 *
 * Elas criavam conta E vinculavam a criança, duplicando o que
 * `authenticateAndRedeem` e `googleAndRedeem` fazem agora — e a versão
 * antiga do Google derrubava a sessão com erro quando a conta já existia,
 * o que quebrava justamente o pai adicionando o segundo filho.
 */

/**
 * Resgata um convite pra conta JÁ autenticada.
 *
 * Serve pros dois casos:
 *   - primeiro acesso (chamado por authenticateAndRedeem / googleAndRedeem)
 *   - pai já cadastrado adicionando um segundo filho
 *
 * Toda a validação e o vínculo acontecem no servidor.
 */
export async function redeemInvite({ inviteCode, name = '' }) {
  const fn = httpsCallable(functions, 'redeemInvite');
  try {
    const res = await fn({
      code: inviteCode,
      name,
      legalVersion: LEGAL_VERSION,
    });
    return res.data;
  } catch (err) {
    throw new Error(friendlyCallableError(err), { cause: err });
  }
}

/**
 * Traduz erro de callable pra mensagem que o usuário entende.
 * O Firebase entrega `functions/<code>` em err.code e a mensagem que a
 * função lançou em err.message — que já escrevemos em português.
 */
function friendlyCallableError(err) {
  const code = String(err?.code || '');
  if (code.includes('unauthenticated')) {
    return 'Sua sessão expirou. Entre novamente e tente de novo.';
  }
  if (code.includes('invalid-argument')) {
    return 'Código em formato inválido. Confira com o motorista.';
  }
  if (code.includes('not-found')) {
    return 'Convite não encontrado ou já usado. Peça um novo ao motorista.';
  }
  if (code.includes('unavailable') || code.includes('deadline')) {
    return 'Sem conexão com o servidor. Tente novamente em alguns segundos.';
  }
  return err?.message || 'Não foi possível usar este convite.';
}

/**
 * Entra OU cria conta com email/senha e resgata o convite — sem perguntar
 * ao usuário qual dos dois ele quer.
 *
 * POR QUE ASSIM
 * Obrigar o pai a escolher entre "criar conta" e "já tenho conta" é uma
 * decisão que ELE não tem como tomar com segurança: metade não lembra se
 * já cadastrou. Então tentamos criar; se o email já existe, entramos com a
 * mesma senha. Um par de campos cobre os dois caminhos.
 *
 * Retorna { user, created } — `created` diz se a conta nasceu agora.
 */
export async function authenticateAndRedeem({ inviteCode, email, password, name = '' }) {
  const cleanEmail = String(email || '').trim();
  let user;
  let created = false;

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    user = cred.user;
    created = true;
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      // Já tem conta: a mesma senha resolve. Se estiver errada, o erro que
      // sobe é de credencial inválida, e a tela oferece redefinir senha.
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      user = cred.user;
    } else {
      throw err;
    }
  }

  try {
    await redeemInvite({ inviteCode, name });
  } catch (err) {
    // Conta recém-criada que não conseguiu vincular fica em limbo:
    // autenticada, sem doc em users, travada no PrivateRoute sem
    // explicação. Melhor desfazer.
    if (created) {
      try {
        await user.delete();
      } catch (cleanupErr) {
        console.error('Falha ao limpar conta órfã:', cleanupErr);
      }
    }
    throw err;
  }

  return { user, created };
}

/**
 * Google + resgate do convite, tolerante a quem já tem conta.
 *
 * A versão antiga derrubava a sessão e mandava um erro quando a conta
 * Google já existia. Agora não: se já existe, apenas vinculamos a criança
 * — é o caso do pai adicionando o segundo filho.
 */
export async function googleAndRedeem({ inviteCode }) {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const existing = await getUserDoc(user.uid);

  try {
    await redeemInvite({ inviteCode, name: user.displayName || '' });
  } catch (err) {
    // Só apaga se a conta nasceu neste fluxo — nunca a conta Google de
    // alguém que já usava o app.
    if (!existing) {
      try {
        await user.delete();
      } catch (cleanupErr) {
        console.error('Falha ao limpar conta órfã:', cleanupErr);
      }
    }
    throw err;
  }

  return { user, created: !existing };
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

/**
 * Bootstrap do primeiro admin via Google. Mesmas regras do createFirstAdmin
 * (só funciona se appState/init não existir). Salva phone informado pelo usuário.
 */
export async function createFirstAdminWithGoogle({ phone }) {
  if (await adminExists()) {
    throw new Error(
      'Já existe um administrador. Use o login normal ou cadastre via Firebase Console.'
    );
  }

  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;

  try {
    await setDoc(doc(db, 'users', user.uid), {
      role: 'admin',
      name: user.displayName || '',
      email: user.email || '',
      phone: phone?.trim() || '',
      provider: 'google',
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'appState', 'init'), {
      hasAdmin: true,
      adminUid: user.uid,
      createdAt: serverTimestamp(),
    });

    return user;
  } catch (err) {
    try {
      const profile = await getUserDoc(user.uid);
      if (!profile) await user.delete();
    } catch (cleanupErr) {
      console.error('Falha ao limpar conta órfã:', cleanupErr);
    }
    throw err;
  }
}
