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
  DEV_CITY,
  DEV_EMAIL,
  DEV_PHONE_DISPLAY,
} from '../../config/developer.js';
import {
  MESES_DE_CONTRATO,
  centavos,
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
 *
 * Subir custa uma rodada de reassinatura, e custou zero aqui: nenhum contrato
 * tinha sido emitido.
 */
export const VERSAO_CONTRATO = 3;

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
  plano,
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
      cidade: DEV_CITY,
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
      id: plano?.id || null,
      rotulo: plano?.rotulo || '',
      // O TETO DE CRIANÇAS É A ÚNICA COISA QUE O PLANO CAPA. Não existe
      // Básico/Pro: mapa ao vivo, cobrança, agenda e relatório valem igual nas
      // três faixas. Está escrito aqui porque é a cláusula que o associado
      // precisa poder cobrar de volta.
      teto: plano?.ate ?? null,
      precoTabela: plano ? centavos(plano.preco) : null,
    },

    valores: {
      // A cobrança é mensal, sempre. O que dura doze meses é o ACORDO.
      periodicidade: 'mensal',
      valorMensal: conta.liquido,
      descontoTotal: conta.desconto,
      descontoFundador: conta.descontoFundador,
      descontoAntecipacao: conta.descontoAntecipacao,
      descontoIndicacao: conta.descontoIndicacao,
      descontoRoleta: conta.descontoRoleta,
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
      // Meses sem fatura (prêmio de roleta). Isenção não é desconto de 100%:
      // uma produz fatura de R$ 0, a outra diz que não há fatura.
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
