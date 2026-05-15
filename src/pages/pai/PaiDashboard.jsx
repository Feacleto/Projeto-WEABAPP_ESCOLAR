import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Bus,
  ParkingCircle,
  ChevronRight,
  Map as MapIcon,
  UserX,
  MessageCircle,
  Calendar,
  Bell,
  HelpCircle,
  Home,
  School,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import AbsenceSheet from '../../components/absences/AbsenceSheet';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAbsenceForChild } from '../../hooks/useAbsences';
import { haversineDistance } from '../../utils/haversine';
import {
  formatDateTime,
  formatCurrency,
  PERIOD_LABELS,
} from '../../utils/formatters';
import { getEffectiveStatus, STATUS_LABELS } from '../../services/childrenService';
import { ABSENCE_LABELS } from '../../services/absencesService';
import { getDateKey } from '../../services/routePlanService';

const NEAR_KM = 2;
const ARRIVED_KM = 0.4;
const VIBRATE_PATTERN = [220, 100, 220, 100, 220];

const STATUS_GRADIENTS = {
  home: 'from-slate-500 via-slate-600 to-slate-700',
  onboard: 'from-blue-500 via-indigo-600 to-violet-700',
  atSchool: 'from-purple-500 via-fuchsia-600 to-pink-600',
  delivered: 'from-emerald-500 via-emerald-600 to-green-700',
};

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
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
  const [absenceOpen, setAbsenceOpen] = useState(false);

  // Casa do pai (vem do doc da criança)
  const home =
    child?.lat && child?.lng ? { lat: child.lat, lng: child.lng } : null;

  const routeActive = !!liveLocation?.routeActive;
  const van =
    routeActive && liveLocation?.lat && liveLocation?.lng
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : null;

  const distanceKm =
    van && home ? haversineDistance(home.lat, home.lng, van.lat, van.lng) : null;

  // Alertas de proximidade (mesma lógica de zona — só dispara em transição)
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
          /* alguns browsers exigem gesto do user */
        }
      }
    }
  }, [distanceKm, routeActive]);

  // Próximo pagamento (não pago, mais próximo de hoje)
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
        <div className="p-4 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
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
  const status = getEffectiveStatus(child);
  const statusLabel = STATUS_LABELS[status] || 'Em casa';

  const whatsappUrl = admin?.phone
    ? `https://wa.me/55${String(admin.phone).replace(/\D/g, '')}`
    : null;

  return (
    <>
      <Header title="Início" />

      <div className="p-4 space-y-5">
        {/* Saudação */}
        <div>
          <h1 className="text-2xl font-bold text-text leading-tight">
            {greeting()}, {firstName} ☀️
          </h1>
        </div>

        {/* HERO da criança — gradiente segue o status */}
        <HeroChild
          child={child}
          status={status}
          statusLabel={statusLabel}
          onClick={() => navigate('/pai/child')}
        />

        {/* Botão "Pedro vai faltar?" — abre o sheet de ausência */}
        <AbsenceCTA
          childName={child.name}
          absence={absence}
          onClick={() => setAbsenceOpen(true)}
        />

        {/* Tracking strip / offline */}
        {routeActive && distanceKm != null ? (
          <TrackingStrip distanceKm={distanceKm} onOpenMap={() => navigate('/pai/map')} />
        ) : (
          <OfflineCard updatedAt={liveLocation?.updatedAt} />
        )}

        {/* Pagamento próximo / vencido */}
        {nextPayment && (
          <PaymentHero payment={nextPayment} adminPix={admin?.pixKey} />
        )}

        {/* DIA DO FILHO — timeline */}
        <Section label={`Dia do ${child.name?.split(' ')[0] || 'aluno'}`}>
          <DayTimeline status={status} />
        </Section>

        {/* AÇÕES */}
        <Section label="Ações">
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              icon={MessageCircle}
              title="Falar com"
              subtitle="o Tio"
              gradient="from-green-50 to-emerald-100"
              iconBg="bg-emerald-600"
              onClick={() => {
                if (whatsappUrl) window.open(whatsappUrl, '_blank');
                else toast('Telefone do motorista não cadastrado ainda.');
              }}
              disabled={!whatsappUrl}
            />
            <QuickAction
              icon={Calendar}
              title="Histórico"
              subtitle="pagamentos"
              gradient="from-blue-50 to-indigo-100"
              iconBg="bg-indigo-600"
              onClick={() => navigate('/pai/finance')}
            />
            <QuickAction
              icon={Bell}
              title="Notificações"
              subtitle="recentes"
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-amber-500"
              onClick={() => navigate('/pai/notifications')}
            />
            <QuickAction
              icon={HelpCircle}
              title="Como usar"
              subtitle="o app"
              gradient="from-purple-50 to-fuchsia-100"
              iconBg="bg-fuchsia-600"
              onClick={() => openTutorial?.({ floating: true })}
            />
          </div>
        </Section>
      </div>

      {/* Sheet de ausência (overlay) */}
      <AbsenceSheet
        open={absenceOpen}
        onClose={() => setAbsenceOpen(false)}
        child={{
          id: child.id,
          name: child.name,
          parentUid: child.parentUid || user?.uid,
        }}
        declaredBy="parent"
        notifyTargetUid={admin?.uid || admin?.id}
        currentAbsence={absence}
        dateKey={todayKey}
      />
    </>
  );
}

