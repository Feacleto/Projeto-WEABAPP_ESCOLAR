/**
 * A MULTA DE SAÍDA — a única cobrança do projeto que pune, e por isso a mais
 * perigosa de errar.
 *
 * POR QUE ESTE TESTE EXISTE
 * Toda outra conta deste projeto erra para menos ou para mais e alguém
 * reclama. Esta erra contra quem está SAINDO — quem não vai reclamar, vai
 * contar no portão. E o argumento comercial inteiro do plano mensal ("cancelou,
 * cancelou") morre no dia em que uma multa aparecer nele por qualquer motivo.
 *
 * ⚠️ O BLOCO 1 É O MAIS IMPORTANTE DO ARQUIVO, e ele testa uma AUSÊNCIA: o
 * mensal não tem multa em situação nenhuma. Ausência não deixa rastro quando
 * quebra — a multa apareceria numa tela que quase ninguém abre, cobrada de
 * quem já decidiu ir embora.
 *
 * COMO RODAR
 *   node scripts/testar-multa.mjs      (ou: npm run testar:multa)
 */

import {
  FRACAO_DA_MULTA,
  TETO_EM_MENSALIDADES,
  DIAS_SEM_MULTA,
  mesesCumpridos,
  multaDeSaida,
  quedaNoProximoMes,
} from '../src/dominio/associacao/multa.js';
import { PLANO, MESES_DE_CONTRATO } from '../src/dominio/associacao/planos.js';

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

/** Meio-dia: à meia-noite qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const INICIO = dia('2026-09-10');

/** A operação de referência: 20 crianças no anual, R$ 58/mês. */
const MENSAL_DO_ANUAL = 58;

const em = (iso, extra = {}) =>
  multaDeSaida({
    plano: PLANO.ANUAL,
    valorMensal: MENSAL_DO_ANUAL,
    inicio: INICIO,
    agora: dia(iso),
    ...extra,
  });

// ──────────────── 1. o mensal não tem multa. nunca. ────────────────────────

bloco('1. O mensal não tem multa em situação nenhuma');

// ⚠️ "CANCELOU, CANCELOU" É A PROMESSA INTEIRA DO PLANO MENSAL, e ela é o
// argumento central contra o concorrente, que cobra 30% do saldo. Uma exceção
// aqui — "só neste caso", "só no primeiro mês" — apaga a frase, porque saída
// livre com asterisco não é saída livre.
const mensalNoDia1 = multaDeSaida({
  plano: PLANO.MENSAL,
  valorMensal: 118,
  inicio: INICIO,
  agora: dia('2026-09-11'),
});
checar('sair no dia seguinte não custa nada', false, mensalNoDia1.devida);
checar('e o valor é zero', 0, mensalNoDia1.valor);
checar('e o motivo diz por quê', 'mensal-nao-tem-multa', mensalNoDia1.motivo);

// No meio do ano, com onze meses "restantes" se ele fosse anual.
checar(
  'sair no sexto mês também não custa nada',
  0,
  multaDeSaida({
    plano: PLANO.MENSAL,
    valorMensal: 118,
    inicio: INICIO,
    agora: dia('2027-03-10'),
  }).valor
);

// Nem um plano desconhecido cobra — falhar para o lado de não cobrar é a
// direção certa numa conta que pune.
checar(
  'plano desconhecido não cobra multa',
  0,
  multaDeSaida({ plano: 'trimestral', valorMensal: 118, inicio: INICIO, agora: dia('2027-01-10') }).valor
);

// ─────────────────── 2. os 30 dias de arrependimento ───────────────────────

bloco('2. Os primeiros 30 dias do anual não têm multa');

checar('no dia seguinte', 0, em('2026-09-11').valor);
checar('no 29º dia', 0, em('2026-10-08').valor);
checar('e o motivo é o arrependimento', 'arrependimento', em('2026-10-08').motivo);
// ⚠️ O TRIGÉSIMO DIA ESTÁ DENTRO. A primeira versão da régua usava `<` e
// cobrava R$ 116 de quem cancelou no dia exato que a tela prometeu livre —
// e num contrato de adesão a ambiguidade se resolve a favor de quem aderiu
// (CDC art. 47).
checar('no 30º dia ainda não', 0, em('2026-10-10').valor);
checar('e no 31º já sim', true, em('2026-10-11').devida);
checar('a régua são 30 dias', 30, DIAS_SEM_MULTA);

// ⚠️ ELE COBRE COM FOLGA O DIREITO DE 7 DIAS DO CDC (art. 49), que se aplica a
// contrato fechado dentro do app — fora de estabelecimento comercial.
checar('e o sétimo dia, que é o mínimo legal, está coberto', 0, em('2026-09-17').valor);

// ─────────────────────── 3. a multa cai sozinha ────────────────────────────

bloco('3. A multa cai sozinha, sem tabela decrescente');

// 20% do saldo restante. O teto de duas mensalidades (R$ 116) morde no mês 1.
// Mês 1 → 11 restantes → 11 × 58 = 638 → 20% = 127,60 → teto 116.
const m1 = em('2026-10-15');
checar('no mês 1 o saldo é de onze meses', 11, m1.mesesRestantes);
checar('e o teto morde', true, m1.tetoAplicado);
checar('cobrando duas mensalidades', 116, m1.valor);

// Mês 3 → 9 restantes → 522 → 20% = 104,40. Abaixo do teto.
const m3 = em('2026-12-15');
checar('no mês 3 restam nove', 9, m3.mesesRestantes);
checar('e a multa é R$ 104,40', 104.4, m3.valor);
checar('o teto não morde mais', false, m3.tetoAplicado);

