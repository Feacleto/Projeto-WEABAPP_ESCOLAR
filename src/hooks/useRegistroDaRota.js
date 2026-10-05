import { useEffect, useState } from 'react';
import { watchRegistroDaRota } from '../services/registroDaRotaService';

/**
 * Os eventos do registro da rota de hoje. `ligado` falso não abre escuta —
 * quem não tem auxiliar ativa não tem o que ler, e a leitura custa.
 */
export function useRegistroDaRota(motoristaUid, dateKey, ligado = true) {
  const chave = ligado && motoristaUid && dateKey ? `${motoristaUid}_${dateKey}` : null;
  const [snap, setSnap] = useState({ chave: null, eventos: [] });
  useEffect(() => {
    if (!chave) return undefined;
    return watchRegistroDaRota(motoristaUid, dateKey, (eventos) => setSnap({ chave, eventos }));
  }, [chave, motoristaUid, dateKey]);
  return snap.chave === chave ? snap.eventos : [];
}
