/**
 * Testes do aviso "os contratos acabam" — Node puro, sem runner.
 * Rodar: node scripts/testar-contratos-que-vencem.mjs
 *
 * Protege docs/analise/13-lotes-de-implementacao.md §2 (RC1.1): a vigência
 * padrão acaba em 31/12 e, fora dela, o servidor não gera a mensalidade. O
 * aviso conta as famílias que PERDERIAM parcela, só dentro dos 60 dias, e o
 * texto só diz o que o app cumpre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  contratosQueVencem,
  mesDentroDaVigencia,
  primeiroMesSemParcela,
  DIAS_DE_ANTECEDENCIA,
} from '../src/dominio/cobranca/contratosQueVencem.js';
import { vigenciaPadrao } from '../src/dominio/cobranca/contratoDaFamilia.js';
import { linhasDoAviso, todasAsAfirmacoes, nomeDoMes, diaEMes } from '../src/marca/contratosQueVencem.js';
import { promessaProibida } from '../src/marca/promessas.js';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

const dia = (a, m, d) => new Date(a, m - 1, d, 12, 0, 0);

/** Uma criança que perderia parcela: tudo o que o servidor exige. */
const crianca = (extra = {}) => ({
  id: 'c1', active: true, parentUid: 'pai1', monthlyFee: 300,
  vigenciaInicio: '2026-03-10', vigenciaFim: '2026-12-31', ...extra,
});

console.log('\n\x1b[1m1. A janela de 60 dias (hoje injetado)\x1b[0m');
eq('a janela é de 60 dias', DIAS_DE_ANTECEDENCIA, 60);
eq('61 dias antes (31/10): não avisa', contratosQueVencem([crianca()], dia(2026, 10, 31)), { vencem: null, vencidos: null });
eq('60 dias antes (01/11): avisa, no limite', contratosQueVencem([crianca()], dia(2026, 11, 1)).vencem?.dias, 60);
eq('47 dias antes (14/11): avisa', contratosQueVencem([crianca()], dia(2026, 11, 14)).vencem?.dias, 47);
eq('no último dia (31/12): ainda avisa, como "acaba"', contratosQueVencem([crianca()], dia(2026, 12, 31)).vencem?.dias, 0);
eq('em março, bem antes: nada', contratosQueVencem([crianca()], dia(2026, 3, 20)), { vencem: null, vencidos: null });

