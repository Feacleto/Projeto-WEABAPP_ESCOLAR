/**
 * O ENCERRAMENTO DA ASSOCIAÇÃO — a saída, do lado do motorista.
 *
 * ── ⚠️ ISTO NÃO É FUNCIONALIDADE NOVA: É UMA CLÁUSULA ASSINADA SENDO CUMPRIDA
 * A cláusula 6 do contrato diz, com estas palavras: *"O ASSOCIADO pode
 * encerrar a qualquer momento, sem aviso prévio e sem multa, **pelo próprio
 * aplicativo**. Não há nova cobrança a partir do encerramento, e ele opera até
 * o fim do período já pago."*
 *
 * O botão não existia. É o mesmo defeito do consentimento de geolocalização —
 * o documento oferecia uma revogação que o app não tinha — e do "esqueci a
 * senha" que dependia de um campo do console: **promessa escrita sem caminho
 * no produto**. Aqui ela é mais cara, porque é a cláusula que a pessoa procura
 * no minuto em que já decidiu ir embora, e não achar vira reclamação onde ela
 * doer mais.
 *
 * ── UM CAMPO SÓ, E ELE É DO MOTORISTA
 * `users.renovacaoAutomatica`. **Ausente significa LIGADA** — pela mesma razão
 * da janela do desconto e da chave de compartilhar a posição: base antiga não
 * tem o campo, e tratar o silêncio como "desligada" encerraria a associação de
 * todo mundo sem ninguém ter pedido nada. Só o `false` explícito encerra.
 *
 * ⚠️ **CANCELAR E "DESLIGAR A RENOVAÇÃO" SÃO A MESMA COISA NO MENSAL**, e foi
 * isso que dispensou um segundo mecanismo. A cláusula 6 já define encerrar
 * como *não gerar nova cobrança e operar até o fim do período pago* — que é,
 * palavra por palavra, desligar a renovação. Dois botões para um efeito só
 * produziriam duas verdades sobre a mesma data.
 *
 * No ANUAL eles se separam, porque existe um compromisso de doze meses no
 * meio: `MODO.FIM_DO_PERIODO` cumpre o prazo e não renova (sem multa);
 * `MODO.AGORA` sai antes (e aí a multa de `multa.js` é devida).
 *
 * ── ⚠️ NADA AQUI ESCREVE, E O SERVIDOR NÃO PRECISA CARIMBAR NADA
 * O primeiro desenho clareava `users.plano` e gravava um `associacaoEncerradaEm`
 * no fechamento. Foi descartado por criar uma janela em que o campo já dizia
 * "encerrada" e a cobertura ainda corria: quem religasse ali perderia o
 * desconto vitalício depois de a tela ter prometido que religar não custa
 * nada. Além disso `plano` é proibido ao cliente, então desfazer exigiria uma
 * function só para desfazer.
 *
 * Com a intenção num campo só, **a mesma régua responde a todo mundo**: o
 * fechamento pergunta se ainda fatura, a tela pergunta quando acaba, o funil
 * pergunta se ainda é cliente, e `contratarPlano` pergunta se o desconto
 * atravessa. E religar é o próprio motorista escrevendo `true` de volta —
 * desfazer perfeito, sem servidor no meio.
 *
 * ⚠️ **O ACESSO NÃO É CORTADO POR NINGUÉM.** Quem decide se o app abre é
 * `assinaturaAte`, e as rules já negam quem está sem assinatura válida. Sem
 * fatura nova, a cobertura expira sozinha na data certa — exatamente o "opera
 * até o fim do período já pago" da cláusula. Código que "desliga" alguém seria
 * uma segunda régua de acesso, e a primeira já está nas rules.
 *
 * ── OS AVISOS SÃO FAIXAS, NÃO DATAS
 * Três, como no trial e pelo mesmo motivo: cinco avisos em vinte dias ensinam
 * a pular aviso. A urgência é comunicada pela FORMA — linha, cartão âmbar,
 * tela — nunca por repetição.
 *
 * ⚠️ E eles são de espécie `estado`, **nunca `prazo`**. Prazo é desligável, e
 * um aviso desligável sobre a conta parar de funcionar significaria a
 * associação terminando em silêncio para quem justamente pediu menos ruído.
 *
 * ESTE ARQUIVO NÃO TOCA FIREBASE NEM REACT. `npm run testar:encerramento`.
 */

