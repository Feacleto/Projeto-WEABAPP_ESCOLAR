import { useEffect, useMemo, useState } from 'react';
import {
  Bus,
  CheckCircle2,
  Users,
  UserX,
  DollarSign,
  Eye,
  EyeOff,
  AlertTriangle,
  CircleAlert,
  Megaphone,
  ListOrdered,
  HelpCircle,
  PlayCircle,
  Sunrise,
  Sunset,
  ChevronRight,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import SchoolBroadcastSheet from '../../components/broadcasts/SchoolBroadcastSheet';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { useAbsences } from '../../hooks/useAbsences';
import { getEffectiveStatus } from '../../services/childrenService';
import { db } from '../../firebase/config';
import { formatCurrency, getCurrentMonthKey } from '../../utils/formatters';
import { getDateKey, getCurrentPeriod } from '../../services/routePlanService';
import { ABSENCE_SHORT } from '../../services/absencesService';

const WEEK_DAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function formatLongDate(d = new Date()) {
  return `${WEEK_DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Períodos do dia já passados — usado pra mostrar "Encerrado" nas linhas
// de período da home (manhã/tarde).
function isPeriodPast(period, d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (period === 'morning') return h >= 9;
  if (period === 'afternoon') return h >= 14;
  return false;
}

export default function TioDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { openTutorial } = useOutletContext() || {};
  const { children, loading } = useChildren();
  const { payments } = usePaymentsByMonth(getCurrentMonthKey());
  const todayKey = getDateKey();
  const { absences } = useAbsences(todayKey);

  const [routeActive, setRouteActive] = useState(false);
  const [showReceivable, setShowReceivable] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'liveLocation', 'current'),
      (snap) => {
        setRouteActive(snap.exists() ? !!snap.data().routeActive : false);
      },
      () => setRouteActive(false)
    );
    return unsub;
  }, []);

  const totalChildren = children.length;
  const delivered = useMemo(
    () => children.filter((c) => getEffectiveStatus(c) === 'delivered').length,
    [children]
  );
  const absentCount = absences.length;

  // Cálculo "a receber" (pendente + claimed) e atrasados (overdue)
  const { receivableTotal, overdueCount, overdueTotal, claimedCount } =
    useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let receivable = 0;
      let overdueC = 0;
      let overdueT = 0;
      let claimedC = 0;
      for (const p of payments) {
        if (p.status === 'paid') continue;
        const amount = Number(p.amount) || 0;
        receivable += amount;
        if (p.status === 'claimed') claimedC += 1;
        const due = p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null);
        if (due && due < today) {
          overdueC += 1;
          overdueT += amount;
        }
      }
      return {
        receivableTotal: receivable,
        overdueCount: overdueC,
        overdueTotal: overdueT,
        claimedCount: claimedC,
      };
    }, [payments]);

  const firstName = profile?.name?.split(' ')[0] || 'Tio';

  return (
    <>
      <Header title="Início" />

      <div className="p-4 space-y-5">
        {/* Saudação grande, pessoal */}
        <div>
          <h1 className="text-2xl font-bold text-text leading-tight">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-xs text-textMuted mt-1 capitalize">
            {formatLongDate()}
          </p>
        </div>

        {/* HERO — Iniciar rota ou Em rota */}
        <HeroRoute
          routeActive={routeActive}
          totalChildren={totalChildren}
          absentCount={absentCount}
          loading={loading}
          onStart={() => navigate('/tio/route')}
          onResume={() => navigate('/tio/route/map')}
        />

        {/* HOJE — stats em grade 2x2 */}
        <Section label="Hoje">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Users}
              label="Crianças"
              value={loading ? null : totalChildren}
              tone="primary"
            />
            <ReceivableCard
              amount={receivableTotal}
              visible={showReceivable}
              onToggle={() => setShowReceivable((v) => !v)}
            />
            <StatCard
              icon={CheckCircle2}
              label="Entregues"
              value={loading ? null : delivered}
              tone="success"
            />
            <StatCard
              icon={UserX}
              label="Ausentes"
              value={loading ? null : absentCount}
              tone={absentCount > 0 ? 'warning' : 'muted'}
            />
          </div>

          {/* Lista resumida de ausências do dia */}
          {absentCount > 0 && (
            <AbsenceList absences={absences} />
          )}
        </Section>

        {/* Banners de ação (só aparecem quando há pendência) */}
        {overdueCount > 0 && (
          <ActionBanner
            tone="danger"
            icon={CircleAlert}
            title={`${overdueCount} pagamento${overdueCount > 1 ? 's' : ''} atrasado${overdueCount > 1 ? 's' : ''}`}
            subtitle={`Total: ${formatCurrency(overdueTotal)} · Toque para revisar`}
            onClick={() => navigate('/tio/finance')}
          />
        )}
        {claimedCount > 0 && (
          <ActionBanner
            tone="warning"
            icon={AlertTriangle}
            title={`${claimedCount} pai${claimedCount > 1 ? 's' : ''} marcou pagamento`}
            subtitle="Confirmar recebimento"
            onClick={() => navigate('/tio/finance')}
          />
        )}

        {/* AÇÕES RÁPIDAS — grade 2x2 */}
        <Section label="Ações rápidas">
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              icon={Megaphone}
              title="Avisar"
              subtitle='"Sem aula"'
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-amber-500"
              onClick={() => setBroadcastOpen(true)}
            />
            <QuickAction
              icon={ListOrdered}
              title="Planejar"
              subtitle="rota padrão"
              gradient="from-emerald-50 to-green-100"
              iconBg="bg-emerald-600"
              onClick={() => navigate('/tio/route/plan')}
            />
            <QuickAction
              icon={Users}
              title="Gerenciar"
              subtitle="crianças"
              gradient="from-blue-50 to-indigo-100"
              iconBg="bg-indigo-600"
              onClick={() => navigate('/tio/children')}
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

        {/* PERÍODOS DE HOJE — reflete o relógio + estado da rota */}
        <Section label="Períodos de hoje">
          {(() => {
            const now = getCurrentPeriod();
            // Resolve estados a partir do relógio (manhã: 04h-09h, tarde: 11h-14h, noite: 16h-19h)
            const periodStatus = (period) => {
              if (now === period && routeActive) return { tone: 'active', label: 'Em andamento' };
              if (now === period) return { tone: 'idle', label: 'Aguardando início' };
              if (isPeriodPast(period)) return { tone: 'done', label: 'Encerrado' };
              return { tone: 'idle', label: 'Mais tarde' };
            };
            const morning = periodStatus('morning');
            const afternoon = periodStatus('afternoon');
            return (
              <>
                <PeriodRow
                  icon={Sunrise}
                  title="Manhã"
                  subtitle={morning.label}
                  tone={morning.tone}
                />
                <PeriodRow
                  icon={Sunset}
                  title="Tarde"
                  subtitle={afternoon.label}
                  tone={afternoon.tone}
                />
              </>
            );
          })()}
        </Section>
      </div>

      <SchoolBroadcastSheet
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
    </>
  );
}

/* ─────────────────────────── HERO ─────────────────────────── */

function HeroRoute({ routeActive, totalChildren, absentCount, loading, onStart, onResume }) {
  if (routeActive) {
    return (
      <button
        onClick={onResume}
        className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/20"
      >
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5 relative">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            EM ROTA · AO VIVO
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold leading-none">Rota ativa</p>
              <p className="text-white/80 text-sm mt-1">
                Toque para abrir o mapa
              </p>
            </div>
            <Bus size={48} strokeWidth={1.5} className="text-white/90" />
          </div>
        </div>
      </button>
    );
  }

  const effective = Math.max(0, totalChildren - absentCount);

  return (
    <button
      onClick={onStart}
      className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/20"
    >
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Rota da manhã
            </p>
            <p className="text-3xl font-bold leading-tight mt-1">Iniciar rota</p>
            <p className="text-white/90 text-sm mt-2">
              {loading ? (
                <span className="opacity-70">Carregando...</span>
              ) : (
                <>
                  <span className="font-semibold">{effective}</span>{' '}
                  {effective === 1 ? 'criança' : 'crianças'} hoje
                  {absentCount > 0 && (
                    <span className="opacity-75">
                      {' '}
                      · {absentCount} ausente{absentCount > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <Bus size={48} strokeWidth={1.5} className="text-white/90" />
        </div>

        <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold">
          <PlayCircle size={18} />
          Tocar para iniciar
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────── COMPONENTES VISUAIS ─────────────────────── */

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

function StatCard({ icon: Icon, label, value, tone = 'primary' }) {
  const tones = {
    primary: { bg: 'bg-primary/10', fg: 'text-primary' },
    success: { bg: 'bg-success/10', fg: 'text-lime-700' },
    warning: { bg: 'bg-warning/15', fg: 'text-amber-700' },
    muted: { bg: 'bg-gray-100', fg: 'text-textMuted' },
  };
  const t = tones[tone] || tones.primary;

  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.bg}`}>
        <Icon size={18} className={t.fg} />
      </div>
      <div>
        <p className="text-xs text-textMuted">{label}</p>
        {value === null ? (
          <Skeleton className="h-8 w-12 mt-1" />
        ) : (
          <p className="text-3xl font-bold text-text leading-none mt-1">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function ReceivableCard({ amount, visible, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="tap text-left bg-card rounded-2xl shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100">
        <DollarSign size={18} className="text-amber-700" />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-textMuted">A receber</p>
          {visible ? (
            <EyeOff size={14} className="text-textMuted" />
          ) : (
            <Eye size={14} className="text-textMuted" />
          )}
        </div>
        {visible ? (
          <p className="text-xl font-bold text-text leading-none mt-1 tabular-nums">
            {formatCurrency(amount)}
          </p>
        ) : (
          <p className="text-xl font-bold text-textMuted leading-none mt-1 tracking-wider">
            ••••••
          </p>
        )}
      </div>
    </button>
  );
}

function ActionBanner({ tone, icon: Icon, title, subtitle, onClick }) {
  const tones = {
    danger: 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200 text-red-900',
    warning:
      'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 text-amber-900',
  };
  const iconBg = {
    danger: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
  };
  return (
    <button
      onClick={onClick}
      className={`tap w-full text-left rounded-2xl p-4 border flex items-center gap-3 ${tones[tone]}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg[tone]}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="opacity-60 shrink-0" />
    </button>
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
      {disabled && (
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-bold text-textMuted bg-white/60 px-2 py-0.5 rounded-full">
          Em breve
        </span>
      )}
    </button>
  );
}

function AbsenceList({ absences }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm divide-y divide-gray-100">
      {absences.map((a) => (
        <div key={a.id} className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <UserX size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text truncate">
              {a.childName || 'Aluno'}
            </p>
            <p className="text-[11px] text-textMuted truncate">
              {ABSENCE_SHORT[a.type] || 'Ausência'} ·{' '}
              {a.declaredBy === 'parent' ? 'avisado pelo pai' : 'registrado por você'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PeriodRow({ icon: Icon, title, subtitle, tone }) {
  const wrap = {
    active: 'bg-emerald-100 text-emerald-700',
    done: 'bg-blue-100 text-blue-700',
    idle: 'bg-gray-100 text-textMuted',
  }[tone];
  const dotColor = {
    active: 'bg-emerald-500',
    done: 'bg-blue-500',
    idle: 'bg-gray-300',
  }[tone];

  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${wrap}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {tone === 'active' ? (
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : (
            <span className={`inline-flex h-2 w-2 rounded-full ${dotColor}`} />
          )}
          <p className="text-xs text-textMuted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
