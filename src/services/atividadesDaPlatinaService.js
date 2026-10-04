import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { CATALOGO_PLATINA } from '../dominio/identidade/nivel.js';

/**
 * AS ATIVIDADES DE PLATINA, DO LADO DO DONO (docs/niveis.md, seção 5).
 *
 * O `nivelService` lê só as ATIVAS, que é o que o motorista precisa. O dono
 * precisa do histórico inteiro — é ele que responde "já lancei uma este mês?",
 * e a resposta mora nas encerradas também. Por isso este arquivo é separado.
 *
 * ⚠️ A VERIFICAÇÃO É SEMPRE UMA CHAVE DO CATÁLOGO. Não existe campo livre de
 * "condição": atividade com chave desconhecida não existe para a régua
 * (`avaliarAtividades` a descarta), e é essa construção que garante a regra 4
 * — nenhuma atividade pede pagar, contratar, indicar ou meta de família,
 * porque nenhuma chave do catálogo lê nada disso. Recusar aqui é só para o
 * dono não lançar uma atividade que ninguém consegue cumprir.
 *
 * Quem impede de verdade são as rules (só o dono escreve).
 */

const COL = 'atividadesDaPlatina';

const TITULO_MAX = 60;
const DESCRICAO_MAX = 160;

/** Todas as atividades, ativas e encerradas, da mais nova para a mais antiga. */
export function watchTodasAtividades(cb, onError) {
  return onSnapshot(
    query(collection(db, COL), orderBy('lancadaEm', 'desc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          // A escrita recém-feita tem `lancadaEm` pendente; sem a estimativa
          // ela chegaria nula e a linha apareceria sem data e sem prazo.
          ...d.data({ serverTimestamps: 'estimate' }),
        }))
      ),
    onError
  );
}

export async function lancarAtividade({ titulo, descricao, verificacao }) {
  if (!Object.prototype.hasOwnProperty.call(CATALOGO_PLATINA, verificacao)) {
    throw new Error('Verificação fora do catálogo.');
  }
  const t = String(titulo || '').trim().slice(0, TITULO_MAX);
  const d = String(descricao || '').trim().slice(0, DESCRICAO_MAX);
  const ref = await addDoc(collection(db, COL), {
    titulo: t || CATALOGO_PLATINA[verificacao].titulo,
    descricao: d,
    verificacao,
    lancadaEm: serverTimestamp(),
    ativa: true,
  });
  return ref.id;
}

export async function encerrarAtividade(id) {
  if (!id) throw new Error('Atividade sem id.');
  await updateDoc(doc(db, COL, id), { ativa: false });
}

export const LIMITES_DA_ATIVIDADE = { TITULO_MAX, DESCRICAO_MAX };
