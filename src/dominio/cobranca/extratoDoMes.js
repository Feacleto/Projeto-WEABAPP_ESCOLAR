/**
 * O EXTRATO DO MÊS — o caixa do motorista lido como o de um banco (03/10/2026).
 *
 * Entrada é mensalidade PAGA (dinheiro na mão, nunca "avisou que pagou" nem
 * "vai pagar"); saída é despesa lançada. Agrupado por dia, o mais novo em
 * cima, com "Hoje" e "Ontem" escritos — é assim que todo extrato de banco que
 * ele já usou se lê.
 *
 * ⚠️ OS DOIS DINHEIROS NÃO SE MISTURAM: a taxa da plataforma
 * (`faturasParceiro`) não entra aqui. Ela é conta dele com a plataforma e tem
 * tela própria; somá-la ao caixa das famílias seria a mistura que o item 7
 * dos Termos proíbe.
 *
 * Puro: sem Firebase, sem React. Os rótulos das categorias de despesa chegam
 * por parâmetro (moram no service, atrás do Firestore). `npm run testar:extrato`.
 */

const FORMA = { pix: 'PIX', cash: 'Dinheiro', card: 'Cartão' };

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') return paraData(valor.toDate());
  if (typeof valor.seconds === 'number') return new Date(valor.seconds * 1000);
  if (typeof valor === 'string' || typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' em hora local — a chave do grupo. */
export function chaveDoDia(data) {
  const d = paraData(data);
  if (!d) return null;
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** "Hoje, 03/10", "Ontem, 02/10" ou "01/10". */
export function rotuloDoDia(chave, hoje = new Date()) {
  const [, m, d] = String(chave).split('-');
  const curto = `${d}/${m}`;
  if (chave === chaveDoDia(hoje)) return `Hoje, ${curto}`;
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (chave === chaveDoDia(ontem)) return `Ontem, ${curto}`;
  return curto;
}

/**
 * Quando o dinheiro entrou: a baixa (`paidAt`). Logo depois do toque o
 * servidor ainda não devolveu a hora, e a linha não pode sumir do extrato
 * nesse meio segundo — então vale o aviso da família e, por último, o
 * vencimento.
 */
function quandoEntrou(p) {
  return paraData(p.paidAt) || paraData(p.claimedAt) || paraData(p.dueDate);
}

function estaPago(p) {
  return (p?._display ?? p?.status) === 'paid';
}

/**
 * Monta o extrato.
 *
 *   pagamentos   payments do mês (com ou sem `_display`)
 *   despesas     expenses do mês
 *   rotulos      { fuel: 'Combustível', ... } — o nome de cada categoria
 *   hoje         Date — injetado para o teste
 *
 * Devolve `{ grupos, entrou, saiu }`. Cada grupo: `{ dia, rotulo, movimentos }`,
 * e cada movimento: `{ id, tipo: 'entrada'|'saida', titulo, detalhe, valor,
 * quando }`. `valor` é sempre positivo; o sinal é o `tipo`. O que não tem data
 * nenhuma vai para um grupo "Sem data", no fim — some do extrato, nunca.
 */
export function montarExtrato({ pagamentos = [], despesas = [], rotulos = {}, hoje = new Date() } = {}) {
  const movimentos = [];
  let entrou = 0;
  let saiu = 0;

  for (const p of pagamentos || []) {
    if (!estaPago(p)) continue;
    const valor = Number(p.amount) || 0;
    entrou += valor;
    movimentos.push({
      id: `p:${p.id}`,
      tipo: 'entrada',
      titulo: `Mensalidade · ${p.childName || 'criança'}`,
      detalhe: FORMA[p.paymentMethod] || 'Recebido',
      valor,
      quando: quandoEntrou(p),
    });
  }

  for (const e of despesas || []) {
    const valor = Number(e.amount) || 0;
    saiu += valor;
    const categoria = rotulos[e.category] || rotulos.other || 'Despesa';
    const descricao = String(e.description || '').trim();
    movimentos.push({
      id: `d:${e.id}`,
      tipo: 'saida',
      titulo: descricao || categoria,
      detalhe: descricao ? categoria : 'Despesa',
      valor,
      quando: paraData(e.date),
    });
  }

  movimentos.sort((a, b) => (b.quando?.getTime() ?? -Infinity) - (a.quando?.getTime() ?? -Infinity));

  const grupos = [];
  const porDia = new Map();
  for (const m of movimentos) {
    const dia = chaveDoDia(m.quando) || 'sem-data';
    let g = porDia.get(dia);
    if (!g) {
      g = { dia, rotulo: dia === 'sem-data' ? 'Sem data' : rotuloDoDia(dia, hoje), movimentos: [] };
      porDia.set(dia, g);
      grupos.push(g);
    }
    g.movimentos.push(m);
  }

  const centavos = (v) => Math.round(v * 100) / 100;
  return { grupos, entrou: centavos(entrou), saiu: centavos(saiu) };
}
