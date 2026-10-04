/**
 * "PRECISO AUMENTAR?" — quanto a perua custa por mês, por criança, e quanto
 * isso subiu em um ano (03/10/2026).
 *
 * A pergunta que o motorista faz em outubro, antes de renovar os contratos
 * com as famílias, é se a mensalidade ainda paga a perua. Esta régua junta o
 * que ele já lançou — despesas dos últimos 12 meses, os abastecimentos e o
 * plano de troca — e devolve os números. A DECISÃO É DELE.
 *
 * ⚠️ INFORMAR, NÃO INDUZIR. Nenhuma função aqui sugere valor de reajuste, nem
 * percentual, nem "aumente R$ X". O app mostra o custo, a alta e a mensalidade
 * média lado a lado; quanto cobrar depende da concorrência no bairro dele, da
 * família que já está apertada, de coisas que o app não vê. Um número
 * sugerido viraria o número cobrado, e a responsabilidade por ele seria do app.
 *
 * ⚠️ A ALTA DO COMBUSTÍVEL CONTA O PREÇO, NÃO O VOLUME. Ver o cabeçalho de
 * combustivel.js: se ele gasta mais porque roda mais, quem paga isso são as
 * crianças novas que fizeram ele rodar mais. A alta é
 * (preço do litro agora − preço há um ano) × litros médios por mês ÷ crianças
 * — o MESMO volume dos dois lados, para que só o preço mova o número.
 * Manutenção e auxiliar não têm "preço unitário": ali a alta é a média dos 3
 * meses mais recentes contra a dos 3 mais antigos da janela.
 *
 * ⚠️ SEM 10 MESES DE LANÇAMENTO NÃO HÁ "ALTA EM 12 MESES". Com quatro meses
 * de dado, "subiu R$ 30 por criança em um ano" seria uma extrapolação
 * apresentada como fato. A resposta é null e a tela diz que ainda não dá.
 *
 * ⚠️ OS MESES SEM COMBUSTÍVEL SÃO AVISADOS, não ignorados. Perua escolar
 * abastece todo mês letivo; um mês sem nenhuma despesa `fuel` entre lançamentos
 * de outras categorias quase sempre é um mês que ele ESQUECEU de lançar. Calado,
 * esse buraco baixaria a média do custo e faria a tela dizer que a perua custa
 * menos do que custa — exatamente o erro que leva a não reajustar. A tela
 * mostra a lista e ele decide se lança ou se foi férias mesmo.
 *
 * O divisor do custo mensal é o número de meses COM LANÇAMENTO na janela
 * (mínimo 1): o mês em que ele não lançou nada não é um mês de custo zero.
 *
 * Puro de propósito: sem Firebase, sem React (`npm run testar:perua`).
 */

import { diasDesde, mesDaDespesa, paraData } from './historicoDeDespesas.js';
import { abastecimentosDe, chaveDoMes, janelaDe12Meses, precoEm12Meses } from './combustivel.js';
import { despesasNaJanela, porMesParaTroca } from './reservaDaPerua.js';

/**
 * Os rótulos das categorias, na ordem da folha. Cópia dos de
 * `services/expensesService.js` (EXPENSE_CATEGORIES): o domínio não importa
 * service.
 */
export const ROTULOS_DAS_CATEGORIAS = {
  fuel: 'Combustível',
  maintenance: 'Manutenção',
  monitor: 'Monitor / auxiliar',
  installment: 'Parcela do veículo',
  insurance: 'Seguro',
  tax: 'IPVA e licenciamento',
  other: 'Outros',
};

/** Quantos meses de lançamento a alta em 12 meses exige. */
export const MESES_PARA_ALTA = 10;

/** A renovação entra em destaque a partir de quantos dias antes. */
export const DIAS_DE_DESTAQUE = 60;

const valor = (d) => Number(d?.amount) || 0;

/** Crianças: o array (conta as ativas) ou já o número. */
function quantasCriancas(criancas) {
  if (Array.isArray(criancas)) return ativas(criancas).length;
  const n = Number(criancas);
  return Number.isFinite(n) ? n : 0;
}

/** `active: false` é saída; sem o campo, a criança conta (documento antigo). */
function ativas(criancas) {
  return (criancas || []).filter((c) => c && c.active !== false);
}

/** Os 'AAAA-MM' com algum lançamento na janela, em ordem. */
function mesesComLancamento(naJanela) {
  return [...new Set(naJanela.map(mesDaDespesa).filter(Boolean))].sort();
}

/**
 * O custo médio por mês nos últimos 12 meses, por categoria, mais a parte
 * da troca da perua (quando há plano válido). Sem despesa nenhuma, null.
 */
export function custoMensal({ despesas, planoDaTroca, hoje = new Date() } = {}) {
  const naJanela = despesasNaJanela(despesas, hoje);
  if (naJanela.length === 0) return null;
  const meses = Math.max(1, mesesComLancamento(naJanela).length);
  const somas = new Map();
  for (const d of naJanela) {
    const chave = ROTULOS_DAS_CATEGORIAS[d?.category] ? d.category : 'other';
    somas.set(chave, (somas.get(chave) || 0) + valor(d));
  }
  const partes = [];
  for (const chave of Object.keys(ROTULOS_DAS_CATEGORIAS)) {
    if (!somas.has(chave)) continue;
    partes.push({
      chave,
      rotulo: ROTULOS_DAS_CATEGORIAS[chave],
      valor: Math.round(somas.get(chave) / meses),
    });
  }
  const troca = porMesParaTroca(planoDaTroca);
  if (troca !== null) partes.push({ chave: 'troca', rotulo: 'Troca da perua', valor: troca });
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return { total, partes, meses };
}

