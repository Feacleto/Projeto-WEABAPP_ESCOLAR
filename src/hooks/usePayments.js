import { useEffect, useMemo, useState } from 'react';
import {
  watchPaymentsByMonth,
  watchPaymentsByChild,
  watchPaymentsByParent,
} from '../services/paymentsService';
import { useAuth } from './useAuth';

/**
 * Subscribe aos pagamentos de um mês (admin).
 */
export function usePaymentsByMonth(monthKey) {
  const { user } = useAuth();
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
      user?.uid,
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
  }, [monthKey, user?.uid]);

  return { payments, loading, error };
}

/**
 * Subscribe ao histórico de pagamentos de uma criança.
 *
 * SERVE OS DOIS PAPÉIS, E O ESCOPO SAI DAQUI
 * A mesma tela de histórico (`ChildPaymentHistory`) é montada no app do
 * motorista e no do responsável. As rules liberam um pelo `adminUid` e o
 * outro pelo `parentUid`, então o filtro tem que acompanhar quem está
 * olhando: com o filtro errado a consulta é NEGADA e a tela fica vazia
 * justamente pra quem tinha direito de ver.
 *
 * A decisão mora no hook e não na tela porque a tela já recebe `role` como
 * vocabulário (muda a palavra do status), e misturar "como eu falo" com "o
 * que eu posso ler" é como esses dois se desencontram numa refatoração.
 */
export function usePaymentsByChild(childId) {
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const escopo = useMemo(
    () =>
      profile?.role === 'parent'
        ? { parentUid: user?.uid }
        : { adminUid: user?.uid },
    [profile?.role, user?.uid]
  );

  useEffect(() => {
    if (!childId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchPaymentsByChild(
      childId,
      escopo,
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
  }, [childId, escopo]);

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
