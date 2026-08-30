/**
 * O ESTADO DO DINHEIRO DO PAI — a definição de "atrasado" no app inteiro.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `computeDisplayStatus` decide o que a tela mostra e o que os relatórios
 * somam. O cabeçalho dela registra que **dezessete lugares perguntam
 * `=== 'paid'`**, e nada protegia essa contagem — a função morava atrás de um
 * import de Firestore e não tinha como ser importada por um script Node.
 *
 * A hora entra por parâmetro (como em `avisoDoMomento`), então "vence hoje",
 * "venceu ontem" e "a janela de 24h fechou" são testáveis sem mexer no
 * relógio da máquina.
 *
 * O BLOCO 2 É O QUE NÃO PODE QUEBRAR: 'claimed' tem prioridade sobre
 * 'overdue'. Inverter faz o app cobrar de novo quem já avisou que pagou.
 *
 * COMO RODAR
 *   node scripts/testar-status.mjs      (ou: npm run testar:status)
 */

import {
  UNDO_WINDOW_HOURS,
  computeDisplayStatus,
  foiPagoAtrasado,
  canUndoReceipt,
} from '../src/utils/statusPagamento.js';

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
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

// O relógio do teste. Tudo abaixo é relativo a ele.
const AGORA = new Date('2026-08-30T12:00:00Z').getTime();
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

// Simula o Timestamp do Firestore, que é como o dado chega de verdade.
const ts = (ms) => ({ toDate: () => new Date(ms) });

bloco('1. Os quatro estados');

checar('confirmado é paid', 'paid', computeDisplayStatus({ status: 'paid' }, AGORA));
checar('avisado é claimed', 'claimed', computeDisplayStatus({ status: 'claimed' }, AGORA));
checar('pendente no prazo é pending', 'pending',
  computeDisplayStatus({ status: 'pending', dueDate: ts(AGORA + 3 * DIA) }, AGORA));
checar('pendente vencido é overdue', 'overdue',
  computeDisplayStatus({ status: 'pending', dueDate: ts(AGORA - DIA) }, AGORA));
checar('sem pagamento é pending', 'pending', computeDisplayStatus(null, AGORA));
checar('sem data de vencimento é pending', 'pending',
  computeDisplayStatus({ status: 'pending' }, AGORA));

bloco('2. CLAIMED VENCE OVERDUE — o pai que avisou não é cobrado de novo');

// Se o pai avisou que pagou, mesmo depois do vencimento, o motorista precisa
// confirmar antes de virar 'paid'. Inverter esta ordem faz o app cobrar de
// novo quem já avisou.
checar('avisado E vencido continua claimed', 'claimed',
  computeDisplayStatus({ status: 'claimed', dueDate: ts(AGORA - 10 * DIA) }, AGORA));
checar('confirmado E vencido continua paid', 'paid',
  computeDisplayStatus({ status: 'paid', dueDate: ts(AGORA - 10 * DIA) }, AGORA));

bloco('3. A borda do vencimento');

checar('vence daqui a um minuto ainda é pending', 'pending',
  computeDisplayStatus({ status: 'pending', dueDate: ts(AGORA + 60000) }, AGORA));
checar('venceu há um minuto já é overdue', 'overdue',
  computeDisplayStatus({ status: 'pending', dueDate: ts(AGORA - 60000) }, AGORA));

bloco('4. Pago atrasado é LEITURA, não um quinto estado');

const pagoAtrasado = { status: 'paid', dueDate: ts(AGORA - 5 * DIA), paidAt: ts(AGORA - DIA) };
// O ponto inteiro: continua 'paid' para todo mundo que soma dinheiro.
checar('pago atrasado continua paid no status', 'paid', computeDisplayStatus(pagoAtrasado, AGORA));
checar('e a leitura diz que atrasou', true, foiPagoAtrasado(pagoAtrasado));

const pagoEmDia = { status: 'paid', dueDate: ts(AGORA), paidAt: ts(AGORA - 3 * DIA) };
checar('pago antes do vencimento não atrasou', false, foiPagoAtrasado(pagoEmDia));
checar('pendente não conta como pago atrasado', false,
  foiPagoAtrasado({ status: 'pending', dueDate: ts(AGORA - DIA) }));
checar('sem paidAt não afirma atraso', false,
  foiPagoAtrasado({ status: 'paid', dueDate: ts(AGORA - DIA) }));
checar('sem pagamento não estoura', false, foiPagoAtrasado(null));

bloco('5. A janela de 24h para desfazer a baixa');

checar('a janela é de 24 horas', 24, UNDO_WINDOW_HOURS);

const recem = canUndoReceipt({ status: 'paid', paidAt: ts(AGORA - 2 * HORA) }, AGORA);
checar('2h depois ainda dá pra desfazer', true, recem.allowed);
checar('e sem motivo de recusa', null, recem.reason);

const tarde = canUndoReceipt({ status: 'paid', paidAt: ts(AGORA - 30 * HORA) }, AGORA);
checar('30h depois não dá mais', false, tarde.allowed);
checar('e o motivo diz quantas horas passaram', true, tarde.reason.includes('30h'));

// A borda exata: 24h em ponto ainda passa; um minuto além, não.
checar('exatamente 24h ainda passa', true,
  canUndoReceipt({ status: 'paid', paidAt: ts(AGORA - 24 * HORA) }, AGORA).allowed);
checar('24h e um minuto não passa', false,
  canUndoReceipt({ status: 'paid', paidAt: ts(AGORA - 24 * HORA - 60000) }, AGORA).allowed);

checar('não confirmado não tem o que desfazer', false,
  canUndoReceipt({ status: 'claimed' }, AGORA).allowed);
// Pagamento antigo sem timestamp: permite, por compatibilidade.
checar('pago sem paidAt permite desfazer', true,
  canUndoReceipt({ status: 'paid' }, AGORA).allowed);
checar('sem pagamento recusa com motivo', false, canUndoReceipt(null, AGORA).allowed);

bloco('6. A data pode chegar como Timestamp, Date ou string');

checar('Date puro funciona', 'overdue',
  computeDisplayStatus({ status: 'pending', dueDate: new Date(AGORA - DIA) }, AGORA));
checar('string ISO funciona', 'overdue',
  computeDisplayStatus({ status: 'pending', dueDate: new Date(AGORA - DIA).toISOString() }, AGORA));
checar('lixo não vira atraso', 'pending',
  computeDisplayStatus({ status: 'pending', dueDate: 'nao-e-data' }, AGORA));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