/** O custo do mês dividido pelas crianças, em reais inteiros. */
export function custoPorCrianca({ custo, criancas } = {}) {
  const n = quantasCriancas(criancas);
  if (!custo || !Number.isFinite(custo.total) || n < 1) return null;
  return Math.round(custo.total / n);
}

/** A mensalidade média das crianças ativas que pagam alguma coisa. */
export function mensalidadeMedia(criancas) {
  const valores = ativas(criancas)
    .map((c) => Number(c.monthlyFee))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100;
}

/**
 * Quanto o custo por criança subiu em 12 meses, por parte. Valores em reais
 * inteiros por criança por mês; negativo é custo que caiu (e aparece assim —
 * esconder a queda seria só mostrar o lado que justifica aumento).
 */
export function altaEm12Meses({ despesas, abastecimentos, criancas, hoje = new Date() } = {}) {
  const n = quantasCriancas(criancas);
  if (n < 1) return null;
  const naJanela = despesasNaJanela(despesas, hoje);
  const meses = mesesComLancamento(naJanela);
  if (meses.length < MESES_PARA_ALTA) return null;

  const abast = abastecimentos || abastecimentosDe(despesas);
  const preco = precoEm12Meses(abast, hoje);
  const { primeiro, ultimo } = janelaDe12Meses(hoje);
  const litrosNaJanela = abast
    .filter((a) => {
      const mes = chaveDoMes(a?.data);
      return mes && mes >= primeiro && mes <= ultimo;
    })
    .reduce((s, a) => s + (Number(a.litros) || 0), 0);
  const litrosPorMes = litrosNaJanela / meses.length;
  const combustivel = preco ? Math.round(((preco.agora - preco.antes) * litrosPorMes) / n) : 0;

  const porMes = (categoria) => {
    const m = new Map(meses.map((k) => [k, 0]));
    for (const d of naJanela) {
      if (d?.category === categoria) m.set(mesDaDespesa(d), m.get(mesDaDespesa(d)) + valor(d));
    }
    return meses.map((k) => m.get(k));
  };
  const media = (lista) => lista.reduce((s, v) => s + v, 0) / lista.length;
  const variacao = (categoria) => {
    const serie = porMes(categoria);
    return Math.round((media(serie.slice(-3)) - media(serie.slice(0, 3))) / n);
  };

  const partes = [
    { chave: 'combustivel', rotulo: 'Combustível', valor: combustivel },
    { chave: 'maintenance', rotulo: ROTULOS_DAS_CATEGORIAS.maintenance, valor: variacao('maintenance') },
    { chave: 'monitor', rotulo: ROTULOS_DAS_CATEGORIAS.monitor, valor: variacao('monitor') },
  ];
  return {
    total: partes.reduce((s, p) => s + p.valor, 0),
    partes,
    dieselAntes: preco ? preco.antes : null,
    dieselAgora: preco ? preco.agora : null,
  };
}

/**
 * Os meses, do primeiro lançamento da janela até o mês passado, sem nenhuma
 * despesa de combustível. O mês atual fica de fora: ele ainda não acabou.
 */
export function mesesSemCombustivel(despesas, hoje = new Date()) {
  const naJanela = despesasNaJanela(despesas, hoje);
  const meses = mesesComLancamento(naJanela);
  if (meses.length === 0) return [];
  const comCombustivel = new Set(
    naJanela.filter((d) => d?.category === 'fuel').map(mesDaDespesa),
  );
  const h = paraData(hoje) || new Date();
  const [a, m] = meses[0].split('-').map(Number);
  const faltando = [];
  for (let d = new Date(a, m - 1, 1); d < new Date(h.getFullYear(), h.getMonth(), 1); d.setMonth(d.getMonth() + 1)) {
    const k = chaveDoMes(d);
    if (!comCombustivel.has(k)) faltando.push(k);
  }
  return faltando;
}

/** 'AAAA-MM-DD' lido no fuso local, ao meio-dia (como o cadastro grava). */
function dataDaVigencia(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-').map(Number);
    return new Date(a, m - 1, d, 12);
  }
  return paraData(valor);
}

/**
 * O fim de contrato mais próximo entre as crianças ativas (`vigenciaFim`),
 * de hoje em diante. Criança sem vigência gravada não entra: a padrão é
 * calculada, não combinada.
 */
export function proximaRenovacao(criancas, hoje = new Date()) {
  let menor = null;
  for (const c of ativas(criancas)) {
    const fim = dataDaVigencia(c.vigenciaFim);
    if (!fim) continue;
    const dias = diasDesde(hoje, fim);
    if (dias === null || dias < 0) continue;
    if (!menor || fim < menor) menor = fim;
  }
  return menor;
}

/** A renovação está a 60 dias ou menos (e não passou). */
export function emDestaque(renovacao, hoje = new Date()) {
  const dias = diasDesde(hoje, renovacao);
  return dias !== null && dias >= 0 && dias <= DIAS_DE_DESTAQUE;
}
