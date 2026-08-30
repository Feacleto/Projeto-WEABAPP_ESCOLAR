import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Notebook,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowLeft,
  School,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import {
  AGENDA_TYPES,
  filterByMonth,
  groupByMonth,
  watchParentAgenda,
} from '../../services/agendaService';
import { playSound } from '../../services/soundService';
import AppSheet from '../common/AppSheet';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Botão flutuante na tela inicial do Pai + visualização "caderno".
 *
 * Caderno:
 *   - Estética de folha pautada com espiral à esquerda.
 *   - 1 entrada da agenda = 1 página.
 *   - Setas pra navegar páginas; som "folhaagenda.mp3" toca em cada virada.
 *   - Reseta a cada mês (filtra mês corrente). Meses anteriores ficam
 *     acessíveis via "índice" (lista de meses).
 *
 * Estado paralelo:
 *   - 'pages'  → visualização caderno do mês atual ou de um mês selecionado
 *   - 'index'  → lista cronológica de meses pra navegar pro passado
 */
export default function PaiNotebookFAB() {
  const [abertoNoToque, setAbertoNoToque] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * ABRE SOZINHO QUANDO A NOTIFICAÇÃO PEDE.
   *
   * O caderno é uma folha da home, não uma rota — então a notificação de
   * recado não tinha pra onde levar, e tocar nela não fazia nada. Agora ela
   * navega pra home com `state.abrirCaderno`, e quem sabe abrir a folha é
   * quem a tem.
   *
   * DERIVADO, e não sincronizado por efeito. A primeira versão fazia
   * `setOpen(true)` dentro de um `useEffect` — que é render em cascata e o
   * lint pega. Aqui "aberto" é simplesmente "ele tocou no botão OU a
   * navegação pediu": não há estado pra manter em dia com outro estado.
   */
  const pedidoDaNotificacao = !!location.state?.abrirCaderno;
  const open = abertoNoToque || pedidoDaNotificacao;

  const fechar = () => {
    setAbertoNoToque(false);
    // Limpa o pedido, senão o caderno reabriria toda vez que a pessoa
    // voltasse pra home pelo botão do telefone — por cima do que ela
    // estivesse tentando ver.
    if (pedidoDaNotificacao) {
      navigate(location.pathname, { replace: true, state: null });
    }
  };

  return (
    <>
      {/* A PORTA É UMA LINHA, e não um botão flutuante.
        *
        * Era uma pílula violeta com gradiente, presa acima da barra de abas,
        * chamando "Veja a agenda" o tempo todo. Três problemas:
        *
        *   1. TRÊS AÇÕES DISPUTANDO O MESMO CANTO — a aba, o cartão do dia e
        *      o FAB. Convite permanente pra uma consulta que é MENSAL é o
        *      oposto da prioridade dela, que é a hora de hoje.
        *   2. O violeta é uma família de cor que NÃO EXISTE no
        *      `tailwind.config.js`. Cor fora do sistema num elemento
        *      permanente ensina que o sistema é sugestão.
        *   3. Flutuando, ele cobre conteúdo — e a tela dela já é curta.
        *
        * A METÁFORA DO PAPEL FICA. O caderno pautado, a espiral, a margem
        * vermelha e o som ao virar página continuam: essa segunda linguagem
        * está certa, porque diz "isto é recado, não é o app falando". O que
        * não podia é ela estar do lado de FORA, competindo com a tela que
        * responde "onde está meu filho". */}
      <button
        type="button"
        onClick={() => setAbertoNoToque(true)}
        className="tap flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warningSoft text-warningText">
          <Notebook size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text">
            Caderno de recados
          </span>
          <span className="block text-[11px] text-textMuted">
            O que o motorista mandou este mês
          </span>
        </span>
        <ChevronRight size={17} className="shrink-0 text-textMuted" />
      </button>

      <NotebookView open={open} onClose={fechar} />
    </>
  );
}

