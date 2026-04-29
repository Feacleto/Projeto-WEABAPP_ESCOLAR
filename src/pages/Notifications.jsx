import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { usePaymentsByParent } from '../hooks/usePayments';
import { useNotifications } from '../hooks/useNotifications';
import {
  markNotificationRead,
  markAllNotificationsRead,
  markAllDerivedRead,
} from '../services/notificationsService';
import { formatDateTime } from '../utils/formatters';

const TYPE_VISUAL = {
  payment_claimed: { Icon: Hourglass, color: 'text-primary bg-primary/10' },
  payment_confirmed: { Icon: CheckCircle2, color: 'text-success bg-success/10' },
  payment_due_5d: { Icon: CalendarClock, color: 'text-primary bg-primary/10' },
  payment_due_3d: { Icon: CalendarClock, color: 'text-warning bg-warning/10' },
  payment_due_0d: { Icon: Clock, color: 'text-warning bg-warning/10' },
  payment_overdue_3d: { Icon: AlertTriangle, color: 'text-danger bg-danger/10' },
  payment_overdue_7d: { Icon: AlertTriangle, color: 'text-danger bg-danger/10' },
};

/**
 * Página de Notificações compartilhada por tio e pai. O hook detecta o tipo
 * pelo `deriveFor` — só pais geram lembretes derivados de pagamento.
 */
export default function Notifications() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isParent = profile?.role === 'parent';

  // Pai: lê seus pagamentos pra derivar lembretes. Tio: payments=[] (não usa).
  const { payments } = usePaymentsByParent(isParent ? user?.uid : null);

  const { notifications, loading, refreshReads } = useNotifications({
    userId: user?.uid,
    payments: isParent ? payments : [],
    deriveFor: isParent ? 'parent' : 'admin',
  });

  // Auto-marca como lidas as que ele acabou de ver (com debounce de 1.5s)
  useEffect(() => {
    if (loading || notifications.length === 0) return;
    const t = setTimeout(async () => {
      const unreadDerived = notifications
        .filter((n) => n.derived && !n.isRead)
        .map((n) => n.id);
      const unreadStored = notifications.filter(
        (n) => !n.derived && !n.isRead
      );

      if (unreadDerived.length > 0) {
        markAllDerivedRead(unreadDerived);
      }
      if (unreadStored.length > 0) {
        await Promise.all(
          unreadStored.map((n) => markNotificationRead(n.id).catch(() => {}))
        );
      }
      if (unreadDerived.length > 0 || unreadStored.length > 0) {
        refreshReads();
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, refreshReads]);

  const onMarkAll = async () => {
    try {
      const unreadDerived = notifications
        .filter((n) => n.derived && !n.isRead)
        .map((n) => n.id);
      markAllDerivedRead(unreadDerived);
      await markAllNotificationsRead(user.uid);
      refreshReads();
      toast.success('Tudo marcado como lido.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao marcar como lidas.');
    }
  };

  const onClickNotif = (n) => {
    if (n.paymentId) {
      navigate(isParent ? '/pai/finance' : '/tio/finance');
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <>
      <Header
        title="Notificações"
        action={
          hasUnread ? (
            <button
              onClick={onMarkAll}
              className="text-primary tap p-1"
              aria-label="Marcar todas como lidas"
              title="Marcar todas como lidas"
            >
              <CheckCheck size={22} />
            </button>
          ) : null
        }
      />

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação"
            description={
              isParent
                ? 'Você verá aqui lembretes de vencimento e confirmações do motorista.'
                : 'Você verá aqui avisos de pagamentos informados pelos pais.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notif={n} onClick={() => onClickNotif(n)} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function NotificationItem({ notif, onClick }) {
  const visual = TYPE_VISUAL[notif.type] || {
    Icon: Bell,
    color: 'text-textMuted bg-gray-100',
  };
  const { Icon, color } = visual;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left flex gap-3 p-3 rounded-xl border tap ${
          notif.isRead
            ? 'bg-card border-gray-100'
            : 'bg-primary/5 border-primary/20'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text truncate">
              {notif.title}
            </p>
            {!notif.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          {notif.body && (
            <p className="text-xs text-textMuted mt-0.5 leading-snug">
              {notif.body}
            </p>
          )}
          <p className="text-[11px] text-textMuted mt-1">
            {formatDateTime(notif.createdAt)}
          </p>
        </div>
      </button>
    </li>
  );
}
