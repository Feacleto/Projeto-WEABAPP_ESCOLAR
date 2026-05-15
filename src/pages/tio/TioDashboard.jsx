import { useEffect, useMemo, useState } from 'react';
import {
  Bus,
  CircleAlert,
  AlertTriangle,
  Megaphone,
  ListOrdered,
  HelpCircle,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  History,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { onSnapshot, doc } from 'firebase/firestore';
import Header from '../../components/layout/Header';
import SchoolBroadcastSheet from '../../components/broadcasts/SchoolBroadcastSheet';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { useAbsences } from '../../hooks/useAbsences';
import { db } from '../../firebase/config';
import { formatCurrency, getCurrentMonthKey } from '../../utils/formatters';
import { getDateKey } from '../../services/routePlanService';

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

/**
 * Frase principal do hero — adapta pro horário, pro estado da rota e pra
 * quantidade de crianças do dia. Linguagem coloquial.
 */
function heroPhrase({ routeActive, total, hour }) {
  if (routeActive) return 'Você tá em rota!';
  if (total === 0) return 'Cadastre suas primeiras crianças';
  if (hour < 11) return 'Hora de buscar a turma!';
  if (hour < 13) return 'Hora da volta da escola';
  if (hour < 17) return 'Hora de buscar pra trazer';
  return 'Boa noite — bom descanso!';
}

export default function TioDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { openTutorial } = useOutletContext() || {};
  const { children } = useChildren();
  const { payments } = usePaymentsByMonth(getCurrentMonthKey());
  const todayKey = getDateKey();
  const { absences } = useAbsences(todayKey);

  const [routeActive, setRouteActive] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const absentCount = absences.length;
  const effectiveCount = Math.max(0, totalChildren - absentCount);

  const { receivableTotal, overdueCount, claimedCount } = useMemo(() => {
    let receivable = 0;
    let overdueC = 0;
    let claimedC = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const p of payments) {
      if (p.status === 'paid') continue;
      receivable += Number(p.amount) || 0;
      if (p.status === 'claimed') claimedC++;
      const due =
        p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null);
      if (due && due < today && p.status !== 'claimed') overdueC++;
    }
    return {
      receivableTotal: receivable,
      overdueCount: overdueC,
      claimedCount: claimedC,
    };
  }, [payments]);

  const firstName = profile?.name?.split(' ')[0] || 'Tio';
  const phrase = heroPhrase({
    routeActive,
    total: totalChildren,
    hour: new Date().getHours(),
  });

  return (
    <>
      <Header title="Início" />

      <div className="p-5 space-y-5">
        {/* Saudação — minúscula, contexto */}
        <div>
          <p className="text-xs text-textMuted capitalize">
            {formatLongDate()}
          </p>
          <h1 className="text-2xl font-bold text-text leading-tight mt-1">
            {greeting()}, {firstName}
          </h1>
        </div>

        {/* HERO — único elemento dominante. Tap inteiro = começar/continuar */}
        <HeroCard
          routeActive={routeActive}
          phrase={phrase}
          effectiveCount={effectiveCount}
          absentCount={absentCount}
          onTap={() => navigate('/tio/route')}
        />

        {/* Banners de ação — só aparecem se houver algo pra fazer */}
        {overdueCount > 0 && (
          <Banner
            tone="danger"
            icon={CircleAlert}
            title={`${overdueCount} pagamento${overdueCount > 1 ? 's' : ''} atrasado${overdueCount > 1 ? 's' : ''}`}
            subtitle="Toque pra ver e cobrar"
            onClick={() => navigate('/tio/finance')}
          />
        )}
        {claimedCount > 0 && (
          <Banner
            tone="warning"
            icon={AlertTriangle}
            title={`${claimedCount} pai${claimedCount > 1 ? 's' : ''} marcou pagamento`}
            subtitle="Confirmar recebimento"
            onClick={() => navigate('/tio/finance')}
          />
        )}

        {/* "Mais opções" — expansão em-place */}
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
                icon={Users}
                title="Minha turma"
                subtitle={`${totalChildren} ${totalChildren === 1 ? 'criança cadastrada' : 'crianças cadastradas'}`}
                onClick={() => navigate('/tio/children')}
              />
              <OptionRow
                icon={ListOrdered}
                title="Organizar rota padrão"
                subtitle="A ordem que você usa todo dia"
                onClick={() => navigate('/tio/route/plan')}
              />
              <OptionRow
                icon={Megaphone}
                title="Avisar que não tem aula"
                subtitle="Marca falta de toda uma escola"
                onClick={() => setBroadcastOpen(true)}
              />
              <ReceivableRow
                amount={receivableTotal}
                visible={showReceivable}
                onToggle={() => setShowReceivable((v) => !v)}
                onClick={() => navigate('/tio/finance')}
              />
              <OptionRow
                icon={History}
                title="Pagamentos do mês"
                subtitle="Quem já pagou, quem falta"
                onClick={() => navigate('/tio/finance')}
              />
              <OptionRow
                icon={HelpCircle}
                title="Como usar o app"
                subtitle="Tutorial passo a passo"
                onClick={() => openTutorial?.({ floating: true })}
              />
            </div>
          )}
        </div>
      </div>

      <SchoolBroadcastSheet
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
    </>
  );
}

