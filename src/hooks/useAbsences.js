import { useEffect, useState } from 'react';
import {
  watchAbsencesByDate,
  watchAbsenceForChild,
} from '../services/absencesService';

/**
 * Lista de ausências declaradas em uma data (Tio).
 * Retorna array de docs + mapa por childId pra lookup rápido.
 */
export function useAbsences(dateKey) {
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dateKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAbsences([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchAbsencesByDate(
      dateKey,
      (list) => {
        setAbsences(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [dateKey]);

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
