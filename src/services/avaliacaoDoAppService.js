import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { watchPlatformConfig } from './platformConfigService';

/**
 * A AVALIAÇÃO DO APP — a leitura da aba do dono (05/10/2026).
 *
 * Lê `feedbacks` COM TETO: o mais novo primeiro, no máximo 500. Quem filtra
 * por período e soma é `dominio/suporte/resumoDaAvaliacao.js`; aqui só se
 * busca. O teto existe porque a coleção cresce sem prazo e a aba abre a cada
 * visita do dono — "desde o começo" quer dizer "desde o começo do que foi
 * carregado", e a tela diz isso.
 *
 * ⚠️ SÓ O DONO LÊ `feedbacks` (rules). Chamada de tela de motorista ou de
 * família recebe `permission-denied`, e o certo é essa tela não existir. A
 * nota que a família dá ao tio (`avaliacoesDoTio`) é outra coleção e esta
 * função nunca a toca.
 */
export const MAX_FEEDBACKS = 500;

export async function listarAvaliacoesDoApp(max = MAX_FEEDBACKS) {
  const snap = await getDocs(
    query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O interruptor da pergunta (`platformConfig/app`), ao vivo. */
export function watchConfigDaAvaliacao(cb) {
  return watchPlatformConfig(cb);
}
