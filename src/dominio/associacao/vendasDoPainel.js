/**
 * AS CONTAS DAS ABAS VENDAS E MARKETING DO PAINEL DO DONO (05/10/2026).
 *
 * ── A PERGUNTA DE CADA ABA
 * Vendas: "quem está pronto para virar assinante?". Marketing: "por onde o
 * motorista chega, e qual porta traz quem FICA?". As duas leem a lista de
 * motoristas que o painel já tem no cache (`parceirosDoDono`); nenhuma
 * leitura nova, nenhum documento de criança.
 *
 * ── ⚠️ "PRONTO" É UM CRITÉRIO DE CONVERSA, NÃO DE PREÇO
 * Pronto = roda AGORA (rota nos últimos 7 dias) + já passou do 14º dia de
 * teste + ainda não tem plano. Quem não roda não tem o que decidir; quem acabou
 * de começar ainda está aprendendo, e proposta no 3º dia é ruído. O "quanto
 * pagaria" vem de `pagariaPorMes` (a tabela do mensal, sem desconto — a escada
 * é decidida pelo servidor no dia em que ele contratar).
 *
 * ── ⚠️ ONDE O NÚMERO NÃO EXISTE, VEM `null` — NUNCA ZERO
 * Mediana sem nenhum assinante com as duas datas não é "0 dias": é "não
 * medimos". Percentual de canal sem ninguém idem. A tela escreve "—".
 *
 * ── A PROPOSTA NÃO É REESCRITA AQUI
 * `propostaDoPronto` só monta os mesmos argumentos que a ficha do motorista
 * monta e chama `mensagemDeProposta` — uma terceira cópia da conta de degrau
 * seria divergência esperando acontecer.
 *
 * Puro: sem Firebase, sem React. O "agora" entra por parâmetro.
 * `npm run testar:vendas-do-painel`.
 */

import { degrauDo, mensalidadeDe } from './carteira.js';
import { planoValido, FUNDADOR } from './planos.js';
import { diasRestantes } from './trial.js';
import { linkDaProposta, mensagemDeProposta } from './proposta.js';
import { DIAS_DE_USO, pagariaPorMes, rodouNosUltimos } from './retratoDaBase.js';
import { CANAIS, canalValido, rotuloDoCanal } from '../identidade/origem.js';

/** Dias de teste que precisam ter passado para valer uma conversa. */
export const DIAS_DE_TESTE_PARA_CONVERSA = 14;

const DIA_MS = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Dias inteiros entre duas datas; `null` se faltar uma ou se for negativo. */
function diasEntre(de, ate) {
  const a = paraData(de);
  const b = paraData(ate);
  if (!a || !b) return null;
  const d = Math.floor((b.getTime() - a.getTime()) / DIA_MS);
  return d >= 0 ? d : null;
}

function lista(parceiros) {
  return Array.isArray(parceiros) ? parceiros : [];
}

/** Tem plano de verdade (o vitalício conta: ele é assinante, só não paga). */
function temPlano(p) {
  return planoValido(p?.plano) || p?.condicaoFundador === FUNDADOR.VITALICIO;
}

function nomeDe(p) {
  return p?.marcaNome || p?.name || 'Sem nome';
}

/**
 * Quem está pronto para uma conversa de venda, o maior em crianças primeiro
 * (a conversa que mais pesa na conta vem no topo). Suspenso nunca entra: quem
 * parou a conta foi o dono.
 */
