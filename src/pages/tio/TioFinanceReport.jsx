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
  foiPagoAtrasado,
} from '../../services/paymentsService';
import {
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
  addMonths,
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
  const { user, profile } = useAuth();
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);

  // Janela: últimos 12 meses incluindo o corrente.
  //
  // `d.setMonth(d.getMonth() - 11)` sobre a data de HOJE, com o dia
  // preservado, transborda no dia 31: em 31/08/2026 devolvia 2025-10 em vez de
  // 2025-09. Como este é o PISO da consulta, o mês mais antigo não vinha do
  // banco — mas a barra dele continuava sendo desenhada, zerada. Quatro dias
  // por ano o motorista abria o relatório e via um mês sem faturamento que
  // teve faturamento.
  //
  // `addMonths` já existia em utils/formatters, escrito exatamente pra isso, e
  // `getLast12MonthKeys` neste mesmo arquivo já a usava — as duas metades do
  // gráfico calculavam a mesma janela por caminhos diferentes.
  const fromKey = useMemo(() => addMonths(getCurrentMonthKey(), -11), []);

  useEffect(() => {
    let cancelled = false;
    getPaymentsSince(fromKey, user?.uid)
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
  }, [fromKey, user?.uid]);

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

  /**
   * QUEM MAIS ATRASA — o padrão que um mês sozinho não mostra.
   *
   * Na tela do mês, um pagamento que entrou é verde e acabou. Mas entrar no
   * dia 3 e entrar no dia 28 são coisas diferentes, e a diferença só aparece
   * quando se olha doze meses de uma vez: é a lista de com quem ele vai ter
   * trabalho de novo no mês que vem.
   *
   * Conta as duas formas de atraso, porque as duas contam a mesma história:
   *   - o que ainda está aberto e venceu ('overdue')
   *   - o que já entrou, mas depois do vencimento (foiPagoAtrasado)
   *
   * Fica SÓ AQUI, no relatório, e não como selo na ficha da criança: um
   * carimbo permanente de "atrasa" na ficha é julgamento que o tio lê toda
   * vez que abre o cadastro pra conferir um endereço. Aqui é consulta —
   * ele vem quando quer a resposta.
   */
  const quemMaisAtrasa = useMemo(() => {
    const porCrianca = new Map();
    for (const p of enriched) {
      const atrasou = p._display === 'overdue' || foiPagoAtrasado(p);
      if (!atrasou) continue;
      const chave = p.childId || p.childName || 'sem-id';
      const atual = porCrianca.get(chave) || {
        nome: p.childName || 'Criança',
        vezes: 0,
        emAberto: 0,
      };
      atual.vezes += 1;
      if (p._display === 'overdue') atual.emAberto += Number(p.amount) || 0;
      porCrianca.set(chave, atual);
    }
    return [...porCrianca.values()]
      .sort((a, b) => b.vezes - a.vezes || b.emAberto - a.emAberto)
      .slice(0, 8);
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
        <Header title="Relatório financeiro" showBack backLabel="Financeiro" backTo="/tio/finance" />
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
      <Header title="Relatório financeiro" showBack backLabel="Financeiro" backTo="/tio/finance" />

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
          <header className="space-y-1 border-b border-border pb-4">
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
            <div className="bg-primarySoft rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Total recebido
              </p>
              <p className="text-2xl font-bold text-primary tabular-nums mt-1">
                {formatCurrency(totalReceived)}
              </p>
              <p className="text-[11px] text-primary mt-1">12 meses</p>
            </div>
            <div className="bg-warningSoft rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-warningText">
                Em aberto
              </p>
              <p className="text-2xl font-bold text-warningText tabular-nums mt-1">
                {formatCurrency(totalOpen)}
              </p>
              <p className="text-[11px] text-warningText mt-1">12 meses</p>
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
                  <tr className="text-textMuted border-b border-border">
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
                        <tr key={mk} className="border-b border-neutro">
                          <td className="py-2 px-2 capitalize">
                            {formatMonthLabel(mk)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-primary font-semibold">
                            {formatCurrency(slot.received)}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-warningText">
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

          <footer className="text-center text-[10px] text-textMuted pt-4 border-t border-border">
            Tio Nino Digital · Relatório emitido em{' '}
            {new Date().toLocaleString('pt-BR')}
          </footer>

          {/* ── quem mais atrasa ── */}
          {quemMaisAtrasa.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-text">Quem mais atrasa</h2>
              <p className="text-[11px] leading-snug text-textMuted">
                Contando meses vencidos em aberto e meses pagos depois do
                vencimento, nos últimos 12 meses.
              </p>
              <div className="space-y-1.5">
                {quemMaisAtrasa.map((c, i) => (
                  <div
                    key={c.nome + i}
                    className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2"
                  >
                    <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-textMuted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                      {c.nome}
                    </span>
                    {c.emAberto > 0 && (
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-dangerText">
                        {formatCurrency(c.emAberto)} em aberto
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-warningChip px-2 py-0.5 text-[11px] font-bold tabular-nums text-warningText">
                      {c.vezes}x
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
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
