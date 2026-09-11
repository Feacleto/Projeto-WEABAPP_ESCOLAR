/**
 * O ENCERRAMENTO DA ASSOCIAÇÃO — a saída do motorista.
 *
 * POR QUE ESTE TESTE EXISTE
 * Esta régua responde a quatro perguntas diferentes com o mesmo campo: se o
 * fechamento ainda fatura, quando a conta para, se dá para voltar atrás, e se
 * o desconto vitalício atravessa. Errar qualquer uma delas produz o mesmo tipo
 * de estrago — silencioso e do lado de quem está indo embora, que não reclama,
 * conta no portão.
 *
 * ⚠️ O BLOCO 1 TESTA UMA AUSÊNCIA, e é o mais caro do arquivo. Base antiga não
 * tem `renovacaoAutomatica`; se o ausente valer como "desligada", TODA conta
 * existente passa a estar encerrando sem ninguém ter pedido, e o fechamento
 * simplesmente deixa de emitir faturas — sem erro em lugar nenhum.
 *
 * ⚠️ O BLOCO 7 COMPARA O ESPELHO CASO A CASO. O deploy das functions não
 * alcança `src/`, então a régua existe duas vezes; duplicar só é aceitável com
 * um teste que rode os dois lados sobre a mesma entrada.
 *
 * COMO RODAR
 *   node scripts/testar-encerramento.mjs      (ou: npm run testar:encerramento)
 */

import {
  MODO,
  FAIXA_AVISO,
  FAIXA_URGENTE,
  renovacaoLigada,
  pediuEncerramento,
  modoDoPedido,
  fimDoPeriodoPago,
  fimDoCompromisso,
  fimDaAssociacao,
  diasAteOFim,
  associacaoEncerrada,
  podeReligar,
  pararDeFaturar,
  descontoAtravessa,
  avisoDoEncerramento,
} from '../src/dominio/associacao/encerramento.js';
import { PLANO } from '../src/dominio/associacao/planos.js';
import * as SERVIDOR from '../functions/lib/reguaDoEncerramento.js';

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
const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);

/** A conta de referência: contratou em 10/09/2026, coberta até 15/10/2026. */
const CONTRATADO_EM = dia('2026-09-10');
const COBERTO_ATE = dia('2026-10-15');

const mensal = (extra = {}) => ({
  plano: PLANO.MENSAL,
  contratadoEm: CONTRATADO_EM,
  assinaturaAte: COBERTO_ATE,
  ...extra,
});

const anual = (extra = {}) => ({
  plano: PLANO.ANUAL,
  contratadoEm: CONTRATADO_EM,
  assinaturaAte: COBERTO_ATE,
  ...extra,
});

const SAINDO = { renovacaoAutomatica: false };

// ══════════════════════════════════════════════════════════════════════════
bloco('1. AUSENTE É LIGADA — a base inteira não pode encerrar sozinha');
// ══════════════════════════════════════════════════════════════════════════

checar('sem o campo, a renovação está ligada', true, renovacaoLigada(mensal()));
checar('sem o campo, ninguém pediu para sair', false, pediuEncerramento(mensal()));
checar('sem o campo, o fechamento continua faturando', false, pararDeFaturar(mensal(), dia('2027-01-01')));
checar('sem o campo, não há aviso nenhum', null, avisoDoEncerramento(mensal(), dia('2026-10-01')));
checar('documento vazio também está ligado', true, renovacaoLigada({}));
checar('e `undefined` também', true, renovacaoLigada(undefined));

// ⚠️ SONDA POSITIVA: se o `false` explícito também fosse lido como ligada, os
// seis casos acima passariam com a régua inteira quebrada.
checar('e só o `false` explícito desliga', true, pediuEncerramento(mensal(SAINDO)));

// `true` explícito é o religar, e ele precisa valer tanto quanto a ausência.
checar('religou: a renovação volta a estar ligada', false, pediuEncerramento(mensal({ renovacaoAutomatica: true })));

// ══════════════════════════════════════════════════════════════════════════
bloco('2. O MENSAL — encerrar é operar até o fim do período já pago');
// ══════════════════════════════════════════════════════════════════════════

const M_SAINDO = mensal(SAINDO);

checar('o fim é a cobertura já paga', '2026-10-15', iso(fimDaAssociacao(M_SAINDO)));
checar('que é `assinaturaAte`', '2026-10-15', iso(fimDoPeriodoPago(M_SAINDO)));
checar('o mensal não tem compromisso para cumprir', null, fimDoCompromisso(M_SAINDO));
checar('e o modo é sempre "agora" — não há prazo a esperar', MODO.AGORA, modoDoPedido(M_SAINDO));

