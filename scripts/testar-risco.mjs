/**
 * O TERMÔMETRO DE RISCO — por que este associado pode estar de saída.
 *
 * POR QUE ESTE TESTE
 * Um termômetro errado não dá erro: ele dá um alarme, e alguém liga para uma
 * pessoa que está bem. Os dois jeitos de errar aqui são opostos e igualmente
 * silenciosos —
 *
 *   acender para quem NUNCA entrou (o recém-cadastrado que ainda não rodou),
 *   enchendo a fila de ruído até o dono parar de olhar para ela;
 *
 *   chamar de queda o primeiro ponto de uma série, quando uma medição não é
 *   uma tendência.
 *
 * COMO RODAR
 *   node scripts/testar-risco.mjs      (ou: npm run testar:risco)
 */

import {
  DIAS_SEM_RODAR,
  DIAS_SEM_RODAR_GRAVE,
  criancasPerdidas,
  diasSemRodar,
  pesoDoRisco,
  riscoDo,
} from '../src/dominio/associacao/risco.js';

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
const HOJE = dia('2026-09-15');

const ids = (r) => r.sinais.map((s) => s.id);

// ───────────────────────────── sem rodar ───────────────────────────────────

bloco('1. Há quantos dias ele não roda');

checar('rodou hoje', 0, diasSemRodar({ ultimaRota: dia('2026-09-15') }, HOJE));
checar('rodou há oito dias', 8, diasSemRodar({ ultimaRota: dia('2026-09-07') }, HOJE));
// ⚠️ NUNCA RODOU NÃO É PAROU DE RODAR. Sem `ultimaRota` não há o que medir —
// e esse caso é um DEGRAU da carteira, não um sinal de risco.
checar('nunca rodou não é medido', null, diasSemRodar({}, HOJE));

// ───────────────────────────── encolhendo ──────────────────────────────────

bloco('2. Quantas crianças ele perdeu');

// A SÉRIE SAI DAS FATURAS, de graça: `fecharFatura` grava `criancasAtivas`
// dentro de cada uma. O documento do usuário só guarda o número de HOJE.
const serie = [
  { mes: '2026-06', criancasAtivas: 18 },
  { mes: '2026-07', criancasAtivas: 20 },
  { mes: '2026-08', criancasAtivas: 14 },
];
checar('do pico até agora', 6, criancasPerdidas(serie));
checar('a ordem dos meses não importa', 6, criancasPerdidas([...serie].reverse()));
checar('crescendo não é perda', 0, criancasPerdidas([
  { mes: '2026-06', criancasAtivas: 10 },
  { mes: '2026-07', criancasAtivas: 14 },
]));

// ⚠️ UMA MEDIÇÃO NÃO É UMA TENDÊNCIA. Chamar de queda o primeiro ponto seria
// inventar um sinal onde não há histórico.
checar('uma fatura só não vira tendência', null, criancasPerdidas([serie[0]]));
checar('nenhuma fatura também não', null, criancasPerdidas([]));
checar('fatura sem o campo é ignorada', null, criancasPerdidas([
  { mes: '2026-06' },
  { mes: '2026-07', criancasAtivas: 10 },
]));

// ───────────────────────────── o termômetro ────────────────────────────────

bloco('3. Quem NÃO é avaliado');

// ⚠️ MEDIR RISCO DE SAÍDA DE QUEM JÁ SAIU, OU DE QUEM AINDA NÃO ENTROU, enche a
// fila de ruído — e fila que não esvazia deixa de ser lida.
const parado = { ultimaRota: dia('2026-08-01') };
checar('quem nunca rodou não acende', 'nenhum',
  riscoDo({ motorista: parado, degrau: 'nao_comecou', agora: HOJE }).nivel);
checar('quem já está bloqueado não acende', 'nenhum',
  riscoDo({ motorista: parado, degrau: 'bloqueado', agora: HOJE }).nivel);

bloco('4. Os quatro sinais');

checar('rodando em dia, nada acende', 'nenhum',
  riscoDo({ motorista: { ultimaRota: dia('2026-09-14') }, degrau: 'contratado', agora: HOJE }).nivel);

