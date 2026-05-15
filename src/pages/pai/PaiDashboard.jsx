import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  UserX,
  MessageCircle,
  Calendar,
  Bell,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Map as MapIcon,
  CheckCircle2,
  Home,
  Bus,
  School,
  Star,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import AbsenceSheet from '../../components/absences/AbsenceSheet';
import RouteTracker from '../../components/dashboard/RouteTracker';
import AbsenceCounts from '../../components/dashboard/AbsenceCounts';
import AltPickupSheet from '../../components/altpickup/AltPickupSheet';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAbsenceForChild, useChildAbsenceHistory } from '../../hooks/useAbsences';
import { useDailyAltPickup } from '../../hooks/useAltPickup';
import { haversineDistance } from '../../utils/haversine';
import { formatCurrency } from '../../utils/formatters';
import { getEffectiveStatus } from '../../services/childrenService';
import { ABSENCE_LABELS } from '../../services/absencesService';
import { getDateKey } from '../../services/routePlanService';
import { playSound } from '../../services/soundService';
import { greet } from '../../utils/greeting';
import FestiveBadge from '../../components/festive/FestiveBadge';
import PaiNotebookFAB from '../../components/agenda/PaiNotebookFAB';

const NEAR_KM = 2;
const ARRIVED_KM = 0.4;
const VIBRATE_PATTERN = [220, 100, 220, 100, 220];

const STATUS_GRADIENTS = {
  home: 'from-slate-500 via-slate-600 to-slate-700',
  onboard: 'from-blue-500 via-indigo-600 to-violet-700',
  atSchool: 'from-purple-500 via-fuchsia-600 to-pink-600',
  delivered: 'from-emerald-500 via-emerald-600 to-green-700',
};

/**
 * Frase humana que descreve o estado do filho em UMA linha — adapta pra
 * status + horário. Substitui badges/timelines complexos.
 */
function statusPhrase(status, routeActive, hour) {
  if (status === 'onboard' && routeActive) {
    return hour < 12 ? 'Tá na perua · indo pra escola' : 'Tá na perua · voltando pra casa';
  }
  if (status === 'onboard') return 'Tá na perua';
  if (status === 'atSchool') return 'Já chegou na escola';
  if (status === 'delivered') return 'Tá em casa · chegou em segurança';
  return hour < 11 ? 'Tá em casa · ainda não saiu' : 'Tá em casa';
}

