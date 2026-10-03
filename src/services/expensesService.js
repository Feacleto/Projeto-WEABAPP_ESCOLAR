import { emCentavos } from '../compartilhado/formatters';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

/**
 * Despesas do motorista.
 *
 * O LUGAR DISTO NO PRODUTO
 * Desde 03/10/2026 o Financeiro é um CAIXA: o saldo do mês é o que entrou
 * menos o que saiu, e a despesa aparece no extrato do dia ao lado da
 * mensalidade paga. A cobrança continua sendo o trabalho de todo dia (aba
 * Mensalidades); a despesa ganhou um atalho ("Lançar despesa") e uma porta
 * ("Despesas do mês"), sem virar planilha na tela principal.
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
 *     kmPainel: number (opcional) — o hodômetro que ele digitou ao lançar
 *     kmContador: number (opcional) — `configFinanceiro.kmDasRotas` no
 *                 instante do lançamento (o contador das rotas)
 *     createdAt
 *
 * OS DOIS KM (03/10/2026). O km entre dois abastecimentos é a diferença
 * entre duas leituras do MESMO contador — ver
 * `dominio/cobranca/historicoDeDespesas.js`. Gravar os dois quando houver é o
 * que deixa ele trocar a resposta de "a perua roda só nas rotas?" depois sem
 * perder o histórico.
 */

/** Km opcional: ausente/vazio vira `undefined` (não grava); inválido lança. */
function kmOpcional(valor, nome) {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${nome} precisa ser um número igual ou maior que zero.`);
  }
  return Math.round(n * 10) / 10;
}

/**
 * Categorias reais de uma perua escolar no Brasil.
 *
 * `monitor` está aqui porque é custo de verdade e frequentemente esquecido:
 * vários municípios exigem monitor a bordo por lei, e é despesa fixa mensal
 * como qualquer salário.
 */
export const EXPENSE_CATEGORIES = {
  fuel: { label: 'Combustível', icone: 'Fuel', recurring: false },
  maintenance: { label: 'Manutenção', icone: 'Wrench', recurring: false },
  monitor: { label: 'Monitor / auxiliar', icone: 'UserRound', recurring: true },
  installment: { label: 'Parcela do veículo', icone: 'Bus', recurring: true },
  insurance: { label: 'Seguro', icone: 'Shield', recurring: true },
  tax: { label: 'IPVA e licenciamento', icone: 'FileText', recurring: false },
  other: { label: 'Outros', icone: 'Package', recurring: false },
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

export async function addExpense({ amount, category, description, date, kmPainel, kmContador }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }
  if (!EXPENSE_CATEGORIES[category]) {
    throw new Error('Escolha uma categoria.');
  }
  const when = toDate(date);
  const painel = kmOpcional(kmPainel, 'O km do painel');
  const contador = kmOpcional(kmContador, 'O km das rotas');

  const dono = auth.currentUser?.uid;
  if (!dono) throw new Error('Entre de novo para lançar a despesa.');

  await addDoc(collection(db, 'expenses'), {
    // DE QUEM É ESTA DESPESA. Sem este campo a coleção não tinha dono
    // nenhum: a rule era `isAdmin()` puro e a consulta filtrava só por mês,
    // então cada motorista via — e podia EDITAR e APAGAR — o combustível, a
    // parcela do veículo e o salário do monitor de todos os outros.
    //
    // Sondado com dois motoristas reais: o segundo leu e alterou a despesa
    // do primeiro, HTTP 200 nas duas.
    adminUid: dono,
    amount: value,
    category,
    description: String(description || '').trim().slice(0, 200),
    date: Timestamp.fromDate(when),
    // Desnormalizado de propósito: a consulta do mês fica em campo único e
    // não exige índice composto nem range de datas.
    monthKey: monthKeyOf(when),
    ...(painel !== undefined ? { kmPainel: painel } : {}),
    ...(contador !== undefined ? { kmContador: contador } : {}),
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
  const dono = auth.currentUser?.uid;
  // Sem sessão não há consulta a fazer: a rule negaria, e uma consulta que
  // já se sabe negada é erro no console do motorista sem nada em troca.
  if (!dono) return () => {};
  const q = query(
    collection(db, 'expenses'),
    where('adminUid', '==', dono),
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
  const dono = auth.currentUser?.uid;
  if (!dono) return () => {};
  const q = query(
    collection(db, 'expenses'),
    where('adminUid', '==', dono),
    where('monthKey', 'in', keys)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchExpensesByMonths:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * As últimas despesas de UMA categoria, mais recente primeiro — o histórico
 * da folha de lançar e a linha de detalhe de cada categoria (03/10/2026).
 *
 * Fora do mês de propósito: a última manutenção costuma ter sido há meses.
 * O limite é pequeno porque a pergunta é "qual foi a última", não "todas".
 * Pede o índice (adminUid, category, date desc) em firestore.indexes.json.
 */
export function watchDespesasRecentes(categoria, quantas, onUpdate, onError) {
  const dono = auth.currentUser?.uid;
  if (!dono || !EXPENSE_CATEGORIES[categoria]) return () => {};
  const q = query(
    collection(db, 'expenses'),
    where('adminUid', '==', dono),
    where('category', '==', categoria),
    orderBy('date', 'desc'),
    limit(Math.max(1, Math.min(Number(quantas) || 10, 50)))
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchDespesasRecentes:', err);
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
  return emCentavos((expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0));
}
