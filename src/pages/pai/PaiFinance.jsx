import { useState, useMemo } from 'react';
import {
  MessageCircle,
  DollarSign,
  Banknote,
  X,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import PixBlock from '../../components/payments/PixBlock';
import ReceiptPicker from '../../components/payments/ReceiptPicker';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import {
  computeDisplayStatus,
  claimPayment,
  unclaimPayment,
} from '../../services/paymentsService';
import { uploadPaymentReceipt, fileHash } from '../../services/photoService';
import {
  logPaymentEvent,
  PAYMENT_EVENTS,
} from '../../services/paymentAuditService';
import {
  notifyPaymentClaimed,
} from '../../services/notificationsService';
import {
  formatCurrency,
  formatMonthLabel,
} from '../../utils/formatters';

export default function PaiFinance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { payments, loading } = usePaymentsByParent(user?.uid);
  const { admin } = useAdminProfile();
  // Fluxo do "Paguei": primeiro escolhe o método, depois confirma
  const [methodPicker, setMethodPicker] = useState(null); // payment escolhido
  const [claiming, setClaiming] = useState(null); // { payment, method }
  // Comprovante escolhido antes de confirmar o aviso de pagamento.
  const [receiptFile, setReceiptFile] = useState(null);
  const [unclaiming, setUnclaiming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * O que o pai realmente DEVE.
   *
   * Duas correções em relação à versão anterior:
   *
   * 1. `claimed` NÃO é dívida. Ele já pagou e está esperando o motorista
   *    confirmar — cobrar de novo por algo que ele resolveu é o tipo de
   *    erro que faz a pessoa desconfiar do app.
   *
   * 2. Não existe total acumulado de quanto ele já pagou. Esse número não
   *    serve pra nenhuma decisão dele, e soa como lembrete de quanto
   *    gastou. O valor de cada mês aparece na linha do mês, que é onde
   *    ele procura.
   */
  const debtTotal = useMemo(
    () =>
      payments.reduce((acc, p) => {
        const s = computeDisplayStatus(p);
        if (s === 'pending' || s === 'overdue') {
          return acc + (Number(p.amount) || 0);
        }
        return acc;
      }, 0),
    [payments]
  );

  // A mensalidade que o pai vai pagar agora: a mais antiga ainda em aberto.
  // Guia o bloco PIX pra ele nao ter que escolher nada.
  const nextToPay = useMemo(() => {
    const open = payments
      .filter((p) => computeDisplayStatus(p) !== 'paid' && p.status !== 'claimed')
      .map((p) => ({
        ...p,
        _due: p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null),
      }))
      .filter((p) => p._due)
      .sort((a, b) => a._due - b._due);
    return open[0] || null;
  }, [payments]);

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
    setReceiptFile(null);
  };

  const onConfirmClaim = async () => {
    if (!claiming) return;
    const { payment, method } = claiming;
    setActionLoading(true);
    try {
      // Sobe o comprovante ANTES de marcar como pago: se o upload falhar,
      // o pagamento nao fica avisado sem o anexo que o tio espera.
      let receiptURL = null;
      let receiptHash = null;
      if (receiptFile) {
        try {
          // O hash sai do arquivo ORIGINAL, antes de qualquer
          // redimensionamento — senão dois envios do mesmo print podiam
          // gerar hashes diferentes e a duplicata passaria batido.
          receiptHash = await fileHash(receiptFile);
          receiptURL = await uploadPaymentReceipt(payment.id, receiptFile);
        } catch (err) {
          console.error('Falha ao subir comprovante:', err);
          toast.error('Nao deu pra anexar o comprovante. Avisamos sem ele.');
        }
      }

      await claimPayment(payment.id, method, receiptURL, receiptHash);

      // Trilha append-only: este registro não pode ser apagado por
      // ninguém depois, nem pelo motorista. É o que dá ao pai uma prova
      // de que ele avisou, na data em que avisou.
      logPaymentEvent(payment.id, {
        type: receiptURL
          ? PAYMENT_EVENTS.RECEIPT_ATTACHED
          : PAYMENT_EVENTS.CLAIMED,
        actorUid: user?.uid,
        actorRole: 'parent',
        note: method === 'cash' ? 'Pagamento em dinheiro' : 'Pagamento via PIX',
      });

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

      if (receiptURL) {
        // Comprovante ja esta no app — nao faz sentido empurrar o pai pro
        // WhatsApp. Era exatamente essa conversa paralela que queriamos
        // tirar do caminho.
        toast.success(
          'Pagamento informado com comprovante! O motorista vai confirmar.',
          { duration: 5000 }
        );
      } else if (method === 'pix') {
        // Sem anexo, o WhatsApp segue como plano B.
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
      <Header
        title="Pagamentos"
        action={
          <button
            onClick={() => navigate('/pai/finance/report')}
            aria-label="Ver histórico"
            className="tap inline-flex items-center gap-1 text-primary text-xs font-semibold px-2 py-1"
          >
            <FileText size={16} />
            Histórico
          </button>
        }
      />
      <div className="p-4 space-y-4">
        {/* Pagamento por PIX — copia-e-cola com o valor ja embutido.
          * Antes era so a chave em texto: o pai selecionava, copiava e
          * digitava o valor no app do banco, o que gerava o classico
          * "paguei 32 no lugar de 320". */}
        {nextToPay ? (
          <Card className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-text">
                Pagar {formatMonthLabel(nextToPay.month)}
              </p>
              <p className="text-xs text-textMuted">
                {formatCurrency(nextToPay.amount)}
                {nextToPay.childName ? ` · ${nextToPay.childName}` : ''}
              </p>
            </div>
            {/* txid = id do pagamento, e não o mês.
              *
              * O BR Code aceita 25 caracteres alfanuméricos e o id do
              * Firestore tem 20. Com ele no PIX, cada cobrança fica
              * identificada de forma única no extrato do banco — o que torna
              * a CONCILIAÇÃO automática possível depois, sem trocar mais
              * nada. Com o mês, dois filhos da mesma família geravam o mesmo
              * identificador e o extrato não distinguia um do outro. */}
            <PixBlock
              admin={admin}
              amount={nextToPay.amount}
              txid={nextToPay.id}
            />
          </Card>
        ) : (
          !loading && (
            <Card>
              <p className="text-sm font-semibold text-text">
                Nada a pagar agora
              </p>
              <p className="text-xs text-textMuted mt-1">
                Quando abrir uma mensalidade, o codigo PIX aparece aqui.
              </p>
            </Card>
          )
        )}

        {/* Total no topo SÓ quando ele deve algo. Estando em dia, um card
          * escrito "R$ 0,00 em aberto" não informa nada e ainda ocupa o
          * lugar da lista, que é o que ele veio ver. */}
        {!loading && debtTotal > 0 && (
          <Card>
            <p className="text-xs text-textMuted">Você tem a pagar</p>
            <p className="text-2xl font-bold leading-none mt-2 text-warning">
              {formatCurrency(debtTotal)}
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
              <span className="text-xs block mb-3">
                {claiming.method === 'cash'
                  ? 'O motorista vai confirmar quando estiver com o dinheiro em mãos.'
                  : 'Confirme só se já fez o PIX. O motorista precisa confirmar depois.'}
              </span>
              {/* Anexar aqui, e nao numa tela separada: e o momento em que
                * o pai acabou de pagar e tem o comprovante na mao. */}
              <ReceiptPicker file={receiptFile} onChange={setReceiptFile} />
            </>
          ) : null
        }
        confirmLabel={claiming?.method === 'cash' ? 'Sim, paguei' : 'Sim, paguei'}
        loading={actionLoading}
        onConfirm={onConfirmClaim}
        onCancel={() => {
          setClaiming(null);
          setReceiptFile(null);
        }}
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