// ⚠️ "Não há nova cobrança a partir do encerramento" — cláusula 6.
checar('o fechamento para de faturar na varredura seguinte', true, pararDeFaturar(M_SAINDO, dia('2026-10-01')));
checar('inclusive no mesmo dia do pedido', true, pararDeFaturar(M_SAINDO, dia('2026-09-20')));

checar('antes da data, a conta ainda não encerrou', false, associacaoEncerrada(M_SAINDO, dia('2026-10-14')));
checar('no dia, encerrou', true, associacaoEncerrada(M_SAINDO, dia('2026-10-15')));
checar('e depois também', true, associacaoEncerrada(M_SAINDO, dia('2026-11-01')));

// ══════════════════════════════════════════════════════════════════════════
bloco('3. O ANUAL — os dois horizontes, e o padrão é o que não custa nada');
// ══════════════════════════════════════════════════════════════════════════

const A_PADRAO = anual(SAINDO);
const A_AGORA = anual({ ...SAINDO, encerramentoModo: MODO.AGORA });
const A_PRAZO = anual({ ...SAINDO, encerramentoModo: MODO.FIM_DO_PERIODO });

// ⚠️ O CASO QUE DECIDE DINHEIRO: sem modo escrito, ele cumpre o prazo e NÃO
// paga multa. Um campo que não chegou não pode virar cobrança.
checar('sem modo declarado, o anual cumpre o prazo', MODO.FIM_DO_PERIODO, modoDoPedido(A_PADRAO));
checar('e só o gesto explícito escolhe sair agora', MODO.AGORA, modoDoPedido(A_AGORA));

checar('cumprindo o prazo, o fim são os 12 meses', '2027-09-10', iso(fimDaAssociacao(A_PRAZO)));
checar('saindo agora, o fim é a cobertura paga', '2026-10-15', iso(fimDaAssociacao(A_AGORA)));

// ⚠️ ELE CONTINUA DEVENDO AS MENSALIDADES DO COMPROMISSO. Parar de faturar
// quem só avisou que não renova seria meia dúzia de meses de graça.
checar('quem cumpre o prazo continua sendo faturado', false, pararDeFaturar(A_PRAZO, dia('2027-03-01')));
checar('até o mês do fim', false, pararDeFaturar(A_PRAZO, dia('2027-09-01')));
checar('e depois dele, não', true, pararDeFaturar(A_PRAZO, dia('2027-10-01')));
checar('quem sai agora para de ser faturado já', true, pararDeFaturar(A_AGORA, dia('2026-10-01')));

// O mensal não muda de comportamento por causa do campo do anual.
checar('o modo escrito não atravessa para o mensal', MODO.AGORA, modoDoPedido(mensal({ ...SAINDO, encerramentoModo: MODO.FIM_DO_PERIODO })));

// ══════════════════════════════════════════════════════════════════════════
bloco('4. OS AVISOS SÃO FAIXAS — três, e a forma comunica a urgência');
// ══════════════════════════════════════════════════════════════════════════

const nivelEm = (motorista, quando) => avisoDoEncerramento(motorista, dia(quando))?.nivel ?? null;

checar('30 dias antes abre a faixa de aviso', 'aviso', nivelEm(A_PRAZO, '2027-08-12'));
checar('longe do fim, só o registro do pedido', 'pedido', nivelEm(A_PRAZO, '2027-01-01'));
checar('7 dias antes vira urgente', 'urgente', nivelEm(A_PRAZO, '2027-09-05'));
checar('no dia, encerrada', 'encerrada', nivelEm(A_PRAZO, '2027-09-10'));
checar('e depois continua encerrada', 'encerrada', nivelEm(A_PRAZO, '2027-12-01'));

checar('as faixas são 30 e 7', [30, 7], [FAIXA_AVISO, FAIXA_URGENTE]);

// ⚠️ PEDIU E NÃO DÁ PARA CALCULAR A DATA: o aviso continua saindo. O que não
// pode acontecer é ele não saber que pediu.
const SEM_DATA = { plano: PLANO.MENSAL, renovacaoAutomatica: false };
checar('sem `assinaturaAte`, o aviso ainda existe', 'pedido', nivelEm(SEM_DATA, '2026-10-01'));
checar('e a data vai nula, nunca inventada', null, avisoDoEncerramento(SEM_DATA, dia('2026-10-01')).fim);
checar('sem data, nada é dado por encerrado', false, associacaoEncerrada(SEM_DATA, dia('2030-01-01')));