function NotebookView({ open, onClose }) {
  const { user } = useAuth();
  const { child } = useActiveChild();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pages'); // 'pages' | 'index'

  // Mês atualmente sendo lido. Por padrão = mês corrente.
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [page, setPage] = useState(0);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const unsub = watchParentAgenda(
      // `adminUid` vem da criança: é o motorista de quem este responsável é
      // cliente, e é o que a regra confere pra o recado de escola de um
      // parceiro não cair no caderno da família de outro.
      { parentUid: user.uid, adminUid: child?.adminUid },
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.uid, child?.school, child?.adminUid]);

  const currentMonthEntries = useMemo(
    () => filterByMonth(entries, year, month),
    [entries, year, month]
  );
  const monthGroups = useMemo(() => groupByMonth(entries), [entries]);

  // Reset de página quando troca de mês (evita "página 5 num mês de 2 entradas")
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [year, month]);

  const flip = (dir) => {
    const max = currentMonthEntries.length - 1;
    const next = Math.min(Math.max(page + dir, 0), Math.max(max, 0));
    if (next === page) return;
    playSound('page_turn');
    setFlipping(true);
    setTimeout(() => {
      setPage(next);
      setFlipping(false);
    }, 280);
  };

  const goToMonth = (y, m) => {
    playSound('page_turn');
    setYear(y);
    setMonth(m);
    setView('pages');
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    /* O PAPEL VIRA O CONTEÚDO DA FOLHA, e não uma sobreposição própria.
     *
     * Era um `fixed inset-0` com backdrop e z-index inventados — uma terceira
     * forma de cobrir a tela, ao lado do `Sheet` e do `AppSheet`. Dentro do
     * AppSheet ele ganha de graça o que as outras folhas já têm: puxador,
     * fecha no X, no toque fora e ARRASTANDO PRA BAIXO, e o portal que o tira
     * do teto de empilhamento do cabeçalho. */
    <AppSheet open={open} onClose={onClose} title="Caderno de recados" icon={Notebook} size="full">
    <div className="flex flex-col h-full">
      {/* Topo — header do caderno */}
      <div className="bg-gradient-to-b from-amber-50 to-amber-100 px-4 py-3 flex items-center gap-2 border-b border-warningBorder">
        {view === 'pages' ? (
          <>
            <button
              type="button"
              onClick={() => setView('index')}
              aria-label="Ver índice"
              className="tap w-10 h-10 rounded-full bg-white text-warningText flex items-center justify-center shadow-sm"
            >
              <CalendarDays size={18} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-warningText font-bold">
                {isCurrentMonth ? 'Este mês' : 'Mês passado'}
              </p>
              <p className="text-sm font-bold text-warningText">
                {MONTH_NAMES[month]} de {year}
              </p>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setView('pages')}
              aria-label="Voltar"
              className="tap w-10 h-10 rounded-full bg-white text-warningText flex items-center justify-center shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-warningText font-bold">
                Índice
              </p>
              <p className="text-sm font-bold text-warningText">
                Todos os meses
              </p>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar agenda"
          className="tap w-10 h-10 rounded-full bg-white text-warningText flex items-center justify-center shadow-sm"
        >
          <X size={18} />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex-1 overflow-y-auto p-4 bg-warningSoft/60">
        {view === 'pages' ? (
          <PagesView
            loading={loading}
            entries={currentMonthEntries}
            page={page}
            flipping={flipping}
            childName={child?.name}
          />
        ) : (
          <IndexView
            groups={monthGroups}
            onPick={goToMonth}
            currentYear={year}
            currentMonth={month}
          />
        )}
      </div>

      {/* Rodapé com setas — só quando tá em pages e há entradas */}
      {view === 'pages' && currentMonthEntries.length > 0 && (
        <div className="bg-warningChip border-t border-warningBorder px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => flip(-1)}
            disabled={page === 0 || flipping}
            aria-label="Folha anterior"
            className="tap w-12 h-12 rounded-full bg-white text-warningText shadow-sm disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="flex-1 text-center text-xs text-warningText font-semibold tabular-nums">
            Folha {page + 1} de {currentMonthEntries.length}
          </p>
          <button
            type="button"
            onClick={() => flip(1)}
            disabled={page >= currentMonthEntries.length - 1 || flipping}
            aria-label="Próxima folha"
            className="tap w-12 h-12 rounded-full bg-white text-warningText shadow-sm disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
    </AppSheet>
  );
}

function PagesView({ loading, entries, page, flipping, childName }) {
  if (loading) {
    return (
      <div className="text-center text-warningText text-sm py-8">
        Abrindo o caderno...
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <NotebookPage>
        <div className="text-center py-8 px-4">
          <Notebook size={48} className="mx-auto text-warningBorder mb-3" />
          <p className="text-warningText font-bold">Nada anotado este mês</p>
          <p className="text-warningText text-sm mt-2 leading-relaxed">
            Quando o motorista mandar um aviso sobre{' '}
            <span className="font-semibold">
              {childName?.split(' ')[0] || 'a criança'}
            </span>{' '}
            ou sobre a escola, vai aparecer aqui.
          </p>
        </div>
      </NotebookPage>
    );
  }
  const entry = entries[page];
  return (
    <NotebookPage flipping={flipping}>
      <Entry entry={entry} />
    </NotebookPage>
  );
}

/**
 * "Folha de caderno" — papel pautado com espiral à esquerda.
 * Animação de virada feita com scale/skew durante flipping=true.
 */
function NotebookPage({ children, flipping }) {
  return (
    <div className="max-w-md mx-auto">
      <div
        className={`relative bg-[#fffbe9] rounded-xl shadow-xl shadow-amber-900/10 overflow-hidden border border-warningBorder transition-transform duration-300 ease-in-out origin-left ${
          flipping ? 'scale-x-90 skew-y-2' : ''
        }`}
        style={{
          backgroundImage:
            'repeating-linear-gradient(transparent, transparent 31px, rgba(180, 130, 80, 0.18) 32px)',
        }}
      >
        {/* Espiral à esquerda — bolinhas escuras evocando furo do fichário */}
        <div className="absolute left-2 top-0 bottom-0 w-3 flex flex-col items-center justify-evenly py-4 pointer-events-none">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full bg-warningText/40 shadow-inner"
            />
          ))}
        </div>
        {/* Margem vermelha vertical estilo caderno escolar */}
        <div className="absolute left-9 top-0 bottom-0 w-px bg-dangerBorder/70 pointer-events-none" />

        <div className="pl-12 pr-4 py-5 min-h-[320px]">{children}</div>
      </div>
    </div>
  );
}

