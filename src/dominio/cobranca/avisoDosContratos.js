/**
 * O NÚMERO DO AVISO "OS CONTRATOS ACABAM" — o MESMO da fila "Renovar
 * contratos" (14/11/2026). Sem Firebase e sem React
 * (`npm run testar:contratos-que-vencem`).
 *
 * ── POR QUE ESTE ARQUIVO NÃO TEM RÉGUA PRÓPRIA
 * O aviso do Início nasceu com uma régua sua (janela de 60 dias, "famílias") e
 * a fila de renovação nasceu com outra (`renovacaoDoContrato.js`, dois meses à
 * frente, uma linha por criança). O Início diria N e a fila diria M para a
 * mesma pergunta — "quem perde a mensalidade" —, e quem confere uma tela
 * contra a outra desconfia das duas. Ficou UMA: a da renovação. Este arquivo
 * só LÊ a fila e a separa em duas, a que ainda vai acabar e a que já acabou;
 * a soma das duas é, por construção, `fila.total`.
 *
 * ── QUEM CONTA (o que a fila lista, e só isso)
 * A criança ativa, com família no app, cujo contrato termina antes do mês-alvo
 * (`terminaAntesDoMes`, o mesmo critério de `mesDentroDaVigencia` do servidor,
 * conferido contra ele nos testes). Entram as três situações da fila — a que
 * pode renovar, a que espera a família assinar e a do primeiro contrato nunca
 * assinado —, porque as três perdem a parcela se nada acontecer. Fica de fora
 * quem não tem família no app: a mensalidade dessa já não nasce por outro
 * motivo.
 *
 * ⚠️ NÃO FILTRA POR MENSALIDADE. A fila também não: a criança sem valor aparece
 * lá, e o número do aviso tem que ser o da lista. O custo é um contrato a mais
 * quando falta o valor — que também é algo a atender.
 *
 * ⚠️ A UNIDADE É O CONTRATO (um por criança), não a família: duas crianças da
 * mesma mãe são duas linhas na fila e dois contratos para renovar.
 *
 * ── A JANELA É A DA FILA
 * O contrato aparece dois meses antes de o mês ficar sem parcela
 * (`MESES_DE_ANTECEDENCIA`): o que acaba em 31/12 aparece em 1º/11. Era de 60
 * dias; para o fim em 31/12 dá a mesma data, para um fim no meio do mês a fila
 * chega alguns dias depois. Prevalece a da fila: o aviso que aparece antes da
 * linha existir leva a uma tela vazia.
 *
 * ⚠️ DEPOIS DO FIM NÃO SOME: no dia 1º de janeiro o dano começa, e quem olha
 * só para a frente desapareceria. O contrato que já acabou continua na fila (a
 * linha de renovar vale do mesmo jeito) e continua aqui, como "já acabou".
 */
import { dataISO } from './contratoDaFamilia.js';
import { filaDeRenovacao, primeiroMesSemParcela } from './renovacaoDoContrato.js';

/**
 * @typedef {Object} ContagemDoAviso
 * @property {{contratos:number, primeiroFim:string, ultimoFim:string,
 *   primeiroMesSemParcela:string|null, ultimoMesSemParcela:string|null}|null} vencem
 *   Os que ainda acabam: o fim é hoje ou depois.
 * @property {{contratos:number}|null} vencidos  Os que já acabaram.
 * @property {number} total  Sempre igual a `filaDeRenovacao(...).total`.
 */

/**
 * @param {Array<object>} criancas  as crianças do motorista
 * @param {Date} [hoje]  injetável, para teste
 * @returns {ContagemDoAviso}
 */
export function contagemDoAviso(criancas, hoje = new Date()) {
  const fila = filaDeRenovacao(criancas, hoje);
  const linhas = [...fila.renovar, ...fila.esperando, ...fila.semAceite];
  const hojeISO = dataISO(hoje);

  const aVencer = linhas
    .filter((l) => l.fimAtual >= hojeISO)
    .sort((a, b) => (a.fimAtual < b.fimAtual ? -1 : a.fimAtual > b.fimAtual ? 1 : 0));
  const jaVencidos = linhas.filter((l) => l.fimAtual < hojeISO);

  let vencem = null;
  if (aVencer.length) {
    const meses = aVencer
      .map((l) => primeiroMesSemParcela(l.child.vigenciaInicio, l.fimAtual, hoje))
      .filter(Boolean)
      .sort();
    vencem = {
      contratos: aVencer.length,
      primeiroFim: aVencer[0].fimAtual,
      ultimoFim: aVencer[aVencer.length - 1].fimAtual,
      primeiroMesSemParcela: meses[0] || null,
      ultimoMesSemParcela: meses[meses.length - 1] || null,
    };
  }

  return {
    vencem,
    vencidos: jaVencidos.length ? { contratos: jaVencidos.length } : null,
    total: fila.total,
  };
}
