import { useEffect, useMemo, useState } from 'react';
import {
  watchUserNotifications,
  deriveParentReminders,
  getDerivedReadIds,
} from '../services/notificationsService';

/**
 * Combina notificações persistidas do Firestore + lembretes derivados dos
 * pagamentos (pré/pós-vencimento). Resolve "lidas" usando:
 *   - readAt do doc, pra eventos
 *   - localStorage, pra lembretes derivados (não tem doc no Firestore)
 *
 * Re-renderiza quando o conjunto de pagamentos muda — assim os lembretes
 * derivados acompanham (ex: pagamento confirmado deixa de gerar lembrete).
 */
export function useNotifications({ userId, payments = [], deriveFor = 'parent' }) {
  const [stored, setStored] = useState([]);
  const [loading, setLoading] = useState(true);
  // Bump pra forçar re-cálculo de derivados após "marcar tudo como lido".
  const [readBump, setReadBump] = useState(0);

  useEffect(() => {
    if (!userId) {
      setStored([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchUserNotifications(
      userId,
      (list) => {
        setStored(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId]);

  const derived = useMemo(() => {
    if (deriveFor !== 'parent') return [];
    return deriveParentReminders(payments);
  }, [deriveFor, payments]);

  const merged = useMemo(() => {
    const readIds = getDerivedReadIds();
    const all = [
      ...stored.map((n) => ({ ...n, isRead: !!n.readAt })),
      ...derived.map((n) => ({ ...n, isRead: readIds.has(n.id) })),
    ];
    all.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    return all;
    // readBump força recomputo após marcar como lido localmente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, derived, readBump]);

  const unreadCount = useMemo(
    () => merged.filter((n) => !n.isRead).length,
    [merged]
  );

  const refreshReads = () => setReadBump((v) => v + 1);

  return { notifications: merged, loading, unreadCount, refreshReads };
}