import { PLANO, MESES_DE_CONTRATO } from './planos.js';

/** Como ele quer sair. Só o ANUAL usa os dois — no mensal não há compromisso. */
export const MODO = {
  /** Cumpre o prazo e não renova. Sem multa, sempre. */
  FIM_DO_PERIODO: 'fim_do_periodo',
  /** Sai antes do fim do compromisso. No anual, a multa é devida. */
  AGORA: 'agora',
};

/**
 * As faixas do aviso, em dias até o fim.
 *
 * 30 é a mesma abertura do trial e do alvará — é o intervalo em que um
 * autônomo ainda consegue mudar de ideia sem atropelar o mês. 7 é a véspera
 * útil: tempo de avisar as famílias dele, que é o que ele vai precisar fazer.
 */
export const FAIXA_AVISO = 30;
export const FAIXA_URGENTE = 7;

const MS_POR_DIA = 86400000;

/** Aceita Date, Timestamp do Firestore, número e string. Gêmea da de `multa.js`. */
function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * A renovação está ligada?
 *
 * ⚠️ AUSENTE É LIGADA, e isso é decisão, não conveniência. Ver o cabeçalho.
 */
export function renovacaoLigada(motorista) {
  return motorista?.renovacaoAutomatica !== false;
}

/** Ele pediu para encerrar? É a pergunta inversa, e ela aparece muito na tela. */
export function pediuEncerramento(motorista) {
  return !renovacaoLigada(motorista);
}

/**
 * O modo pedido. Fora do anual ele não significa nada: sem compromisso, não
 * existe "esperar o fim do compromisso", e sair nunca custa nada.
 *
 * ⚠️ NO ANUAL O PADRÃO É CUMPRIR O PRAZO, e o critério é qual erro custa
 * dinheiro a ele. Quem desliga a renovação sem escolher modo — por um campo
 * que não chegou, por uma tela antiga, por um `false` escrito à mão — cai na
 * saída SEM multa. O contrário faria uma ausência de dado virar cobrança, e
 * cobrança que nasce de campo faltando é a que ninguém consegue explicar
 * depois. `MODO.AGORA` exige o gesto explícito porque é o que custa.
 */
export function modoDoPedido(motorista) {
  if (motorista?.plano !== PLANO.ANUAL) return MODO.AGORA;
  return motorista?.encerramentoModo === MODO.AGORA
    ? MODO.AGORA
    : MODO.FIM_DO_PERIODO;
}

/** O fim do período JÁ PAGO — é `assinaturaAte`, e é o que a cláusula 6 promete. */
export function fimDoPeriodoPago(motorista) {
  return paraData(motorista?.assinaturaAte);
}

/**
 * O fim do compromisso de doze meses, contado de `contratadoEm`.
 *
 * ⚠️ Sai de `users`, e não do documento do contrato, de propósito: a tela roda
 * no celular do motorista, que lê o próprio doc a cada sessão. Buscar
 * `contratosAssociacao` para descobrir uma data que `contratadoEm` já dá seria
 * uma leitura a mais para responder a mesma pergunta — e uma segunda verdade
 * sobre quando a vigência começou.
 */
export function fimDoCompromisso(motorista, mesesDeContrato = MESES_DE_CONTRATO) {
  if (motorista?.plano !== PLANO.ANUAL) return null;
  const inicio = paraData(motorista?.contratadoEm);
  if (!inicio) return null;
  const fim = new Date(inicio.getTime());
  fim.setMonth(fim.getMonth() + mesesDeContrato);
  return fim;
}

/**
 * QUANDO A CONTA DELE PARA. `null` = não pediu, ou não dá para saber.
 *
 * ⚠️ O ANUAL QUE ESPERA O PRAZO PARA NO FIM DO COMPROMISSO, e não no fim do
 * mês pago: ele continua pagando mensalmente até lá. Devolver a data do mês
 * faria a tela anunciar um fim que chegaria e não aconteceria — e a fatura
 * seguinte, que ele ainda deve, viraria cobrança "depois do cancelamento".
 */
export function fimDaAssociacao(motorista) {
  if (!pediuEncerramento(motorista)) return null;
  if (modoDoPedido(motorista) === MODO.FIM_DO_PERIODO) {
    return fimDoCompromisso(motorista) || fimDoPeriodoPago(motorista);
  }
  return fimDoPeriodoPago(motorista);
}

