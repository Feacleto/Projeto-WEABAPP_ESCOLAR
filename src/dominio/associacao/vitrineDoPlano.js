/**
 * A VITRINE DO PLANO — as contas que a tela de planos mostra ao lado do preço.
 *
 * A tela de planos virou a tela de VENDA (04/10/2026, desenho aprovado pelo
 * dono): o motorista decide sozinho, sem consultor, e precisa ver na mesma
 * superfície quanto paga, quanto isso pesa no que ele recebe, em que mês do
 * teste está e quanto o mercado cobra pela mesma turma. Nenhuma dessas contas
 * decide cobrança — quem cobra é `precoDoMes` —, então aqui só há leitura.
 *
 * Puro de propósito (sem Firebase, sem React): `npm run testar:vitrine`.
 */
import { centavos } from './planos.js';
import { DIAS_DE_TRIAL, DIAS_POR_DEGRAU, diasRestantes } from './trial.js';

/**
 * O CONCORRENTE DIRETO, POR CRIANÇA, NO PLANO MENSAL.
 *
 * ⚠️ É PUBLICIDADE COMPARATIVA, E POR ISSO TEM DATA E CONTA ABERTA.
 * O CONAR (art. 32) e o CDC (art. 37) aceitam comparar preço quando a
 * comparação é objetiva e verificável. A tela nunca diz o NOME de ninguém
 * (decisão do dono): diz "outro app de van escolar com mais tempo de mercado".
 *
 * ⚠️ ERA UMA MÉDIA, E A MÉDIA INFLAVA (04/10/2026, decisão do dono). Somar o
 * Rotasegura (R$ 11,00) à Via Van dava R$ 9,45 por criança — um número que
 * nenhum motorista encontra no mercado. A referência agora é UM concorrente
 * direto, a Via Van, com os números públicos dela:
 *   - mensal R$ 7,90 por aluno, anual R$ 3,90 (Exame);
 *   - multa de 30% do saldo restante ao sair do anual antes de 12 meses
 *     (termos de uso em viavan.com.br) — a nossa é 20%, com teto e carência.
 *
 * ⚠️ PREÇO DE TERCEIRO ENVELHECE SOZINHO. Se ele mudar, esta tela passa a
 * mentir sem ninguém mexer em nada. Revisar a cada trimestre e trocar
 * `referencia` junto — a tela imprime o mês.
 */
export const PRECO_DO_CONCORRENTE = {
  porCrianca: 7.9,
  multaDoAnual: 0.3,
  referencia: '2026-10',
};

/**
 * Quanto a mesma turma custaria no concorrente direto — e quanto ele deixa de
 * gastar aqui.
 *
 * Devolve `null` quando a comparação não favorece ou não existe: sem criança
 * não há turma para comparar, e um número em que o app sai mais caro não é
 * argumento de venda — mostrá-lo seria a tela trabalhando contra si mesma, e
 * escondê-lo calado com um "R$ 0,00 a menos" seria pior.
 */
export function comparacaoComOMercado({ criancas, liquido } = {}) {
  const n = Number(criancas) || 0;
  const nosso = Number(liquido);
  if (n <= 0 || liquido == null || !Number.isFinite(nosso)) return null;
  const mercado = centavos(n * PRECO_DO_CONCORRENTE.porCrianca);
  const economiaMes = centavos(mercado - nosso);
  if (economiaMes <= 0) return null;
  return { mercado, economiaMes, economiaAno: centavos(economiaMes * 12) };
}

/**
 * Quanto do que as famílias pagam a ele a mensalidade do app representa.
 *
 * A receita é a soma das mensalidades das crianças ativas — o que ELE recebe,
 * e não passa pela plataforma. Sem mensalidade cadastrada a fração não existe
 * (`null`), e a tela cala: "0%" ou "infinito" seriam números inventados.
 */
export function pesoNaReceita({ liquido, receita } = {}) {
  const r = Number(receita) || 0;
  const v = Number(liquido);
  if (r <= 0 || liquido == null || !Number.isFinite(v) || v < 0) return null;
  return v / r;
}

/** A soma das mensalidades das crianças ativas. */
export function receitaDaTurma(criancas = []) {
  return centavos(
    (criancas || []).reduce((soma, c) => soma + (Number(c?.monthlyFee) || 0), 0)
  );
}

/** Quantos meses tem o teste — 90 dias são três meses de 30. */
export const MESES_DE_TESTE = Math.round(DIAS_DE_TRIAL / DIAS_POR_DEGRAU);

/**
 * Em que mês do teste ele está: 1, 2 ou 3. `null` quando o relógio não
 * começou ou o teste já acabou — a tela não inventa um "mês 0" nem um "mês 4".
 */
export function mesDoTeste({ inicio, agora } = {}) {
  const restam = diasRestantes(inicio, agora);
  if (restam === null || restam <= 0) return null;
  const passados = DIAS_DE_TRIAL - restam;
  return Math.min(MESES_DE_TESTE, Math.max(1, Math.floor(passados / DIAS_POR_DEGRAU) + 1));
}

/**
 * As linhas de desconto de um `precoDoMes`, na ordem em que a tela as lista.
 * Só entra o que desconta de fato; a fração é a nominal, como a fatura diz.
 */
export function linhasDeDesconto(preco) {
  if (!preco) return [];
  const linhas = [
    ['Condição de fundador', preco.descontoFundador],
    ['Fechamento no teste', preco.descontoFechamento],
    ['Indicações', preco.descontoIndicacao],
    ['Condição especial', preco.descontoConcessao],
  ];
  return linhas
    .filter(([, fracao]) => Number(fracao) > 0)
    .map(([rotulo, fracao]) => ({ rotulo, fracao: Number(fracao) }));
}
