import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Bus,
  ParkingCircle,
  MessageCircle,
  Home,
  School,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LiveMap from '../../components/map/LiveMap';
import Skeleton from '../../components/common/Skeleton';
import RouteTracker from '../../components/dashboard/RouteTracker';
import { describeRoutePresence, PRESENCE } from '../../utils/routePresence';
import { playSound } from '../../services/soundService';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { haversineDistance } from '../../utils/haversine';
import { formatDateTime } from '../../utils/formatters';
import { getEffectiveStatus } from '../../services/childrenService';

const NEAR_KM = 2; // ≤ 2 km da casa do pai = "zona próxima"
const ARRIVED_KM = 0.4;
const VIBRATE_PATTERN = [220, 100, 220, 100, 220];

/**
 * Mapa do Pai — desenhado pra preservar a privacidade do Tio:
 *
 * 1. Sempre mostra: casa do pai 🏠 (verde) + escola da criança 🏫 (violeta)
 * 2. Quando rota INATIVA: só casa + escola. Mensagem "Tio não está em rota".
 * 3. Quando rota ATIVA mas Tio LONGE (> 2 km da casa): NÃO mostra perua.
 *    Mensagem "Tio Nino em rota — chegará em breve". Privacidade preservada
 *    (outros pais não veem por onde ele tá indo).
 * 4. Quando rota ATIVA e Tio PRÓXIMO (≤ 2 km): perua aparece na posição real
 *    + mensagem "Pode preparar a criança". Permite o pai se organizar sem
 *    atrasar a rota.
 * 5. Quando CHEGOU (≤ 400 m): "Tio Nino chegou!" + vibração.
 */
export default function PaiMap() {
  const navigate = useNavigate();
  const { child, loading } = useActiveChild();
  const { location: liveLocation } = useLiveLocation(child?.adminUid);
  const { admin } = useAdminProfile(child?.adminUid);

  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;
  const school =
    child?.schoolLat && child?.schoolLng
      ? { lat: child.schoolLat, lng: child.schoolLng }
      : null;
  const routeActive = !!liveLocation?.routeActive;

  // Posição real da perua (só usamos se for próximo)
  const realVan =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  const realDistanceKm =
    realVan && home
      ? haversineDistance(home.lat, home.lng, realVan.lat, realVan.lng)
      : null;

  const isNearby = realDistanceKm != null && realDistanceKm <= NEAR_KM;
  const hasArrived = realDistanceKm != null && realDistanceKm <= ARRIVED_KM;

  // O marcador da perua só aparece quando entra na zona próxima
  // MESMA lógica honesta do dashboard. Esta tela tinha regra própria e
  // ficou pra trás quando o estado de três casos foi criado: aqui a perua
  // continuava aparecendo no mapa mesmo com posição velha, exatamente o
  // caso do motorista que fecha a aba no meio do caminho.
  const presence = describeRoutePresence({
    liveLocation,
    distanceKm: realDistanceKm,
  });
  const positionIsStale = presence.kind === PRESENCE.STALE;

  // Só desenha a perua quando ela está perto E a posição é fresca.
  const visibleVan = isNearby && !positionIsStale ? realVan : null;

  // Alertas — dispara cada um uma vez por rota (transição de zona)
  const alertedNearRef = useRef(false);
  const alertedArrivedRef = useRef(false);
  useEffect(() => {
    if (!routeActive || positionIsStale) {
      alertedNearRef.current = false;
      alertedArrivedRef.current = false;
      return;
    }
    if (hasArrived && !alertedArrivedRef.current) {
      alertedArrivedRef.current = true;
      toast.success('🚐 Tio Nino chegou! Pode levar a criança.', {
        duration: 10000,
      });
      playSound('horn_long');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          /* */
        }
      }
      return;
    }
    if (isNearby && !alertedNearRef.current) {
      alertedNearRef.current = true;
      toast.success('🚐 Tio Nino tá chegando! Pode preparar a criança.', {
        duration: 8000,
      });
      playSound('horn_short');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          /* */
        }
      }
    }
  }, [routeActive, isNearby, hasArrived, positionIsStale]);

  const whatsappUrl = admin?.phone
    ? `https://wa.me/55${String(admin.phone).replace(/\D/g, '')}`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen p-5">
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-30 bg-card border-b border-neutro h-14 px-3 flex items-center gap-2">
        {/* Destino declarado em vez de `navigate(-1)`: o mapa é a tela que
          * mais se chega por notificação ("Tio Nino tá chegando!"), e nesse
          * caminho não existe história pra voltar — a seta sozinha jogaria o
          * responsável pra fora do app no momento em que ele mais precisa
          * dele. */}
        <button
          onClick={() => {
            // Mesma regra do Header: consumir história quando existe, e só
            // cair no destino quando ela não existe (chegada por push).
            // Navegar sempre empilhava, e o botão físico do Android trazia a
            // pessoa de volta pro mapa que ela tinha acabado de fechar.
            const temHistoria = (window.history.state?.idx ?? 0) > 0;
            if (temHistoria) navigate(-1);
            else navigate('/pai', { replace: true });
          }}
          aria-label="Voltar para o início"
          className="tap h-10 pl-2 pr-3 rounded-full bg-neutro flex items-center gap-1 text-textMuted shrink-0"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Início</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text truncate leading-tight">
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

      {/* Mapa — 70% da viewport */}
      <div className="relative" style={{ height: 'min(70vh, 600px)' }}>
        {home || school ? (
          <LiveMap van={visibleVan} home={home} school={school} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center p-5">
            <p className="text-sm text-textMuted">
              Endereços ainda não cadastrados.
            </p>
          </div>
        )}
      </div>

      {/* Painel inferior — contextual ao estado da rota */}
      <div className="flex-1 bg-card -mt-4 rounded-t-3xl shadow-lg p-5 space-y-4 relative z-10">
        <div className="flex justify-center -mt-1 pb-1">
          <span className="block w-10 h-1 rounded-full bg-border" />
        </div>

        <StatusPanel
          routeActive={routeActive}
          hasArrived={hasArrived}
          isNearby={isNearby}
          realDistanceKm={realDistanceKm}
          updatedAt={liveLocation?.updatedAt}
          presence={presence}
        />

        {/* Tracker do trajeto da criança — mesmo do dashboard */}
        <RouteTracker status={child ? getEffectiveStatus(child) : 'home'} compact />

        {/* Pontos de referência sempre visíveis */}
        <div className="bg-bg rounded-2xl p-3 space-y-2">
          <ReferenceRow
            icon={Home}
            color="bg-emerald-500"
            label="Casa"
            value={child?.address || 'Endereço não cadastrado'}
          />
          <ReferenceRow
            icon={School}
            color="bg-escola"
            label="Escola"
            value={
              child?.schoolAddress || child?.school || 'Não cadastrada'
            }
          />
        </div>

        <button
          onClick={() => {
            if (whatsappUrl) window.open(whatsappUrl, '_blank');
            else toast('Telefone do motorista não cadastrado.');
          }}
          disabled={!whatsappUrl}
          className="tap w-full rounded-2xl py-3.5 bg-emerald-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <MessageCircle size={18} />
          Falar com o Tio
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Painel de status (contextual) ─────────────── */

