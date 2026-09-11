import { precoDoMes, descontoDoFechamento, PLANO } from './planos.js';
import { degrauDaDecisao, ultimoDiaDoDegrau } from './trial.js';

/**
 * A OFERTA DA PRIMEIRA ROTA — quando ela aparece, e o que ela diz.
 *
 * ── O QUE ELA CONSERTA
 * O app ficava MUDO sobre preço nos 60 primeiros dias: `avisoDoTrial` só
 * acende a 30 dias do fim, e a essa altura o motorista já desceu de 30% para
 * 10%. A melhor oferta da casa vencia sem nunca ter sido dita.
 *
 * A oferta passou a andar com a PROVA, não com o calendário: ela nasce no
 * instante em que ele ENCERRA a primeira rota — o momento em que viu o laço
 * inteiro do produto fechar.
 *
 * ── ⚠️ FECHAR NÃO É RECUSAR, E ISSO É O MECANISMO INTEIRO
 * São três toques no mesmo dia (a folha, um push 40 min depois, a folha de
 * novo na próxima abertura). Se fechar contasse como "não", um toque
 * acidental apagaria o maior desconto da casa. Se nada contasse como "não", a
 * rajada perseguiria quem já decidiu.
 *
 * Só o botão explícito grava `recusada`, e ele mata os três de uma vez. Quem
 * fecha continua recebendo os outros dois — e depois disso, silêncio: a
 * oferta só reaparece se ELE abrir `/tio/planos`.
 *
 * ── ⚠️ O QUE É VITALÍCIO É A FRAÇÃO, NUNCA O VALOR
 * O desconto de fechamento não expira (`ate: null`), mas o valor acompanha a
 * turma: quem trava 30% com 4 crianças e cresce para 25 paga mais no mês
 * seguinte, com os mesmos 30%. Dizer "R$ 34,30 pra sempre" seria a frase que
 * vira reclamação na primeira fatura maior — e é por isso que
 * `textoDaOferta` devolve os dois números E a frase que os separa.
 *
 * ── ⚠️ O QUE NÃO ENTRA AQUI: A INDICAÇÃO
 * `ConviteParaIndicar` tem lista fechada de quatro telas, e o sino nos 90
 * dias está FORA com o motivo escrito no teste — "colide com a escada, que
 * tem data; a indicação não tem". Esta oferta É a escada. Pôr as duas na
 * mesma superfície é exatamente a colisão que a regra nomeia; o convite mora
 * no destino do botão (`/tio/planos`), a um toque daqui.
 */

/**
 * A JANELA DO DESCONTO DE CONVERSÃO ESTÁ ABERTA?
 *
 * ⚠️ ELA MORA NO DOMÍNIO E NÃO NO SERVICE, e o motivo é o de sempre neste
 * projeto: o service importa o Firebase, e o Node não o carrega — a regra
 * ficaria sem teste. Aqui ela é uma linha pura e a bateria a alcança.
 *
 * ⚠️ AUSENTE É ABERTA. Base antiga não tem o campo gravado, e tratar a
 * ausência como fechada apagaria a oferta de todo mundo sem ninguém ter
 * desligado nada — e sem erro em lugar nenhum. Desligar é um ato; só o
 * `false` explícito conta.
 */
export function escadaAberta(config) {
  return config?.janelaEscada !== false;
}

/** Os três estados. `null` (campo ausente) é "ainda não ofereci". */
export const OFERTA = {
  PENDENTE: 'pendente',
  RECUSADA: 'recusada',
  ACEITA: 'aceita',
};

/**
 * A oferta cabe agora? `motivo` existe para o log, nunca para a tela.
 *
 * Quatro portas fechadas, e cada uma por um motivo diferente:
 *   contratado   ele já decidiu; oferecer de novo prova que o preço era teatro
 *   recusada     ele disse não com o dedo dele
 *   sem relógio  nunca rodou — falar de preço a quem não usou é falar de
 *                uma coisa que não existe para ele
 *   fora da escada  passou dos 90 dias, e aí o assunto é `RETORNO`, não esta
 */
export function podeOferecer({ motorista, janelaAberta = true, agora = new Date() } = {}) {
  const m = motorista || {};
  /* ⚠️ A JANELA FECHADA CALA A OFERTA, e isso não é zelo: `contratarPlano` lê
   * a mesma janela e NÃO GRAVA o desconto quando ela está fechada. Anunciar
   * aqui sem esse guarda seria a tela prometendo 30% e a fatura vindo cheia —
   * exatamente o defeito que fez todo contrato assinado dizer "todo dia 10".
   *
   * O padrão é ABERTA porque a ausência do campo é ausência de decisão: quem
   * não desligou nada não pode ter a oferta apagada por um valor que ninguém
   * escreveu. */
  if (janelaAberta === false) return { ok: false, motivo: 'janela_fechada' };
  if (m.plano) return { ok: false, motivo: 'contratado' };
  if (m.ofertaEstado === OFERTA.RECUSADA) return { ok: false, motivo: 'recusada' };
  if (!m.trialInicio) return { ok: false, motivo: 'sem_relogio' };

  const degrau = degrauDaDecisao({ inicio: m.trialInicio, agora });
  const fracao = descontoDoFechamento(degrau);
  if (!fracao) return { ok: false, motivo: 'sem_degrau' };

  return { ok: true, degrau, fracao };
}

/**
 * Os números e as datas da oferta, ou `null`.
 *
 * ⚠️ A FRAÇÃO SAI DA RÉGUA, NUNCA ESCRITA À MÃO. `AvisoDoTrial` já registra
 * por que: um número fixo aqui anunciaria um desconto que o servidor não vai
 * gravar, e o motorista veria 30% na tela e 10% na fatura.
 *
 * ⚠️ E O PREÇO É O DA TURMA REAL DELE. Com uma criança de teste o bruto é o
 * MÍNIMO de tabela — e é honesto: é o que ele pagaria hoje. O que não pode é
 * a frase prometer que esse valor congela.
 */
export function textoDaOferta({ motorista, criancas, janelaAberta = true, agora = new Date() } = {}) {
  const pode = podeOferecer({ motorista, janelaAberta, agora });
  if (!pode.ok) return null;

  const quantas = Number(criancas) > 0 ? Number(criancas) : 1;

  /* ⚠️ O `mes` NÃO É DECORAÇÃO: sem ele `descontosVigentes` devolve zero e a
   * conta sai SEM desconto, silenciosamente — `liquido` volta igual ao
   * `bruto` e a tela anuncia "30%" ao lado de dois números iguais. Pego na
   * primeira execução, e é o tipo de erro que nenhum teste de régua pega se
   * ele só conferir a fração. */
  const d = agora instanceof Date ? agora : new Date(agora);
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const cheio = precoDoMes({ criancas: quantas, plano: PLANO.MENSAL, mes });
  const comDesconto = precoDoMes({
    criancas: quantas,
    plano: PLANO.MENSAL,
    mes,
    descontos: [{ origem: 'fechamento', fracao: pode.fracao, ate: null }],
  });

  return {
    degrau: pode.degrau,
    fracao: pode.fracao,
    porcento: Math.round(pode.fracao * 100),
    criancas: quantas,
    bruto: cheio.bruto,
    liquido: comDesconto.liquido,
    // A data em que a janela fecha — é ela que transforma "considere" em
    // "decida". Sem ela a oferta não tem por que ser hoje.
    ultimoDia: ultimoDiaDoDegrau(motorista.trialInicio, pode.degrau),
  };
}
