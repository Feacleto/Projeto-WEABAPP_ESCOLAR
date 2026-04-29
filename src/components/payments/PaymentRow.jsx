import { Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import Card from '../common/Card';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from '../../utils/formatters';

const STATUS_CONFIG = {
  paid: {
    label: 'Pago',
    color: 'text-emerald-700 bg-success/10',
    Icon: CheckCircle2,
  },
  pending: {
    label: 'Pendente',
    color: 'text-amber-700 bg-warning/10',
    Icon: Clock,
  },
  overdue: {
    label: 'Atrasado',
    color: 'text-red-700 bg-danger/10',
    Icon: AlertCircle,
  },
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
}) {
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending;
  const { Icon, label, color } = config;

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
        </div>
        {action}
      </div>
    </Card>
  );
}
