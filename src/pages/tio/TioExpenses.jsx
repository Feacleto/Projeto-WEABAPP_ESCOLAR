import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, TrendingDown, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BarChart from '../../components/charts/BarChart';
import MonthSwitcher from '../../components/payments/MonthSwitcher';
import {
  EXPENSE_CATEGORIES,
  CATEGORY_ORDER,
  addExpense,
  deleteExpense,
  watchExpensesByMonth,
  sumByCategory,
  sumExpenses,
  monthKeyOf,
} from '../../services/expensesService';
import { formatCurrency, formatMonthLabel, formatDate } from '../../utils/formatters';

/**
 * Despesas do mês — /tio/finance/expenses
 *
 * ONDE ISTO FICA NO PRODUTO
 * A tela de Financeiro continua sendo sobre ENTRADA: quem pagou, quem não
 * pagou, quem atrasou. É a pergunta que o tio responde todo dia. Despesa é
 * a conta que ele fecha uma vez por mês, então vive aqui, atrás da visão
 * completa — não competindo por espaço com a cobrança.
 *
 * O lançamento é curto de propósito: valor, categoria, data. A descrição é
 * opcional porque exigir texto a cada tanque de combustível garante que ele
 * pare de lançar na segunda semana.
 */
export default function TioExpenses() {
  const [monthKey, setMonthKey] = useState(monthKeyOf());
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  // O mês vem GRUDADO nos dados. Assim trocar de mês não precisa de um
  // setState síncrono no effect pra limpar a lista: o que chegou do mês
  // anterior simplesmente deixa de casar e a tela volta pro skeleton.
  const [snapshot, setSnapshot] = useState({ monthKey: null, list: null });

  useEffect(() => {
    return watchExpensesByMonth(
      monthKey,
      (list) => setSnapshot({ monthKey, list }),
      () => setSnapshot({ monthKey, list: [] })
    );
  }, [monthKey]);

  const expenses = snapshot.monthKey === monthKey ? snapshot.list : null;

  const total = useMemo(() => sumExpenses(expenses || []), [expenses]);
  const byCategory = useMemo(() => sumByCategory(expenses || []), [expenses]);

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

      <div className="px-5 pt-4 space-y-4">
        <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />

        {/* O número que ele veio ver */}
        <div className="rounded-2xl bg-gradient-to-br from-text via-text to-night text-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
            gasto em {formatMonthLabel(monthKey)}
          </p>
          <p className="text-3xl font-extrabold mt-1">{formatCurrency(total)}</p>
          {expenses?.length > 0 && (
            <p className="text-xs text-white/70 mt-1">
              {expenses.length}{' '}
              {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
            </p>
          )}
        </div>

        <Button icon={Plus} onClick={() => setFormOpen(true)}>
          Lançar despesa
        </Button>

        {expenses === null && <Skeleton className="h-40 rounded-2xl" />}

        {expenses?.length === 0 && (
          <EmptyState
            icon={TrendingDown}
            title="Nenhuma despesa lançada"
            description="Lance combustível, manutenção e as parcelas pra ver quanto sobrou no fim do mês."
          />
        )}

        {byCategory.length > 0 && (
          <Card className="space-y-3">
            <p className="text-sm font-bold text-text">Onde o dinheiro foi</p>
            <BarChart
              color="red"
              data={byCategory.map((c) => ({
                label: `${c.icon} ${c.label}`,
                value: c.value,
              }))}
            />
          </Card>
        )}

        {expenses?.length > 0 && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              lançamentos
            </p>
            {expenses.map((e) => {
              const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
              return (
                <Card key={e.id} className="flex items-center gap-3">
                  <span className="text-xl shrink-0" aria-hidden>
                    {cat.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">
                      {cat.label}
                    </p>
                    <p className="text-xs text-textMuted truncate">
                      {formatDate(e.date)}
                      {e.description ? ` · ${e.description}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-text shrink-0 tabular-nums">
                    {formatCurrency(e.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDeleting(e)}
                    aria-label="Apagar despesa"
                    className="tap w-9 h-9 rounded-lg text-textMuted flex items-center justify-center shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              );
            })}
          </section>
        )}
      </div>

      {formOpen && (
        <ExpenseForm
          defaultMonthKey={monthKey}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
        />
      )}

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

/**
 * Lançamento de despesa.
 *
 * Três campos, e só dois obrigatórios. A categoria vira botão grande em vez
 * de select: escolher numa lista de sete com o dedo é mais rápido e menos
 * errado que abrir um menu.
 */
function ExpenseForm({ defaultMonthKey, onClose, onSaved }) {
  const today = new Date();
  // Se ele está olhando um mês passado, a data padrão cai naquele mês — senão
  // o lançamento iria pro mês errado sem ele notar.
  const isCurrentMonth = defaultMonthKey === monthKeyOf(today);
  const defaultDate = isCurrentMonth
    ? today.toISOString().slice(0, 10)
    : `${defaultMonthKey}-01`;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('fuel');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await addExpense({ amount: value, category, description, date });
      toast.success('Despesa lançada.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Não deu pra lançar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <div className="relative w-full max-w-mobile bg-card rounded-t-3xl p-6 pb-8 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="tap absolute right-4 top-4 w-9 h-9 rounded-full text-textMuted flex items-center justify-center"
        >
          <X size={20} />
        </button>

        <div className="pr-10">
          <div className="w-11 h-11 rounded-2xl bg-neutro text-text flex items-center justify-center mb-2">
            <Wallet size={22} />
          </div>
          <h2 className="text-xl font-bold text-text leading-tight">
            Lançar despesa
          </h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Quanto foi"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            error={error}
            autoFocus
            required
          />

          <div>
            <p className="block text-sm font-semibold text-text mb-2">
              Do que foi
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map((key) => {
                const cat = EXPENSE_CATEGORIES[key];
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    aria-pressed={active}
                    className={`tap h-12 rounded-xl border-2 text-xs font-semibold flex items-center gap-1.5 px-3 text-left ${
                      active
                        ? 'border-primary bg-primary/5 text-text'
                        : 'border-border bg-card text-textMuted'
                    }`}
                  >
                    <span aria-hidden>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            type="date"
            label="Quando"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Input
            label="Observação (opcional)"
            placeholder="Ex: troca de óleo"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            hint="Deixe em branco se não precisar."
          />

          <Button type="submit" loading={saving}>
            Lançar
          </Button>
        </form>
      </div>
    </div>
  );
}
