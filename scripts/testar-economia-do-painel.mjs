/**
 * AS ABAS ECONOMIA E CALENDÁRIO DO PAINEL DO DONO — as contas puras.
 *
 * POR QUE ESTE TESTE
 * Calendário errado não dá erro: dá uma campanha na semana errada. E o
 * agrupamento por faixa que erra uma fronteira (8 ou 9?) move um motorista de
 * linha sem ninguém ver. As duas são puras, então ficam travadas aqui.
 *
 * COMO RODAR
 *   node scripts/testar-economia-do-painel.mjs
 */

import {
  TIPO,
  aulaDoMes,
  eventosDoAno,
  mesesDoAno,
  vemAi,
} from '../src/dominio/associacao/calendarioDoAno.js';
import {
  agruparPorFaixa,
  simularTurma,
  tabelaPorTamanho,
} from '../src/dominio/associacao/economiaDoPainel.js';
import { feriadosNacionais } from '../src/dominio/rota/calendario.js';
import { precoDaTabela } from '../src/dominio/associacao/planos.js';

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

const dataDe = (ano, nome) => eventosDoAno(ano).find((e) => e.nome === nome)?.data;

console.log('\n1. Datas calculadas de 2026');
checar('Dia das Mães = 10/05', '2026-05-10', dataDe(2026, 'Dia das Mães'));
checar('Dia dos Pais = 09/08', '2026-08-09', dataDe(2026, 'Dia dos Pais'));
checar('Black Friday = 27/11', '2026-11-27', dataDe(2026, 'Black Friday'));
checar('Carnaval (terça) = 17/02', true, eventosDoAno(2026).some((e) => e.nome === 'Carnaval' && e.data === '2026-02-17'));
checar('Sexta-feira Santa = 03/04', '2026-04-03', dataDe(2026, 'Sexta-feira Santa'));
checar('Páscoa = 05/04', '2026-04-05', dataDe(2026, 'Páscoa'));
checar('Dia do Motorista fixo', '2026-07-25', dataDe(2026, 'Dia do Motorista'));
checar('Halloween fixo', '2026-10-31', dataDe(2026, 'Halloween'));

console.log('\n2. Feriados vêm de calendario.js');
const doModulo = Object.keys(feriadosNacionais(2026)).length;
const nosEventos = eventosDoAno(2026).filter((e) => e.tipo === TIPO.FERIADO).length;
checar('mesma quantidade de feriados', doModulo, nosEventos);
checar('Tiradentes presente', '2026-04-21', dataDe(2026, 'Tiradentes'));

console.log('\n3. Ordem e forma');
const lista = eventosDoAno(2026);
checar('ordem cronológica', true, lista.every((e, i) => i === 0 || lista[i - 1].data <= e.data));
checar('todo evento tem tipo conhecido', true, lista.every((e) => Object.values(TIPO).includes(e.tipo)));
checar('toda estimativa é de escola', true, lista.filter((e) => e.estimativa).every((e) => e.tipo === TIPO.ESCOLA));
checar('Black Friday aparece como data e como nota do negócio', 2, lista.filter((e) => e.data === '2026-11-27').length);

console.log('\n4. Vem aí, com data injetada');
const v1 = vemAi(new Date(2026, 9, 5), 3).map((e) => e.data);
checar('a partir de 05/10/2026: Professor, Aparecida, Halloween', ['2026-10-12', '2026-10-15', '2026-10-31'], v1);
checar('o próprio dia conta', '2026-05-10', vemAi(new Date(2026, 4, 10), 1)[0].data);
const v2 = vemAi(new Date(2026, 11, 26), 3).map((e) => e.data);
checar('atravessa a virada do ano', true, v2[0] >= '2026-12-26' && v2.some((d) => d.startsWith('2027')));
checar('nunca traz nota do negócio nem estimativa', true,
  vemAi(new Date(2026, 0, 1), 40).every((e) => e.tipo !== TIPO.NEGOCIO && !e.estimativa));

