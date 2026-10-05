import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  minhaNotaDasAuxiliares,
  watchRecomendacoesQueEscrevi,
  watchRecomendacoesQueRecebi,
} from '../services/avaliacoesDaAuxiliarService';

/**
 * As recomendações do lado de quem está logado — o tio as que escreveu, ela
 * as que recebeu. `null` enquanto carrega; a lista depois, com a chave junto
 * (a troca de conta não mostra a lista da anterior).
 */
function useRecomendacoes(assinar) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, lista: null });
  useEffect(() => {
    if (!uid) return undefined;
    return assinar(uid, (lista) => setSnap({ chave: uid, lista }), () => setSnap({ chave: uid, lista: [] }));
  }, [uid, assinar]);
  return snap.chave === uid ? snap.lista : null;
}

export function useRecomendacoesQueEscrevi() {
  return useRecomendacoes(watchRecomendacoesQueEscrevi);
}

export function useRecomendacoesQueRecebi() {
  return useRecomendacoes(watchRecomendacoesQueRecebi);
}

/**
 * A nota das auxiliares, do lado do tio: `{ respostas, media | null }`, ou
 * `null` enquanto carrega ou se a chamada falhou (a tela só não mostra a linha).
 */
export function useNotaDasAuxiliares() {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    let vivo = true;
    minhaNotaDasAuxiliares()
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setDados(null));
    return () => {
      vivo = false;
    };
  }, []);
  return dados;
}
