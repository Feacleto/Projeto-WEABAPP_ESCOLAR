import { useEffect, useState } from 'react';
import {
  Bell,
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
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { useNotificacoesDaSessao } from '../../hooks/useNotifications';
import { markAllNotificationsRead, apagarAvisos } from '../../services/notificationsService';
import {
  idsNaoLidos,
  partirOSino,
  quandoDoAviso,
  GRUPOS_DO_SINO,
  ASSUNTO,
} from '../../dominio/identidade/caixaDeAvisos.js';
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

const FILTROS = [
  { rotulo: 'Tudo', assunto: null },
  { rotulo: 'Rota', assunto: ASSUNTO.ROTA },
  { rotulo: 'Dinheiro', assunto: ASSUNTO.DINHEIRO },
];

/**
 * UM CONTEÚDO, DUAS CASCAS.
 *
 * O sino vive no cabeçalho de TODAS as telas do app. Tocar nele abre a FOLHA
 * (NotificationsSheet): o conteúdo por trás continua exatamente onde estava,
 * e fechar é um toque. A página (`pages/Notifications`) segue existindo para
 * quem chega de fora, pelo push. As duas renderizam ESTE corpo.
 *
 * ── O MODELO D (04/10/2026, escolhido pelo dono entre quatro)
 * Em cima, o filtro (Tudo · Rota · Dinheiro) e os NOVOS em cartões verdes;
 * embaixo, os JÁ VISTOS numa linha cada, em Hoje · Ontem · Esta semana · Este
 * mês; o que passou de um mês fica fechado em "Outros", o único grupo que se
 * limpa. A régua dos grupos é `partirOSino` (caixaDeAvisos.js).
 *
 * ⚠️ AS CHAVES DE "O QUE TOCA NO CELULAR" SAÍRAM DAQUI (mesma data) e moram
 * só no Perfil, no bloco Avisos. O sino ficou sendo só a caixa.
 */
export default function NotificationsBody({ onNavigate }) {
  const { profile } = useAuth();
  const isParent = profile?.role === 'parent';

  // ⚠️ LÊ A ESCUTA DA SESSÃO, NÃO ABRE OUTRA (03/10/2026).
  const { notifications, loading, refreshReads } = useNotificacoesDaSessao();

  // O ROSTO DE CADA AVISO (03/10/2026, pedido do dono): a criança quando o
  // aviso é sobre ela, o motorista quando chega à família vindo dele.
  const criancas = useCriancasDoSino();
  const { child: filhoAtivo } = useActiveChild();
  const { admin: motorista } = useAdminProfile(
    isParent ? filhoAtivo?.adminUid : null
  );

  // O instante em que a folha abriu: o que ela lê DEPOIS disso continua
  // "novo" até fechar (ver `ehNovo`), senão os cartões fugiriam do dedo.
  const [abertoEm] = useState(() => Date.now());
  const [assunto, setAssunto] = useState(null);
  const [outrosAbertos, setOutrosAbertos] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [limpando, setLimpando] = useState(false);

  // Auto-marca como lidas as que ele acabou de ver (com debounce de 1.5s).
  // ⚠️ SÓ AS NÃO LIDAS DO QUE O SINO JÁ CARREGOU, em lotes de até 450.
  useEffect(() => {
    if (loading || idsNaoLidos(notifications).length === 0) return;
    const t = setTimeout(async () => {
      try {
        await markAllNotificationsRead(idsNaoLidos(notifications));
        refreshReads();
      } catch (err) {
        // Marcar como lido é cortesia: falhar não pode atrapalhar a leitura.
        console.error('[sino] falha ao marcar como lidas:', err);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, notifications, refreshReads]);

  /**
   * ⚠️ O DESTINO SAI DA MESMA TABELA DO PUSH (03/10/2026) — `destinoDoAviso`.
   * Sobra uma exceção, que não é destino e sim pedido: o recado da agenda
   * abre o CADERNO, uma folha da home da família.
   */
  const onClickNotif = (n) => {
    const caminho = destinoDoAviso(n, profile?.role);
    const recado =
      n.type === 'agenda_entry' ||
      n.type === 'agenda_school_entry' ||
      n.type === 'agenda_broadcast';
    onNavigate(caminho, recado && isParent ? { abrirCaderno: true } : undefined);
  };

  const caixa = partirOSino(notifications, { abertoEmMs: abertoEm, agoraMs: abertoEm, assunto });
  // "Limpar outros" apaga TODOS os de mais de um mês, de qualquer assunto: a
  // frase do botão diz "outros", e apagar só os da Rota deixaria os do
  // Dinheiro escondidos atrás do filtro.
  const todosOsOutros = partirOSino(notifications, { abertoEmMs: abertoEm, agoraMs: abertoEm }).outros;
  const gruposComAviso = GRUPOS_DO_SINO.filter((g) => caixa[g.chave].length > 0);
  const vazioNoFiltro = caixa.novos.length === 0 && gruposComAviso.length === 0 && caixa.outros.length === 0;

  const limparOutros = async () => {
    setLimpando(true);
    try {
      await apagarAvisos(todosOsOutros.map((n) => n.id));
      toast.success('Pronto: avisos antigos apagados.');
      setOutrosAbertos(false);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra apagar. Tente de novo.');
    } finally {
      setLimpando(false);
      setConfirmarLimpar(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Nenhuma notificação"
        description={
          isParent
            ? 'Você verá aqui lembretes de vencimento e confirmações do motorista.'
            : 'Você verá aqui avisos de pagamentos informados pelos pais.'
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar avisos">
        {FILTROS.map((f) => {
          const ativo = assunto === f.assunto;
          return (
            <button
              key={f.rotulo}
              type="button"
              aria-pressed={ativo}
              onClick={() => setAssunto(f.assunto)}
              className={`tap min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                ativo ? 'border-primary bg-primary text-white' : 'border-border bg-card text-textBody'
              }`}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>

      {caixa.novos.length > 0 && (
        <>
          <TituloDoGrupo>Novos · {caixa.novos.length}</TituloDoGrupo>
          <ul className="space-y-2">
            {caixa.novos.map((n) => (
              <NotificationItem
                key={n.id}
                notif={n}
                quando={quandoDoAviso(n.createdAt, abertoEm)}
                rosto={rostoDoAviso(n, criancas, profile?.role)}
                motorista={motorista}
                motoristaUid={filhoAtivo?.adminUid}
                onClick={() => onClickNotif(n)}
              />
            ))}
          </ul>
        </>
      )}

      {/* JÁ VISTOS, uma linha cada. Grupo vazio não aparece, e o primeiro
        * que aparece leva o "Já vistos" no título. */}
      {gruposComAviso.map((g, i) => (
        <div key={g.chave}>
          <TituloDoGrupo>{i === 0 ? `Já vistos · ${g.titulo}` : g.titulo}</TituloDoGrupo>
          <ul>
            {caixa[g.chave].map((n) => (
              <LinhaVista
                key={n.id}
                notif={n}
                quando={quandoDoAviso(n.createdAt, abertoEm)}
                onClick={() => onClickNotif(n)}
              />
            ))}
          </ul>
        </div>
      ))}

      {vazioNoFiltro && (
        <p className="py-6 text-center text-base text-textMuted">Nada aqui.</p>
      )}

      {/* OUTROS — mais de um mês, fechado. O ÚNICO grupo que se limpa: do mês
        * para cá é a conversa recente, e apagar sem querer ali custa a prova
        * de um aviso sobre dinheiro. */}
      {caixa.outros.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-border">
          <div className="flex min-h-14 items-center gap-2 px-3">
            <button
              type="button"
              onClick={() => setOutrosAbertos((v) => !v)}
              aria-expanded={outrosAbertos}
              className="tap flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-text">Outros · {caixa.outros.length}</span>
                <span className="block text-sm text-textMuted">Mais de um mês</span>
              </span>
              <ChevronDown
                size={20}
                className={`shrink-0 text-textMuted ${outrosAbertos ? 'rotate-180' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => setConfirmarLimpar(true)}
              className="tap min-h-12 shrink-0 rounded-xl border-2 border-border bg-card px-3 text-base font-bold text-textBody"
            >
              Limpar outros
            </button>
          </div>
          {outrosAbertos && (
            <ul className="px-3 pb-2">
              {caixa.outros.map((n) => (
                <LinhaVista
                  key={n.id}
                  notif={n}
                  quando={quandoDoAviso(n.createdAt, abertoEm)}
                  onClick={() => onClickNotif(n)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmarLimpar}
        title={`Apagar ${todosOsOutros.length} ${todosOsOutros.length === 1 ? 'aviso antigo' : 'avisos antigos'}?`}
        description="Só os de mais de um mês."
        confirmLabel="Apagar"
        variant="danger"
        loading={limpando}
        onConfirm={limparOutros}
        onCancel={() => setConfirmarLimpar(false)}
      />
    </>
  );
}

function TituloDoGrupo({ children }) {
  return (
    <p className="mb-1.5 mt-4 px-1 text-sm font-bold uppercase tracking-wide text-textMuted">
      {children}
    </p>
  );
}

/** Um aviso já visto: uma linha, o quê à esquerda e o quando à direita. */
function LinhaVista({ notif, quando, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="tap flex min-h-12 w-full items-center gap-3 border-b border-border px-1 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-base text-textBody">{notif.title}</span>
        <span className="shrink-0 text-sm tabular-nums text-textMuted">{quando}</span>
      </button>
    </li>
  );
}

/**
 * UM AVISO NOVO, lido como uma conversa do WhatsApp (03/10/2026).
 *
 * Padrão em F: o ROSTO no canto esquerdo diz DE QUEM é o assunto antes de
 * qualquer letra; na primeira linha, o QUÊ à esquerda e o QUANDO à direita;
 * embaixo, o detalhe. O tipo do aviso (pagamento, atraso…) não some com o
 * rosto: vira um selo pequeno no canto dele.
 *
 * Letra: título 16px, detalhe 15px, hora 14px — o piso de 40+ do app. O
 * título não é cortado em reticências: "Felipe não vai na perua de manhã
 * hoje" cortado no meio é outro aviso.
 */
function NotificationItem({ notif, quando, rosto, motorista, motoristaUid, onClick }) {
  const visual = TYPE_VISUAL[notif.type] || {
    Icon: Bell,
    color: 'text-textMuted bg-neutro',
  };
  const { Icon, color } = visual;
  const temSelo = rosto.tipo !== 'icone' && Boolean(TYPE_VISUAL[notif.type]);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex gap-3 p-3 min-h-[72px] rounded-2xl border tap bg-primarySoft border-primaryBorder"
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
            <span className="shrink-0 pt-0.5 text-sm font-bold tabular-nums text-accentText">
              {quando}
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
