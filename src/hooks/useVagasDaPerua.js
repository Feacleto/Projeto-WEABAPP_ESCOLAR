import { useEffect, useState } from 'react';
import { watchVagasDaPerua } from '../services/configFinanceiroService';
import { useAuth } from './useAuth';

/**
 * As vagas da perua DESTE motorista (05/10/2026).
 *
 * `vagas`: número quando ele já disse, `null` quando não disse, `undefined`
 * enquanto não se sabe (carregando, erro, ou "não existe" vindo do cache) —
 * ver `watchVagasDaPerua`. Quem decide abrir o passo do primeiro acesso
 * precisa dessa diferença; quem só desenha a perua esconde nos dois casos.
 *
 * Só para o motorista: `configFinanceiro` é dele, e a família e a auxiliar
 * não veem vagas.
 */
export function useVagasDaPerua() {
  const { user, profile } = useAuth();
  const uid = profile?.role === 'admin' ? user?.uid || null : null;
  const [snap, setSnap] = useState({ chave: null, vagas: undefined });

  useEffect(() => {
    if (!uid) return undefined;
    return watchVagasDaPerua(uid, (vagas) => setSnap({ chave: uid, vagas }));
  }, [uid]);

  return { vagas: uid && snap.chave === uid ? snap.vagas : undefined };
}
