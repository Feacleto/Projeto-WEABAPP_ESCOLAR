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

/**
 * Teto do depoimento PÚBLICO (o que vai pra home). 200 caracteres não é
 * capricho de layout: é o que cabe num card lido de relance, e é curto o
 * bastante pra o motorista escrever no celular sem desistir no meio. O
 * comentário privado (que só a gente lê) continua aceitando 1000 — ali o
 * limite é do banco, não do olho de quem passa pela home.
 */
export const PUBLIC_COMMENT_MAX = 200;

/**
 * Primeiro nome apenas.
 *
 * O documento de feedback é público quando o autor autoriza depoimento, e
 * a tela nunca mostrou mais que o primeiro nome. Guardar o resto era
 * expor sobrenome de pai e de motorista na internet sem necessidade.
 */
function firstNameOf(full) {
  const first = String(full || '').trim().split(/\s+/)[0];
  return first || null;
}
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
    // Quem autorizou publicar tem o texto cortado no limite público — o
    // corte acontece aqui, e não só no <textarea>, porque o campo pode ser
    // preenchido por autofill, colar ou versão antiga do app em cache.
    comment: (comment || '')
      .trim()
      .slice(0, allowTestimonial ? PUBLIC_COMMENT_MAX : 1000),
    // Permissões pra exibição pública na landing
    allowTestimonial: !!allowTestimonial,
    allowPhoto: !!allowPhoto,

    // SÓ O PRIMEIRO NOME, e a foto SÓ se ele autorizou.
    //
    // Este documento é legível por QUALQUER UM, sem login, quando
    // allowTestimonial é true — é assim que a landing mostra depoimento
    // pra visitante. Guardar o nome completo aqui publicava o nome
    // inteiro de um pai ou do motorista na internet, mesmo a tela
    // exibindo apenas o primeiro. O mesmo pra foto: guardar a URL sem
    // checar allowPhoto expunha o rosto de quem não autorizou.
    //
    // Não perdemos nada: listPublicTestimonials sempre derivou só o
    // primeiro nome. O resto era dado guardado sem uso e com risco.
    authorFirstName: firstNameOf(authorName),
    authorPhotoURL: allowPhoto ? authorPhotoURL || null : null,
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
export async function listPublicTestimonials(max = 12, { role = null } = {}) {
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
      // Na home só entra depoimento de MOTORISTA: a página fala com quem
      // dirige, e elogio de pai ali soa como propaganda pro público errado.
      // A avaliação do pai continua sendo coletada — ela vira métrica, não
      // vitrine (é o que o painel do admin lê).
      if (role && d.role !== role) continue;
      list.push({
        id: doc.id,
        // authorName (nome completo) é o campo LEGADO: documentos
        // gravados antes desta correção ainda o têm. Preferimos o campo
        // novo e caímos no antigo cortando no primeiro nome.
        firstName:
          d.authorFirstName ||
          (d.authorName || '').split(' ')[0] ||
          'Anônimo',
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
export async function getPublicRatingStats({ role = null } = {}) {
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
      const d = doc.data();
      if (role && d.role !== role) continue;
      const r = Number(d?.answers?.rating || 0);
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
