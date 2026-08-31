import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../common/EmptyState';
import Skeleton from '../common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useNotifications } from '../../hooks/useNotifications';
import {
  markNotificationRead,
  markAllNotificationsRead,
  markAllDerivedRead,
} from '../../services/notificationsService';
import { formatRelativeTime } from '../../compartilhado/formatters';

const TYPE_VISUAL = {
  payment_claimed: { Icon: Hourglass, color: 'text-primary bg-primary/10' },
  payment_confirmed: { Icon: CheckCircle2, color: 'text-accentText bg-accent/10' },
  payment_due_5d: { Icon: CalendarClock, color: 'text-primary bg-primary/10' },
  payment_due_3d: { Icon: CalendarClock, color: 'text-warning bg-warning/10' },
  payment_due_0d: { Icon: Clock, color: 'text-warning bg-warning/10' },
  payment_overdue_3d: { Icon: AlertTriangle, color: 'text-danger bg-danger/10' },
  payment_overdue_7d: { Icon: AlertTriangle, color: 'text-danger bg-danger/10' },
};

// Quantas notificações mostrar de cara. "Ver mais" carrega de 6 em 6.
const INITIAL_PAGE_SIZE = 6;
const PAGE_INCREMENT = 6;

// Cores do pill "Hoje / Ontem / Há X dias" — sinaliza recência em uma piscadela.
const TONE_STYLES = {
  today: 'bg-primaryChip text-primary border border-primaryBorder',
  yesterday: 'bg-warningChip text-warningText border border-warningBorder',
  recent: 'bg-infoSoft text-infoText border border-infoBorder',
  older: 'bg-neutro text-textMuted border border-border',
};

/**
 * Página de Notificações compartilhada por tio e pai. O hook detecta o tipo
 * pelo `deriveFor` — só pais geram lembretes derivados de pagamento.
 */
/**
 * UM CONTEÚDO, DUAS CASCAS.
 *
 * O sino vive no cabeçalho de TODAS as telas do app. Tocar nele navegava
 * pra cá — e aí o motorista, que estava no meio da lista de crianças com um
 * filtro aplicado e a rolagem no meio, perdia tudo isso pra ler três linhas.
 * Voltar devolvia a tela, mas não o lugar.
 *
 * Agora o sino abre a FOLHA (ver NotificationsSheet no fim deste arquivo): o
 * conteúdo por trás continua exatamente onde estava, e fechar é um toque.
 *
 * A ROTA NÃO MORREU, e não podia morrer: notificação pushada abre
 * `/tio/notifications` direto, sem tela por baixo pra servir de fundo — uma
 * folha flutuando sobre nada seria um erro de desenho. Então a página segue
 * existindo, com cabeçalho e seta, pra quem chega de fora.
 *
 * As duas cascas renderizam o MESMO `NotificationsBody`. Não há duas
 * listas pra manter em sincronia; há uma, montada em dois lugares.
 */
export default function NotificationsBody({ onNavigate }) {
  const { user, profile } = useAuth();
  const isParent = profile?.role === 'parent';
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

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

  /**
   * CLICAR NA NOTIFICAÇÃO LEVA PRO ASSUNTO DELA.
   *
   * Só pagamento tinha destino; o resto era texto morto. Quem recebia "Novo
   * aviso sobre a Ana" tocava, não acontecia nada, e ia procurar o recado no
   * caderno pelo caminho longo — quando não desistia. Aviso que não leva a
   * lugar nenhum ensina a não tocar em aviso.
   */
  const onClickNotif = (n) => {
    if (n.paymentId) {
      onNavigate(isParent ? '/pai/finance' : '/tio/finance');
      return;
    }

    // Recados da agenda: o caderno do responsável é uma folha na home dele,
    // não uma rota — então o destino é a home com um pedido de abertura, que
    // o `PaiNotebookFAB` lê.
    if (
      n.type === 'agenda_entry' ||
      n.type === 'agenda_school_entry' ||
      n.type === 'agenda_broadcast'
    ) {
      onNavigate(isParent ? '/pai' : '/tio/agenda', { abrirCaderno: true });
      return;
    }

    // Chegou na escola / chegou em casa → a home, que é onde o tracker mostra
    // o percurso com as horas.
    if (n.type === 'child_arrived_home' || n.type === 'child_arrived_school') {
      onNavigate('/pai');
      return;
    }

    // A confirmação de véspera leva pra home do responsável, que é onde o
    // cartão âmbar "amanhã: não vai — continua?" está esperando com os dois
    // botões. Levar pra qualquer outro lugar obrigaria ele a procurar.
    if (n.type === 'absence_confirm') {
      onNavigate('/pai');
      return;
    }

    // Falta declarada e responsável alternativo são coisas que mudam a ROTA
    // do motorista — e é na rota que ele precisa ver o efeito.
    if (n.type === 'absence_declared' || n.type === 'alt_pickup') {
      onNavigate(isParent ? '/pai' : '/tio');
      return;
    }

    if (n.type === 'school_no_class') {
      onNavigate(isParent ? '/pai' : '/tio/semana');
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <>
      {hasUnread && (
        <button
          type="button"
          onClick={onMarkAll}
          className="tap mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary"
        >
          <CheckCheck size={15} />
          Marcar todas como lidas
        </button>
      )}

      <div>
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
          <>
            <ul className="space-y-2">
              {notifications.slice(0, visibleCount).map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onClick={() => onClickNotif(n)}
                />
              ))}
            </ul>
            {visibleCount < notifications.length && (
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((c) => c + PAGE_INCREMENT)
                }
                className="tap mt-4 mx-auto block text-xs font-semibold text-textMuted hover:text-text inline-flex items-center gap-1 py-2 px-3 rounded-full"
              >
                Ver mais{' '}
                <span className="text-[10px] text-textMuted">
                  ({notifications.length - visibleCount} restantes)
                </span>
                <ChevronDown size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function NotificationItem({ notif, onClick }) {
  const visual = TYPE_VISUAL[notif.type] || {
    Icon: Bell,
    color: 'text-textMuted bg-neutro',
  };
  const { Icon, color } = visual;
  const { label, tone } = formatRelativeTime(notif.createdAt);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left flex gap-3 p-3 rounded-xl border tap ${
          notif.isRead
            ? 'bg-card border-neutro'
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
          <div className="mt-1.5">
            <span
              className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TONE_STYLES[tone]}`}
            >
              {label}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
