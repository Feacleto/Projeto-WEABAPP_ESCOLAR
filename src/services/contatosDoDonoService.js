import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

/**
 * O HISTÓRICO DE CONTATOS DO DONO (`contatosDoDono`).
 *
 * É texto livre do dono SOBRE o motorista, como a nota interna. O motorista é
 * titular e pode pedir, pela LGPD art. 18, o que foi anotado sobre ele, pelo
 * contato@alobuzinou.com, como no registroDoDono; o texto que cita terceiros
 * sai editado ao responder.
 *
 * APPEND-ONLY: aqui só existe listar e anotar. Corrigir é anotar de novo,
 * com `corrige` apontando o id da errada (a errada fica) —
 * um histórico que se reescreve deixa de provar o que foi dito. Só o dono lê
 * (as rules são de outra frente).
 */

const COLECAO = 'contatosDoDono';
export const MAX_CONTATOS = 300;

export async function listarContatos() {
  const s = await getDocs(
    query(collection(db, COLECAO), orderBy('em', 'desc'), limit(MAX_CONTATOS))
  );
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Os sete campos, e só eles — o documento não aceita mais nada. */
export function anotarContato({ motoristaUid, canal, texto, retomarEm = null, corrige = null }) {
  const donoUid = auth.currentUser?.uid;
  if (!donoUid) return Promise.reject(new Error('Sem sessão.'));
  return addDoc(collection(db, COLECAO), {
    motoristaUid,
    canal,
    texto: String(texto).trim(),
    retomarEm: retomarEm || null,
    corrige: corrige || null,
    em: serverTimestamp(),
    donoUid,
  });
}
