import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR — o caminho do app até o servidor
 * (05/10/2026). Escrever é SEMPRE callable (`functions/lib/avaliacoesDaAuxiliar.js`):
 * as rules das duas coleções são `allow write: if false`.
 *
 * Leitura: só as recomendações, e só as do próprio lado — o tio as que
 * escreveu, ela as que recebeu. A consulta leva `removida == false` porque a
 * regra só deixa passar a lista que PROVA essa condição (regra não é filtro).
 * As notas que ela dá ao tio ninguém lê pelo app: o tio recebe só a média
 * (`minhaNotaDasAuxiliares`), e o documento é da equipe.
 */

async function chamar(nome, dados, oQueFazia) {
  exigirCloud(oQueFazia);
  try {
    const { data } = await httpsCallable(functions, nome)(dados);
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, oQueFazia), { cause: err });
  }
}

export function recomendarAuxiliar({ auxiliarUid, pontos, frase }) {
  return chamar('recomendarAuxiliar', { auxiliarUid, pontos, frase }, 'enviar a recomendação');
}

export function retirarRecomendacao(auxiliarUid) {
  return chamar('retirarRecomendacao', { auxiliarUid }, 'retirar a recomendação');
}

/** acao: 'aprovar' | 'ocultar' | 'apagar' */
export function responderRecomendacao(motoristaUid, acao) {
  return chamar('responderRecomendacao', { motoristaUid, acao }, 'responder à recomendação');
}

export function avaliarTio(motoristaUid, estrelas) {
  return chamar('avaliarTio', { motoristaUid, estrelas }, 'salvar a nota');
}

/** `{ respostas, media | null }` — a média só com 3 auxiliares diferentes. */
export function minhaNotaDasAuxiliares() {
  return chamar('minhaNotaDasAuxiliares', {}, 'ver a nota das auxiliares');
}

function watchRecomendacoes(campo, uid, onUpdate, onError) {
  if (!uid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'recomendacoesDeAuxiliar'), where(campo, '==', uid), where('removida', '==', false)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchRecomendacoes:', err);
      onError?.(err);
    }
  );
}

/** As que o tio escreveu (uma por auxiliar). */
export function watchRecomendacoesQueEscrevi(motoristaUid, onUpdate, onError) {
  return watchRecomendacoes('motoristaUid', motoristaUid, onUpdate, onError);
}

/** As que ela recebeu (uma por tio). */
export function watchRecomendacoesQueRecebi(auxiliarUid, onUpdate, onError) {
  return watchRecomendacoes('auxiliarUid', auxiliarUid, onUpdate, onError);
}
