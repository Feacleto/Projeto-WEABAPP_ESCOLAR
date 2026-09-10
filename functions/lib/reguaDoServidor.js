/**
 * A RÉGUA DO SERVIDOR — dados e contas puras, SEM NENHUM `require`.
 *
 * ⚠️ ESTE ARQUIVO EXISTE PARA QUE A BATERIA DE TESTES CHEGUE AO FIM NO CI, E A
 * HISTÓRIA VALE SER LIDA ANTES DE MEXER.
 *
 * `scripts/testar-gateway.mjs` compara esta régua com a de
 * `src/dominio/associacao/planos.js` — faixa por faixa, degrau por degrau, e
 * dia por dia ao longo de 126 dias. É a proteção do espelho, e é boa.
 *
 * Só que ela importava de `contratacao.js`, e a primeira linha daquele arquivo
 * é `require('firebase-functions/v2/https')`. `firebase-functions` só existe em
 * `functions/node_modules`, que não é rastreado pelo git, e o CI roda **um**
 * `npm ci` na raiz. Medido num checkout simulado:
 * `node scripts/testar-gateway.mjs` morre com
 * `Cannot find module 'firebase-functions/v2/https'`, exit 1.
 *
 * E como `npm run testar` encadeia os scripts com `&&`, ele parava no 15º de
 * 26 — os **11 seguintes nunca rodavam no CI**: carteira, proposta, chamados,
 * risco, fila, concessao, selo, indicacao, origem, abas, transacoes.
 *
 * Ou seja: a aposta central deste projeto — regra pura provada por script Node
 * puro — estava com o fio cortado no meio, e nada acusava. Teste que não roda é
 * pior que teste nenhum, porque ocupa o lugar dele.
 *
 * ── A REGRA QUE ISTO ESTABELECE
 * **Módulo de `functions/lib/` que é RÉGUA não faz `require` de
 * `firebase-admin` nem de `firebase-functions`.** Quem precisa do SDK é o
 * `onCall`/`onSchedule`/`onRequest`, e ele mora noutro arquivo.
 *
 * Sete dos 21 módulos de `functions/lib/` já obedeciam por acidente — e são
 * exatamente os sete que os testes conseguem importar. `scripts/testar-imports.mjs`
 * transforma o acidente em regra: ele segue os imports de cada script da
 * bateria e falha se algum alcançar um módulo que requer o SDK.
 *
 * ── O QUE MORA AQUI
 * A taxa por criança, a escada de fechamento, o degrau de retorno e as contas
 * de data que decidem o degrau. Nada disto toca banco: recebe `agora` por
 * parâmetro, como o resto do domínio deste projeto.
 */

/**
 * A TAXA POR CRIANÇA, espelhada — SÓ OS DADOS E A CONTA, nada de banco.
 *
 * Era uma tabela de faixas até 10/09/2026, quando o preço virou LINEAR: uma
 * taxa por criança ativa, com um mínimo por fatura e uma taxa marginal acima
 * da 40ª. O motivo está no cabeçalho de `src/dominio/associacao/planos.js` —
 * na faixa, a criança da fronteira custava o preço de sete.
 *
 * `npm run testar:gateway` compara esta cópia com a do app criança por
 * criança, então divergir é teste vermelho e não descoberta numa fatura.
 */
const PLANO = { MENSAL: 'mensal', ANUAL: 'anual' };

const TAXA = { mensal: 5.9, anual: 2.9 };
const TAXA_ACIMA_DE_40 = { mensal: 4.9, anual: 2.4 };
const CRIANCAS_NA_TAXA_CHEIA = 40;
const MINIMO = { mensal: 49, anual: 29 };

