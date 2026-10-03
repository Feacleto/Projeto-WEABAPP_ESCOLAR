import { useMemo, useState } from 'react';
import { Plus, Trash2, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import IconePorNome from '../../components/common/IconePorNome';
import MonthSwitcher from '../../components/payments/MonthSwitcher';
import FolhaDeDespesa from '../../components/financeiro/FolhaDeDespesa';
import { nomeDoMes } from '../../components/payments/estadoDaMensalidade';
import {
  useConfigDoFinanceiro,
  useDespesasDoMes,
  useDespesasRecentes,
} from '../../hooks/useDespesas';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import {
  EXPENSE_CATEGORIES,
  deleteExpense,
  sumByCategory,
  sumExpenses,
  monthKeyOf,
} from '../../services/expensesService';
import {
  kmDesdeOUltimo,
  leituraDeKm,
  paraData,
} from '../../dominio/cobranca/historicoDeDespesas.js';
import { formatCurrency, formatDate } from '../../compartilhado/formatters';

/**
 * Despesas do mês — /tio/finance/expenses
 *
 * ONDE ISTO FICA NO PRODUTO (03/10/2026, protótipo aprovado pelo dono)
 * É a porta "Despesas do mês" do caixa. O caixa já mostra o saldo e o
 * extrato do dia; aqui ele vem para entender PARA ONDE o dinheiro foi: o
 * total do mês, em vermelho porque é saída, e cada categoria com o valor, uma
 * barrinha do tamanho dela no mês e uma linha que diz algo útil — quantos
 * abastecimentos e quanto a perua rodou desde o último, quando foi a última
 * manutenção e o que foi feito.
 *
 * O gráfico de barras ("Onde o dinheiro foi") saiu: a lista por categoria diz
 * o mesmo com o número escrito ao lado, que é como ele confere.
 *
 * O lançamento é a MESMA folha do caixa e da tela trancada
 * ([FolhaDeDespesa](../../components/financeiro/FolhaDeDespesa.jsx)), com o
 * histórico da categoria antes do valor.
 */

/** As quatro de todo mês aparecem sempre; as outras, só quando têm valor. */
const SEMPRE = ['monitor', 'fuel', 'maintenance', 'other'];
const ROTULO = { monitor: 'Auxiliar' };

export default function TioExpenses() {
  const [monthKey, setMonthKey] = useState(monthKeyOf());
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const { visiveis } = useValoresVisiveis();
  const reais = (v) => (visiveis ? formatCurrency(v) : VALOR_ESCONDIDO);

  const expenses = useDespesasDoMes(monthKey);
  const config = useConfigDoFinanceiro();
  const ultimosAbastecimentos = useDespesasRecentes('fuel', 1);
  const ultimasManutencoes = useDespesasRecentes('maintenance', 1);

  const mes = nomeDoMes(monthKey);
  const total = useMemo(() => sumExpenses(expenses || []), [expenses]);

  const categorias = useMemo(() => {
    const somas = new Map(sumByCategory(expenses || []).map((c) => [c.category, c.value]));
    const chaves = [...SEMPRE, ...[...somas.keys()].filter((k) => !SEMPRE.includes(k))];
    const lista = (expenses || []);
    return chaves
      .map((chave) => {
        const valor = somas.get(chave) || 0;
        const doMes = lista.filter((e) => (EXPENSE_CATEGORIES[e.category] ? e.category : 'other') === chave);
        return { chave, valor, quantas: doMes.length };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [expenses]);

  const detalhe = ({ chave, valor, quantas }) => {
    if (chave === 'fuel') {
      const ultima = ultimosAbastecimentos?.[0] || null;
      const km = kmDesdeOUltimo({
        ultima,
        uso: config?.usoDaPerua,
        kmDasRotas: leituraDeKm(config?.kmDasRotas),
      });
      const partes = [
        quantas === 0
          ? `Nenhum abastecimento em ${mes}`
          : `${quantas} ${quantas === 1 ? 'abastecimento' : 'abastecimentos'}`,
      ];
      if (km) partes.push(`${new Intl.NumberFormat('pt-BR').format(km.km)} km desde então`);
      return partes.join(' · ');
    }
    if (chave === 'maintenance') {
      const ultima = ultimasManutencoes?.[0] || null;
      if (!ultima) return 'Nenhuma manutenção lançada';
      const d = paraData(ultima.date);
      const dia = d
        ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
        : '—';
      return `Última em ${dia}${ultima.description ? ` · ${ultima.description}` : ''}`;
    }
    if (valor === 0) return `Nada lançado em ${mes}`;
    if (chave === 'monitor') return `Salário de ${mes}`;
    return `${quantas} ${quantas === 1 ? 'lançamento' : 'lançamentos'}`;
  };

  const onDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteExpense(deleting.id);
      toast.success('Despesa apagada.');
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra apagar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-28">
      <Header title="Despesas" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />

        {/* O número que ele veio ver — vermelho porque é saída. */}
        <section className="space-y-1 rounded-3xl bg-card p-5 shadow-rest">
          <p className="text-base text-textMuted">Saiu em {mes}</p>
          {expenses === null ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <p className="font-display text-3xl font-extrabold tabular-nums text-dangerText">
              {reais(total)}
            </p>
          )}
          {expenses?.length > 0 && (
            <p className="text-sm text-textMuted">
              {expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
            </p>
          )}
        </section>

        <Button icon={Plus} onClick={() => setFormOpen(true)}>
          Lançar despesa
        </Button>

        {expenses === null && <Skeleton className="h-40 rounded-2xl" />}

        {expenses !== null && (
          <>
            <h2 className="pt-1 font-display text-xl font-bold text-text">Por categoria</h2>
            <section className="rounded-3xl bg-card px-4 py-1 shadow-rest">
              {categorias.map((c, i) => {
                const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
                return (
                  <div
                    key={c.chave}
                    className={`flex flex-col gap-1.5 py-3 ${i > 0 ? 'border-t border-neutro' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-bold text-text">
                        {ROTULO[c.chave] || EXPENSE_CATEGORIES[c.chave]?.label}
                      </span>
                      <span className="text-base font-bold tabular-nums text-text">
                        {reais(c.valor)}
                      </span>
                    </div>
                    <span className="block h-2 overflow-hidden rounded-full bg-neutro" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${visiveis ? pct : 0}%` }}
                      />
                    </span>
                    <span className="text-sm text-textMuted">{detalhe(c)}</span>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {expenses?.length === 0 && (
          <EmptyState
            icon={TrendingDown}
            title="Nenhuma despesa lançada"
            description="Lance combustível, manutenção e as parcelas pra ver quanto sobrou no fim do mês."
          />
        )}

        {expenses?.length > 0 && (
          <>
            <h2 className="pt-1 font-display text-xl font-bold text-text">Lançamentos</h2>
            <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
              {expenses.map((e, i) => {
                const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
                return (
                  <div
                    key={e.id}
                    className={`flex min-h-16 items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-neutro' : ''}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                      <IconePorNome nome={cat.icone} size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-text">
                        {e.description || cat.label}
                      </p>
                      <p className="truncate text-sm text-textMuted">
                        {formatDate(e.date)}
                        {e.description ? ` · ${cat.label}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-text">
                      {reais(e.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      aria-label="Apagar despesa"
                      className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-textMuted"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      <FolhaDeDespesa open={formOpen} onClose={() => setFormOpen(false)} comValores />

      <ConfirmDialog
        open={!!deleting}
        title="Apagar esta despesa?"
        description={
          deleting
            ? `${formatCurrency(deleting.amount)} — ${
                (EXPENSE_CATEGORIES[deleting.category] || EXPENSE_CATEGORIES.other).label
              }. Isso não pode ser desfeito.`
            : ''
        }
        confirmLabel="Apagar"
        variant="danger"
        loading={busy}
        onConfirm={onDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
