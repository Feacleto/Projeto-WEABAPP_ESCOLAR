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
 * A POLÍTICA DE DESCONTO MORA EM docs/descontos.md, e este arquivo é a
 * ARITMÉTICA dela. O critério que governa o que pode existir aqui é o TESTE DA
 * FILA DO PORTÃO: motorista de perua faz fila no mesmo portão todo dia, então
 * um desconto só pode existir se sobreviver a ser dito em voz alta entre dois
 * deles — motivo público, reproduzível por qualquer um, verificável.
 *
 * Foi esse teste que aposentou duas coisas que já moraram neste arquivo: o
 * fundador de METADE (ninguém pode chegar antes) e a ROLETA (o critério era
 * sorte, e "o Zé girou e tirou 2 meses, eu tirei 10%" não tem resposta).
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

/**
 * A condição de fundador — e desde 07/09/2026 ela é TÍTULO, não preço.
 *
 * ⚠️ AS DOZE VAGAS DE "METADE" NÃO SÃO MAIS CONCEDIDAS, e o motivo é o teste da
 * fila do portão: era o único desconto que ninguém pode reproduzir. *"Eu pago
 * R$ 149 e o Zé paga R$ 74 porque ele chegou antes"* não tem resposta — e numa
 * rede em que eles conversam todo dia no mesmo portão, essa conversa acontece.
 *
 * A troca não custou nada, e é o que a tornou óbvia: quem fecha no mês 1 já
 * leva 50% pela ESCADA DE FECHAMENTO abaixo. O fundador ganha o mesmo desconto
 * que qualquer um pode ganhar, e o que fica exclusivo dele é o que não é preço
 * — título, certificado, nome na página, prioridade no que for construído.
 * Escassez de reconhecimento, não de tarifa.
 *
 * O VITALÍCIO JÁ CONCEDIDO CONTINUA: é contrato assinado, é o primeiro que
 * apostou num produto sem nenhum caso de uso, e ele é um só.
 */
export const FUNDADOR = {
  /** O primeiro motorista da plataforma. Não paga, e não é por tempo. */
  VITALICIO: 'vitalicio',
  /**
   * Metade da conta. ⚠️ APOSENTADO — ver o cabeçalho acima.
   *
   * O valor CONTINUA sendo lido por `descontoDoFundador`, de propósito: se
   * houver concessão histórica, apagar o caso faria a fatura de quem a tem
   * subir em silêncio. Não conceder é diferente de desfazer o que foi
   * concedido, e a segunda coisa precisa de conversa, não de deploy.
   */
  METADE: 'metade',
};

/**
 * QUANTAS CONDIÇÕES DE FUNDADOR EXISTEM — e por que isto precisou virar número.
 *
 * Era 1 vitalício e 12 pela metade. Não havia contador nenhum: `condicaoFundador`
 * era um campo que o dono escrevia por motorista, sem nada somando, então dava
 * para conceder o 14º sem perceber — e o vitalício NÃO EXPIRA, o erro não se
 * conserta no mês seguinte.
 *
 * ⚠️ `FUNDADORES_METADE` É ZERO desde 07/09/2026. O contador continua existindo
 * porque é ele que faz `contarFundadores` (em `concessao.js`) recusar a
 * concessão — zerar a régua sem zerar o contador deixaria a porta aberta para
 * "só essa vez".
 */
export const FUNDADORES_VITALICIO = 1;
export const FUNDADORES_METADE = 0;

/**
 * Cada indicação ativa vale isto, e ela é o ÚNICO desconto sem prazo.
 *
 * Vale enquanto o indicado estiver PAGANDO, e morre quando ele sai. Isso é de
 * propósito: é a pista de aterrissagem do mês 13, quando o desconto de
 * fechamento expira e a fatura dobraria. O único desconto permanente é o que
 * ele renova trazendo gente — ver docs/descontos.md, peça 5.
 *
 * ⚠️ NÃO HÁ MAIS TETO PERCENTUAL. Havia (`TETO_DE_INDICACAO = 0.5`), e ele não
 * protegia nada: com antecipação somando por cima, a fatura chegava a R$ 0,00
 * de qualquer forma. Porcentagem não protege margem porque NÃO É MEDIDA NA
 * MOEDA DO CUSTO. Quem protege agora é `PISO_DA_FATURA`.
 */
