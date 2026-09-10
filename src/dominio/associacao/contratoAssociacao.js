/**
 * O CONTEÚDO DO CONTRATO DE ASSOCIAÇÃO — aritmética e texto, sem Firebase.
 *
 * POR QUE ISTO É PURO
 * Este objeto é o que o associado assina: ele vira o hash SHA-256 que prova o
 * que foi aceito. E ele já saiu ERRADO duas vezes, pela mesma razão de forma —
 * a função era pura, morava atrás de um `import { db }`, e este projeto testa
 * com scripts Node puros: o script não conseguia nem importar o módulo.
 *
 *   1. `montarContrato` lia `base.mensalidadeMedia`, nome que ninguém produzia.
 *   2. Com periodicidade mensal e qualquer carência, os meses cobrados davam
 *      ZERO — e o contrato era hasheado e aceito por R$ 0,00 durante doze
 *      meses.
 *
 * As duas vinham do mesmo lugar: o contrato era montado a partir de uma
 * NEGOCIAÇÃO com percentual, base de crianças, periodicidade e carência. Eram
 * cinco números negociáveis se combinando, e cada combinação era um caminho
 * que ninguém tinha percorrido.
 *
 * ── AGORA ELE SAI DE UM PLANO, E É POR ISSO QUE ENCOLHEU (06/09/2026)
 * O modelo negociado morreu. O preço é de tabela, o contrato é de doze meses
 * para todo mundo, e a cobrança é mensal. Não há periodicidade a escolher, não
 * há percentual sobre base, não há carência a descontar do período — sobrou
 * uma faixa, os descontos que a pessoa tem, e a data.
 *
 * Isso não é só menos código: é menos superfície de erro. Os dois bugs acima
 * eram aritmética de combinação, e a combinação deixou de existir.
 *
 * ── O QUE ELE IMPORTA
 * Só constantes e regras puras: os dados da contratada e a régua de preço.
 * Nada que toque Firebase. Se precisar de dado do banco, receba por parâmetro.
 */

// A EXTENSÃO `.js` É EXPLÍCITA AQUI, E NÃO É DESCUIDO.
//
// O resto do app importa sem extensão porque o Vite resolve. O Node não — e o
// Node é quem roda `scripts/testar-contrato.mjs`. Sem a extensão, o teste
// morre em ERR_MODULE_NOT_FOUND antes da primeira asserção, e este arquivo
// volta a ser exatamente o que ele deixou de ser: intestável.
import {
  DEV_NAME,
  DEV_CNPJ,
  DEV_CIDADE_UF,
  DEV_ENDERECO,
  DEV_EMAIL,
  DEV_PHONE_DISPLAY,
} from '../../config/developer.js';
import {
  MESES_DE_CONTRATO,
  PISO_DA_FATURA,
  PLANO,
  TAXA,
  TAXA_ACIMA_DE_40,
  CRIANCAS_NA_TAXA_CHEIA,
  MINIMO,
  planoValido,
  limitarDiaVencimento,
  precoDoMes,
} from './planos.js';

/**
 * Versão do texto das cláusulas. Subir aqui exige novo aceite.
 *
 * 1 — mandava suspender por atraso sem definir atraso.
 * 2 — passou a dizer QUANDO a taxa vence.
 * 3 — o preço virou de TABELA. Saíram percentual sobre mensalidade, base de
 *     crianças, periodicidade e carência; entraram a faixa contratada, o teto
 *     de crianças que ela dá e os descontos com prazo de validade.
 * 4 — a ESCADA DE FECHAMENTO substituiu a antecipação (50% em qualquer dia do
 *     teste virou 50/30/15 pelo mês da decisão), o PISO DE FATURA entrou como
 *     cláusula, o teto percentual da indicação saiu, e a roleta foi apagada.
 *     Entrou também a saída livre nos primeiros 30 dias pagos.
 *
 * ⚠️ A 4 precisa do piso ESCRITO, não só aplicado. Sem a cláusula, um associado
 * com 100% de desconto nominal recebe fatura de R$ 34 e o contrato não
 * consegue justificar de onde ela veio — que é a mesma contradição que o
 * `npm run testar:contrato` pega desde a concessão.
 *
 * Subir custa uma rodada de reassinatura.
 */
export const VERSAO_CONTRATO = 5;

/** Janela padrão para avisar que a vigência está acabando. */
export const JANELA_DE_RENOVACAO = 60;

