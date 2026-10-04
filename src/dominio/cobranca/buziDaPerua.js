import { formatBRL } from '../../compartilhado/formatters.js';
import { abastecimentosDe } from './combustivel.js';
import { mediaDeManutencao } from './reservaDaPerua.js';
import {
  USO_DA_PERUA,
  haQuanto,
  kmDesdeOUltimo,
  leituraDeKm,
  mesDaDespesa,
  ultimaDaCategoria,
} from './historicoDeDespesas.js';
import { mesDe, nomeDoMes, quantoEntrou } from './boletim.js';

/**
 * O BUZI FALA DA PERUA E DA SOBRA (04/10/2026, pedido do dono).
 *
 * O Boletim conta o dinheiro das FAMÍLIAS (quem pagou, quem deve, quem
 * avisou). O dono pediu que o Buzi falasse também do que NÃO entra nele e
 * pesa no mês do motorista: o combustível, a manutenção e quanto sobrou
 * depois das despesas.
 *
 * As mesmas regras do Boletim (`boletim.js`), e o teste cobra:
 *   1. UM ASSUNTO POR PERGUNTA — combustível não fala de manutenção.
 *   2. NADA INVENTADO — sem dado, a resposta diz que não há dado e onde
 *      lançar. Nunca "a média do mercado", nunca "você deveria trocar o óleo":
 *      o app não conhece a perua dele, só o que ele lançou.
 *   3. NÃO É CONVERSA DE AMIGO — relata e para.
 *   4. NADA DE COMPARAR COM O MÊS PASSADO — nem o preço do litro: o Buzi diz
 *      o que foi pago NESTE mês, não se subiu ou desceu.
 * E duas desta conversa:
 *   - O POSTO NUNCA É RECOMENDADO. Ele anota preços; o Buzi não diz onde
 *     abastecer (configFinanceiroService: "nunca há posto recomendado").
 *   - ⚠️ A TAXA DA PLATAFORMA NÃO ENTRA NA SOBRA: os dois dinheiros não se
 *     misturam (item 7 dos Termos).
 *
 * Puro: `npm run testar:buzi`.
 */

export const TEMA_DA_PERUA = {
  COMBUSTIVEL: 'combustivel',
  MANUTENCAO: 'manutencao',
  SOBROU: 'sobrou',
};

export const PERGUNTA_DA_PERUA = {
  [TEMA_DA_PERUA.COMBUSTIVEL]: 'Como está o combustível?',
  [TEMA_DA_PERUA.MANUTENCAO]: 'Como está a manutenção?',
  [TEMA_DA_PERUA.SOBROU]: 'Quanto sobrou este mês?',
};

const OCULTO = 'R$ ••••';
const centavos = (v) => Math.round((Number(v) || 0) * 100);
const somar = (lista) => lista.reduce((s, d) => s + centavos(d.amount), 0) / 100;
const dataCurta = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const preco = (v) => `R$ ${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',')}`;
const km = (n) => new Intl.NumberFormat('pt-BR').format(n);

function quandoNoMes(agora, mes) {
  const nome = nomeDoMes(mes);
  return mesDe(agora) === mes ? `Até hoje, dia ${new Date(agora).getDate()} de ${nome}` : `Em ${nome}`;
}