checar('os dias contam para trás corretamente', 5, diasAteOFim(M_SAINDO, dia('2026-10-10')));

// ══════════════════════════════════════════════════════════════════════════
bloco('5. RELIGAR — a tela promete que voltar atrás não custa nada');
// ══════════════════════════════════════════════════════════════════════════

checar('antes da data, dá para religar', true, podeReligar(M_SAINDO, dia('2026-10-14')));
checar('na véspera do fim, ainda dá', true, podeReligar(M_SAINDO, dia('2026-10-14')));
checar('depois da data, não dá mais', false, podeReligar(M_SAINDO, dia('2026-10-16')));
checar('quem não pediu não tem o que religar', false, podeReligar(mensal(), dia('2026-10-01')));

// ══════════════════════════════════════════════════════════════════════════
bloco('6. O DESCONTO — "enquanto este contrato estiver vigente"');
// ══════════════════════════════════════════════════════════════════════════

checar('quem nunca pediu para sair mantém o desconto', true, descontoAtravessa(mensal(), dia('2030-01-01')));
checar('quem pediu mas ainda não acabou, mantém', true, descontoAtravessa(M_SAINDO, dia('2026-10-01')));
checar('depois do fim, o desconto não atravessa', false, descontoAtravessa(M_SAINDO, dia('2026-10-16')));
checar('religou a tempo: nada foi perdido', true, descontoAtravessa(mensal({ renovacaoAutomatica: true }), dia('2026-11-01')));

// ⚠️ ATRASO NÃO DERRUBA, SAIR DERRUBA — o mesmo critério do desconto de
// indicação. Quem atrasa nunca passa por aqui: ninguém desligou a renovação.
const ATRASADO = mensal({ suspenso: true, assinaturaAte: dia('2026-08-01') });
checar('o suspenso por atraso mantém o desconto', true, descontoAtravessa(ATRASADO, dia('2026-12-01')));
checar('e ele continua sendo faturado', false, pararDeFaturar(ATRASADO, dia('2026-12-01')));

// ══════════════════════════════════════════════════════════════════════════
bloco('7. O ESPELHO DO SERVIDOR — caso a caso, sobre a mesma entrada');
// ══════════════════════════════════════════════════════════════════════════

const CASOS = [
  ['nunca pediu, mensal', mensal(), '2026-10-01'],
  ['nunca pediu, anual', anual(), '2027-01-01'],
  ['mensal saindo, antes do fim', M_SAINDO, '2026-10-01'],
  ['mensal saindo, no dia', M_SAINDO, '2026-10-15'],
  ['mensal saindo, depois', M_SAINDO, '2026-11-20'],
  ['anual sem modo (cumpre o prazo)', A_PADRAO, '2027-01-01'],
  ['anual cumprindo o prazo, no meio', A_PRAZO, '2027-03-01'],
  ['anual cumprindo o prazo, depois do fim', A_PRAZO, '2027-10-01'],
  ['anual saindo agora', A_AGORA, '2026-10-01'],
  ['anual saindo agora, depois', A_AGORA, '2026-11-01'],
  ['pediu e não há data', SEM_DATA, '2026-10-01'],
  ['suspenso por atraso', ATRASADO, '2026-12-01'],
  ['documento vazio', {}, '2026-10-01'],
];

CASOS.forEach(([nome, motorista, quando]) => {
  const agora = dia(quando);
  checar(
    `${nome} — para de faturar`,
    pararDeFaturar(motorista, agora),
    SERVIDOR.pararDeFaturar(motorista, agora)
  );
  checar(
    `${nome} — o desconto atravessa`,
    descontoAtravessa(motorista, agora),
    SERVIDOR.descontoAtravessa(motorista, agora)
  );
  checar(
    `${nome} — a data do fim`,
    iso(fimDaAssociacao(motorista)),
    iso(SERVIDOR.fimDaAssociacao(motorista))
  );
  checar(
    `${nome} — o modo`,
    modoDoPedido(motorista),
    SERVIDOR.modoDoPedido(motorista)
  );
});

// ⚠️ SONDA POSITIVA DO ESPELHO: sem ela, um servidor que devolvesse sempre o
// mesmo valor passaria em todos os casos acima em que o app também devolve
// aquele valor. Aqui os dois lados precisam DISCORDAR de si mesmos.
checar(
  'o espelho distingue os dois modos',
  true,
  SERVIDOR.pararDeFaturar(A_AGORA, dia('2026-10-01')) !==
    SERVIDOR.pararDeFaturar(A_PRAZO, dia('2026-10-01'))
);
checar('e as constantes de modo batem', MODO, SERVIDOR.MODO);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
