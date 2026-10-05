import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { watchSubstitutas, watchFaltasDasAuxiliares } from '../services/substitutasService';

/**
 * As substitutas e as faltas das auxiliares do motorista logado (fase 5).
 * `null` enquanto carrega, lista depois — com a chave junto, para a troca de
 * conta não mostrar a lista da conta anterior (o mesmo cuidado de
 * `useAuxiliaresDoMotorista`).
 */
export function useSubstitutas() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [subs, setSubs] = useState({ chave: null, lista: null });
  const [faltas, setFaltas] = useState({ chave: null, lista: null });
  useEffect(() => {
    if (!uid) return undefined;
    return watchSubstitutas(uid, (lista) => setSubs({ chave: uid, lista }), () => setSubs({ chave: uid, lista: [] }));
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return watchFaltasDasAuxiliares(uid, (lista) => setFaltas({ chave: uid, lista }), () => setFaltas({ chave: uid, lista: [] }));
  }, [uid]);
  return {
    substitutas: subs.chave === uid ? subs.lista : null,
    faltas: faltas.chave === uid ? faltas.lista : null,
  };
}
