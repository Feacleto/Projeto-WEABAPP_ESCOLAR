/**
 * OS PLANOS — quanto o motorista paga à plataforma, e por quê esse valor.
 *
 * ATENÇÃO: EXISTEM DOIS MODELOS DE PREÇO NESTE PROJETO, E ELES NÃO PODEM
 * VALER PARA O MESMO PARCEIRO AO MESMO TEMPO.
 *
 *   taxa.js   o modelo NEGOCIADO: percentual sobre a soma das mensalidades,
 *             ajustado caso a caso pelo dono no orçamento. É o que sustenta
 *             os contratos e faturas que já existem.
 *
 *   este      o modelo de AUTOATENDIMENTO: faixa fixa pelo número de crianças
 *             ativas, escolhida pelo próprio motorista, sem ninguém no meio.
 *
 * A migração de um para o outro é decisão em aberto (pendência 1 da seção 12
 * de docs/negocio.md). Enquanto ela não acontece, um parceiro com negociação
 * salva continua no caminho do `taxa.js` — e quem entra sozinho vem por aqui.
 * Somar os dois na mesma fatura cobraria duas vezes.
 *
 * O PLANO CAPA QUANTIDADE, NUNCA FUNCIONALIDADE
 * Isto não é Básico/Pro/Premium. O app é COMPLETO em qualquer faixa: mapa ao
 * vivo, cobrança, agenda e relatório valem igual para quem tem 3 crianças e
 * para quem tem 38. O que muda é o TETO de crianças ativas, que já existe no
 * sistema como `users.limiteCriancas` e já é cobrado pelas rules via
 * `getAfter` no cadastro de criança.
 *
 * Isso importa porque a alternativa — capar recurso — obrigaria a arrancar
 * alguma coisa do produto só para o plano de baixo existir. E o que sobraria
 * para arrancar seria justamente o que a família vê.
 *
 * A ÂNCORA QUE FAZ O MOTORISTA ENTENDER EM UM SEGUNDO: a taxa custa menos que
 * UMA mensalidade. Ele cobra de R$ 200 a R$ 400 por criança; a conta inteira
 * do app fica abaixo do que ele recebe de uma única família. Ver a seção de
 * valor em docs/negocio.md — a régua abaixo saiu de lá.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA, e é o que o mantém testável sem Firebase
 * (`npm run testar:planos`). Quantas crianças ele tem, se é fundador e
 * quantas indicações valem HOJE são coisas que o service busca e passa por
 * parâmetro.
 */

/** Acima da última faixa não há preço de tabela: é conversa. */
export const ACIMA_DA_TABELA = 'conversa';

/**
 * A régua, em ordem crescente. `ate` é INCLUSIVO.
 *
 * Os valores não são publicados em vitrine nenhuma — preço solto vira âncora
 * antes de existir proposta, e o CLAUDE.md registra isso como decisão.
 */
export const PLANOS = [
  { id: 'ate10', ate: 10, preco: 69, rotulo: 'Até 10 crianças' },
  { id: 'ate25', ate: 25, preco: 149, rotulo: 'De 11 a 25 crianças' },
  { id: 'ate40', ate: 40, preco: 229, rotulo: 'De 26 a 40 crianças' },
];

/** A condição de fundador — quem entrou primeiro, e o que ganhou. */
export const FUNDADOR = {
  /** O primeiro motorista da plataforma. Não paga, e não é por tempo. */
  VITALICIO: 'vitalicio',
  /** Os doze seguintes. Metade da conta. */
  METADE: 'metade',
};

/** Cada indicação ativa vale isto. */
export const DESCONTO_POR_INDICACAO = 0.1;
/** E o total das indicações para aqui — cinco zeram metade da conta. */
export const TETO_DE_INDICACAO = 0.5;

