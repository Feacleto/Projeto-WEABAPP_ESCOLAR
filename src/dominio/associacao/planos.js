/**
 * OS PLANOS — quanto o motorista paga à plataforma, e por quê esse valor.
 *
 * ESTE É O ÚNICO MODELO DE PREÇO DO PROJETO, desde 06/09/2026.
 *
 * O cabeçalho anterior abria avisando que existiam DOIS — este e o `taxa.js`,
 * que era o negociado (percentual sobre a soma das mensalidades, ajustado caso
 * a caso num orçamento) — e mandava o leitor tratar a migração como pendência
 * aberta. O `taxa.js` foi APAGADO junto com o orçamento, o funil e a
 * aprovação. Não há segundo modelo, não há migração pendente, e não há como
 * somar os dois numa fatura.
 *
 * Ficou registrado porque o aviso era correto enquanto os dois existiam, e a
 * saída foi apagar um — não escolher entre eles a cada leitura.
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

/**
 * O CONTRATO É DE 12 MESES, E RENOVA DE 12 EM 12.
 *
 * Não há mensal, semestral nem anual à vista — isso era do modelo negociado,
 * que morreu. A cobrança continua MENSAL; o que dura doze meses é o acordo.
 * É esse período que dá prazo aos descontos abaixo.
 */
export const MESES_DE_CONTRATO = 12;

/**
 * QUEM CONTRATA ANTES DE O TESTE ACABAR LEVA METADE, PELOS 12 MESES.
 *
 * O incentivo existe por uma razão de caixa: sem ele, ninguém tem motivo para
 * decidir antes do último dia — e o último dia é justamente quando a decisão
 * concorre com a irritação de ser bloqueado. Antecipar troca "decidir sob
 * pressão" por "decidir gostando".
 */
export const ANTECIPACAO = { fracao: 0.5, meses: MESES_DE_CONTRATO };

/**
 * A ROLETA DA CONVERSÃO — quatro divisões, e ela só aparece ao contratar.
 *
 * Ela era de ENTRADA e girava no primeiro acesso, para o motorista usar o app
 * antes de existir cobrança. Esse papel passou a ser do teste de três meses, e
 * duas coisas grátis empilhadas na entrada custavam meses de receita por
 * associado sem comprar nada que o teste já não comprasse.
 *
 * Agora ela é prêmio de CONVERSÃO: gira quando ele fecha o contrato. Dois
 * prêmios são meses sem taxa e dois são desconto pelos 12 meses do contrato —
 * é por isso que o prazo do desconto é o mesmo do acordo.
 */
export const PREMIOS_DA_ROLETA = [
  { id: 'meses2', rotulo: '2 meses sem taxa', meses: 2 },
  { id: 'desconto30', rotulo: '30% por 12 meses', fracao: 0.3, meses: MESES_DE_CONTRATO },
  { id: 'mes1', rotulo: '1 mês sem taxa', meses: 1 },
  { id: 'desconto10', rotulo: '10% por 12 meses', fracao: 0.1, meses: MESES_DE_CONTRATO },
];

/**
 * ⚠️ FUNDADOR E ANTECIPAÇÃO NÃO SOMAM — VALE O MAIOR. É decisão de negócio, e
 * está aqui como uma constante para poder ser desfeita numa linha.
 *
 * Somando, um fundador de metade (50%) que contratasse antecipado (50%) já
 * chegaria a 100% — e, a partir daí, roleta e indicação valeriam ZERO
 * justamente para os treze primeiros associados, que são quem mais indica. O
 * programa de indicação deixaria de recompensar exatamente quem ele precisa
 * recompensar.
 *
 * O fundador já tem o melhor negócio da casa; a antecipação existe para quem
 * não tem.
 */
export const FUNDADOR_E_ANTECIPACAO_SOMAM = false;

/**
 * O DIA EM QUE A TAXA VENCE — da CASA, não de cada parceiro.
 *
 * Veio de `taxa.js`, que era o modelo negociado e foi apagado. O teto de 28 é o
 * que impede uma fatura de fevereiro nascer sem data: dia 30 não existe em
 * todo mês, e "o último dia" muda de número quatro vezes por ano.
 *
 * Do outro lado do dinheiro, o vencimento da mensalidade é POR CRIANÇA
 * (`billing.js`), e a diferença é de quem negocia: lá é o motorista com cada
 * família; aqui é a plataforma com todo mundo, no mesmo dia.
 */
export const DIA_DE_VENCIMENTO = 10;

export function limitarDiaVencimento(dia) {
  const n = Math.trunc(Number(dia));
  if (!Number.isFinite(n)) return DIA_DE_VENCIMENTO;
  return Math.min(Math.max(1, n), 28);
}