function centavos(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function planoValido(plano) {
  return plano === PLANO.MENSAL || plano === PLANO.ANUAL;
}

/**
 * O preço de tabela, antes de qualquer desconto. Espelha `precoDaTabela`.
 *
 * ⚠️ A ORDEM É SOMA MARGINAL PRIMEIRO, MÍNIMO DEPOIS — o mínimo é um piso sobre
 * o TOTAL, não sobre a taxa de cada criança.
 */
function precoDaTabela(criancas, plano) {
  if (!planoValido(plano)) return null;
  const n = Math.max(0, Math.floor(Number(criancas) || 0));
  const cheias = Math.min(n, CRIANCAS_NA_TAXA_CHEIA);
  const excedentes = Math.max(0, n - CRIANCAS_NA_TAXA_CHEIA);
  const soma = cheias * TAXA[plano] + excedentes * TAXA_ACIMA_DE_40[plano];
  return centavos(Math.max(soma, MINIMO[plano]));
}

/**
 * A escada de fechamento, espelhada — SÓ OS DADOS, como a taxa acima.
 *
 * `npm run testar:gateway` compara esta cópia com `ESCADA_DE_FECHAMENTO` de
 * `src/dominio/associacao/planos.js` degrau por degrau. Divergir aqui é o
 * servidor gravando uma fração que a régua do app não reconhece — e a fatura
 * cobraria uma coisa enquanto o contrato assinado diria outra.
 */
const ESCADA = [
  { degrau: 1, fracao: 0.3 },
  { degrau: 2, fracao: 0.2 },
  { degrau: 3, fracao: 0.1 },
];

/** Quem deixou o teste vencer e volta em até 30 dias. */
const RETORNO = { fracao: 0.1, prazoDias: 30, degrau: 'retorno' };

/**
 * O contrato dura isto, e renova de 12 em 12. É o prazo da MULTA do anual.
 *
 * ⚠️ NÃO É MAIS O PRAZO DO DESCONTO. Desde 10/09/2026 o desconto de fechamento
 * é VITALÍCIO — `contratarPlano` grava `ate: null` — e o mês 13 deixou de
 * existir como problema. `mesDaqui` continua aqui porque a CONCESSÃO, que é
 * exceção e não régua, segue tendo prazo.
 */
const MESES_DE_CONTRATO = 12;

/** Cada degrau é um mês de teste: 90 dias divididos por 3. */
const DIAS_POR_DEGRAU = 30;

/** Os mesmos 90 dias de `dominio/associacao/trial.js`. */
const DIAS_DE_TRIAL = 90;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 'AAAA-MM' do ULTIMO mes em que um desconto de N meses ainda vale.
 *
 * O DIA VAI PARA 1 ANTES DE SOMAR, e isso nao e detalhe: `setMonth` preserva
 * o dia, e 31 nao existe em todo mes. Contratar em 31/03 com `setMonth(+12)`
 * produzia 31/02/2027, que o JavaScript normaliza para 03/03 — um mes a mais
 * de desconto, de graca, para sempre.
 *
 * E o `- 1` faz o prazo ser INCLUSIVO do mes corrente: 12 meses a partir de
 * setembro terminam em agosto do ano seguinte, nao em setembro. Sem ele o
 * desconto durava 13 meses — meia mensalidade extra por associado, silenciosa,
 * crescendo com a base.
 *
 * HOUVE UMA SEGUNDA COPIA, em `premioDeConversao.js`, e ela ja fazia certo —
 * as duas divergiam em um mes inteiro. Esse arquivo foi apagado em 07/09/2026
 * junto com a roleta, e sobrou esta. `npm run testar:gateway` continua
 * guardando a armadilha do `setMonth`, que e do JavaScript e nao da copia.
 */
function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora);
  d.setDate(1);
  d.setMonth(d.getMonth() + meses - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ate quando a conta fica destravada por ter CONTRATADO.
 *
 * Fim do mes seguinte, meio-dia. E a mesma regra de `assinaturaAteDoMes`: quem
 * fecha um acordo hoje opera ate a primeira fatura vencer e ser paga.
 *
 * SEM ISTO, CONTRATAR NAO DESTRAVAVA NADA. `estadoDaConta` e `isAdmin()`
 * consultam `assinaturaAte`, e so a baixa de fatura escrevia esse campo — o
 * motorista assinava o contrato e voltava para a tela dizendo pra contratar.
 * Beco sem saida depois de a pessoa ter decidido pagar.
 *
 * Meio-dia, e nao meia-noite: o processo das functions roda em UTC, e a data
 * construida a 00:00 volta um dia quando lida no fuso de Brasilia.
 */
function cobertoAteOMesSeguinte(agora = new Date()) {
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth() + 2, 0, 12, 0, 0);
}

/**
 * O teste ainda está correndo?
 *
 * Quem nunca rodou uma rota não tem `trialInicio` — e conta como DENTRO do
 * teste, porque o relógio dele nem começou. Recusar o desconto a essa pessoa
 * puniria justamente quem decidiu antes de precisar.
 */