/** Quantos dias faltam. Negativo = já passou. `null` sem data. */
export function diasAteOFim(motorista, agora = new Date()) {
  const fim = fimDaAssociacao(motorista);
  const hoje = paraData(agora);
  if (!fim || !hoje) return null;
  return Math.ceil((fim.getTime() - hoje.getTime()) / MS_POR_DIA);
}

/** Já acabou de verdade? */
export function associacaoEncerrada(motorista, agora = new Date()) {
  const dias = diasAteOFim(motorista, agora);
  return dias !== null && dias <= 0;
}

/**
 * ELE AINDA PODE VOLTAR ATRÁS?
 *
 * Sim, enquanto a data não chegou — e a tela PROMETE isso com estas palavras:
 * *"religou antes da data, não perdeu nada"*. É por isso que nada é apagado
 * no caminho: a promessa só é verdade porque o desfazer é um campo voltando a
 * `true`, sem nenhum efeito colateral para desfazer junto.
 */
export function podeReligar(motorista, agora = new Date()) {
  return pediuEncerramento(motorista) && !associacaoEncerrada(motorista, agora);
}

/**
 * O FECHAMENTO AINDA EMITE FATURA PARA ELE?
 *
 * ⚠️ É A ÚNICA PERGUNTA QUE MEXE EM DINHEIRO, e ela tem espelho no servidor
 * (`functions/lib/reguaDoEncerramento.js`), comparado caso a caso — o deploy
 * das functions não alcança `src/`.
 *
 * A cláusula 6 diz "não há nova cobrança a partir do encerramento", então quem
 * pediu para sair para de ser faturado na varredura seguinte. O ANUAL que
 * escolheu cumprir o prazo é a exceção: ele continua devendo as mensalidades
 * do compromisso, e parar de faturar ali seria dar meia dúzia de meses de
 * graça a quem só avisou que não renova.
 *
 * ⚠️ **ATRASO NÃO ENTRA AQUI.** Quem deve continua sendo faturado e continua
 * devendo; a fatura já emitida não some porque ele pediu para sair. Encerrar é
 * sobre o futuro — é a mesma distinção que separa suspensão de encerramento.
 */
export function pararDeFaturar(motorista, agora = new Date()) {
  if (!pediuEncerramento(motorista)) return false;
  if (modoDoPedido(motorista) === MODO.FIM_DO_PERIODO) {
    const fim = fimDoCompromisso(motorista);
    const hoje = paraData(agora);
    if (fim && hoje && hoje < fim) return false;
  }
  return true;
}

/**
 * O DESCONTO DE FECHAMENTO ATRAVESSA?
 *
 * A regra que o contrato passou a escrever na versão 6: *"sem prazo enquanto
 * este contrato estiver vigente"*. Renovou, mantém; encerrou, acabou.
 *
 * ⚠️ **ATRASO NÃO DERRUBA, SAIR DERRUBA** — o mesmo critério do desconto de
 * indicação, e pelo mesmo motivo. Quem atrasa uma fatura, paga e volta nunca
 * passou por aqui: `renovacaoAutomatica` continua `true`, porque ninguém a
 * desligou. Só o gesto explícito de encerrar derruba, e só depois que a data
 * chegou — antes disso ele ainda pode religar.
 */
export function descontoAtravessa(motorista, agora = new Date()) {
  return !associacaoEncerrada(motorista, agora);
}

/**
 * O AVISO DE HOJE — `{ nivel, dias, fim }` ou `null`.
 *
 * `encerrada` é o único que não tem volta pela tela; os outros três existem
 * para que a data nunca chegue como surpresa. Ver as faixas no topo.
 */
export function avisoDoEncerramento(motorista, agora = new Date()) {
  if (!pediuEncerramento(motorista)) return null;
  const dias = diasAteOFim(motorista, agora);
  const fim = fimDaAssociacao(motorista);

  // Pediu, e não dá para calcular a data (sem `assinaturaAte`, por exemplo).
  // O aviso continua saindo: o que não pode é ele não saber que pediu.
  if (dias === null) return { nivel: 'pedido', dias: null, fim: null };

  if (dias <= 0) return { nivel: 'encerrada', dias, fim };
  if (dias <= FAIXA_URGENTE) return { nivel: 'urgente', dias, fim };
  if (dias <= FAIXA_AVISO) return { nivel: 'aviso', dias, fim };
  return { nivel: 'pedido', dias, fim };
}
