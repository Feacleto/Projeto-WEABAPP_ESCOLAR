import { useEffect, useState, useRef } from 'react';
import {
  Play,
  Square,
  AlertTriangle,
  Activity,
  MapPin,
  Clock,
  Gauge,
  Compass,
  ChevronDown,
  ChevronUp,
  Bus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { formatDateTime } from '../../utils/formatters';
import { playSound } from '../../services/soundService';
import RouteKanban from '../../components/route/RouteKanban';
import StartRouteSheet from '../../components/route/StartRouteSheet';

/**
 * Tela da Rota.
 *
 * Dois estados visuais bem diferentes:
 *   1. PARADO  — hero verde gigante "Pronto pra começar?" + Kanban embaixo
 *   2. EM ROTA — hero compacto "Em rota" com km/h em destaque + lista do
 *                turno + atalho pro mapa. Botão "Encerrar" lá embaixo.
 *
 * Confirmação dupla pra encerrar (toque + toque) evita acidentes durante
 * a condução.
 */
export default function TioRoute() {
  const { user } = useAuth();
  const { watching, position, error, stopping, start, stop } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  const [confirmStop, setConfirmStop] = useState(false);
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [telemetryExpanded, setTelemetryExpanded] = useState(false);
  const lastErrorCodeRef = useRef(null);

  // Só dispara toast quando o erro MUDA, pra não floodar a tela
  useEffect(() => {
    if (!error) {
      lastErrorCodeRef.current = null;
      return;
    }
    const code = error?.code ?? error?.message;
    if (code === lastErrorCodeRef.current) return;
    lastErrorCodeRef.current = code;

    if (error.code === 1) {
      toast.error('Permissão de localização negada. Habilite no navegador.');
    } else if (error.code === 2) {
      toast.error('Sinal de GPS indisponível.');
    } else if (error.code === 3) {
      toast.error('Tempo esgotado ao buscar localização.');
    } else if (error.message) {
      toast.error(error.message);
    }
  }, [error]);

  const onStart = () => {
    if (!user?.uid) {
      toast.error('Sessão expirada. Entre de novo.');
      return;
    }
    setStartSheetOpen(true);
  };

  const onConfirmStart = () => {
    setStartSheetOpen(false);
    start(user.uid);
    toast.success('Rota começou! GPS ligado.');
  };

  const onReorganizeBeforeStart = () => {
    setStartSheetOpen(false);
    setTimeout(() => {
      document.getElementById('route-kanban-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  const onStop = async () => {
    if (!confirmStop) {
      // Som de click no 1º toque — feedback "ouvi, agora confirma"
      playSound('click');
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 4000);
      return;
    }
    setConfirmStop(false);
    await stop(); // dispara playSound('end_route') no service
    toast.success('Turno encerrado.');
  };

  const acc = position?.coords?.accuracy ?? liveLocation?.accuracy;
  const speed = position?.coords?.speed ?? liveLocation?.speed;
  const heading = position?.coords?.heading ?? liveLocation?.heading;
  const lastUpdate = position
    ? new Date(position.timestamp)
    : liveLocation?.updatedAt;

  const speedKmh =
    speed != null && !isNaN(speed) ? Math.round(speed * 3.6) : null;

  return (
    <>
      <Header title="Rota" />

      <div className="p-5 space-y-5">
        {watching ? (
          // ─────────── EM ROTA ───────────
          <ActiveHero speedKmh={speedKmh} />
        ) : (
          // ─────────── PARADO ───────────
          <IdleHero onStart={onStart} />
        )}

        {/* Telemetria expansível — só em rota */}
        {watching && (
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setTelemetryExpanded((v) => !v)}
              className="tap w-full p-4 flex items-center gap-2"
            >
              <span className="text-sm font-semibold text-text flex-1 text-left">
                Detalhes do GPS
              </span>
              {telemetryExpanded ? (
                <ChevronUp size={16} className="text-textMuted" />
              ) : (
                <ChevronDown size={16} className="text-textMuted" />
              )}
            </button>
            {telemetryExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <Row
                  icon={MapPin}
                  label="Posição"
                  value={
                    position
                      ? `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`
                      : 'Aguardando...'
                  }
                />
                <Row
                  icon={Gauge}
                  label="Precisão"
                  value={acc != null ? `±${Math.round(acc)} m` : '—'}
                />
                <Row
                  icon={Compass}
                  label="Direção"
                  value={
                    heading != null && !isNaN(heading)
                      ? `${Math.round(heading)}°`
                      : '—'
                  }
                />
                <Row
                  icon={Clock}
                  label="Atualizado"
                  value={formatDateTime(lastUpdate)}
                />
                <p className="text-[11px] text-textMuted leading-relaxed">
                  Salvamos no servidor a cada 30s pra economizar bateria — os
                  pais veem com esse intervalo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aviso quando em rota — discreto */}
        {watching && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-xs leading-relaxed">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>
              <strong>Mantenha o app aberto durante a rota.</strong> Você pode
              trocar de aba dentro do app — o GPS continua.
            </p>
          </div>
        )}

        {/* Kanban — planejamento / gerenciamento da rota */}
        <div id="route-kanban-anchor" className="pt-1 scroll-mt-4 space-y-2">
          <div>
            <h2 className="text-base font-bold text-text">
              {watching ? 'Crianças desta rota' : 'Como tá a fila de hoje'}
            </h2>
            <p className="text-xs text-textMuted">
              Arraste pra reordenar · "Faltou" pra marcar ausência
            </p>
          </div>
          <RouteKanban />
        </div>

        {/* Botão encerrar — só em rota, no fim de tudo */}
        {watching && (
          <Button
            variant="danger"
            icon={Square}
            loading={stopping}
            onClick={onStop}
            className={
              confirmStop
                ? 'ring-4 ring-red-300 animate-pulse !h-14 !text-base'
                : '!h-14 !text-base'
            }
          >
            {confirmStop ? 'Toque novamente pra confirmar' : 'Encerrar turno'}
          </Button>
        )}
      </div>

      <StartRouteSheet
        open={startSheetOpen}
        onClose={() => setStartSheetOpen(false)}
        onConfirm={onConfirmStart}
        onReorganize={onReorganizeBeforeStart}
      />
    </>
  );
}

/* ─────────────── HEROS ─────────────── */

function IdleHero({ onStart }) {
  return (
    <button
      onClick={onStart}
      data-tour="start-route"
      className="tap w-full text-left rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25"
    >
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-3xl font-bold leading-tight">
              Pronto pra começar?
            </p>
            <p className="text-white/85 mt-2">
              Veja a fila e dê o play quando quiser
            </p>
          </div>
          <Bus size={40} strokeWidth={1.6} className="text-white/90 shrink-0" />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 bg-white text-emerald-700 rounded-full px-5 py-3 font-bold shadow-md">
          <Play size={18} fill="currentColor" /> Começar agora
        </div>
      </div>
    </button>
  );
}

function ActiveHero({ speedKmh }) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25">
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <span className="relative inline-flex">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          Em rota · ao vivo
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-7xl font-bold leading-none tabular-nums">
              {speedKmh != null ? speedKmh : '—'}
            </p>
            <p className="text-white/90 text-xl font-semibold mt-1">km/h</p>
          </div>
          <Activity size={36} className="text-white/80" />
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-xs text-textMuted">
        <Icon size={14} />
        {label}
      </span>
      <span className="text-sm font-medium text-text font-mono text-right">
        {value}
      </span>
    </div>
  );
}