export const DESCONTO_POR_INDICACAO = 0.1;

/**
 * ⚠️ O PISO — NENHUMA FATURA FICA ABAIXO DISTO. É a trava de margem do projeto.
 *
 * O número é DERIVADO, não escolhido: é metade da menor faixa (R$ 69 ÷ 2 =
 * R$ 34,50). É isso que faz o "50% no primeiro mês" ser verdade em TODA faixa,
 * sem asterisco — um piso mais alto transformaria a oferta em mentira para o
 * motorista pequeno, que é a maior parte do mercado.
 *
 * Contra um custo de infra de R$ 10 a R$ 20 por motorista/mês (docs/negocio.md,
 * seção 4), o piso garante contribuição positiva no pior caso empilhado — e no
 * pior caso ele está trazendo cinco clientes pagantes.
 *
 * ⚠️ ELE É PUBLICADO JUNTO DA OFERTA, nunca aplicado em silêncio. Se o piso
 * comer parte do desconto de indicação, a tela precisa DIZER quanto comeu — é
 * para isso que `precoDoMes` devolve `pisoAplicado` e `descontoAbsorvido`.
 * Calar produz a queixa que `identidade/indicacao.js` foi escrito para evitar
 * (*"indiquei e não recebi"*), e numa rede de indicação ela viaja mais rápido
 * que a indicação.
 *
 * ⚠️ ISENÇÃO PASSA POR CIMA DELE. `isentoEm` não conhece piso: mês isento não
 * tem fatura, e piso sobre fatura que não existe cobraria R$ 34 de quem a
 * plataforma disse que não pagaria nada.
 *
 * ⚠️ ELE É DA ASSOCIAÇÃO, e não encosta na mensalidade da família. O motorista
 * continua negociando o preço dele com cada família — piso aqui é o custo do
 * ambiente, não uma regra sobre o dinheiro dele.
 */
export const PISO_DA_FATURA = 34;

/**
 * O CONTRATO É DE 12 MESES, E RENOVA DE 12 EM 12.
 *
 * Não há mensal, semestral nem anual à vista — isso era do modelo negociado,
 * que morreu. A cobrança continua MENSAL; o que dura doze meses é o acordo.
 * É esse período que dá prazo aos descontos abaixo.
 */
export const MESES_DE_CONTRATO = 12;

/**
 * A ESCADA DE FECHAMENTO — quanto antes ele decidir, menor a conta dele.
 *
 * ── POR QUE DECRESCENTE, E NÃO FIXA
 * O que existia aqui era `ANTECIPACAO`: 50% em QUALQUER ponto dos 90 dias.
 * Quem fechava no dia 3 e quem fechava no dia 89 levavam o mesmo prêmio, logo
 * ninguém tinha motivo para decidir no mês 1. Um incentivo chamado
 * "antecipação" que não decai é só desconto de tabela com nome bonito.
 *
 * A escada troca "decidir sob pressão" por "decidir gostando" E dá data ao
 * gosto: cada degrau tem um mês em que expira, e a tela mostra a data.
 *
 * ── ⚠️ O PREÇO NUNCA SOBE QUANDO ELE RECUSA
 * A proposta original tinha uma segunda dimensão: recusar fazia o desconto
 * subir (50 → 60 → 70 na mesma tela). Foi descartada, e é a decisão mais
 * importante deste arquivo depois do piso:
 *
 *   1. ENSINA A RECUSAR. Recompensar a recusa três vezes na mesma tela é
 *      condicionamento operante. No mês 13, quando o desconto expira, ele
 *      espera a escada em vez de renovar.
 *   2. PROVA QUE O PREÇO ERA TEATRO. Ancoragem só funciona com âncora crível;
 *      três autoconcessões seguidas provam que a tabela nunca foi o preço.
 *   3. NÃO SOBREVIVE AO PORTÃO. Em uma semana o grupo de WhatsApp sabe
 *      "recusa duas vezes que vai pra 70" — e aí 70% É o preço, com quem
 *      aceitou de boa-fé pagando mais que quem enrolou.
 *
 * A regra que ficou no lugar: nunca ceder na dimensão em que foi empurrado. Ele
 * empurra preço; o app cede em informação, risco ou prazo. O roteiro das três
 * respostas está em docs/descontos.md, peça 3 — e nenhuma delas é desconto.
 *
 * ── O `mesDeDecisao` ENTRA POR PARÂMETRO
 * Quem sabe em que mês do teste ele está é quem tem `trialInicio`, e este
 * arquivo não importa nada. No servidor isso é `functions/lib/contratacao.js`,
 * e é lá de propósito: no cliente, o mês de decisão sairia do relógio do
 * aparelho — a coisa mais fácil de mudar num telefone, valendo metade da conta
 * por um ano.
 */
