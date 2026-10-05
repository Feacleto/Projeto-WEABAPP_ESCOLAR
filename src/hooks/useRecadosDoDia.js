import { useEffect, useState } from 'react';
import { watchRecadoDoDia, watchRecadosDoDiaDaTurma } from '../services/recadosDoDiaService';

/**
 * O recado do dia de UMA criança (a família): `undefined` enquanto carrega,
 * `null` sem recado, o documento quando há. Com a chave junto, para trocar
 * de filho não mostrar o recado do outro.
 */
export function useRecadoDoDia(childId, dateKey) {
  const chave = childId && dateKey ? `${dateKey}_${childId}` : null;
  const [snap, setSnap] = useState({ chave: null, recado: undefined });
  useEffect(() => {
    if (!chave) return undefined;
    return watchRecadoDoDia(dateKey, childId, (recado) => setSnap({ chave, recado }));
  }, [chave, dateKey, childId]);
  return snap.chave === chave ? snap.recado : undefined;
}

/** `{ [childId]: recado }` dos recados de hoje na turma do motorista. */
export function useRecadosDoDiaDaTurma(adminUid, dateKey) {
  const [porCrianca, setPorCrianca] = useState({});
  useEffect(() => watchRecadosDoDiaDaTurma(adminUid, dateKey, setPorCrianca), [adminUid, dateKey]);
  return porCrianca;
}
