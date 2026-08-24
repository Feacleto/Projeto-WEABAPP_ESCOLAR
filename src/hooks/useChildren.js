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
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = watchActiveChildren(
      user?.uid,
      (list) => {
        setChildren(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid]);

  return { children, loading, error };
}
