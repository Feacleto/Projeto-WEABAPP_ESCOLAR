import { useEffect, useState } from 'react';
import { watchIpca } from '../services/indicesService';

/**
 * O IPCA de 12 meses, reativo. `{ ipca, carregando }` — `ipca` é
 * `{ mes: 'AAAA-MM', ipca12m, fonte, atualizadoEm }` ou `null` quando não há
 * índice gravado (ou a leitura falhou): a tela some com a linha, não mostra 0.
 */
export function useIpca() {
  const [estado, setEstado] = useState({ ipca: null, carregando: true });
  useEffect(
    () => watchIpca((ipca) => setEstado({ ipca, carregando: false })),
    []
  );
  return estado;
}