/**
 * A data concreta em que a fatura de `mes` vence.
 *
 * DIA VIRA DATA NO FECHAMENTO, e não na leitura — mesma escolha do
 * `billing.js` do outro lado. Guardar só o dia obrigaria toda tela que mostra
 * atraso a refazer esta conta, e bastaria uma delas errar a virada de mês.
 *
 * Meio-dia, e não meia-noite: `new Date(ano, mes, dia)` nasce no fuso local, e
 * em 00:00 qualquer conversão de uma hora joga a data pro dia anterior.
 */
export function dataDeVencimento(mes, dia = DIA_DE_VENCIMENTO) {
  const [ano, m] = String(mes).split('-').map(Number);
  if (!ano || !m) return null;
  return new Date(ano, m - 1, limitarDiaVencimento(dia), 12, 0, 0, 0);
}

/**
 * Este mês está isento? `ate` é 'AAAA-MM', inclusive.
 *
 * É o caminho dos meses sem taxa da roleta. Isenção NÃO é desconto de 100%: o
 * desconto entra na conta e produz uma fatura de R$ 0; a isenção diz que
 * aquele mês não tem fatura a pagar. Os dois chegam a zero e contam histórias
 * diferentes na hora de conferir o que foi concedido.
 */
export function isentoEm(isencaoAte, mes) {
  if (!isencaoAte) return false;
  return String(mes) <= String(isencaoAte);
}

/** As origens possíveis de um desconto com prazo. */
export const ORIGEM = {
  ANTECIPACAO: 'antecipacao',
  ROLETA: 'roleta',
};

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
 * Os descontos COM PRAZO que ainda valem neste mês, somados por origem.
 *
 * Cada desconto é `{ origem, fracao, ate }`, com `ate` no formato 'AAAA-MM' —
 * o último mês em que ele vale, inclusive. Comparar texto de mês funciona
 * porque o formato é ordenável por construção; é a mesma escolha de
 * `isentoEm`, que já fazia isso na régua antiga.
 *
 * PRAZO IMPORTA MAIS DO QUE PARECE. Um desconto sem data é para sempre, e
 * "para sempre" numa planilha de receita é a diferença entre um negócio que
 * fecha a conta e um que não fecha. Desconto de conversão que não expira vira
 * preço.
 */
export function descontosVigentes(descontos, mes) {
  const m = String(mes || '');
  const soma = { antecipacao: 0, roleta: 0 };

  // SEM MES DE REFERENCIA, NENHUM DESCONTO VALE — e antes valiam TODOS.
  //
  // A comparacao abaixo e de texto, e `'' > '2026-09'` e `false`: com `mes`
  // ausente nada era filtrado, e todo desconto expirado voltava a valer. O
  // padrao de `precoDoMes` e `mes = null`, entao bastava um chamador esquecer
  // o parametro para a conta sair com desconto vencido ha um ano.
  //
  // Ausencia de referencia e ausencia de resposta, nunca "vale tudo": e a
  // mesma escolha de `resumirCarteira`, que devolve `null` em vez de zero.
  if (!m) return soma;
  (Array.isArray(descontos) ? descontos : []).forEach((d) => {
    if (!d || !d.ate || m > String(d.ate)) return;
    const fracao = Math.max(0, Number(d.fracao) || 0);
    if (d.origem === ORIGEM.ANTECIPACAO) soma.antecipacao += fracao;
    else if (d.origem === ORIGEM.ROLETA) soma.roleta += fracao;
  });
  return soma;
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
export function precoDoMes({
  plano,
  fundador = null,
  indicacoesAtivas = 0,
  descontos = null,
  mes = null,
} = {}) {
  if (!plano || typeof plano.preco !== 'number') {
    return {
      bruto: null,
      desconto: 0,
      liquido: null,
      motivo: ACIMA_DA_TABELA,
    };
  }

  const comPrazo = descontosVigentes(descontos, mes);
  const dFundador = descontoDoFundador(fundador);
  const dAntecipacao = comPrazo.antecipacao;
  const dIndicacao = descontoDeIndicacoes(indicacoesAtivas);
  const dRoleta = comPrazo.roleta;

  // Ver `FUNDADOR_E_ANTECIPACAO_SOMAM`: por padrão vale o maior dos dois.
  const base = FUNDADOR_E_ANTECIPACAO_SOMAM
    ? dFundador + dAntecipacao
    : Math.max(dFundador, dAntecipacao);

  const desconto = Math.min(1, base + dIndicacao + dRoleta);

  return {
    bruto: centavos(plano.preco),
    desconto,
    descontoFundador: dFundador,
    descontoAntecipacao: dAntecipacao,
    descontoIndicacao: dIndicacao,
    descontoRoleta: dRoleta,
    liquido: centavos(plano.preco * (1 - desconto)),
    motivo: null,
  };
}
