import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  watchAbsencesByDate,
  watchAbsenceForChild,
  watchAllAbsencesForChild,
} from '../services/absencesService';

/**
 * Lista de ausências declaradas em uma data (Tio).
 * Retorna array de docs + mapa por childId pra lookup rápido.
 */
export function useAbsences(dateKey) {
  // O uid vem daqui e não de quem chama, igual ao `useChildren`: são três
  // telas usando este hook, e esquecer o escopo não dá erro de compilação —
  // dá lista vazia, que se confunde com "ninguém faltou".
  const { user } = useAuth();
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateKey || !user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAbsences([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchAbsencesByDate(
      dateKey,
      user.uid,
      (list) => {
        setAbsences(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [dateKey, user?.uid]);

  // Mapa childId -> absence pro consumo rápido na lista de rota
  const byChildId = {};
  for (const a of absences) byChildId[a.childId] = a;

  return { absences, byChildId, loading };
}

/**
 * Ausência declarada pra uma criança específica em uma data (Pai).
 */
export function useAbsenceForChild(dateKey, childId) {
  const [absence, setAbsence] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateKey || !childId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAbsence(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchAbsenceForChild(
      dateKey,
      childId,
      (doc) => {
        setAbsence(doc);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [dateKey, childId]);

  return { absence, loading };
}

/**
 * Subscribe a todas as ausências históricas de uma criança (uso do Pai).
 * Retorna o array completo — caller filtra por período (semana/mês).
 */
export function useChildAbsenceHistory(childId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchAllAbsencesForChild(
      childId,
      (list) => {
        setHistory(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [childId]);

  return { history, loading };
}