const oitoDias = riscoDo({
  motorista: { ultimaRota: dia('2026-09-07') },
  degrau: 'contratado',
  agora: HOJE,
});
checar('oito dias sem rodar é atenção', 'atencao', oitoDias.nivel);
checar('e o motivo é dito', ['parou'], ids(oitoDias));
checar('com o número de dias dentro', true, oitoDias.sinais[0].texto.includes('8 dias'));

// Duas semanas parado é outra conversa: ele já não está operando.
checar('quinze dias é grave', 'alto',
  riscoDo({ motorista: { ultimaRota: dia('2026-08-31') }, degrau: 'contratado', agora: HOJE }).nivel);

const encolhendo = riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  faturas: serie,
  degrau: 'contratado',
  agora: HOJE,
});
// É o único sinal que aparece enquanto ele ainda paga em dia.
checar('encolher acende sozinho', ['encolhendo'], ids(encolhendo));
checar('e é atenção, não grave', 'atencao', encolhendo.nivel);

const atrasado = riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  faturas: [{ mes: '2026-08', status: 'aberta', vencimento: dia('2026-08-10') }],
  degrau: 'contratado',
  agora: HOJE,
});
checar('fatura vencida é grave', 'alto', atrasado.nivel);
checar('e diz qual mês', true, atrasado.sinais[0].texto.includes('2026-08'));
// Fatura quitada não é atraso, e fatura a vencer também não.
checar('fatura paga não acende', 'nenhum', riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  faturas: [{ mes: '2026-08', status: 'quitada', vencimento: dia('2026-08-10') }],
  degrau: 'contratado',
  agora: HOJE,
}).nivel);
checar('fatura ainda a vencer não acende', 'nenhum', riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  faturas: [{ mes: '2026-09', status: 'aberta', vencimento: dia('2026-09-30') }],
  degrau: 'contratado',
  agora: HOJE,
}).nivel);

bloco('5. Nota baixa só conta com opinião suficiente');

// ⚠️ COM POUCAS OPINIÕES A MÉDIA É RUÍDO: uma nota 1 isolada não diz nada sobre
// o serviço, diz sobre um dia ruim.
checar('nota 2 com uma avaliação não acende', 'nenhum', riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  nota: { media: 2, n: 1 },
  degrau: 'contratado',
  agora: HOJE,
}).nivel);
const notaRuim = riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  nota: { media: 2.5, n: 6 },
  degrau: 'contratado',
  agora: HOJE,
});
checar('nota 2,5 com seis acende', ['nota'], ids(notaRuim));
checar('nota boa não acende', 'nenhum', riscoDo({
  motorista: { ultimaRota: dia('2026-09-14') },
  nota: { media: 4.8, n: 9 },
  degrau: 'contratado',
  agora: HOJE,
}).nivel);

bloco('6. Vários sinais ao mesmo tempo');

const tudo = riscoDo({
  motorista: { ultimaRota: dia('2026-08-25') },
  faturas: [
    ...serie,
    { mes: '2026-08', status: 'aberta', vencimento: dia('2026-08-10'), criancasAtivas: 14 },
  ],
  nota: { media: 2.9, n: 5 },
  degrau: 'contratado',
  agora: HOJE,
});
checar('os quatro aparecem', 4, tudo.sinais.length);
// A ficha mostra a LISTA, não o número: score sem explicação ninguém usa duas
// vezes.
checar('e todos têm frase', true, tudo.sinais.every((s) => s.texto.length > 5));
checar('o nível é alto', 'alto', tudo.nivel);

bloco('7. O peso, que só serve pra ordenar');

checar('alto na frente', 2, pesoDoRisco('alto'));
checar('atenção depois', 1, pesoDoRisco('atencao'));
checar('sem risco por último', 0, pesoDoRisco('nenhum'));

bloco('8. As réguas estão onde foram combinadas');

checar('uma semana acende', 7, DIAS_SEM_RODAR);
checar('duas semanas é grave', 14, DIAS_SEM_RODAR_GRAVE);
checar('entrada vazia não quebra', 'nenhum', riscoDo().nivel);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