export function prontosParaConversa(parceiros, agora, mes = null) {
  return lista(parceiros)
    .filter((p) => {
      if (p?.suspenso === true || temPlano(p)) return false;
      if (!rodouNosUltimos(p, agora)) return false;
      const noTeste = diasEntre(p?.trialInicio, agora);
      return noTeste !== null && noTeste >= DIAS_DE_TESTE_PARA_CONVERSA;
    })
    .map((p) => ({
      uid: p.uid,
      nome: nomeDe(p),
      lugar: p.regiao || p.city || null,
      diasRodando: diasEntre(p.trialInicio, agora),
      criancas: Number(p.criancasAtivas) || 0,
      pagaria: pagariaPorMes(p, mes),
      motorista: p,
    }))
    .sort((a, b) => b.criancas - a.criancas || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * A proposta do pronto: os mesmos argumentos da ficha do motorista, e o link
 * já com o texto. `link` é `null` sem telefone — o botão some em vez de abrir
 * uma conversa vazia.
 */
export function propostaDoPronto(motorista, agora, mes = null) {
  const degrau = degrauDo(motorista, agora);
  const conta = mensalidadeDe(motorista, mes);
  const faltam = motorista?.trialInicio ? diasRestantes(motorista.trialInicio, agora) : null;
  const proposta = mensagemDeProposta({ motorista, degrau, conta, diasRestantes: faltam });
  return {
    assunto: proposta.assunto,
    texto: proposta.texto,
    link: linkDaProposta(motorista?.phone, proposta.texto),
  };
}

/** Quem fechou plano e quando — o mais recente primeiro; sem data, no fim. */
export function fechamentos(parceiros) {
  return lista(parceiros)
    .filter(temPlano)
    .map((p) => ({
      uid: p.uid,
      nome: nomeDe(p),
      plano: p.condicaoFundador === FUNDADOR.VITALICIO ? 'vitalicio' : p.plano,
      em: paraData(p.contratadoEm),
    }))
    .sort((a, b) => (b.em?.getTime() ?? -Infinity) - (a.em?.getTime() ?? -Infinity));
}

/**
 * Do cadastro ao plano: a MEDIANA de dias entre `createdAt` e `contratadoEm`.
 * Mediana e não média: um assinante que deixou o app parado seis meses não
 * pode puxar o número de quem decide em duas semanas. `null` sem dados.
 */
export function medianaDiasAteOPlano(parceiros) {
  const dias = lista(parceiros)
    .filter((p) => planoValido(p?.plano))
    .map((p) => diasEntre(p.createdAt, p.contratadoEm))
    .filter((d) => d !== null)
    .sort((a, b) => a - b);
  if (!dias.length) return null;
  const meio = Math.floor(dias.length / 2);
  return dias.length % 2 ? dias[meio] : Math.round((dias[meio - 1] + dias[meio]) / 2);
}

/** O resumo das fichas da aba Vendas. */
export function resumoDeVendas(parceiros, agora, mes = null) {
  return {
    prontos: prontosParaConversa(parceiros, agora, mes).length,
    assinantes: fechamentos(parceiros).length,
    medianaDias: medianaDiasAteOPlano(parceiros),
    // O número que governa o negócio e que ainda não é medido.
    horaPorFechado: null,
  };
}

function ehDoMes(valor, agora) {
  const d = paraData(valor);
  const hoje = paraData(agora);
  return !!d && !!hoje && d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
}

function canalDe(p) {
  const bruto = p?.origem?.canal;
  return canalValido(bruto) ? bruto : 'direto';
}

/**
 * As fichas do Marketing: cadastros do mês e a parte deles que veio por
 * indicação. A fração é sobre os cadastros DO MÊS, para os dois números
 * falarem da mesma gente; `null` quando o mês não tem cadastro.
 */
export function resumoDeMarketing(parceiros, agora) {
  const doMes = lista(parceiros).filter((p) => ehDoMes(p?.createdAt, agora));
  const porIndicacao = doMes.filter((p) => canalDe(p) === 'indicacao').length;
  return {
    cadastrosNoMes: lista(parceiros).length ? doMes.length : null,
    percentualPorIndicacao: doMes.length ? Math.round((porIndicacao / doMes.length) * 100) : null,
    visitasAoSite: null,
  };
}

/**
 * QUAL PORTA TRAZ QUEM FICA: por canal, quantos cadastraram, que parte rodou a
 * 1ª rota (`ultimaRota` ou o relógio do teste) e que parte roda nos últimos 7
 * dias. ⚠️ Canal com poucos cadastros dá percentual instável — `n` vai junto
 * para a tela mostrar ao lado, e "Sem origem" carrega todo mundo que não deixou
 * rastro (adesivo, boca a boca). `null` sem motoristas.
 */
export function retencaoPorCanal(parceiros, agora) {
  const todos = lista(parceiros);
  if (!todos.length) return null;
  const grupos = new Map();
  for (const p of todos) {
    const c = canalDe(p);
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c).push(p);
  }
  const pct = (parte, total) => Math.round((parte / total) * 100);
  return CANAIS.filter((c) => grupos.has(c.id))
    .map((c) => {
      const g = grupos.get(c.id);
      const rodaram = g.filter((p) => !!paraData(p.ultimaRota) || !!p.trialInicio).length;
      const naSemana = g.filter((p) => rodouNosUltimos(p, agora, DIAS_DE_USO)).length;
      return {
        canal: c.id,
        rotulo: rotuloDoCanal(c.id),
        n: g.length,
        percentualRodou: pct(rodaram, g.length),
        percentualNaSemana: pct(naSemana, g.length),
      };
    })
    .sort((a, b) => b.n - a.n);
}