/* ─────────────── HERO ─────────────── */

function HeroCard({ routeActive, phrase, effectiveCount, absentCount, onTap }) {
  if (routeActive) {
    return (
      <button
        onClick={onTap}
        className="tap w-full text-left rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25"
      >
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-white opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Em rota agora
          </div>
          <p className="text-4xl font-bold leading-tight mt-3">{phrase}</p>
          <p className="text-white/85 mt-2">Toque pra gerenciar a rota</p>
          <div className="mt-5 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2.5 font-semibold">
            Abrir rota <ArrowRight size={18} />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onTap}
      className="tap w-full text-left rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25"
    >
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-4xl font-bold leading-tight">{phrase}</p>
            <p className="text-white/90 mt-3 text-lg">
              {effectiveCount === 0 ? (
                'Nenhuma criança hoje'
              ) : (
                <>
                  <span className="font-bold">{effectiveCount}</span>{' '}
                  {effectiveCount === 1 ? 'criança' : 'crianças'} hoje
                  {absentCount > 0 && (
                    <span className="text-white/70 text-sm">
                      {' '}
                      · {absentCount} ausente{absentCount > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <Bus size={48} strokeWidth={1.6} className="text-white/90 shrink-0" />
        </div>

        <div className="mt-6 inline-flex items-center gap-2 bg-white text-emerald-700 rounded-full px-5 py-3 font-bold text-base shadow-md">
          Começar agora <ArrowRight size={18} />
        </div>
      </div>
    </button>
  );
}

/* ─────────────── BANNERS / ROWS ─────────────── */

function Banner({ tone, icon: Icon, title, subtitle, onClick }) {
  const styles = {
    danger:
      'bg-gradient-to-br from-red-50 to-rose-100 border-red-200 text-red-900',
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
      className={`tap w-full text-left rounded-2xl p-4 border flex items-center gap-3 ${styles[tone]}`}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg[tone]}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-tight">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="opacity-60 shrink-0" />
    </button>
  );
}

function OptionRow({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="tap w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}

function ReceivableRow({ amount, visible, onToggle, onClick }) {
  return (
    <div className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <Eye size={20} className={visible ? '' : 'hidden'} />
        <EyeOff size={20} className={visible ? 'hidden' : ''} />
      </div>
      <button
        onClick={onClick}
        className="tap flex-1 min-w-0 text-left"
      >
        <p className="font-semibold text-text leading-tight">Pra receber</p>
        <p className="text-xl font-bold text-text mt-0.5 tabular-nums">
          {visible ? formatCurrency(amount) : '••••••'}
        </p>
      </button>
      <button
        onClick={onToggle}
        aria-label={visible ? 'Ocultar valor' : 'Mostrar valor'}
        className="tap text-textMuted p-2"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
