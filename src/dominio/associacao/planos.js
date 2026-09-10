/**
 * OS PLANOS — quanto o motorista paga à plataforma, e por quê esse valor.
 *
 * ESTE É O ÚNICO MODELO DE PREÇO DO PROJETO. Desde 10/09/2026 ele é LINEAR:
 * uma taxa por criança ativa, e dois planos (mensal e anual).
 *
 * ── POR QUE O PREÇO DEIXOU DE SER POR FAIXA
 * Havia cinco faixas, e elas tinham um defeito que só aparece na conta do
 * motorista: na fronteira, UMA criança custava o preço de SETE. Passando de 15
 * para 16 crianças a conta subia R$ 40 — 6,8 vezes a taxa por criança. Ele não
 * sentia que pagou por uma criança, sentia que pagou por sete, e comparava com
 * um concorrente que cobra por aluno.
 *
 * Franquia de tolerância ("a primeira criança extra é grátis") não resolve:
 * empurra o degrau uma criança adiante e acrescenta um número arbitrário.
 * O degrau só some quando não existe fronteira.
 *
 * A troca também conserta um vazamento que ninguém tinha medido: a faixa
 * cobrava R$ 4,76 por criança de quem tinha 25 e R$ 7,44 de quem tinha 16.
 * O topo de cada faixa estava barato, e é lá que mora a operação madura.
 *
 * ── O PLANO CAPA PRAZO E SAÍDA, NUNCA FUNCIONALIDADE
 * Isto não é Básico/Pro/Premium. O app é COMPLETO nos dois planos: mapa ao
 * vivo, cobrança, agenda e relatório valem igual. O que muda é o compromisso —
 * o mensal não tem prazo nem multa, o anual custa metade e pede doze meses.
 *
 * ── A POLÍTICA DE DESCONTO MORA EM docs/descontos.md
 * Este arquivo é a ARITMÉTICA dela. O critério que governa o que pode existir
 * aqui é o TESTE DA FILA DO PORTÃO: motorista de perua faz fila no mesmo portão
 * todo dia, então um desconto só pode existir se sobreviver a ser dito em voz
 * alta entre dois deles — motivo público, reproduzível por qualquer um.
 *
 * Foi esse teste que aposentou o fundador de METADE (ninguém pode chegar antes)
 * e a ROLETA (o critério era sorte). E é ele que APROVA o desconto vitalício:
 * *"eu pago menos porque fechei no primeiro mês do meu teste — feche no
 * primeiro mês do seu"* é reproduzível por quem chega amanhã.
 *
 * ── A ÂNCORA
 * A taxa custa menos que UMA mensalidade. Ele cobra de R$ 200 a R$ 400 por
 * criança; a conta inteira do app fica abaixo do que ele recebe de uma única
 * família. É por causa dessa âncora que existe `TAXA_ACIMA_DE_40` — a R$ 5,90
 * ela quebraria por volta de 42 crianças.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA, e é o que o mantém testável sem Firebase
 * (`npm run testar:planos`). Quantas crianças ele tem, se é fundador e quantas
 * indicações valem HOJE são coisas que o service busca e passa por parâmetro.
 */

/** Os dois planos. O valor é a chave das tabelas abaixo. */
export const PLANO = {
  MENSAL: 'mensal',
  ANUAL: 'anual',
};

/** Os dois planos, em ordem de apresentação. */
export const PLANOS_DISPONIVEIS = [PLANO.MENSAL, PLANO.ANUAL];

/**
 * A TAXA POR CRIANÇA ATIVA, POR MÊS.
 *
 * O anual é EXATAMENTE metade do mensal, e isso é escolha de comunicação: a
 * relação entre os dois planos cabe numa frase, sem conta a fazer. Um número
 * "quase" metade obrigaria a tela a explicar a diferença.
 *
 * Os dois ficam 25% abaixo do concorrente que cobra por aluno (R$ 7,90 mensal
 * e R$ 3,90 anual), e a percentagem é a mesma nos dois planos e em todos os
 * tamanhos — o que permite dizer "25% mais barato, sempre" em vez de um número
 * que muda conforme o tamanho da van.
 */
