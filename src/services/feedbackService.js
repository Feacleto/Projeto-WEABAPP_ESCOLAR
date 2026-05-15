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

export async function submitFeedback({
  uid,
  role,
  answers,
  comment,
  allowTestimonial = false,
  allowPhoto = false,
  authorName = null,
  authorPhotoURL = null,
}) {
  if (!uid) throw new Error('Sem uid.');
  await addDoc(collection(db, COLLECTION), {
    uid,
    role: role || 'parent',
    version: APP_VERSION,
    answers: answers || {},
    comment: (comment || '').trim().slice(0, 1000),
    // Permissões pra exibição pública na landing
    allowTestimonial: !!allowTestimonial,
    allowPhoto: !!allowPhoto,
    authorName: authorName || null,
    authorPhotoURL: authorPhotoURL || null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Lista feedbacks públicos pra exibir na landing como depoimentos.
 * Critério: rating >= 4 + comentário não vazio + allowTestimonial true.
 * Filtragem extra é client-side pra evitar índices compostos no Firestore.
 *
 * Retorna array com objetos { firstName, photoURL?, rating, comment }.
 */
export async function listPublicTestimonials(max = 12) {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('allowTestimonial', '==', true),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const list = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const rating = Number(d?.answers?.rating || 0);
      const comment = (d.comment || '').trim();
      if (rating < 4 || comment.length < 8) continue;
      list.push({
        id: doc.id,
        firstName: (d.authorName || '').split(' ')[0] || 'Anônimo',
        photoURL: d.allowPhoto ? d.authorPhotoURL || null : null,
        rating,
        comment,
        createdAt: d.createdAt?.toDate?.() || null,
        role: d.role,
      });
      if (list.length >= max) break;
    }
    return list;
  } catch (err) {
    console.error('listPublicTestimonials:', err);
    return [];
  }
}

/**
 * Agregado pra landing pública: média e contagem das avaliações de quem
 * autorizou aparecer publicamente (allowTestimonial == true). Não conta
 * avaliações privadas — a landing reflete só clientes que recomendam.
 */
export async function getPublicRatingStats() {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('allowTestimonial', '==', true),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    let total = 0;
    let count = 0;
    for (const doc of snap.docs) {
      const r = Number(doc.data()?.answers?.rating || 0);
      if (r >= 1 && r <= 5) {
        total += r;
        count += 1;
      }
    }
    return {
      count,
      average: count > 0 ? total / count : 0,
    };
  } catch (err) {
    console.error('getPublicRatingStats:', err);
    return { count: 0, average: 0 };
  }
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