function dentroDoTrial(trialInicio, agora) {
  const inicio = paraData(trialInicio);
  if (!inicio) return true;
  const passados = Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA);
  return passados < DIAS_DE_TRIAL;
}

/**
 * EM QUE DEGRAU DA ESCADA ELE ESTÁ — 1, 2, 3, 'retorno' ou null.
 *
 * `null` é "nenhum desconto", e é o caso de quem deixou os 90 dias e mais 30
 * passarem. Não existe quarto degrau: escada que premia quem esperou é
 * exatamente a lição que ela existe para não ensinar.
 *
 * ⚠️ SEM `trialInicio` O DEGRAU É 1, e não zero. Quem nunca rodou uma rota
 * ainda não gastou um dia do teste; ele é o mais antecipado de todos, e
 * cobrar-lhe o preço cheio puniria quem decidiu antes de precisar.
 *
 * ⚠️ O PISO DO DIA ZERO É EXPLÍCITO. Relógio de servidor atrasado em relação ao
 * do aparelho que gravou `trialInicio` produz dias NEGATIVOS, e
 * `floor(-1 / 30) + 1` daria degrau ZERO — nenhum desconto para quem acabou de
 * começar, que é o oposto do desenho.
 */
function degrauDaDecisao(trialInicio, agora = new Date()) {
  const inicio = paraData(trialInicio);
  if (!inicio) return 1;

  const passados = Math.max(
    0,
    Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA)
  );
  if (passados < DIAS_DE_TRIAL) {
    return Math.floor(passados / DIAS_POR_DEGRAU) + 1;
  }
  if (passados < DIAS_DE_TRIAL + RETORNO.prazoDias) return RETORNO.degrau;
  return null;
}

/** A fração daquele degrau. Espelha `descontoDoFechamento` do app. */
function descontoDoDegrau(degrau) {
  if (degrau === RETORNO.degrau) return RETORNO.fracao;
  const passo = ESCADA.find((e) => e.degrau === degrau);
  return passo ? passo.fracao : 0;
}

/**
 * ── A CONTA COMPLETA, ESPELHADA (10/09/2026) ────────────────────────────────
 *
 * ⚠️ ESTE É O SEGUNDO ESPELHO DESTE ARQUIVO, E ELE É MAIOR QUE O PRIMEIRO.
 *
 * Até aqui o servidor só precisava do PREÇO DE TABELA e da escada — quem
 * fechava a fatura era o cliente, em `services/taxaService.js`, com o dono
 * clicando "fechar todas". Isso deixava a peça central da conversão dependendo
 * de um clique: enquanto a fatura não nascia, o degrau da escada decaía no
 * relógio do servidor do mesmo jeito, e o motorista perdia 30% sem nunca ter
 * recebido um preço.
 *
 * Para o fechamento virar agendado, a conta inteira precisa existir aqui:
 * descontos, teto de 100%, piso e isenção. Duplicar aritmética é caro e este
 * projeto já pagou por isso duas vezes (a régua de preço em `contratacao.js` e
 * a escolha do indicado em `indicacao.js`), então a regra é a mesma das outras
 * duas: **a cópia só é aceitável com um teste que a compare caso a caso.**
 * `npm run testar:gateway` varre a matriz inteira — crianças × plano × fundador
 * × indicações × descontos — e falha na primeira divergência.
 *
 * O que NÃO foi espelhado: nada de banco, nada de `require`. Continua sendo
 * régua pura, e `npm run testar:imports` continua guardando isso.
 */

/** Espelha `FUNDADOR` de planos.js. */
const FUNDADOR = { VITALICIO: 'vitalicio', METADE: 'metade' };

/** Espelha `ORIGEM`. `roleta` continua fora, e é de propósito. */
const ORIGEM = {
  FECHAMENTO: 'fechamento',
  ANTECIPACAO: 'antecipacao',
  CONCESSAO: 'concessao',
};

const DESCONTO_POR_INDICACAO = 0.05;
const PISO_DA_FATURA = 19;

/** Quatro casas — ver o motivo em `planos.js`. */
function fracaoDeDesconto(v) {
  return Math.round((Number(v) || 0) * 10000) / 10000;
}