export const TAXA = {
  [PLANO.MENSAL]: 5.9,
  [PLANO.ANUAL]: 2.9,
};

/**
 * A TAXA MARGINAL das crianças acima da 40ª — e ela existe pela ÂNCORA.
 *
 * A R$ 5,90 cheios, uma operação de 42 crianças pagaria R$ 247,80, e a frase
 * "custa menos que uma mensalidade" começaria a ficar falsa para quem cobra
 * R$ 250. Reduzir a taxa a partir da 41ª mantém a âncora verdadeira e
 * recompensa a operação grande.
 *
 * ⚠️ ELA É MARGINAL, como faixa de imposto: as 40 primeiras continuam a
 * R$ 5,90 e só o excedente muda de preço. É isso que impede a redução de criar
 * o degrau que este arquivo acabou de eliminar — sem marginalidade,
 * `preco(41)` seria MENOR que `preco(40)`, e crescer daria desconto.
 * `npm run testar:planos` prova que o preço nunca desce quando o número sobe.
 */
export const TAXA_ACIMA_DE_40 = {
  [PLANO.MENSAL]: 4.9,
  [PLANO.ANUAL]: 2.4,
};

/** A partir da 41ª criança vale `TAXA_ACIMA_DE_40`. */
export const CRIANCAS_NA_TAXA_CHEIA = 40;

/**
 * O MÍNIMO DA TABELA — nenhuma fatura de tabela nasce abaixo disto.
 *
 * Cinco crianças a R$ 5,90 são R$ 29,50, e o custo de servir um motorista não
 * desce junto com o número de crianças dele: infraestrutura, suporte e o
 * ambiente custam de R$ 10 a R$ 20 por mês independentemente do tamanho.
 *
 * O número também fixa onde a plataforma passa a ser mais barata que o
 * concorrente: do 7º aluno em diante nos dois planos. Abaixo disso ele ganha, e
 * não há como acompanhar sem pagar para trabalhar.
 *
 * ⚠️ ELE É APLICADO ANTES DO DESCONTO, e a ordem é a coisa mais importante
 * desta constante. Aplicado depois, o motorista de 10 crianças com 30%
 * travado pagaria o mínimo de R$ 49 em vez de R$ 41,30 — e o desconto que a
 * plataforma prometeu sumiria em silêncio, que é a queixa que
 * `identidade/indicacao.js` foi escrito para evitar.
 *
 * Quem protege a margem DEPOIS do desconto é `PISO_DA_FATURA`, e são coisas
 * diferentes: este diz o que a tabela cobra, aquele diz até onde o desconto
 * pode descer.
 */
export const MINIMO = {
  [PLANO.MENSAL]: 49,
  [PLANO.ANUAL]: 29,
};

/**
 * A condição de fundador — e desde 07/09/2026 ela é TÍTULO, não preço.
 *
 * ⚠️ AS DOZE VAGAS DE "METADE" NÃO SÃO MAIS CONCEDIDAS, e o motivo é o teste da
 * fila do portão: era o único desconto que ninguém pode reproduzir. *"Eu pago
 * metade porque cheguei antes"* não tem resposta.
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
 * QUANTAS CONDIÇÕES DE FUNDADOR EXISTEM.
 *
 * ⚠️ `FUNDADORES_METADE` É ZERO desde 07/09/2026. O contador continua existindo
 * porque é ele que faz `contarFundadores` (em `concessao.js`) recusar a
 * concessão — zerar a régua sem zerar o contador deixaria a porta aberta para
 * "só essa vez".
 */
export const FUNDADORES_VITALICIO = 1;
export const FUNDADORES_METADE = 0;