/** COMBUSTÍVEL: o gasto do mês, o último abastecimento e o km desde ele. */
export function sobreCombustivel(despesas = [], { config = {}, agora = Date.now(), mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const mes = mesDe(agora);
  const doMes = despesas.filter((d) => d?.category === 'fuel' && mesDaDespesa(d) === mes);
  const frases = [];

  if (doMes.length === 0) {
    frases.push(`${quandoNoMes(agora, mes)}, nenhum abastecimento foi lançado.`);
  } else {
    const n = doMes.length;
    frases.push(`${quandoNoMes(agora, mes)}, o combustível custou ${fmt(somar(doMes))} em ${n} ${n === 1 ? 'abastecimento' : 'abastecimentos'}.`);
    const comLitros = abastecimentosDe(doMes);
    const litros = comLitros.reduce((s, a) => s + a.litros, 0);
    if (litros > 0) frases.push(`Foram ${km(Math.round(litros))} litros.`);
  }

  const ultima = ultimaDaCategoria(despesas, 'fuel');
  if (ultima) {
    const data = ultima.date?.toDate ? ultima.date.toDate() : new Date(ultima.date);
    const posto = ultima.posto ? ` no ${String(ultima.posto).trim()}` : '';
    frases.push(`O último foi dia ${dataCurta(data)} (${haQuanto(data, new Date(agora))})${posto}: ${fmt(ultima.amount)}.`);
    const desde = kmDesdeOUltimo({ ultima, uso: config.usoDaPerua, kmDasRotas: config.kmDasRotas });
    if (desde) frases.push(`Desde então a perua rodou ${km(desde.km)} km nas rotas.`);
  }

  // O preço do litro: o que ELE pagou no mês, nunca o do mercado. E sem
  // "subiu desde abril" — comparar meses é a regra 2 do Boletim, que vale aqui.
  const comLitro = abastecimentosDe(doMes);
  const litrosDoMes = comLitro.reduce((s, a) => s + a.litros, 0);
  if (litrosDoMes > 0 && mostrar) {
    const valorComLitro = comLitro.reduce((s, a) => s + a.valor, 0);
    frases.push(`Em média, o litro saiu a ${preco(valorComLitro / litrosDoMes)}.`);
  }

  if (!ultima) frases.push('Lance o abastecimento em Lançar despesa, na categoria Combustível.');
  return { tema: TEMA_DA_PERUA.COMBUSTIVEL, frases, linhas: [], quantas: doMes.length };
}

/** MANUTENÇÃO: a última, o km desde ela, o gasto em 12 meses e o guardado. */
export function sobreManutencao(despesas = [], { config = {}, agora = Date.now(), mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const frases = [];
  const ultima = ultimaDaCategoria(despesas, 'maintenance');

  if (!ultima) {
    frases.push('Nenhuma manutenção foi lançada nos últimos 12 meses.');
  } else {
    const data = ultima.date?.toDate ? ultima.date.toDate() : new Date(ultima.date);
    const oQue = ultima.description ? ` (${String(ultima.description).trim()})` : '';
    frases.push(`A última manutenção foi dia ${dataCurta(data)}, ${haQuanto(data, new Date(agora))}${oQue}: ${fmt(ultima.amount)}.`);
    const desde = kmDesdeOUltimo({ ultima, uso: config.usoDaPerua, kmDasRotas: config.kmDasRotas });
    if (desde) {
      frases.push(`Desde então a perua rodou ${km(desde.km)} km nas rotas.`);
    } else if (config.usoDaPerua === USO_DA_PERUA.TAMBEM_FORA && leituraDeKm(ultima.kmPainel) !== null) {
      frases.push(`Naquele dia o painel marcava ${km(leituraDeKm(ultima.kmPainel))} km.`);
    }
    const media = mediaDeManutencao(despesas, new Date(agora));
    if (media) {
      frases.push(`Nos últimos ${media.meses} ${media.meses === 1 ? 'mês' : 'meses'}, a manutenção custou ${fmt(media.total)}, uns ${fmt(media.porMes)} por mês.`);
    }
  }

  const guardado = config?.guardado?.manutencao;
  if (guardado && Number(guardado.valor) >= 0) {
    frases.push(`Você anotou ${fmt(Number(guardado.valor))} guardado para manutenção.`);
  }
  if (!ultima) frases.push('Lance em Lançar despesa, na categoria Manutenção.');
  return { tema: TEMA_DA_PERUA.MANUTENCAO, frases, linhas: [], quantas: ultima ? 1 : 0 };
}

/**
 * QUANTO SOBROU: o que entrou (baixa conferida) menos o que saiu (despesa
 * lançada) no mês. A maior despesa vem nomeada — é a pergunta que segue.
 */
export function quantoSobrou(pagamentos = [], despesas = [], { agora = Date.now(), mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const mes = mesDe(agora);
  const entrou = quantoEntrou(pagamentos, { mes, agora, mostrar }).total;
  const doMes = despesas.filter((d) => mesDaDespesa(d) === mes);
  const saiu = somar(doMes);
  const sobra = Math.round((entrou - saiu) * 100) / 100;
  const frases = [`${quandoNoMes(agora, mes)}, entraram ${fmt(entrou)} e saíram ${fmt(saiu)}.`];
  if (sobra >= 0) frases.push(`Sobraram ${fmt(sobra)}.`);
  else frases.push(`Saiu mais do que entrou: faltam ${fmt(-sobra)}.`);

  const porCategoria = new Map();
  for (const d of doMes) porCategoria.set(d.category, (porCategoria.get(d.category) || 0) + centavos(d.amount));
  const maior = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];
  if (maior) {
    const nome = { fuel: 'combustível', maintenance: 'manutenção', monitor: 'a auxiliar', installment: 'a parcela da perua', insurance: 'o seguro', tax: 'IPVA e licenciamento' }[maior[0]] || 'outras despesas';
    frases.push(`O que mais pesou foi ${nome}: ${fmt(maior[1] / 100)}.`);
  }
  frases.push('Conta a mensalidade com baixa dada e a despesa que você lançou. A taxa do app não entra aqui.');
  return { tema: TEMA_DA_PERUA.SOBROU, frases, linhas: [], quantas: 0, entrou, saiu, sobra };
}

/** A resposta de um tema da perua — o que a conversa chama a cada toque. */
export function responderDaPerua(tema, { pagamentos = [], despesas = [], config = {}, agora = Date.now(), mostrar = true } = {}) {
  if (tema === TEMA_DA_PERUA.COMBUSTIVEL) return sobreCombustivel(despesas, { config, agora, mostrar });
  if (tema === TEMA_DA_PERUA.MANUTENCAO) return sobreManutencao(despesas, { config, agora, mostrar });
  if (tema === TEMA_DA_PERUA.SOBROU) return quantoSobrou(pagamentos, despesas, { agora, mostrar });
  return null;
}
