import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import PaymentRow from '../../components/payments/PaymentRow';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { computeDisplayStatus } from '../../services/paymentsService';
import { formatCurrency } from '../../utils/formatters';
import { DollarSign } from 'lucide-react';

export default function PaiFinance() {
  const { user } = useAuth();
  const { payments, loading } = usePaymentsByParent(user?.uid);

  // Soma do que ainda está em aberto (pendente + atrasado)
  const openTotal = payments.reduce((acc, p) => {
    const s = computeDisplayStatus(p);
    if (s === 'paid') return acc;
    return acc + (Number(p.amount) || 0);
  }, 0);

  return (
    <>
      <Header title="Pagamentos" />
      <div className="p-4 space-y-4">
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
            {payments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                displayStatus={computeDisplayStatus(p)}
                showChild={false}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
