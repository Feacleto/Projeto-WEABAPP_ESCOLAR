import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Despesas do motorista.
 *
 * O LUGAR DISTO NO PRODUTO
 * A tela de Financeiro continua sendo sobre ENTRADA: quem pagou, quem não
 * pagou, quem atrasou. Despesa é COMPLEMENTO — vive atrás da "visão
 * completa", pra quem quer fechar a conta do mês. Misturar as duas na tela
 * principal transformaria a pergunta "quem me deve?" numa planilha de
 * contabilidade, e é a primeira que ele precisa responder todo dia.
 *
 * PRIVACIDADE
 * Despesa é dado de negócio do tio. Nenhum responsável enxerga: as rules
 * liberam esta coleção só pra isAdmin(). Quanto ele gasta de combustível não
 * é da conta de quem paga a mensalidade.
 *
 * Estrutura:
 *   expenses/{id}
 *     amount: number
 *     category: chave de EXPENSE_CATEGORIES
 *     description: string (opcional)
 *     date: Timestamp — quando o gasto aconteceu
 *     monthKey: 'YYYY-MM' desnormalizado, pra consultar por mês sem range
 *     createdAt
 */

/**
 * Categorias reais de uma perua escolar no Brasil.
 *
 * `monitor` está aqui porque é custo de verdade e frequentemente esquecido:
 * vários municípios exigem monitor a bordo por lei, e é despesa fixa mensal
 * como qualquer salário.
 */
export const EXPENSE_CATEGORIES = {
  fuel: { label: 'Combustível', icon: '⛽', recurring: false },
  maintenance: { label: 'Manutenção', icon: '🔧', recurring: false },
  monitor: { label: 'Monitor / auxiliar', icon: '🧑‍🏫', recurring: true },
  installment: { label: 'Parcela do veículo', icon: '🚐', recurring: true },
  insurance: { label: 'Seguro', icon: '🛡️', recurring: true },
  tax: { label: 'IPVA e licenciamento', icon: '📄', recurring: false },
  other: { label: 'Outros', icon: '📦', recurring: false },
};

export const CATEGORY_ORDER = Object.keys(EXPENSE_CATEGORIES);

/** 'YYYY-MM' a partir de um Date, em hora local. */
export function monthKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Aceita 'YYYY-MM-DD' (input date) ou Date. Meio-dia evita virar o dia. */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) return new Date(`${value}T12:00:00`);
  return new Date();
}

export async function addExpense({ amount, category, description, date }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }
  if (!EXPENSE_CATEGORIES[category]) {
    throw new Error('Escolha uma categoria.');
  }
  const when = toDate(date);

  await addDoc(collection(db, 'expenses'), {
    amount: value,
    category,
    description: String(description || '').trim().slice(0, 200),
    date: Timestamp.fromDate(when),
    // Desnormalizado de propósito: a consulta do mês fica em campo único e
    // não exige índice composto nem range de datas.
    monthKey: monthKeyOf(when),
    createdAt: serverTimestamp(),
  });
}

export async function updateExpense(id, data) {
  const updates = { ...data };
  if ('amount' in updates) updates.amount = Number(updates.amount) || 0;
  if ('date' in updates) {
    const when = toDate(updates.date);
    updates.date = Timestamp.fromDate(when);
    // monthKey acompanha a data, senão o gasto some do mês certo.
    updates.monthKey = monthKeyOf(when);
  }
  await updateDoc(doc(db, 'expenses', id), updates);
}

export async function deleteExpense(id) {
  await deleteDoc(doc(db, 'expenses', id));
}

/**
 * Despesas de um mês. `monthKey` é campo único, então `where` + `orderBy` no
 * MESMO campo não pede índice composto... mas ordenamos por `date`, que é
 * outro campo — daí o índice (monthKey, date) em firestore.indexes.json.
 */
export function watchExpensesByMonth(monthKey, onUpdate, onError) {
  if (!monthKey) return () => {};
  const q = query(
    collection(db, 'expenses'),
    where('monthKey', '==', monthKey),
    orderBy('date', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchExpensesByMonth:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Despesas de vários meses, pro gráfico de receita × despesa.
 *
 * Usa `where('monthKey', 'in', [...])`, que o Firestore limita a 30 valores —
 * mais que suficiente pra 12 meses e sem exigir índice.
 */
export function watchExpensesByMonths(monthKeys, onUpdate, onError) {
  const keys = (monthKeys || []).filter(Boolean).slice(0, 30);
  if (keys.length === 0) return () => {};
  const q = query(collection(db, 'expenses'), where('monthKey', 'in', keys));
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchExpensesByMonths:', err);
      if (onError) onError(err);
    }
  );
}

/** Soma por categoria, já ordenada do maior pro menor. */
export function sumByCategory(expenses) {
  const totals = new Map();
  for (const e of expenses || []) {
    const key = EXPENSE_CATEGORIES[e.category] ? e.category : 'other';
    totals.set(key, (totals.get(key) || 0) + (Number(e.amount) || 0));
  }
  return [...totals.entries()]
    .map(([category, value]) => ({
      category,
      label: EXPENSE_CATEGORIES[category].label,
      icon: EXPENSE_CATEGORIES[category].icon,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Total simples. */
export function sumExpenses(expenses) {
  return (expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
}
