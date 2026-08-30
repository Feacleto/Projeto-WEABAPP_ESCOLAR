/**
 * A RÉGUA DA TAXA DE ASSOCIAÇÃO — aritmética pura, sem Firebase.
 *
 * POR QUE ISTO SAIU DE `services/taxaService.js`
 * Este projeto testa com scripts Node puros, sem Jest nem Vitest, e isso é
 * decisão registrada. A consequência é direta e custou caro: **lógica pura
 * atrás de um `import { db }` é lógica que não tem como ser testada**. Não é
 * dificuldade, é impossibilidade — o script não consegue nem importar o
 * módulo sem inicializar o Firebase.
 *
 * E aqui mora o dinheiro que a plataforma cobra. `calcularTaxa` decide quanto
 * cada parceiro paga; `dataDeVencimento` decide quando; `isentoEm` decide se
 * paga. As três estavam intestáveis, e o vizinho — o contrato de associação,
 * que é gerado a partir daqui — já saiu ERRADO duas vezes por isso:
 *
 *   1. `montarContrato` lia `base.mensalidadeMedia`, nome que ninguém
 *      produzia. O contrato sairia com valor zero (ver `resumirBase` abaixo,
 *      que hoje devolve os dois nomes de propósito).
 *   2. Com periodicidade mensal e qualquer carência, `mesesCobrados` dava
 *      zero — e o associado assinava, com hash, R$ 0,00 por doze meses.
 *
 * As duas passaram pelo mesmo buraco. `horariosService.js` é a prova de que
 * dá pra fazer diferente neste projeto: 587 linhas de regra, zero imports,
 * bateria de teste própria.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA. É de propósito, e é o que o mantém testável.
 * Não adicione import aqui — nem de service, nem de config. Se precisar de um
 * valor de fora, receba por parâmetro.
 *
 * `taxaService` continua sendo a porta pública: ele reexporta tudo daqui, então
 * nenhuma tela precisou trocar de import.
 */

/**
 * O padrão quando `taxaConfig/app` não existe.
 *
 * Existe como constante e não como "tela obrigatória de configuração" porque o
 * dono precisa conseguir abrir o painel e VER número antes de decidir qual
 * número quer. Config vazia que bloqueia a tela transforma calibragem em
 * pré-requisito, e aí ninguém calibra — configura no escuro.
 */
export const PADRAO = {
  /** Percentual sobre o total contratado do motorista. */
  percentual: 5,
  /**
   * Para onde o motorista paga.
   *
   * Nasce vazio de propósito: sem chave cadastrada a tela dele diz "combine
   * com a plataforma" em vez de mostrar um campo em branco onde deveria estar
   * um código de pagamento. É a mesma decisão que o `PixBlock` toma quando o
   * motorista não cadastrou a chave dele.
   */
  pixKey: '',
  pixKeyType: 'random',
  nomePlataforma: '',
  cidadePlataforma: '',
  /**
   * Piso em reais.
   *
   * Não é ganância: fatura de R$ 4,50 custa mais para emitir, cobrar e
   * conferir do que rende. Abaixo de um certo valor a cobrança dá prejuízo
   * mesmo quando é paga.
   */
  piso: 25,
  /**
   * Dia do mês em que a fatura vence.
   *
   * DA CASA, E NÃO DE CADA PARCEIRO — ao contrário do `dueDay` da criança.
   *
   * Lá a data é por criança porque quem negocia é o MOTORISTA com cada
   * família, e espalhar os vencimentos pelo mês é o que dá fôlego ao caixa
   * dele. Aqui é o inverso: um credor, poucos devedores, e o fechamento roda
   * em lote num clique. Data por parceiro viraria N datas pra acompanhar à
   * mão, num processo sem gateway que avise — o mesmo custo de conferência
   * que o `piso` acima existe pra evitar.
   *
   * Quando alguém pedir dia diferente, o lugar é `diaVencimento` na
   * NEGOCIAÇÃO, e `fecharFatura` prefere ela sobre esta. Override é barato
   * de somar depois; desfazer data por parceiro depois de espalhada, não.
   *
   * 10, como o `FALLBACK_DUE_DAY` do outro lado: um número que já é o padrão
   * mental de quem usa o app não precisa ser aprendido.
   */
  diaVencimento: 10,
};

/**
 * O dia útil possível em QUALQUER mês.
 *
 * Teto 28 e não 31, igual ao `clampDueDay` da criança: dia 30 combinado em
 * janeiro não existe em fevereiro, e a alternativa (empurrar pro mês
 * seguinte) faria a fatura de fevereiro vencer depois da de março. Quem
 * precisa de "último dia do mês" combina 28 e não perde nada real.
 */
