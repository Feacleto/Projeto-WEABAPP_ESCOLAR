/**
 * O CALENDÁRIO DAS FALTAS DA AUXILIAR E DOS DIAS DA SUBSTITUTA (05/10/2026).
 *
 *   node scripts/testar-calendario-da-auxiliar.mjs
 *   (ou: npm run testar:calendario-da-auxiliar)
 *
 * Régua pura (`dominio/identidade/calendarioDaAuxiliar.js`): mês vazio, falta
 * sem substituta, a auxiliar com dois tios (cada um vê só a perua dele), a
 * virada do mês e o fuso — e os totais batendo com `resumoDoMes`, que é a
 * conta do "Controle de {mês}" na mesma tela. Por leitura de arquivo: o
 * componente não abre escuta própria e a tela usa as faltas que já escuta.
 */
import { readFileSync } from 'node:fs';
import { calendarioDaAuxiliar, calendarioDaSubstituta, quandoDoDia } from '../src/dominio/identidade/calendarioDaAuxiliar.js';
import { resumoDoMes, idDaFalta } from '../src/dominio/identidade/faltaDaAuxiliar.js';
import { getDateKey } from '../src/dominio/rota/horarios.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(nome); console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const falta = (tio, aux, nomeAux, dateKey, sub = null) => ({
  id: idDaFalta(tio, aux, dateKey), motoristaUid: tio, auxiliarUid: aux, nomeDaAuxiliar: nomeAux, dateKey, substituta: sub,
});
const joana = (valor) => ({ id: 's1', nome: 'Joana Lima', telefone: '11977771234', valor });
const lia = (valor) => ({ id: 's2', nome: 'Lia', telefone: '11966665555', valor });

const faltas = [
  falta('tioA', 'cida', 'Cida Souza', '2026-10-02', joana(80)),
  falta('tioA', 'cida', 'Cida Souza', '2026-10-09'),
  falta('tioA', 'rose', 'Rose', '2026-10-09', joana(90.5)),
  falta('tioA', 'rose', 'Rose', '2026-10-20', lia(70)),
  falta('tioA', 'cida', 'Cida Souza', '2026-09-30', lia(75)),
  falta('tioA', 'cida', 'Cida Souza', '2026-10-31', joana(85)),
  falta('tioA', 'cida', 'Cida Souza', '2026-11-01'),
  // A Cida também trabalha para o tio B, que registrou uma falta dela.
  falta('tioB', 'cida', 'Cida Souza', '2026-10-15', joana(100)),
];

console.log('\n1. mês vazio');
{
  const c = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-08' });
  checar('nenhum dia marcado', 0, c.dias.length);
  checar('totais zerados', { faltas: 0, comSubstituta: 0, gasto: 0 }, c.totais);
  checar('agosto/2026 tem 31 dias na grade', 31, c.semanas.flat().filter(Boolean).length);
  checar('agosto/2026 começa no sábado (6 vazios antes)', 6, c.semanas[0].indexOf(c.semanas[0].find(Boolean)));
  checar('toda semana tem 7 casas', true, c.semanas.every((s) => s.length === 7));
  checar('lista vazia não quebra', 0, calendarioDaAuxiliar(null, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-10' }).dias.length);
  checar('mês inválido não monta grade', 0, calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: 'outubro' }).semanas.length);
  checar('sem tio, nada (não mostra a lista de ninguém)', 0, calendarioDaAuxiliar(faltas, { auxiliarUid: 'cida', monthKey: '2026-10' }).dias.length);
}

console.log('\n2. a auxiliar: falta com e sem substituta');
const cida = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-10' });
checar('os dias dela em outubro', ['2026-10-02', '2026-10-09', '2026-10-31'], cida.dias.map((d) => d.dateKey));
checar('com substituta: o nome dela', 'Faltou · Substituta: Joana', cida.dias[0].linha);
checar('com substituta: o valor do dia', 80, cida.dias[0].valor);
checar('sem substituta: diz isso', 'Faltou · sem substituta', cida.dias[1].linha);
checar('sem substituta: sem valor', null, cida.dias[1].valor);
checar('o dia escrito com a semana', 'sexta, 02/10', cida.dias[0].quando);
checar('a casa da grade sabe que está marcada', true, cida.semanas.flat().find((c) => c?.dateKey === '2026-10-09')?.marcado);
checar('dia sem falta fica desmarcado', false, cida.semanas.flat().find((c) => c?.dateKey === '2026-10-10')?.marcado);
checar('a falta da Rose no mesmo dia não entra no da Cida', 'Faltou · sem substituta',
  cida.semanas.flat().find((c) => c?.dateKey === '2026-10-09')?.linha);