export const ESCADA_DE_FECHAMENTO = [
  { degrau: 1, fracao: 0.5 },
  { degrau: 2, fracao: 0.3 },
  { degrau: 3, fracao: 0.15 },
];

/**
 * Quem deixou o teste vencer e volta em até 30 dias.
 *
 * Pequeno de propósito: maior que isto premiaria quem esperou, que é
 * exatamente a lição que a escada existe para não ensinar. Zero seria pior —
 * ele já está com a conta inativa, e a única coisa pior que voltar com 10% é
 * não voltar.
 */
export const RETORNO = { fracao: 0.1, prazoDias: 30, degrau: 'retorno' };

/** A renovação, no mês 13. Ver docs/descontos.md, peça 5. */
export const RENOVACAO = { fracao: 0.1, meses: MESES_DE_CONTRATO };

/**
 * O desconto do degrau em que ele fechou, como fração.
 *
 * `mesDeDecisao` é 1, 2 ou 3 — o mês do teste em que ele aceitou. Fora da
 * escada devolve 0, e é o caso de quem deixou os 90 dias passarem: ali o
 * desconto é ZERO, e a conta fica inativa até ele fechar. `'retorno'` é o
 * caminho de volta.
 */
export function descontoDoFechamento(mesDeDecisao) {
  if (mesDeDecisao === RETORNO.degrau) return RETORNO.fracao;
  const n = Math.trunc(Number(mesDeDecisao));
  const passo = ESCADA_DE_FECHAMENTO.find((e) => e.degrau === n);
  return passo ? passo.fracao : 0;
}

/**
 * ⚠️ FUNDADOR E FECHAMENTO NÃO SOMAM — VALE O MAIOR. É decisão de negócio, e
 * está aqui como uma constante para poder ser desfeita numa linha.
 *
 * Somando, o vitalício (100%) receberia mais 50% e a fatura viraria crédito; e
 * um fundador de metade chegaria a 100%, a partir de onde a INDICAÇÃO valeria
 * zero — justamente para as pessoas que mais indicam. O programa de aquisição
 * deixaria de recompensar quem ele precisa recompensar.
 *
 * O fundador já tem o melhor negócio da casa; a escada existe para quem não
 * tem. (Chamava-se `FUNDADOR_E_ANTECIPACAO_SOMAM` — mesma decisão, e o nome
 * seguiu o instrumento quando a antecipação virou escada.)
 */
export const FUNDADOR_E_FECHAMENTO_SOMAM = false;

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
 * É o caminho dos MESES DE TESTE e da isenção concedida. Isenção NÃO é
 * desconto de 100%: o desconto entra na conta e produz uma fatura de R$ 0; a
 * isenção diz que aquele mês não tem fatura a pagar. Os dois chegam a zero e contam histórias
 * diferentes na hora de conferir o que foi concedido.
 */
export function isentoEm(isencaoAte, mes) {
  if (!isencaoAte) return false;
  return String(mes) <= String(isencaoAte);
}

