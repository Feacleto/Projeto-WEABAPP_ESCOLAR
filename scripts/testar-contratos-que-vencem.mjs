/**
 * Testes do aviso "os contratos acabam" — Node puro, sem runner.
 * Rodar: node scripts/testar-contratos-que-vencem.mjs
 *
 * Protege docs/analise/13-lotes-de-implementacao.md §2 (RC1.1) e a correção da
 * Condução: o aviso do Início e a fila "Renovar contratos" respondem à MESMA
 * pergunta com a MESMA régua (`renovacaoDoContrato.js`). O aviso não tem conta
 * própria — ele lê a fila — e o teste prova que o número dele é sempre o dela.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { contagemDoAviso } from '../src/dominio/cobranca/avisoDosContratos.js';
import {
  filaDeRenovacao,
  primeiroMesSemParcela,
  terminaAntesDoMes,
  MESES_DE_ANTECEDENCIA,
} from '../src/dominio/cobranca/renovacaoDoContrato.js';
import { vigenciaPadrao } from '../src/dominio/cobranca/contratoDaFamilia.js';
import {
  linhasDoAviso,
  todasAsAfirmacoes,
  nomeDoMes,
  diaEMes,
  DESTINO,
  ACAO,
} from '../src/marca/contratosQueVencem.js';
import { promessaProibida } from '../src/marca/promessas.js';

const require = createRequire(import.meta.url);
const servidor = require('../functions/lib/reguaDoContrato.js');
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

const dia = (a, m, d) => new Date(a, m - 1, d, 12, 0, 0);

/** Uma criança na fila: ativa, com família, contrato aceito, acabando em 31/12. */
const crianca = (extra = {}) => ({
  id: 'c1', name: 'Ana', active: true, parentUid: 'pai1', monthlyFee: 300,
  vigenciaInicio: '2026-03-10', vigenciaFim: '2026-12-31',
  contratoVigente: { numero: 1 }, contratoAguardando: null, ...extra,
});
const SEM = { vencem: null, vencidos: null, total: 0 };
const aviso = (criancas, hoje) => contagemDoAviso(criancas, hoje);
const nov = dia(2026, 11, 14);

console.log('\n\x1b[1m1. A janela é a da fila: dois meses à frente\x1b[0m');
eq('a janela da fila é de 2 meses', MESES_DE_ANTECEDENCIA, 2);
eq('31/10: janeiro ainda está a 3 meses, não avisa', aviso([crianca()], dia(2026, 10, 31)), SEM);
eq('01/11: avisa (o fim em 31/12 chega à fila no mesmo dia que chegava aos 60 dias)', aviso([crianca()], dia(2026, 11, 1)).vencem?.contratos, 1);
eq('14/11: avisa', aviso([crianca()], nov).vencem?.contratos, 1);
eq('31/12, último dia: ainda avisa, como "acaba"', aviso([crianca()], dia(2026, 12, 31)).vencem?.contratos, 1);
eq('em março, bem antes: nada', aviso([crianca()], dia(2026, 3, 20)), SEM);
// DIVERGÊNCIA REGISTRADA com a régua antiga (60 dias): para um fim no meio do
// mês a fila chega alguns dias depois. Prevalece a da fila — o aviso que
// aparece antes de a linha existir levaria a uma tela vazia.
eq('fim em 15/12: 20/10 ainda não (a régua de 60 dias avisaria aqui)', aviso([crianca({ vigenciaFim: '2026-12-15' })], dia(2026, 10, 20)), SEM);
eq('fim em 15/12: 01/11 sim', aviso([crianca({ vigenciaFim: '2026-12-15' })], dia(2026, 11, 1)).vencem?.contratos, 1);
eq('fim em 05/12 (início dia 10): dezembro já fica sem parcela, e a fila chega em 01/10',
  [aviso([crianca({ vigenciaFim: '2026-12-05' })], dia(2026, 9, 30)).total, aviso([crianca({ vigenciaFim: '2026-12-05' })], dia(2026, 10, 1)).total], [0, 1]);

