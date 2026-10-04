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
import { useChildren } from '../../hooks/useChildren';
import { useAbsences } from '../../hooks/useAbsences';
import { getDateKey } from '../../dominio/rota/horarios';
import {
  getActionForStatus,
  advanceChild,
} from '../../services/routeStatusService';
import { getEffectiveStatus } from '../../services/childrenService';
import { PERIOD_LABELS } from '../../compartilhado/formatters';

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
      />

      {/* `pb-28`: o botão fixo de cadastrar mora no canto de baixo e não
        * pode cobrir o último cartão da lista. */}
      <div className="p-5 pb-28 space-y-4">
        {/* Apresenta as pílulas de período que vêm logo abaixo. Elas sempre
          * estiveram certas; o que faltava era dizer que aquilo são as
          * turmas dele. Ver components/layout/PageHeader. */}
        <PageHeader
          icon={Users}
          title={
            children.length
              ? `${children.length} criança${children.length > 1 ? 's' : ''} na sua turma`
              : 'Minha turma'
          }
          subtitle="Escolha o período ou busque pelo nome. Toque numa criança para abrir a ficha."
        />

        {/* Escolas — cadastro que vive perto de onde ele é usado.
          * Não virou aba: já são quatro e a quinta aperta o polegar. */}
        <button
          type="button"
          onClick={() => navigate('/tio/children/escolas')}
          className="tap w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-escolaSoft text-escola flex items-center justify-center shrink-0">
            <School size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-text leading-tight">
              Escolas
            </p>
            <p className="text-sm text-textMuted">
              Cadastre uma vez e reaproveite em cada criança
            </p>
          </div>
          <ChevronRight size={18} className="text-textMuted shrink-0" />
        </button>

        {/* Busca por nome. O RÓTULO É VISÍVEL: placeholder some no primeiro
          * toque, e quem volta à tela com a busca preenchida não sabe mais o
          * que aquele campo filtra. */}
        <div>
          <label
            htmlFor="busca-da-turma"
            className="mb-2 block text-sm font-semibold text-text"
          >
            Buscar pelo nome
          </label>
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
            />
            <input
              id="busca-da-turma"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite aqui"
              className="w-full h-12 pl-10 pr-14 rounded-2xl bg-card border border-border text-base text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-0 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center text-textMuted tap"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Filtros por período */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-12 px-5 rounded-full text-base font-semibold tap border ${
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

      {/* CADASTRAR CRIANÇA NO CANTO DE BAIXO, À DIREITA — onde o polegar já
        * está e onde o olho termina a leitura da tela. Era um "+" no topo
        * (que perdia o texto abaixo de 400px) e, neste canto, morava o
        * "Avisar pais": a ação principal da turma no lugar mais difícil, e
        * uma secundária no melhor. O aviso continua na Agenda e em Meu
        * transporte.
        *
        * Saiu do cabeçalho em vez de ficar nos dois: o topo já tem voltar,
        * título e sino, e com "Cadastrar criança" escrito o título virava
        * "Min…" no Android de 360px. A mesma ação em dois lugares é uma
        * coisa a mais para ler. */}
      <button
        type="button"
        onClick={() => navigate('/tio/children/new')}
        data-tour="add-child"
        style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}
        className="fixed right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-marca px-5 text-base font-bold text-naMarca shadow-float tap print:hidden"
      >
        <Plus size={22} />
        Cadastrar criança
      </button>
    </>
  );
}