function daysUntil(date) {
  if (!date) return null;
  const d = date?.toDate?.() || new Date(date);
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

export default function PaiDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { openTutorial } = useOutletContext() || {};
  const { child, loading: childLoading } = useChild(profile?.childId);
  const { location: liveLocation } = useLiveLocation();
  const { admin } = useAdminProfile();
  const { payments } = usePaymentsByParent(user?.uid);
  const todayKey = getDateKey();
  const { absence } = useAbsenceForChild(todayKey, profile?.childId);
  const { history: absenceHistory } = useChildAbsenceHistory(profile?.childId);
  const { pickup: altPickup } = useDailyAltPickup(todayKey, profile?.childId);

  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [altPickupOpen, setAltPickupOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;
  const routeActive = !!liveLocation?.routeActive;
  const van =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;
  const distanceKm =
    van && home ? haversineDistance(home.lat, home.lng, van.lat, van.lng) : null;

  // Alertas de proximidade — só dispara em transição de zona
  const lastZoneRef = useRef(null);
  useEffect(() => {
    if (!routeActive) {
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
    if (prev == null) return;

    if (zone === 'far') toast('Tio Nino em rota', { icon: '🚐' });
    else if (zone === 'near') {
      toast('Tio Nino chega em uns 5 minutos', { icon: '🚐', duration: 6000 });
      // Buzina curta — sinaliza aproximação
      playSound('horn_short');
    } else if (zone === 'arrived') {
      toast.success('Tio Nino chegou!', { duration: 10000 });
      // Buzina longa — Tio chegou na porta
      playSound('horn_long');
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(VIBRATE_PATTERN);
        } catch {
          /* alguns browsers exigem gesto */
        }
      }
    }
  }, [distanceKm, routeActive]);

  const nextPayment = useMemo(() => {
    if (!payments?.length) return null;
    const pending = payments
      .filter((p) => p.status === 'pending' || p.status === 'claimed')
      .map((p) => ({
        ...p,
        _due: p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null),
      }))
      .filter((p) => p._due)
      .sort((a, b) => a._due - b._due);
    return pending[0] || null;
  }, [payments]);

  if (childLoading) {
    return (
      <>
        <Header title="Início" />
        <div className="p-5 space-y-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-24" />
        </div>
      </>
    );
  }

  if (!profile?.childId || !child) {
    return (
      <>
        <Header title="Início" />
        <EmptyState
          icon={MapPin}
          title="Cadastro não encontrado"
          description="Sua conta ainda não está vinculada a uma criança. Fale com o motorista."
        />
      </>
    );
  }

  const firstName = profile?.name?.split(' ')[0] || '';
  const childFirstName = child.name?.split(' ')[0] || 'Aluno';
  const status = getEffectiveStatus(child);
  const phrase = statusPhrase(status, routeActive, new Date().getHours());
  const whatsappUrl = admin?.phone
    ? `https://wa.me/55${String(admin.phone).replace(/\D/g, '')}`
    : null;

  return (
    <>
      <Header title="Início" />

      <div className="p-5 space-y-5">
        {/* Saudação simples — bolinha festiva separada ao lado */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text leading-tight flex-1 min-w-0">
            {greet(new Date(), admin?.greetingHours)}, {firstName}!
          </h1>
          <FestiveBadge />
        </div>

        {/* HERO ÚNICO — frase humana */}
        <ChildHero
          child={child}
          status={status}
          phrase={phrase}
          onTap={() => navigate('/pai/child')}
        />

        {/* Tracker visual estilo "rastreio de pedido" */}
        <RouteTracker status={status} />

        {/* Ausência declarada / botão de informar */}
        {absence ? (
          <AbsenceStatus absence={absence} onClick={() => setAbsenceOpen(true)} />
        ) : (
          <AbsenceCTA
            childFirstName={childFirstName}
            onClick={() => setAbsenceOpen(true)}
          />
        )}

        {/* Quem busca hoje */}
        <AltPickupCTA
          pickup={altPickup}
          onClick={() => setAltPickupOpen(true)}
        />

        {/* Tracking — quando rota tá ativa mostra status dinâmico. Quando
          * não tá, um botão simples permite abrir o mapa mesmo assim. */}
        {routeActive && distanceKm != null ? (
          <TrackingPanel
            distanceKm={distanceKm}
            onOpenMap={() => navigate('/pai/map')}
          />
        ) : (
          <OpenMapButton onClick={() => navigate('/pai/map')} />
        )}

        {/* Pagamento — só se houver pendente */}
        {nextPayment && (
          <PaymentBanner
            payment={nextPayment}
            onClick={() => navigate('/pai/finance')}
          />
        )}

        {/* Contagem de faltas — só aparece se há histórico */}
        {absenceHistory.length > 0 && (
          <AbsenceCounts history={absenceHistory} />
        )}

        {/* Mais opções */}
        <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="tap w-full p-4 flex items-center gap-2 text-text font-semibold"
          >
            <Sparkles size={18} className="text-primary" />
            <span className="flex-1 text-left">Mais opções</span>
            {moreOpen ? (
              <ChevronUp size={18} className="text-textMuted" />
            ) : (
              <ChevronDown size={18} className="text-textMuted" />
            )}
          </button>

          {moreOpen && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              <OptionRow
                icon={MessageCircle}
                title="Falar com o Tio"
                subtitle={whatsappUrl ? 'WhatsApp' : 'Telefone não cadastrado'}
                onClick={() => {
                  if (whatsappUrl) window.open(whatsappUrl, '_blank');
                  else toast('Telefone do motorista não cadastrado.');
                }}
                disabled={!whatsappUrl}
              />
              <OptionRow
                icon={Calendar}
                title="Histórico de pagamentos"
                subtitle="Mês a mês"
                onClick={() => navigate('/pai/finance')}
              />
              <OptionRow
                icon={Bell}
                title="Notificações"
                subtitle="Avisos recentes"
                onClick={() => navigate('/pai/notifications')}
              />
              <OptionRow
                icon={HelpCircle}
                title="Como usar o app"
                onClick={() => openTutorial?.({ floating: true })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Caderno digital — botão flutuante na tela inicial do Pai */}
      <PaiNotebookFAB />

      <AbsenceSheet
        open={absenceOpen}
        onClose={() => setAbsenceOpen(false)}
        child={{
          id: child.id,
          name: child.name,
          parentUid: child.parentUid || user?.uid,
        }}
        declaredBy="parent"
        currentAbsence={absence}
        dateKey={todayKey}
      />

      <AltPickupSheet
        open={altPickupOpen}
        onClose={() => setAltPickupOpen(false)}
        child={child}
        parentUid={user?.uid}
        dateKey={todayKey}
        currentPickup={altPickup}
      />
    </>
  );
}

/* ─────────────── HERO ─────────────── */

function ChildHero({ child, status, phrase, onTap }) {
  const gradient = STATUS_GRADIENTS[status] || STATUS_GRADIENTS.home;
  const isLive = status === 'onboard';

  return (
    <button
      onClick={onTap}
      className="tap w-full text-left rounded-3xl overflow-hidden shadow-xl shadow-indigo-500/15"
    >
      <div
        className={`bg-gradient-to-br ${gradient} text-white p-6 relative overflow-hidden`}
      >
        {/* Ilustração animada de fundo — muda com o estado da criança */}
        <StateIllustration status={status} />

        <div className="relative flex items-center gap-4">
          <div className="rounded-full overflow-hidden border-2 border-white/30 bg-white/20 backdrop-blur-sm shrink-0">
            <Avatar
              photoURL={child.photoURL}
              gender={child.gender}
              seed={child.id}
              kind="child"
              size="lg"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              {child.name?.split(' ')[0]}
            </p>
            <p className="text-2xl font-bold leading-tight mt-1">
              {phrase.split(' · ')[0]}
            </p>
            {phrase.includes(' · ') && (
              <p className="text-white/85 text-sm mt-1">
                {phrase.split(' · ')[1]}
              </p>
            )}
          </div>
        </div>

        {isLive && (
          <div className="relative mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest">
              Ao vivo
            </span>
          </div>
        )}

        <div className="relative mt-4 text-xs text-white/80 inline-flex items-center gap-1">
          Ver perfil completo <ChevronRight size={14} />
        </div>
      </div>
    </button>
  );
}

/**
 * Ilustração decorativa que dá "vida" ao card baseado no status atual:
 *   - home      → casa pulsando suave (à direita)
 *   - onboard   → perua atravessando o card em loop
 *   - atSchool  → escola balançando como sino
 *   - delivered → estrela girando + brilho
 *
 * Tudo em opacity baixa pra não competir com o texto, mas suficiente
 * pra o pai sentir o estado emocional do momento.
 */
function StateIllustration({ status }) {
  if (status === 'onboard') {
    return (
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-3 pointer-events-none animate-van-drive"
      >
        <Bus
          size={56}
          strokeWidth={1.5}
          className="text-white/25 mx-auto"
        />
      </div>
    );
  }
  if (status === 'atSchool') {
    return (
      <div
        aria-hidden
        className="absolute -bottom-2 -right-2 pointer-events-none animate-school-sway"
      >
        <School size={88} strokeWidth={1.3} className="text-white/15" />
      </div>
    );
  }
  if (status === 'delivered') {
    return (
      <div
        aria-hidden
        className="absolute -top-2 -right-2 pointer-events-none animate-celebrate"
      >
        <Star
          size={72}
          strokeWidth={1.4}
          fill="currentColor"
          className="text-white/20"
        />
      </div>
    );
  }
  // home (padrão)
  return (
    <div
      aria-hidden
      className="absolute -bottom-2 -right-2 pointer-events-none animate-house-rest"
    >
      <Home size={88} strokeWidth={1.3} className="text-white/15" />
    </div>
  );
}

/* ─────────────── Ausência ─────────────── */

function AbsenceCTA({ childFirstName, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border border-dashed border-gray-200"
    >
      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <UserX size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          {childFirstName} vai faltar hoje?
        </p>
        <p className="text-xs text-textMuted mt-0.5">Avisar o motorista</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

function AbsenceStatus({ absence, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 p-4 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
        <CheckCircle2 size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Ausência registrada para hoje
        </p>
        <p className="text-xs text-textMuted mt-0.5">
          {ABSENCE_LABELS[absence.type]}
        </p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * Botão "Quem busca hoje?" — adapta conforme há ou não indicação ativa.
 */
function AltPickupCTA({ pickup, onClick }) {
  if (pickup) {
    return (
      <button
        onClick={onClick}
        className="tap w-full text-left rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200 p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center shrink-0">
          <UserCheck size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text leading-tight">
            Hoje quem pega: {pickup.name}
          </p>
          <p className="text-xs text-textMuted mt-0.5 truncate">
            {pickup.relationship && <span>{pickup.relationship} · </span>}
            {pickup.phone}
          </p>
        </div>
        <ChevronRight size={18} className="text-textMuted shrink-0" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border border-dashed border-gray-200"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
        <UserCheck size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Outro responsável vai buscar?
        </p>
        <p className="text-xs text-textMuted mt-0.5">
          Indique no app pra o motorista saber
        </p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/* ─────────────── Tracking ─────────────── */

/**
 * Painel de tracking — preserva a privacidade do Tio:
 *   - Longe (> 2 km): só mostra "Em rota — vamos te avisar quando estiver perto"
 *   - Próximo (≤ 2 km): mostra "Tá chegando!" com distância e tempo
 *   - Chegou (≤ 400 m): "Chegou! Já tá na sua porta"
 */
function TrackingPanel({ distanceKm, onOpenMap }) {
  const zone =
    distanceKm > NEAR_KM ? 'far' : distanceKm > ARRIVED_KM ? 'near' : 'arrived';
  const messages = {
    far: {
      title: 'Em rota',
      subtitle: 'Vamos te avisar quando estiver perto',
    },
    near: {
      title: 'Tá chegando!',
      subtitle: `${formatDistance(distanceKm)} daqui · prepare a criança`,
    },
    arrived: { title: 'Chegou!', subtitle: 'Já tá na sua porta' },
  };
  const cfg = messages[zone];

  return (
    <button
      onClick={onOpenMap}
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <MapIcon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">{cfg.title}</p>
        <p className="text-xs text-textMuted mt-0.5">{cfg.subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * Botão simples pra abrir o mapa quando a rota NÃO está ativa.
 * Substitui o TrackingPanel nesse cenário pra deixar o mapa sempre
 * a um toque de distância, mesmo sem perua em trânsito agora.
 */
function OpenMapButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-2xl bg-card shadow-sm p-4 flex items-center gap-3 border border-dashed border-gray-200"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <MapIcon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">Ver no mapa</p>
        <p className="text-xs text-textMuted mt-0.5">
          A perua aparece aqui quando estiver rodando
        </p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/* ─────────────── Pagamento ─────────────── */

function PaymentBanner({ payment, onClick }) {
  const dleft = daysUntil(payment._due);
  const overdue = dleft != null && dleft < 0;
  const urgent = dleft != null && dleft >= 0 && dleft <= 3;

  const bg = overdue
    ? 'from-red-50 to-rose-100 border-red-200'
    : urgent
    ? 'from-amber-50 to-orange-100 border-amber-200'
    : 'from-blue-50 to-indigo-100 border-blue-200';

  const headline = overdue
    ? `Atrasado há ${Math.abs(dleft)} dia${Math.abs(dleft) > 1 ? 's' : ''}`
    : dleft === 0
    ? 'Vence hoje'
    : dleft === 1
    ? 'Vence amanhã'
    : `Vence em ${dleft} dias`;

  return (
    <button
      onClick={onClick}
      className={`tap w-full text-left rounded-2xl p-4 border bg-gradient-to-br ${bg} flex items-center gap-3`}
    >
      <div className="w-11 h-11 rounded-xl bg-text/90 text-white flex items-center justify-center shrink-0">
        <Calendar size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">
          Mensalidade · {formatCurrency(payment.amount)}
        </p>
        <p className="text-xs text-textMuted mt-0.5">{headline}</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/* ─────────────── Mais opções rows ─────────────── */

function OptionRow({ icon: Icon, title, subtitle, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`tap w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}
