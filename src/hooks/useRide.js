import { useEffect, useState } from 'react';
import { watchRide } from '../services/ridesService';

/**
 * A viagem de hoje de uma criança — horas de cada marco e posição na fila.
 *
 * Existe porque o responsável não consegue derivar nenhuma das duas coisas:
 * a hora real de cada etapa só o motorista registra, e a posição na fila é
 * feita das outras crianças, que ele não lê (nem deve).
 */
export function useRide(childId, dateKey) {
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId || !dateKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRide(null);
      setLoading(false);
      return;
    }
    const unsub = watchRide(
      childId,
      dateKey,
      (doc) => {
        setRide(doc);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [childId, dateKey]);

  return { ride, loading };
}
