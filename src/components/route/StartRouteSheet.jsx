import { useEffect, useMemo, useState } from 'react';
import { X, Play, ListOrdered, UserX, MapPin, ChevronDown } from 'lucide-react';
import { useChildren } from '../../hooks/useChildren';
import { useAbsences } from '../../hooks/useAbsences';
import {
  PERIODS,
  DIRECTIONS,
  TURNO_SHORT_LABELS,
  getCurrentPeriod,
  getDateKey,
  turnoKey,
  watchDefaultPlan,
  watchDailyRoute,
  resolveTurnoOrder,
} from '../../services/routePlanService';
import { ABSENCE_TYPES, ABSENCE_SHORT } from '../../services/absencesService';

const PERIOD_LABEL = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

/**
 * Sheet de "Iniciar rota". Mostra preview da rota padrão de um turno (com
 * ausências já aplicadas) e oferece 2 caminhos:
 *   - Confirmar: chama `onConfirm()` que inicia o GPS
 *   - Reorganizar: chama `onReorganize()` que fecha o sheet pra o Tio
 *     editar o Kanban do dia antes de iniciar.
 *
 * Props:
 *   - open
 *   - onClose
 *   - onConfirm
 *   - onReorganize
 */
export default function StartRouteSheet({ open, onClose, onConfirm, onReorganize }) {
  const { children: allChildren } = useChildren();
  const dateKey = getDateKey();
  const { byChildId: declaredByChildId } = useAbsences(dateKey);

  const [defaultPlan, setDefaultPlan] = useState({});
  const [dailyRoute, setDailyRoute] = useState(null);

  // Defaults: período atual ou primeiro disponível, direção ida.
  const initialPeriod = getCurrentPeriod() || 'morning';
  const [period, setPeriod] = useState(initialPeriod);
  const [direction, setDirection] = useState('pickup');

  useEffect(() => {
    if (!open) return;
    const u1 = watchDefaultPlan(setDefaultPlan, () => {});
    const u2 = watchDailyRoute(dateKey, setDailyRoute, () => {});
    return () => {
      u1?.();
      u2?.();
    };
  }, [open, dateKey]);

  // Lista os períodos que têm pelo menos uma criança no turno escolhido
  const availablePeriods = useMemo(() => {
    const set = new Set();
    for (const c of allChildren) {
      if (direction === 'pickup') {
        set.add(c.pickupPeriod || c.period || 'morning');
      } else {
        set.add(c.dropoffPeriod || 'afternoon');
      }
    }
    return PERIODS.filter((p) => set.has(p));
  }, [allChildren, direction]);

  useEffect(() => {
    if (availablePeriods.length === 0) return;
    if (!availablePeriods.includes(period)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, period]);

  const turno = turnoKey(period, direction);

  // Resolve a ordem efetiva pro turno (daily > default)
  const items = useMemo(() => {
    const { order } = resolveTurnoOrder(defaultPlan, dailyRoute, turno);
    const candidateIds = allChildren
      .filter((c) => {
        if (direction === 'pickup') {
          const p = c.pickupPeriod || c.period || 'morning';
          return p === period;
        }
        return (c.dropoffPeriod || 'afternoon') === period;
      })
      .map((c) => c.id);
    const orderSet = new Set(order);
    return [
      ...order.filter((id) => candidateIds.includes(id)),
      ...candidateIds.filter((id) => !orderSet.has(id)),
    ];
  }, [defaultPlan, dailyRoute, allChildren, turno, period, direction]);

  const byId = useMemo(() => {
    const m = new Map();
    for (const c of allChildren) m.set(c.id, c);
    return m;
  }, [allChildren]);

  // Conta ausentes efetivos pro turno
  const absentCount = useMemo(() => {
    let n = 0;
    for (const id of items) {
      const decl = declaredByChildId[id];
      if (!decl) continue;
      if (
        decl.type === ABSENCE_TYPES.FULL ||
        (decl.type === ABSENCE_TYPES.NO_PICKUP && direction === 'pickup') ||
        (decl.type === ABSENCE_TYPES.NO_DROPOFF && direction === 'dropoff')
      ) {
        n++;
      }
    }
    return n;
  }, [items, declaredByChildId, direction]);

  if (!open) return null;

  const effective = items.length - absentCount;

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text leading-tight">
              Iniciar rota
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Confira a fila antes de começar
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs período + direção */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {availablePeriods.map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`tap shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    active
                      ? 'bg-text text-white border-text'
                      : 'bg-card text-textMuted border-gray-200'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DIRECTIONS.map((d) => {
              const active = direction === d;
              return (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`tap rounded-xl py-2 text-xs font-semibold border ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  {d === 'pickup' ? 'Ida (casa → escola)' : 'Volta (escola → casa)'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumo */}
        <div className="px-5 pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest font-semibold text-emerald-900">
                {TURNO_SHORT_LABELS[turno]}
              </p>
              <p className="text-sm font-bold text-text">
                {effective} {effective === 1 ? 'parada' : 'paradas'} hoje
                {absentCount > 0 && (
                  <span className="text-xs font-medium text-textMuted ml-2">
                    · {absentCount} {absentCount === 1 ? 'ausente' : 'ausentes'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Lista preview com scroll interno */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {items.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-textMuted">
              Nenhuma criança nesse turno.
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((id, idx) => {
                const c = byId.get(id);
                if (!c) return null;
                const decl = declaredByChildId[id];
                const isAbsent =
                  decl &&
                  (decl.type === ABSENCE_TYPES.FULL ||
                    (decl.type === ABSENCE_TYPES.NO_PICKUP &&
                      direction === 'pickup') ||
                    (decl.type === ABSENCE_TYPES.NO_DROPOFF &&
                      direction === 'dropoff'));
                return (
                  <PreviewRow
                    key={id}
                    index={idx + 1}
                    name={c.name}
                    address={
                      direction === 'pickup'
                        ? c.address
                        : c.schoolAddress || c.school
                    }
                    isAbsent={isAbsent}
                    absenceType={decl?.type}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com 2 botões */}
        <div className="px-5 pt-2 pb-3 space-y-2 border-t border-gray-100 bg-card">
          <button
            onClick={onConfirm}
            className="tap w-full rounded-2xl py-3.5 bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 inline-flex items-center justify-center gap-2"
          >
            <Play size={18} />
            Iniciar essa rota
          </button>
          <button
            onClick={onReorganize}
            className="tap w-full rounded-2xl py-3.5 bg-gray-100 text-text font-semibold inline-flex items-center justify-center gap-2"
          >
            <ListOrdered size={18} />
            Reorganizar hoje
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ index, name, address, isAbsent, absenceType }) {
  return (
    <div
      className={`rounded-xl p-2.5 flex items-center gap-2.5 ${
        isAbsent
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-card border border-gray-100'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
          isAbsent ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-textMuted'
        }`}
      >
        {isAbsent ? <UserX size={14} /> : index}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            isAbsent ? 'text-amber-900 line-through' : 'text-text'
          }`}
        >
          {name}
        </p>
        <p className="text-[11px] text-textMuted truncate">
          {isAbsent
            ? ABSENCE_SHORT[absenceType] || 'Ausente'
            : address || 'Sem endereço'}
        </p>
      </div>
      {!isAbsent && <ChevronDown size={14} className="text-textMuted opacity-0" />}
    </div>
  );
}
