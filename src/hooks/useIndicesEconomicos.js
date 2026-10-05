import { useEffect, useState } from 'react';
import { watchIndicesEconomicos } from '../services/indicesService';

/**
 * IPCA, Selic e dólar, reativos (05/10/2026, "Economia do mês"):
 * `{ indices: { ipca, selic, dolar }, carregando }`. Cada índice é `null`
 * quando não há documento gravado ou a leitura falhou — a tela diz que o
 * número ainda não chegou, nunca mostra 0.
 */
export function useIndicesEconomicos() {
  const [estado, setEstado] = useState({
    indices: { ipca: null, selic: null, dolar: null },
    carregando: true,
  });
  useEffect(
    () => watchIndicesEconomicos((indices) => setEstado({ indices, carregando: false })),
    []
  );
  return estado;
}