console.log('\n3. dois tios: cada um vê só a perua dele');
checar('o tio A não vê o dia 15 (falta registrada pelo tio B)', false, cida.dias.some((d) => d.dateKey === '2026-10-15'));
const cidaB = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioB', auxiliarUid: 'cida', monthKey: '2026-10' });
checar('o tio B vê só o dia 15', ['2026-10-15'], cidaB.dias.map((d) => d.dateKey));
checar('o gasto do tio B não leva o do tio A', 100, cidaB.totais.gasto);
checar('o id da falta é escopado pelo tio', true, faltas.filter((f) => f.motoristaUid === 'tioB').every((f) => f.id.startsWith('tioB_')));
const joanaA = calendarioDaSubstituta(faltas, { motoristaUid: 'tioA', substitutaId: 's1', monthKey: '2026-10' });
checar('a substituta pelo tio A também não vê o dia do tio B', false, joanaA.dias.some((d) => d.dateKey === '2026-10-15'));

console.log('\n4. a substituta: os dias que ela cobriu');
checar('os dias da Joana em outubro', ['2026-10-02', '2026-10-09', '2026-10-31'], joanaA.dias.map((d) => d.dateKey));
checar('no lugar de quem', 'Cobriu a falta de Cida', joanaA.dias[0].linha);
checar('o dia 9 foi pela Rose (a Cida faltou sem substituta)', 'Cobriu a falta de Rose', joanaA.dias[1].linha);
checar('quantos dias e quanto', { dias: 3, gasto: 255.5 }, joanaA.totais);
const dupla = calendarioDaSubstituta([
  falta('tioA', 'cida', 'Cida', '2026-10-05', joana(80)),
  falta('tioA', 'rose', 'Rose', '2026-10-05', joana(60)),
], { motoristaUid: 'tioA', substitutaId: 's1', monthKey: '2026-10' });
checar('cobrir as duas no mesmo dia: um dia, uma linha', ['Cobriu a falta de Cida e Rose'], dupla.dias.map((d) => d.linha));
checar('e o valor dos dois', 140, dupla.dias[0].valor);
checar('sem id de substituta, nada', 0, calendarioDaSubstituta(faltas, { motoristaUid: 'tioA', monthKey: '2026-10' }).dias.length);

console.log('\n5. os totais são os de resumoDoMes (a conta do "Controle de {mês}")');
const doA = faltas.filter((f) => f.motoristaUid === 'tioA');
const r = resumoDoMes(doA, '2026-10');
const rose = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'rose', monthKey: '2026-10' });
checar('as faltas de cada uma somam o total do Controle', r.totalDeFaltas, cida.totais.faltas + rose.totais.faltas);
checar('o gasto de cada uma soma o gasto do Controle', r.total, Math.round((cida.totais.gasto + rose.totais.gasto) * 100) / 100);
checar('as faltas dela batem com a linha dela no Controle', r.porAuxiliar.find((a) => a.auxiliarUid === 'cida').faltas, cida.totais.faltas);
const liaA = calendarioDaSubstituta(faltas, { motoristaUid: 'tioA', substitutaId: 's2', monthKey: '2026-10' });
checar('o gasto das substitutas soma o gasto do Controle', r.total, Math.round((joanaA.totais.gasto + liaA.totais.gasto) * 100) / 100);
checar('a régua chama resumoDoMes (não recalcula)', true, ler('src/dominio/identidade/calendarioDaAuxiliar.js').includes('resumoDoMes(delas, monthKey)')
  && ler('src/dominio/identidade/calendarioDaAuxiliar.js').includes('resumoDoMes(cobertas, monthKey)'));

