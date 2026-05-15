import { useEffect, useMemo, useState } from 'react';
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
import { useChild } from '../../hooks/useChild';
import {
  AGENDA_TYPES,
  filterByMonth,
  groupByMonth,
  watchParentAgenda,
} from '../../services/agendaService';
import { playSound } from '../../services/soundService';

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
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB com label persistente "Veja a agenda" — convida o Pai a abrir
        * o caderno mesmo quando não tem notificação chamando atenção. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Veja a agenda"
        className="fixed bottom-24 right-4 z-40 h-14 px-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-xl shadow-violet-500/30 flex items-center gap-2 tap font-bold print:hidden"
      >
        <Notebook size={22} />
        <span className="text-sm">Veja a agenda</span>
      </button>

      {open && <NotebookView onClose={() => setOpen(false)} />}
    </>
  );
}

function NotebookView({ onClose }) {
  const { user, profile } = useAuth();
  const { child } = useChild(profile?.childId);
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
      { parentUid: user.uid, schoolName: child?.school || null },
      (list) => {
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.uid, child?.school]);

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
    <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm max-w-mobile mx-auto flex flex-col">
      {/* Topo — header do caderno */}
      <div className="bg-gradient-to-b from-amber-50 to-amber-100 px-4 py-3 flex items-center gap-2 border-b border-amber-200">
        {view === 'pages' ? (
          <>
            <button
              type="button"
              onClick={() => setView('index')}
              aria-label="Ver índice"
              className="tap w-10 h-10 rounded-full bg-white text-amber-800 flex items-center justify-center shadow-sm"
            >
              <CalendarDays size={18} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
                {isCurrentMonth ? 'Este mês' : 'Mês passado'}
              </p>
              <p className="text-sm font-bold text-amber-900">
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
              className="tap w-10 h-10 rounded-full bg-white text-amber-800 flex items-center justify-center shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
                Índice
              </p>
              <p className="text-sm font-bold text-amber-900">
                Todos os meses
              </p>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar agenda"
          className="tap w-10 h-10 rounded-full bg-white text-amber-800 flex items-center justify-center shadow-sm"
        >
          <X size={18} />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex-1 overflow-y-auto p-4 bg-amber-50/60">
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
        <div className="bg-amber-100 border-t border-amber-200 px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => flip(-1)}
            disabled={page === 0 || flipping}
            aria-label="Folha anterior"
            className="tap w-12 h-12 rounded-full bg-white text-amber-900 shadow-sm disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="flex-1 text-center text-xs text-amber-900 font-semibold tabular-nums">
            Folha {page + 1} de {currentMonthEntries.length}
          </p>
          <button
            type="button"
            onClick={() => flip(1)}
            disabled={page >= currentMonthEntries.length - 1 || flipping}
            aria-label="Próxima folha"
            className="tap w-12 h-12 rounded-full bg-white text-amber-900 shadow-sm disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

function PagesView({ loading, entries, page, flipping, childName }) {
  if (loading) {
    return (
      <div className="text-center text-amber-800 text-sm py-8">
        Abrindo o caderno...
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <NotebookPage>
        <div className="text-center py-8 px-4">
          <Notebook size={48} className="mx-auto text-amber-300 mb-3" />
          <p className="text-amber-900 font-bold">Nada anotado este mês</p>
          <p className="text-amber-700 text-sm mt-2 leading-relaxed">
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
        className={`relative bg-[#fffbe9] rounded-xl shadow-xl shadow-amber-900/10 overflow-hidden border border-amber-200 transition-transform duration-300 ease-in-out origin-left ${
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
              className="block w-2 h-2 rounded-full bg-amber-700/40 shadow-inner"
            />
          ))}
        </div>
        {/* Margem vermelha vertical estilo caderno escolar */}
        <div className="absolute left-9 top-0 bottom-0 w-px bg-red-300/70 pointer-events-none" />

        <div className="pl-12 pr-4 py-5 min-h-[320px]">{children}</div>
      </div>
    </div>
  );
}

function Entry({ entry }) {
  const t = AGENDA_TYPES[entry.type] || AGENDA_TYPES.other;
  const date = entry.createdAt?.toDate?.();
  const ScopeIcon = entry.scope === 'school' ? School : UserIcon;
  const scopeLabel =
    entry.scope === 'school'
      ? `Aviso da escola · ${entry.schoolName}`
      : `Sobre ${entry.childName?.split(' ')[0] || 'a criança'}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          {t.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
            {date
              ? new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(date)
              : ''}
          </p>
          <p className="text-base font-bold text-amber-900 leading-tight">
            {t.label}
          </p>
        </div>
      </div>

      <p className="text-xs text-amber-700 inline-flex items-center gap-1">
        <ScopeIcon size={11} /> {scopeLabel}
      </p>

      <div className="pt-2">
        <p className="text-[15px] text-amber-950 leading-relaxed whitespace-pre-wrap font-serif">
          {entry.message || (
            <em className="text-amber-600">(sem mensagem extra)</em>
          )}
        </p>
      </div>
    </div>
  );
}

function IndexView({ groups, onPick, currentYear, currentMonth }) {
  if (groups.length === 0) {
    return (
      <p className="text-center text-amber-800 text-sm py-8">
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
                ? 'bg-amber-200 border-amber-400'
                : 'bg-white border-amber-200'
            }`}
          >
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <CalendarDays size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 leading-tight">
                {MONTH_NAMES[g.month]} de {g.year}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {g.count} {g.count === 1 ? 'aviso' : 'avisos'}
              </p>
            </div>
            <ChevronRight size={18} className="text-amber-600 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
