import { useEffect, useState } from 'react';
import {
  watchDailyAltPickup,
} from '../services/altPickupService';

/**
 * Indicação diária de "quem vai buscar a criança" pra um pai específico.
 */
export function useDailyAltPickup(dateKey, childId) {
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateKey || !childId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchDailyAltPickup(
      dateKey,
      childId,
      (data) => {
        setPickup(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [dateKey, childId]);

  return { pickup, loading };
}

