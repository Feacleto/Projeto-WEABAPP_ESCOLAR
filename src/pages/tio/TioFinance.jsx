import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Plus, Loader2, Key, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import {
  generateMonthlyPayments,
  confirmReceipt,
  undoReceipt,
  computeDisplayStatus,
} from '../../services/paymentsService';
import { notifyPaymentConfirmed } from '../../services/notificationsService';
import {
  getCurrentMonthKey,
  formatMonthLabel,
  formatCurrency,
} from '../../utils/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'claimed', label: 'Aguardando' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'paid', label: 'Pago' },
];

export default function TioFinance() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [monthKey] = useState(getCurrentMonthKey());
  const { payments, loading } = usePaymentsByMonth(monthKey);
  const [filter, setFilter] = useState('all');

  // Modal "gerar pagamentos"
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [dueDay, setDueDay] = useState(10);
  const [generating, setGenerating] = useState(false);

  // Confirmar / desfazer recebimento
  const [confirming, setConfirming] = useState(null); // payment a confirmar
  const [unconfirming, setUnconfirming] = useState(null); // payment a desfazer
  const [actionLoading, setActionLoading] = useState(false);

  // Anota cada pagamento com seu display status — evita recalcular toda hora
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
      claimedCount: enriched.filter((p) => p._display === 'claimed').length,
    };
  }, [enriched]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const { created, withoutParent } = await generateMonthlyPayments(
        monthKey,
        dueDay
      );
      if (created === 0) {
        toast.success('Pagamentos do mês já estão gerados.');
      } else {
        toast.success(`${created} pagamento(s) criado(s).`);
      }
      if (withoutParent > 0) {
        toast(
          `${withoutParent} criança(s) sem responsável vinculado — pulei.`,
          { icon: '⚠️', duration: 6000 }
        );
      }
      setGenModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar pagamentos.');
    } finally {
      setGenerating(false);
    }
  };

  const onConfirmReceipt = async () => {
    if (!confirming) return;
    setActionLoading(true);
    try {
      await confirmReceipt(confirming.id);
      // Notifica pai de forma fire-and-forget (não trava a UI)
      notifyPaymentConfirmed({
        parentUid: confirming.parentUid,
        paymentId: confirming.id,
        monthLabel: formatMonthLabel(confirming.month),
        amount: confirming.amount,
      });
      toast.success(`Recebimento de ${confirming.childName} confirmado.`);
      setConfirming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao confirmar recebimento.');
    } finally {
      setActionLoading(false);
    }
  };

  const onUndoReceipt = async () => {
    if (!unconfirming) return;
    setActionLoading(true);
    try {
      await undoReceipt(unconfirming.id);
      toast.success(`Confirmação de ${unconfirming.childName} desfeita.`);
      setUnconfirming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao desfazer confirmação.');
    } finally {
      setActionLoading(false);
    }
  };

  const hasPix = !!profile?.pixKey;

  return (
    <>
      <Header
        title={`Financeiro · ${formatMonthLabel(monthKey)}`}
        action={
          <button
            onClick={() => setGenModalOpen(true)}
            disabled={generating}
            aria-label="Gerar pagamentos do mês"
            className="text-primary tap p-1 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Plus size={22} />
            )}
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* PIX banner */}
        <button
          type="button"
          onClick={() => navigate('/tio/pix')}
          className={`w-full text-left rounded-xl p-3 flex items-center gap-3 tap border ${
            hasPix
              ? 'bg-card border-gray-200'
              : 'bg-warning/10 border-warning/30'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              hasPix ? 'bg-primary/10' : 'bg-warning/20'
            }`}
          >
            <Key size={20} className={hasPix ? 'text-primary' : 'text-warning'} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">
              {hasPix ? 'Chave PIX cadastrada' : 'Cadastre sua chave PIX'}
            </p>
            <p className="text-xs text-textMuted truncate">
              {hasPix
                ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey}`
                : 'Os pais precisam dela pra pagar pelo app.'}
            </p>
          </div>
          <ChevronRight size={20} className="text-textMuted shrink-0" />
        </button>

        {totals.claimedCount > 0 && (
          <Card className="bg-primary/5 border border-primary/20">
            <p className="text-sm text-primaryDark font-medium">
              {totals.claimedCount} pagamento(s) aguardando sua confirmação.
            </p>
            <p className="text-xs text-textMuted mt-1">
              Verifique os comprovantes no WhatsApp e confirme abaixo.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-textMuted">Recebido</p>
            <p className="text-2xl font-bold text-success leading-none mt-2">
              {formatCurrency(totals.paid)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-textMuted">A receber</p>
            <p className="text-2xl font-bold text-warning leading-none mt-2">
              {formatCurrency(totals.open)}
            </p>
          </Card>
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold tap border ${
                filter === f.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Nenhum pagamento"
            description={`Toque em + ou no botão abaixo para gerar pagamentos de ${formatMonthLabel(monthKey)}.`}
            action={
              <Button
                onClick={() => setGenModalOpen(true)}
                icon={Plus}
                fullWidth={false}
              >
                Gerar pagamentos
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Nada por aqui"
            description="Sem pagamentos com esse filtro."
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                displayStatus={payment._display}
                action={renderAction(payment, {
                  onConfirm: () => setConfirming(payment),
                  onUndo: () => setUnconfirming(payment),
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal: gerar pagamentos com seleção de dia de vencimento */}
      {genModalOpen && (
        <DueDayModal
          dueDay={dueDay}
          onChange={setDueDay}
          onClose={() => setGenModalOpen(false)}
          onConfirm={onGenerate}
          loading={generating}
          monthLabel={formatMonthLabel(monthKey)}
        />
      )}

      {/* Confirmar recebimento (incluindo pré-confirmação dupla pra evitar erro) */}
      <ConfirmDialog
        open={!!confirming}
        title="Confirmar recebimento?"
        description={
          confirming ? (
            <>
              Você confirma que recebeu o pagamento de{' '}
              <strong className="text-text">{confirming.childName}</strong> (
              {formatCurrency(confirming.amount)} ·{' '}
              {formatMonthLabel(confirming.month)})?
              <br />
              <span className="text-xs">
                O pai vai ser notificado de que o pagamento foi reconhecido.
              </span>
            </>
          ) : null
        }
        confirmLabel="Sim, confirmar"
        loading={actionLoading}
        onConfirm={onConfirmReceipt}
        onCancel={() => setConfirming(null)}
      />

      {/* Desfazer confirmação */}
      <ConfirmDialog
        open={!!unconfirming}
        title="Desfazer confirmação?"
        description={
          unconfirming
            ? `Isso vai voltar o pagamento de ${unconfirming.childName} para "Pendente". Use só se você confirmou por engano.`
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

function renderAction(payment, { onConfirm, onUndo }) {
  if (payment._display === 'paid') {
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
  // pending / overdue: tio dá baixa direto (sem o pai marcar) — caso ele tenha
  // recebido por outro canal (dinheiro, transferência fora do app, etc.)
  return (
    <Button size="sm" fullWidth={false} onClick={onConfirm}>
      Dar baixa
    </Button>
  );
}

function DueDayModal({
  dueDay,
  onChange,
  onClose,
  onConfirm,
  loading,
  monthLabel,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 pt-20"
      onClick={() => !loading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-mobile bg-card rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 p-1 text-textMuted tap"
          disabled={loading}
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-text">Gerar pagamentos</h3>
        <p className="text-sm text-textMuted mt-1 mb-4">
          Pagamentos de {monthLabel} para todas as crianças ativas.
        </p>

        <label className="block text-sm font-medium text-text mb-2">
          Dia de vencimento
        </label>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {[5, 10, 15, 20, 25, 28, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              className={`h-10 rounded-lg text-sm font-semibold tap border ${
                dueDay === d
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text border-gray-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs text-textMuted mb-1">
            Outro dia (1 a 31)
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => onChange(Number(e.target.value) || 1)}
            className="w-full h-12 rounded-xl border border-gray-200 px-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={loading}>
            Gerar
          </Button>
        </div>
      </div>
    </div>
  );
}
