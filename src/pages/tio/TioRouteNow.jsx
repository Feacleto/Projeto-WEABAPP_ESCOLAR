import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  UserX,
  Phone,
  CheckCircle2,
  MapPin,
  Sunrise,
  Sunset,
  Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useChildren } from '../../hooks/useChildren';
import { useAbsences } from '../../hooks/useAbsences';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { getEffectiveStatus } from '../../services/childrenService';
import {
  getActionForStatus,
  advanceChild,
  advanceMany,
} from '../../services/routeStatusService';
import {
  getCurrentPeriod,
  getDateKey,
  turnoKey,
  resolveTurnoOrder,
  watchDefaultPlan,
  watchDailyRoute,
  toggleAbsence,
  TURNO_SHORT_LABELS,
} from '../../services/routePlanService';
import { ABSENCE_TYPES } from '../../services/absencesService';

const PERIOD_ICONS = { morning: Sunrise, afternoon: Sunset, evening: Moon };
const PERIOD_NAMES = { morning: 'Manhã', afternoon: 'Tarde', evening: 'Noite' };

/**
 * "Rota agora" — a tela de operação em movimento.
 *
 * POR QUE ELA EXISTE
 * O kanban mostra os SEIS turnos (3 períodos × ida e volta) ao mesmo tempo,
 * e pra mover uma criança o tio precisa abrir o cartão e tocar em "Avançar".
 * Com vinte crianças isso são mais de quarenta toques precisos, dirigindo.
 *
 * Aqui: um turno só, deduzido do relógio (getCurrentPeriod já existia e não
 * era usado pra isso), uma criança em foco e um botão que ocupa a largura da
 * tela. O kanban continua existindo como visão avançada.
 */
