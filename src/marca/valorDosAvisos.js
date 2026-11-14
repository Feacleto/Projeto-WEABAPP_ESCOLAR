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

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
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

/** Todas as afirmações com a sua origem, para o teste varrer. */
export function todasAsAfirmacoes() {
  return [
    { id: 'familiaEntrouComValor', ...FAMILIA_ENTROU.comValor },
    { id: 'familiaEntrouSemValor', ...FAMILIA_ENTROU.semValor },
  ];
}