console.log('\n5. Quanto tem aula');
const meses = mesesDoAno(2026);
checar('doze meses', 12, meses.length);
checar('janeiro sem aula', 0, aulaDoMes(2026, 1).aula);
checar('março com aula quase cheia', true, aulaDoMes(2026, 3).fracao > 0.9);
checar('julho cai por causa do recesso', true, aulaDoMes(2026, 7).fracao < 0.6);
checar('dezembro cai', true, aulaDoMes(2026, 12).fracao < 0.8);
checar('fração entre 0 e 1', true, meses.every((m) => m.fracao >= 0 && m.fracao <= 1));
checar('todo evento cai no mês certo', true,
  meses.every((m) => m.eventos.every((e) => Number(e.data.slice(5, 7)) === m.mes)));
checar('o negócio de julho está na lista', true, meses[6].eventos.some((e) => e.tipo === TIPO.NEGOCIO));

console.log('\n6. Agrupamento por faixa');
const base = [
  { criancas: 0, pagaria: 99 },
  { criancas: 1, pagaria: 49 },
  { criancas: 8, pagaria: 49 },
  { criancas: 9, pagaria: 53.1 },
  { criancas: 20, pagaria: 118 },
  { criancas: 21, pagaria: 123.9 },
  { criancas: 40, pagaria: 236 },
  { criancas: 41, pagaria: 240.9 },
  { criancas: 60, pagaria: null },
];
const f = agruparPorFaixa(base);
checar('quatro faixas', 4, f.length);
checar('1–8 pega 1 e 8, e ignora zero criança', { motoristas: 2, criancas: 9, pagaria: 98 },
  { motoristas: f[0].motoristas, criancas: f[0].criancas, pagaria: f[0].pagaria });
checar('9–20 pega 9 e 20', [2, 29], [f[1].motoristas, f[1].criancas]);
checar('21–40 pega 21 e 40', [2, 61], [f[2].motoristas, f[2].criancas]);
checar('40+ começa na 41ª', [2, 101], [f[3].motoristas, f[3].criancas]);
checar('pagaria null soma zero', 240.9, f[3].pagaria);
checar('entrada vazia não quebra', [0, 0, 0, 0], agruparPorFaixa().map((x) => x.motoristas));
checar('entrada nula não quebra', 4, agruparPorFaixa(null).length);

console.log('\n7. Simulador e tabela');
const s10 = simularTurma({ criancas: 10, plano: 'mensal', escada: 0 });
checar('10 crianças mensal = tabela', precoDaTabela({ criancas: 10, plano: 'mensal' }), s10.liquido);
checar('por criança', Math.round((s10.liquido / 10) * 100) / 100, s10.porCrianca);
const s30 = simularTurma({ criancas: 10, plano: 'mensal', escada: 0.3 });
checar('30% de escada baixa a fatura', true, s30.liquido < s10.liquido);
const sPiso = simularTurma({ criancas: 5, plano: 'anual', escada: 0.3 });
checar('escada é ignorada no anual', precoDaTabela({ criancas: 5, plano: 'anual' }), sPiso.liquido);
const sPiso2 = simularTurma({ criancas: 1, plano: 'mensal', escada: 0.3, indicacoes: 10 });
checar('o piso segura o desconto quando morde', true, sPiso2.pisoAplicado === true && sPiso2.liquido === 19);
checar('sem desconto o piso não morde', false, s10.pisoAplicado);
checar('peso na receita usa a mensalidade', true,
  Math.abs(simularTurma({ criancas: 10, mensalidade: 300 }).peso - s10.liquido / 3000) < 1e-9);
checar('zero criança não divide por zero', null, simularTurma({ criancas: 0 }).porCrianca);
const tab = tabelaPorTamanho();
checar('tabela tem nove tamanhos', 9, tab.length);
checar('tabela bate com precoDaTabela', true,
  tab.every((l) => l.mensal === precoDaTabela({ criancas: l.criancas, plano: 'mensal' }) &&
    l.anual === precoDaTabela({ criancas: l.criancas, plano: 'anual' })));
checar('preço nunca desce com o tamanho', true, tab.every((l, i) => i === 0 || l.mensal >= tab[i - 1].mensal));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((x) => console.log('  ✗ ' + x));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