/** Arredonda para centavo. Uma vez, aqui, e não em cada `toFixed` de tela. */
export function centavos(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/**
 * O menor plano em que essa operação cabe.
 *
 * Devolve `null` acima da tabela — e `null` aqui significa "conversa com o
 * consultor", não "de graça". Quem consome precisa tratar isso, e é por isso
 * que não devolvemos o maior plano como consolo: mostrar R$ 229 para quem tem
 * 60 crianças seria cobrar menos do que o combinado por um erro de fallback.
 */
export function planoPara(criancasAtivas) {
  const n = Math.max(0, Number(criancasAtivas) || 0);
  return PLANOS.find((p) => n <= p.ate) || null;
}

/** O plano de um id salvo. `null` se o id não existe mais na régua. */
export function planoPorId(id) {
  return PLANOS.find((p) => p.id === id) || null;
}

/**
 * Quantas crianças ficam de fora se ele escolher este plano.
 *
 * Ele PODE escolher um plano menor do que usa — foi decisão de produto, tomada
 * com o custo na mesa. O que o app não pode é escolher POR ele quais crianças
 * saem: cada uma dessas tem uma família pagando mensalidade, e um corte
 * automático ("as quatro últimas cadastradas") apaga quatro clientes que ele
 * não escolheu perder. Este número existe para a tela dizer quantas são e
 * pedir que ele aponte quais.
 */
export function excedentes(plano, criancasAtivas) {
  if (!plano) return 0;
  const n = Math.max(0, Number(criancasAtivas) || 0);
  return Math.max(0, n - plano.ate);
}

/**
 * O desconto da condição de fundador, como fração.
 *
 * Vitalício é 1 — cem por cento, sem prazo. Foi o primeiro a apostar num
 * produto sem nenhum caso de uso, e é a referência que os próximos vão ouvir.
 */
export function descontoDoFundador(condicao) {
  if (condicao === FUNDADOR.VITALICIO) return 1;
  if (condicao === FUNDADOR.METADE) return 0.5;
  return 0;
}

/**
 * O desconto das indicações, como fração, já com o teto aplicado.
 *
 * Só entram as indicações ATIVAS — o indicado precisa ter pago pelo menos um
 * mês. Quem conta isso é o service; aqui chega o número. Sem a carência, cinco
 * cadastros de teste (que não pagam nada) dariam metade de desconto real, e a
 * plataforma pagaria desconto sobre receita que nunca entrou.
 */
export function descontoDeIndicacoes(indicacoesAtivas) {
  const n = Math.max(0, Math.floor(Number(indicacoesAtivas) || 0));
  return Math.min(n * DESCONTO_POR_INDICACAO, TETO_DE_INDICACAO);
}

/**
 * A conta fechada de um mês.
 *
 * O DESCONTO TOTAL É SOMA, E É LIMITADO A 100%. Fundador com metade mais cinco
 * indicações chega exatamente a zero, e é o desenho: só quem é fundador
 * alcança gratuidade, e só trazendo cinco clientes PAGANTES. Quem não é
 * fundador para em 50% pelo teto da indicação — nunca zera.
 *
 * O limite de 100% não é zelo: sem ele, seis indicações sobre um fundador de
 * metade dariam 110%, e a conta viraria crédito. Fatura negativa é dinheiro
 * saindo da plataforma para quem devia estar pagando.
 *
 * Acima da tabela devolve `preco: null` e NÃO calcula desconto sobre nada.
 * Aplicar 50% sobre um preço inexistente produziria R$ 0 — indistinguível de
 * "não paga" —, e é exatamente o caso em que alguém precisa conversar.
 */
export function precoDoMes({ plano, fundador = null, indicacoesAtivas = 0 } = {}) {
  if (!plano || typeof plano.preco !== 'number') {
    return {
      bruto: null,
      desconto: 0,
      liquido: null,
      motivo: ACIMA_DA_TABELA,
    };
  }

  const dFundador = descontoDoFundador(fundador);
  const dIndicacao = descontoDeIndicacoes(indicacoesAtivas);
  const desconto = Math.min(1, dFundador + dIndicacao);

  return {
    bruto: centavos(plano.preco),
    desconto,
    descontoFundador: dFundador,
    descontoIndicacao: dIndicacao,
    liquido: centavos(plano.preco * (1 - desconto)),
    motivo: null,
  };
}
