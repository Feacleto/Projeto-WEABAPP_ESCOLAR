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
import { useNotificacoesDaSessao } from '../../hooks/useNotifications';
import { markAllNotificationsRead } from '../../services/notificationsService';
import { idsNaoLidos } from '../../dominio/identidade/caixaDeAvisos.js';
import { formatRelativeTime } from '../../compartilhado/formatters';
import PreferenciasDeAviso from './PreferenciasDeAviso';
import Avatar from '../common/Avatar';
import { destinoDoAviso } from '../../dominio/identidade/destinoDoAviso.js';
import { rostoDoAviso } from '../../dominio/identidade/rostoDoAviso.js';
import { useCriancasDoSino } from '../../hooks/useCriancasDoSino';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';

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

// Cor do "Hoje / Ontem / Há X dias". Era uma pílula de 12px em monoespaçada
// e caixa alta — a letra mais difícil de ler do app, no dado que responde
// "isso é de agora?". Virou texto de 14px no canto superior direito do aviso,
// onde o olho termina a primeira linha (padrão em F: o QUÊ à esquerda, o
// QUANDO à direita). A cor segue dizendo a recência, só em tons de TEXTO.
const TONE_STYLES = {
  today: 'text-accentText',
  yesterday: 'text-warningText',
  recent: 'text-infoText',
  older: 'text-textMuted',
};

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
  const { profile } = useAuth();
  const isParent = profile?.role === 'parent';
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  // ⚠️ LÊ A ESCUTA DA SESSÃO, NÃO ABRE OUTRA (03/10/2026). A folha e a página
  // chamavam `useNotifications` por conta própria — uma segunda escuta das
  // mesmas 100, por cima da do cabeçalho.
  const { notifications, loading, refreshReads } = useNotificacoesDaSessao();

  // O ROSTO DE CADA AVISO (03/10/2026, pedido do dono): a criança quando o
  // aviso é sobre ela, o motorista quando chega à família vindo dele. Quem
  // decide é `rostoDoAviso`; aqui só se busca o que ele precisa ver.
  const criancas = useCriancasDoSino();
  const { child: filhoAtivo } = useActiveChild();
  const { admin: motorista } = useAdminProfile(
    isParent ? filhoAtivo?.adminUid : null
  );

  // Auto-marca como lidas as que ele acabou de ver (com debounce de 1.5s).
  // Um lote só (até 450 por lote), em vez de uma escrita por aviso.
  useEffect(() => {
    if (loading || notifications.length === 0) return;
    const t = setTimeout(async () => {
      const naoLidos = idsNaoLidos(notifications);
      if (naoLidos.length === 0) return;
      try {
        await markAllNotificationsRead(naoLidos);
        refreshReads();
      } catch (err) {
        // Marcar como lido é cortesia: falhar não pode atrapalhar a leitura.
        console.error('[sino] falha ao marcar como lidas:', err);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, refreshReads]);

  const onMarkAll = async () => {
    try {
      // ⚠️ SÓ AS NÃO LIDAS DO QUE O SINO JÁ CARREGOU — nunca o histórico
      // inteiro da pessoa relido do banco (ver `markAllNotificationsRead`).
      await markAllNotificationsRead(idsNaoLidos(notifications));
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
          className="tap mb-2 inline-flex min-h-12 items-center gap-2 text-sm font-bold text-primary"
        >
          <CheckCheck size={18} />
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
                  rosto={rostoDoAviso(n, criancas, profile?.role)}
                  motorista={motorista}
                  motoristaUid={filhoAtivo?.adminUid}
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
                className="tap mt-3 mx-auto flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold text-text hover:bg-neutro"
              >
                Ver mais{' '}
                <span className="text-sm text-textMuted">
                  ({notifications.length - visibleCount} restantes)
                </span>
                <ChevronDown size={18} />
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

/**
 * UM AVISO, lido como uma conversa do WhatsApp (03/10/2026).
 *
 * Padrão em F: o ROSTO no canto esquerdo diz DE QUEM é o assunto antes de
 * qualquer letra; na primeira linha, o QUÊ à esquerda e o QUANDO à direita;
 * embaixo, o detalhe. O tipo do aviso (pagamento, atraso…) não some com o
 * rosto: vira um selo pequeno no canto dele.
 *
 * Letra: título 16px, detalhe 15px, hora 14px — o piso de 40+ do app. Era
 * 14/12/12. O título não é mais cortado em reticências: "Felipe não vai na
 * perua de manhã hoje" cortado no meio é outro aviso.
 */
function NotificationItem({ notif, rosto, motorista, motoristaUid, onClick }) {
  const visual = TYPE_VISUAL[notif.type] || {
    Icon: Bell,
    color: 'text-textMuted bg-neutro',
  };
  const { Icon, color } = visual;
  const { label, tone } = formatRelativeTime(notif.createdAt);
  const temSelo = rosto.tipo !== 'icone' && Boolean(TYPE_VISUAL[notif.type]);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left flex gap-3 p-3 min-h-[72px] rounded-2xl border tap ${
          notif.isRead
            ? 'bg-card border-border'
            : 'bg-primarySoft border-primaryBorder'
        }`}
      >
        <div className="relative shrink-0">
          {rosto.tipo === 'crianca' ? (
            <Avatar
              photoURL={rosto.crianca.photoURL}
              gender={rosto.crianca.gender}
              seed={rosto.crianca.id}
              kind="child"
              size="md"
            />
          ) : rosto.tipo === 'motorista' ? (
            <Avatar
              photoURL={motorista?.photoURL}
              gender={motorista?.gender}
              seed={motoristaUid || ''}
              name={motorista?.name}
              kind="admin"
              size="md"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}
            >
              <Icon size={22} />
            </div>
          )}
          {temSelo && (
            <span
              aria-hidden
              className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card ${color}`}
            >
              <Icon size={13} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold leading-snug text-text">
              {notif.title}
            </p>
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <span className={`text-sm font-semibold ${TONE_STYLES[tone]}`}>
                {label}
              </span>
              {!notif.isRead && (
                <span
                  className="w-2.5 h-2.5 rounded-full bg-primary"
                  aria-label="Não lido"
                />
              )}
            </span>
          </div>
          {notif.body && (
            <p className="mt-0.5 text-[15px] leading-snug text-textBody">
              {notif.body}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}