/**
 * Cada indicação ativa vale isto, e ela é o ÚNICO desconto que nunca acaba
 * enquanto o indicado paga.
 *
 * ── ⚠️ ERA 10%, E ISSO DAVA PREJUÍZO NO CASO MAIS COMUM DE UMA BASE NOVA
 * O desconto sai da fatura de QUEM INDICA, e quem paga a plataforma é QUEM FOI
 * INDICADO — dois números sem relação nenhuma. Medido: um motorista de 60
 * crianças trazendo um de 8 custava R$ 14,10 por mês (R$ 19,40 se o indicado
 * entrasse no anual), contra um custo de infraestrutura de R$ 10 a R$ 20 por
 * conta. E como não há prazo, isso nunca virava.
 *
 * A 5% o pior caso medido fica em −R$ 2,70 e some no primeiro mês em que o
 * indicado ganhar uma criança. No tamanho mediano (20 crianças) a indicação
 * vale R$ 5,90 — exatamente o preço de UMA criança, que é a unidade de todo o
 * resto do modelo.
 *
 * ── ⚠️ SEM PRAZO, E ISSO É DECISÃO, NÃO ESQUECIMENTO
 * A alternativa era pagar 12 meses por indicação. Simulada contra o caso real
 * — indica 5 no mês 3, mais 5 no mês 7, e cada indicado leva ~4 meses para
 * pagar a primeira fatura —, ela produz DOZE mudanças de fatura em 30 meses,
 * SEIS delas para cima. Este plano tirou o degrau da faixa e o salto do mês 13
 * do preço; o prazo os recolocaria pela porta do desconto, em datas que o
 * motorista não consegue prever porque dependem de quando cada colega pagou.
 *
 * Sem prazo, a conta dele só desce, e o escalonamento das entradas fica
 * invisível. O que limita é o indicado PARAR de pagar — ver `ESTADO.ENCERRADA`
 * em `identidade/indicacao.js`.
 *
 * ⚠️ NÃO HÁ TETO PERCENTUAL. Havia, e ele não protegia nada: com o fechamento
 * somando por cima, a fatura chegava a R$ 0,00 de qualquer forma. Porcentagem
 * não protege margem porque NÃO É MEDIDA NA MOEDA DO CUSTO. Quem protege é
 * `PISO_DA_FATURA` — e a 5% ele quase não encosta: mordia na 4ª indicação de
 * quem tem 8 crianças, agora morde na 7ª.
 */
export const DESCONTO_POR_INDICACAO = 0.05;

/**
 * ⚠️ O PISO — NENHUMA FATURA FICA ABAIXO DISTO DEPOIS DOS DESCONTOS.
 *
 * Ele desceu de R$ 34 para R$ 19 em 10/09/2026, junto com o preço. O valor
 * antigo era metade da menor faixa de um modelo que não existe mais, e mantido
 * onde estava ficaria ACIMA do menor plano novo (o anual mínimo, R$ 29) — o
 * motorista pequeno nunca receberia nada por indicar, que é exatamente a
 * queixa *"indiquei e não recebi"* que o programa foi escrito para evitar.
 *
 * O papel dele hoje é um só: impedir que as indicações empilhem até a fatura
 * ficar irrisória. Contra um custo de infra de R$ 10 a R$ 20 por motorista/mês,
 * R$ 19 garante contribuição não-negativa no pior caso empilhado — e no pior
 * caso ele está trazendo cinco clientes pagantes.
 *
 * ⚠️ ELE É PUBLICADO JUNTO DA OFERTA, nunca aplicado em silêncio. Se o piso
 * comer parte do desconto de indicação, a tela precisa DIZER quanto comeu — é
 * para isso que `precoDoMes` devolve `pisoAplicado` e `descontoAbsorvido`.
 *
 * ⚠️ ISENÇÃO PASSA POR CIMA DELE. `isentoEm` não conhece piso: mês isento não
 * tem fatura, e piso sobre fatura que não existe cobraria R$ 19 de quem a
 * plataforma disse que não pagaria nada.
 *
 * ⚠️ ELE É DA ASSOCIAÇÃO, e não encosta na mensalidade da família.
 */
export const PISO_DA_FATURA = 19;

/**
 * O CONTRATO É DE 12 MESES, E RENOVA DE 12 EM 12.
 *
 * A cobrança é MENSAL nos dois planos — o "anual" é o COMPROMISSO, não a forma
 * de pagar. É esse período que dá prazo à multa de saída; o desconto de
 * fechamento não tem prazo nenhum (ver `ESCADA_DE_FECHAMENTO`).
 */
export const MESES_DE_CONTRATO = 12;