export function limitarDiaVencimento(dia) {
  const n = Math.trunc(Number(dia));
  if (!Number.isFinite(n)) return PADRAO.diaVencimento;
  return Math.min(Math.max(1, n), 28);
}

/**
 * O modo de cobrança combinado com o associado.
 *
 * `gratuito` é MODO, e não `valor: 0`. Zero é indistinguível de "ainda não
 * configurei" — e as duas coisas levam a decisões opostas: uma pede cobrança,
 * a outra pede nada.
 */
export const MODOS = { PERCENTUAL: 'percentual', FIXO: 'fixo', GRATUITO: 'gratuito' };

/**
 * Como o associado paga.
 *
 * `anual` é à vista; `anual12` é o mesmo período em doze parcelas. Os dois
 * geram a MESMA receita reconhecida por mês e caixas completamente diferentes —
 * e é justamente essa diferença que o painel precisa mostrar separada.
 */
export const PERIODICIDADES = {
  MENSAL: 'mensal',
  SEMESTRAL: 'semestral',
  ANUAL: 'anual',
  ANUAL12: 'anual12',
};

/** Meses que cada periodicidade cobre. */
export const MESES_DA_PERIODICIDADE = {
  mensal: 1, semestral: 6, anual: 12, anual12: 12,
};

/**
 * Resume a base de cobrança a partir das crianças do motorista.
 *
 * POR QUE NÃO EXISTE "A MENSALIDADE DELE"
 * Cada criança tem seu próprio `monthlyFee` — o tio cobra 250 de uma e 320 de
 * outra, por distância, por irmão, por acordo antigo. Um número único seria
 * mentira arredondada. Então devolvemos o TOTAL (que é a base real) e, ao lado,
 * ticket médio e faixa: é o que permite negociar sabendo o que se está olhando.
 *
 * Criança sem mensalidade configurada entra na CONTAGEM e não na base — ela
 * existe na operação, e o dono precisa ver que ela está sem valor em vez de
 * ela desaparecer da tela. É a mesma decisão que `billing.js` toma ao não
 * gerar cobrança de R$ 0,00.
 */
export function resumirBase(criancas) {
  const ativas = (criancas || []).filter((c) => c.active !== false);
  const valores = ativas
    .map((c) => Number(c.monthlyFee) || 0)
    .filter((v) => v > 0);

  // Soma arredondada: mensalidade com centavo (R$ 287,50) acumula erro de
  // ponto flutuante ao somar oito delas, e a base é o que multiplica tudo.
  const base = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;

  const media = valores.length ? base / valores.length : 0;

  return {
    criancas: ativas.length,
    semMensalidade: ativas.length - valores.length,
    base,
    ticketMedio: media,
    // MESMO NÚMERO, O NOME QUE O CONTRATO PROCURA.
    //
    // `montarContrato` lê `base.mensalidadeMedia` — nome que ninguém produzia.
    // No dia em que o painel de associados foi ligado, o contrato de associação
    // sairia com `valorPorPeriodo: 0` e o motorista assinaria eletronicamente,
    // com hash, um documento dizendo que não deve nada.
    //
    // Os dois nomes convivem de propósito: `ticketMedio` é como o painel do
    // dono chama, `mensalidadeMedia` é como o contrato chama. Derivar os dois
    // do mesmo cálculo aqui é mais barato que renomear em dois vocabulários
    // que já existem na tela.
    mensalidadeMedia: media,
    menor: valores.length ? Math.min(...valores) : 0,
    maior: valores.length ? Math.max(...valores) : 0,
  };
}

/**
 * Arredonda para centavo.
 *
 * POR QUE ISTO NÃO É DETALHE
 * `2240 * 0.04` em ponto flutuante dá `89.60000000000001`. Sem arredondar, esse
 * número entra na fatura, aparece na tela e é somado no relatório — e um total
 * que fecha com quatorze casas depois da vírgula não é um total, é uma pergunta.
 * Dinheiro tem duas casas; o arredondamento acontece UMA vez, aqui, e não em
 * cada `toFixed` espalhado pelas telas.
 */
