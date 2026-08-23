import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  ChevronRight,
  ChevronLeft,
  X,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  DollarSign,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import {
  confirmReceipt,
  undoReceipt,
  canUndoReceipt,
  computeDisplayStatus,
} from '../../services/paymentsService';
import { notifyPaymentConfirmed } from '../../services/notificationsService';
import {
  formatMonthLabel,
  formatCurrency,
  getCurrentMonthKey,
} from '../../utils/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';

/**
 * Financeiro do Tio — dashboard mês-a-mês.
 *
 * Mudanças vs versão anterior:
 *   - Seletor de mês (12 meses pra trás navegáveis)
 *   - Pagamentos do mês corrente são GERADOS AUTOMATICAMENTE pelo useAutoBilling
 *     (não tem mais botão "+" manual)
 *   - Ao "dar baixa", sheet pergunta como o tio recebeu: PIX, Dinheiro ou Cartão
 *   - Hero card "Recebido" + "Pra receber" em destaque (gradiente)
 */
export default function TioFinance() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const { payments, loading } = usePaymentsByMonth(monthKey);
  const [filter, setFilter] = useState('all');

  // Confirmar / desfazer recebimento
  const [methodSheetFor, setMethodSheetFor] = useState(null); // payment ou null
  const [unconfirming, setUnconfirming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return enriched;
    return enriched.filter((p) => p._display === filter);
  }, [enriched, filter]);

  const totals = useMemo(() => {
    const sumByStatus = (statuses) =>
      enriched
        .filter((p) => statuses.includes(p._display))
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return {
      paid: sumByStatus(['paid']),
      open: sumByStatus(['pending', 'overdue', 'claimed']),
      overdueCount: enriched.filter((p) => p._display === 'overdue').length,
      claimedCount: enriched.filter((p) => p._display === 'claimed').length,
    };
  }, [enriched]);

  const hasPix = !!profile?.pixKey;
  const isCurrentMonth = monthKey === getCurrentMonthKey();

  const onMethodSelected = async (method) => {
    if (!methodSheetFor) return;
    const payment = methodSheetFor;
    setActionLoading(true);
    try {
      await confirmReceipt(payment.id, method);
      notifyPaymentConfirmed({
        parentUid: payment.parentUid,
        paymentId: payment.id,
        monthLabel: formatMonthLabel(payment.month),
        amount: payment.amount,
        childName: payment.childName,
      });
      toast.success(`Recebimento de ${payment.childName} confirmado.`);
      setMethodSheetFor(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao confirmar.');
    } finally {
      setActionLoading(false);
    }
  };

  const onUndoReceipt = async () => {
    if (!unconfirming) return;
    setActionLoading(true);
    try {
      // Passa o doc inteiro pra o service validar tempo + método.
      await undoReceipt(unconfirming.id, unconfirming);
      toast.success(`Confirmação desfeita.`);
      setUnconfirming(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Erro ao desfazer.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Header
        title="Pagamentos"
        action={
          <button
            onClick={() => navigate('/tio/finance/report')}
            aria-label="Ver relatório"
            className="tap inline-flex items-center gap-1 text-primary text-xs font-semibold px-2 py-1"
          >
            <FileText size={16} />
            Relatório
          </button>
        }
      />

      <div className="p-5 space-y-5">
        {/* Seletor de mês */}
        <MonthSwitcher
          monthKey={monthKey}
          onChange={setMonthKey}
        />

        {/* Hero: recebido vs a receber */}
        <FinanceHero
          paid={totals.paid}
          open={totals.open}
          overdueCount={totals.overdueCount}
          claimedCount={totals.claimedCount}
        />

        {/* PIX banner — só se for mês corrente */}
        {isCurrentMonth && (
          <button
            type="button"
            onClick={() => navigate('/tio/pix')}
            className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 border ${
              hasPix
                ? 'bg-card border-gray-200'
                : 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasPix ? 'bg-primary/10' : 'bg-amber-500 text-white'
              }`}
            >
              <Key size={20} className={hasPix ? 'text-primary' : ''} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text leading-tight">
                {hasPix ? 'Chave PIX cadastrada' : 'Cadastre sua chave PIX'}
              </p>
              <p className="text-xs text-textMuted mt-0.5 truncate">
                {hasPix
                  ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey}`
                  : 'Os pais precisam pra pagar pelo app'}
              </p>
            </div>
            <ChevronRight size={18} className="text-textMuted shrink-0" />
          </button>
        )}

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 -mb-1">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'claimed', label: 'Aguardando' },
            { value: 'overdue', label: 'Atrasados' },
            { value: 'pending', label: 'Pendentes' },
            { value: 'paid', label: 'Pagos' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : enriched.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum pagamento"
            description={
              isCurrentMonth
                ? 'Os pagamentos do mês são gerados quando você cadastra crianças.'
                : `Sem registros pra ${formatMonthLabel(monthKey)}.`
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Nada por aqui"
            description="Sem pagamentos com esse filtro."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                displayStatus={payment._display}
                action={renderAction(payment, {
                  onConfirm: () => setMethodSheetFor(payment),
                  onUndo: () => setUnconfirming(payment),
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheet "Como você recebeu?" */}
      {methodSheetFor && (
        <MethodSheet
          payment={methodSheetFor}
          loading={actionLoading}
          onPick={onMethodSelected}
          onClose={() => !actionLoading && setMethodSheetFor(null)}
        />
      )}

      {/* Desfazer confirmação */}
      <ConfirmDialog
        open={!!unconfirming}
        title="Desfazer confirmação?"
        description={
          unconfirming
            ? `O pagamento de ${unconfirming.childName} volta para "Pendente". Use só se você confirmou por engano.`
            : null
        }
        confirmLabel="Sim, desfazer"
        variant="danger"
        loading={actionLoading}
        onConfirm={onUndoReceipt}
        onCancel={() => setUnconfirming(null)}
      />
    </>
  );
}

/* ─────────────── Componentes ─────────────── */

function MonthSwitcher({ monthKey, onChange }) {
  const goPrev = () => onChange(addMonths(monthKey, -1));
  const goNext = () => onChange(addMonths(monthKey, 1));
  const current = getCurrentMonthKey();
  const canGoNext = monthKey < current;

  // Limita até 12 meses pra trás (alinhado com a retenção)
  const minMonth = addMonths(current, -11);
  const canGoPrev = monthKey > minMonth;

  return (
    <div className="flex items-center justify-between bg-card rounded-2xl shadow-sm p-2">
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoPrev}
        aria-label="Mês anterior"
        className="tap w-10 h-10 rounded-xl flex items-center justify-center text-text disabled:opacity-30"
      >
        <ChevronLeft size={20} />
      </button>
      <p className="text-base font-bold text-text capitalize">
        {formatMonthLabel(monthKey)}
      </p>
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Próximo mês"
        className="tap w-10 h-10 rounded-xl flex items-center justify-center text-text disabled:opacity-30"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function FinanceHero({ paid, open, overdueCount, claimedCount }) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/15">
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-white/80">
            Recebido
          </p>
          <p className="text-4xl font-bold tabular-nums leading-none mt-1">
            {formatCurrency(paid)}
          </p>
        </div>
        <div className="border-t border-white/20 pt-3">
          <p className="text-xs uppercase tracking-widest font-semibold text-white/80">
            Pra receber
          </p>
          <p className="text-2xl font-bold tabular-nums leading-none mt-1">
            {formatCurrency(open)}
          </p>
          {(overdueCount > 0 || claimedCount > 0) && (
            <div className="flex gap-2 mt-2 text-xs">
              {overdueCount > 0 && (
                <span className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  {overdueCount} atrasado{overdueCount > 1 ? 's' : ''}
                </span>
              )}
              {claimedCount > 0 && (
                <span className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  {claimedCount} aguardando você
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderAction(payment, { onConfirm, onUndo }) {
  if (payment._display === 'paid') {
    // Só mostra "Desfazer" enquanto a regra de reversão permitir.
    // Cartão nunca permite; PIX/dinheiro permitem dentro de 24h.
    const { allowed } = canUndoReceipt(payment);
    if (!allowed) return null;
    return (
      <Button size="sm" variant="ghost" fullWidth={false} onClick={onUndo}>
        Desfazer
      </Button>
    );
  }
  if (payment._display === 'claimed') {
    return (
      <Button size="sm" variant="success" fullWidth={false} onClick={onConfirm}>
        Confirmar
      </Button>
    );
  }
  return (
    <Button size="sm" fullWidth={false} onClick={onConfirm}>
      Dar baixa
    </Button>
  );
}

/* ─────────────── Sheet "Como recebeu?" ─────────────── */

function MethodSheet({ payment, loading, onPick, onClose }) {
  const claimedMethod = payment.paymentMethod; // o que o pai declarou (se houver)

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                Como você recebeu?
              </h2>
              <p className="text-xs text-textMuted mt-1">
                {payment.childName} · {formatCurrency(payment.amount)}
                {claimedMethod && (
                  <span className="ml-1">
                    · pai marcou:{' '}
                    {claimedMethod === 'cash' ? 'dinheiro' : 'PIX'}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <MethodOption
              icon={QrCode}
              title="PIX"
              subtitle="Recebido por PIX"
              gradient="from-emerald-50 to-green-100"
              iconBg="bg-emerald-600"
              onClick={() => onPick('pix')}
              disabled={loading}
            />
            <MethodOption
              icon={Banknote}
              title="Dinheiro"
              subtitle="Recebido em mãos"
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-amber-600"
              onClick={() => onPick('cash')}
              disabled={loading}
            />
            <MethodOption
              icon={CreditCard}
              title="Cartão"
              subtitle="Recebido por cartão"
              gradient="from-violet-50 to-purple-100"
              iconBg="bg-violet-600"
              onClick={() => onPick('card')}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodOption({
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
      disabled={disabled}
      className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br ${gradient} ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>
      </div>
      {!disabled && <ChevronRight size={18} className="text-textMuted" />}
    </button>
  );
}

/* ─────────────── helpers ─────────────── */

function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}