console.log('\n\x1b[1m2. O que ele diz: quantos contratos, quando acabam, quando falta parcela\x1b[0m');
{
  const r = aviso([crianca()], nov).vencem;
  eq('um contrato, o fim e o mês que fica sem parcela',
    [r.contratos, r.primeiroFim, r.ultimoFim, r.primeiroMesSemParcela], [1, '2026-12-31', '2026-12-31', '2027-01']);
}
eq('três contratos', aviso([crianca({ id: 'a', parentUid: 'p1' }), crianca({ id: 'b', parentUid: 'p2' }), crianca({ id: 'c', parentUid: 'p3' })], nov).vencem.contratos, 3);
// DIVERGÊNCIA REGISTRADA com o aviso antigo: a unidade era a FAMÍLIA (mãe com
// dois filhos = 1) e agora é o CONTRATO. A fila lista uma linha por criança,
// e o número do aviso tem que ser o da lista.
eq('mãe com dois filhos: duas linhas na fila, dois contratos no aviso',
  [aviso([crianca({ id: 'a', parentUid: 'mae' }), crianca({ id: 'b', parentUid: 'mae' })], nov).vencem.contratos,
    filaDeRenovacao([crianca({ id: 'a', parentUid: 'mae' }), crianca({ id: 'b', parentUid: 'mae' })], nov).total], [2, 2]);
{
  const r = aviso([crianca({ id: 'a', vigenciaFim: '2026-12-31' }), crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2026-11-30' })], nov).vencem;
  eq('dois fins: o primeiro e o último', [r.primeiroFim, r.ultimoFim, r.contratos], ['2026-11-30', '2026-12-31', 2]);
  eq('dois fins: o primeiro mês sem parcela é o do que acaba antes', r.primeiroMesSemParcela, '2026-12');
}
eq('contrato que acaba depois da janela não entra junto',
  aviso([crianca(), crianca({ id: 'x', parentUid: 'p9', vigenciaFim: '2027-12-31' })], nov).vencem.contratos, 1);
eq('o mês é o que o servidor recusa: fim em 20/12 com início dia 10 fala de JANEIRO, não de dezembro',
  aviso([crianca({ vigenciaFim: '2026-12-20' })], nov).vencem.primeiroMesSemParcela, '2027-01');

console.log('\n\x1b[1m3. Quem conta: o que a fila lista (as três situações), com família no app\x1b[0m');
eq('contrato aceito, pode renovar', aviso([crianca()], nov).total, 1);
eq('esperando a família assinar o contrato novo: conta (perde a parcela se ela não assinar)',
  aviso([crianca({ contratoAguardando: 2 })], nov).total, 1);
eq('primeiro contrato nunca assinado: conta', aviso([crianca({ contratoVigente: null })], nov).total, 1);
eq('primeiro contrato emitido e não assinado: conta', aviso([crianca({ contratoVigente: null, contratoAguardando: 1 })], nov).total, 1);
eq('as três juntas: três contratos',
  aviso([crianca({ id: 'a' }), crianca({ id: 'b', parentUid: 'p2', contratoAguardando: 2 }), crianca({ id: 'c', parentUid: 'p3', contratoVigente: null })], nov).vencem.contratos, 3);
eq('sem família no app: fora (a mensalidade não nasce por outro motivo, e a fila só conta a nota)', aviso([crianca({ parentUid: null })], nov), SEM);
eq('responsável vazio: fora', aviso([crianca({ parentUid: '' })], nov), SEM);
eq('criança inativa: fora', aviso([crianca({ active: false })], nov), SEM);
eq('sem o campo active: fora', aviso([crianca({ active: undefined })], nov), SEM);
eq('passada a outro tio: fora', aviso([crianca({ transferidaPara: 'outro' })], nov), SEM);
eq('sem vigência nenhuma (criança antiga): a cobrança não para, nada a avisar',
  aviso([crianca({ vigenciaInicio: undefined, vigenciaFim: undefined })], nov), SEM);
eq('só o fim gravado: fora', aviso([crianca({ vigenciaInicio: undefined })], nov), SEM);
eq('só o início gravado: fora', aviso([crianca({ vigenciaFim: undefined })], nov), SEM);
eq('data impossível (31/02): fora', aviso([crianca({ vigenciaFim: '2026-02-31' })], nov), SEM);
eq('lista vazia, nula ou lixo', [aviso([], nov), aviso(null, nov), aviso([null, 3], nov)], [SEM, SEM, SEM]);
// DIVERGÊNCIA REGISTRADA com o aviso antigo: ele exigia mensalidade com valor.
// A fila não exige — a criança sem valor aparece lá —, e o número do aviso tem
// que ser o da lista. Prevalece a fila.
eq('sem valor de mensalidade: CONTA (a fila lista; antes o aviso a deixava de fora)', aviso([crianca({ monthlyFee: 0 })], nov).total, 1);

console.log('\n\x1b[1m4. Contrato que já acabou\x1b[0m');
{
  const r = aviso([crianca()], dia(2027, 1, 3));
  eq('em janeiro: deixa de ser "acaba" e vira "já acabou"', [r.vencem, r.vencidos, r.total], [null, { contratos: 1 }, 1]);
}
eq('um dia depois do fim já é vencido', aviso([crianca()], dia(2027, 1, 1)).vencidos?.contratos, 1);
eq('vencido sem família: fora', aviso([crianca({ parentUid: '' })], dia(2027, 1, 3)), SEM);
eq('vencido e inativa: fora', aviso([crianca({ active: false })], dia(2027, 1, 3)), SEM);
{
  const r = aviso([crianca({ id: 'a' }), crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2027-01-20' })], dia(2027, 1, 3));
  eq('um já acabou e outro ainda vai acabar: os dois lados', [r.vencem.contratos, r.vencidos.contratos, r.total], [1, 1, 2]);
}

console.log('\n\x1b[1m5. O INVARIANTE: o número do aviso é sempre o da fila\x1b[0m');
{
  const turma = [
    crianca({ id: 'a', parentUid: 'p1' }),
    crianca({ id: 'b', parentUid: 'p1', vigenciaFim: '2026-12-20' }),
    crianca({ id: 'c', parentUid: 'p2', contratoAguardando: 2 }),
    crianca({ id: 'd', parentUid: 'p3', contratoVigente: null }),
    crianca({ id: 'e', parentUid: null }),
    crianca({ id: 'f', parentUid: 'p4', active: false }),
    crianca({ id: 'g', parentUid: 'p5', transferidaPara: 'x' }),
    crianca({ id: 'h', parentUid: 'p6', vigenciaFim: '2026-11-05' }),
    crianca({ id: 'i', parentUid: 'p7', vigenciaFim: '2027-12-31' }),
    crianca({ id: 'j', parentUid: 'p8', vigenciaInicio: undefined, vigenciaFim: undefined }),
    crianca({ id: 'k', parentUid: 'p9', monthlyFee: 0, vigenciaFim: '2027-03-31', vigenciaInicio: '2026-04-01' }),
  ];
  let datas = 0;
  const divergencias = [];
  for (let t = new Date(2026, 0, 1, 12); t < new Date(2028, 2, 1); t.setDate(t.getDate() + 3)) {
    const hoje = new Date(t);
    const f = filaDeRenovacao(turma, hoje);
    const a = contagemDoAviso(turma, hoje);
    datas += 1;
    const soma = (a.vencem?.contratos || 0) + (a.vencidos?.contratos || 0);
    if (a.total !== f.total || soma !== f.total || f.total !== f.renovar.length + f.esperando.length + f.semAceite.length) {
      divergencias.push([hoje.toISOString().slice(0, 10), a.total, soma, f.total]);
    }
  }
  eq(`em ${datas} datas, total do aviso = vencem + vencidos = total da fila`, divergencias.slice(0, 3), []);
  eq('e a matriz não era vazia (sonda positiva: houve datas com fila e datas sem)',
    filaDeRenovacao(turma, nov).total > 0 && filaDeRenovacao(turma, dia(2026, 3, 1)).total === 0, true);
}

console.log('\n\x1b[1m6. A régua é a do servidor\x1b[0m');
{
  const inicios = ['2026-01-01', '2026-03-10', '2026-05-31', '2026-11-14', '2026-12-31'];
  const fins = ['2026-12-31', '2026-12-05', '2026-12-20', '2027-01-31', '2027-12-31', '2026-02-28'];
  const meses = [];
  for (let a = 2026; a <= 2028; a++) for (let m = 1; m <= 12; m++) meses.push(`${a}-${String(m).padStart(2, '0')}`);
  let total = 0;
  const dif = [];
  for (const i of inicios) for (const f of fins) for (const mes of meses) {
    // Antes do início não é "terminou", é "ainda não começou": só se compara de lá em diante.
    if (mes < i.slice(0, 7)) continue;
    total += 1;
    if (terminaAntesDoMes(mes, i, f) !== !servidor.mesDentroDaVigencia(mes, i, f)) dif.push([mes, i, f]);
  }
  eq(`terminaAntesDoMes é o contrário de mesDentroDaVigencia do servidor em ${total} combinações`, dif.slice(0, 3), []);
  const mes = primeiroMesSemParcela('2026-03-10', '2026-12-31', nov);
  eq('o primeiro mês sem parcela é aquele que o servidor recusa, e o anterior ele aceita',
    [mes, servidor.mesDentroDaVigencia(mes, '2026-03-10', '2026-12-31'), servidor.mesDentroDaVigencia('2026-12', '2026-03-10', '2026-12-31')],
    ['2027-01', false, true]);
}
eq('a vigência padrão de quem entrou em outubro acaba em 31/12 e ESSE é o caso', vigenciaPadrao(dia(2026, 10, 20)).fim, '2026-12-31');
eq('quem entra depois de ~1º de novembro já nasce para o ano seguinte', vigenciaPadrao(dia(2026, 11, 14)).fim, '2027-12-31');

console.log('\n\x1b[1m7. O texto\x1b[0m');
const linhas = (criancas, hoje) => linhasDoAviso(contagemDoAviso(criancas, hoje));
{
  const nove = Array.from({ length: 9 }, (_, i) => crianca({ id: `c${i}`, parentUid: `p${i}` }));
  const l = linhas(nove, nov);
  eq('o texto, com contratos', [l[0].titulo, l[0].sub], ['9 contratos acabam em 31/12.', 'Sem renovar, a mensalidade de janeiro não é gerada.']);
  eq('a linha de baixo diz onde se resolve', l[0].acao, 'Ver quem renovar');
}
eq('singular', linhas([crianca()], nov)[0].titulo, '1 contrato acaba em 31/12.');
eq('a data vem da vigência real', linhas([crianca({ vigenciaFim: '2026-12-15' })], nov)[0].titulo, '1 contrato acaba em 15/12.');
eq('o mês vem da conta: fim em 05/12 (início dia 10) fala de dezembro',
  linhas([crianca({ vigenciaFim: '2026-12-05' })], nov)[0].sub, 'Sem renovar, a mensalidade de dezembro não é gerada.');
{
  const l = linhas([crianca({ id: 'a', vigenciaFim: '2026-11-30' }), crianca({ id: 'b', parentUid: 'p2', vigenciaFim: '2026-12-31' })], nov);
  eq('dois dias diferentes: "entre … e …"', l[0].titulo, '2 contratos acabam entre 30/11 e 31/12.');
  eq('dois meses diferentes: "de … em diante"', l[0].sub, 'Sem renovar, a mensalidade não é gerada de dezembro em diante.');
}
{
  const l = linhas([crianca({ id: 'a' }), crianca({ id: 'b', parentUid: 'p2' })], dia(2027, 1, 3));
  eq('já acabaram, plural', [l[0].titulo, l[0].sub], ['2 contratos já acabaram.', 'Sem renovar, a mensalidade não é gerada.']);
  eq('já acabou, singular', linhas([crianca()], dia(2027, 1, 3))[0].titulo, '1 contrato já acabou.');
}
eq('sem nada a avisar, sem linha', linhasDoAviso(contagemDoAviso([], nov)), []);
eq('conta nula não quebra', linhasDoAviso(null), []);
eq('mês e dia', [nomeDoMes('2027-01'), nomeDoMes('x'), diaEMes('2026-12-31'), diaEMes('x')], ['janeiro', '', '31/12', '']);

console.log('\n\x1b[1m8. Cada frase tem origem, e nada que a marca proíbe\x1b[0m');
const FUNCIONALIDADES = {
  'vigencia-do-contrato': [
    ['functions/lib/billing.js', /child\.vigenciaFim/],
    ['src/dominio/cobranca/contratoDaFamilia.js', /child\?\.vigenciaFim/],
  ],
  'mensalidade-fora-da-vigencia': [
    ['functions/lib/billing.js', /mesDentroDaVigencia\(monthKey, child\.vigenciaInicio, child\.vigenciaFim\)/],
    ['functions/lib/billing.js', /foraDaVigencia \+= 1;\s*continue;/],
  ],
  'fila-de-renovacao': [
    ['src/App.jsx', /path="finance\/renovar" element=\{<TioRenovarContratos \/>\}/],
    ['src/pages/tio/TioRenovarContratos.jsx', /filaDeRenovacao\(criancas, new Date\(\)\)/],
  ],
};
const CONDICOES = {
  'vigencia-gravada': [['functions/lib/reguaDoContrato.js', /if \(!i \|\| !partes\(fim\)\) return true;/]],
  'familia-no-app': [
    ['functions/lib/billing.js', /if \(!child\.parentUid\) \{/],
    ['src/dominio/cobranca/renovacaoDoContrato.js', /if \(!child\.parentUid\) return 'sem-familia';/],
  ],
};
const afirmacoes = todasAsAfirmacoes();
eq('o catálogo cobre singular, plural, vários dias e já acabou', afirmacoes.length >= 15, true);
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
  // Renovar é MANDAR contrato novo: o aviso diz onde, nunca que já foi feito.
  /renovad/, /renove aqui/, /renovou/, /toque para renovar/, /em breve/, /prazo/,
];
// Os únicos números permitidos são N (contratos) e a data dd/mm.
const semNumerosPermitidos = (t) => t.replace(/\b\d{1,3} contratos?\b/, '').replace(/\b\d{2}\/\d{2}\b/g, '');
function reprova(texto) {
  const raiz2 = promessaProibida(texto);
  if (raiz2) return `raiz proibida: ${raiz2}`;
  const achada = PROMESSAS_FALSAS.find((re) => re.test(semAcento(texto)));
  if (achada) return `promessa que o app não cumpre: ${achada}`;
  if (/\d/.test(semNumerosPermitidos(texto))) return 'número solto';
  if (/!/.test(texto)) return 'exclamação';
  return null;
}
for (const a of afirmacoes) eq(`"${a.id}" está limpo`, reprova(a.texto), null);
for (const a of afirmacoes) eq(`"${a.id}" cabe em 64 caracteres (${a.texto.length})`, a.texto.length <= 64, true);

console.log('\n\x1b[1m9. A tela: uma régua só, e o toque leva à fila\x1b[0m');
const tela = ler('src/components/tio/AvisoDosContratos.jsx');
const telaSem = semComentarios(tela);
const inicio = ler('src/pages/tio/TioDashboard.jsx');
const app = ler('src/App.jsx');
eq('NÃO existe mais régua própria do aviso (a única é a da renovação)',
  fs.existsSync(path.join(raiz, 'src/dominio/cobranca/contratosQueVencem.js')), false);
eq('o domínio do aviso lê a fila de renovação',
  /filaDeRenovacao\(criancas, hoje\)/.test(semComentarios(ler('src/dominio/cobranca/avisoDosContratos.js'))), true);
eq('o domínio do aviso não reescreve a conta (nada de dias, de mesDentroDaVigencia nem de parcelas)',
  /60|mesDentroDaVigencia|parcelasDaVigencia|DIAS_DE/.test(semComentarios(ler('src/dominio/cobranca/avisoDosContratos.js'))), false);
eq('o Início monta o aviso uma vez', (inicio.match(/<AvisoDosContratos\b/g) || []).length, 1);
eq('o Início não monta o aviso com a rota rodando',
  /estado !== 'dirigindo' && estado !== 'carregando' && <AvisoDosContratos/.test(inicio), true);
eq('o componente usa a régua e o catálogo, sem escrever a frase à mão',
  /avisoDosContratos\.js/.test(tela) && /marca\/contratosQueVencem\.js/.test(tela) &&
    !/acabam em|já acabaram|não é gerada|Ver quem renovar/.test(telaSem), true);
eq('o toque leva à fila de renovação', /navigate\(DESTINO\)/.test(telaSem) && DESTINO === '/tio/finance/renovar', true);
eq('e essa rota existe no App', new RegExp(`path="${DESTINO.replace('/tio/', '')}"`).test(app), true);
eq('a linha de baixo diz onde renovar', ACAO, 'Ver quem renovar');
eq('é âmbar (algo a atender)', /border-warningBorder bg-warningSoft/.test(tela), true);
eq('não toca em Firebase nem em notificação', !/firebase|firestore|notifications|sendPush|addDoc|setDoc|updateDoc/i.test(telaSem), true);
eq('o domínio e o catálogo não importam React nem Firebase',
  [ler('src/dominio/cobranca/avisoDosContratos.js'), ler('src/marca/contratosQueVencem.js')]
    .every((f) => !/from '(react|firebase)/.test(semComentarios(f))), true);
eq('o botão ocupa 64 px e a letra é de 16 px, não de 12', /min-h-16/.test(tela) && !/text-xs|text-sm|text-\[1[01]px\]/.test(tela), true);
const fila = ler('src/pages/tio/TioRenovarContratos.jsx');
eq('a tela de destino explica a diferença entre os casos (só quando há linha dos outros dois)',
  /fila\.esperando\.length > 0 \|\| fila\.semAceite\.length > 0\) && \(\s*<p[^>]*>\{DIFERENCA\.texto\}/.test(fila), true);

console.log('\n\x1b[1m10. Sonda positiva: a regra pega o que deve\x1b[0m');
eq('"renove aqui" é reprovado', reprova('Renove aqui o contrato.') !== null, true);
eq('"já renovou" é reprovado', reprova('O contrato já renovou.') !== null, true);
eq('"segurança" é reprovado', reprova('Mais segurança para a turma') !== null, true);
eq('número solto é reprovado', reprova('Faltam 60 dias para renovar.') !== null, true);
eq('N e data passam', reprova('9 contratos acabam em 31/12.'), null);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
