/**
 * O QUE CADA EVENTO DO GATEWAY FAZ COM A FATURA.
 *
 * POR QUE ESTE TESTE
 * A função que ele exercita roda num endpoint PÚBLICO, disparada por um
 * sistema de fora, sobre eventos que chegam repetidos e fora de ordem. É o
 * pedaço mais difícil de observar em produção: quando ele erra, o sintoma é
 * um motorista bloqueado que já pagou — ou, pior e mais silencioso, um
 * motorista operando de graça porque um estorno não reabriu a fatura.
 *
 * COMO RODAR
 *   node scripts/testar-cobranca.mjs      (ou: npm run testar:cobranca)
 */

import {
  QUITADA,
  ABERTA,
  EVENTOS_ASSINADOS,
  efeitoDoEvento,
  eventoAssinado,
} from '../src/dominio/associacao/eventoDeCobranca.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

const status = (evento, atual) => efeitoDoEvento(evento, atual).status;

// ────────────────────────────── dar baixa ──────────────────────────────────

bloco('1. O que dá baixa');

// A decisão central: libera no CONFIRMED, que é "pagou, saldo ainda não
// disponível". Esperar o RECEIVED deixaria quem pagou bloqueado por dias.
checar('CONFIRMED dá baixa mesmo sem o saldo liberado', QUITADA, status('PAYMENT_CONFIRMED', ABERTA));
checar('RECEIVED também', QUITADA, status('PAYMENT_RECEIVED', ABERTA));
checar(
  'e o motivo fica registrado',
  'pagamento confirmado',
  efeitoDoEvento('PAYMENT_CONFIRMED', ABERTA).motivo
);

bloco('2. O que faz voltar a dever');

checar('estorno reabre', ABERTA, status('PAYMENT_REFUNDED', QUITADA));
// Estorno parcial também: "quitada pela metade" não é um estado que a cobrança
// deste projeto tenha.
checar('estorno PARCIAL também reabre', ABERTA, status('PAYMENT_PARTIALLY_REFUNDED', QUITADA));
checar('chargeback reabre', ABERTA, status('PAYMENT_CHARGEBACK_REQUESTED', QUITADA));
checar('recebimento em dinheiro desfeito reabre', ABERTA, status('PAYMENT_RECEIVED_IN_CASH_UNDONE', QUITADA));
checar('cobrança removida no gateway reabre', ABERTA, status('PAYMENT_DELETED', QUITADA));

bloco('3. A guarda que impede o pior caso');

// Eventos chegam FORA DE ORDEM: um OVERDUE gerado às 00:00 pode ser entregue
// depois do CONFIRMED das 08:00 se a fila do gateway atrasar. Sem esta linha,
// o motorista paga e é bloqueado em seguida por um evento velho.
checar(
  'vencimento NÃO desfaz pagamento',
  null,
  status('PAYMENT_OVERDUE', QUITADA)
);
checar(
  'e o motivo diz por que foi ignorado',
  'vencimento não desfaz pagamento',
  efeitoDoEvento('PAYMENT_OVERDUE', QUITADA).motivo
);
checar('mas vencimento sobre fatura aberta marca atraso', ABERTA, status('PAYMENT_OVERDUE', ABERTA));

bloco('4. Repetição não muda nada');

// O gateway repete o webhook quando não recebe confirmação, então o mesmo
// evento chega duas ou três vezes. A resposta é um ESTADO ABSOLUTO, nunca um
// passo relativo — aplicar de novo dá no mesmo.
checar('CONFIRMED sobre fatura já quitada não muda', null, status('PAYMENT_CONFIRMED', QUITADA));
checar('estorno sobre fatura já aberta não muda', null, status('PAYMENT_REFUNDED', ABERTA));
checar(
  'e diz que não mudou porque já estava assim',
  'já estava quitada',
  efeitoDoEvento('PAYMENT_RECEIVED', QUITADA).motivo
);

bloco('5. O que o app ignora de propósito');

// Ruído do gateway: nada disso muda quem deve o quê. Se algum dia um destes
// passar a mexer no estado, foi por engano.
[
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_BANK_SLIP_VIEWED',
  'PAYMENT_CHECKOUT_VIEWED',
  'PAYMENT_ANTICIPATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_SPLIT_DONE',
  'PAYMENT_DUNNING_REQUESTED',
].forEach((e) => checar(`${e} não mexe`, null, status(e, ABERTA)));

// O gateway acrescenta eventos com o tempo. Evento novo que este arquivo não
// conhece precisa não fazer NADA — fatura é dinheiro, e na dúvida não mexe.
checar('evento que ainda não existe não mexe', null, status('PAYMENT_ALGO_NOVO_DE_2027', ABERTA));
checar('nem lixo', null, status('', ABERTA));
checar('nem nulo', null, status(null, ABERTA));

bloco('6. A lista que vai marcada no painel do gateway');

checar('são oito eventos', 8, EVENTOS_ASSINADOS.length);
checar('e todos têm efeito', true, EVENTOS_ASSINADOS.every((e) => status(e, ABERTA) !== null || status(e, QUITADA) !== null));
checar('CONFIRMED está assinado', true, eventoAssinado('PAYMENT_CONFIRMED'));
checar('o ruído não está', false, eventoAssinado('PAYMENT_CREATED'));
// Nome em caixa trocada é erro de digitação de quem configura o painel, não
// motivo para perder um pagamento.
checar('caixa não importa', QUITADA, status('payment_confirmed', ABERTA));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
