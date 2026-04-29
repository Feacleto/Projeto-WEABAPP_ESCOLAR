import { useEffect, useState } from 'react';
import {
  watchPaymentsByMonth,
  watchPaymentsByChild,
  watchPaymentsByParent,
} from '../services/paymentsService';

/**
 * Subscribe aos pagamentos de um mês (admin).
 */
export function usePaymentsByMonth(monthKey) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!monthKey) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchPaymentsByMonth(
      monthKey,
      (list) => {
        setPayments(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [monthKey]);

  return { payments, loading, error };
}

/**
 * Subscribe ao histórico de pagamentos de uma criança (admin).
 */
export function usePaymentsByChild(childId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!childId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchPaymentsByChild(
      childId,
      (list) => {
        setPayments(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [childId]);

  return { payments, loading, error };
}

/**
 * Subscribe aos pagamentos do responsável autenticado (Pai).
 * Filtra por parentUid (compatível com firestore.rules).
 */
export function usePaymentsByParent(parentUid) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!parentUid) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchPaymentsByParent(
      parentUid,
      (list) => {
        setPayments(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [parentUid]);

  return { payments, loading, error };
}
