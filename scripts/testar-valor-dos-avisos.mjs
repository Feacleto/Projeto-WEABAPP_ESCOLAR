/**
 * Os avisos que mostram ao tio o que o app fez — Node puro, sem runner.
 * Rodar: node scripts/testar-valor-dos-avisos.mjs  (npm run testar:valor-dos-avisos)
 *
 * Protege `src/marca/valorDosAvisos.js` com a mesma régua de
 * `testar-valor-do-convite.mjs`: toda afirmação tem ORIGEM (uma
 * funcionalidade provada por leitura de arquivo) e CONDIÇÃO quando depende de
 * algo, nenhuma promete o que a marca proíbe, e o servidor diz o mesmo texto
 * que o catálogo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { todasAsAfirmacoes, FAMILIA_ENTROU, textoDaRotaIniciada } from '../src/marca/valorDosAvisos.js';
import { ROTA_INICIADA, ROTA_INICIADA_SEM_MAPA } from '../src/marca/valorDoConvite.js';
import { promessaProibida } from '../src/marca/promessas.js';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const regua = require('../functions/lib/reguaDaFamiliaEntrou.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

/** A LISTA FECHADA do que o app cumpre, com a prova. */
const FUNCIONALIDADES = {
  // A mensalidade nasce com a família dentro E com valor: o servidor pula as duas.
  'mensalidade-nasce-com-a-mae': [
    ['functions/lib/billing.js', /if \(!child\.parentUid\) \{/],
    ['functions/lib/billing.js', /if \(fee <= 0\) \{/],
  ],
  // "Não tem aula": uma notificação por família com conta, e a falta marcada
  // para toda criança escolhida.
  'aviso-de-escola-por-familia': [
    ['src/services/broadcastService.js', /type: 'school_no_class'/],
    ['src/services/broadcastService.js', /absenceDeclarations/],
  ],
  // A rota avisa "a perua saiu" e devolve quantas escritas deram certo.
  'rota-iniciada': [
    ['src/services/routeStatusService.js', /type: 'rota_iniciada'/],
    ['src/services/routeStatusService.js', /const avisadas = idas\.filter\(\(r\) => r\.status === 'fulfilled'\)\.length;/],
    ['src/services/routeStatusService.js', /return avisadas;/],
  ],
};

/** As condições de que uma frase depende, e a prova de cada uma. */
const CONDICOES = {
  // O servidor escolhe a frase pelo valor que a criança tem no resgate.
  'mensalidade-com-valor': [
    ['functions/lib/billing.js', /const fee = Number\(child\.monthlyFee\) \|\| 0;/],
    ['functions/lib/reguaDaFamiliaEntrou.js', /Number\(crianca\.monthlyFee\)/],
  ],
  // Só quem entrou no app (`parentUid`) recebe notificação.
  'familia-com-conta': [
    ['src/services/broadcastService.js', /if \(c\.parentUid\) \{/],
    // A rota só avisa as contas da viagem (`saida.familias` são parentUid).
    ['src/services/routeStatusService.js', /new Set\(\(saida\.familias \|\| \[\]\)\.filter\(Boolean\)\)/],
  ],
};

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PROMESSAS_FALSAS = [
  /cobra\w* por voce/, /cobranca automatica/, /cobra\w* sozinh/,
  /sabe quando o pix/, /sabe se o pix/, /pix chegou/,
  /reduz\w* (o )?atraso/, /paga\w* em dia/, /sem atraso/,
  /gratis/, /segur/, /automatic/, /r\$/,
];
function reprova(texto) {
  const r = promessaProibida(texto);
  if (r) return `raiz proibida da marca: ${r}`;
  const achada = PROMESSAS_FALSAS.find((re) => re.test(semAcento(texto)));
  return achada ? `promessa que o app não cumpre: ${achada}` : null;
}
const ABSOLUTOS = /\b(sempre|toda|todas|todos|qualquer|nunca|automatic\w*|na hora|ja|agora|hoje|amanha)\b/;

const afirmacoes = todasAsAfirmacoes();

console.log('\n\x1b[1m1. Cada afirmação tem origem e condição\x1b[0m');
eq('o catálogo não está vazio', afirmacoes.length > 0, true);
for (const a of afirmacoes) {
  eq(`"${a.id}" sustenta algo da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
  eq(`"${a.id}" declara uma condição da lista fechada`, Object.hasOwn(CONDICOES, a.condicao), true);
}
for (const [chave, provas] of [...Object.entries(FUNCIONALIDADES), ...Object.entries(CONDICOES)]) {
  for (const [arquivo, padrao] of provas) {
    eq(`"${chave}" existe: ${arquivo} ~ ${padrao}`, padrao.test(ler(arquivo)), true);
  }
}

console.log('\n\x1b[1m2. Nada que a marca proíbe, nenhum número escrito à mão\x1b[0m');
for (const a of afirmacoes) eq(`"${a.id}" está limpo`, reprova(a.texto), null);
for (const t of [FAMILIA_ENTROU.titulo('Ana'), FAMILIA_ENTROU.titulo('')]) {
  eq(`título "${t}" está limpo e sem número`, [reprova(t), /\d/.test(t)], [null, false]);
}
for (const v of [FAMILIA_ENTROU.comValor, FAMILIA_ENTROU.semValor]) {
  eq(`"${v.texto}" não tem número`, /\d/.test(v.texto), false);
}

console.log('\n\x1b[1m3. A família entrou: o corpo não promete o que depende de condição\x1b[0m');
eq('com valor, não diz QUANDO a mensalidade aparece (a geração é às 6h ou no "Gerar agora")',
  ABSOLUTOS.test(semAcento(FAMILIA_ENTROU.comValor.texto)), false);
eq('sem valor, não diz que a mensalidade aparece — diz o que falta',
  [/passa a aparecer/.test(FAMILIA_ENTROU.semValor.texto), /^Cadastre o valor/.test(FAMILIA_ENTROU.semValor.texto)], [false, true]);
eq('o título usa só o primeiro nome', FAMILIA_ENTROU.titulo('Ana Clara Souza'), 'A família de Ana entrou');
eq('sem nome, "Uma família", sem buraco', FAMILIA_ENTROU.titulo('   '), 'Uma família entrou');
eq('título e corpo cabem na tela bloqueada (60 caracteres)',
  [FAMILIA_ENTROU.titulo('Maria Eduarda'), FAMILIA_ENTROU.comValor.texto, FAMILIA_ENTROU.semValor.texto]
    .every((t) => t.length <= 64), true);
eq('nenhuma exclamação', /!/.test(afirmacoes.map((a) => a.texto).join(' ')), false);

console.log('\n\x1b[1m4. O servidor diz o mesmo que o catálogo\x1b[0m');
for (const nome of ['Ana Clara', '', null, '  Pedro  ']) {
  eq(`título espelhado (${JSON.stringify(nome)})`, regua.tituloDaFamiliaEntrou(nome), FAMILIA_ENTROU.titulo(nome));
}
eq('corpo com valor espelhado', regua.corpoDaFamiliaEntrou(true), FAMILIA_ENTROU.comValor.texto);
eq('corpo sem valor espelhado', regua.corpoDaFamiliaEntrou(false), FAMILIA_ENTROU.semValor.texto);

console.log('\n\x1b[1m4b. A rota diz quantas famílias avisou, só quando sabe\x1b[0m');
eq('com número, com mapa', textoDaRotaIniciada(4, true), 'Rota iniciada. 4 famílias avisadas.');
eq('uma família no singular', textoDaRotaIniciada(1, true), 'Rota iniciada. 1 família avisada.');
eq('com número, sem mapa: diz também o que elas não veem',
  textoDaRotaIniciada(3, false), 'Rota iniciada. 3 famílias avisadas. A perua não aparece no mapa das famílias.');
eq('zero: a frase de sempre, sem número',
  [textoDaRotaIniciada(0, true), textoDaRotaIniciada(0, false)], [ROTA_INICIADA, ROTA_INICIADA_SEM_MAPA]);
eq('desconhecido (undefined, null, NaN, negativo, fração, texto): sem número',
  [undefined, null, NaN, -2, 2.5, '4'].map((n) => textoDaRotaIniciada(n, true)), Array(6).fill(ROTA_INICIADA));
eq('o padrão é com mapa', textoDaRotaIniciada(2), 'Rota iniciada. 2 famílias avisadas.');

const tirarComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const controle = tirarComentarios(ler('src/components/route/ControleDeRota.jsx'));
const geo = tirarComentarios(ler('src/hooks/useGeolocation.js'));
const DEVOLVE_A_CONTAGEM = /return avisarSaidaDaRota\(driverUid, opcoes\.saida\);/;
eq('o hook devolve a contagem do aviso de saída', DEVOLVE_A_CONTAGEM.test(geo), true);
eq('o cartão usa a função do catálogo com o número e a escolha do mapa',
  /textoDaRotaIniciada\(avisadas, compartilha\)/.test(controle), true);
eq('o número vem do que o start devolveu',
  /const avisadasPromessa = start\(/.test(controle) && /Promise\.resolve\(avisadasPromessa\)/.test(controle), true);
eq('depois de "Cancelar" o cartão não volta', /cancelou = true;/.test(controle) && /if \(cancelou \|\|/.test(controle), true);
eq('o cartão aparece antes do número chegar (a rota não espera)',
  controle.indexOf('mostrarCartao(frase);') > 0 &&
    controle.indexOf('mostrarCartao(frase);') < controle.indexOf('Promise.resolve(avisadasPromessa)'), true);
eq('o cartão não tem número nem "avisadas" escrito à mão', /famílias avisadas/.test(controle), false);
const rota = ler('src/services/routeStatusService.js');
eq('o que as famílias recebem não mudou', [
  rota.includes("title: 'A perua saiu',"),
  rota.includes("'A rota começou. Você recebe o aviso quando ela estiver chegando.'"),
  rota.includes("'A rota começou. Acompanhe pelo mapa.'"),
], [true, true, true]);

console.log('\n\x1b[1m5. Sonda positiva: a régua pega o que deve\x1b[0m');
eq('o hook de antes (sem return) seria reprovado',
  DEVOLVE_A_CONTAGEM.test('      avisarSaidaDaRota(driverUid, opcoes.saida);'), false);
eq('"cobra por você" é reprovado', reprova('O app cobra por você.') !== null, true);
eq('"já aparece" é absoluto', ABSOLUTOS.test(semAcento('A mensalidade já aparece na Carteira.')), true);
eq('uma frase honesta passa', reprova('A mensalidade dela passa a aparecer na Carteira.'), null);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