export default function TioRouteNow() {
  const navigate = useNavigate();
  const dateKey = getDateKey();

  const { children, loading: childrenLoading } = useChildren();
  const { byChildId: absenceByChild } = useAbsences(dateKey);

  // Posição que o rastreamento já gravou — não pedimos GPS na hora.
  const { location: liveLocation } = useLiveLocation();

  const [defaultPlan, setDefaultPlan] = useState(null);
  const [dailyRoute, setDailyRoute] = useState(null);
  const [direction, setDirection] = useState(null); // null = deduzir
  const [busy, setBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [absenceFor, setAbsenceFor] = useState(null);

  useEffect(() => watchDefaultPlan(setDefaultPlan, console.error), []);
  useEffect(
    () => watchDailyRoute(dateKey, setDailyRoute, console.error),
    [dateKey]
  );

  const period = getCurrentPeriod() || 'morning';

  // Direção padrão pelo período: manhã leva pra escola, tarde/noite traz de
  // volta. É o que acontece na prática — e o tio pode trocar num toque.
  const effectiveDirection =
    direction ?? (period === 'morning' ? 'pickup' : 'dropoff');
  const turno = turnoKey(period, effectiveDirection);

  const byId = useMemo(
    () => new Map((children || []).map((c) => [c.id, c])),
    [children]
  );

  /** Fila do turno, sem quem faltou, com a ação de cada criança resolvida. */
  const queue = useMemo(() => {
    if (!children) return [];
    const order = resolveTurnoOrder(defaultPlan, dailyRoute, turno) || [];
    return order
      .map((id) => byId.get(id))
      .filter(Boolean)
      .filter((c) => c.active !== false)
      .filter((c) => {
        const decl = absenceByChild?.[c.id];
        if (!decl) return true;
        const t = decl.type;
        if (t === ABSENCE_TYPES.FULL) return false;
        if (t === ABSENCE_TYPES.NO_PICKUP && effectiveDirection === 'pickup')
          return false;
        if (t === ABSENCE_TYPES.NO_DROPOFF && effectiveDirection === 'dropoff')
          return false;
        return true;
      })
      .map((c) => {
        const status = getEffectiveStatus(c);
        return {
          child: c,
          status,
          action: getActionForStatus(status, effectiveDirection),
        };
      });
  }, [children, byId, defaultPlan, dailyRoute, turno, absenceByChild, effectiveDirection]);

  // Tudo que deriva da fila sai do MESMO memo. Derivar `pending` fora e
  // memoizar `bulk` em cima dele fazia o React Compiler desistir de
  // memoizar a árvore inteira ("Compilation Skipped").
  const { pending, done, focus, upNext, bulk } = useMemo(() => {
    const p = queue.filter((q) => q.action);

    // Ação em lote só faz sentido quando várias crianças esperam o MESMO passo.
    let b = null;
    if (p.length >= 2) {
      const first = p[0].action.nextStatus;
      const same = p.filter((q) => q.action.nextStatus === first);
      if (same.length >= 2) {
        b = {
          nextStatus: first,
          label: p[0].action.shortLabel,
          count: same.length,
          moves: same.map((q) => ({ childId: q.child.id, nextStatus: first })),
        };
      }
    }

    return {
      pending: p,
      done: queue.length - p.length,
      focus: p[0] || null,
      upNext: p.slice(1, 5),
      bulk: b,
    };
  }, [queue]);

  const onAdvanceOne = async (childId, nextStatus, name) => {
    setBusy(true);
    try {
      // Contexto pra registrar DE ONDE a entrega foi marcada. Se o
      // rastreamento não está ativo, vai sem — melhor sem rastro que
      // travar a ação do tio no meio da rua.
      const child = byId.get(childId);
      await advanceChild(childId, nextStatus, {
        driverPosition:
          liveLocation?.routeActive && liveLocation?.lat
            ? { lat: liveLocation.lat, lng: liveLocation.lng }
            : null,
        home:
          child?.lat != null ? { lat: child.lat, lng: child.lng } : null,
        school:
          child?.schoolLat != null
            ? { lat: child.schoolLat, lng: child.schoolLng }
            : null,
      });
      toast.success(`${name}: pronto`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const onAdvanceBulk = async () => {
    if (!bulk) return;
    setBusy(true);
    try {
      const n = await advanceMany(bulk.moves);
      toast.success(`${n} crianças atualizadas.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar todas. Confira a lista.');
    } finally {
      setBusy(false);
      setConfirmBulk(null);
    }
  };

  const onMarkAbsent = async () => {
    if (!absenceFor) return;
    setBusy(true);
    try {
      await toggleAbsence(dateKey, turno, absenceFor.id, 'add');
      toast.success(`${absenceFor.name} marcado como falta.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra marcar a falta.');
    } finally {
      setBusy(false);
      setAbsenceFor(null);
    }
  };

  const PeriodIcon = PERIOD_ICONS[period] || Sunrise;

  return (
    <div className="min-h-screen pb-28">
      <Header title="Rota agora" />

      <div className="px-5 pt-4 space-y-4">
        {/* Qual turno o app assumiu — e como trocar num toque */}
        <div className="bg-card border border-gray-200 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <PeriodIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text leading-tight">
                {TURNO_SHORT_LABELS[turno] || PERIOD_NAMES[period]}
              </p>
              <p className="text-[11px] text-textMuted">
                {done > 0
                  ? `${done} de ${queue.length} já resolvidas`
                  : `${queue.length} ${queue.length === 1 ? 'criança' : 'crianças'} neste turno`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
            {['pickup', 'dropoff'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                aria-pressed={effectiveDirection === d}
                className={`tap py-2 text-xs font-semibold rounded-lg transition-colors ${
                  effectiveDirection === d
                    ? 'bg-card text-text shadow-sm'
                    : 'text-textMuted'
                }`}
              >
                {d === 'pickup' ? 'Levando pra escola' : 'Trazendo pra casa'}
              </button>
            ))}
          </div>
        </div>

        {childrenLoading && <Skeleton className="h-56 rounded-2xl" />}

        {!childrenLoading && queue.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="Nenhuma criança neste turno"
            description="Monte a fila na tela de planejamento e ela aparece aqui."
            action={
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => navigate('/tio/route/plan')}
              >
                Planejar rota
              </Button>
            }
          />
        )}

        {!childrenLoading && queue.length > 0 && !focus && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
            <CheckCircle2 size={40} className="text-emerald-600 mx-auto" />
            <p className="font-bold text-text">Turno concluído!</p>
            <p className="text-sm text-emerald-900/75">
              Todas as {queue.length} crianças deste turno foram atendidas.
            </p>
          </div>
        )}

        {/* A criança em foco */}
        {focus && (
          <div className="bg-card border-2 border-primary rounded-2xl p-4 space-y-3 shadow-lg shadow-emerald-600/15">
            <div className="flex items-center gap-3">
              <Avatar
                photoURL={focus.child.photoURL}
                gender={focus.child.gender}
                seed={focus.child.id}
                kind="child"
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-text leading-tight truncate">
                  {focus.child.name}
                </p>
                <p className="text-xs text-textMuted truncate">
                  {effectiveDirection === 'pickup'
                    ? focus.child.address || 'Sem endereço'
                    : focus.child.address || 'Sem endereço'}
                </p>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
                próxima
              </span>
            </div>

            {/* 62 px: é o botão que ele aperta com o veículo em movimento */}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onAdvanceOne(
                  focus.child.id,
                  focus.action.nextStatus,
                  focus.child.name
                )
              }
              className="tap w-full rounded-2xl bg-primary text-white font-extrabold text-base tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ height: 62 }}
            >
              <CheckCircle2 size={22} />
              {focus.action.shortLabel}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={UserX}
                disabled={busy}
                onClick={() =>
                  setAbsenceFor({ id: focus.child.id, name: focus.child.name })
                }
              >
                Faltou
              </Button>
              {focus.child.parentPhone ? (
                <a
                  href={`tel:${focus.child.parentPhone}`}
                  className="tap h-10 rounded-xl bg-card border border-gray-200 text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Phone size={14} />
                  Ligar
                </a>
              ) : (
                <Button size="sm" variant="ghost" disabled>
                  Sem telefone
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lote — uma parada é um evento, não vinte */}
        {bulk && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmBulk(bulk)}
            className="tap w-full rounded-2xl bg-secondary text-[#3B2600] font-extrabold text-sm flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 py-4"
          >
            <span>{bulk.label} — TODOS OS {bulk.count}</span>
            <span className="text-[11px] font-semibold opacity-75">
              depois marque só quem faltou
            </span>
          </button>
        )}

        {/* Quem vem depois */}
        {upNext.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              depois {focus ? `do ${focus.child.name.split(' ')[0]}` : ''}
            </p>
            {upNext.map((q) => (
              <div
                key={q.child.id}
                className="bg-card border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5"
              >
                <Avatar
                  photoURL={q.child.photoURL}
                  gender={q.child.gender}
                  seed={q.child.id}
                  kind="child"
                  size="sm"
                />
                <span className="text-sm font-semibold text-text flex-1 min-w-0 truncate">
                  {q.child.name}
                </span>
                <span className="text-[11px] text-textMuted shrink-0 truncate max-w-[45%]">
                  {q.child.address?.split(',')[0] || ''}
                </span>
              </div>
            ))}
            {pending.length > 5 && (
              <p className="text-xs text-textMuted text-center">
                e mais {pending.length - 5}
              </p>
            )}
          </section>
        )}

        <Button
          variant="ghost"
          size="md"
          icon={LayoutGrid}
          onClick={() => navigate('/tio/route')}
        >
          Ver os seis turnos (visão avançada)
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirmBulk}
        title={
          confirmBulk
            ? `${confirmBulk.label.toLowerCase()} — ${confirmBulk.count} crianças`
            : ''
        }
        description="Todas de uma vez. Se alguma faltou, você corrige na lista depois."
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={onAdvanceBulk}
        onCancel={() => setConfirmBulk(null)}
      />

      <ConfirmDialog
        open={!!absenceFor}
        title={absenceFor ? `${absenceFor.name} faltou?` : ''}
        description="Ela sai da fila deste turno."
        confirmLabel="Marcar falta"
        variant="danger"
        loading={busy}
        onConfirm={onMarkAbsent}
        onCancel={() => setAbsenceFor(null)}
      />
    </div>
  );
}
