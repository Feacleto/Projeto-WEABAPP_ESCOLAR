import { ArrowLeft, Bus, Home, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LiveMap from '../../components/map/LiveMap';
import Skeleton from '../../components/common/Skeleton';
import StatusBadge from '../../components/children/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { haversineDistance } from '../../utils/haversine';
import { getEffectiveStatus, STATUS_LABELS } from '../../services/childrenService';
import { formatDateTime } from '../../utils/formatters';

const NEAR_KM = 2;
const ARRIVED_KM = 0.4;

/**
 * Tela cheia de mapa pro Pai. Layout 70/30 vertical:
 *  - 70% mapa (com home + van quando rota ativa)
 *  - 30% painel inferior com status da criança, distância, tempo estimado
 *    e botão "Falar com Tio" (WhatsApp).
 */
export default function PaiMap() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { child, loading } = useChild(profile?.childId);
  const { location: liveLocation } = useLiveLocation();
  const { admin } = useAdminProfile();

  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;
  const routeActive = !!liveLocation?.routeActive;
  const van =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  const distanceKm =
    van && home ? haversineDistance(home.lat, home.lng, van.lat, van.lng) : null;

  const whatsappUrl = admin?.phone
    ? `https://wa.me/55${String(admin.phone).replace(/\D/g, '')}`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  const status = child ? getEffectiveStatus(child) : 'home';

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header flutuante minimal */}
      <header className="sticky top-0 z-30 bg-card border-b border-gray-100 h-14 px-3 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">
            Mapa ao vivo
          </p>
          <p className="text-[11px] text-textMuted truncate">
            {child?.name || 'Sua criança'}
          </p>
        </div>
        {routeActive && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            AO VIVO
          </span>
        )}
      </header>

      {/* Mapa — 70% */}
      <div className="relative" style={{ height: 'min(70vh, 600px)' }}>
        {home ? (
          <LiveMap van={van} home={home} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-4">
            <p className="text-sm text-textMuted">
              Endereço residencial ainda não cadastrado.
            </p>
          </div>
        )}
      </div>

      {/* Painel inferior — 30% */}
      <div className="flex-1 bg-card -mt-4 rounded-t-3xl shadow-lg p-4 space-y-3">
        <div className="flex justify-center -mt-1 pb-1">
          <span className="block w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-textMuted">Status</p>
            <p className="text-lg font-bold text-text leading-tight">
              {STATUS_LABELS[status]}
            </p>
          </div>
          <StatusBadge status={status} size="lg" />
        </div>

        {/* Distância / ETA */}
        {routeActive && distanceKm != null ? (
          <DistanceCard distanceKm={distanceKm} />
        ) : (
          <div className="rounded-2xl bg-gray-50 p-3 text-xs text-textMuted">
            <p className="font-semibold text-text">
              Tio Nino não está em rota agora
            </p>
            {liveLocation?.updatedAt && (
              <p className="mt-0.5">
                Última atualização: {formatDateTime(liveLocation.updatedAt)}
              </p>
            )}
          </div>
        )}

        {/* WhatsApp */}
        <button
          onClick={() => {
            if (whatsappUrl) window.open(whatsappUrl, '_blank');
            else toast('Telefone do motorista não cadastrado ainda.');
          }}
          disabled={!whatsappUrl}
          className="tap w-full rounded-2xl py-3 bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <MessageCircle size={18} />
          Falar com o Tio
        </button>
      </div>
    </div>
  );
}

function DistanceCard({ distanceKm }) {
  const zone =
    distanceKm > NEAR_KM ? 'far' : distanceKm > ARRIVED_KM ? 'near' : 'arrived';
  const cfg = {
    far: { msg: 'Em rota', bar: '20%', bg: 'from-blue-50 to-indigo-100' },
    near: { msg: 'A 5 min', bar: '70%', bg: 'from-amber-50 to-orange-100' },
    arrived: {
      msg: 'Chegou!',
      bar: '100%',
      bg: 'from-emerald-50 to-green-100',
    },
  }[zone];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg.bg} p-3 space-y-2`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-3xl font-bold text-text tabular-nums leading-none">
          {formatDistance(distanceKm)}
        </p>
        <p className="text-sm font-semibold text-text">{cfg.msg}</p>
      </div>
      <div className="flex items-center gap-2">
        <Bus size={16} className="text-text" />
        <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: cfg.bar }}
          />
        </div>
        <Home size={16} className="text-text" />
      </div>
    </div>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
