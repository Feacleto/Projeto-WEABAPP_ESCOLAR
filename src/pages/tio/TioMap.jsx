import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useChildren } from '../../hooks/useChildren';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useAbsences } from '../../hooks/useAbsences';
import {
  getCurrentPeriod,
  getDateKey,
  turnoKey,
  watchDefaultPlan,
  watchDailyRoute,
  resolveTurnoOrder,
} from '../../services/routePlanService';
import { ABSENCE_TYPES } from '../../services/absencesService';
import { getEffectiveStatus, STATUS_LABELS } from '../../services/childrenService';
import { createVanIcon, createHomeIcon } from '../../components/map/VanIcon';

/**
 * Tela cheia de mapa pro Tio. Layout 70/30 vertical:
 *   - 70% mapa: posição da perua + casa do "próximo aluno" da fila
 *   - 30% painel: progresso (X de Y), card do próximo aluno, endereço
 */
export default function TioMap() {
  const navigate = useNavigate();
  const { children: allChildren } = useChildren();
  const { position } = useGeolocation();
  const { location: liveLocation } = useLiveLocation();

  const dateKey = getDateKey();
  const { byChildId: declaredByChildId } = useAbsences(dateKey);

  const [defaultPlan, setDefaultPlan] = useState({});
  const [dailyRoute, setDailyRoute] = useState(null);
  const [period] = useState(getCurrentPeriod() || 'morning');
  // Direção é deduzida pelo período (ida = horário de entrada, volta = saída)
  // No MVP, deduzo: morning → pickup; afternoon → dropoff; evening → dropoff
  const direction =
    period === 'morning' ? 'pickup' : period === 'afternoon' ? 'dropoff' : 'dropoff';

  useEffect(() => {
    const u1 = watchDefaultPlan(setDefaultPlan, () => {});
    const u2 = watchDailyRoute(dateKey, setDailyRoute, () => {});
    return () => {
      u1?.();
      u2?.();
    };
  }, [dateKey]);

  const turno = turnoKey(period, direction);

  const byId = useMemo(() => {
    const m = new Map();
    for (const c of allChildren) m.set(c.id, { ...c, effectiveStatus: getEffectiveStatus(c) });
    return m;
  }, [allChildren]);

  // Ordem efetiva
  const order = useMemo(() => {
    const { order: o } = resolveTurnoOrder(defaultPlan, dailyRoute, turno);
    const candidateIds = allChildren
      .filter((c) => {
        if (direction === 'pickup') {
          const p = c.pickupPeriod || c.period || 'morning';
          return p === period;
        }
        return (c.dropoffPeriod || 'afternoon') === period;
      })
      .map((c) => c.id);
    const orderSet = new Set(o);
    return [
      ...o.filter((id) => candidateIds.includes(id)),
      ...candidateIds.filter((id) => !orderSet.has(id)),
    ];
  }, [defaultPlan, dailyRoute, allChildren, turno, period, direction]);

  // Marca quem é "ausente" considerando declarações
  const isAbsent = (childId) => {
    const decl = declaredByChildId[childId];
    if (!decl) return false;
    if (decl.type === ABSENCE_TYPES.FULL) return true;
    if (decl.type === ABSENCE_TYPES.NO_PICKUP && direction === 'pickup') return true;
    if (decl.type === ABSENCE_TYPES.NO_DROPOFF && direction === 'dropoff') return true;
    return false;
  };

  // Progresso: contar quantos já passaram pelo status alvo
  const totalEffective = order.filter((id) => !isAbsent(id)).length;
  const done = order.filter((id) => {
    if (isAbsent(id)) return false;
    const c = byId.get(id);
    if (!c) return false;
    // Pickup: feito se já tá atSchool ou delivered
    if (direction === 'pickup') {
      return c.effectiveStatus === 'atSchool' || c.effectiveStatus === 'delivered';
    }
    return c.effectiveStatus === 'delivered';
  }).length;
  const percent = totalEffective > 0 ? Math.round((done / totalEffective) * 100) : 0;

  // Próximo aluno: primeiro da ordem que ainda não terminou e não é ausente
  const nextChild = useMemo(() => {
    for (const id of order) {
      if (isAbsent(id)) continue;
      const c = byId.get(id);
      if (!c) continue;
      if (direction === 'pickup' && c.effectiveStatus === 'home') return c;
      if (direction === 'dropoff' && c.effectiveStatus === 'atSchool') return c;
      // Também considera onboard como "em trânsito" (entregar próximo)
      if (c.effectiveStatus === 'onboard') return c;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, byId, declaredByChildId, direction]);

  // Coordenadas pro mapa
  const van = position
    ? { lat: position.coords.latitude, lng: position.coords.longitude }
    : liveLocation?.lat && liveLocation?.lng
    ? { lat: liveLocation.lat, lng: liveLocation.lng }
    : null;

  const target =
    nextChild &&
    (direction === 'pickup'
      ? nextChild.lat && nextChild.lng
        ? { lat: nextChild.lat, lng: nextChild.lng }
        : null
      : nextChild.schoolLat && nextChild.schoolLng
      ? { lat: nextChild.schoolLat, lng: nextChild.schoolLng }
      : null);

  const center = van
    ? [van.lat, van.lng]
    : target
    ? [target.lat, target.lng]
    : [-23.55, -46.63];

  const vanIcon = useMemo(() => createVanIcon(), []);
  const homeIcon = useMemo(() => createHomeIcon(), []);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-30 bg-card border-b border-gray-100 h-14 px-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">Mapa da rota</p>
          <p className="text-[11px] text-textMuted truncate">
            {direction === 'pickup' ? 'Ida' : 'Volta'} ·{' '}
            {period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
          <Activity size={12} />
          {percent}%
        </span>
      </header>

      <div className="relative" style={{ height: 'min(70vh, 600px)' }}>
        <MapContainer
          center={center}
          zoom={14}
          scrollWheelZoom
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {van && <Marker position={[van.lat, van.lng]} icon={vanIcon} />}
          {target && <Marker position={[target.lat, target.lng]} icon={homeIcon} />}
        </MapContainer>
      </div>

      <div className="flex-1 bg-card -mt-4 rounded-t-3xl shadow-lg p-4 space-y-3">
        <div className="flex justify-center -mt-1 pb-1">
          <span className="block w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Progresso */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-bold text-text tabular-nums leading-none">
              {done} <span className="text-base text-textMuted font-medium">de {totalEffective}</span>
            </p>
            <p className="text-xs text-textMuted">{percent}% concluído</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Próximo */}
        {nextChild ? (
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-indigo-900">
                Próximo
              </p>
              <p className="text-sm font-bold text-text truncate">
                {nextChild.name}
              </p>
              <p className="text-[11px] text-textMuted truncate">
                {direction === 'pickup'
                  ? nextChild.address
                  : nextChild.schoolAddress || nextChild.school}
                {' · '}
                {STATUS_LABELS[nextChild.effectiveStatus]}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-50 p-3 text-center">
            <p className="text-sm font-bold text-emerald-700">
              Todas as paradas concluídas!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
