import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O INTERESSE — a pesquisa que mata ou justifica uma fase inteira.
 *
 * ── ELA É UMA PERGUNTA, NUNCA UM ANÚNCIO
 * `docs/negocio.md`: *"não anunciar antes de existir — prometer data para um
 * autônomo e não cumprir custa a confiança que é a visão da empresa"*. Este
 * service registra que alguém levantou a mão; ele não promete nada, e nenhuma
 * tela que o consome pode prometer.
 *
 * ── POR QUE O REGISTRO É POR PESSOA E NÃO UM CONTADOR
 * Um contador responde "quantos querem" e para aí. O que decide a fase é
 * **quem** — se os cinco interessados forem os cinco maiores da base, a
 * conversa é outra que se forem cinco de uma criança cada. O id é o uid, então
 * marcar duas vezes não conta duas vezes.
 *
 * ── O ID CARREGA O ASSUNTO
 * `{uid}_{assunto}`. Hoje só existe `cartao`, e o formato existe para a próxima
 * pergunta não precisar de coleção nova — pesquisa que exige migração é
 * pesquisa que ninguém faz.
 */

const COL = 'interesses';

const ID = (uid, assunto) => `${uid}_${assunto}`;

/** Ele levantou a mão. Idempotente: marcar de novo não conta duas vezes. */
export async function registrarInteresse(uid, assunto = 'cartao') {
  if (!uid) throw new Error('Sem motorista.');
  await setDoc(doc(db, COL, ID(uid, assunto)), {
    tioUid: uid,
    assunto,
    em: serverTimestamp(),
  });
}

/** O interesse DESTE motorista, para a tela dele não repetir a pergunta. */
export function watchInteresse(uid, cb, onError, assunto = 'cartao') {
  return onSnapshot(
    doc(db, COL, ID(uid, assunto)),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

/** Quem levantou a mão — a leitura do dono. */
export async function listarInteresses() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
