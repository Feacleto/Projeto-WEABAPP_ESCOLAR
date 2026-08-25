import { useState, useEffect, useCallback } from 'react';
import {
  startTracking,
  stopTracking,
  subscribePosition,
  isTracking,
} from '../services/locationService';

/**
 * Hook do lado do motorista (Tio): controla o tracking GPS.
 *
 * O watchPosition vive em locationService (nível de módulo) — o hook só
 * espelha o estado em React. Isso permite que o tracking continue rodando
 * quando o Tio navega entre abas do BottomNav (ex: pra atualizar o status
 * de uma criança durante a rota) sem reiniciar GPS.
 *
 * Retorna:
 *   - watching:  bool, se há tracking ativo neste device
 *   - position:  GeolocationPosition mais recente (sem throttle)
 *   - error:     erro do GPS (permissão negada, timeout, etc.)
 *   - stopping:  bool, durante o async stop
 *   - start(driverUid)
 *   - stop()
 */
export function useGeolocation() {
  const [watching, setWatching] = useState(() => isTracking());
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    // O `useState(() => isTracking())` acima JÁ lê o valor no mount, e o
    // mount acontece depois de qualquer outro componente ter iniciado o
    // rastreio. A linha `setWatching(isTracking())` que ficava aqui era
    // redundante e custava um render extra na tela que segura o GPS.
    const unsub = subscribePosition((payload) => {
      if (payload.position) {
        setPosition(payload.position);
        setError(null);
      } else if (payload.error) {
        setError(payload.error);
      } else {
        // payload com ambos null = stopTracking notificando "parou"
        setPosition(null);
      }
    });
    return unsub;
  }, []);

  const start = useCallback((driverUid) => {
    setError(null);
    try {
      startTracking(driverUid);
      setWatching(true);
    } catch (err) {
      setError(err);
    }
  }, []);

  const stop = useCallback(async () => {
    setStopping(true);
    try {
      await stopTracking();
      setWatching(false);
      setPosition(null);
    } catch (err) {
      setError(err);
    } finally {
      setStopping(false);
    }
  }, []);

  return { watching, position, error, stopping, start, stop };
}
