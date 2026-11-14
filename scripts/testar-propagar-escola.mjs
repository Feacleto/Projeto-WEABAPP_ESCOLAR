/**
 * Testes de "corrigir o endereço da escola chega às crianças" — Node puro.
 * Rodar: node scripts/testar-propagar-escola.mjs
 *
 * Protege docs/analise/13a, linha "k": a criança guarda uma CÓPIA do endereço
 * e do ponto da escola, e corrigir a escola não a alcançava. A regra pura diz
 * quais campos e quais crianças; a escrita é em lotes de 15, com UMA consulta
 * de mapa para a escola; e nada é gravado sem o ponto novo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMPOS_DA_COPIA,
  TAMANHO_DO_LOTE,
  camposDaCopia,
  criancasQueMudam,
  lotesDe,
  mesmoPonto,
  chaveDoEndereco,
  primeiroNome,
} from '../src/dominio/escola/propagarEscola.js';
import {
  todasAsAfirmacoes,
  tituloDoResumo,
  nomesDoResumo,
  aplicado,
  APLICAR,
  SO_A_ESCOLA,
  SO_A_ESCOLA_MUDOU,
  SEM_PONTO,
  SUSTENTA,
  CONDICAO,
} from '../src/marca/propagarEscola.js';
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

const NOVA = { endereco: 'Rua Nova, 200, Centro, São Paulo', lat: -23.55, lng: -46.63 };
const crianca = (extra = {}) => ({
  id: 'c1', name: 'Ana Souza', active: true, schoolId: 'e1',
  schoolAddress: 'Rua Velha, 10, Centro, São Paulo', schoolLat: -23.5, schoolLng: -46.6, ...extra,
});

console.log('\n\x1b[1m1. Quais campos são a cópia\x1b[0m');
eq('só endereço e ponto da escola', CAMPOS_DA_COPIA, ['schoolAddress', 'schoolLat', 'schoolLng']);
eq('o que se grava tem exatamente esses campos',
  Object.keys(camposDaCopia(NOVA)).sort(), [...CAMPOS_DA_COPIA].sort());
eq('o conteúdo', camposDaCopia(NOVA), { schoolAddress: NOVA.endereco, schoolLat: -23.55, schoolLng: -46.63 });
eq('o endereço vai aparado', camposDaCopia({ ...NOVA, endereco: '  Rua Nova, 200  ' }).schoolAddress, 'Rua Nova, 200');
eq('coordenada em texto vira número', camposDaCopia({ ...NOVA, lat: '-23.55', lng: '-46.63' }).schoolLat, -23.55);
eq('não grava nome, telefone nem nada do contrato por esta via',
  Object.keys(camposDaCopia(NOVA)).filter((k) => !CAMPOS_DA_COPIA.includes(k)), []);

console.log('\n\x1b[1m2. Sem o ponto, nada é gravado (nem endereço novo com ponto velho)\x1b[0m');
eq('sem latitude', camposDaCopia({ ...NOVA, lat: null }), null);
eq('sem longitude', camposDaCopia({ ...NOVA, lng: undefined }), null);
eq('coordenada vazia', camposDaCopia({ ...NOVA, lat: '', lng: '' }), null);
eq('coordenada que não é número', camposDaCopia({ ...NOVA, lat: 'x' }), null);
eq('sem endereço', camposDaCopia({ ...NOVA, endereco: '   ' }), null);
eq('escola nula', camposDaCopia(null), null);
eq('zero é coordenada válida (meio do Atlântico, mas válida)', camposDaCopia({ ...NOVA, lat: 0, lng: 0 })?.schoolLat, 0);

console.log('\n\x1b[1m3. Quais crianças entram\x1b[0m');
const ids = (lista) => lista.map((c) => c.id);
eq('a da escola, com a cópia diferente', ids(criancasQueMudam([crianca()], 'e1', NOVA)), ['c1']);
eq('outra escola não entra', criancasQueMudam([crianca({ schoolId: 'e2' })], 'e1', NOVA), []);
eq('sem escola (texto solto) não entra', criancasQueMudam([crianca({ schoolId: null })], 'e1', NOVA), []);
eq('inativa não entra', criancasQueMudam([crianca({ active: false })], 'e1', NOVA), []);
eq('passada a outro tio não entra (as rules a congelam e derrubariam o lote)',
  criancasQueMudam([crianca({ transferidaPara: 'outroTio' })], 'e1', NOVA), []);
eq('quem já está igual não conta',
  criancasQueMudam([crianca({ schoolAddress: NOVA.endereco, schoolLat: NOVA.lat, schoolLng: NOVA.lng })], 'e1', NOVA), []);
eq('mesmo texto, ponto diferente: entra',
  ids(criancasQueMudam([crianca({ schoolAddress: NOVA.endereco })], 'e1', NOVA)), ['c1']);
eq('mesmo ponto, texto diferente: entra',
  ids(criancasQueMudam([crianca({ schoolLat: NOVA.lat, schoolLng: NOVA.lng })], 'e1', NOVA)), ['c1']);
eq('texto igual até a caixa, o acento e a pontuação: não entra',
  criancasQueMudam([crianca({ schoolAddress: 'RUA NOVA 200 CENTRO SAO PAULO', schoolLat: NOVA.lat, schoolLng: NOVA.lng })], 'e1', NOVA), []);
eq('ponto a menos de 1 m não conta como diferente',
  criancasQueMudam([crianca({ schoolAddress: NOVA.endereco, schoolLat: NOVA.lat + 0.000001, schoolLng: NOVA.lng })], 'e1', NOVA), []);
eq('escola sem ponto: vale só o texto',
  [ids(criancasQueMudam([crianca({ schoolAddress: NOVA.endereco })], 'e1', { endereco: NOVA.endereco })),
    ids(criancasQueMudam([crianca()], 'e1', { endereco: NOVA.endereco }))], [[], ['c1']]);
eq('criança sem cópia nenhuma (campo ausente) entra',
  ids(criancasQueMudam([crianca({ schoolAddress: undefined, schoolLat: undefined, schoolLng: undefined })], 'e1', NOVA)), ['c1']);
eq('só as da escola, no meio de uma turma',
  ids(criancasQueMudam([
    crianca({ id: 'a' }), crianca({ id: 'b', schoolId: 'e2' }), crianca({ id: 'c' }), crianca({ id: 'd', active: false }),
  ], 'e1', NOVA)), ['a', 'c']);
eq('lista nula, vazia ou com lixo', [criancasQueMudam(null, 'e1', NOVA), criancasQueMudam([], 'e1', NOVA), criancasQueMudam([null, 3], 'e1', NOVA)], [[], [], []]);
eq('escola sem id não alcança ninguém', criancasQueMudam([crianca({ schoolId: undefined })], undefined, NOVA), []);
eq('mesmoPonto: sem ponto dos dois lados é o mesmo; com um só, não',
  [mesmoPonto({}, {}), mesmoPonto({ lat: 1, lng: 1 }, {}), mesmoPonto({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })], [true, false, true]);
eq('chave do endereço', chaveDoEndereco('Rua Nova, nº 200 — Centro'), 'rua nova n 200 centro');
eq('primeiro nome', [primeiroNome('Ana Clara Souza'), primeiroNome('  '), primeiroNome(null)], ['Ana', '', '']);

console.log('\n\x1b[1m4. Lotes de 15\x1b[0m');
eq('o lote é de 15', TAMANHO_DO_LOTE, 15);
for (const n of [0, 1, 14, 15, 16, 30, 31, 100]) {
  const lista = Array.from({ length: n }, (_, i) => `c${i}`);
  const lotes = lotesDe(lista);
  eq(`${n} crianças: nenhum lote passa de 15, ninguém some nem repete, a ordem fica`,
    [lotes.every((l) => l.length > 0 && l.length <= 15), lotes.flat()], [true, lista]);
}
eq('31 crianças são 3 lotes (15, 15, 1)', lotesDe(Array.from({ length: 31 }, (_, i) => i)).map((l) => l.length), [15, 15, 1]);
eq('lista nula não quebra', lotesDe(null), []);

console.log('\n\x1b[1m5. O texto\x1b[0m');
eq('a pergunta do protótipo', tituloDoResumo(5), 'Isto muda o ponto de rota de 5 crianças. Aplicar?');
eq('a pergunta no singular', tituloDoResumo(1), 'Isto muda o ponto de rota de 1 criança. Aplicar?');
eq('os nomes (o do protótipo)', nomesDoResumo(['Ana', 'Pedro', 'Lívia', 'Caio', 'Davi']),
  'Ana, Pedro, Lívia, Caio e Davi passam a descer neste endereço.');
eq('um nome', nomesDoResumo(['Ana']), 'Ana passa a descer neste endereço.');
eq('dois nomes', nomesDoResumo(['Ana', 'Pedro']), 'Ana e Pedro passam a descer neste endereço.');
eq('mais de cinco: quatro nomes e "e mais N"',
  nomesDoResumo(['A', 'B', 'C', 'D', 'E', 'F', 'G']), 'A, B, C, D e mais 3 passam a descer neste endereço.');
eq('sem nomes, sem frase', [nomesDoResumo([]), nomesDoResumo(null), nomesDoResumo(['', ' '])], ['', '', '']);
eq('depois de aplicar', [aplicado(5), aplicado(1)], ['As 5 crianças descem no endereço novo.', 'A criança desce no endereço novo.']);
eq('os botões', [APLICAR, SO_A_ESCOLA], ['Aplicar', 'Só a escola']);

console.log('\n\x1b[1m6. Cada frase tem origem, e nada que a marca proíbe\x1b[0m');
const FUNCIONALIDADES = {
  'copia-da-escola-na-crianca': [
    ['src/components/route/OperacaoDaRota.jsx', /child\.schoolLat/],
    ['src/pages/pai/PaiMap.jsx', /child\.schoolLat/],
    ['src/services/contractService.js', /child\?\.schoolAddress/],
    ['src/services/childrenService.js', /schoolAddress: data\.schoolAddress/],
  ],
};
const CONDICOES = {
  'ponto-da-escola-achado': [['src/dominio/escola/propagarEscola.js', /ehNumero\(escola\?\.lat\)/]],
};
const afirmacoes = todasAsAfirmacoes();
eq('as chaves do catálogo são as da lista fechada', [SUSTENTA.copia, CONDICAO.ponto], ['copia-da-escola-na-crianca', 'ponto-da-escola-achado']);
for (const a of afirmacoes) {
  eq(`"${a.id}" tem chave da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
  if (a.condicao) eq(`"${a.id}" tem condição da lista fechada`, Object.hasOwn(CONDICOES, a.condicao), true);
}
for (const [grupo, tabela] of [['funcionalidade', FUNCIONALIDADES], ['condição', CONDICOES]]) {
  for (const [chave, provas] of Object.entries(tabela)) {
    for (const [arquivo, padrao] of provas) {
      eq(`${grupo} "${chave}" existe: ${arquivo} ~ ${padrao}`, padrao.test(ler(arquivo)), true);
    }
  }
}
const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// A pergunta não promete o que não existe: nenhum aviso à família, nada de "automático".
const PROMESSAS_FALSAS = [/avis(a|ad|aremos)\w* (a )?(familia|mae|pai|responsavel)/, /familia (sera|vai ser) avisad/, /automatic/, /gratis/, /segur/, /em breve/];
function reprova(texto) {
  const raiz2 = promessaProibida(texto);
  if (raiz2) return `raiz proibida: ${raiz2}`;
  const t = semAcento(texto);
  const achada = PROMESSAS_FALSAS.find((re) => re.test(t));
  if (achada) return `promessa que o app não cumpre: ${achada}`;
  if (/!/.test(texto)) return 'exclamação';
  if (/\d/.test(texto.replace(/\b(\d{1,3}) de (\d{1,3}) crianças\b/g, '').replace(/\b\d{1,3} crianças?\b/g, '').replace(/ mais \d+ /g, ' '))) return 'número solto';
  return null;
}
for (const a of afirmacoes) eq(`"${a.id}" está limpo`, reprova(a.texto), null);
eq('"SEM_PONTO" e "SO_A_ESCOLA_MUDOU" estão no catálogo', [reprova(SEM_PONTO), reprova(SO_A_ESCOLA_MUDOU)], [null, null]);

console.log('\n\x1b[1m7. A escrita: lotes, uma consulta, nada sem ponto\x1b[0m');
const servico = semComentarios(ler('src/services/escolasService.js'));
const fnDoServico = servico.slice(servico.indexOf('export async function aplicarEnderecoDaEscolaNasCriancas'));
const corpoDoServico = fnDoServico.slice(0, fnDoServico.indexOf('\n}\n') + 3);
eq('o serviço pede os campos e os lotes à régua pura',
  /from '\.\.\/dominio\/escola\/propagarEscola\.js'/.test(servico) && /camposDaCopia\(/.test(corpoDoServico) && /lotesDe\(/.test(corpoDoServico), true);
eq('o serviço não escreve sem os campos (a régua devolve null sem ponto)',
  /if \(!campos\) throw/.test(corpoDoServico), true);
eq('um lote por vez, cada um confirmado antes do próximo', /for \(const lote of lotesDe\([\s\S]*await batch\.commit\(\)/.test(corpoDoServico), true);
eq('quem falha no meio sabe quantas foram', /err\.feitas = feitas/.test(corpoDoServico), true);
eq('o serviço NÃO geocodifica (não importa o locationService)', /locationService|searchAddress/.test(servico), false);
const tela = ler('src/pages/tio/TioEscolas.jsx');
const telaSem = semComentarios(tela);
const aplicar = telaSem.slice(telaSem.indexOf('async function aplicarNasCriancas'));
const corpoAplicar = aplicar.slice(0, aplicar.indexOf('\n  }\n') + 5);
eq('aplicar consulta o mapa UMA vez (e só sem ponto)', (corpoAplicar.match(/searchAddress\(/g) || []).length, 1);
eq('a consulta não está dentro de laço sobre as crianças', /(for \(|\.map\(|\.forEach\()[^}]*searchAddress/.test(corpoAplicar), false);
eq('sem ponto achado, nada vai para as crianças (a mensagem sai antes da escrita)',
  corpoAplicar.indexOf('SEM_PONTO') > 0 && corpoAplicar.indexOf('SEM_PONTO') < corpoAplicar.indexOf('aplicarEnderecoDaEscolaNasCriancas('), true);
eq('as crianças gravadas são as que a pergunta mostrou', /criancaIds: p\.criancas\.map\(\(c\) => c\.id\)/.test(corpoAplicar), true);
eq('a pergunta nasce de criancasQueMudam', /criancasQueMudam\(children, editando\.id, editando\)/.test(telaSem), true);
eq('a tela usa o catálogo, sem escrever a frase à mão', !/Isto muda o ponto|passam a descer|descem no endereço/.test(telaSem), true);
eq('a tela usa a folha de confirmação que já existe (nada de painel fixed próprio)',
  /<ConfirmDialog\s+open=\{!!paraPropagar\}/.test(telaSem) && !/className="fixed/.test(telaSem), true);
eq('componente não importa Firestore', /firebase\/firestore/.test(telaSem), false);
eq('"Só a escola" deixa as crianças como estão (nenhuma escrita no caminho do cancelar)',
  !/function deixarAsCriancas[\s\S]*?aplicarEnderecoDaEscolaNasCriancas/.test(telaSem.slice(telaSem.indexOf('function deixarAsCriancas'), telaSem.indexOf('async function aplicarNasCriancas'))), true);

console.log('\n\x1b[1m8. As rules deixam o motorista escrever estes campos\x1b[0m');
const regras = ler('firestore.rules');
const iniChildren = regras.indexOf('match /children/{childId} {');
const fimChildren = regras.indexOf('match /children/{childId}/rides/{dia}');
const blocoChildren = regras.slice(iniChildren, fimChildren);
eq('achou o bloco de children (sonda)', iniChildren > 0 && fimChildren > iniChildren, true);
eq('sonda positiva: o que o motorista NÃO pode tocar está lá (saúde)', /saudeNotas/.test(blocoChildren), true);
eq('nenhum campo da cópia está na lista de proibidos do motorista',
  CAMPOS_DA_COPIA.filter((c) => blocoChildren.includes(c)), []);
eq('a criança passada a outro tio é congelada nas rules (por isso fica de fora do lote)', /transferidaPara/.test(blocoChildren), true);
eq('o motorista atualiza criança dele (ehDoMotorista) sem lista fechada de campos',
  /allow update: if \(\s*ehDoMotorista\(\)/.test(blocoChildren), true);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