console.log('\n6. a virada do mês');
checar('31/10 fica em outubro', true, cida.dias.some((d) => d.dateKey === '2026-10-31'));
checar('30/09 não entra em outubro', false, cida.dias.some((d) => d.dateKey === '2026-09-30'));
const nov = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-11' });
checar('1º/11 fica em novembro', ['2026-11-01'], nov.dias.map((d) => d.dateKey));
const set = calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-09' });
checar('30/09 fica em setembro, com a Lia', ['Faltou · Substituta: Lia'], set.dias.map((d) => d.linha));
const dez = calendarioDaAuxiliar([falta('tioA', 'cida', 'Cida', '2026-12-31'), falta('tioA', 'cida', 'Cida', '2027-01-01')],
  { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-12' });
checar('a virada do ano: 31/12 em dezembro, 1º/01 fora', ['2026-12-31'], dez.dias.map((d) => d.dateKey));
const fev = calendarioDaAuxiliar([], { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2028-02' });
checar('fevereiro bissexto tem 29 dias', 29, fev.semanas.flat().filter(Boolean).length);

console.log('\n7. o fuso de Brasília');
const tzAntes = process.env.TZ;
const grade = () => calendarioDaAuxiliar(faltas, { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-10' });
const formato = (c) => ({ inicio: c.semanas[0].findIndex(Boolean), ultimo: c.semanas.at(-1).filter(Boolean).at(-1)?.dateKey, quando: c.dias.map((d) => d.quando) });
process.env.TZ = 'America/Sao_Paulo';
const emBrasilia = formato(grade());
checar('outubro/2026 começa na quinta (em Brasília)', 4, emBrasilia.inicio);
checar('o último dia é 31/10', '2026-10-31', emBrasilia.ultimo);
// A falta é gravada com `getDateKey()` no aparelho dele. 23h30 de 31/10 em
// Brasília já é 1º/11 em UTC — e a falta continua sendo de outubro.
const tarde = new Date('2026-11-01T02:30:00Z');
checar('23h30 de 31/10 em Brasília grava 2026-10-31', '2026-10-31', getDateKey(tarde));
checar('e cai em outubro no calendário', true,
  calendarioDaAuxiliar([falta('tioA', 'cida', 'Cida', getDateKey(tarde))], { motoristaUid: 'tioA', auxiliarUid: 'cida', monthKey: '2026-10' }).dias.length === 1);
for (const tz of ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo']) {
  process.env.TZ = tz;
  checar(`a grade é a mesma em ${tz}`, emBrasilia, formato(grade()));
}
process.env.TZ = 'Pacific/Honolulu';
checar('a sonda: converter a chave em Date local escorrega o dia (por isso a régua não faz)', 3, new Date('2026-10-01').getDay());
if (tzAntes === undefined) delete process.env.TZ; else process.env.TZ = tzAntes;
checar('quandoDoDia lixo vira vazio', '', quandoDoDia('ontem'));

console.log('\n8. a tela: sem escuta nova, e o calendário no cartão de cada auxiliar');
const comp = semComentarios(ler('src/components/auxiliar/CalendarioDaAuxiliar.jsx'));
checar('o componente não importa service nem Firestore', false, /services\/|firebase\//.test(comp));
checar('o componente usa a régua', true, comp.includes('calendarioDaAuxiliar(') && comp.includes('calendarioDaSubstituta('));
checar('o mês começa no getDateKey da gravação', true, comp.includes('getDateKey().slice(0, 7)'));
checar('abre numa folha (o voltar do celular fecha)', true, comp.includes('<Sheet'));
checar('não anda para depois do mês corrente', true, comp.includes('mes < mesAtual'));
const tela = semComentarios(ler('src/pages/tio/TioAuxiliar.jsx'));
checar('a tela abre o calendário com as faltas que já escuta', true,
  tela.includes('<CalendarioDaAuxiliar') && tela.includes('faltas={faltas}') && tela.includes('useSubstitutas()'));
checar('a tela não abre escuta nova sobre as faltas', false, /watchFaltas/.test(tela));
checar('"Calendário de faltas" no cartão', true, tela.includes('Calendário de faltas'));
checar('a tela mora atrás da senha (/tio/finance/...)', true, ler('src/App.jsx').includes('finance/auxiliar'));
const subs = semComentarios(ler('src/pages/tio/TioSubstitutas.jsx'));
checar('"Dias que cobriu" em cada substituta, com as faltas que a tela já escuta', true,
  subs.includes('Dias que cobriu') && subs.includes('<CalendarioDaAuxiliar') && subs.includes('substituta={') && subs.includes('faltas={faltas}'));
checar('a lista de substitutas não abre escuta nova sobre as faltas', false, /watchFaltas/.test(subs));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