function StatusPanel({
  routeActive,
  hasArrived,
  isNearby,
  realDistanceKm,
  updatedAt,
  presence,
}) {
  // Rota marcada como ativa mas sem posição nova: o motorista pode estar
  // sem sinal, ou fechou a aba sem encerrar. Antes esta tela mostrava a
  // perua parada no mapa como se fosse a posição atual — e é o caso em que
  // parecer errado custa mais caro que parecer incompleto.
  if (presence?.kind === PRESENCE.STALE) {
    return (
      <div className="rounded-2xl bg-warningSoft border border-warningBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-warningChip text-warningText flex items-center justify-center shrink-0">
          <ParkingCircle size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-text leading-tight">{presence.title}</p>
          <p className="text-xs text-warningText mt-0.5 leading-snug">
            {presence.detail}
          </p>
        </div>
      </div>
    );
  }

  if (!routeActive) {
    return (
      <div className="rounded-2xl bg-sunken p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-border text-textMuted flex items-center justify-center shrink-0">
          <ParkingCircle size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-text leading-tight">
            Tio Nino não está em rota
          </p>
          {updatedAt && (
            <p className="text-xs text-textMuted mt-0.5">
              Última rota: {formatDateTime(updatedAt)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (hasArrived) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200 p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Bus size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-emerald-900 leading-tight text-lg">
            Tio Nino chegou!
          </p>
          <p className="text-xs text-emerald-800 mt-0.5">
            Tá na sua porta — pode levar a criança.
          </p>
        </div>
      </div>
    );
  }

  if (isNearby) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-warningBorder p-4 flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
          <Bus size={22} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-warningText leading-tight text-lg">
            Tá chegando!
          </p>
          <p className="text-xs text-warningText mt-0.5">
            {formatDistance(realDistanceKm)} daqui · prepare a criança
          </p>
        </div>
      </div>
    );
  }

  // Longe — privacidade do Tio: não mostra distância nem posição
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 p-4 flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
        <Bus size={22} />
      </div>
      <div className="flex-1">
        <p className="font-bold text-indigo-900 leading-tight">
          Tio Nino em rota
        </p>
        <p className="text-xs text-indigo-900 mt-0.5">
          Vamos te avisar quando estiver perto.
        </p>
      </div>
    </div>
  );
}

function ReferenceRow({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0 ${color}`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-textMuted">
          {label}
        </p>
        <p className="text-sm text-text leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
