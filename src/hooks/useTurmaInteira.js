import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { watchTurmaInteira } from '../services/childrenService';

/**
 * A turma inteira deste motorista, ativas e as que saíram (03/10/2026) — ver
 * `watchTurmaInteira`. O uid vem da sessão, como em `useChildren`, para o
 * escopo não depender de quem chama.
 */
export function useTurmaInteira() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, criancas: [] });

  useEffect(() => {
    if (!uid) return undefined;
    return watchTurmaInteira(
      uid,
      (criancas) => setSnap({ chave: uid, criancas }),
      () => setSnap({ chave: uid, criancas: [] })
    );
  }, [uid]);

  const naChave = snap.chave === uid;
  return { criancas: naChave ? snap.criancas : [], loading: uid ? !naChave : false };
}