/** As origens possíveis de um desconto com prazo. */
export const ORIGEM = {
  /**
   * O degrau da escada em que ele fechou. É a RÉGUA da conversão.
   *
   * O objeto guardado leva `degrau` junto (1, 2, 3 ou 'retorno') porque a ficha
   * do dono precisa dizer QUAL degrau foi, e a soma por origem não distingue.
   */
  FECHAMENTO: 'fechamento',
  /**
   * ⚠️ LEGADO — `antecipacao` era o nome do fechamento quando ele era 50% fixo.
   *
   * Ela continua sendo SOMADA no balde do fechamento, e isso é deliberado: é
   * literalmente o mesmo instrumento com outro nome, e ignorá-la faria a fatura
   * de quem já a tem subir em silêncio. Escrita nova usa `FECHAMENTO`.
   *
   * ⚠️ `roleta` SAIU e não é reconhecida. A roleta foi apagada em 07/09/2026
   * (o critério era sorte, e sorte não sobrevive ao portão). Se existir
   * `users.descontos` em produção com essa origem, ele deixa de valer em
   * silêncio — CONFIRA a base antes de considerar isto terminado, e converta em
   * `concessao`, com motivo e prazo, o que tiver de ser honrado.
   */
  ANTECIPACAO: 'antecipacao',
  /**
   * A EXCEÇÃO, e ela é diferente das outras em espécie.
   *
   * `fechamento` é RÉGUA: quem cumpre a condição ganha, sempre, e ninguém
   * decide caso a caso. `concessao` é o dono abrindo mão de dinheiro para uma
   * pessoa específica, por um motivo específico.
   *
   * Misturar as duas na mesma leitura é como o orçamento volta: seis meses
   * depois, metade da carteira tem "desconto" e ninguém sabe dizer qual parte é
   * política e qual é exceção. Por isso a origem é separada, o painel as
   * separa, e a concessão exige motivo e prazo (`concessao.js`).
   */
  CONCESSAO: 'concessao',
};

/** Arredonda para centavo. Uma vez, aqui, e não em cada `toFixed` de tela. */
export function centavos(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/**
 * Arredonda uma FRAÇÃO de desconto. Quatro casas, e o motivo é aritmético.
 *
 * `6 * 0.1` em ponto flutuante é `0.6000000000000001`, e frações aqui não são
 * só um passo intermediário: elas são SOMADAS entre si, comparadas com 1 no
 * teto, e impressas como percentual na tela e no contrato. Sem isto, a ficha do
 * dono mostra "60,00000000000001%" e o teste de invariante falha por ruído em
 * vez de por erro de regra.
 *
 * O dinheiro continua fechando em `centavos` — este arredondamento é da
 * fração, e os dois têm precisões diferentes de propósito: quatro casas
 * suportam qualquer combinação de múltiplos de 1% sem falso empate.
 */
function fracaoDeDesconto(v) {
  return Math.round((Number(v) || 0) * 10000) / 10000;
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
 * O desconto das indicações, como fração. SEM TETO — o piso é o teto.
 *
 * Só entram as indicações ATIVAS — o indicado precisa ter pago pelo menos um
 * mês. Quem conta isso é o service; aqui chega o número. Sem a carência, cinco
 * cadastros de teste (que não pagam nada) dariam metade de desconto real, e a
 * plataforma pagaria desconto sobre receita que nunca entrou.
 *
 * ⚠️ O TETO DE 50% SAIU, e não foi para afrouxar: ele não protegia nada. Com o
 * fechamento somando por cima, a fatura chegava a R$ 0,00 com teto e tudo —
 * porcentagem não é medida na moeda do custo. `PISO_DA_FATURA` é.
 *
 * A troca também conserta um efeito perverso do teto: no limite, a indicação
 * seguinte valia ZERO, então o programa parava de recompensar exatamente quem
 * mais indica. Sem teto percentual, cada indicação continua valendo algo até o
 * piso — e o que o piso absorve volta a aparecer no mês 13, quando o desconto
 * de fechamento expira. Nada se perde; fica dormente.
 */
export function descontoDeIndicacoes(indicacoesAtivas) {
  const n = Math.max(0, Math.floor(Number(indicacoesAtivas) || 0));
  return fracaoDeDesconto(n * DESCONTO_POR_INDICACAO);
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
  const soma = { fechamento: 0, concessao: 0 };

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
    // O LEGADO `antecipacao` CAI NO MESMO BALDE do fechamento, de propósito:
    // é o mesmo instrumento com o nome antigo. Ver ORIGEM.ANTECIPACAO.
    if (d.origem === ORIGEM.FECHAMENTO || d.origem === ORIGEM.ANTECIPACAO) {
      soma.fechamento += fracao;
    } else if (d.origem === ORIGEM.CONCESSAO) soma.concessao += fracao;
  });
  soma.fechamento = fracaoDeDesconto(soma.fechamento);
  soma.concessao = fracaoDeDesconto(soma.concessao);
  return soma;
}

