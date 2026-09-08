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
  DIAS_POR_DEGRAU,
  fimDoTrial,
  diasRestantes,
  estadoDoTrial,
  avisoDoTrial,
  degrauDaDecisao,
  fimDoDegrau,
  mesDeTesteDe,
} from '../src/dominio/associacao/trial.js';

const dia2 = (d, n) => new Date(d.getTime() + n * 86400000);

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

// ═══════ A ESCADA DE FECHAMENTO — o degrau é o mês do teste ════════════════

bloco('A escada: em que degrau ele está');

const INI = dia('2026-03-01');
const noDia = (n) => degrauDaDecisao({ inicio: INI, agora: dia2(INI, n) });

checar('dia 0 é o primeiro degrau', 1, noDia(0));
checar('dia 29 ainda é o primeiro', 1, noDia(29));
checar('dia 30 vira o segundo', 2, noDia(30));
checar('dia 59 ainda é o segundo', 2, noDia(59));
checar('dia 60 vira o terceiro', 3, noDia(60));
checar('dia 89 é o último do terceiro', 3, noDia(89));
// ⚠️ NÃO EXISTE QUARTO DEGRAU. Escada que premia quem esperou é exatamente a
// lição que ela existe para não ensinar — depois dos 90 dias o desconto é
// ZERO, e a conta fica inativa até ele fechar.
checar('dia 90 já é a janela de retorno', 'retorno', noDia(90));
checar('dia 119 é o último do retorno', 'retorno', noDia(119));
checar('dia 120 não tem mais degrau', null, noDia(120));

// ⚠️ SEM `inicio` O DEGRAU É 1, e não zero: quem nunca rodou uma rota não
// gastou um dia do teste, e é o mais antecipado de todos. Cobrar-lhe o preço
// cheio puniria quem decidiu antes de precisar.
checar('sem início, o primeiro degrau', 1, degrauDaDecisao({ inicio: null, agora: INI }));
checar('sem agora, nenhuma resposta', null, degrauDaDecisao({ inicio: INI, agora: null }));
checar('sem nada, ainda o primeiro', 1, degrauDaDecisao({}));

// ⚠️ RELÓGIO ATRASADO NÃO REBAIXA NINGUÉM. Sem o piso de zero,
// `floor(-1 / 30) + 1` daria degrau 0 — nenhum desconto para quem acabou de
// começar, que é o oposto do desenho.
checar('data futura não vira degrau zero', 1, degrauDaDecisao({ inicio: INI, agora: dia2(INI, -3) }));

bloco('A escada: até quando cada degrau vale');

// A OFERTA VEM COM DATA. "Decida logo" não é um prazo — urgência sem data é
// pressão, e a tela precisa poder dizer quando o desconto piora.
checar('o primeiro degrau vira em 30 dias', '2026-03-31', fimDoDegrau(INI, 1).toISOString().slice(0, 10));
checar('o segundo, em 60', '2026-04-30', fimDoDegrau(INI, 2).toISOString().slice(0, 10));
checar('o terceiro, no fim do teste', '2026-05-30', fimDoDegrau(INI, 3).toISOString().slice(0, 10));
// Não há próximo degrau melhor depois do terceiro, nem no retorno.
checar('não há quarto degrau para datar', null, fimDoDegrau(INI, 4));
checar('nem o retorno tem data de virada', null, fimDoDegrau(INI, 'retorno'));
checar('sem início, sem data', null, fimDoDegrau(null, 1));
checar('cada degrau é um mês de trinta dias', 30, DIAS_POR_DEGRAU);
checar('e três deles fecham o teste', DIAS_DE_TRIAL, 3 * DIAS_POR_DEGRAU);

// ═══════ A FATURA ISENTA DO TESTE ══════════════════════════════════════════

bloco('A fatura de teste: em que mês de teste ela cai');

// O teste passou a EMITIR fatura todo mês, isenta, com o preço cheio visível —
// o hábito que faltava era receber e reconhecer uma fatura. Ver
// docs/descontos.md, peça 1.
const INICIO_20_09 = new Date(2026, 8, 20, 12);

checar('o mês anterior ao início não é mês de teste', null, mesDeTesteDe(INICIO_20_09, '2026-08'));
checar('o mês em que começou é o 1º', 1, mesDeTesteDe(INICIO_20_09, '2026-09'));
checar('o seguinte é o 2º', 2, mesDeTesteDe(INICIO_20_09, '2026-10'));
checar('e o outro, o 3º', 3, mesDeTesteDe(INICIO_20_09, '2026-11'));

// ⚠️ ELE PASSA DE 3, E É POR ISSO QUE O RÓTULO NÃO DIZ "DE 3".
//
// O teste tem 90 dias CORRIDOS e a fatura é por mês de CALENDÁRIO: começando
// em 20/09 ele acaba em 19/12 e encosta em QUATRO meses. "Mês 4 de 3" num
// documento de cobrança é o tipo de contradição que este projeto testa para
// não ter — quem diz o fim é a data, que vai congelada na fatura.
checar('começando no fim do mês, o teste encosta num 4º', 4, mesDeTesteDe(INICIO_20_09, '2026-12'));
checar('e janeiro já não é teste', null, mesDeTesteDe(INICIO_20_09, '2027-01'));

// Começando no dia 1º, ele encosta em exatamente três.
const INICIO_01_09 = new Date(2026, 8, 1, 12);
checar('começando no dia 1º, o 3º é o último', 3, mesDeTesteDe(INICIO_01_09, '2026-11'));
checar('e dezembro já não é teste', null, mesDeTesteDe(INICIO_01_09, '2026-12'));

// ⚠️ SEM `inicio`, TODA FATURA É MÊS 1 — isenção sem fim. É o custo conhecido
// de o gatilho ser a primeira rota, e agora ele fica VISÍVEL: o dono passa a
// ver uma fatura isenta por mês em vez de nenhuma fatura.
checar('sem início, qualquer mês é o 1º', 1, mesDeTesteDe(null, '2028-07'));
checar('mês malformado não vira mês de teste', null, mesDeTesteDe(INICIO_20_09, '2026-9'));
checar('nem texto solto', null, mesDeTesteDe(INICIO_20_09, 'setembro'));
checar('nem ausência', null, mesDeTesteDe(INICIO_20_09, null));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
