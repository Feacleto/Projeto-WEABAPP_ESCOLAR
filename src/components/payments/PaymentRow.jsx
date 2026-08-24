import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Hourglass,
  Banknote,
  QrCode,
  CreditCard,
  Paperclip,
  Send,
} from 'lucide-react';
import Card from '../common/Card';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from '../../utils/formatters';
import { paymentLabel } from '../../utils/paymentVocabulary';

// A COR fica aqui; o TEXTO vem de utils/paymentVocabulary, que sabe falar
// pro papel de quem está lendo. O estado 'claimed' era o pior caso: o tio
// lia "aguardando confirmação" sem saber que a bola estava com ele.
const STATUS_CONFIG = {
  paid: { color: 'text-lime-700 bg-success/10', Icon: CheckCircle2 },
  claimed: { color: 'text-amber-700 bg-warning/10', Icon: Hourglass },
  pending: { color: 'text-gray-700 bg-gray-100', Icon: Clock },
  overdue: { color: 'text-red-700 bg-danger/10', Icon: AlertCircle },
};

/**
 * Card de uma linha de pagamento — usado por TioFinance e PaiFinance.
 *
 * Props:
 *   - payment:        doc do Firestore
 *   - displayStatus:  'paid' | 'pending' | 'overdue' (calculado fora)
 *   - action:         botão à direita (ex: "Dar baixa") — opcional
 *   - showChild:      mostra nome da criança (default true; Pai esconde)
 */
export default function PaymentRow({
  payment,
  displayStatus,
  action = null,
  showChild = true,
  role = 'parent',
  onAttachReceipt = null,
  onCharge = null,
}) {
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending;
  const { Icon, color } = config;
  const label = paymentLabel(displayStatus, role);

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {showChild && payment.childName && (
            <p className="font-semibold text-text truncate">
              {payment.childName}
            </p>
          )}
          <p className="text-xs text-textMuted capitalize">
            {formatMonthLabel(payment.month)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shrink-0 ${color}`}
        >
          <Icon size={12} />
          {label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-text">
            {formatCurrency(payment.amount)}
          </p>
          <p className="text-[11px] text-textMuted flex items-center gap-1">
            <Calendar size={10} />
            Vence: {formatDate(payment.dueDate)}
            {payment.paidAt && ` · Pago: ${formatDate(payment.paidAt)}`}
          </p>
          {/* Comprovante anexado pelo pai. Fica a um toque pro tio
            * conferir antes de confirmar — era isto que antes virava
            * print de tela no WhatsApp. */}
          {payment.receiptURL ? (
            <a
              href={payment.receiptURL}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline mt-1"
            >
              <Paperclip size={13} />
              Ver comprovante
            </a>
          ) : (
            /* Sem comprovante e já avisado/pago: o tio anexa o print que
             * recebeu no WhatsApp. Sem isso o histórico do mês mostra
             * "pago" sem lastro nenhum. */
            onAttachReceipt &&
            displayStatus !== 'pending' &&
            displayStatus !== 'overdue' && (
              <button
                type="button"
                onClick={onAttachReceipt}
                className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-textMuted underline mt-1"
              >
                <Paperclip size={13} />
                Anexar comprovante
              </button>
            )
          )}
          {payment.paymentMethod && displayStatus !== 'pending' && displayStatus !== 'overdue' && (
            <p className="text-[11px] text-textMuted flex items-center gap-1 mt-0.5">
              {payment.paymentMethod === 'cash' ? (
                <>
                  <Banknote size={10} /> Dinheiro
                </>
              ) : payment.paymentMethod === 'card' ? (
                <>
                  <CreditCard size={10} /> Cartão
                </>
              ) : (
                <>
                  <QrCode size={10} /> PIX
                </>
              )}
            </p>
          )}
        </div>
        {action}
      </div>

      {/* Cobrar sem sair do app. Só pra quem está devendo — em 'pago' ou
        * "aguardando confirmação" cobrar seria constrangedor e errado. */}
      {onCharge &&
        (displayStatus === 'overdue' || displayStatus === 'pending') && (
          <button
            type="button"
            onClick={onCharge}
            className="tap w-full h-10 rounded-xl bg-card border border-gray-200 text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Send size={13} />
            {displayStatus === 'overdue' ? 'Cobrar no WhatsApp' : 'Lembrar no WhatsApp'}
          </button>
        )}
    </Card>
  );
}
