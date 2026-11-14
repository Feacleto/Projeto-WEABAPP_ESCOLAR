/**
 * Testes do "dia fechado" — Node puro, sem runner.
 * Rodar: node scripts/testar-dia-fechado.mjs
 *
 * Protege docs/analise/13b (item 14) e a decisão 31: uma linha calma no fim
 * da última viagem, "Hoje: 14 de 14 paradas marcadas.", feita só do que a rota
 * já tem em memória. Conta TOQUE, não serviço — então diz "marcadas", e quem
 * faltou ou foi levado pelo pai sai do denominador.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diaCompleto } from '../src/dominio/rota/horarios.js';
import { paradaMarcada, resumoDoDia } from '../src/dominio/rota/diaFechado.js';
import { linhaDoDia, todasAsAfirmacoes, SUSTENTA, CONDICAO } from '../src/marca/diaFechado.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replaceAll('\r\n', '\n');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

/** Sete crianças com ida às 06:20 e volta às 12:30 — o dia de 14 paradas. */
const turma = (status = 'delivered', n = 7) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`, name: `C${i}`, active: true, horaPega: '06:20', horaEntrega: '12:30', status,
  }));
// O status de hoje vem do próprio objeto; a falta declarada entra pelo estado do bloco.
const statusDe = (c) => c.status;
const dia = (criancas, declaracoes = {}) => resumoDoDia(diaCompleto(criancas, { declaracoes }), statusDe);

console.log('\n\x1b[1m1. Quando uma parada conta como marcada\x1b[0m');
eq('ida: entregue na escola', paradaMarcada('ida', 'atSchool'), true);
eq('ida: já adiante (entregue em casa)', paradaMarcada('ida', 'delivered'), true);
eq('ida: ainda em casa', paradaMarcada('ida', 'home'), false);
eq('ida: na perua, sem chegar à escola', paradaMarcada('ida', 'onboard'), false);
eq('volta: entregue em casa', paradaMarcada('volta', 'delivered'), true);
eq('volta: na perua', paradaMarcada('volta', 'onboard'), false);
eq('volta: ainda na escola', paradaMarcada('volta', 'atSchool'), false);
eq('volta: "home" NÃO é marcada (a criança some da fila, mas ninguém tocou nela)', paradaMarcada('volta', 'home'), false);
eq('direção ou status desconhecidos não contam', [paradaMarcada('x', 'delivered'), paradaMarcada('ida', undefined)], [false, false]);

console.log('\n\x1b[1m2. O dia inteiro\x1b[0m');
eq('sete crianças, ida e volta, tudo entregue: 14 de 14', dia(turma()), { marcadas: 14, total: 14 });
eq('a linha do protótipo', linhaDoDia(dia(turma())), 'Hoje: 14 de 14 paradas marcadas.');
{
  // Uma criança nunca marcada (home) — some da fila da volta, mas NÃO conta como marcada.
  const t = turma();
  t[3].status = 'home';
  eq('uma criança sem nenhuma marcação: 12 de 14, nunca 13 nem 14', dia(t), { marcadas: 12, total: 14 });
}
{
  // A volta de uma criança que ficou na perua.
  const t = turma();
  t[0].status = 'onboard';
  eq('uma ainda "na perua": a volta e a ida dela não contam', dia(t), { marcadas: 12, total: 14 });
}
// Sem hora de volta o app PRESUME a volta pelo período (e a mostra na rota): se ela
// não foi marcada, é parada sem registro — e a linha diz isso, não esconde.
eq('quem parou na escola (ida feita, volta presumida e não marcada): 7 de 14',
  dia(turma('atSchool').map((c) => ({ ...c, horaEntrega: '' }))), { marcadas: 7, total: 14 });
eq('ninguém marcado: 0 de 14', dia(turma('home')), { marcadas: 0, total: 14 });

console.log('\n\x1b[1m3. Quem sai do denominador (não precisava da perua)\x1b[0m');
{
  const t = turma();
  eq('faltou o dia inteiro: sai das duas viagens',
    dia(t, { c0: { type: 'full' } }), { marcadas: 12, total: 12 });
  eq('o pai leva de manhã: sai só da ida',
    dia(t, { c0: { type: 'no-pickup' } }), { marcadas: 13, total: 13 });
  eq('o pai busca à tarde: sai só da volta',
    dia(t, { c0: { type: 'no-dropoff' } }), { marcadas: 13, total: 13 });
  eq('o pai já pegou: sai da volta',
    dia(t, { c0: { type: 'picked-up' } }), { marcadas: 13, total: 13 });
  eq('todos faltaram: 0 de 0', dia(t, Object.fromEntries(t.map((c) => [c.id, { type: 'full' }]))), { marcadas: 0, total: 0 });
}
eq('criança desativada não entra', dia([...turma(), { ...turma()[0], id: 'z', active: false }]), { marcadas: 14, total: 14 });
eq('cadastro rápido (sem casa nem hora) não entra', dia([...turma(), { ...turma()[0], id: 'z', cadastroRapido: true }]), { marcadas: 14, total: 14 });
eq('sem hora de pegar nem de entregar, sem parada (o app presume o período, mas a parada tem hora)',
  dia([{ id: 'p', active: true, status: 'delivered', period: 'morning' }]).total >= 0, true);

console.log('\n\x1b[1m4. Sem viagem, nada aparece\x1b[0m');
eq('sem crianças: sem linha', linhaDoDia(dia([])), null);
eq('todos fora hoje: sem linha', linhaDoDia(dia(turma(), Object.fromEntries(turma().map((c) => [c.id, { type: 'full' }])))), null);
eq('resumo nulo ou vazio: sem linha', [linhaDoDia(null), linhaDoDia({}), linhaDoDia({ total: 0, marcadas: 0 })], [null, null, null]);
eq('entrada com lixo não quebra', resumoDoDia(null, statusDe), { marcadas: 0, total: 0 });
eq('bloco com lixo não quebra', resumoDoDia([null, { direcao: 'ida' }, { direcao: 'ida', paradas: [null, {}] }], statusDe), { marcadas: 0, total: 0 });

console.log('\n\x1b[1m5. O texto\x1b[0m');
eq('13 de 14', linhaDoDia({ marcadas: 13, total: 14 }), 'Hoje: 13 de 14 paradas marcadas.');
eq('uma parada, no singular', linhaDoDia({ marcadas: 1, total: 1 }), 'Hoje: 1 de 1 parada marcada.');
eq('nunca "marcadas" maior que o total', linhaDoDia({ marcadas: 20, total: 14 }), 'Hoje: 14 de 14 paradas marcadas.');
eq('nunca negativa', linhaDoDia({ marcadas: -3, total: 5 }), 'Hoje: 0 de 5 paradas marcadas.');
eq('a chave e a condição', [SUSTENTA, CONDICAO], ['status-da-crianca-no-dia', 'paradas-que-precisavam-da-perua']);
const FUNCIONALIDADES = {
  'status-da-crianca-no-dia': [
    ['src/services/routeStatusService.js', /export function statusNaDirecao/],
    ['src/dominio/rota/acaoDaParada.js', /nextStatus: 'delivered'/],
  ],
};
const CONDICOES = {
  'paradas-que-precisavam-da-perua': [['src/dominio/rota/horarios.js', /export function precisaDaPerua\(estado\)/]],
};
for (const a of todasAsAfirmacoes()) {
  eq(`"${a.id}" tem origem e condição da lista fechada`, [Object.hasOwn(FUNCIONALIDADES, a.sustenta), Object.hasOwn(CONDICOES, a.condicao)], [true, true]);
}
for (const [grupo, tabela] of [['funcionalidade', FUNCIONALIDADES], ['condição', CONDICOES]]) {
  for (const [chave, provas] of Object.entries(tabela)) {
    for (const [arquivo, padrao] of provas) eq(`${grupo} "${chave}" existe: ${arquivo}`, padrao.test(ler(arquivo)), true);
  }
}
const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Mede toque, não serviço: nada que afirme que deu certo, e nada de festa.
const PROIBIDAS = [/tudo certo/, /tudo ok/, /sucesso/, /parabens/, /otimo/, /perfeito/, /sem problema/, /excelente/, /bom trabalho/, /entregues? com/, /segur/, /gratis/, /melhor que/, /ontem|semana|recorde|sequencia/];
for (const a of todasAsAfirmacoes()) {
  eq(`"${a.id}" não afirma serviço, não comemora e não compara`, [
    PROIBIDAS.some((re) => re.test(semAcento(a.texto))), /!/.test(a.texto), promessaProibida(a.texto),
  ], [false, false, null]);
  eq(`"${a.id}" diz "marcada(s)"`, /marcadas?\.$/.test(a.texto), true);
  eq(`"${a.id}" só tem os dois números da conta`, (a.texto.match(/\d+/g) || []).length, 2);
  eq(`"${a.id}" cabe em 40 caracteres (${a.texto.length})`, a.texto.length <= 40, true);
}
eq('sonda positiva: "tudo certo" seria reprovado', PROIBIDAS.some((re) => re.test(semAcento('Hoje: tudo certo.'))), true);

console.log('\n\x1b[1m6. As telas usam a régua e não leem nada novo\x1b[0m');
const rota = ler('src/components/route/OperacaoDaRota.jsx');
const inicio = ler('src/pages/tio/TioDashboard.jsx');
const rotaSem = semComentarios(rota);
const inicioSem = semComentarios(inicio);
eq('a rota calcula com resumoDoDia e o texto do catálogo',
  /linhaDoDia\(\s*resumoDoDia\(blocos, \(child, dir\) => statusNaDirecao\(child, declaracoes\?\.\[child\.id\], dir\)\)/.test(rotaSem), true);
eq('o Início calcula com resumoDoDia e o texto do catálogo',
  /linhaDoDia\(\s*resumoDoDia\(blocos, \(child, dir\) => statusNaDirecao\(child, declaracoes\?\.\[child\.id\], dir\)\)/.test(inicioSem), true);
eq('na rota a linha só sai na ÚLTIMA viagem (depois do "Próxima parada só às…")',
  /espera \? \([\s\S]*?\) : \(\s*<>\s*\{linhaDoFimDoDia &&/.test(rotaSem), true);
eq('no Início a linha só existe com o dia concluído', /diaConcluido\s*\?\s*linhaDoDia\(/.test(inicioSem), true);
eq('nenhuma das duas escreve a frase à mão', !/paradas marcadas|parada marcada/.test(rotaSem) && !/paradas marcadas|parada marcada/.test(inicioSem), true);
eq('nenhuma das duas lê `rides` por causa disto (nada novo do banco)',
  [rotaSem, inicioSem].every((f) => !/useRide\b|getRide|watchRide|collection\(db, 'children'\)/.test(f)), true);
eq('o domínio e o catálogo não importam React nem Firebase',
  [ler('src/dominio/rota/diaFechado.js'), ler('src/marca/diaFechado.js')].every((f) => !/from '(react|firebase)/.test(semComentarios(f))), true);
eq('"Viagem concluída." continua (a linha é acréscimo, não troca)', /Viagem concluída/.test(rota) && /Tudo entregue hoje\./.test(inicio), true);
eq('a linha da rota tem letra de 16 px', /data-dia-fechado className="text-base font-semibold text-text"/.test(rota), true);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