/* ───────────────────────── HERO da Criança ───────────────────────── */

function HeroChild({ child, status, statusLabel, onClick }) {
  const gradient = STATUS_GRADIENTS[status] || STATUS_GRADIENTS.home;
  const isLive = status === 'onboard';

  return (
    <button
      onClick={onClick}
      className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-indigo-500/15"
    >
      <div
        className={`bg-gradient-to-br ${gradient} text-white p-5 relative`}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shrink-0 border-2 border-white/30">
            {child.gender === 'female' ? '👧' : '👦'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-3xl font-bold leading-tight truncate">
              {child.name}
            </p>
            <p className="text-xs text-white/80 mt-1 truncate">
              {child.school} · {PERIOD_LABELS[child.period] || ''}
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
          {isLive && (
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}
          <span className="text-sm font-semibold">{statusLabel}</span>
        </div>

        <div className="mt-3 text-xs text-white/80 inline-flex items-center gap-1">
          Ver perfil completo <ChevronRight size={14} />
        </div>
      </div>
    </button>
  );
}

/* ──────────────────────── Botão "Vai faltar?" ──────────────────────── */

function AbsenceCTA({ childName, absence, onClick }) {
  const firstName = childName?.split(' ')[0] || 'Aluno';
  const hasAbsence = !!absence;
  const label = hasAbsence ? ABSENCE_LABELS[absence.type] : 'Avisar o motorista';

  return (
    <button
      onClick={onClick}
      className={`tap w-full text-left rounded-2xl shadow-sm p-4 flex items-center gap-3 ${
        hasAbsence
          ? 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
          : 'bg-card border border-dashed border-gray-200'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          hasAbsence ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {hasAbsence ? <CheckCircle2 size={20} /> : <UserX size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">
          {hasAbsence
            ? `Ausência registrada para hoje`
            : `${firstName} vai faltar hoje?`}
        </p>
        <p className="text-xs text-textMuted mt-0.5">{label}</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

/* ──────────────────────── Tracking strip ──────────────────────── */

function TrackingStrip({ distanceKm, onOpenMap }) {
  const zone =
    distanceKm > NEAR_KM ? 'far' : distanceKm > ARRIVED_KM ? 'near' : 'arrived';
  const config = {
    far: {
      title: 'Em rota',
      subtitle: `${formatDistance(distanceKm)} até sua casa`,
      bar: '20%',
      bg: 'from-blue-50 to-indigo-100',
    },
    near: {
      title: 'Aproximando-se',
      subtitle: 'Aproximadamente 5 minutos',
      bar: '65%',
      bg: 'from-amber-50 to-orange-100',
    },
    arrived: {
      title: 'Tio Nino chegou!',
      subtitle: 'Na sua porta',
      bar: '100%',
      bg: 'from-emerald-50 to-green-100',
    },
  }[zone];

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${config.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-textMuted">
        <span className="relative inline-flex">
          <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Tio Nino · ao vivo
      </div>

      <div>
        <p className="text-3xl font-bold text-text leading-none tabular-nums">
          {formatDistance(distanceKm)}
        </p>
        <p className="text-xs text-textMuted mt-1">{config.subtitle}</p>
      </div>

      {/* Timeline horizontal de progresso */}
      <div className="flex items-center gap-2 text-textMuted">
        <Bus size={18} className="text-text" />
        <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: config.bar }}
          />
        </div>
        <Home size={18} className="text-text" />
      </div>

      <button
        onClick={onOpenMap}
        className="tap w-full bg-card/80 backdrop-blur rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-semibold text-text shadow-sm"
      >
        <MapIcon size={18} />
        Ver no mapa
      </button>
    </div>
  );
}

function OfflineCard({ updatedAt }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-100 text-textMuted flex items-center justify-center shrink-0">
        <ParkingCircle size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text">Tio Nino offline</p>
        <p className="text-xs text-textMuted mt-0.5">
          {updatedAt
            ? `Última atualização: ${formatDateTime(updatedAt)}`
            : 'A rota ainda não começou hoje.'}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────── Pagamento Hero ──────────────────────── */

function PaymentHero({ payment, adminPix }) {
  const due = payment._due;
  const dleft = daysUntil(due);
  const overdue = dleft != null && dleft < 0;
  const urgent = dleft != null && dleft <= 3;

  const bg = overdue
    ? 'from-red-100 via-rose-100 to-red-200'
    : urgent
    ? 'from-amber-100 via-orange-100 to-amber-200'
    : 'from-blue-50 to-indigo-100';
  const textTone = overdue
    ? 'text-red-900'
    : urgent
    ? 'text-amber-900'
    : 'text-text';

  const headline = overdue
    ? `Atrasado há ${Math.abs(dleft)} dia${Math.abs(dleft) > 1 ? 's' : ''}`
    : dleft === 0
    ? 'Vence hoje'
    : dleft === 1
    ? 'Vence amanhã'
    : `Vence em ${dleft} dias`;

  const copyPix = async () => {
    if (!adminPix) {
      toast('Chave PIX não cadastrada pelo motorista.');
      return;
    }
    try {
      await navigator.clipboard.writeText(adminPix);
      toast.success('Chave PIX copiada!');
    } catch {
      toast.error('Não foi possível copiar. Tente manualmente.');
    }
  };

  return (
    <Section label="Pagamento">
      <div
        className={`rounded-2xl bg-gradient-to-br ${bg} p-5 space-y-4 ${textTone}`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            {headline}
          </p>
          <p className="text-4xl font-bold leading-none mt-2 tabular-nums">
            {formatCurrency(payment.amount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copyPix}
            className="tap bg-card/70 backdrop-blur rounded-xl py-3 px-3 text-sm font-semibold shadow-sm"
          >
            Copiar Pix
          </button>
          <button
            className="tap bg-text/90 text-white rounded-xl py-3 px-3 text-sm font-semibold shadow-sm"
            onClick={() => toast('Em breve nesta tela. Use o Financeiro.')}
          >
            Já paguei ✓
          </button>
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────── Timeline do dia ──────────────────────── */

function DayTimeline({ status }) {
  const steps = [
    { key: 'home', label: 'Em casa', icon: Home },
    { key: 'onboard', label: 'Na perua', icon: Bus },
    { key: 'atSchool', label: 'Na escola', icon: School },
    { key: 'delivered', label: 'Voltou pra casa', icon: Home },
  ];

  // Índice "ativo" baseado no status atual
  const order = ['home', 'onboard', 'atSchool', 'delivered'];
  const currentIdx = order.indexOf(status);

  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 space-y-3">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-primary text-white ring-4 ring-primary/15'
                  : 'bg-gray-100 text-textMuted'
              }`}
            >
              <s.icon size={16} />
            </div>
            <div className="flex-1">
              <p
                className={`text-sm ${
                  done || active ? 'text-text font-semibold' : 'text-textMuted'
                }`}
              >
                {s.label}
              </p>
            </div>
            {active && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Agora
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── helpers visuais ─────────────────── */

function Section({ label, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        {label}
      </h2>
      {children}
    </section>
  );
}

function QuickAction({
  icon: Icon,
  title,
  subtitle,
  gradient,
  iconBg,
  onClick,
  disabled,
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`tap text-left rounded-2xl p-4 bg-gradient-to-br ${gradient} relative overflow-hidden ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${iconBg}`}
      >
        <Icon size={20} />
      </div>
      <div className="mt-3">
        <p className="font-semibold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted">{subtitle}</p>
      </div>
    </button>
  );
}

function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
