/**
 * OS AVISOS QUE MOSTRAM AO TIO O QUE O APP FEZ POR ELE (14/11/2026, RC2) —
 * irmão de `valorDoConvite.js`, com a mesma regra: toda frase carrega
 * `sustenta` (a funcionalidade que o app cumpre hoje) e, quando depende de
 * algo para ser verdade, `condicao`. Puro, sem React
 * (`npm run testar:valor-dos-avisos`).
 *
 * Três momentos de docs/analise/13b e 13a:
 *  - a família entrou pelo link (momento 7 — antes, silêncio);
 *  - "Não tem aula" para todas as escolas, com a contagem antes de mandar;
 *  - quantas famílias a rota avisou ao sair (fato 4 — o número era jogado
 *    fora).
 *
 * ⚠️ NÚMERO SÓ DA CONTA. As frases com número recebem o número pronto de quem
 * contou (a escrita que deu certo, as famílias com conta); nenhuma frase daqui
 * traz número escrito à mão.
 */

import { ROTA_INICIADA, ROTA_INICIADA_SEM_MAPA } from './valorDoConvite.js';

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

function familias(n) {
  return n === 1 ? '1 família' : `${n} famílias`;
}

/** Inteiro positivo, ou 0 para tudo o que não é contagem confiável. */
function contagem(n) {
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * ── 1. A FAMÍLIA ENTROU (aviso ao motorista, escrito pelo SERVIDOR)
 *
 * ⚠️ O SERVIDOR NÃO ALCANÇA `src/`: o texto que vai ao celular é o de
 * `functions/lib/reguaDaFamiliaEntrou.js`, e o teste compara os dois.
 *
 * O corpo é escolhido pelo VALOR da mensalidade, que o servidor lê na hora do
 * resgate: sem valor a mensalidade nunca nasce (`billing.js`), e dizer "passa
 * a aparecer" a quem não cadastrou valor seria a frase mentindo. Com valor, a
 * frase não diz QUANDO — a geração é às 6h ou no "Gerar agora".
 */
export const FAMILIA_ENTROU = {
  titulo(nomeDaCrianca) {
    const nome = primeiroNome(nomeDaCrianca);
    return nome ? `A família de ${nome} entrou` : 'Uma família entrou';
  },
  comValor: {
    texto: 'A mensalidade dela passa a aparecer na Carteira.',
    sustenta: 'mensalidade-nasce-com-a-mae',
    condicao: 'mensalidade-com-valor',
  },
  semValor: {
    texto: 'Cadastre o valor da mensalidade para ela aparecer na Carteira.',
    sustenta: 'mensalidade-nasce-com-a-mae',
    condicao: 'mensalidade-com-valor',
  },
};

/**
 * ── 2. "NÃO TEM AULA" PARA TODAS AS ESCOLAS
 *
 * Uma escola segue direto, como sempre foi. Todas de uma vez pede
 * confirmação, porque o aviso não volta: não existe função que apague um
 * aviso de escola. O número é de FAMÍLIAS COM CONTA (`parentUid`), não de
 * crianças — é quem recebe a notificação. Quem não entrou no app tem a falta
 * marcada do mesmo jeito, e a confirmação diz isso quando ninguém recebe.
 */
export const SEM_AULA_TODAS = {
  rotulo: 'Todas as escolas',
  sustenta: 'aviso-de-escola-por-familia',
  condicao: 'familia-com-conta',
};

export function textoDaConfirmacaoSemAula(numeroDeFamilias) {
  const n = contagem(numeroDeFamilias);
  return n
    ? `Vai avisar ${familias(n)}. O aviso não volta.`
    : 'Nenhuma família entrou no app. As faltas ficam marcadas.';
}

/** O botão que pede a confirmação (todas as escolas). */
export function textoDoBotaoSemAulaTodas(numeroDeFamilias) {
  const n = contagem(numeroDeFamilias);
  return n ? `Avisar ${familias(n)}` : 'Marcar as faltas';
}

export const BOTAO_CONFIRMAR_SEM_AULA = 'Mandar';
export const BOTAO_VOLTAR_SEM_AULA = 'Voltar';

/**
 * ── 3. A ROTA AVISOU N FAMÍLIAS
 *
 * O número é o de escritas que DERAM CERTO em `avisarSaidaDaRota` (as que
 * falharam não contam). Zero ou desconhecido — a trava do dia já tinha
 * avisado, ou a resposta não chegou — devolve a frase de sempre, sem número:
 * "0 famílias avisadas" faria o tio achar que o aviso quebrou.
 */
export const ROTA_AVISOU = {
  sustenta: 'rota-iniciada',
  condicao: 'familia-com-conta',
};

export function textoDaRotaIniciada(avisadas, compartilha = true) {
  const n = contagem(avisadas);
  if (!n) return compartilha ? ROTA_INICIADA : ROTA_INICIADA_SEM_MAPA;
  const avisou = `Rota iniciada. ${familias(n)} ${n === 1 ? 'avisada' : 'avisadas'}.`;
  return compartilha ? avisou : `${avisou} A perua não aparece no mapa das famílias.`;
}

/** Todas as afirmações com a sua origem, para o teste varrer. */
export function todasAsAfirmacoes() {
  return [
    { id: 'familiaEntrouComValor', ...FAMILIA_ENTROU.comValor },
    { id: 'familiaEntrouSemValor', ...FAMILIA_ENTROU.semValor },
    { id: 'semAulaConfirma', texto: textoDaConfirmacaoSemAula(4), ...SEM_AULA_TODAS },
    { id: 'semAulaNinguem', texto: textoDaConfirmacaoSemAula(0), ...SEM_AULA_TODAS },
    { id: 'rotaAvisou', texto: textoDaRotaIniciada(4, true), ...ROTA_AVISOU },
    { id: 'rotaAvisouSemMapa', texto: textoDaRotaIniciada(4, false), ...ROTA_AVISOU },
  ];
}
