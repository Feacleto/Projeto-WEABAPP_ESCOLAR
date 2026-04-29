import { useEffect, useState } from 'react';
import { watchActiveChildren } from '../services/childrenService';

/**
 * Mantém em estado a lista de crianças ativas, com live updates do Firestore.
 * Use no painel do Tio. O unsubscribe é automático no unmount.
 */
export function useChildren() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = watchActiveChildren(
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
  }, []);

  return { children, loading, error };
}