function descontoDoFundador(condicao) {
  if (condicao === FUNDADOR.VITALICIO) return 1;
  if (condicao === FUNDADOR.METADE) return 0.5;
  return 0;
}

function descontoDeIndicacoes(indicacoesAtivas) {
  const n = Math.max(0, Math.floor(Number(indicacoesAtivas) || 0));
  return fracaoDeDesconto(n * DESCONTO_POR_INDICACAO);
}

/**
 * ⚠️ `ate: null` É VITALÍCIO, E `ate` AUSENTE NÃO É — a mesma distinção
 * estrita do app, e pelo mesmo motivo: campo esquecido virando desconto eterno
 * vaza receita em silêncio, enquanto vitalício tratado como vencido tira do
 * motorista um desconto prometido. Escrever `null` é deliberado.
 */
function descontosVigentes(descontos, mes) {
  const m = String(mes || '');
  const soma = { fechamento: 0, concessao: 0 };
  if (!m) return soma;

  (Array.isArray(descontos) ? descontos : []).forEach((d) => {
    if (!d) return;
    const vitalicio = d.ate === null;
    if (!vitalicio) {
      if (typeof d.ate !== 'string' || !d.ate) return;
      if (m > d.ate) return;
    }
    const fracao = Math.max(0, Number(d.fracao) || 0);
    if (d.origem === ORIGEM.FECHAMENTO || d.origem === ORIGEM.ANTECIPACAO) {
      soma.fechamento += fracao;
    } else if (d.origem === ORIGEM.CONCESSAO) soma.concessao += fracao;
  });

  soma.fechamento = fracaoDeDesconto(soma.fechamento);
  soma.concessao = fracaoDeDesconto(soma.concessao);
  return soma;
}

/** Espelha `isentoEm`. 'AAAA-MM', inclusive. */
function isentoEm(isencaoAte, mes) {
  if (!isencaoAte) return false;
  return String(mes) <= String(isencaoAte);
}

/**
 * Em que mês do teste cai esta fatura — 1, 2, 3… ou `null` se já passou.
 *
 * Espelha `mesDeTesteDe` de `trial.js`. NÃO conta "de 3": o teste tem 90 dias
 * corridos e a fatura é por mês de calendário, então quem começa em 20/09
 * encosta em QUATRO meses. Quem diz o fim é a data.
 */
function mesDeTesteDe(trialInicio, mes) {
  const m = String(mes || '');
  if (!/^\d{4}-\d{2}$/.test(m)) return null;

  const d = paraData(trialInicio);
  if (!d) return 1;

  const [ano, mm] = m.split('-').map(Number);
  // Meio-dia: à meia-noite qualquer conversão de fuso troca o mês inteiro.
  const primeiroDia = new Date(ano, mm - 1, 1, 12, 0, 0, 0);
  const fim = new Date(d.getTime() + DIAS_DE_TRIAL * MS_POR_DIA);
  if (primeiroDia > fim) return null;

  const indice = (ano - d.getFullYear()) * 12 + (mm - 1 - d.getMonth()) + 1;
  return indice >= 1 ? indice : null;
}

/**
 * A conta fechada de um mês. Espelha `precoDoMes`.
 *
 * A ORDEM É MÍNIMO → DESCONTO → PISO, e inverter os extremos é o erro caro:
 * com o mínimo depois do desconto, quem tem 10 crianças e 30% travado pagaria
 * o mínimo em vez de R$ 41,30, e o desconto sumiria sem nenhuma linha.
 */
function precoDoMes({
  criancas = 0,
  plano = PLANO.MENSAL,
  fundador = null,
  indicacoesAtivas = 0,
  descontos = null,
  mes = null,
} = {}) {
  const bruto = precoDaTabela(criancas, plano);

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
  const dConcessao = comPrazo.concessao;

  // Vale o maior. A bandeira que escolhia entre somar e pegar o maior saiu
  // em 10/09/2026 por ser inerte — ver `planos.js`.
  const base = Math.max(dFundador, dFechamento);

  const desconto = Math.min(1, fracaoDeDesconto(base + dIndicacao + dConcessao));
  const semPiso = centavos(bruto * (1 - desconto));
  const piso = Math.min(PISO_DA_FATURA, bruto);
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
    pisoAplicado: liquido > semPiso,
    descontoAbsorvido: centavos(liquido - semPiso),
    motivo: null,
  };
}

