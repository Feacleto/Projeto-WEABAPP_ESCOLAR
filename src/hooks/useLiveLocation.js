import { useEffect, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Subscribe ao doc liveLocation/current via onSnapshot.
 *
 * Use no painel do Pai pra desenhar a perua no mapa em tempo real, e no
 * Dashboard do Tio pra mostrar o badge "rota ativa". A versão "lida" do
 * estado da rota é o que está no Firestore — o source of truth.
 *
 * Retorna { location, loading, error } onde location é null se ainda não
 * existir o doc (rota nunca foi iniciada).
 */
export function useLiveLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'liveLocation', 'current'),
      (snap) => {
        setLocation(snap.exists() ? snap.data() : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('useLiveLocation error:', err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { location, loading, error };
}
