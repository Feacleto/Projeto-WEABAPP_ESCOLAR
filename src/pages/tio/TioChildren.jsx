import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Plus, Search, X, School, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageHeader from '../../components/layout/PageHeader';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ChildCard from '../../components/children/ChildCard';
import { ChildDetailSheet } from '../../pages/ChildDetail';
import TioAgendaFAB from '../../components/agenda/TioAgendaFAB';
import { useChildren } from '../../hooks/useChildren';
import { useAbsences } from '../../hooks/useAbsences';
import { getDateKey } from '../../services/horariosService';
import {
  getActionForStatus,
  advanceChild,
} from '../../services/routeStatusService';
import { getEffectiveStatus } from '../../services/childrenService';
import { PERIOD_LABELS } from '../../utils/formatters';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'morning', label: PERIOD_LABELS.morning },
  { value: 'afternoon', label: PERIOD_LABELS.afternoon },
  { value: 'evening', label: PERIOD_LABELS.evening },
];

export default function TioChildren() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { children, loading } = useChildren();

  // Ausências declaradas HOJE. Sem isto, o tio olhava a lista e não sabia
  // quem ia faltar — a informação mais perecível do dia ficava só na tela
  // de rota, que ele abre no meio do trânsito.
  const { byChildId: absenceByChild } = useAbsences(getDateKey());

  // Qual passo cabe agora depende da DIREÇÃO do turno, e a lista não tem
  // esse contexto. Deduzimos do relógio, igual à tela "Rota agora": manhã
  // leva pra escola, tarde e noite trazem de volta. É o que acontece na
  // prática, e o tio corrige na tela de rota se precisar.
  const direction = new Date().getHours() < 11 ? 'pickup' : 'dropoff';
  const [advancingId, setAdvancingId] = useState(null);

  // A ficha abre POR CIMA da lista. O filtro, a busca e a rolagem continuam
  // exatamente onde estavam — que é a diferença entre consultar um telefone
  // e perder o lugar numa lista de vinte crianças.
  const [fichaDe, setFichaDe] = useState(null);

  const onAdvance = async (child, nextStatus) => {
    setAdvancingId(child.id);
    try {
      await advanceChild(child.id, nextStatus);
      toast.success(`${child.name.split(' ')[0]}: pronto`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setAdvancingId(null);
    }
  };
  const initialFilter = searchParams.get('period') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');

  // Quando navega vindo de outra tela com query param, atualiza o filtro
  useEffect(() => {
    const p = searchParams.get('period');
    if (p && p !== filter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilter(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = children;
    if (filter !== 'all') list = list.filter((c) => c.period === filter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(term));
    }
    return list;
  }, [children, filter, search]);

  return (
    <>
      <Header
        title="Minha turma"
        showBack
        backLabel="Início"
        backTo="/tio"
        action={
          <button
            onClick={() => navigate('/tio/children/new')}
            aria-label="Cadastrar nova criança"
            data-tour="add-child"
            className="tap inline-flex items-center gap-1 bg-primary text-white text-sm font-semibold px-3 py-1.5 rounded-full"
          >
            <Plus size={16} />
            {/* Em tela estreita (360px pra baixo) o rótulo some e sobra o
              * "+": o título da página não precisa ser cortado pra caber um
              * botão que o ícone sozinho já explica. */}
            <span className="hidden min-[360px]:inline">Nova criança</span>
          </button>
        }
      />

      <div className="p-5 space-y-4">
        {/* Apresenta as pílulas de período que vêm logo abaixo. Elas sempre
          * estiveram certas; o que faltava era dizer que aquilo são as
          * turmas dele. Ver components/layout/PageHeader. */}
        <PageHeader
          icon={Users}
          title={
            children.length
              ? `${children.length} criança${children.length > 1 ? 's' : ''} na sua turma`
              : 'Sua turma'
          }
          subtitle="Escolha a turma pelo período, ou busque pelo nome. Toque na foto pra abrir a ficha."
        />

        {/* Escolas — cadastro que vive perto de onde ele é usado.
          * Não virou aba: já são quatro e a quinta aperta o polegar. */}
        <button
          type="button"
          onClick={() => navigate('/tio/children/escolas')}
          className="tap w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
            <School size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text leading-tight">
              Escolas
            </p>
            <p className="text-[11px] text-textMuted">
              Cadastre uma vez e reaproveite em cada criança
            </p>
          </div>
          <ChevronRight size={18} className="text-textMuted shrink-0" />
        </button>

        {/* Busca por nome */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pelo nome..."
            className="w-full h-12 pl-10 pr-10 rounded-2xl bg-card border border-border text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted tap p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filtros por período */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search
                ? 'Nada encontrado'
                : filter === 'all'
                ? 'Nenhuma criança ainda'
                : 'Sem crianças nesse período'
            }
            description={
              search
                ? `Não achei ninguém com "${search}".`
                : filter === 'all'
                ? 'Cadastre a primeira criança pra começar.'
                : 'Tente outro filtro ou cadastre uma nova.'
            }
            action={
              filter === 'all' && !search ? (
                <Button
                  onClick={() => navigate('/tio/children/new')}
                  icon={Plus}
                  fullWidth={false}
                >
                  Cadastrar criança
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                absence={absenceByChild?.[child.id] || null}
                action={getActionForStatus(
                  getEffectiveStatus(child),
                  direction
                )}
                advancing={advancingId === child.id}
                onAdvance={(next) => onAdvance(child, next)}
                onClick={() => setFichaDe(child.id)}
              />
            ))}
          </div>
        )}
      </div>

      <ChildDetailSheet
        open={!!fichaDe}
        childId={fichaDe}
        onClose={() => setFichaDe(null)}
      />

      {/* Agenda digital — botão flutuante de aviso pros pais */}
      <TioAgendaFAB />
    </>
  );
}
