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
  const [child, setChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setChild(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchChild(
      id,
      (data) => {
        setChild(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [id]);

  return { child, loading, error };
}
