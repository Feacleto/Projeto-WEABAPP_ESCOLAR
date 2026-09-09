/**
 * O QUE CADA EVENTO DO GATEWAY FAZ COM A FATURA.
 *
 * POR QUE ELA MORA EM functions/lib E NÃO EM src/dominio
 * Esta função decide se um motorista está pago ou devendo. Ela roda num
 * endpoint público, disparada por um sistema de fora, sobre eventos que
 * chegam fora de ordem e repetidos. É o pedaço mais difícil de testar em
 * produção e o mais caro de errar — então ele mora aqui, sem rede, e é o
 * `npm run testar:cobranca` que o prova.
 *
 * ── A DECISÃO CENTRAL: LIBERA NO `CONFIRMED`, NÃO NO `RECEIVED`
 * O Asaas separa os dois, e a diferença está na descrição dele:
 *
 *   PAYMENT_CONFIRMED  pagamento efetuado, saldo AINDA NÃO disponibilizado
 *   PAYMENT_RECEIVED   cobrança recebida, dinheiro na conta
 *
 * Esperar o `RECEIVED` significa o motorista pagar e continuar bloqueado por
 * um ou dois dias úteis, com vinte famílias esperando a perua. O risco que
 * sobra é o pagamento ser desfeito depois — e é justamente para isso que os
 * eventos de estorno e chargeback existem e são tratados abaixo.
 *
 * Quem paga tem o acesso de volta na hora. Quem estorna perde de novo.
 *
 * ── VENCIMENTO NÃO DESFAZ PAGAMENTO
 * `PAYMENT_OVERDUE` sobre uma fatura JÁ QUITADA é ignorado, e essa linha vale
 * mais que parece. Eventos chegam fora de ordem: um `OVERDUE` gerado às 00:00
 * pode ser entregue depois do `CONFIRMED` das 08:00 se a fila do gateway
 * atrasar. Sem esta guarda, o motorista pagaria e seria bloqueado em seguida
 * por um evento velho.
 *
 * ── O DESCONHECIDO NÃO MEXE EM NADA
 * O gateway acrescenta eventos com o tempo. Evento que este arquivo não
 * conhece devolve `null` — nenhuma mudança — em vez de cair num `default` que
 * adivinha. Fatura é dinheiro: na dúvida, não mexe.
 *
 * ── IDEMPOTÊNCIA VEM DA FORMA, NÃO DE UM CONTADOR
 * O gateway repete o webhook quando não recebe confirmação, então o mesmo
 * evento chega duas ou três vezes. Aqui a resposta é sempre um ESTADO
 * ABSOLUTO ('quitada' / 'aberta'), nunca um passo relativo — aplicar duas
 * vezes dá no mesmo. É a mesma escolha do `rides`, cujo id é a data.
 */

/** Pago: o motorista volta a operar. */
const QUITADA = 'quitada';
/** Devendo: volta a contar atraso. */
const ABERTA = 'aberta';

/**
 * Os eventos que a plataforma assina. Assinar menos é o que o próprio painel
 * do gateway recomenda — cada evento a mais é uma chamada a mais no endpoint
 * público, e nenhum destes é decorativo.
 */
const EVENTOS_ASSINADOS = [
  // Libera
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  // Volta a dever
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_DELETED',
  // Marca o atraso
  'PAYMENT_OVERDUE',
];

const LIBERA = {
  PAYMENT_CONFIRMED: 'pagamento confirmado',
  PAYMENT_RECEIVED: 'pagamento recebido',
};

const REABRE = {
  PAYMENT_REFUNDED: 'cobrança estornada',
  // Estorno PARCIAL também reabre: a fatura não foi paga por inteiro, e
  // "quitada pela metade" não é um estado que a cobrança deste projeto tenha.
  PAYMENT_PARTIALLY_REFUNDED: 'cobrança estornada em parte',
  PAYMENT_CHARGEBACK_REQUESTED: 'chargeback aberto',
  PAYMENT_RECEIVED_IN_CASH_UNDONE: 'recebimento em dinheiro desfeito',
  PAYMENT_DELETED: 'cobrança removida no gateway',
};

/**
 * O efeito de um evento sobre uma fatura.
 *
 *   { status: 'quitada', motivo }  dá baixa
 *   { status: 'aberta',  motivo }  reabre
 *   { status: null,      motivo }  não mexe — e é a resposta mais comum
 *
 * `statusAtual` entra porque duas decisões dependem dele: o vencimento não
 * desfaz pagamento, e reabrir uma fatura que já está aberta não é uma
 * mudança. Quem chama não precisa saber disso; precisa só aplicar o que sai.
 *
 * `quitadaPorPessoa` entra por um terceiro motivo — ver o bloco do
 * `PAYMENT_DELETED`, abaixo. É `true` quando a fatura foi baixada À MÃO pelo
 * dono, e não pelo gateway.
 */
