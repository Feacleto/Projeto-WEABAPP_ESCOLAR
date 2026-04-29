import { useState, useMemo } from 'react';
import { DollarSign, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import PaymentRow from '../../components/payments/PaymentRow';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import {
  generateMonthlyPayments,
  markAsPaid,
  computeDisplayStatus,
} from '../../services/paymentsService';
import {
  getCurrentMonthKey,
  formatMonthLabel,
  formatCurrency,
} from '../../utils/formatters';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'paid', label: 'Pago' },
];

export default function TioFinance() {
  const [monthKey] = useState(getCurrentMonthKey());
  const { payments, loading } = usePaymentsByMonth(monthKey);
  const [filter, setFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState(null);

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
      open: sumByStatus(['pending', 'overdue']),
    };
  }, [enriched]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const { created, withoutParent } = await generateMonthlyPayments(monthKey);
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
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar pagamentos.');
    } finally {
      setGenerating(false);
    }
  };

  const onMarkAsPaid = async (payment) => {
    setMarking(payment.id);
    try {
      await markAsPaid(payment.id);
      toast.success(`${payment.childName} dado como pago.`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao dar baixa.');
    } finally {
      setMarking(null);
    }
  };

  return (
    <>
      <Header
        title={`Financeiro · ${formatMonthLabel(monthKey)}`}
        action={
          <button
            onClick={onGenerate}
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
                onClick={onGenerate}
                loading={generating}
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
                action={
                  payment._display !== 'paid' ? (
                    <Button
                      size="sm"
                      fullWidth={false}
                      loading={marking === payment.id}
                      onClick={() => onMarkAsPaid(payment)}
                    >
                      Dar baixa
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