export function centavos(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** A taxa que a régua da casa pediria, sem negociação nenhuma. */
export function taxaPadrao(base, config = PADRAO) {
  const bruta = (Number(base) || 0) * ((Number(config.percentual) || 0) / 100);
  return centavos(Math.max(bruta, Number(config.piso) || 0));
}

/**
 * A taxa que vale para este motorista, e como ela se compara com o padrão.
 *
 * O PERCENTUAL EFETIVO É O NÚMERO QUE PERMITE COMPARAR MOTORISTAS
 * R$ 90 de quem tem base de R$ 2.240 e R$ 90 de quem tem base de R$ 800 são
 * negócios completamente diferentes. Numa lista de parceiros, o valor absoluto
 * engana e o efetivo não: é ele que mostra quem está pagando pouco de verdade.
 *
 * `abaixoDoPiso` é aviso, não bloqueio. A negociação é do dono, e um piso que
 * recusa o acordo dele deixaria de ser referência para virar regra — o oposto
 * do que ele pediu.
 */
export function calcularTaxa({ base, negociacao, config = PADRAO }) {
  const b = Number(base) || 0;
  const padrao = taxaPadrao(b, config);

  let cobrada = padrao;
  let negociada = false;

  // GRATUIDADE ANTES DE TUDO, e explícita.
  //
  // Ela funcionaria por acidente: `valor: 0` no ramo percentual dá zero. Mas
  // sairia daqui com `abaixoDoPiso: true`, e a tela mostraria um alerta de
  // preço mal negociado em cima de uma decisão deliberada do dono. Um aviso
  // que grita no caso certo é um aviso que se aprende a ignorar.
  const gratuito = negociacao?.modo === MODOS.GRATUITO;

  if (gratuito) {
    negociada = true;
    cobrada = 0;
  } else if (negociacao && Number.isFinite(Number(negociacao.valor))) {
    negociada = true;
    cobrada =
      negociacao.modo === MODOS.FIXO
        ? Number(negociacao.valor)
        : b * (Number(negociacao.valor) / 100);
  }

  cobrada = centavos(cobrada);

  return {
    base: centavos(b),
    padrao,
    cobrada,
    negociada,
    delta: centavos(cobrada - padrao),
    // Sem base não existe percentual — evita 0/0 virando NaN na tela.
    efetivo: b > 0 ? (cobrada / b) * 100 : 0,
    padraoEfetivo: b > 0 ? (padrao / b) * 100 : 0,
    // Gratuidade NÃO é preço abaixo do piso: é decisão. Sem esta exceção o
    // painel alertaria o dono contra a própria escolha dele, toda vez.
    abaixoDoPiso: !gratuito && cobrada < (Number(config.piso) || 0),
    gratuito,
    // `fixo` não acompanha crescimento: entra criança, a plataforma recebe o
    // mesmo. A tela avisa; quem decide é o dono.
    naoAcompanhaCrescimento: negociada && negociacao.modo === MODOS.FIXO,
  };
}

/** A isenção cobre este mês? "Sem negociação" é zero isenção, não erro. */
export function isentoEm(negociacao, mes) {
  const ate = negociacao?.isencaoAte;
  if (!ate) return false;
  return String(mes) <= String(ate);
}

/**
 * A data concreta em que a fatura de `mes` vence.
 *
 * DIA VIRA DATA NO FECHAMENTO, e não na leitura — mesma escolha do
 * `billing.js` do outro lado, que materializa o `dueDay` da criança num
 * `dueDate` por mensalidade. Guardar só o dia obrigaria toda tela que mostra
 * atraso a refazer esta conta, e bastaria uma delas errar a virada de mês
 * para o motorista ver duas datas diferentes pro mesmo boleto.
 *
 * A negociação ganha precedência sobre a régua da casa: hoje ninguém grava
 * `diaVencimento` por parceiro, mas quando alguém pedir dia diferente é aqui
 * que ele passa a valer, sem tocar em mais nada.
 */
export function dataDeVencimento(mes, { negociacao, config } = {}) {
  const [ano, m] = String(mes).split('-').map(Number);
  if (!ano || !m) return null;
  const dia = limitarDiaVencimento(
    negociacao?.diaVencimento ?? config?.diaVencimento ?? PADRAO.diaVencimento
  );
  // Meio-dia, e não meia-noite.
  //
  // `new Date(ano, mes, dia)` nasce no fuso local. Em 00:00 qualquer conversão
  // de fuso de uma hora joga a data pro dia anterior — e a fatura passaria a
  // vencer no dia 9 pra quem abrisse o app do lado errado do meridiano. Meio-dia
  // sobra doze horas de folga pra cada lado.
  return new Date(ano, m - 1, dia, 12, 0, 0, 0);
}
