import { useEffect, useRef } from 'react';
import {
  LogOut,
  ParkingCircle,
  GraduationCap,
  Bus,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/children/StatusBadge';
import LiveMap from '../../components/map/LiveMap';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { haversineDistance } from '../../utils/haversine';
import { PERIOD_LABELS, formatDateTime } from '../../utils/formatters';

// Limites das zonas de proximidade (em km)
const NEAR_KM = 2;
const ARRIVED_KM = 0.4;

// Padrão de vibração — funciona em Android Chrome (iOS Safari ignora).
const VIBRATE_PATTERN = [220, 100, 220, 100, 220];

export default function PaiDashboard() {
  const { profile, logout } = useAuth();
  const { child, loading: childLoading } = useChild(profile?.childId);
  const { location: liveLocation, loading: locLoading } = useLiveLocation();

  // Casa do pai (vem do doc da criança)
  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;

  // Perua — só renderiza quando rota está ativa
  const routeActive = !!liveLocation?.routeActive;
  const van =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  const distanceKm =
    van && home
      ? haversineDistance(home.lat, home.lng, van.lat, van.lng)
      : null;

  // Disparo de alertas baseado em transição entre zonas — usa ref pra
  // não disparar o mesmo alerta repetidamente (cada update da perua chega
  // a cada 30s pelo throttle, mas mesmo assim spam é ruim).
  const lastZoneRef = useRef(null);

  useEffect(() => {
    if (!routeActive) {
      // Reseta state machine ao encerrar rota — assim a próxima rota dispara
      // todos os alertas de novo (em rota → 5 min → chegou).
      lastZoneRef.current = null;
      return;
    }
    if (distanceKm == null) return;

    const zone =
      distanceKm > NEAR_KM
        ? 'far'
        : distanceKm > ARRIVED_KM
        ? 'near'
        : 'arrived';

    const prev = lastZoneRef.current;
    if (zone === prev) return;

    lastZoneRef.current = zone;

    // Não dispara nada na primeira leitura (página recarregada com rota ativa)
    if (prev == null) return;

    if (zone === 'far') {
      toast('🚐 Tio Nino em rota', { icon: '🚐' });
    } else if (zone === 'near') {
      toast('🚐 Tio Nino está a aproximadamente 5 minutos', {
        icon: '🚐',
        duration: 6000,
      });
    } else if (zone === 'arrived') {
      toast.success('📍 Tio Nino chegou!', { duration: 10000 });
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          // Alguns browsers só permitem vibração com gesto do usuário; ignore.
        }
      }
    }
  }, [distanceKm, routeActive]);

  if (childLoading) {
    return (
      <>
        <Header title="Carregando..." />
        <div className="p-4 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  if (!profile?.childId || !child) {
    return (
      <>
        <Header
          title="Início"
          action={
            <button
              onClick={logout}
              aria-label="Sair"
              className="text-textMuted tap p-1"
            >
              <LogOut size={20} />
            </button>
          }
        />
        <EmptyState
          icon={MapPin}
          title="Cadastro não encontrado"
          description="Sua conta ainda não está vinculada a uma criança. Fale com o motorista."
        />
      </>
    );
  }

  const firstName = profile?.name?.split(' ')[0] || 'Olá';

  return (
    <>
      <Header
        title={`Olá, ${firstName}`}
        action={
          <button
            onClick={logout}
            aria-label="Sair"
            className="text-textMuted tap p-1"
          >
            <LogOut size={20} />
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Card grande de status */}
        <Card className="text-center space-y-2">
          <div>
            <h2 className="text-lg font-bold text-text">{child.name}</h2>
            <p className="text-xs text-textMuted flex items-center justify-center gap-1 mt-0.5">
              <GraduationCap size={12} />
              {child.school} · {PERIOD_LABELS[child.period]}
            </p>
          </div>
          <div className="pt-1">
            <StatusBadge status={child.status} size="lg" />
          </div>
        </Card>

        {/* Estado da rota: alerta de proximidade OU mensagem offline */}
        {routeActive && distanceKm != null ? (
          <ProximityCard distanceKm={distanceKm} />
        ) : (
          <Card className="bg-bg flex items-center gap-3">
            <ParkingCircle size={26} className="text-textMuted shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-text">
                Tio Nino offline no momento
              </p>
              <p className="text-xs text-textMuted">
                {liveLocation?.updatedAt
                  ? `Última atualização: ${formatDateTime(liveLocation.updatedAt)}`
                  : 'A rota ainda não começou hoje.'}
              </p>
            </div>
          </Card>
        )}

        {/* Mapa (sempre renderiza se tiver casa cadastrada) */}
        {home ? (
          <div className="rounded-2xl overflow-hidden shadow-sm h-[55vh] min-h-[320px]">
            <LiveMap van={van} home={home} />
          </div>
        ) : (
          <Card className="text-xs text-textMuted text-center">
            Endereço residencial ainda não cadastrado pelo motorista.
          </Card>
        )}

        {/* Loading inicial sutil enquanto liveLocation chega */}
        {locLoading && !liveLocation && (
          <p className="text-center text-xs text-textMuted">
            Conectando ao tracking...
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Card de proximidade — escolhe ícone, cor e mensagem com base na distância.
 * Mensagens espelham as transições de alerta (far / near / arrived).
 */
function ProximityCard({ distanceKm }) {
  const zone =
    distanceKm > NEAR_KM
      ? 'far'
      : distanceKm > ARRIVED_KM
      ? 'near'
      : 'arrived';

  const config = {
    far: {
      bg: 'bg-primary/10',
      iconColor: 'text-primaryDark',
      title: 'Tio Nino em rota',
      subtitle: formatDistance(distanceKm) + ' até sua casa',
    },
    near: {
      bg: 'bg-warning/10',
      iconColor: 'text-amber-700',
      title: 'Aproximando-se',
      subtitle: 'A aproximadamente 5 minutos',
    },
    arrived: {
      bg: 'bg-success/10',
      iconColor: 'text-success',
      title: 'Chegou!',
      subtitle: 'Tio Nino está na sua porta',
    },
  };

  const { bg, iconColor, title, subtitle } = config[zone];
  const Icon = zone === 'arrived' ? MapPin : Bus;

  return (
    <Card className={`flex items-center gap-3 ${bg}`}>
      <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center shrink-0 shadow-sm">
        <Icon size={22} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text">{title}</p>
        <p className="text-xs text-textMuted">{subtitle}</p>
      </div>
    </Card>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