function Entry({ entry }) {
  const t = AGENDA_TYPES[entry.type] || AGENDA_TYPES.other;
  const date = entry.createdAt?.toDate?.();
  const ScopeIcon = entry.scope === 'school' ? School : UserIcon;
  // "Aviso do motorista" e "Aviso da escola" são coisas diferentes pro
  // responsável: um fala da perua, o outro fala da aula. Sem a distinção, o
  // recado de carro quebrado chegava rotulado como recado da escola.
  const scopeLabel = entry.todasAsEscolas
    ? 'Aviso do motorista · para todas as famílias'
    : entry.scope === 'school'
    ? `Aviso da escola · ${entry.schoolName}`
    : `Sobre ${entry.childName?.split(' ')[0] || 'a criança'}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {t.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-warningText font-bold">
            {date
              ? new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(date)
              : ''}
          </p>
          <p className="text-base font-bold text-warningText leading-tight">
            {t.label}
          </p>
        </div>
      </div>

      <p className="text-xs text-warningText inline-flex items-center gap-1">
        <ScopeIcon size={11} /> {scopeLabel}
      </p>

      {/* O DIA DO EVENTO, quando o motorista informou.
        * Antes "festa junina dia 12/09" ficava dentro do texto: o responsável
        * tinha que achar a data no meio do recado, e o aviso de um passeio da
        * semana que vem parecia igual ao de hoje. */}
      {entry.eventDate && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-warningBorder/60 px-2.5 py-1.5 text-xs font-bold text-warningText">
          <CalendarDays size={13} />
          {rotuloDoEvento(entry.eventDate)}
        </p>
      )}

      <div className="pt-2">
        <p className="text-[15px] text-warningText leading-relaxed whitespace-pre-wrap font-serif">
          {entry.message || (
            <em className="text-warningText">(sem mensagem extra)</em>
          )}
        </p>
      </div>
    </div>
  );
}

function IndexView({ groups, onPick, currentYear, currentMonth }) {
  if (groups.length === 0) {
    return (
      <p className="text-center text-warningText text-sm py-8">
        Ainda não há avisos no caderno.
      </p>
    );
  }
  return (
    <div className="max-w-md mx-auto space-y-2">
      {groups.map((g) => {
        const isCurrent = g.year === currentYear && g.month === currentMonth;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onPick(g.year, g.month)}
            className={`tap w-full text-left rounded-2xl p-4 border flex items-center gap-3 ${
              isCurrent
                ? 'bg-warningBorder border-estrela'
                : 'bg-white border-warningBorder'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-warningChip text-warningText flex items-center justify-center shrink-0">
              <CalendarDays size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-warningText leading-tight">
                {MONTH_NAMES[g.month]} de {g.year}
              </p>
              <p className="text-xs text-warningText mt-0.5">
                {g.count} {g.count === 1 ? 'aviso' : 'avisos'}
              </p>
            </div>
            <ChevronRight size={18} className="text-warningText shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * "quinta, 12 de setembro" — e "hoje"/"amanhã" quando é perto, porque é assim
 * que o responsável pensa na data quando abre o app de manhã.
 */
function rotuloDoEvento(chave) {
  const [y, m, d] = String(chave).split('-').map(Number);
  if (!y || !m || !d) return chave;
  const data = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((data - hoje) / 86400000);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(data);
  return dias < 0 ? `${texto} (já passou)` : texto;
}