/** O dia do vencimento, limitado a 28 — fevereiro não tem 30. */
function limitarDiaVencimento(dia) {
  const n = Math.trunc(Number(dia));
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(1, n), 28);
}

/** A data concreta de vencimento de um mês. Meio-dia, como o resto. */
function dataDeVencimento(mes, dia = 10) {
  const [ano, m] = String(mes).split('-').map(Number);
  if (!ano || !m) return null;
  return new Date(ano, m - 1, limitarDiaVencimento(dia), 12, 0, 0, 0);
}

/**
 * AS MARCAS DE LEGADO QUE UM MOTORISTA CARREGA — e por que isto virou régua.
 *
 * ── ⚠️ O PROBLEMA QUE ISTO SUBSTITUI
 * Quatro instrumentos de desconto descrevem casos que não existem mais:
 * `origem: 'antecipacao'` (o nome antigo do fechamento), `origem: 'roleta'`
 * (apagada, e que a régua JÁ não reconhece), `condicaoFundador: 'metade'` (as
 * doze vagas nunca concedidas) e `limiteCriancas` (a tranca que saiu).
 *
 * A pendência de conferir isso na base estava escrita no CLAUDE.md desde
 * 07/09/2026 e nunca foi conferida, porque dependia de alguém lembrar de
 * rodar um script. `scripts/varrer-descontos.cjs` continua existindo para a
 * conferência sob demanda — mas **pendência que depende de memória humana não
 * é pendência, é aposta.**
 *
 * ── POR QUE NO FECHAMENTO
 * A varredura mensal já lê TODO motorista, uma vez por mês, com o documento
 * inteiro em mãos. Detectar aqui não custa uma leitura a mais e não pode ser
 * esquecido: no dia 1 de cada mês, ou o log está limpo ou ele nomeia os uids.
 *
 * ── ⚠️ E ISTO NÃO APAGA NADA
 * Ele relata. As duas falhas de apagar cedo demais são silenciosas e caras:
 * quem tem `antecipacao` veria a fatura subir sem nenhuma linha explicando, e
 * quem tem `roleta` JÁ parou de receber o desconto sem ninguém ter avisado. A
 * decisão de mexer em desconto de alguém é de quem lê o relatório.
 */
function condicoesLegadas(motorista) {
  const m = motorista || {};
  const achados = [];

  if (m.condicaoFundador === FUNDADOR.METADE) achados.push('fundador:metade');
  if (m.limiteCriancas !== undefined && m.limiteCriancas !== null) {
    achados.push('limiteCriancas');
  }

  const descontos = Array.isArray(m.descontos) ? m.descontos : [];
  for (const d of descontos) {
    const origem = d && d.origem;
    if (!origem) continue;
    if (origem === ORIGEM.ANTECIPACAO) achados.push('desconto:antecipacao');
    // ⚠️ `roleta` é o caso GRAVE: `descontosVigentes` não a reconhece, então
    // ela já deixou de valer. Quem a tem está pagando mais do que foi
    // combinado, hoje, e ninguém foi avisado.
    else if (origem === 'roleta') achados.push('desconto:roleta (JÁ não vale)');
    else if (origem !== ORIGEM.FECHAMENTO && origem !== ORIGEM.CONCESSAO) {
      // Origem que a régua não conhece nunca valeu — o mesmo silêncio, por
      // um erro de digitação em vez de uma remoção.
      achados.push(`desconto:origem-desconhecida(${origem})`);
    }
  }

  return achados;
}

module.exports = {
  condicoesLegadas,
  PLANO,
  TAXA,
  TAXA_ACIMA_DE_40,
  CRIANCAS_NA_TAXA_CHEIA,
  MINIMO,
  centavos,
  planoValido,
  precoDaTabela,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  DIAS_POR_DEGRAU,
  DIAS_DE_TRIAL,
  paraData,
  mesDaqui,
  cobertoAteOMesSeguinte,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
  FUNDADOR,
  ORIGEM,
  DESCONTO_POR_INDICACAO,
  PISO_DA_FATURA,
  descontoDoFundador,
  descontoDeIndicacoes,
  descontosVigentes,
  isentoEm,
  mesDeTesteDe,
  precoDoMes,
  limitarDiaVencimento,
  dataDeVencimento,
};