console.log('\n\x1b[1m2. O que ele diz: quantas, quando acaba, quando falta parcela\x1b[0m');
{
  const r = contratosQueVencem([crianca()], dia(2026, 11, 14)).vencem;
  eq('uma família, o fim e o mês que fica sem parcela',
    [r.familias, r.criancas, r.primeiroFim, r.ultimoFim, r.primeiroMesSemParcela], [1, 1, '2026-12-31', '2026-12-31', '2027-01']);
}
{
  const turma = [crianca({ id: 'a', parentUid: 'p1' }), crianca({ id: 'b', parentUid: 'p2' }), crianca({ id: 'c', parentUid: 'p3' })];
  eq('três famílias', contratosQueVencem(turma, dia(2026, 11, 14)).vencem.familias, 3);
}
{
  const irmaos = [crianca({ id: 'a', parentUid: 'mae' }), crianca({ id: 'b', parentUid: 'mae' })];
  const r = contratosQueVencem(irmaos, dia(2026, 11, 14)).vencem;
  eq('mãe com dois filhos: uma família, duas crianças', [r.familias, r.criancas], [1, 2]);
}
{
  // O fim no meio do mês muda o mês sem parcela: o critério é o do servidor,
  // não "o mês seguinte ao do fim".
  const r = contratosQueVencem([crianca({ vigenciaFim: '2026-12-05' })], dia(2026, 11, 14)).vencem;
  eq('fim em 05/12 com início dia 10: dezembro já fica sem parcela', r.primeiroMesSemParcela, '2026-12');
  const r2 = contratosQueVencem([crianca({ vigenciaFim: '2026-12-20' })], dia(2026, 11, 14)).vencem;
  eq('fim em 20/12 com início dia 10: dezembro ainda tem; janeiro não', r2.primeiroMesSemParcela, '2027-01');
}
{
  const r = contratosQueVencem(
    [crianca({ id: 'a', vigenciaFim: '2026-12-31' }), crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2026-11-30' })],
    dia(2026, 11, 14)
  ).vencem;
  eq('dois fins: o primeiro e o último', [r.primeiroFim, r.ultimoFim, r.familias], ['2026-11-30', '2026-12-31', 2]);
  eq('dois fins: o primeiro mês sem parcela é o do que acaba antes', r.primeiroMesSemParcela, '2026-12');
  eq('dias é o do que acaba antes', r.dias, 16);
}
eq('contrato que acaba depois dos 60 dias não entra junto',
  contratosQueVencem([crianca(), crianca({ id: 'x', parentUid: 'p9', vigenciaFim: '2027-12-31' })], dia(2026, 11, 14)).vencem.familias, 1);

console.log('\n\x1b[1m3. Quem NÃO conta (não perderia parcela por causa do contrato)\x1b[0m');
const SEM = { vencem: null, vencidos: null };
const nov = dia(2026, 11, 14);
eq('sem vigência nenhuma (criança antiga)', contratosQueVencem([crianca({ vigenciaInicio: undefined, vigenciaFim: undefined })], nov), SEM);
eq('só o fim gravado, sem início: o servidor gera normalmente', contratosQueVencem([crianca({ vigenciaInicio: undefined })], nov), SEM);
eq('só o início gravado, sem fim', contratosQueVencem([crianca({ vigenciaFim: undefined })], nov), SEM);
eq('vigência com data impossível (31/02)', contratosQueVencem([crianca({ vigenciaFim: '2026-02-31' })], nov), SEM);
eq('sem responsável vinculado', contratosQueVencem([crianca({ parentUid: undefined })], nov), SEM);
eq('responsável vazio', contratosQueVencem([crianca({ parentUid: '' })], nov), SEM);
eq('sem mensalidade (campo ausente)', contratosQueVencem([crianca({ monthlyFee: undefined })], nov), SEM);
eq('mensalidade zero', contratosQueVencem([crianca({ monthlyFee: 0 })], nov), SEM);
eq('mensalidade vazia', contratosQueVencem([crianca({ monthlyFee: '' })], nov), SEM);
eq('criança inativa', contratosQueVencem([crianca({ active: false })], nov), SEM);
eq('sem o campo active', contratosQueVencem([crianca({ active: undefined })], nov), SEM);
eq('lista vazia, nula ou lixo', [contratosQueVencem([], nov), contratosQueVencem(null, nov), contratosQueVencem([null, 3], nov)], [SEM, SEM, SEM]);
eq('mensalidade como texto numérico conta (o servidor faz Number())', contratosQueVencem([crianca({ monthlyFee: '350' })], nov).vencem?.familias, 1);
eq('a que conta e a que não conta, juntas: só uma',
  contratosQueVencem([crianca(), crianca({ id: 'z', parentUid: undefined })], nov).vencem.criancas, 1);

console.log('\n\x1b[1m4. Contrato que já acabou\x1b[0m');
{
  const r = contratosQueVencem([crianca()], dia(2027, 1, 3));
  eq('em janeiro: deixa de ser "acaba" e vira "já acabou"', [r.vencem, r.vencidos], [null, { familias: 1, criancas: 1 }]);
}
eq('um dia depois do fim já é vencido', contratosQueVencem([crianca()], dia(2027, 1, 1)).vencidos?.familias, 1);
eq('vencido sem responsável não conta', contratosQueVencem([crianca({ parentUid: '' })], dia(2027, 1, 3)), SEM);
eq('vencido sem valor não conta', contratosQueVencem([crianca({ monthlyFee: 0 })], dia(2027, 1, 3)), SEM);
eq('vencido e inativa não conta', contratosQueVencem([crianca({ active: false })], dia(2027, 1, 3)), SEM);
{
  const r = contratosQueVencem(
    [crianca({ id: 'a' }), crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2027-01-20' })],
    dia(2027, 1, 3)
  );
  eq('um já acabou e outro ainda vai acabar: os dois lados', [r.vencem.familias, r.vencidos.familias], [1, 1]);
}

console.log('\n\x1b[1m5. A cópia da régua do servidor — a mesma resposta em toda data\x1b[0m');
const servidor = require('../functions/lib/reguaDoContrato.js');
{
  const inicios = ['2026-01-01', '2026-03-10', '2026-05-31', '2026-11-14', '2026-12-31', undefined, '2026-02-31'];
  const fins = ['2026-12-31', '2026-12-05', '2026-12-20', '2027-01-31', '2027-12-31', '2026-02-28', undefined, 'x'];
  const meses = [];
  for (let a = 2026; a <= 2028; a++) for (let m = 1; m <= 12; m++) meses.push(`${a}-${String(m).padStart(2, '0')}`);
  let iguais = 0, total = 0;
  const dif = [];
  for (const i of inicios) for (const f of fins) for (const mes of meses) {
    total++;
    if (mesDentroDaVigencia(mes, i, f) === servidor.mesDentroDaVigencia(mes, i, f)) iguais++;
    else dif.push([mes, i, f]);
  }
  eq(`mesDentroDaVigencia igual ao servidor em ${total} combinações`, dif.slice(0, 3), []);
  eq('e nenhuma ficou de fora da conta', iguais, total);
}
eq('o primeiro mês sem parcela é aquele que o servidor recusa',
  (() => {
    const mes = primeiroMesSemParcela('2026-03-10', '2026-12-31', dia(2026, 11, 14));
    return [mes, servidor.mesDentroDaVigencia(mes, '2026-03-10', '2026-12-31'),
      servidor.mesDentroDaVigencia('2026-12', '2026-03-10', '2026-12-31')];
  })(), ['2027-01', false, true]);
eq('a vigência padrão de quem entrou em outubro acaba em 31/12 e ESSE é o caso',
  vigenciaPadrao(dia(2026, 10, 20)).fim, '2026-12-31');
eq('quem entra depois de ~1º de novembro já nasce para o ano seguinte (sem aviso)',
  vigenciaPadrao(dia(2026, 11, 14)).fim, '2027-12-31');

console.log('\n\x1b[1m6. O texto\x1b[0m');
const linhas = (criancas, hoje) => linhasDoAviso(contratosQueVencem(criancas, hoje));
{
  const nove = Array.from({ length: 9 }, (_, i) => crianca({ id: `c${i}`, parentUid: `p${i}` }));
  const l = linhas(nove, nov);
  eq('o texto do protótipo, igual',
    [l[0].titulo, l[0].sub], ['Os contratos de 9 famílias acabam em 31/12.', 'Sem renovar, a mensalidade de janeiro não é gerada.']);
}
eq('singular', linhas([crianca()], nov)[0].titulo, 'O contrato de 1 família acaba em 31/12.');
eq('a data vem da vigência real, não de um 31/12 escrito à mão',
  linhas([crianca({ vigenciaFim: '2026-12-15' })], nov)[0].titulo, 'O contrato de 1 família acaba em 15/12.');
eq('o mês vem da conta: fim em 05/12 fala de dezembro',
  linhas([crianca({ vigenciaFim: '2026-12-05' })], nov)[0].sub, 'Sem renovar, a mensalidade de dezembro não é gerada.');
{
  const l = linhas([
    crianca({ id: 'a', vigenciaFim: '2026-11-30' }),
    crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2026-12-31' }),
  ], nov);
  eq('dois dias diferentes: "entre … e …"', l[0].titulo, 'Os contratos de 2 famílias acabam entre 30/11 e 31/12.');
  eq('dois meses diferentes: "de … em diante"', l[0].sub, 'Sem renovar, a mensalidade não é gerada de dezembro em diante.');
}
{
  const l = linhas([crianca({ id: 'a' }), crianca({ id: 'b', parentUid: 'p2' })], dia(2027, 1, 3));
  eq('já acabaram, plural', [l[0].titulo, l[0].sub], ['Os contratos de 2 famílias já acabaram.', 'A mensalidade delas não é gerada.']);
  const u = linhas([crianca()], dia(2027, 1, 3));
  eq('já acabou, singular', [u[0].titulo, u[0].sub], ['O contrato de 1 família já acabou.', 'A mensalidade dela não é gerada.']);
}
eq('sem nada a avisar, sem linha', linhasDoAviso(contratosQueVencem([], nov)), []);
eq('conta nula não quebra', linhasDoAviso(null), []);
eq('mês e dia', [nomeDoMes('2027-01'), nomeDoMes('2026-12'), nomeDoMes('x'), diaEMes('2026-12-31'), diaEMes('x')], ['janeiro', 'dezembro', '', '31/12', '']);

console.log('\n\x1b[1m7. Cada frase tem origem, e nada que a marca proíbe\x1b[0m');
const FUNCIONALIDADES = {
  'vigencia-do-contrato': [
    ['functions/lib/billing.js', /child\.vigenciaFim/],
    ['src/dominio/cobranca/contratoDaFamilia.js', /child\?\.vigenciaFim/],
  ],
  'mensalidade-fora-da-vigencia': [
    ['functions/lib/billing.js', /mesDentroDaVigencia\(monthKey, child\.vigenciaInicio, child\.vigenciaFim\)/],
    ['functions/lib/billing.js', /foraDaVigencia \+= 1;\s*continue;/],
  ],
};
const CONDICOES = {
  'vigencia-gravada': [['functions/lib/reguaDoContrato.js', /if \(!i \|\| !partes\(fim\)\) return true;/]],
  'mae-no-app-e-valor': [
    ['functions/lib/billing.js', /if \(!child\.parentUid\) \{/],
    ['functions/lib/billing.js', /if \(fee <= 0\) \{/],
  ],
};
const afirmacoes = todasAsAfirmacoes();
eq('o catálogo cobre singular, plural, vários dias e já acabou', afirmacoes.length >= 10, true);
for (const a of afirmacoes) {
  eq(`"${a.id}" tem chave da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
  eq(`"${a.id}" tem condição da lista fechada`, Object.hasOwn(CONDICOES, a.condicao), true);
}
for (const [grupo, tabela] of [['funcionalidade', FUNCIONALIDADES], ['condição', CONDICOES]]) {
  for (const [chave, provas] of Object.entries(tabela)) {
    for (const [arquivo, padrao] of provas) {
      eq(`${grupo} "${chave}" existe: ${arquivo} ~ ${padrao}`, padrao.test(ler(arquivo)), true);
    }
  }
}
eq('nenhuma chave ficou sem uso',
  [...Object.keys(FUNCIONALIDADES), ...Object.keys(CONDICOES)].filter(
    (k) => !afirmacoes.some((a) => a.sustenta === k || a.condicao === k)), []);

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PROMESSAS_FALSAS = [
  /cobra\w* por voce/, /cobranca automatica/, /cobra\w* sozinh/,
  /sabe quando o pix/, /pix chegou/, /reduz\w* (o )?atraso/, /paga\w* em dia/,
  /gratis/, /segur/, /automatic/, /r\$/,
  // A renovação de verdade é outra entrega: o aviso não a promete nem a oferece.
  /renove/, /renovar aqui/, /toque para renovar/, /renovacao/, /em breve/, /prazo/,
];
// Os únicos números permitidos são N (famílias) e a data dd/mm.
const semNumerosPermitidos = (t) => t.replace(/\b\d{1,3} (família|famílias)\b/, '').replace(/\b\d{2}\/\d{2}\b/g, '');
function reprova(texto) {
  const raiz = promessaProibida(texto);
  if (raiz) return `raiz proibida: ${raiz}`;
  const t = semAcento(texto);
  const achada = PROMESSAS_FALSAS.find((re) => re.test(t));
  if (achada) return `promessa que o app não cumpre: ${achada}`;
  if (/\d/.test(semNumerosPermitidos(texto))) return 'número solto';
  if (/!/.test(texto)) return 'exclamação';
  return null;
}
for (const a of afirmacoes) eq(`"${a.id}" está limpo`, reprova(a.texto), null);
for (const a of afirmacoes) eq(`"${a.id}" cabe em 64 caracteres (${a.texto.length})`, a.texto.length <= 64, true);

console.log('\n\x1b[1m8. A tela\x1b[0m');
const tela = ler('src/components/tio/AvisoDosContratos.jsx');
const telaSemCom = semComentarios(tela);
const inicio = ler('src/pages/tio/TioDashboard.jsx');
eq('o Início monta o aviso uma vez', (inicio.match(/<AvisoDosContratos\b/g) || []).length, 1);
eq('o Início não monta o aviso com a rota rodando',
  /estado !== 'dirigindo' && estado !== 'carregando' && <AvisoDosContratos/.test(inicio), true);
eq('o componente usa a régua e o catálogo, sem escrever a frase à mão',
  /dominio\/cobranca\/contratosQueVencem\.js/.test(tela) && /marca\/contratosQueVencem\.js/.test(tela) &&
    !/acabam em|já acabaram|não é gerada/.test(telaSemCom), true);
eq('o toque leva à lista de crianças', /navigate\('\/tio\/children'\)/.test(tela), true);
eq('é âmbar (algo a atender)', /border-warningBorder bg-warningSoft/.test(tela), true);
eq('não toca em Firebase nem em notificação',
  !/firebase|firestore|notifications|sendPush|addDoc|setDoc|updateDoc/i.test(telaSemCom), true);
eq('o domínio e o catálogo não importam React nem Firebase',
  [ler('src/dominio/cobranca/contratosQueVencem.js'), ler('src/marca/contratosQueVencem.js')]
    .every((f) => !/from '(react|firebase)/.test(semComentarios(f))), true);
eq('o botão ocupa 64 px e a letra é de 16 px, não de 12',
  /min-h-16/.test(tela) && !/text-xs|text-\[1[01]px\]/.test(tela), true);

console.log('\n\x1b[1m9. Sonda positiva: a regra pega o que deve\x1b[0m');
eq('"renove aqui" é reprovado', reprova('Renove aqui o contrato.') !== null, true);
eq('"segurança" é reprovado', reprova('Mais segurança para a turma') !== null, true);
eq('número solto é reprovado', reprova('Faltam 60 dias para renovar.') !== null, true);
eq('"em breve" é reprovado', reprova('A renovação chega em breve.') !== null, true);
eq('N e data passam', reprova('Os contratos de 9 famílias acabam em 31/12.'), null);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
