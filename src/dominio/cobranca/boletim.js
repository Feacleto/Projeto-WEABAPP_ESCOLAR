import { formatBRL, primeiroNome } from '../../compartilhado/formatters.js';

/**
 * O BOLETIM DO NEGÓCIO — o que o Buzi, o assistente digital do Financeiro,
 * responde (decisão do dono, 04/10/2026).
 *
 * NÃO É IA, e por isso não se chama assim. Cada resposta é montada aqui, com
 * os números que o app já tem: a mesma pergunta no mesmo instante dá sempre a
 * mesma resposta, nenhum dado sai do celular, e nada é inventado.
 *
 * ── AS TRÊS REGRAS DO DONO, e o teste cobra as três
 *
 *   1. UM ASSUNTO POR PERGUNTA. "Quem está atrasado" fala SÓ de atrasado;
 *      "quem avisou que pagou" fala SÓ de quem espera conferência; "quanto
 *      entrou" fala SÓ do dinheiro que entrou. Misturar confunde.
 *   2. NADA DE COMPARAR COM O MÊS PASSADO. Um atrasado pago agora pareceria
 *      aumento de receita, e enganaria. No lugar, o "quanto entrou" separa
 *      DENTRO do próprio número o que é do mês e o que é atrasado antigo.
 *   3. NÃO É CONVERSA DE AMIGO. Sem "Oi!", sem "Que bom!": relata e para.
 *
 * ── O QUE CADA COISA QUER DIZER
 *   Entrou    = mensalidade com BAIXA dada no período (\`paidAt\`). "Avisou que
 *               pagou" ainda não é dinheiro conferido, e tem pergunta própria.
 *   Atrasada  = mensalidade aberta, sem aviso da família, depois do dia do
 *               vencimento.
 *   Avisaram  = a família tocou em "Já paguei" e falta ele conferir.
 *
 * ── PARCIAL E FECHADO
 * O mês corrente é PARCIAL e toda frase diz até quando vale ("até hoje, dia
 * 5") — no dia 5 um número pequeno é o mês começando, não o mês ruim. Mês que
 * passou é FECHADO: a foto é tirada no último instante dele, com as datas
 * gravadas (baixa e aviso), e por isso não muda depois — a não ser que ele
 * desfaça uma baixa antiga, e aí o Boletim mostra a correção.
 *
 * ⚠️ OS DOIS DINHEIROS NÃO SE MISTURAM: a taxa da plataforma não entra aqui.
 *
 * Puro (só formata com \`compartilhado/\`): \`npm run testar:boletim\`.
 */

export const TEMA = {
  ATRASADOS: 'atrasados',
  AVISARAM: 'avisaram',
  ENTROU: 'entrou',
};

