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
import { useNotifications } from '../../hooks/useNotifications';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationsService';
import { formatRelativeTime } from '../../compartilhado/formatters';
import PreferenciasDeAviso from './PreferenciasDeAviso';
import { destinoDoAviso } from '../../dominio/identidade/destinoDoAviso.js';

const TYPE_VISUAL = {
  payment_claimed: { Icon: Hourglass, color: 'text-primary bg-primaryChip' },
  payment_confirmed: { Icon: CheckCircle2, color: 'text-accentText bg-primaryChip' },
  payment_due_5d: { Icon: CalendarClock, color: 'text-primary bg-primaryChip' },
  payment_due_3d: { Icon: CalendarClock, color: 'text-warning bg-warningChip' },
  payment_due_0d: { Icon: Clock, color: 'text-warning bg-warningChip' },
  payment_overdue_3d: { Icon: AlertTriangle, color: 'text-danger bg-dangerChip' },
  payment_overdue_7d: { Icon: AlertTriangle, color: 'text-danger bg-dangerChip' },
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

  const { notifications, loading, refreshReads } = useNotifications({
    userId: user?.uid,
  });

  // Auto-marca como lidas as que ele acabou de ver (com debounce de 1.5s)
  useEffect(() => {
    if (loading || notifications.length === 0) return;
    const t = setTimeout(async () => {
      // Não há mais notificação "derivada": toda ela é documento, e a
      // leitura se grava em `readAt` como a de qualquer outra.
      const unreadStored = notifications.filter((n) => !n.isRead);

      if (unreadStored.length > 0) {
        await Promise.all(
          unreadStored.map((n) => markNotificationRead(n.id).catch(() => {}))
        );
      }
      if (unreadStored.length > 0) {
        refreshReads();
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, refreshReads]);

  const onMarkAll = async () => {
    try {
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
  /**
   * ⚠️ O DESTINO SAI DA MESMA TABELA DO PUSH (03/10/2026) — `destinoDoAviso`.
   * Eram oito ramos aqui e outra lista no servidor, que diziam se espelhar e
   * não se espelhavam: mais de vinte tipos não levavam a lugar nenhum quando
   * tocados no sino. Sobra uma exceção, que não é destino e sim pedido: o
   * recado da agenda abre o CADERNO, uma folha da home da família.
   */
  const onClickNotif = (n) => {
    const caminho = destinoDoAviso(n, profile?.role);
    const recado =
      n.type === 'agenda_entry' ||
      n.type === 'agenda_school_entry' ||
      n.type === 'agenda_broadcast';
    onNavigate(caminho, recado && isParent ? { abrirCaderno: true } : undefined);
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
                <span className="text-xs text-textMuted">
                  ({notifications.length - visibleCount} restantes)
                </span>
                <ChevronDown size={14} />
              </button>
            )}
          </>
        )}
      </div>

      {/* ⚠️ AS PREFERÊNCIAS MORAM AQUI, no fim do sino, e não numa tela de
        * ajustes que não existe.
        *
        * É o único lugar do app em que a pessoa já está pensando em avisos —
        * e é onde ela está no minuto em que se irrita com um. Uma tela de
        * configurações separada seria mais arrumada e ninguém acharia: quem
        * quer parar de receber algo não vai procurar um menu, vai desligar o
        * push no sistema operacional. Que é exatamente o que isto veio
        * evitar. */}
      <PreferenciasDeAviso />
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
            : 'bg-primarySoft border-primaryBorder'
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
              className={`rotulo inline-flex items-center px-2 py-0.5 rounded-full ${TONE_STYLES[tone]}`}
            >
              {label}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}
