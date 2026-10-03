import { useEffect, useState } from 'react';
import { watchCriancasInativas } from '../services/criancasQueSairamService';
import { useAuth } from './useAuth';

/**
 * As crianças que SAÍRAM da turma deste motorista — a metade que
 * `useChildren` (só as ativas) não traz. Mesmo desenho dele: o uid vem da
 * sessão e o estado carrega a chave, para a troca de conta não mostrar a
 * lista da anterior.
 */
export function useCriancasInativas() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, lista: [] });

  useEffect(() => {
    if (!uid) return undefined;
    return watchCriancasInativas(
      uid,
      (lista) => setSnap({ chave: uid, lista }),
      () => setSnap({ chave: uid, lista: [] })
    );
  }, [uid]);

  return snap.chave === uid ? snap.lista : [];
}