/**
 * A ESCADA DE FECHAMENTO — quanto antes ele decidir, menor a conta dele PARA
 * SEMPRE.
 *
 * ── O DESCONTO NÃO EXPIRA MAIS, E ISSO MUDA O QUE ELE É
 * Até 09/09/2026 a escada valia 12 meses e depois a fatura dobrava. O mês 13
 * era o ponto em que uma base cancela em bloco, e as defesas contra ele
 * (rampa, renovação, mensagem do mês 10) eram todas remendos no mesmo buraco.
 *
 * Travando o desconto enquanto ele ficar, o buraco deixa de existir: não há
 * data para chegar. Em troca, o custo de sair passa a ser dele — quem cancela
 * perde o desconto e não o recupera. É retenção por algo que ele GANHOU, não
 * por uma multa que a plataforma cobra.
 *
 * ── POR QUE 30/20/10 E NÃO 50/30/15
 * Porque agora ele convive com o plano anual, que já é metade do mensal. A 50%,
 * o mensal com desconto máximo empataria com o anual e o anual perderia a razão
 * de existir. A 30% ele fica 30% acima do anual, e os dois planos passam a ter
 * público diferente.
 *
 * ── ⚠️ O PREÇO NUNCA SOBE QUANDO ELE RECUSA
 * Não há segunda oferta em tela nenhuma, e é a decisão mais importante deste
 * arquivo depois do piso:
 *
 *   1. ENSINA A RECUSAR. Recompensar a recusa é condicionamento operante.
 *   2. PROVA QUE O PREÇO ERA TEATRO. Ancoragem só funciona com âncora crível.
 *   3. NÃO SOBREVIVE AO PORTÃO. Em uma semana o grupo de WhatsApp sabe
 *      "recusa duas vezes que melhora" — e aí o pior preço é o de quem
 *      aceitou de boa-fé.
 *
 * A regra que fica no lugar: nunca ceder na dimensão em que foi empurrado. Ele
 * empurra preço; o app cede em informação, risco ou prazo.
 *
 * ── O `mesDeDecisao` ENTRA POR PARÂMETRO
 * Quem sabe em que mês do teste ele está é quem tem `trialInicio`, e este
 * arquivo não importa nada. No servidor isso é `functions/lib/contratacao.js`,
 * e é lá de propósito: no cliente, o mês de decisão sairia do relógio do
 * aparelho — a coisa mais fácil de mudar num telefone, e agora ela vale um
 * desconto PERMANENTE.
 */
