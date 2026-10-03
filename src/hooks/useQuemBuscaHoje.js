import { useEffect, useState } from 'react';
import { watchQuemBuscaHoje } from '../services/altPickupService';

/** { [childId]: { name, phone, relationship } } de quem busca hoje, na turma do motorista. */
export function useQuemBuscaHoje(adminUid, dateKey) {
  const [porCrianca, setPorCrianca] = useState({});
  useEffect(() => watchQuemBuscaHoje(adminUid, dateKey, setPorCrianca), [adminUid, dateKey]);
  return porCrianca;
}