function efeitoDoEvento(evento, statusAtual = null, quitadaPorPessoa = false) {
  const nome = String(evento || '').trim().toUpperCase();

  // ⚠️ APAGAR A COBRANÇA NO GATEWAY NÃO DESFAZ UM PAGAMENTO FEITO POR FORA.
  //
  // `PAYMENT_DELETED` está em `REABRE`, e com razão: cobrança removida deixa
  // de ter como ser paga. Mas há um caminho em que ele chega sobre uma fatura
  // que JÁ FOI PAGA — e é o caminho natural, não a exceção:
  //
  //   1. o motorista paga o PIX direto da plataforma;
  //   2. o dono dá baixa à mão na aba Mês;
  //   3. o dono abre o painel do Asaas e apaga a cobrança redundante,
  //      que é a limpeza que qualquer pessoa faria;
  //   4. chega `PAYMENT_DELETED`, a fatura volta para `aberta`.
  //
  // A partir daí `estadoDaConta` avalia o ATRASO antes da assinatura, com
  // tolerância de dez dias — então dez dias depois o motorista que pagou é
  // bloqueado, com o comprovante na mão. É exatamente o desfecho que o resto
  // deste arquivo e o do webhook foram escritos para impedir.
  //
  // Estorno e chargeback continuam reabrindo mesmo assim: neles o dinheiro
  // VOLTOU. Aqui não voltou nada — só o registro no gateway deixou de existir.
  if (nome === 'PAYMENT_DELETED' && statusAtual === QUITADA && quitadaPorPessoa) {
    return {
      status: null,
      motivo: 'cobrança removida no gateway, mas a fatura foi baixada à mão',
    };
  }

  if (LIBERA[nome]) {
    if (statusAtual === QUITADA) return { status: null, motivo: 'já estava quitada' };
    return { status: QUITADA, motivo: LIBERA[nome] };
  }

  if (REABRE[nome]) {
    if (statusAtual === ABERTA) return { status: null, motivo: 'já estava aberta' };
    return { status: ABERTA, motivo: REABRE[nome] };
  }

  if (nome === 'PAYMENT_OVERDUE') {
    // A guarda que impede um evento velho de bloquear quem acabou de pagar.
    if (statusAtual === QUITADA) return { status: null, motivo: 'vencimento não desfaz pagamento' };
    return { status: ABERTA, motivo: 'cobrança vencida' };
  }

  return { status: null, motivo: null };
}

/**
 * Até quando uma fatura paga deixa a conta em dia.
 *
 * ── POR QUE ESTA FUNÇÃO EXISTE DOS DOIS LADOS
 * Ela é gêmea de `assinaturaAteDoMes` em `src/dominio/associacao/contaAtiva.js`,
 * e a cópia é deliberada: o deploy das functions só leva a pasta `functions/`,
 * então o servidor não alcança o `src/`. A alternativa seria o webhook não
 * escrever a assinatura — e era exatamente esse o defeito que ela conserta.
 *
 * A duplicação NÃO É CONFIADA À DISCIPLINA: `npm run testar:gateway` importa
 * as DUAS e prova que concordam mês a mês, ano a ano. Divergir passa a ser
 * teste vermelho, não descoberta tardia numa fatura.
 *
 * Pagar a fatura de maio cobre até o FIM DE JUNHO. Parece generoso e não é: a
 * fatura de junho vence dentro de junho, e quem não a pagar é bloqueado pelo
 * caminho do atraso, que é mais curto. Este campo é o PISO ("ele é cliente");
 * a fatura em aberto é a lâmina.
 */
function assinaturaAteDoMes(mes) {
  const m = String(mes || '').trim();
  if (!/^[0-9]{4}-[0-9]{2}$/.test(m)) return null;
  const ano = Number(m.slice(0, 4));
  const numero = Number(m.slice(5, 7));
  // Dia 0 do mês seguinte ao seguinte = último dia do mês seguinte.
  // Meio-dia, e não meia-noite: fuso de uma hora não pode roubar um dia.
  return new Date(ano, numero + 1, 0, 12, 0, 0);
}

/** Este evento vale a pena assinar no painel do gateway? */
function eventoAssinado(evento) {
  return EVENTOS_ASSINADOS.includes(String(evento || '').trim().toUpperCase());
}

module.exports = {
  QUITADA,
  ABERTA,
  EVENTOS_ASSINADOS,
  efeitoDoEvento,
  eventoAssinado,
  assinaturaAteDoMes,
};
