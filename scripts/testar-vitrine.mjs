/**
 * A VITRINE DO PLANO — as contas que a tela de venda mostra ao lado do preço.
 *
 * POR QUE ESTE TESTE EXISTE
 * A tela de planos virou a tela de venda (04/10/2026): ela compara a conta
 * dele com a média do mercado, diz quanto o app pesa na receita e em que mês
 * do teste ele está. Número errado numa tela de venda é propaganda enganosa,
 * e comparação de preço é a parte que o CONAR e o CDC olham primeiro. O teste
 * trava as três coisas que não podem acontecer: a comparação aparecer quando
 * o app sai mais caro, a tela dizer o nome de um concorrente, e um "mês 0" ou
 * "mês 4" de teste.
 *
 * COMO RODAR
 *   node scripts/testar-vitrine.mjs      (ou: npm run testar:vitrine)
 */
import { readFileSync } from 'node:fs';
import {
  PRECO_DO_CONCORRENTE,
  MESES_DE_TESTE,
  comparacaoComOMercado,
  pesoNaReceita,
  receitaDaTurma,
  mesDoTeste,
  linhasDeDesconto,
} from '../src/dominio/associacao/vitrineDoPlano.js';
import { precoDoMes, PLANO } from '../src/dominio/associacao/planos.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome}\n      esperado: ${JSON.stringify(esperado)}\n      obtido:   ${JSON.stringify(obtido)}`);
  }
}

// ── o concorrente direto ──────────────────────────────────────────────────────
checar('a referência é o mensal do concorrente direto (7,90), não uma média', 7.9, PRECO_DO_CONCORRENTE.porCrianca);
// A multa do concorrente fica guardada para a comparação: a nossa (20%) é menor.
checar('a multa do anual do concorrente é 30%', 0.3, PRECO_DO_CONCORRENTE.multaDoAnual);
checar('a referência tem mês', true, /^\d{4}-\d{2}$/.test(PRECO_DO_CONCORRENTE.referencia));

const c17 = comparacaoComOMercado({ criancas: 17, liquido: 100.3 });
checar('17 crianças: o concorrente cobra 134,30', 134.3, c17?.mercado);
checar('17 crianças: deixa de gastar 34,00 no mês', 34, c17?.economiaMes);
checar('17 crianças: e 408,00 no ano', 408, c17?.economiaAno);
checar('sem criança não há comparação', null, comparacaoComOMercado({ criancas: 0, liquido: 0 }));
// Com o mínimo de R$ 49, uma criança sai mais cara que o mercado — e a tela
// não pode imprimir uma "economia" negativa nem zero.
checar('quando o app sai mais caro, a comparação some', null,
  comparacaoComOMercado({ criancas: 1, liquido: 49 }));
checar('empate também some', null,
  comparacaoComOMercado({ criancas: 2, liquido: 15.8 }));
checar('preço indefinido não compara', null, comparacaoComOMercado({ criancas: 5, liquido: null }));

// ── o peso na receita ───────────────────────────────────────────────────────
checar('R$ 100,30 sobre R$ 6.800 é 1,475%', 0.01475, Math.round(pesoNaReceita({ liquido: 100.3, receita: 6800 }) * 1e5) / 1e5);
checar('sem receita cadastrada, não há fração', null, pesoNaReceita({ liquido: 100, receita: 0 }));
checar('receita soma as mensalidades', 850,
  receitaDaTurma([{ monthlyFee: 400 }, { monthlyFee: '450' }, { monthlyFee: null }, {}]));
checar('turma vazia soma zero', 0, receitaDaTurma([]));

// ── o mês do teste ──────────────────────────────────────────────────────────
const inicio = new Date('2026-08-01T12:00:00-03:00');
const dia = (n) => new Date(inicio.getTime() + n * 86400000);
checar('o teste tem três meses', 3, MESES_DE_TESTE);
checar('dia 0 é o mês 1', 1, mesDoTeste({ inicio, agora: dia(0) }));
checar('dia 29 ainda é o mês 1', 1, mesDoTeste({ inicio, agora: dia(29) }));
checar('dia 30 é o mês 2', 2, mesDoTeste({ inicio, agora: dia(30) }));
checar('dia 89 é o mês 3', 3, mesDoTeste({ inicio, agora: dia(89) }));
checar('acabou o teste: não há mês 4', null, mesDoTeste({ inicio, agora: dia(95) }));
checar('relógio parado: não há mês 0', null, mesDoTeste({ inicio: null, agora: dia(5) }));

// ── as linhas de desconto ───────────────────────────────────────────────────
const comDesconto = precoDoMes({
  criancas: 20,
  plano: PLANO.MENSAL,
  indicacoesAtivas: 1,
  descontos: [{ origem: 'fechamento', fracao: 0.3, ate: null }],
  mes: '2026-10',
});
checar('fechamento e indicação viram duas linhas',
  ['Fechamento no teste', 'Indicações'],
  linhasDeDesconto(comDesconto).map((l) => l.rotulo));
checar('sem desconto, nenhuma linha', [],
  linhasDeDesconto(precoDoMes({ criancas: 20, plano: PLANO.MENSAL })));

// ── a tela nunca diz o nome de um concorrente ───────────────────────────────
const tela = readFileSync(new URL('../src/pages/tio/TioPlanos.jsx', import.meta.url), 'utf8');
for (const nome of ['Via Van', 'ViaVan', 'Rotasegura', 'Rota Segura', 'Van Inteligente', 'Van+', 'Tio da Van']) {
  checar(`a tela não cita "${nome}"`, false, tela.includes(nome));
}
checar('a tela usa a média do domínio, não um número à mão', true,
  tela.includes('comparacaoComOMercado') && !/134[,.]30|7[,.]90|9[,.]45/.test(tela));
checar('a tela imprime o mês da referência', true, tela.includes('PRECO_DO_CONCORRENTE.referencia'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
