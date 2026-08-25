import { useEffect, useState } from 'react';
import { watchActiveChildren } from '../services/childrenService';
import { useAuth } from './useAuth';

/**
 * Mantém em estado a lista de crianças ativas DESTE motorista, com live
 * updates do Firestore. Use no painel do Tio. Unsubscribe automático.
 *
 * O UID VEM DAQUI, E NÃO DE QUEM CHAMA
 * São dez telas usando este hook. Passar o escopo por parâmetro em todas
 * significaria dez chances de alguém esquecer — e esquecer não dá erro de
 * compilação, dá lista vazia numa tela de rota, que se confunde com "nenhuma
 * criança cadastrada". O hook já é do painel do motorista; ler o uid da
 * sessão aqui deixa o escopo impossível de omitir.
 */
export function useChildren() {
  const { user } = useAuth();
  // O ESTADO CARREGA A CHAVE — mesmo padrão de useRide e usePayments.
  //
  // `setLoading(true)` e `setX(null)` no corpo do efeito é um render a mais e,
  // pior, deixa um quadro em que a tela já sabe que a chave mudou e ainda
  // mostra o dado da anterior. Comparar a chave na leitura fecha essa janela
  // sem tocar em estado dentro do efeito.
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, children: [], error: null });

  useEffect(() => {
    if (!uid) return undefined;
    const unsub = watchActiveChildren(
      uid,
      (list) => setSnap({ chave: uid, children: list, error: null }),
      (err) => setSnap({ chave: uid, children: [], error: err })
    );
    return unsub;
  }, [uid]);

  const naChave = snap.chave === uid;
  return {
    children: naChave ? snap.children : [],
    loading: uid ? !naChave : false,
    error: naChave ? snap.error : null,
  };
}