export const ESCADA_DE_FECHAMENTO = [
  { degrau: 1, fracao: 0.3 },
  { degrau: 2, fracao: 0.2 },
  { degrau: 3, fracao: 0.1 },
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
 * Somando, o vitalício (100%) receberia mais 30% e a fatura viraria crédito. O
 * fundador já tem o melhor negócio da casa; a escada existe para quem não tem.
 */
export const FUNDADOR_E_FECHAMENTO_SOMAM = false;

/**
 * O DIA EM QUE A TAXA VENCE — da CASA, não de cada parceiro.
 *
 * O teto de 28 é o que impede uma fatura de fevereiro nascer sem data: dia 30
 * não existe em todo mês, e "o último dia" muda de número quatro vezes por ano.
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
 * isenção diz que aquele mês não tem fatura a pagar. Os dois chegam a zero e
 * contam histórias diferentes na hora de conferir o que foi concedido.
 */
export function isentoEm(isencaoAte, mes) {
  if (!isencaoAte) return false;
  return String(mes) <= String(isencaoAte);
}

/** As origens possíveis de um desconto. */
export const ORIGEM = {
  /**
   * O degrau da escada em que ele fechou. É a RÉGUA da conversão, e desde
   * 10/09/2026 ela é VITALÍCIA — o objeto guardado tem `ate: null`.
   *
   * O objeto leva `degrau` junto (1, 2, 3 ou 'retorno') porque a ficha do dono
   * precisa dizer QUAL degrau foi, e a soma por origem não distingue.
   */
  FECHAMENTO: 'fechamento',
  /**
   * ⚠️ LEGADO — `antecipacao` era o nome do fechamento quando ele era 50% fixo
   * e durava 12 meses.
   *
   * Ela continua sendo SOMADA no balde do fechamento, e isso é deliberado: é
   * literalmente o mesmo instrumento com outro nome, e ignorá-la faria a fatura
   * de quem já a tem subir em silêncio. Escrita nova usa `FECHAMENTO`.
   *
   * ⚠️ `roleta` SAIU e não é reconhecida. Se existir `users.descontos` em
   * produção com essa origem, ele deixa de valer em silêncio — CONFIRA a base
   * antes de considerar isto terminado, e converta em `concessao`, com motivo e
   * prazo, o que tiver de ser honrado.
   */
  ANTECIPACAO: 'antecipacao',
  /**
   * A EXCEÇÃO, e ela é diferente das outras em espécie.
   *
   * `fechamento` é RÉGUA: quem cumpre a condição ganha, sempre, e ninguém
   * decide caso a caso. `concessao` é o dono abrindo mão de dinheiro para uma
   * pessoa específica, por um motivo específico — e ela SEMPRE tem prazo.
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
 */
function fracaoDeDesconto(v) {
  return Math.round((Number(v) || 0) * 10000) / 10000;
}

/** Este é um plano que existe? */
export function planoValido(plano) {
  return plano === PLANO.MENSAL || plano === PLANO.ANUAL;
}

/**
 * O PREÇO DE TABELA de uma operação, antes de qualquer desconto.
 *
 * `null` quando o plano não existe — e `null` aqui significa "não sei cobrar
 * isto", nunca "de graça". Quem consome precisa tratar, e é por isso que não
 * caímos no mensal como consolo: cobrar o plano errado por causa de um fallback
 * é pior que recusar a conta.
 *
 * ⚠️ A ORDEM É SOMA MARGINAL PRIMEIRO, MÍNIMO DEPOIS. O mínimo é um piso sobre
 * o total, não sobre a taxa: aplicá-lo por criança faria a operação de 3
 * crianças pagar três mínimos.
 */
export function precoDaTabela({ criancas, plano = PLANO.MENSAL } = {}) {
  if (!planoValido(plano)) return null;

  const n = Math.max(0, Math.floor(Number(criancas) || 0));
  const cheias = Math.min(n, CRIANCAS_NA_TAXA_CHEIA);
  const excedentes = Math.max(0, n - CRIANCAS_NA_TAXA_CHEIA);

  const soma = cheias * TAXA[plano] + excedentes * TAXA_ACIMA_DE_40[plano];
  return centavos(Math.max(soma, MINIMO[plano]));
}

/**
 * Quanto UMA criança a mais custa, a partir do tamanho atual.
 *
 * A tela usa isto para dizer *"esta fatura vem R$ 5,90 maior"* quando a
 * operação cresce. É derivado, e não uma constante, porque o número muda acima
 * da 40ª criança — e porque abaixo do mínimo ele é ZERO, que é uma informação
 * boa: quem tem 4 crianças pode pegar a quinta sem pagar nada a mais.
 */
export function custoDaProximaCrianca({ criancas, plano = PLANO.MENSAL } = {}) {
  const atual = precoDaTabela({ criancas, plano });
  if (atual === null) return null;
  const n = Math.max(0, Math.floor(Number(criancas) || 0));
  return centavos(precoDaTabela({ criancas: n + 1, plano }) - atual);
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
 */
export function descontoDeIndicacoes(indicacoesAtivas) {
  const n = Math.max(0, Math.floor(Number(indicacoesAtivas) || 0));
  return fracaoDeDesconto(n * DESCONTO_POR_INDICACAO);
}

/**
 * QUANTO A INDICAÇÃO DE NÚMERO `numero` TIRA DA CONTA, EM REAIS.
 *
 * ── ⚠️ POR QUE NÃO É `bruto × 5%`
 * Porque o piso existe. Para quem tem 8 crianças e 30% travado, a 6ª indicação
 * vale R$ 2,45 inteiros, **a 7ª vale R$ 0,60 e a 8ª vale zero** — a fatura já
 * está no piso e não desce mais. Publicar "cada colega vale R$ 2,45" para essa
 * pessoa é prometer três vezes o que ela vai receber, e a queixa que nasce
 * disso é a que a coleção `indicacoes` inteira existe para evitar.
 *
 * Então a conta é a DIFERENÇA real entre a fatura com `numero - 1` indicações
 * e com `numero`. O piso, o teto de 100% e o mínimo de tabela entram sozinhos,
 * porque quem responde é `precoDoMes`.
 *
 * ── QUEM CHAMA, E COM QUE NÚMERO
 * O aviso de ativação pergunta pela que ACABOU de valer (`ativas`); as telas
 * que convidam a indicar perguntam pela PRÓXIMA (`ativas + 1`). É a mesma
 * pergunta em dois instantes, e por isso é uma função só.
 *
 * Devolve `null` quando não há resposta possível — sem plano, plano
 * desconhecido — em vez de zero: "não sei" e "não vale nada" são coisas
 * diferentes na tela.
 */
export function valorDaIndicacao({
  criancas = 0,
  // ⚠️ SEM PADRÃO, ao contrário de `precoDoMes`. O padrão dela é `MENSAL`
  // porque a fatura do teste precisa de uma vitrine; aqui um padrão faria o
  // guarda abaixo nunca disparar — `plano` chegaria preenchido antes de
  // alguém perguntar se existe. Foi o que aconteceu na primeira versão desta
  // função: o guarda estava escrito e era inalcançável.
  plano = null,
  fundador = null,
  descontos = null,
  mes = null,
  numero = 1,
} = {}) {
  // ⚠️ SEM PLANO CONTRATADO A RESPOSTA É `null`, E O GUARDA PRECISA SER
  // EXPLÍCITO. `precoDoMes` tem `plano = PLANO.MENSAL` por padrão — de
  // propósito, porque a fatura do teste mostra o mensal como VITRINE. Sem
  // esta linha, quem está no teste receberia "a próxima indicação tira
  // R$ 5,90 por mês" de uma fatura que é isenta: ela não tira nada, e a
  // primeira coisa que a tela de indicar diria a ele seria falsa.
  if (!planoValido(plano)) return null;

  const n = Math.max(1, Math.floor(Number(numero) || 1));
  const base = { criancas, plano, fundador, descontos, mes };

  const antes = precoDoMes({ ...base, indicacoesAtivas: n - 1 });
  const depois = precoDoMes({ ...base, indicacoesAtivas: n });
  if (antes.liquido == null || depois.liquido == null) return null;

  return centavos(Math.max(0, antes.liquido - depois.liquido));
}

/**
 * Os descontos que ainda valem neste mês, somados por origem.
 *
 * Cada desconto é `{ origem, fracao, ate }`, com `ate` em 'AAAA-MM' — o último
 * mês em que ele vale, inclusive. Comparar texto de mês funciona porque o
 * formato é ordenável por construção; é a mesma escolha de `isentoEm`.
 *
 * ── ⚠️ `ate: null` É VITALÍCIO, E `ate` AUSENTE NÃO É
 * A distinção é estrita de propósito, e é a linha mais perigosa deste arquivo.
 *
 * O desconto de fechamento passou a ser permanente em 10/09/2026, e precisava
 * de um jeito de dizer "sem prazo". A escolha foi `ate: null` EXPLÍCITO, com
 * `undefined` (chave ausente) continuando a ser DESCARTADO — porque as duas
 * falhas possíveis não custam a mesma coisa:
 *
 *   - tratar ausente como vitalício → todo documento malformado ou legado vira
 *     desconto eterno, e a receita vaza em silêncio;
 *   - tratar null como vencido → o motorista perde um desconto prometido, que
 *     é a queixa que viaja mais rápido que a indicação.
 *
 * Escrever `ate: null` é um ato deliberado de quem grava; esquecer a chave não
 * é. Por isso `undefined` cai no ramo de descarte junto com string vazia e
 * qualquer coisa que não seja texto — sem isso, `m > String(undefined)` seria
 * `'2026-09' > 'undefined'`, que é FALSO (dígito ordena antes de letra), e o
 * desconto valeria para sempre por acidente de comparação.
 *
 * ── SEM MÊS DE REFERÊNCIA, NENHUM DESCONTO VALE
 * E antes valiam TODOS: a comparação é de texto, e `'' > '2026-09'` é `false`,
 * então com `mes` ausente nada era filtrado e todo desconto expirado voltava.
 * O padrão de `precoDoMes` é `mes = null`, então bastava um chamador esquecer o
 * parâmetro. Ausência de referência é ausência de resposta, nunca "vale tudo".
 */
export function descontosVigentes(descontos, mes) {
  const m = String(mes || '');
  const soma = { fechamento: 0, concessao: 0 };

  if (!m) return soma;

  (Array.isArray(descontos) ? descontos : []).forEach((d) => {
    if (!d) return;

    // Ver o cabeçalho: só `null` EXPLÍCITO é vitalício.
    const vitalicio = d.ate === null;
    if (!vitalicio) {
      if (typeof d.ate !== 'string' || !d.ate) return;
      if (m > d.ate) return;
    }

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
 * ── A ORDEM É MÍNIMO → DESCONTO → PISO, E CADA PASSO PROTEGE OUTRA COISA
 * O MÍNIMO é da tabela: diz o que a operação pequena custa antes de qualquer
 * concessão. O DESCONTO é o que foi prometido. O PISO impede que os descontos
 * empilhem até a fatura ficar irrisória.
 *
 * Inverter os dois extremos é o erro caro: com o mínimo depois do desconto, o
 * motorista de 10 crianças com 30% travado pagaria R$ 49 em vez de R$ 41,30 e
 * o desconto sumiria sem nenhuma linha explicando.
 *
 * ── O TETO DE 100% CONTINUA, E PROTEGE OUTRA COISA
 * Ele impede FATURA NEGATIVA (crédito saindo da plataforma para quem devia
 * estar pagando). O piso impede FATURA IRRISÓRIA. As duas travas são em série.
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
 */
export function precoDoMes({
  criancas = 0,
  plano = PLANO.MENSAL,
  fundador = null,
  indicacoesAtivas = 0,
  descontos = null,
  mes = null,
} = {}) {
  const bruto = precoDaTabela({ criancas, plano });

  if (bruto === null) {
    return {
      bruto: null,
      desconto: 0,
      descontoFundador: 0,
      descontoFechamento: 0,
      descontoIndicacao: 0,
      descontoConcessao: 0,
      liquido: null,
      pisoAplicado: false,
      descontoAbsorvido: 0,
      motivo: 'plano-desconhecido',
    };
  }

  const comPrazo = descontosVigentes(descontos, mes);
  const dFundador = descontoDoFundador(fundador);
  const dFechamento = comPrazo.fechamento;
  const dIndicacao = descontoDeIndicacoes(indicacoesAtivas);
  // A CONCESSÃO SOMA, não compete. Ela é exceção sobre a régua, não outra
  // régua: quem já tem 30% por ter fechado cedo e recebe 20% de concessão fica
  // com 50%. O teto de 100% abaixo continua sendo o que impede fatura negativa.
  const dConcessao = comPrazo.concessao;

  // Ver `FUNDADOR_E_FECHAMENTO_SOMAM`: por padrão vale o maior dos dois.
  const base = FUNDADOR_E_FECHAMENTO_SOMAM
    ? dFundador + dFechamento
    : Math.max(dFundador, dFechamento);

  const desconto = Math.min(1, fracaoDeDesconto(base + dIndicacao + dConcessao));
  const semPiso = centavos(bruto * (1 - desconto));

  // ⚠️ O PISO NUNCA SOBE ACIMA DO BRUTO. Nenhum mínimo de tabela é menor que
  // ele hoje, mas uma taxa de entrada futura poderia ser — e um piso que cobra
  // mais que a tabela é a plataforma cobrando a mais por uma trava de margem.
  const piso = Math.min(PISO_DA_FATURA, bruto);

  // ⚠️ O VITALÍCIO ESCAPA DO PISO, e é a única exceção. Ele é 100% sem prazo,
  // contratado quando o produto não tinha nenhum caso de uso; cobrar R$ 19 dele
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
