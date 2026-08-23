import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import KanbanColumn from './KanbanColumn';
import ConfirmDialog from '../common/ConfirmDialog';
import { X } from 'lucide-react';
import { useChildren } from '../../hooks/useChildren';
import { useAbsences } from '../../hooks/useAbsences';
import { useAllAltPickups } from '../../hooks/useAltPickup';
import {
  getEffectiveStatus,
  updateChildStatus,
  STATUS_LABELS,
} from '../../services/childrenService';
import { advanceChild } from '../../services/routeStatusService';
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
  setDailyTurnoOrder,
  toggleAbsence,
} from '../../services/routePlanService';
import { ABSENCE_TYPES, notifyAbsence } from '../../services/absencesService';

/**
 * Kanban completo de rota. Mostra todas as colunas que têm crianças,
 * com a coluna do turno ATUAL destacada.
 *
 * Quem pertence a qual turno:
 *   - {period}-pickup: crianças com pickupPeriod == period
 *   - {period}-dropoff: crianças com dropoffPeriod == period
 *
 * A ordem efetiva sai de routePlanService.resolveTurnoOrder (daily > default).
 * Crianças que NÃO estão nem no order nem no plan default mas pertencem ao
 * turno (ex: cadastro recém-feito) entram no fim automaticamente.
 */
