import { useEffect, useMemo, useState } from 'react';
import { Printer, FileText } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import BarChart from '../../components/charts/BarChart';
import StackedBar from '../../components/charts/StackedBar';
import {
  getPaymentsSince,
  computeDisplayStatus,
} from '../../services/paymentsService';
import {
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';

/**
 * Relatório financeiro do Tio — visualização pra ler e imprimir.
 *
 * Estrutura:
 *   1. Cabeçalho com dados da empresa + período
 *   2. Resumo do mês corrente em destaque
 *   3. Stacked bar do status do mês (Pago / Aguardando / Pendente / Atrasado)
 *   4. Barras horizontais: Recebido nos últimos 12 meses
 *   5. Tabela mês a mês (recebido, em aberto, % cobrança)
 *
 * Imprimir / Salvar PDF: window.print() — CSS print já existe no projeto.
 */
export default function TioFinanceReport() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);

  // Janela: últimos 12 meses incluindo o corrente
  const fromKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPaymentsSince(fromKey)
      .then((list) => {
        if (!cancelled) {
          setPayments(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromKey]);

  const enriched = useMemo(
    () =>
      (payments || []).map((p) => ({
        ...p,
        _display: computeDisplayStatus(p),
      })),
    [payments]
  );

  // Mapa mês → totais
  const byMonth = useMemo(() => {
    const map = new Map();
    const last12 = getLast12MonthKeys();
    last12.forEach((mk) =>
      map.set(mk, { received: 0, open: 0, overdue: 0, claimed: 0, total: 0 })
    );

    for (const p of enriched) {
      const m = p.month;
      if (!map.has(m)) continue;
      const slot = map.get(m);
      const value = Number(p.amount) || 0;
      slot.total += value;
      if (p._display === 'paid') slot.received += value;
      else if (p._display === 'claimed') slot.claimed += value;
      else if (p._display === 'overdue') slot.overdue += value;
      else slot.open += value;
    }
    return map;
  }, [enriched]);

  const currentMonthKey = getCurrentMonthKey();
  const currentMonth = byMonth.get(currentMonthKey) || {
    received: 0,
    open: 0,
    overdue: 0,
    claimed: 0,
    total: 0,
  };

  const currentMonthCounts = useMemo(() => {
    const c = { paid: 0, claimed: 0, pending: 0, overdue: 0 };
    for (const p of enriched) {
      if (p.month !== currentMonthKey) continue;
      c[p._display] = (c[p._display] || 0) + 1;
    }
    return c;
  }, [enriched, currentMonthKey]);

  const totalReceived = useMemo(() => {
    let sum = 0;
    for (const [, slot] of byMonth) sum += slot.received;
    return sum;
  }, [byMonth]);

  const totalOpen = useMemo(() => {
    let sum = 0;
    for (const [, slot] of byMonth) sum += slot.open + slot.overdue + slot.claimed;
    return sum;
  }, [byMonth]);

  const onPrint = () => window.print();

  if (loading) {
    return (
      <>
        <Header title="Relatório financeiro" showBack />
        <div className="p-5 space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Relatório financeiro" showBack />

      <div className="p-5 space-y-5">
        {/* Ações topo (escondidas no print) */}
        <div className="print:hidden">
          <Button variant="success" icon={Printer} onClick={onPrint}>
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Documento — visível no print */}
        <article className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none space-y-6">
          {/* Cabeçalho do relatório */}
          <header className="space-y-1 border-b border-gray-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-textMuted">
                  Relatório financeiro
                </p>
                <h1 className="text-2xl font-bold text-text leading-tight mt-1">
                  {profile?.companyName || 'Tio Nino Transporte Escolar'}
                </h1>
                <p className="text-xs text-textMuted mt-1">
                  {profile?.companyDocument || ''}
                </p>
              </div>
              <FileText size={28} className="text-textMuted shrink-0 mt-1" />
            </div>
            <p className="text-xs text-textMuted pt-2">
              Período: {formatMonthLabel(fromKey)} →{' '}
              {formatMonthLabel(currentMonthKey)} · Emitido em{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </header>

          {/* Resumo geral */}
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-900">
                Total recebido
              </p>
              <p className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
                {formatCurrency(totalReceived)}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">12 meses</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900">
                Em aberto
              </p>
              <p className="text-2xl font-bold text-amber-900 tabular-nums mt-1">
                {formatCurrency(totalOpen)}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">12 meses</p>
            </div>
          </section>

          {/* Mês corrente — status */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-text">
              Mês atual · {formatMonthLabel(currentMonthKey)}
            </h2>
            <StackedBar
              segments={[
                {
                  label: 'Pago',
                  value: currentMonth.received,
                  count: currentMonthCounts.paid || 0,
                  color: 'emerald',
                },
                {
                  label: 'Aguardando',
                  value: currentMonth.claimed,
                  count: currentMonthCounts.claimed || 0,
                  color: 'blue',
                },
                {
                  label: 'Pendente',
                  value: currentMonth.open,
                  count: currentMonthCounts.pending || 0,
                  color: 'amber',
                },
                {
                  label: 'Atrasado',
                  value: currentMonth.overdue,
                  count: currentMonthCounts.overdue || 0,
                  color: 'red',
                },
              ]}
            />
          </section>

          {/* Recebido por mês */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-text">Recebido por mês</h2>
            <BarChart
              data={getLast12MonthKeys().map((mk) => ({
                label: formatMonthLabel(mk),
                value: (byMonth.get(mk) || {}).received || 0,
              }))}
              color="emerald"
            />
          </section>

          {/* Tabela mês a mês */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-text">Detalhe mês a mês</h2>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-textMuted border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-semibold">Mês</th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Recebido
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Em aberto
                    </th>
                    <th className="text-right py-2 px-2 font-semibold">
                      Cobrança
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getLast12MonthKeys()
                    .slice()
                    .reverse()
                    .map((mk) => {
                      const slot = byMonth.get(mk) || {
                        received: 0,
                        open: 0,
                        overdue: 0,
                        claimed: 0,
                        total: 0,
                      };
                      const open =
                        slot.open + slot.overdue + slot.claimed;
                      const pct =
                        slot.total > 0
                          ? Math.round((slot.received / slot.total) * 100)
                          : 0;
                      return (
                        <tr key={mk} className="border-b border-gray-100">
                          <td className="py-2 px-2 capitalize">
                            {formatMonthLabel(mk)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-emerald-700 font-semibold">
                            {formatCurrency(slot.received)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-amber-700">
                            {formatCurrency(open)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums font-bold text-text">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="text-center text-[10px] text-textMuted pt-4 border-t border-gray-200">
            Tio Nino Digital · Relatório emitido em{' '}
            {new Date().toLocaleString('pt-BR')}
          </footer>
        </article>
      </div>
    </>
  );
}

function getLast12MonthKeys() {
  const result = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const c = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}
