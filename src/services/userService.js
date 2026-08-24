import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Marca que o usuário concluiu o tutorial de boas-vindas.
 *
 * Esse update é permitido pelas Firestore rules: o dono do doc users/{uid}
 * pode atualizar campos arbitrários desde que não mude o role.
 */
export async function markTutorialDone(uid) {
  return updateDoc(doc(db, 'users', uid), {
    tutorialDone: true,
    tutorialCompletedAt: serverTimestamp(),
  });
}

// ============================================================================
// PIX (admin/tio)
// ============================================================================

export const PIX_KEY_TYPES = {
  phone: { label: 'Celular', placeholder: '(11) 99999-9999' },
  email: { label: 'Email', placeholder: 'tio@email.com' },
  random: {
    label: 'Chave aleatória',
    placeholder: '12345678-1234-1234-1234-123456789012',
  },
};

export async function setAdminPixKey(adminUid, { pixKey, pixKeyType }) {
  await updateDoc(doc(db, 'users', adminUid), {
    pixKey: pixKey?.trim() || null,
    pixKeyType: pixKeyType || null,
  });
}

export async function clearAdminPixKey(adminUid) {
  await updateDoc(doc(db, 'users', adminUid), {
    pixKey: null,
    pixKeyType: null,
  });
}

/**
 * Busca o doc do tio (admin) pra que o pai consiga ver chave PIX e telefone.
 * Lê appState/init pra pegar o adminUid (público), depois lê users/{adminUid}.
 *
 * IMPORTANTE: as Firestore rules atuais permitem 'get' em users/{uid} apenas
 * pro próprio dono ou admin. Pro pai conseguir ler o doc do tio, precisamos
 * relaxar a rule (feito em firestore.rules).
 */
export async function getAdminProfile() {
  const initSnap = await getDoc(doc(db, 'appState', 'init'));
  if (!initSnap.exists()) return null;
  const adminUid = initSnap.data().adminUid;
  if (!adminUid) return null;

  const userSnap = await getDoc(doc(db, 'users', adminUid));
  if (!userSnap.exists()) return null;
  return { uid: adminUid, ...userSnap.data() };
}

/**
 * Subscribe ao doc do admin (atualiza UI quando ele troca a chave PIX).
 */
export function watchAdminProfile(onUpdate, onError) {
  let unsubUser = null;

  getDoc(doc(db, 'appState', 'init'))
    .then((initSnap) => {
      if (!initSnap.exists()) {
        onUpdate(null);
        return;
      }
      const adminUid = initSnap.data().adminUid;
      if (!adminUid) {
        onUpdate(null);
        return;
      }
      unsubUser = onSnapshot(
        doc(db, 'users', adminUid),
        (snap) => {
          if (snap.exists()) {
            onUpdate({ uid: adminUid, ...snap.data() });
          } else {
            onUpdate(null);
          }
        },
        (err) => {
          console.error('watchAdminProfile error:', err);
          if (onError) onError(err);
        }
      );
    })
    .catch((err) => {
      console.error('watchAdminProfile init error:', err);
      if (onError) onError(err);
    });

  return () => {
    if (unsubUser) unsubUser();
  };
}

export function validatePixKey(type, value) {
  const v = (value || '').trim();
  if (!v) return 'Informe a chave PIX.';

  switch (type) {
    case 'phone': {
      const digits = v.replace(/\D/g, '');
      if (digits.length !== 10 && digits.length !== 11) {
        return 'Celular inválido. Use DDD + número (10 ou 11 dígitos).';
      }
      return null;
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Email inválido.';
    case 'random': {
      const uuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      return uuid.test(v)
        ? null
        : 'Chave aleatória deve seguir o formato UUID (32 caracteres com hífens).';
    }
    default:
      return 'Tipo de chave inválido.';
  }
}

/**
 * Normaliza a chave pra exibir e copiar (ex: telefone com +55).
 * Se for outro tipo, retorna o valor sem alteração.
 */
export function normalizePixKey(type, value) {
  const v = (value || '').trim();
  if (!v) return v;
  if (type === 'phone') {
    const digits = v.replace(/\D/g, '');
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }
  return v;
}
