/**
 * O COMBUSTÍVEL DA PERUA — abastecer, lembrar o preço do posto, ver a alta
 * (03/10/2026).
 *
 * O motorista abastece toda semana e quase nunca lembra quanto pagou no
 * litro da última vez, nem quantos litros o tanque costuma levar. Tudo isso
 * já está nas despesas de categoria `fuel` que ele lança — desde que a
 * despesa traga `litros`. Esta régua faz as contas; ela não busca nada.
 *
 * ⚠️ O PREÇO DO LITRO NÃO É GRAVADO. Ele é `amount / litros`, sempre. Gravar
 * os três seria dar ao documento a chance de se contradizer (ele corrige o
 * valor e o preço guardado continua o antigo) — e a pergunta "quanto eu
 * paguei no litro?" teria duas respostas.
 *
 * ⚠️ "QUANTO LEVA PARA ENCHER" É MEDIANA, NUNCA MÉDIA. Só conta abastecimento
 * marcado como tanque cheio, e mesmo assim um deles pode ter sido com o
 * tanque quase vazio depois de uma viagem longa, ou com meio tanque porque
 * ele encheu na volta do mecânico. A média puxaria o número para esse dia
 * estranho; a mediana ignora o ponto fora da curva. E precisa de DOIS
 * tanques cheios: um só é um dia, não um costume.
 *
 * ⚠️ A ALTA EM 12 MESES COMPARA O PREÇO, NÃO O GASTO. Se o gasto com
 * combustível subiu porque ele pegou mais três crianças num bairro longe,
 * isso não é alta de preço — é a operação crescendo, e ela já é paga pelas
 * crianças novas. Por isso `precoEm12Meses` olha o preço médio do litro no
 * mês mais antigo e no mais recente da janela, e quem multiplica pelo volume
 * é `altaEm12Meses` (em precisoAumentar.js), com o volume MÉDIO — o mesmo dos
 * dois lados da conta.
 *
 * O preço médio de um mês é o total pago dividido pelo total de litros
 * (média ponderada): abastecer 10 litros caro e 60 barato não é "o preço do
 * mês ficou no meio".
 *
 * ⚠️ NENHUM POSTO É RECOMENDADO. A lista de postos é a memória dele — o
 * último preço que ELE viu em cada um, na ordem em que viu. Ordenar pelo
 * mais barato, ou destacar um, seria o app induzindo uma escolha que tem
 * outros critérios (caminho, fila, confiança na bomba).
 *
 * Puro de propósito: sem Firebase, sem React (`npm run testar:perua`).
 */

import { diasDesde, normalizarNome, paraData } from './historicoDeDespesas.js';

export const TIPOS_DE_COMBUSTIVEL = [
  { chave: 'diesel_s10', rotulo: 'Diesel S10', unidade: 'litros' },
  { chave: 'diesel_s500', rotulo: 'Diesel S500', unidade: 'litros' },
  { chave: 'gasolina', rotulo: 'Gasolina', unidade: 'litros' },
  { chave: 'etanol', rotulo: 'Etanol', unidade: 'litros' },
  // GNV é vendido em m³ — o campo gravado continua sendo `litros`.
  { chave: 'gnv', rotulo: 'GNV', unidade: 'm³' },
];

/** Quantos postos a lista guarda. Acima disso sai o visto há mais tempo. */
export const MAXIMO_DE_POSTOS = 20;

/** O nome do posto que ele digita. Acima disso é texto colado, não nome. */
export const TAMANHO_DO_NOME_DO_POSTO = 60;

/** Faixa em que um preço de litro é crível (R$). Fora dela é dedo errado. */
export const PRECO_MINIMO = 3;
export const PRECO_MAXIMO = 12;

const arred = (n, casas) => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

const positivo = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** 'Diesel S10' — chave desconhecida vira 'Combustível', nunca a chave crua. */
export function rotuloDoTipo(chave) {
  return TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === chave)?.rotulo || 'Combustível';
}

/** Quantos litros um valor compra, com 1 casa. Sem preço, null. */
export function litrosPorValor(valor, preco) {
  if (!positivo(valor) || !positivo(preco)) return null;
  return arred(valor / preco, 1);
}

/** Quanto custam tantos litros, com 2 casas. */
export function valorPorLitros(litros, preco) {
  if (!positivo(litros) || !positivo(preco)) return null;
  return arred(litros * preco, 2);
}

/** O preço do litro de um abastecimento: valor pago ÷ litros. */
export function precoDoLitro({ valor, litros } = {}) {
  if (!positivo(valor) || !positivo(litros)) return null;
  return arred(valor / litros, 2);
}

/** R$ 3 a R$ 12 o litro. R$ 0,59 ou R$ 59 é vírgula no lugar errado. */
export function precoPlausivel(preco) {
  return (
    typeof preco === 'number' &&
    Number.isFinite(preco) &&
    preco >= PRECO_MINIMO &&
    preco <= PRECO_MAXIMO
  );
}

/** Nome do posto limpo: sem espaço sobrando, até 60 caracteres. */
export function nomeDoPosto(texto) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/\s+/g, ' ').trim().slice(0, TAMANHO_DO_NOME_DO_POSTO).trim();
}