// Mês 6 → 6 restantes → 348 → 69,60.
checar('no mês 6, R$ 69,60', 69.6, em('2027-03-15').valor);
// Mês 9 → 3 restantes → 174 → 34,80.
checar('no mês 9, R$ 34,80', 34.8, em('2027-06-15').valor);
// Mês 11 → 1 restante → 58 → 11,60.
checar('no mês 11, R$ 11,60', 11.6, em('2027-08-15').valor);

// ⚠️ A INVARIANTE QUE SUBSTITUI A TABELA DECRESCENTE.
// A intenção era que a multa caísse com o tempo de casa. Sobre o SALDO isso
// acontece sozinho — e é este varredor que prova, mês a mês, que não existe um
// ponto em que ela sobe. Uma segunda tabela seria duas réguas dizendo a mesma
// coisa, e é assim que elas divergem.
let subiu = null;
let anterior = Infinity;
for (let m = 1; m <= 12; m += 1) {
  const d = new Date(INICIO.getFullYear(), INICIO.getMonth() + m, 15, 12, 0, 0);
  const v = multaDeSaida({
    plano: PLANO.ANUAL,
    valorMensal: MENSAL_DO_ANUAL,
    inicio: INICIO,
    agora: d,
  }).valor;
  if (v > anterior) subiu = `mês ${m}: ${v} > ${anterior}`;
  anterior = v;
}
checar('a multa nunca sobe de um mês para o outro', null, subiu);

// ───────────────── 4. cumprir o compromisso zera a multa ───────────────────

bloco('4. Cumprido o compromisso, sair é livre');

const depoisDoAno = em('2027-09-15');
checar('no mês 12 não resta saldo', 0, depoisDoAno.mesesRestantes);
checar('e a multa é zero', 0, depoisDoAno.valor);
checar('com o motivo escrito', 'compromisso-cumprido', depoisDoAno.motivo);
checar('muito depois, idem', 0, em('2029-01-15').valor);
checar('o compromisso é de doze meses', 12, MESES_DE_CONTRATO);

// ───────────────── 5. o saldo usa o valor que ele PAGA ─────────────────────

bloco('5. O saldo usa o valor que ele paga hoje');

// ⚠️ COBRAR SOBRE A TABELA SERIA MULTAR SOBRE UM VALOR QUE ELE NUNCA PAGOU.
// Com preço por criança o valor muda todo mês, então não existe "o saldo"
// exato — existe a melhor estimativa, e ela é o que está na fatura dele.
const menor = multaDeSaida({
  plano: PLANO.ANUAL,
  valorMensal: 29,
  inicio: INICIO,
  agora: dia('2026-12-15'),
});
checar('operação menor, multa menor', 52.2, menor.valor);
checar('e o saldo é o dela', 261, menor.saldo);

checar('sem valor mensal, não há o que cobrar', 0,
  multaDeSaida({ plano: PLANO.ANUAL, valorMensal: 0, inicio: INICIO, agora: dia('2026-12-15') }).valor);

// ────────────────── 6. os meses cumpridos, e a virada ──────────────────────

bloco('6. O mês só conta quando passa o dia da assinatura');

// Assinou dia 10. No dia 9 do mês seguinte ainda não cumpriu um mês.
checar('no dia 9 do mês seguinte, zero meses', 0, mesesCumpridos(INICIO, dia('2026-10-09')));
checar('no dia 10, um mês', 1, mesesCumpridos(INICIO, dia('2026-10-10')));
checar('no dia 11, ainda um', 1, mesesCumpridos(INICIO, dia('2026-10-11')));
checar('seis meses depois', 6, mesesCumpridos(INICIO, dia('2027-03-10')));
checar('sem data, não dá para contar', null, mesesCumpridos(null, dia('2027-03-10')));

// ─────────────── 7. quanto cai se ele esperar mais um mês ──────────────────

bloco('7. Quanto cai se ele esperar');

// ⚠️ A TELA MOSTRA ISTO, E NÃO É PARA SEGURÁ-LO. É informação que só a
// plataforma tem e que joga a favor dele — esconder um número desses seria
// usar a assimetria de informação contra o cliente.
// Mês 3 (104,40) → mês 4 (8 restantes × 58 = 464 → 92,80). Queda de 11,60.
checar('esperar um mês economiza uma parcela da multa', 11.6,
  quedaNoProximoMes({ plano: PLANO.ANUAL, valorMensal: MENSAL_DO_ANUAL, inicio: INICIO, agora: dia('2026-12-15') }));
checar('no mensal não há queda porque não há multa', 0,
  quedaNoProximoMes({ plano: PLANO.MENSAL, valorMensal: 118, inicio: INICIO, agora: dia('2026-12-15') }));
checar('dentro do arrependimento também não', 0,
  quedaNoProximoMes({ plano: PLANO.ANUAL, valorMensal: MENSAL_DO_ANUAL, inicio: INICIO, agora: dia('2026-09-20') }));

// ─────────────────────── 8. as constantes da régua ─────────────────────────

bloco('8. As constantes');

checar('a multa é 20% do saldo', 0.2, FRACAO_DA_MULTA);
checar('o teto são duas mensalidades', 2, TETO_EM_MENSALIDADES);

// ⚠️ A COMPARAÇÃO QUE SUSTENTA O ARGUMENTO DE VENDA.
// A concorrência cobra 30% do saldo sobre um valor MAIOR. Se esta fração
// subir, a frase "a nossa é 20% contra os 30% deles" deixa de ser verdade — e
// ela está escrita no roteiro comercial.
checar('e ela é menor que os 30% da concorrência', true, FRACAO_DA_MULTA < 0.3);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
