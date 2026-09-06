/**
 * A CONTA ESTÁ ATIVA? — a regra que decide quando o app para.
 *
 * POR QUE ESTE TESTE
 * Errar para menos bloqueia quem ainda tinha prazo, com vinte famílias
 * esperando a perua na calçada. Errar para mais dá meses de uso sem contrato e
 * sem ninguém perceber. E a fronteira entre os dois é uma conta de datas, que
 * é justamente o tipo de código que passa em setembro e falha em março quando
 * lê o relógio da máquina — por isso o "agora" entra por parâmetro.
 *
 * COMO RODAR
 *   node scripts/testar-conta.mjs      (ou: npm run testar:conta)
 */

import {
  TOLERANCIA_DE_ATRASO,
  diasDeAtraso,
  estadoDaConta,
  lembreteDeAtraso,
} from '../src/dominio/associacao/contaAtiva.js';

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

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);

const VENCE = dia('2026-05-10');
const emAberto = { status: 'aberta', vencimento: VENCE, total: 149 };
const quitada = { status: 'quitada', vencimento: VENCE, total: 149 };

// Trial de 90 dias começando em 1º de março → acaba em 30 de maio.
const TRIAL = dia('2026-03-01');

// ───────────────────────────── dias de atraso ──────────────────────────────

bloco('1. Há quantos dias a fatura venceu');

checar('antes de vencer, negativo', -3, diasDeAtraso(emAberto, dia('2026-05-07')));
checar('no dia do vencimento, zero', 0, diasDeAtraso(emAberto, VENCE));
checar('cinco dias depois', 5, diasDeAtraso(emAberto, dia('2026-05-15')));

// Fatura paga não tem atraso, e isso precisa vir antes de qualquer conta de
// data: quitada em cima do vencimento continua quitada.
checar('fatura quitada não tem atraso', null, diasDeAtraso(quitada, dia('2026-06-30')));
checar('sem fatura também não', null, diasDeAtraso(null, VENCE));

// ───────────────────────────── o estado da conta ───────────────────────────

bloco('2. Quando a conta continua ativa');

checar(
  'dentro do trial, sem fatura',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: TRIAL, agora: dia('2026-04-01') })
);
checar(
  'cadastrou e não rodou rota: o relógio nem começou',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: null, agora: dia('2026-12-01') })
);
checar(
  'com contrato, o trial deixa de significar qualquer coisa',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: TRIAL, temContrato: true, agora: dia('2026-09-01') })
);
checar(
  'fatura em aberto dentro da tolerância',
  { ativa: true, motivo: null, dias: 9 },
  estadoDaConta({ temContrato: true, fatura: emAberto, agora: dia('2026-05-19') })
);

bloco('3. Quando ela para');

// A fronteira: 10 tolera, 11 bloqueia. Esta é a linha que separa esquecer de
// decidir, e mover um dia para cá bloqueia quem viajou no fim de semana.
checar(
  'no décimo dia ainda opera',
  true,
  estadoDaConta({ temContrato: true, fatura: emAberto, agora: dia('2026-05-20') }).ativa
);
checar(
  'no décimo primeiro, para',
  { ativa: false, motivo: 'atraso', dias: 11 },
  estadoDaConta({ temContrato: true, fatura: emAberto, agora: dia('2026-05-21') })
);
checar(
  'trial vencido sem contrato',
  { ativa: false, motivo: 'trial', dias: null },
  estadoDaConta({ trialInicio: TRIAL, agora: dia('2026-06-01') })
);

bloco('4. A ordem da checagem é parte da regra');

// Suspensão é decisão de uma pessoa. Um pagamento não a desfaz — quem desfaz
// é quem suspendeu, e por outro caminho.
checar(
  'suspenso vence tudo, mesmo em dia',
  { ativa: false, motivo: 'suspenso', dias: null },
  estadoDaConta({ suspenso: true, temContrato: true, fatura: quitada, agora: VENCE })
);
checar(
  'suspenso vence até o trial correndo',
  'suspenso',
  estadoDaConta({ suspenso: true, trialInicio: TRIAL, agora: dia('2026-04-01') }).motivo
);
// Quem já foi cliente e atrasou recebe a frase do atraso, não a do teste — a
// segunda seria mentira, e ele saberia disso.
checar(
  'atraso vence o trial vencido',
  'atraso',
  estadoDaConta({
    trialInicio: TRIAL,
    fatura: emAberto,
    agora: dia('2026-06-01'),
  }).motivo
);

// ───────────────────────────── os lembretes ────────────────────────────────

bloco('5. O lembrete de PIX — e o silêncio, que é a resposta comum');

checar('antes de vencer, silêncio', null, lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-08') }));
checar(
  'no dia do vencimento, o primeiro',
  { nivel: 'vence-hoje', dias: 0, faltam: 11 },
  lembreteDeAtraso({ fatura: emAberto, agora: VENCE })
);
checar(
  'no terceiro dia, ainda o primeiro — não é contagem diária',
  'vence-hoje',
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-13') }).nivel
);
checar(
  'no quinto, o segundo e último',
  { nivel: 'atrasada', dias: 5, faltam: 6 },
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-15') })
);
checar(
  'no décimo, ainda lembra — e diz que falta 1',
  { nivel: 'atrasada', dias: 10, faltam: 1 },
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-20') })
);

// Depois do bloqueio o lembrete some: quem está na tela de conta inativa não
// precisa de um cartão dizendo que está atrasado. Dois avisos sobre a mesma
// coisa é o app falando duas vezes.
checar(
  'passou da tolerância, o lembrete cala',
  null,
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-25') })
);
checar('fatura quitada não lembra nada', null, lembreteDeAtraso({ fatura: quitada, agora: dia('2026-06-01') }));
checar('sem fatura, idem', null, lembreteDeAtraso({ fatura: null, agora: VENCE }));

bloco('6. A régua está onde foi combinada');

checar('dez dias de tolerância', 10, TOLERANCIA_DE_ATRASO);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