/**
 * Soma meses preservando o dia — e recuando quando o dia não existe no destino.
 *
 * ⚠️ `setMonth` sozinho TRANSBORDA: 31/03 + 12 meses vira 31/03/2028? Não —
 * vira 31 de fevereiro, que o JavaScript normaliza para 02/03. A vigência de
 * um contrato assinado saía dois dias mais longa, e o hash provava isso.
 *
 * Aqui o dia importa (é uma data de vigência, não um mês de referência), então
 * a saída é grampear no último dia do mês de destino em vez de normalizar
 * para 1 como `mesDaqui` faz.
 */
function somaMeses(data, n) {
  const d = new Date(data);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  return d;
}

/** 'AAAA-MM' de uma data. É o formato que fatura e desconto já usam. */
function mesDe(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monta o conteúdo do contrato.
 *
 * Devolve um objeto puro — nada de JSX. É o mesmo dado que a tela renderiza e
 * que entra no hash: se a tela montasse o texto por conta própria, o hash
 * provaria um conteúdo e a pessoa teria lido outro.
 *
 * ── O CONTRATO CONGELA O QUE FOI COMBINADO, E ISSO É O TRABALHO DELE
 * Preço, teto de crianças, dia de vencimento e a validade de cada desconto
 * viajam DENTRO do objeto — nunca como ponteiro para a régua da casa. Um
 * contrato que dissesse "custa o que a tabela disser" e "vence no dia que a
 * plataforma escolher" não prometeria nada, e é justamente sobre isso que uma
 * conversa de cobrança acontece seis meses depois.
 *
 * ── DESCONTO SEM PRAZO SERIA PREÇO
 * Cada desconto entra com o mês em que acaba. Sem isso, o desconto de
 * conversão vira a tabela nova daquele associado — e a receita prevista deixa
 * de bater com a real para sempre, sem ninguém conseguir apontar quando mudou.
 */
export function montarContrato({
  motorista,
  plano = PLANO.MENSAL,
  criancas = 0,
  fundador = null,
  indicacoesAtivas = 0,
  descontos = null,
  diaVencimento,
  isencaoAte = null,
  agora = new Date(),
}) {
  const inicio = new Date(agora);
  const fim = somaMeses(inicio, MESES_DE_CONTRATO);

  // O preço é calculado para o PRIMEIRO mês da vigência. Ele não muda por
  // conta da régua depois — o que muda é a validade dos descontos, que está
  // escrita no próprio contrato.
  const conta = precoDoMes({
    criancas,
    plano,
    fundador,
    indicacoesAtivas,
    descontos,
    mes: mesDe(inicio),
  });

  return {
    versao: VERSAO_CONTRATO,
    emitidoEm: inicio.toISOString(),
    vigenciaInicio: inicio.toISOString(),
    vigenciaFim: fim.toISOString(),
    vigenciaMeses: MESES_DE_CONTRATO,

    contratada: {
      razao: DEV_NAME,
      cnpj: DEV_CNPJ,
      // ⚠️ `DEV_CIDADE_UF`, NÃO `DEV_CITY`. A segunda é de exibição e traz um
      // separador visual ('Socorro · São Paulo, SP') — num documento que
      // qualifica as partes, isso não é o nome de uma comarca. Os Termos
      // passaram a usar a mesma forma, e é ela que a cláusula de foro cita.
      cidade: DEV_CIDADE_UF,
      endereco: DEV_ENDERECO,
      email: DEV_EMAIL,
      telefone: DEV_PHONE_DISPLAY,
    },
    associado: {
      uid: motorista?.uid || '',
      nome: motorista?.name || '',
      cidade: motorista?.city || '',
      email: motorista?.email || '',
      telefone: motorista?.phone || '',
    },

    plano: {
      id: planoValido(plano) ? plano : null,
      rotulo: plano === PLANO.ANUAL ? 'Anual' : 'Mensal',
      // ⚠️ O QUE O CONTRATO DECLARA É A TAXA, NÃO UM VALOR.
      //
      // Até a versão 4 ele congelava o preço da FAIXA contratada, e o efeito
      // colateral era pesado: crescer de faixa exigia emitir contrato novo, com
      // aceite novo, por ter ganhado uma criança. O documento virava burocracia
      // no pior momento possível — logo depois de o motorista fechar um cliente.
      //
      // Declarando a taxa, a mesma cláusula continua verdadeira em qualquer
      // tamanho, e o que muda de mês para mês é uma multiplicação que o próprio
      // associado consegue conferir. É o que elimina a reassinatura por
      // crescimento sem afrouxar nada: a regra está escrita, só o número da
      // multiplicação é que acompanha a operação dele.
      taxaPorCrianca: TAXA[plano] ?? null,
      taxaAcimaDe40: TAXA_ACIMA_DE_40[plano] ?? null,
      criancasNaTaxaCheia: CRIANCAS_NA_TAXA_CHEIA,
      minimoMensal: MINIMO[plano] ?? null,

      // ⚠️ ISTO É EXEMPLO, NÃO CLÁUSULA — e o rótulo importa.
      //
      // O tamanho da operação no dia da assinatura, e a conta que ele produz.
      // Serve para o associado ver o número concreto que a taxa gera hoje; ele
      // NÃO congela nada, porque a fatura segue o tamanho real do mês. Um
      // documento que apresentasse este valor como o preço acordado
      // contradiria a primeira fatura em que ele cadastrasse uma criança.
      criancasNaAssinatura: Math.max(0, Math.floor(Number(criancas) || 0)),
      precoTabela: conta.bruto,

      // ⚠️ NÃO HÁ MAIS TETO DE CRIANÇAS. `limiteCriancas` era a única coisa que
      // o plano capava, e ele saiu junto com as faixas: nada trava quando a
      // operação cresce. Deixar o campo aqui com `null` seria pior que
      // removê-lo — um teto nulo se lê como "sem limite acordado" em vez de
      // "não existe teto neste modelo".
    },

    valores: {
      // A cobrança é mensal, sempre. O que dura doze meses é o ACORDO.
      periodicidade: 'mensal',
      // O valor DO MÊS DA ASSINATURA. Ver `plano.criancasNaAssinatura`: é
      // exemplo da taxa aplicada hoje, e a fatura acompanha o tamanho real.
      valorMensal: conta.liquido,
      descontoTotal: conta.desconto,
      descontoFundador: conta.descontoFundador,
      descontoFechamento: conta.descontoFechamento,
      descontoIndicacao: conta.descontoIndicacao,
      // ⚠️ A CONCESSÃO ENTRA COMO QUALQUER OUTRO DESCONTO, e ela FALTAVA aqui.
      //
      // `conta.liquido` já a descontava (ela vive em `users.descontos`), e
      // `descontoTotal` já a somava — mas nenhuma linha a explicava. O contrato
      // saía se contradizendo: o valor mensal menor que a soma das linhas
      // conseguia justificar, num documento com valor probatório, assinado com
      // hash e data.
      //
      // O teste que pega isso não é "a concessão aparece": é a soma das linhas
      // fechar com o total (`npm run testar:contrato`). Ele vale para o
      // próximo desconto que alguém inventar.
      descontoConcessao: conta.descontoConcessao,
      // Cada desconto com a data em que ele acaba — ver o cabeçalho.
      descontos: Array.isArray(descontos) ? descontos : [],

      // ⚠️ O PISO É CLÁUSULA, E POR ISSO ELE VAI ESCRITO AQUI.
      //
      // Sem estas três linhas o documento se contradiz de um jeito novo: o
      // desconto total pode dizer 100% e o valor mensal dizer R$ 34, e nenhuma
      // linha explica a diferença. É a MESMA falha da concessão — o valor
      // sabia de algo que o texto não contava —, só que pelo outro lado da
      // conta: lá faltava desconto, aqui falta o limite do desconto.
      //
      // `pisoDaFatura` vai SEMPRE, aplicado ou não: é a regra que o associado
      // precisa poder cobrar de volta, e uma cláusula que só aparece quando
      // pesa contra ele é uma cláusula que ele descobre na fatura.
      pisoDaFatura: PISO_DA_FATURA,
      pisoAplicado: conta.pisoAplicado,
      descontoAbsorvido: conta.descontoAbsorvido,

      // Meses sem fatura (concessão de isenção). Isenção não é desconto de
      // 100%: uma produz fatura de R$ 0, a outra diz que não há fatura. E ela
      // passa por cima do piso — ver PISO_DA_FATURA.
      isencaoAte: isencaoAte || null,
      diaVencimento: limitarDiaVencimento(diaVencimento),
    },
  };
}

/**
 * Quantos dias faltam pro fim da vigência. Negativo = já venceu.
 *
 * Vencer NÃO suspende ninguém, e isso é decisão: cortar por vencimento de
 * papel suspenderia quem está pagando em dia. Suspensão continua sendo coisa
 * de inadimplência. O que o vencimento faz é entrar na fila de renovação.
 */
export function diasParaVencer(contrato, agora = new Date()) {
  const fim = contrato?.conteudo?.vigenciaFim;
  if (!fim) return null;
  return Math.ceil((new Date(fim) - new Date(agora)) / 86400000);
}

/** Está na janela de renovação? */
export function precisaRenovar(contrato, janelaDias = JANELA_DE_RENOVACAO, agora = new Date()) {
  const d = diasParaVencer(contrato, agora);
  return d !== null && d <= janelaDias;
}
