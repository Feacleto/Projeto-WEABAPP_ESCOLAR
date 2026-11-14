/**
 * A declaração de autorização é gravada POR CRIANÇA, por qualquer caminho —
 * Node puro, como o resto de scripts/.
 * Rodar: npm run testar:declaracao-por-crianca
 *
 * POR QUE ISTO EXISTE
 * O formulário completo exigia o checkbox `autorizacaoDeclarada` e até montava
 * `autorizacaoDeclaradaEm`, mas `addChild` monta um payload explícito e NÃO
 * gravava nada disso: a declaração morria na tela. E os dois caminhos rápidos
 * (o cadastro do primeiro acesso e a vaga da perua) nem perguntavam. Resultado:
 * criança no banco sem prova de quem declarou a autorização, nem quando.
 *
 * O QUE ESTE ARQUIVO AFIRMA
 *   1. A régua pura (`camposDaDeclaracao`): só `true` exato, com autor e data,
 *      vira os três campos; qualquer outra coisa é `null`.
 *   2. O SERVIÇO, de verdade: `addChild` roda aqui com o Firebase trocado por
 *      um espião, e o documento que ia para o banco tem os três campos —
 *      `autorizacaoDeclarada: true`, `autorizacaoDeclaradaEm` (carimbo do
 *      servidor) e `autorizacaoDeclaradaPor` (uid da sessão). Sem declaração,
 *      nada é gravado: o `setDoc` nem é chamado. `Em` e `Por` vindos de fora
 *      são ignorados (o chamador nunca escolhe quando nem quem).
 *   3. As TRÊS vias passam por esse serviço e só mandam `true` depois de a
 *      declaração existir (a tela pergunta; o serviço é a tranca). Qualquer
 *      chamador novo de `addChild` reprova aqui até alguém conferi-lo.
 *   4. `updateChild` (o "completar") só grava a declaração inteira, com
 *      data e autor do servidor — e não regrava a de quem já a tinha.
 *   5. A sessão: a pergunta pode ser feita uma vez, por usuário e só em
 *      memória (nunca `localStorage`).
 *
 * O Firebase não carrega no Node, então o serviço é importado por um
 * "loader" que troca `firebase/firestore`, a config e os dois serviços
 * vizinhos por espiões. O código testado é o de produção, byte a byte.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import {
  camposDaDeclaracao,
  ERRO_DA_DECLARACAO,
  TEXTO_DA_DECLARACAO,
  esquecerDeclaracoes,
  jaDeclarouNestaSessao,
  lembrarDaDeclaracao,
} from '../src/dominio/identidade/autorizacaoDeclarada.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8').replace(/\r\n/g, '\n');

let ok = 0;
let bad = 0;
function afirma(nome, cond, detalhe = '') {
  if (cond) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}${detalhe ? `\n    ${detalhe}` : ''}`);
  }
}
function igual(nome, obtido, esperado) {
  afirma(nome, JSON.stringify(obtido) === JSON.stringify(esperado),
    `esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
}

// ── 1. A régua pura ───────────────────────────────────────────────────────
console.log('1. A régua pura');
const T = { selo: 'carimbo-do-servidor' };
igual('declaração completa vira os três campos',
  camposDaDeclaracao({ declarada: true, uid: 'tio1', quando: T }),
  { autorizacaoDeclarada: true, autorizacaoDeclaradaEm: T, autorizacaoDeclaradaPor: 'tio1' });
for (const [nome, entrada] of [
  ['sem argumento', undefined],
  ['declarada ausente', { uid: 'tio1', quando: T }],
  ['declarada false', { declarada: false, uid: 'tio1', quando: T }],
  ['declarada "true" (texto)', { declarada: 'true', uid: 'tio1', quando: T }],
  ['declarada 1', { declarada: 1, uid: 'tio1', quando: T }],
  ['sem uid', { declarada: true, quando: T }],
  ['uid vazio', { declarada: true, uid: '', quando: T }],
  ['uid null (sem sessão)', { declarada: true, uid: null, quando: T }],
  ['sem data', { declarada: true, uid: 'tio1' }],
]) {
  igual(`recusa: ${nome}`, camposDaDeclaracao(entrada), null);
}
afirma('o texto da declaração é um só e fala de autorização do responsável',
  TEXTO_DA_DECLARACAO.destaque === 'autorização do responsável legal'
  && TEXTO_DA_DECLARACAO.depois.includes('operar o transporte escolar'));
afirma('o texto não menciona saúde (isso é consentimento da responsável)',
  !/sa[uú]de|alergia/i.test(Object.values(TEXTO_DA_DECLARACAO).join(' ')));

// ── 2. O serviço, de verdade, com o Firebase trocado por um espião ────────
console.log('2. addChild e updateChild de verdade');
const hooks = `
const mocks = {
  'mock:config': 'export const db = { __db: true }; export const auth = globalThis.__auth;',
  'mock:firestore': \`
    export const serverTimestamp = () => ({ __serverTimestamp: true });
    export const collection = (_db, nome) => ({ __col: nome });
    export const doc = (a, nome, id) => (id ? { __doc: nome + '/' + id } : { __doc: (a.__col || 'x') + '/novo-id', id: 'novo-id' });
    export const setDoc = async (ref, payload) => { globalThis.__gravacoes.push({ tipo: 'setDoc', ref, payload }); };
    export const updateDoc = async (ref, payload) => { globalThis.__gravacoes.push({ tipo: 'updateDoc', ref, payload }); };
    export const deleteField = () => ({ __deleteField: true });
    export const getDoc = async () => ({ exists: () => false });
    export const query = () => ({});
    export const where = () => ({});
    export const onSnapshot = () => () => {};
  \`,
  'mock:invite': 'export const inviteCodeExists = async () => false;',
  'mock:sound': 'export const playSound = () => {};',
};
export async function resolve(specifier, context, next) {
  if (/\\/firebase\\/config$/.test(specifier)) return { url: 'mock:config', shortCircuit: true };
  if (specifier === 'firebase/firestore') return { url: 'mock:firestore', shortCircuit: true };
  if (/\\/inviteCodeService$/.test(specifier)) return { url: 'mock:invite', shortCircuit: true };
  if (/\\/soundService$/.test(specifier)) return { url: 'mock:sound', shortCircuit: true };
  try { return await next(specifier, context); }
  catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) return next(specifier + '.js', context);
    throw e;
  }
}
export async function load(url, context, next) {
  if (mocks[url]) return { format: 'module', source: mocks[url], shortCircuit: true };
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`, import.meta.url);

globalThis.__gravacoes = [];
globalThis.__auth = { currentUser: { uid: 'tio1' } };
const servico = await import(pathToFileURL(join(raiz, 'src/services/childrenService.js')).href);

const base = { name: 'Lucas', gender: 'male' };
const gravou = () => globalThis.__gravacoes.length;
const limpa = () => { globalThis.__gravacoes.length = 0; };

limpa();
await servico.addChild({ ...base, autorizacaoDeclarada: true });
afirma('addChild com declaração grava UM documento', gravou() === 1);
let doc = globalThis.__gravacoes[0]?.payload || {};
igual('  autorizacaoDeclarada é true', doc.autorizacaoDeclarada, true);
igual('  autorizacaoDeclaradaEm é o carimbo do servidor', doc.autorizacaoDeclaradaEm, { __serverTimestamp: true });
igual('  autorizacaoDeclaradaPor é o uid de quem cadastrou', doc.autorizacaoDeclaradaPor, 'tio1');
igual('  o adminUid continua sendo o mesmo uid', doc.adminUid, 'tio1');

// O mesmo caminho que o cadastro rápido e a vaga da perua usam: só o mínimo.
limpa();
await servico.addChild({ name: 'Ana', gender: null, cadastroRapido: true, autorizacaoDeclarada: true });
doc = globalThis.__gravacoes[0]?.payload || {};
afirma('a criança do cadastro rápido (só nome) também nasce com os três campos',
  doc.autorizacaoDeclarada === true && doc.autorizacaoDeclaradaPor === 'tio1'
  && doc.autorizacaoDeclaradaEm?.__serverTimestamp === true && doc.cadastroRapido === true);

// Sem declaração, NADA é gravado.
for (const [nome, extra] of [
  ['campo ausente', {}],
  ['false', { autorizacaoDeclarada: false }],
  ['texto "true"', { autorizacaoDeclarada: 'true' }],
  ['só a data/autor, sem a declaração', { autorizacaoDeclaradaEm: 'x', autorizacaoDeclaradaPor: 'tio1' }],
]) {
  limpa();
  let erro = null;
  try { await servico.addChild({ ...base, ...extra }); } catch (e) { erro = e; }
  afirma(`sem declaração (${nome}): recusa`, erro?.message === ERRO_DA_DECLARACAO, `erro: ${erro?.message}`);
  afirma(`sem declaração (${nome}): nada é gravado`, gravou() === 0);
}

// Sem sessão, não há quem declare.
globalThis.__auth.currentUser = null;
limpa();
let semSessao = null;
try { await servico.addChild({ ...base, autorizacaoDeclarada: true }); } catch (e) { semSessao = e; }
afirma('sem sessão (uid ausente): recusa e não grava', !!semSessao && gravou() === 0);
globalThis.__auth.currentUser = { uid: 'tio1' };

// Autor e data nunca vêm de fora.
limpa();
await servico.addChild({
  ...base,
  autorizacaoDeclarada: true,
  autorizacaoDeclaradaEm: '2020-01-01T00:00:00.000Z',
  autorizacaoDeclaradaPor: 'outra-pessoa',
});
doc = globalThis.__gravacoes[0]?.payload || {};
igual('Em de fora é ignorado (vale o carimbo do servidor)', doc.autorizacaoDeclaradaEm, { __serverTimestamp: true });
igual('Por de fora é ignorado (vale o uid da sessão)', doc.autorizacaoDeclaradaPor, 'tio1');

// ── 3. O "completar" (updateChild) ────────────────────────────────────────
console.log('3. updateChild (completar)');
limpa();
await servico.updateChild('c1', { name: 'Lucas', autorizacaoDeclarada: true });
let up = globalThis.__gravacoes[0]?.payload || {};
afirma('completar criança SEM registro: grava os três campos, com data e uid do servidor',
  up.autorizacaoDeclarada === true && up.autorizacaoDeclaradaEm?.__serverTimestamp === true
  && up.autorizacaoDeclaradaPor === 'tio1');

limpa();
await servico.updateChild('c1', { name: 'Lucas' });
up = globalThis.__gravacoes[0]?.payload || {};
afirma('update comum não toca na declaração',
  !('autorizacaoDeclarada' in up) && !('autorizacaoDeclaradaEm' in up) && !('autorizacaoDeclaradaPor' in up));

limpa();
await servico.updateChild('c1', {
  autorizacaoDeclarada: false,
  autorizacaoDeclaradaEm: '2020-01-01',
  autorizacaoDeclaradaPor: 'outra-pessoa',
});
up = globalThis.__gravacoes[0]?.payload || {};
afirma('false, Em e Por avulsos são descartados (não se fabrica nem se desfaz a história)',
  !('autorizacaoDeclarada' in up) && !('autorizacaoDeclaradaEm' in up) && !('autorizacaoDeclaradaPor' in up));

// ── 4. As três vias ───────────────────────────────────────────────────────
console.log('4. As três vias passam pelo serviço, com a declaração antes');
function arquivosDe(dir, acc = []) {
  for (const nome of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(raiz, rel)).isDirectory()) arquivosDe(rel, acc);
    else if (/\.(jsx?|mjs)$/.test(nome)) acc.push(rel);
  }
  return acc;
}
const chamadores = arquivosDe('src')
  .filter((f) => !f.endsWith('services/childrenService.js'))
  .filter((f) => /\baddChild\s*\(/.test(ler(f)))
  .sort();
igual('exatamente quatro arquivos chamam addChild (um quinto reprova aqui até ser conferido)',
  chamadores,
  [
    'src/components/children/AdicionarCrianca.jsx',
    'src/components/children/CadastroRapidoDaCrianca.jsx',
    'src/components/children/ChildForm.jsx',
    'src/components/perua/FolhaDaVagaRapida.jsx',
  ]);

const sem = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Via 1: formulário completo. O passo 1 exige a caixa, e `...form` leva o `true`.
{
  const f = sem(ler('src/components/children/ChildForm.jsx'));
  afirma('via 1 (formulário): o passo 1 recusa avançar sem a declaração',
    /if \(!form\.autorizacaoDeclarada\)\s*\{\s*errs\.autorizacaoDeclarada = ERRO_DA_DECLARACAO/.test(f));
  afirma('via 1 (formulário): o payload do addChild leva `...form` (com a declaração)',
    /const payload = \{\s*id: idReservado,\s*\.\.\.form,/.test(f));
  afirma('via 1 (formulário): não escreve data de declaração pelo aparelho',
    !/autorizacaoDeclaradaEm\s*:/.test(f) && !/autorizacaoDeclaradaPor\s*:/.test(f));
  afirma('via 1 (formulário): usa a caixa e o texto compartilhados',
    f.includes('<DeclaracaoDeAutorizacao') && !f.includes('Confirmo que tenho'));
  afirma('via 1 (completar): quem já tem declaração não a reenvia (a data original fica)',
    /if \(paraCompletar\?\.autorizacaoDeclarada === true\) delete resto\.autorizacaoDeclarada;/.test(f));
}
// Vias 2 e 3: os caminhos rápidos pedem a declaração antes de salvar.
for (const [nome, arq] of [
  ['via 2 (cadastro rápido do primeiro acesso)', 'src/components/children/CadastroRapidoDaCrianca.jsx'],
  ['via 3 (vaga rápida da perua)', 'src/components/perua/FolhaDaVagaRapida.jsx'],
  ['via 4 (a linha "+ Nome" da Lista da turma)', 'src/components/children/AdicionarCrianca.jsx'],
]) {
  const f = sem(ler(arq));
  const iConfirma = f.indexOf('declaracao.confirmar()');
  const iChama = f.search(/\baddChild\s*\(/);
  afirma(`${nome}: confere a declaração ANTES de chamar addChild`,
    iConfirma !== -1 && iChama !== -1 && iConfirma < iChama);
  afirma(`${nome}: a recusa interrompe o salvar (return)`,
    /if \(!declaracao\.confirmar\(\)\) return;/.test(f));
  afirma(`${nome}: só manda \`autorizacaoDeclarada: true\` (nunca outro valor, nem herdado)`,
    /autorizacaoDeclarada: true/.test(f) && !/autorizacaoDeclarada: (?!true)/.test(f));
  afirma(`${nome}: a caixa aparece quando ainda não declarou na sessão`,
    f.includes('<DeclaracaoDeAutorizacao') && f.includes('declaracao.jaDeclarou'));
  afirma(`${nome}: só lembra da declaração DEPOIS de salvar`,
    f.indexOf('declaracao.lembrar()') > iChama);
  afirma(`${nome}: não guarda a declaração em localStorage`, !/localStorage|sessionStorage/.test(f));
}
// O card do primeiro acesso JÁ pergunta, uma vez para a turma, e só deixa
// seguir com a caixa marcada: esse "sim" vale para a sessão (não pergunta duas
// vezes), mas só depois de a pessoa tocar no botão que ele destrava.
{
  const f = sem(ler('src/pages/tio/PrimeiroAcesso.jsx'));
  afirma('primeiro acesso: o botão da turma só acende com a caixa marcada',
    /disabled=\{!autorizou\}/.test(f));
  afirma('primeiro acesso: lembra da declaração só se a caixa está marcada',
    /if \(autorizou\) lembrarDaDeclaracao\(user\?\.uid\);/.test(f));
}
{
  const h = sem(ler('src/hooks/useDeclaracaoDaSessao.js'));
  afirma('o hook da sessão não usa localStorage nem sessionStorage', !/localStorage|sessionStorage/.test(h));
  const d = sem(ler('src/dominio/identidade/autorizacaoDeclarada.js'));
  afirma('a memória da sessão é de módulo, não de navegador', !/localStorage|sessionStorage/.test(d));
}
// O serviço é a tranca: a checagem vem antes de qualquer rede.
{
  const s = sem(ler('src/services/childrenService.js'));
  const iDecl = s.indexOf('camposDaDeclaracao({');
  const iCodigo = s.indexOf('await generateUniqueInviteCode()');
  afirma('addChild confere a declaração antes de gastar rede com o código do convite',
    iDecl !== -1 && iCodigo !== -1 && iDecl < iCodigo);
  afirma('addChild espalha os três campos no payload', /\.\.\.declaracao,/.test(s));
}

// ── 5. A sessão ───────────────────────────────────────────────────────────
console.log('5. A pergunta uma vez por sessão, por usuário');
esquecerDeclaracoes();
afirma('começa sem ninguém ter declarado', !jaDeclarouNestaSessao('tio1'));
lembrarDaDeclaracao('tio1');
afirma('depois de declarar, não pergunta de novo', jaDeclarouNestaSessao('tio1'));
afirma('outro usuário no mesmo aparelho é perguntado', !jaDeclarouNestaSessao('tio2'));
afirma('sem uid, nunca vale como declarado', !jaDeclarouNestaSessao(null) && !jaDeclarouNestaSessao(''));
lembrarDaDeclaracao(null);
afirma('sem uid, lembrar não registra ninguém', !jaDeclarouNestaSessao(null));
esquecerDeclaracoes();

console.log(`\n${ok} passaram, ${bad} falharam`);
if (bad > 0) process.exit(1);
