import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, Sunrise, Sunset, Moon, Home, School, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import { useChildren } from '../../hooks/useChildren';
import {
  PERIODS,
  DIRECTIONS,
  TURNO_SHORT_LABELS,
  turnoKey,
  watchDefaultPlan,
  setDefaultTurnoOrder,
} from '../../services/routePlanService';

const PERIOD_ICON = {
  morning: Sunrise,
  afternoon: Sunset,
  evening: Moon,
};

const PERIOD_LABEL = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

/**
 * Tela "Planejar rota padrão" — edita a ordem fixa por turno (routePlans/default).
 *
 * UX: 2 níveis de tabs.
 *   - Período (Manhã/Tarde/Noite) — só mostra os que têm criança em algum turno.
 *   - Direção (Ida/Volta) — toggle simples.
 *
 * O plano padrão é a base que o Tio segue todo dia. Ajustes pontuais (ausência,
 * reordenamento do dia) acontecem em dailyRoutes/{date} sem afetar a padrão.
 */
export default function TioRoutePlan() {
  const { children: allChildren, loading } = useChildren();
  const [defaultPlan, setDefaultPlan] = useState({});

  const [period, setPeriod] = useState('morning');
  const [direction, setDirection] = useState('pickup');

  useEffect(() => {
    const unsub = watchDefaultPlan(setDefaultPlan, () => {});
    return unsub;
  }, []);

  // Quais períodos têm pelo menos uma criança?
  const availablePeriods = useMemo(() => {
    const set = new Set();
    for (const c of allChildren) {
      if (c.pickupPeriod) set.add(c.pickupPeriod);
      else if (c.period) set.add(c.period);
      if (c.dropoffPeriod) set.add(c.dropoffPeriod);
    }
    return PERIODS.filter((p) => set.has(p));
  }, [allChildren]);

  // Se o período selecionado não existe, pula pro primeiro disponível
  useEffect(() => {
    if (availablePeriods.length === 0) return;
    if (!availablePeriods.includes(period)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, period]);

  const turno = turnoKey(period, direction);

  // Ordem efetiva: pega do default; crianças que pertencem ao turno mas não
  // estão no order entram no fim (cresce ao cadastrar criança nova).
  const items = useMemo(() => {
    const order = Array.isArray(defaultPlan[turno]) ? defaultPlan[turno] : [];
    const candidateIds = allChildren
      .filter((c) => {
        if (direction === 'pickup') {
          const p = c.pickupPeriod || c.period || 'morning';
          return p === period;
        }
        const p = c.dropoffPeriod || defaultDropoffFor(c.period) || 'afternoon';
        return p === period;
      })
      .map((c) => c.id);
    const orderSet = new Set(order);
    return [
      ...order.filter((id) => candidateIds.includes(id)),
      ...candidateIds.filter((id) => !orderSet.has(id)),
    ];
  }, [defaultPlan, allChildren, turno, period, direction]);

  const byId = useMemo(() => {
    const m = new Map();
    for (const c of allChildren) m.set(c.id, c);
    return m;
  }, [allChildren]);

  // Estado local da ordem em edição
  const [localOrder, setLocalOrder] = useState(items);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    // Sincroniza estado local quando o plano salvo muda externamente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalOrder(items);
    setDirty(false);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.indexOf(active.id);
    const newIndex = localOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setLocalOrder(arrayMove(localOrder, oldIndex, newIndex));
    setDirty(true);
  };

  const onSave = async () => {
    try {
      await setDefaultTurnoOrder(turno, localOrder);
      toast.success('Rota padrão salva!');
      setDirty(false);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar.');
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Planejar rota padrão" showBack />
        <div className="p-4 text-sm text-textMuted text-center py-10">
          Carregando...
        </div>
      </>
    );
  }

  if (availablePeriods.length === 0) {
    return (
      <>
        <Header title="Planejar rota padrão" showBack />
        <div className="p-4">
          <div className="bg-card rounded-2xl shadow-sm p-6 text-center text-sm text-textMuted">
            Cadastre crianças para que apareçam aqui.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Planejar rota padrão" showBack />

      <div className="p-4 space-y-4">
        {/* Intro */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 p-4">
          <p className="text-sm text-text font-semibold">
            Essa é a sua rota base
          </p>
          <p className="text-xs text-textMuted mt-1 leading-relaxed">
            Define a ordem que você usa todo dia. Mudanças pontuais (faltas,
            reordenar um dia específico) acontecem na tela de rota sem afetar
            essa base.
          </p>
        </div>

        {/* Tabs de período */}
        <Section label="Período">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {availablePeriods.map((p) => {
              const Icon = PERIOD_ICON[p];
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`tap shrink-0 px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 border ${
                    active
                      ? 'bg-text text-white border-text'
                      : 'bg-card text-textMuted border-gray-200'
                  }`}
                >
                  <Icon size={16} />
                  {PERIOD_LABEL[p]}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Toggle direção */}
        <Section label="Direção">
          <div className="grid grid-cols-2 gap-2">
            {DIRECTIONS.map((d) => {
              const Icon = d === 'pickup' ? Home : School;
              const label = d === 'pickup' ? 'Ida (casa → escola)' : 'Volta (escola → casa)';
              const active = direction === d;
              return (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`tap rounded-2xl p-3 border flex items-center gap-2 ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-semibold text-left leading-tight">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Lista arrastável */}
        <Section
          label={`${TURNO_SHORT_LABELS[turno]} · ${localOrder.length} ${
            localOrder.length === 1 ? 'criança' : 'crianças'
          }`}
        >
          {localOrder.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-sm p-6 text-center text-sm text-textMuted">
              Nenhuma criança neste turno.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={localOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {localOrder.map((id, idx) => {
                    const c = byId.get(id);
                    if (!c) return null;
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        index={idx + 1}
                        child={c}
                        direction={direction}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Section>

        {/* Botão salvar (fixo no rodapé visual quando dirty) */}
        <button
          onClick={onSave}
          disabled={!dirty}
          className={`tap w-full rounded-2xl py-4 px-4 font-bold text-base inline-flex items-center justify-center gap-2 transition-colors ${
            dirty
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-gray-200 text-textMuted'
          }`}
        >
          {dirty ? <Save size={18} /> : <CheckCircle2 size={18} />}
          {dirty ? 'Salvar ordem' : 'Sem mudanças'}
        </button>
      </div>
    </>
  );
}

function defaultDropoffFor(period) {
  if (period === 'morning') return 'afternoon';
  if (period === 'afternoon') return 'evening';
  return 'evening';
}

function Section({ label, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        {label}
      </h2>
      {children}
    </section>
  );
}

function SortableRow({ id, index, child, direction }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const address =
    direction === 'pickup'
      ? child.address || '—'
      : child.schoolAddress || child.school || '—';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card rounded-2xl shadow-sm p-3 flex items-center gap-2 border ${
        isDragging ? 'border-primary shadow-lg' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
        className="text-textMuted touch-none p-2 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </button>

      <div className="w-7 h-7 rounded-full bg-gray-100 text-textMuted text-xs font-bold flex items-center justify-center shrink-0">
        {index}
      </div>

      <Avatar
        photoURL={child.photoURL}
        gender={child.gender}
        seed={child.id}
        kind="child"
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{child.name}</p>
        <p className="text-[11px] text-textMuted truncate">{address}</p>
      </div>
    </div>
  );
}