/** O texto do botão, que vira a bolha dele na conversa. */
export const PERGUNTA = {
  [TEMA.ATRASADOS]: 'Quem está atrasado?',
  [TEMA.AVISARAM]: 'Quem avisou que pagou?',
  [TEMA.ENTROU]: 'Quanto entrou este mês?',
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const OCULTO = 'R$ ••••';

function ms(valor) {
  if (valor == null) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

const centavos = (v) => Math.round((Number(v) || 0) * 100);
const somar = (lista) => lista.reduce((s, p) => s + centavos(p.amount), 0) / 100;

/** 'AAAA-MM' de um instante, no fuso do aparelho. */
export function mesDe(milis) {
  const d = new Date(milis);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "outubro" de 'AAAA-MM'. */
export function nomeDoMes(mes) {
  const m = Number(String(mes).split('-')[1]);
  return MESES[m - 1] || '';
}

/** O último instante do mês 'AAAA-MM'. */
function fimDoMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return new Date(a, m, 1, 0, 0, 0, 0).getTime() - 1;
}

function inicioDoMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return new Date(a, m - 1, 1, 0, 0, 0, 0).getTime();
}

function fimDoDia(milis) {
  const d = new Date(milis);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function dataCurta(milis) {
  const d = new Date(milis);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * O estado de uma mensalidade num INSTANTE. No presente vale o status
 * gravado; no passado (o Boletim fechado) vale o que as datas dizem.
 * → 'paga' | 'avisou' | 'atrasada' | 'no_prazo'
 */
export function estadoEm(p, instante, agora) {
  const vence = ms(p?.dueDate);
  if (instante >= agora) {
    if (p?.status === 'paid') return 'paga';
    if (p?.status === 'claimed') return 'avisou';
  } else {
    const pagoEm = ms(p?.paidAt);
    const avisouEm = ms(p?.claimedAt);
    if (p?.status === 'paid' && pagoEm != null && pagoEm <= instante) return 'paga';
    if (avisouEm != null && avisouEm <= instante) return 'avisou';
  }
  if (vence != null && fimDoDia(vence) < instante) return 'atrasada';
  return 'no_prazo';
}

const linha = (p, detalhe) => ({
  id: p.id,
  nome: primeiroNome(p.childName, 'Criança'),
  valor: Number(p.amount) || 0,
  detalhe,
});

/**
 * QUEM ESTÁ ATRASADO — só os atrasados, do mês e de meses anteriores, o mais
 * antigo primeiro (é quem precisa ser cobrado antes).
 */
export function quemEstaAtrasado(pagamentos = [], { agora = Date.now(), instante = agora, mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const lista = pagamentos
    .filter((p) => estadoEm(p, instante, agora) === 'atrasada')
    .sort((a, b) => (ms(a.dueDate) || 0) - (ms(b.dueDate) || 0));
  const total = somar(lista);
  const n = lista.length;
  const frases = n === 0
    ? ['Nenhuma mensalidade atrasada.']
    : [`${n === 1 ? '1 mensalidade está atrasada' : `${n} mensalidades estão atrasadas`}.`,
      `Total: ${fmt(total)}.`];
  return {
    tema: TEMA.ATRASADOS,
    frases,
    linhas: lista.map((p) => linha(p, `venceu em ${dataCurta(ms(p.dueDate))}`)),
    total,
    quantas: n,
  };
}

/** QUEM AVISOU QUE PAGOU — e espera ele conferir. */
export function quemAvisouQuePagou(pagamentos = [], { agora = Date.now(), instante = agora, mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const lista = pagamentos
    .filter((p) => estadoEm(p, instante, agora) === 'avisou')
    .sort((a, b) => (ms(a.claimedAt) || 0) - (ms(b.claimedAt) || 0));
  const total = somar(lista);
  const n = lista.length;
  const frases = n === 0
    ? ['Nenhuma família está esperando você conferir um pagamento.']
    : [`${n === 1 ? '1 mensalidade foi avisada como paga' : `${n} mensalidades foram avisadas como pagas`} e espera${n === 1 ? '' : 'm'} você conferir.`,
      `Total: ${fmt(total)}.`];
  return {
    tema: TEMA.AVISARAM,
    frases,
    linhas: lista.map((p) => linha(p, p.receiptURL ? 'com comprovante' : 'sem comprovante')),
    total,
    quantas: n,
  };
}

/**
 * QUANTO ENTROU NO MÊS — pela data da BAIXA, separando, dentro do próprio
 * número, o que é mensalidade do mês, o que é atrasado antigo pago agora e o
 * que é mensalidade adiantada. Nenhuma comparação com outro mês.
 */
export function quantoEntrou(pagamentos = [], { mes, agora = Date.now(), mostrar = true } = {}) {
  const fmt = mostrar ? formatBRL : () => OCULTO;
  const mesDoBoletim = mes || mesDe(agora);
  const de = inicioDoMes(mesDoBoletim);
  const ate = Math.min(fimDoMes(mesDoBoletim), agora);
  const parcial = fimDoMes(mesDoBoletim) >= agora;
  const pagas = pagamentos.filter((p) => {
    if (p?.status !== 'paid') return false;
    const quando = ms(p.paidAt);
    return quando != null && quando >= de && quando <= ate;
  });
  const doMes = pagas.filter((p) => p.month === mesDoBoletim);
  const antigos = pagas.filter((p) => (p.month || '') < mesDoBoletim);
  const adiantados = pagas.filter((p) => (p.month || '') > mesDoBoletim);
  const total = somar(pagas);
  const nome = nomeDoMes(mesDoBoletim);
  const quando = parcial ? `Até hoje, dia ${new Date(agora).getDate()} de ${nome}` : `Em ${nome}`;

  const frases = [];
  if (total === 0) {
    frases.push(`${quando}, nenhuma mensalidade teve baixa.`);
  } else {
    frases.push(`${quando}, entraram ${fmt(total)}.`);
    if (doMes.length) frases.push(`${fmt(somar(doMes))} são mensalidades de ${nome}.`);
    if (antigos.length) frases.push(`${fmt(somar(antigos))} são atrasados de meses anteriores, pagos agora.`);
    if (adiantados.length) frases.push(`${fmt(somar(adiantados))} são mensalidades adiantadas.`);
  }
  frases.push('Conta só o que você já conferiu e deu baixa.');

  return {
    tema: TEMA.ENTROU,
    frases,
    linhas: [],
    total,
    partes: { doMes: somar(doMes), antigos: somar(antigos), adiantados: somar(adiantados) },
    parcial,
  };
}

/** A resposta de um tema — o que a conversa chama a cada toque. */
export function responder(tema, pagamentos, opcoes = {}) {
  if (tema === TEMA.ATRASADOS) return quemEstaAtrasado(pagamentos, opcoes);
  if (tema === TEMA.AVISARAM) return quemAvisouQuePagou(pagamentos, opcoes);
  if (tema === TEMA.ENTROU) return quantoEntrou(pagamentos, opcoes);
  return null;
}

/**
 * O BOLETIM — os três assuntos de um mês, no documento que ele baixa.
 * Mês corrente: parcial, com a foto de AGORA. Mês passado: fechado, com a foto
 * do último instante dele.
 */
export function boletimDoMes(pagamentos = [], { mes, agora = Date.now(), mostrar = true } = {}) {
  const mesDoBoletim = mes || mesDe(agora);
  const fechado = fimDoMes(mesDoBoletim) < agora;
  const instante = fechado ? fimDoMes(mesDoBoletim) : agora;
  return {
    mes: mesDoBoletim,
    nomeDoMes: nomeDoMes(mesDoBoletim),
    fechado,
    ate: fechado ? null : new Date(agora).getDate(),
    entrou: quantoEntrou(pagamentos, { mes: mesDoBoletim, agora, mostrar }),
    atrasados: quemEstaAtrasado(pagamentos, { agora, instante, mostrar }),
    avisaram: quemAvisouQuePagou(pagamentos, { agora, instante, mostrar }),
  };
}

/**
 * O selo "Boletim de setembro pronto" no cartão da tela trancada: do dia 1 ao
 * dia 7, até ele abrir. → o mês fechado a anunciar ('AAAA-MM') ou null.
 */
export function boletimParaAnunciar(agora = Date.now(), ultimoAberto = null) {
  const d = new Date(agora);
  if (d.getDate() > 7) return null;
  const anterior = mesDe(new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime());
  return ultimoAberto === anterior ? null : anterior;
}
