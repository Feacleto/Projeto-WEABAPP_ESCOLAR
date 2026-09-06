/**
 * O RELÓGIO DOS TRÊS MESES — quando começa, quando acaba, quando avisa.
 *
 * POR QUE ESTE TESTE EXISTE
 * O fim do trial é o gatilho de dinheiro: é a data que decide se o app cobra,
 * avisa ou bloqueia. Errar por um dia para menos bloqueia quem ainda tinha
 * prazo, com vinte famílias esperando a perua na calçada. Errar para mais dá
 * mês grátis sem ninguém perceber.
 *
 * A HORA ENTRA POR PARÂMETRO, e é isso que torna o teste possível. Regra de
 * data que lê o relógio da máquina passa em setembro e falha em março, e a
 * falha aparece em produção. Mesmo padrão de `testar-aviso.mjs`.
 *
 * COMO RODAR
 *   node scripts/testar-trial.mjs      (ou: npm run testar:trial)
 *
 * Sem emulador, sem rede, sem framework — o padrão desta casa.
 */

import {
  DIAS_DE_TRIAL,
  fimDoTrial,
  diasRestantes,
  estadoDoTrial,
  avisoDoTrial,
} from '../src/dominio/associacao/trial.js';

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

/** Meio-dia de propósito: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const INICIO = dia('2026-03-01');

// ───────────────────────────── o fim do teste ──────────────────────────────

bloco('1. Quando acaba');

checar('90 dias é o prazo da casa', 90, DIAS_DE_TRIAL);
checar(
  'começando em 1º de março, acaba em 30 de maio',
  '2026-05-30',
  fimDoTrial(INICIO).toISOString().slice(0, 10)
);
// O relógio parado é o estado normal de quem cadastrou e ainda não rodou.
// Devolver uma data aqui inventaria um vencimento que ninguém combinou.
checar('sem início não há fim', null, fimDoTrial(null));
checar('lixo também não vira data', null, fimDoTrial('quinta que vem'));

bloco('2. O Timestamp do Firestore entra sem o SDK');

// O módulo não pode importar `firebase/firestore` — é o que o mantém puro e
// testável. Então ele reconhece o Timestamp pelo FORMATO (tem `toDate()`).
const timestampFalso = { toDate: () => INICIO };
checar(
  'objeto com toDate() é aceito',
  '2026-05-30',
  fimDoTrial(timestampFalso).toISOString().slice(0, 10)
);
checar('toDate() que devolve lixo não passa', null, fimDoTrial({ toDate: () => 'x' }));

// ──────────────────────────── os dias restantes ────────────────────────────

bloco('3. Quantos dias faltam');

checar('no primeiro dia, faltam 90', 90, diasRestantes(INICIO, INICIO));
checar('trinta dias depois, faltam 60', 60, diasRestantes(INICIO, dia('2026-03-31')));
checar('na véspera, falta 1', 1, diasRestantes(INICIO, dia('2026-05-29')));
checar('no dia do fim, zero', 0, diasRestantes(INICIO, dia('2026-05-30')));

// Arredonda pra CIMA: com a tarde inteira pela frente ainda é "1 dia".
// Dizer "zero" pra quem tem seis horas é mentir pro lado que assusta.
checar(
  'seis horas antes do fim ainda é 1 dia',
  1,
  diasRestantes(INICIO, new Date('2026-05-30T06:00:00'))
);

// O sinal é a informação: −3 é "venceu há três dias", e é o que a tela de
// conta inativa usa pra dizer há quanto tempo.
checar('depois do fim fica negativo', -3, diasRestantes(INICIO, dia('2026-06-02')));

// ───────────────────────────────── o estado ────────────────────────────────

bloco('4. Em que pé está a conta');

checar(
  'cadastrou e não rodou rota: o relógio está parado',
  'nao_iniciado',
  estadoDoTrial({ inicio: null, agora: INICIO })
);
checar('dentro do prazo', 'rodando', estadoDoTrial({ inicio: INICIO, agora: dia('2026-04-01') }));
checar('passou do prazo', 'expirado', estadoDoTrial({ inicio: INICIO, agora: dia('2026-06-01') }));

// Quem assinou no dia 60 não pode continuar vendo contagem regressiva por mais
// um mês — a conta dele passou a ser a do contrato.
checar(
  'com contrato, o relógio deixa de significar qualquer coisa',
  'contratado',
  estadoDoTrial({ inicio: INICIO, agora: dia('2026-04-01'), temContrato: true })
);
checar(
  'e isso vale inclusive depois do prazo',
  'contratado',
  estadoDoTrial({ inicio: INICIO, agora: dia('2026-09-01'), temContrato: true })
);

// ───────────────────────────────── os avisos ───────────────────────────────

bloco('5. O aviso do momento — e o silêncio, que é a resposta mais comum');

// Nos primeiros 60 dias o app fica CALADO sobre dinheiro. Se esta linha um dia
// devolver aviso, alguém transformou o teste numa cobrança de dois meses.
checar('dia 1: silêncio', null, avisoDoTrial({ inicio: INICIO, agora: INICIO }));
checar('dia 30: silêncio', null, avisoDoTrial({ inicio: INICIO, agora: dia('2026-03-31') }));
checar('faltando 61 dias: silêncio', null, avisoDoTrial({ inicio: INICIO, agora: dia('2026-03-30') }));

checar(
  'faltando 30, a linha discreta',
  { nivel: 'discreto', dias: 30 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-04-30') })
);
checar(
  'faltando 8, ainda discreta',
  { nivel: 'discreto', dias: 8 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-22') })
);
checar(
  'faltando 7, o cartão âmbar',
  { nivel: 'atencao', dias: 7 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-23') })
);

// A FAIXA é o ponto: quem não abriu o app no dia 7 vê o âmbar no dia 5, já no
// tom certo. Data exata só acerta quem abre naquele dia.
checar(
  'faltando 5, continua âmbar — a faixa não deixa ninguém escapar',
  { nivel: 'atencao', dias: 5 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-25') })
);
checar(
  'no último dia, a tela cheia',
  { nivel: 'ultimo', dias: 1 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-29') })
);
checar(
  'depois do fim, a conta inativa',
  { nivel: 'expirado', dias: 0 },
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-30') })
);

bloco('6. Quem não deve ser avisado');

checar(
  'sem rota rodada, nenhum aviso — não há prazo correndo',
  null,
  avisoDoTrial({ inicio: null, agora: dia('2026-06-01') })
);
checar(
  'com contrato, nenhum aviso, mesmo na véspera',
  null,
  avisoDoTrial({ inicio: INICIO, agora: dia('2026-05-29'), temContrato: true })
);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
