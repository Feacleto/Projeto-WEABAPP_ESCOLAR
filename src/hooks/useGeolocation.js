import { useState, useEffect, useCallback } from 'react';
import {
  startTracking,
  stopTracking,
  subscribePosition,
  isTracking,
} from '../services/locationService';
import { ligarRelogioDoTrial } from '../services/trialService';

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
      // O RELÓGIO DOS TRÊS MESES COMEÇA AQUI, e este é o único lugar.
      //
      // A primeira rota é o momento em que o produto começa a entregar —
      // antes dela não há posição no mapa nem aviso de chegada, e contar do
      // cadastro faria o motorista que conhece o app em dezembro chegar em
      // fevereiro com três semanas de teste.
      //
      // Sem esperar de propósito: a rota NÃO PODE aguardar por isto. O GPS
      // liga no meio-fio, às vezes sem sinal, com vinte famílias esperando a
      // perua — e o relógio do teste é problema da plataforma, não delas. O
      // service engole o próprio erro e a próxima rota tenta de novo; o pior
      // caso é o motorista ganhar um dia a mais.
      ligarRelogioDoTrial(driverUid);
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
