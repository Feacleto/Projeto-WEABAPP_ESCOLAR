import { useMemo } from 'react';
import { Printer, FileText, CheckCircle2, Clock, AlertCircle, Hourglass } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { computeDisplayStatus } from '../../services/paymentsService';
import {
  formatCurrency,
  formatMonthLabel,
  formatDate,
} from '../../utils/formatters';

/**
 * Histórico financeiro do Pai pra leitura / impressão.
 * Lista todos os pagamentos do responsável até 12 meses (retenção atual).
 */
export default function PaiFinanceReport() {
  const { user, profile } = useAuth();
  const { child } = useActiveChild();
  const { admin } = useAdminProfile();
  const { payments, loading } = usePaymentsByParent(user?.uid);

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  const totals = useMemo(() => {
    let paid = 0;
    let open = 0;
    for (const p of enriched) {
      const v = Number(p.amount) || 0;
      if (p._display === 'paid') paid += v;
      else open += v;
    }
    return { paid, open };
  }, [enriched]);

  const onPrint = () => window.print();

  if (loading || !child) {
    return (
      <>
        <Header title="Histórico de pagamentos" showBack />
        <div className="p-5 space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Histórico de pagamentos" showBack />

      <div className="p-5 space-y-5">
        <div className="print:hidden">
          <Button variant="success" icon={Printer} onClick={onPrint}>
            Imprimir / Salvar PDF
          </Button>
        </div>

        <article className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none space-y-6">
          <header className="space-y-1 border-b border-gray-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-textMuted">
                  Histórico de pagamentos
                </p>
                <h1 className="text-2xl font-bold text-text leading-tight mt-1">
                  {child.name}
                </h1>
                <p className="text-xs text-textMuted mt-1">
                  Responsável: {profile?.name || '—'}
                </p>
              </div>
              <FileText size={28} className="text-textMuted shrink-0 mt-1" />
            </div>
            {admin?.companyName && (
              <p className="text-[11px] text-textMuted pt-2">
                Prestador: {admin.companyName}
              </p>
            )}
            <p className="text-xs text-textMuted">
              Emitido em {new Date().toLocaleDateString('pt-BR')}
            </p>
          </header>

          <section className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-900">
                Total pago
              </p>
              <p className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
                {formatCurrency(totals.paid)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900">
                Em aberto
              </p>
              <p className="text-2xl font-bold text-amber-900 tabular-nums mt-1">
                {formatCurrency(totals.open)}
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-text">Mensalidades</h2>
            {enriched.length === 0 ? (
              <p className="text-sm text-textMuted text-center py-6">
                Sem pagamentos no histórico.
              </p>
            ) : (
              <div className="space-y-2">
                {enriched.map((p) => (
                  <PaymentLine key={p.id} payment={p} />
                ))}
              </div>
            )}
          </section>

          <footer className="text-center text-[10px] text-textMuted pt-4 border-t border-gray-200">
            Tio Nino Digital · Documento gerado em{' '}
            {new Date().toLocaleString('pt-BR')}
          </footer>
        </article>
      </div>
    </>
  );
}

function PaymentLine({ payment }) {
  const cfg = STATUS_CONFIG[payment._display] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className="bg-bg rounded-2xl p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text capitalize leading-tight">
          {formatMonthLabel(payment.month)}
        </p>
        <p className="text-[11px] text-textMuted mt-0.5">
          Vencimento: {formatDate(payment.dueDate)}
          {payment.paidAt && ` · Pago em ${formatDate(payment.paidAt)}`}
          {payment.paymentMethod && (
            <span>
              {' '}
              · {methodLabel(payment.paymentMethod)}
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-bold text-text tabular-nums">
          {formatCurrency(payment.amount)}
        </p>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>
          {cfg.label}
        </p>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  paid: {
    icon: CheckCircle2,
    label: 'Pago',
    color: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
  },
  claimed: {
    icon: Hourglass,
    label: 'Aguardando',
    color: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
  },
  pending: {
    icon: Clock,
    label: 'Pendente',
    color: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
  },
  overdue: {
    icon: AlertCircle,
    label: 'Atrasado',
    color: 'bg-red-100 text-red-700',
    text: 'text-red-700',
  },
};

function methodLabel(m) {
  if (m === 'cash') return 'Dinheiro';
  if (m === 'card') return 'Cartão';
  return 'PIX';
}