export default function RouteKanban() {
  const { children: allChildren, loading } = useChildren();

  const [defaultPlan, setDefaultPlan] = useState({});
  const [dailyRoute, setDailyRoute] = useState(null);
  const [dateKey] = useState(getDateKey());
  const [currentPeriod, setCurrentPeriod] = useState(getCurrentPeriod());
  // Declarações de ausência (pai ou tio) do dia — mescla com dailyRoute.absent
  const { byChildId: declaredByChildId } = useAbsences(dateKey);
  // Indicações de quem vai buscar hoje (alt responsibles)
  const { byChildId: altPickupByChildId } = useAllAltPickups(dateKey);

  // Modal de ausência
  const [absencePicker, setAbsencePicker] = useState(null); // { childId, name }

  // Re-avalia o período atual a cada minuto (sem espalhar timers caros)
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentPeriod(getCurrentPeriod());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // Subscribes
  useEffect(() => {
    const unsub = watchDefaultPlan(setDefaultPlan, () => {});
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = watchDailyRoute(dateKey, setDailyRoute, () => {});
    return unsub;
  }, [dateKey]);

  // Map id -> child enriquecido com effectiveStatus
  const byId = useMemo(() => {
    const m = new Map();
    for (const c of allChildren) {
      m.set(c.id, { ...c, effectiveStatus: getEffectiveStatus(c) });
    }
    return m;
  }, [allChildren]);

  // Lista os turnos que têm crianças (com base em pickup/dropoffPeriod).
  // Crianças legacy sem esses campos: fallback do `period`.
  const turnos = useMemo(() => {
    const list = [];
    for (const period of PERIODS) {
      for (const direction of DIRECTIONS) {
        const key = turnoKey(period, direction);
        const candidateIds = allChildren
          .filter((c) => {
            const pickupP = c.pickupPeriod || c.period || 'morning';
            const dropoffP =
              c.dropoffPeriod || defaultDropoffFor(c.period) || 'afternoon';
            if (direction === 'pickup') return pickupP === period;
            return dropoffP === period;
          })
          .map((c) => c.id);
        if (candidateIds.length === 0) continue;

        // Resolve ordem efetiva e adiciona crianças que estão no turno mas
        // não estão no order (ex: cadastro novo após plano salvo).
        const { order, absent } = resolveTurnoOrder(
          defaultPlan,
          dailyRoute,
          key
        );
        const orderSet = new Set(order);
        const finalOrder = [
          ...order.filter((id) => candidateIds.includes(id)),
          ...candidateIds.filter((id) => !orderSet.has(id)),
        ];

        // Mescla declarações dos pais. Cada tipo de declaração mapeia:
        //   - full       -> ausente em pickup E dropoff
        //   - no-pickup  -> ausente só nos turnos de pickup (pai vai levar)
        //   - no-dropoff -> ausente só nos turnos de dropoff (pai vai buscar)
        const absentSet = new Set(absent);
        const declaredInfo = {};
        for (const childId of finalOrder) {
          const decl = declaredByChildId[childId];
          if (!decl) continue;
          const t = decl.type;
          const applies =
            t === ABSENCE_TYPES.FULL ||
            (t === ABSENCE_TYPES.NO_PICKUP && direction === 'pickup') ||
            (t === ABSENCE_TYPES.NO_DROPOFF && direction === 'dropoff');
          if (applies) {
            absentSet.add(childId);
            declaredInfo[childId] = decl;
          }
        }

        list.push({
          key,
          period,
          direction,
          order: finalOrder,
          absent: absentSet,
          declaredInfo,
        });
      }
    }
    return list;
  }, [allChildren, defaultPlan, dailyRoute, declaredByChildId]);

  const onReorder = async (turno, newOrder) => {
    try {
      await setDailyTurnoOrder(dateKey, turno, newOrder);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a nova ordem.');
    }
  };

  // O KanbanCard já sabe a direction do turno e calcula o nextStatus correto
  // (via getActionForStatus). Recebemos o nextStatus pronto e só persistimos.
  const onAdvance = async (childId, nextStatus) => {
    const child = byId.get(childId);
    if (!child || !nextStatus) return;
    try {
      await advanceChild(childId, nextStatus);
      toast.success(`${child.name}: ${STATUS_LABELS[nextStatus] || nextStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
  };

  const onMarkAbsentRequest = (childId) => {
    const child = byId.get(childId);
    if (!child) return;
    setAbsencePicker({ childId, name: child.name });
  };

  const onPickAbsence = async (when) => {
    if (!absencePicker) return;
    const { childId } = absencePicker;
    const child = byId.get(childId);
    if (!child) return;

    const turnoKeys = [];
    if (when === 'pickup' || when === 'both') {
      turnoKeys.push(turnoKey(child.pickupPeriod, 'pickup'));
    }
    if (when === 'dropoff' || when === 'both') {
      turnoKeys.push(turnoKey(child.dropoffPeriod, 'dropoff'));
    }

    try {
      for (const t of turnoKeys) {
        await toggleAbsence(dateKey, t, childId, 'add');
      }
      // Regra de produto: ausência APENAS no pickup (pai vai levar pra escola)
      // → status vira 'atSchool' pra que o turno de dropoff funcione.
      // Ausência APENAS no dropoff (pai vai buscar) → mantém o fluxo da manhã.
      // Ausência NOS DOIS (criança faltou totalmente) → status fica 'home',
      // ela não passa em nenhum turno.
      if (when === 'pickup') {
        await updateChildStatus(childId, 'atSchool');
      }

      // Notifica o pai vinculado (fire-and-forget)
      if (child.parentUid) {
        const absenceType =
          when === 'pickup'
            ? ABSENCE_TYPES.NO_PICKUP
            : when === 'dropoff'
            ? ABSENCE_TYPES.NO_DROPOFF
            : ABSENCE_TYPES.FULL;
        notifyAbsence({
          child: { name: child.name, parentUid: child.parentUid },
          type: absenceType,
          dateKey,
          declaredBy: 'admin',
        });
      }

      toast.success(`${child.name} marcado(a) como ausente.`);
      setAbsencePicker(null);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível marcar como ausente.');
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-textMuted text-center py-6">
        Carregando rota...
      </div>
    );
  }

  if (turnos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-card p-6 text-center text-sm text-textMuted">
        Cadastre crianças para que elas apareçam na rota.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {turnos.map((t) => {
          const enrichedChildren = t.order
            .map((id) => byId.get(id))
            .filter(Boolean);
          return (
            <KanbanColumn
              key={t.key}
              turno={t.key}
              title={TURNO_SHORT_LABELS[t.key]}
              subtitle={
                t.direction === 'pickup'
                  ? 'Casa → Escola'
                  : 'Escola → Casa'
              }
              direction={t.direction}
              isActive={currentPeriod === t.period}
              children={enrichedChildren}
              absentIds={t.absent}
              declaredInfo={t.declaredInfo}
              altPickupInfo={altPickupByChildId}
              onReorder={(newOrder) => onReorder(t.key, newOrder)}
              onAdvance={onAdvance}
              onMarkAbsent={onMarkAbsentRequest}
            />
          );
        })}
      </div>

      {/* Modal: escolher quando a criança está ausente */}
      {absencePicker && (
        <AbsencePickerModal
          name={absencePicker.name}
          onClose={() => setAbsencePicker(null)}
          onPick={onPickAbsence}
        />
      )}
    </>
  );
}

function defaultDropoffFor(period) {
  // Heurística pra crianças sem dropoffPeriod explícito (cadastros antigos):
  //   - estuda manhã -> volta tarde
  //   - estuda tarde -> volta noite
  //   - estuda noite -> volta noite (degenerado mas não crasha)
  if (period === 'morning') return 'afternoon';
  if (period === 'afternoon') return 'evening';
  return 'evening';
}

function AbsencePickerModal({ name, onClose, onPick }) {
  const [confirming, setConfirming] = useState(null); // 'pickup' | 'dropoff' | 'both'

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 pt-20"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-mobile bg-card rounded-2xl shadow-xl p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 p-1 text-textMuted tap"
          >
            <X size={20} />
          </button>

          <h3 className="text-lg font-bold text-text">Marcar ausência</h3>
          <p className="text-sm text-textMuted mt-1 mb-4">
            <strong className="text-text">{name}</strong> não vai precisar do
            transporte hoje em qual turno?
          </p>

          <div className="space-y-2">
            <Choice
              label="Apenas a coleta (pai/mãe vai levar)"
              hint="Você ainda busca à tarde na escola pra trazer pra casa."
              onClick={() => setConfirming('pickup')}
            />
            <Choice
              label="Apenas a entrega (pai/mãe vai buscar)"
              hint="Você coleta normal de manhã, mas não precisa levar pra casa."
              onClick={() => setConfirming('dropoff')}
            />
            <Choice
              label="O dia todo (faltou na escola)"
              hint="Não precisa coletar nem entregar hoje."
              onClick={() => setConfirming('both')}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirming}
        title="Confirmar ausência?"
        description={
          confirming === 'pickup'
            ? `${name} não vai precisar da coleta de hoje. Você só busca à tarde na escola.`
            : confirming === 'dropoff'
            ? `${name} não vai precisar da entrega de hoje. Você coleta normal pela manhã.`
            : `${name} não vai usar o transporte hoje em nenhum turno.`
        }
        confirmLabel="Sim, marcar ausente"
        onConfirm={() => {
          onPick(confirming);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function Choice({ label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-gray-200 bg-card hover:bg-gray-50 tap"
    >
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className="text-xs text-textMuted mt-0.5">{hint}</p>
    </button>
  );
}
