import { doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
 * Subscribe ao doc do admin (atualiza UI quando ele troca a chave PIX).
 */
/**
 * O motorista de UMA criança — o dono da chave PIX que o responsável vê.
 *
 * Lia `appState/init.adminUid`, o ponteiro ÚNICO da plataforma. Com um
 * motorista dava no mesmo; com dois, o responsável do motorista B abria o
 * financeiro, via a chave PIX do motorista A e PAGAVA NELA. O dinheiro ia pra
 * conta errada e nada no sistema saberia — não há campo no pagamento que ligue
 * a cobrança a uma chave.
 *
 * O uid agora vem de quem chama, e a fonte é sempre `child.adminUid` (ou
 * `payment.adminUid`): o vínculo real, por criança.
 */
export function watchAdminProfile(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', adminUid),
    (snap) => onUpdate(snap.exists() ? { uid: adminUid, ...snap.data() } : null),
    (err) => {
      console.error('watchAdminProfile:', err);
      if (onError) onError(err);
    }
  );
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