/** "Posto São João" e "posto sao joao" são o mesmo posto. Vazio não é posto. */
export function mesmoPosto(a, b) {
  const na = normalizarNome(a);
  return na !== '' && na === normalizarNome(b);
}

/**
 * Os abastecimentos que dá para fazer conta: despesa `fuel` com litros > 0 e
 * data. Combustível lançado sem litros continua sendo gasto (entra no custo
 * do mês), só não ensina nada sobre preço nem tanque.
 */
export function abastecimentosDe(despesas) {
  const lista = [];
  for (const d of despesas || []) {
    if (d?.category !== 'fuel') continue;
    const litros = Number(d.litros);
    if (!positivo(litros)) continue;
    const data = paraData(d.date);
    if (!data) continue;
    const valor = Number(d.amount) || 0;
    lista.push({
      id: d.id ?? null,
      data,
      litros,
      valor,
      precoLitro: precoDoLitro({ valor, litros }),
      posto: nomeDoPosto(d.posto),
      tipo: d.tipoCombustivel || null,
      tanqueCheio: d.tanqueCheio === true,
    });
  }
  return lista.sort((a, b) => b.data - a.data);
}

/** O abastecimento mais recente naquele posto, ou null. */
export function ultimoNoPosto(abastecimentos, posto) {
  const recentes = [...(abastecimentos || [])].sort((a, b) => b.data - a.data);
  return recentes.find((a) => mesmoPosto(a.posto, posto)) || null;
}

function mediana(numeros) {
  const v = [...numeros].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/** Quantos litros o tanque costuma levar — mediana dos tanques cheios (≥ 2). */
export function litrosParaEncher(abastecimentos) {
  const cheios = (abastecimentos || [])
    .filter((a) => a?.tanqueCheio === true && positivo(a.litros))
    .map((a) => a.litros);
  if (cheios.length < 2) return null;
  return Math.round(mediana(cheios));
}

/** 'AAAA-MM' de uma data. */
export function chaveDoMes(data) {
  const d = paraData(data);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A janela de 12 meses: os 12 meses de calendário que terminam no mês de
 * hoje, inclusive. Devolve o primeiro e o último 'AAAA-MM'.
 */
export function janelaDe12Meses(hoje = new Date()) {
  const h = paraData(hoje) || new Date();
  return {
    primeiro: chaveDoMes(new Date(h.getFullYear(), h.getMonth() - 11, 1)),
    ultimo: chaveDoMes(h),
  };
}

/**
 * O preço médio do litro no mês mais antigo e no mais recente da janela que
 * têm abastecimento. Menos de dois meses diferentes não é tendência: null.
 */
export function precoEm12Meses(abastecimentos, hoje = new Date()) {
  const { primeiro, ultimo } = janelaDe12Meses(hoje);
  const porMes = new Map();
  for (const a of abastecimentos || []) {
    if (!positivo(a?.litros) || !positivo(a?.valor)) continue;
    const mes = chaveDoMes(a.data);
    if (!mes || mes < primeiro || mes > ultimo) continue;
    const m = porMes.get(mes) || { valor: 0, litros: 0 };
    m.valor += a.valor;
    m.litros += a.litros;
    porMes.set(mes, m);
  }
  const meses = [...porMes.keys()].sort();
  if (meses.length < 2) return null;
  const mesAntes = meses[0];
  const mesAgora = meses[meses.length - 1];
  const preco = (mes) => arred(porMes.get(mes).valor / porMes.get(mes).litros, 2);
  return { antes: preco(mesAntes), agora: preco(mesAgora), mesAntes, mesAgora };
}

/** Os postos, o visto mais recentemente primeiro. Sem data vai para o fim. */
export function postosEmOrdem(postos) {
  return [...(postos || [])].sort((a, b) => {
    const da = paraData(a?.vistoEm)?.getTime() ?? -Infinity;
    const db = paraData(b?.vistoEm)?.getTime() ?? -Infinity;
    return db - da;
  });
}

/**
 * Anota o preço visto num posto. Devolve um array NOVO: o posto de mesmo nome
 * é substituído no lugar; um posto novo entra no fim. Passando de 20, sai o
 * visto há mais tempo. Nome vazio não anota nada.
 */
export function postoComPreco(postos, { nome, preco, tipo, em } = {}) {
  const lista = [...(postos || [])];
  const limpo = nomeDoPosto(nome);
  if (!limpo) return lista;
  const novo = { nome: limpo, preco, tipo, vistoEm: em };
  const i = lista.findIndex((p) => mesmoPosto(p?.nome, limpo));
  if (i >= 0) lista[i] = novo;
  else lista.push(novo);
  // O que acabou de ser anotado nunca é o que sai: sem `em` (dado
  // incompleto) ele ordenaria como o mais antigo e expulsaria a si mesmo.
  while (lista.length > MAXIMO_DE_POSTOS) {
    const maisAntigo = postosEmOrdem(lista.filter((p) => p !== novo)).at(-1);
    lista.splice(lista.indexOf(maisAntigo), 1);
  }
  return lista;
}

/** 'hoje', 'ontem', 'há N dias'. Data inválida: ''. */
export function haQuantoTempo(data, hoje = new Date()) {
  const dias = diasDesde(data, hoje);
  if (dias === null) return '';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}
