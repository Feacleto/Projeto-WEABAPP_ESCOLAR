import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { APP_VERSION } from '../version';

/**
 * Coleta de feedback do usuário sobre o app. Salva em `feedbacks/`:
 *
 *   {
 *     uid, role, version, answers: { [key]: value }, comment, createdAt
 *   }
 *
 * Cada usuário pode mandar várias avaliações (o tempo passa, opinião muda).
 * No client a gente checa se já mandou alguma pra mostrar "Você já avaliou
 * antes — pode mandar uma nova se quiser" em vez do convite original.
 */

const COLLECTION = 'feedbacks';

export async function submitFeedback({ uid, role, answers, comment }) {
  if (!uid) throw new Error('Sem uid.');
  await addDoc(collection(db, COLLECTION), {
    uid,
    role: role || 'parent',
    version: APP_VERSION,
    answers: answers || {},
    comment: (comment || '').trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

/**
 * Retorna a data do último feedback enviado por esse usuário, ou null.
 * Usado pra mudar o copy do botão e mostrar "última avaliação foi em…".
 */
export async function getLastFeedbackAt(uid) {
  if (!uid) return null;
  try {
    const q = query(
      collection(db, COLLECTION),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return data.createdAt?.toDate?.() || null;
  } catch (err) {
    console.error('getLastFeedbackAt:', err);
    return null;
  }
}
