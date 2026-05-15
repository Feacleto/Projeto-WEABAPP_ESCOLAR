import { useEffect, useMemo, useRef, useState } from 'react';
import {
  watchUserNotifications,
  deriveParentReminders,
  getDerivedReadIds,
} from '../services/notificationsService';
import { playSound } from '../services/soundService';

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

  // Trackeia ids já vistos pra detectar notif nova → dispara som apropriado.
  // Inicializa com o snapshot atual (não dispara som na 1ª carga).
  const seenIdsRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStored([]);
      setLoading(false);
      seenIdsRef.current = null;
      return;
    }
    setLoading(true);
    const unsub = watchUserNotifications(
      userId,
      (list) => {
        // Detecta notifs novas comparando com o snapshot anterior
        if (seenIdsRef.current != null) {
          const previous = seenIdsRef.current;
          const newOnes = list.filter((n) => !previous.has(n.id));
          if (newOnes.length > 0) {
            // Toca som apropriado por tipo. payment_confirmed → pay,
            // payment_claimed → cash_in. Outros → notify genérico.
            const first = newOnes[0];
            if (first.type === 'payment_confirmed') {
              playSound('pay');
            } else if (first.type === 'payment_claimed') {
              playSound('cash_in');
            } else {
              playSound('notify');
            }
          }
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));

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
