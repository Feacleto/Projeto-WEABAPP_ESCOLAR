import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

/**
 * Reseta o estado do tutorial — usado pelo botão "Ver tutorial novamente".
 * Após resetar, o useEffect do layout exibe o modal de novo.
 */
export async function resetTutorial(uid) {
  return updateDoc(doc(db, 'users', uid), {
    tutorialDone: false,
  });
}