/**
 * A conta fechada de um mês.
 *
 * ── O DESCONTO É SOMA, LIMITADO A 100%, E DEPOIS O PISO
 * São duas travas em série, e elas protegem coisas diferentes. O teto de 100%
 * impede FATURA NEGATIVA (crédito saindo da plataforma para quem devia estar
 * pagando). O piso impede FATURA IRRISÓRIA — e é ele que protege a margem.
 *
 * ── ⚠️ ESTE COMENTÁRIO JÁ FOI FALSO, E O BUG DUROU
 * Ele afirmava: *"Quem não é fundador para em 50% pelo teto da indicação —
 * nunca zera."* Não era verdade. `antecipacao` (0,50) somava com indicação
 * (0,50) e QUALQUER associado chegava a 100%:
 *
 *     não-fundador + fechou antecipado + 5 indicações pagas = R$ 0,00
 *
 * E o teste que "provava" o invariante passava cinco indicações SEM a
 * antecipação — o caso que vazava não era coberto. Foi exatamente o padrão que
 * o CLAUDE.md registra como recorrente aqui: comentário que promete garantia
 * sem prová-la. O piso fecha o vazamento; o teste do caso somado é o que
 * impede o PRÓXIMO desconto de reabri-lo.
 *
 * Hoje o zero só existe por duas vias, e as duas são explícitas: o fundador
 * vitalício, e a isenção (que não passa por aqui — ver `isentoEm`).
 *
 * ── O QUE O PISO DEVOLVE, E POR QUE
 * `pisoAplicado` e `descontoAbsorvido` existem para a tela poder DIZER que o
 * piso comeu parte do desconto. `desconto` continua sendo o NOMINAL — o que a
 * política concedeu —, e o líquido é o que ele paga. A diferença entre os dois
 * é informação do motorista, não detalhe de implementação: calá-la produz a
 * queixa *"indiquei e não recebi"*.
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
      pisoAplicado: false,
      descontoAbsorvido: 0,
      motivo: ACIMA_DA_TABELA,
    };
  }

  const comPrazo = descontosVigentes(descontos, mes);
  const dFundador = descontoDoFundador(fundador);
  const dFechamento = comPrazo.fechamento;
  const dIndicacao = descontoDeIndicacoes(indicacoesAtivas);
  // A CONCESSÃO SOMA, não compete. Ela é exceção sobre a régua, não outra
  // régua: quem já tem metade por ser fundador e recebe 20% de concessão fica
  // com 70%. O teto de 100% abaixo continua sendo o que impede fatura
  // negativa.
  const dConcessao = comPrazo.concessao;

  // Ver `FUNDADOR_E_FECHAMENTO_SOMAM`: por padrão vale o maior dos dois.
  const base = FUNDADOR_E_FECHAMENTO_SOMAM
    ? dFundador + dFechamento
    : Math.max(dFundador, dFechamento);

  const desconto = Math.min(1, fracaoDeDesconto(base + dIndicacao + dConcessao));
  const bruto = centavos(plano.preco);
  const semPiso = centavos(bruto * (1 - desconto));

  // ⚠️ O PISO NUNCA SOBE ACIMA DO BRUTO. Hoje nenhuma faixa é mais barata que
  // ele, mas uma faixa de entrada futura seria — e um piso que cobra mais que
  // a tabela é a plataforma cobrando a mais por causa de uma trava de margem.
  const piso = Math.min(PISO_DA_FATURA, bruto);

  // ⚠️ O VITALÍCIO ESCAPA DO PISO, e é a única exceção. Ele é 100% sem prazo,
  // contratado quando o produto não tinha nenhum caso de uso; cobrar R$ 34 dele
  // agora seria desfazer um acordo assinado por causa de uma regra que nasceu
  // depois. É um só, e o custo é conhecido.
  const isento = dFundador >= 1;
  const liquido = isento ? semPiso : Math.max(semPiso, piso);

  return {
    bruto,
    desconto,
    descontoFundador: dFundador,
    descontoFechamento: dFechamento,
    descontoIndicacao: dIndicacao,
    descontoConcessao: dConcessao,
    liquido,
    /** O piso mordeu? A tela precisa dizer isso, não esconder. */
    pisoAplicado: liquido > semPiso,
    /** Quanto de desconto o piso comeu, em reais. */
    descontoAbsorvido: centavos(liquido - semPiso),
    motivo: null,
  };
}
