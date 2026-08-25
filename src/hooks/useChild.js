import { useEffect, useState } from 'react';
import { watchChild } from '../services/childrenService';

/**
 * Subscribe a uma criança específica via onSnapshot.
 * Use no painel do Pai pra acompanhar status em tempo real.
 *
 * Retorna { child, loading, error } onde child é null quando não encontrado
 * ou quando id não foi passado.
 */
export function useChild(id) {
  // O ESTADO CARREGA A CHAVE — mesmo padrão de useRide e usePayments.
  //
  // `setLoading(true)` e `setX(null)` no corpo do efeito é um render a mais e,
  // pior, deixa um quadro em que a tela já sabe que a chave mudou e ainda
  // mostra o dado da anterior. Comparar a chave na leitura fecha essa janela
  // sem tocar em estado dentro do efeito.
  const [snap, setSnap] = useState({ chave: null, child: null, error: null });

  useEffect(() => {
    if (!id) return undefined;
    return watchChild(
      id,
      (data) => setSnap({ chave: id, child: data, error: null }),
      (err) => setSnap({ chave: id, child: null, error: err })
    );
  }, [id]);

  const naChave = snap.chave === id;
  return {
    child: naChave ? snap.child : null,
    loading: id ? !naChave : false,
    error: naChave ? snap.error : null,
  };
}
