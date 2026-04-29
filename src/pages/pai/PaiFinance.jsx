import { useState, useMemo } from 'react';
import {
  Copy,
  MessageCircle,
  Check,
  DollarSign,
  Key,
  Banknote,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import {
  computeDisplayStatus,
  claimPayment,
  unclaimPayment,
} from '../../services/paymentsService';
import {
  notifyPaymentClaimed,
} from '../../services/notificationsService';
import {
  PIX_KEY_TYPES,
  normalizePixKey,
} from '../../services/userService';
import {
  formatCurrency,
  formatMonthLabel,
  formatPhone,
} from '../../utils/formatters';

export default function PaiFinance() {
  const { user } = useAuth();
  const { payments, loading } = usePaymentsByParent(user?.uid);
  const { admin } = useAdminProfile();

  const [copied, setCopied] = useState(false);
  // Fluxo do "Paguei": primeiro escolhe o método, depois confirma
  const [methodPicker, setMethodPicker] = useState(null); // payment escolhido
  const [claiming, setClaiming] = useState(null); // { payment, method }
  const [unclaiming, setUnclaiming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Soma do que ainda está em aberto (pendente + atrasado + claimed)
  const openTotal = useMemo(
    () =>
      payments.reduce((acc, p) => {
        const s = computeDisplayStatus(p);
        if (s === 'paid') return acc;
        return acc + (Number(p.amount) || 0);
      }, 0),
    [payments]
  );

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  // Detecta se pai tem mais de uma criança — se sim, mostra nome em cada row
  const childIds = useMemo(
    () => new Set(payments.map((p) => p.childId).filter(Boolean)),
    [payments]
  );
  const hasMultipleChildren = childIds.size > 1;

  const onCopyPix = async () => {
    if (!admin?.pixKey) return;
    const value = normalizePixKey(admin.pixKeyType, admin.pixKey);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Chave PIX copiada!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  // Prepara mensagem pronta pro WhatsApp do tio com detalhes do pagamento
  const buildWhatsAppLink = (payment) => {
    if (!admin?.phone) return null;
    const phoneDigits = String(admin.phone).replace(/\D/g, '');
    const phoneE164 = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    const text = encodeURIComponent(
      `Olá! Acabei de pagar a mensalidade de ${payment.childName} (${formatMonthLabel(payment.month)}) no valor de ${formatCurrency(payment.amount)}. Segue o comprovante.`
    );
    return `https://wa.me/${phoneE164}?text=${text}`;
  };

  const onPickMethod = (method) => {
    if (!methodPicker) return;
    setClaiming({ payment: methodPicker, method });
    setMethodPicker(null);
  };

  const onConfirmClaim = async () => {
    if (!claiming) return;
    const { payment, method } = claiming;
    setActionLoading(true);
    try {
      await claimPayment(payment.id, method);

      // Notifica o tio (fire-and-forget)
      if (admin?.uid) {
        notifyPaymentClaimed({
          adminUid: admin.uid,
          paymentId: payment.id,
          childName: payment.childName,
          monthLabel: formatMonthLabel(payment.month),
          amount: payment.amount,
          method,
        });
      }

      if (method === 'pix') {
        // Abre WhatsApp pra enviar comprovante
        const wa = buildWhatsAppLink(payment);
        if (wa) {
          window.open(wa, '_blank', 'noopener,noreferrer');
          toast.success(
            'Pagamento informado! Envie o comprovante pelo WhatsApp.',
            { duration: 5000 }
          );
        } else {
          toast.success(
            'Pagamento informado! Envie o comprovante pro motorista.',
            { duration: 5000 }
          );
        }
      } else {
        toast.success(
          'Pagamento em dinheiro informado! O motorista vai confirmar quando estiver com o valor.',
          { duration: 6000 }
        );
      }
      setClaiming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao informar pagamento. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirmUnclaim = async () => {
    if (!unclaiming) return;
    setActionLoading(true);
    try {
      await unclaimPayment(unclaiming.id);
      toast.success('Marcação removida.');
      setUnclaiming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao desfazer.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Header title="Pagamentos" />
      <div className="p-4 space-y-4">
        {/* Bloco da chave PIX (se o tio cadastrou) */}
        {admin?.pixKey ? (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Key size={16} className="text-primary" />
              <p className="text-sm font-semibold text-text">Chave PIX</p>
            </div>
            <p className="text-xs text-textMuted mb-1">
              {PIX_KEY_TYPES[admin.pixKeyType]?.label || 'Chave'}
            </p>
            <div className="flex items-center gap-2 bg-bg rounded-lg px-3 py-2 mb-3">
              <p className="text-sm text-text font-mono break-all flex-1">
                {admin.pixKeyType === 'phone'
                  ? formatPhone(admin.pixKey)
                  : admin.pixKey}
              </p>
            </div>
            <Button
              variant={copied ? 'success' : 'primary'}
              icon={copied ? Check : Copy}
              onClick={onCopyPix}
            >
              {copied ? 'Copiado!' : 'Copiar chave PIX'}
            </Button>
            {admin.name && (
              <p className="text-xs text-textMuted mt-2 text-center">
                Pagamento para: <strong>{admin.name}</strong>
              </p>
            )}
          </Card>
        ) : (
          !loading && (
            <Card className="bg-warning/10 border border-warning/30">
              <p className="text-sm text-text">
                O motorista ainda não cadastrou uma chave PIX no app. Combine o
                pagamento direto com ele.
              </p>
            </Card>
          )
        )}

        {!loading && payments.length > 0 && (
          <Card>
            <p className="text-xs text-textMuted">Em aberto</p>
            <p
              className={`text-2xl font-bold leading-none mt-2 ${
                openTotal > 0 ? 'text-warning' : 'text-success'
              }`}
            >
              {formatCurrency(openTotal)}
            </p>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Sem pagamentos ainda"
            description="O motorista ainda não gerou os pagamentos."
          />
        ) : (
          <div className="space-y-3">
            {enriched.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                displayStatus={p._display}
                showChild={hasMultipleChildren}
                action={renderAction(p, {
                  onClaim: () => setMethodPicker(p),
                  onUnclaim: () => setUnclaiming(p),
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Etapa 1: escolher método de pagamento */}
      {methodPicker && (
        <MethodPickerModal
          payment={methodPicker}
          hasPix={!!admin?.pixKey}
          onPick={onPickMethod}
          onClose={() => setMethodPicker(null)}
        />
      )}

      {/* Etapa 2: confirmar "marquei como pago" */}
      <ConfirmDialog
        open={!!claiming}
        title={
          claiming?.method === 'cash'
            ? 'Confirmar pagamento em dinheiro?'
            : 'Confirmar pagamento via PIX?'
        }
        description={
          claiming ? (
            <>
              Você está dizendo que pagou{' '}
              <strong className="text-text">
                {formatCurrency(claiming.payment.amount)}
              </strong>{' '}
              referente a {claiming.payment.childName} (
              {formatMonthLabel(claiming.payment.month)}).
              <br />
              <span className="text-xs">
                {claiming.method === 'cash'
                  ? 'O motorista vai confirmar quando estiver com o dinheiro em mãos.'
                  : 'Vamos abrir o WhatsApp pra você enviar o comprovante. Confirme só se já fez o PIX.'}
              </span>
            </>
          ) : null
        }
        confirmLabel={claiming?.method === 'cash' ? 'Sim, paguei' : 'Sim, paguei'}
        loading={actionLoading}
        onConfirm={onConfirmClaim}
        onCancel={() => setClaiming(null)}
      />

      {/* Desfazer marcação */}
      <ConfirmDialog
        open={!!unclaiming}
        title="Cancelar marcação?"
        description="Use se você marcou como pago por engano. O pagamento volta pra Pendente."
        confirmLabel="Sim, cancelar"
        variant="danger"
        loading={actionLoading}
        onConfirm={onConfirmUnclaim}
        onCancel={() => setUnclaiming(null)}
      />
    </>
  );
}

function renderAction(payment, { onClaim, onUnclaim }) {
  if (payment._display === 'paid') return null;

  if (payment._display === 'claimed') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={onUnclaim}
          className="text-xs text-textMuted underline tap"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // pending / overdue
  return (
    <Button size="sm" fullWidth={false} onClick={onClaim}>
      Paguei
    </Button>
  );
}

function MethodPickerModal({ payment, hasPix, onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 pt-20"
      onClick={onClose}
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
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-text">Como você pagou?</h3>
        <p className="text-sm text-textMuted mt-1 mb-4">
          {payment.childName} · {formatMonthLabel(payment.month)} ·{' '}
          <strong>{formatCurrency(payment.amount)}</strong>
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPick('pix')}
            disabled={!hasPix}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border tap text-left ${
              hasPix
                ? 'bg-card border-gray-200 hover:bg-gray-50'
                : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">PIX</p>
              <p className="text-xs text-textMuted">
                {hasPix
                  ? 'Vamos abrir o WhatsApp pra enviar o comprovante.'
                  : 'O motorista ainda não cadastrou chave PIX.'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick('cash')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card border-gray-200 hover:bg-gray-50 tap text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <Banknote size={20} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">Dinheiro</p>
              <p className="text-xs text-textMuted">
                Você vai entregar o valor em mãos pro motorista.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
