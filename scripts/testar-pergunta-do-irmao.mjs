/**
 * O TELEFONE DIGITADO DEPOIS: O SERVIDOR PERGUNTA, NUNCA VINCULA SOZINHO.
 *
 * `functions/lib/reguaDaPerguntaDoIrmao.js` decide, na TROCA do WhatsApp de
 * uma criança, se o servidor pergunta a uma mãe "É seu filho?", se abre o
 * pedido de quem esperava, ou se dá a `phoneChave` à família que entrou pelo
 * link sem número. Cada caso abaixo é uma forma de errar — e o bloco final
 * ARRANCA cada guarda da régua e exige que algum caso reprove (mutação): um
 * guarda que nenhum teste sente falta não está sendo testado.
 *
 * O comportamento escrito (o gatilho e a callable contra o Firestore) mora em
 * `npm run testar:irmao-depois`, no emulador.
 *
 * COMO RODAR
 *   node scripts/testar-pergunta-do-irmao.mjs   (ou: npm run testar:pergunta-do-irmao)
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ARQUIVO = path.join(import.meta.dirname, '..', 'functions', 'lib', 'reguaDaPerguntaDoIrmao.js');
const FONTE = readFileSync(ARQUIVO, 'utf8');
const { chaveDoTelefone } = require('../functions/lib/reguaDoIrmao.js');

/** Carrega a régua a partir de um texto (a original ou um mutante). */
function carregar(fonte) {
  const m = new Module(ARQUIVO, null);
  m.filename = ARQUIVO;
  m.paths = Module._nodeModulePaths(path.dirname(ARQUIVO));
  m._compile(fonte, ARQUIVO);
  return m.exports;
}

const TEL = '11987654321';
const CHAVE = chaveDoTelefone(TEL);
const CARLA = { uid: 'carla', role: 'parent', adminUids: ['tio1'], phoneChave: CHAVE, childIds: ['irmao1'] };
const SEM_RESP = { name: 'Lucas Silva', adminUid: 'tio1', parentUid: null, parentPhone: TEL, active: true };

/** Os casos: [nome, (R) => obtido, esperado]. Rodam na régua e em cada mutante. */
function casos(R) {
  const troca = (antes, depois) => R.oQueFazerComATroca({ antes, depois });
  const perguntar = (extra = {}) => R.aQuemPerguntar({ crianca: SEM_RESP, contas: [CARLA], ...extra });
  const resp = (extra = {}) =>
    R.respostaDaPergunta({
      uid: 'carla',
      resposta: 'sim',
      registro: { aberta: { parentUid: 'carla', chave: CHAVE, adminUid: 'tio1' } },
      crianca: SEM_RESP,
      conta: CARLA,
      ...extra,
    });
  const chaveFam = (extra = {}) =>
    R.podeGravarChaveDaFamilia({
      conta: { uid: 'mae', role: 'parent', adminUids: ['tio1'], childIds: ['k1'] },
      childId: 'k1',
      motorista: 'tio1',
      chave: CHAVE,
      outrasContas: [],
      ...extra,
    });
  return [
    // ── 1. QUANDO A TROCA PEDE ALGUMA COISA
    ['número digitado onde não havia: procurar', () => troca({ ...SEM_RESP, parentPhone: '' }, SEM_RESP), { acao: 'procurar', chave: CHAVE }],
    ['número trocado por outro: procurar', () => troca({ ...SEM_RESP, parentPhone: '11911112222' }, SEM_RESP).acao, 'procurar'],
    ['chave igual (só a máscara mudou): nada', () => troca({ ...SEM_RESP, parentPhone: '(11) 98765-4321' }, SEM_RESP).acao, 'nada'],
    ['o número antigo sem o nono dígito é a mesma chave: nada', () => troca({ ...SEM_RESP, parentPhone: '11 8765-4321' }, SEM_RESP).acao, 'nada'],
    ['telefone apagado: nada', () => troca(SEM_RESP, { ...SEM_RESP, parentPhone: '' }).acao, 'nada'],
    ['telefone inválido: nada', () => troca({ ...SEM_RESP, parentPhone: '' }, { ...SEM_RESP, parentPhone: '123' }).acao, 'nada'],
    ['outra escrita qualquer (sem mudar o número): nada', () => troca(SEM_RESP, { ...SEM_RESP, irmaoRecusadoEm: 1 }).acao, 'nada'],
    ['criança desativada: nada', () => troca({ ...SEM_RESP, parentPhone: '' }, { ...SEM_RESP, active: false }).acao, 'nada'],
    ['criança transferida: nada', () => troca({ ...SEM_RESP, parentPhone: '' }, { ...SEM_RESP, transferidaPara: 'tio2' }).acao, 'nada'],
    ['sem motorista na criança: nada', () => troca({ ...SEM_RESP, parentPhone: '' }, { ...SEM_RESP, adminUid: '' }).acao, 'nada'],
    ['sem documento depois: nada', () => troca(SEM_RESP, null).acao, 'nada'],
    ['criança JÁ vinculada: a chave da família, nunca procurar', () => troca({ ...SEM_RESP, parentUid: 'mae', parentPhone: '' }, { ...SEM_RESP, parentUid: 'mae' }),
      { acao: 'chave_da_familia', chave: CHAVE, parentUid: 'mae' }],
    ['`parentUid` que não é texto: nada', () => troca({ ...SEM_RESP, parentPhone: '' }, { ...SEM_RESP, parentUid: { x: 1 } }).acao, 'nada'],
    ['já vinculada e desativada: nada', () => troca({ ...SEM_RESP, parentUid: 'mae', parentPhone: '' }, { ...SEM_RESP, parentUid: 'mae', active: false }).acao, 'nada'],

    // ── 2. A QUEM PERGUNTAR
    ['uma conta casa: pergunta a ela', () => perguntar(), { motivo: 'perguntar', parentUid: 'carla' }],
    ['nenhuma conta casa: ninguém', () => perguntar({ contas: [] }).motivo, 'ninguem'],
    ['duas contas casam: ambíguo, ninguém', () => perguntar({ contas: [CARLA, { ...CARLA, uid: 'outra' }] }).motivo, 'ninguem'],
    ['mãe de OUTRO motorista: ninguém', () => perguntar({ contas: [{ ...CARLA, adminUids: ['tio2'] }] }).motivo, 'ninguem'],
    ['conta de motorista com a chave: ninguém', () => perguntar({ contas: [{ ...CARLA, role: 'admin' }] }).motivo, 'ninguem'],
    ['número só no `phone` (que ela edita): ninguém', () => perguntar({ contas: [{ uid: 'x', role: 'parent', adminUids: ['tio1'], phone: TEL }] }).motivo, 'ninguem'],
    ['ela já disse "não é meu filho": não pergunta de novo', () => perguntar({ registro: { recusadoPor: ['carla'] } }).motivo, 'ja_recusou'],
    ['a recusa de OUTRA conta não a impede', () => perguntar({ registro: { recusadoPor: ['outra'] } }).motivo, 'perguntar'],
    ['a mesma pergunta já aberta: não repete (evento entregue duas vezes)', () =>
      perguntar({ registro: { perguntas: 1, aberta: { parentUid: 'carla', chave: CHAVE } } }).motivo, 'ja_perguntado'],
    ['aberta para outro número: pergunta de novo', () =>
      perguntar({ registro: { perguntas: 1, aberta: { parentUid: 'carla', chave: '11911112222' } } }).motivo, 'perguntar'],
    ['teto: três perguntas já feitas, não pergunta mais', () => perguntar({ registro: { perguntas: 3 } }).motivo, 'teto'],
    ['abaixo do teto ainda pergunta', () => perguntar({ registro: { perguntas: 2 } }).motivo, 'perguntar'],
    ['o teto é 3', () => R.TETO_DE_PERGUNTAS, 3],
    ['sem criança: ninguém', () => R.aQuemPerguntar({ crianca: null, contas: [CARLA] }).motivo, 'ninguem'],

    // ── 3. A RESPOSTA
    ['sim, com tudo igual: vincula', () => resp(), { ok: true, vincular: true }],
    ['não: guarda a recusa', () => resp({ resposta: 'nao' }), { ok: true, vincular: false }],
    ['resposta desconhecida: recusada', () => resp({ resposta: 'talvez' }).codigo, 'invalid-argument'],
    ['quem responde não é a perguntada: recusado', () => resp({ uid: 'intrusa' }).codigo, 'failed-precondition'],
    ['…nem dizendo "não"', () => resp({ uid: 'intrusa', resposta: 'nao' }).codigo, 'failed-precondition'],
    ['sem pergunta aberta (aviso forjado): recusado', () => resp({ registro: { aberta: null } }).codigo, 'failed-precondition'],
    ['sem registro nenhum: recusado', () => resp({ registro: null }).codigo, 'failed-precondition'],
    ['conta que não é responsável: recusado', () => resp({ conta: { ...CARLA, role: 'admin' } }).codigo, 'failed-precondition'],
    ['o número mudou depois da pergunta: o sim vence', () => resp({ crianca: { ...SEM_RESP, parentPhone: '11911112222' } }).codigo, 'failed-precondition'],
    ['a criança ganhou responsável (o link chegou antes): o sim vence', () => resp({ crianca: { ...SEM_RESP, parentUid: 'outra' } }).codigo, 'failed-precondition'],
    ['a criança foi desativada: o sim vence', () => resp({ crianca: { ...SEM_RESP, active: false } }).codigo, 'failed-precondition'],
    ['a criança foi transferida: o sim vence', () => resp({ crianca: { ...SEM_RESP, transferidaPara: 'tio2' } }).codigo, 'failed-precondition'],
    ['a criança mudou de motorista: o sim vence', () => resp({ crianca: { ...SEM_RESP, adminUid: 'tio2' } }).codigo, 'failed-precondition'],
    ['ela deixou de ser família do motorista: o sim vence', () => resp({ conta: { ...CARLA, adminUids: [] } }).codigo, 'failed-precondition'],
    ['a criança sumiu: o sim vence', () => resp({ crianca: null }).codigo, 'failed-precondition'],
    ['…mas o "não" ainda se guarda (recusar não expõe nada)', () => resp({ crianca: null, resposta: 'nao' }).ok, true],

    // ── 4. A CHAVE DA FAMÍLIA QUE ENTROU SEM NÚMERO
    ['família com a criança e sem chave: grava', () => chaveFam(), true],
    ['já tem chave: nunca sobrescreve', () => chaveFam({ conta: { uid: 'mae', role: 'parent', adminUids: ['tio1'], childIds: ['k1'], phoneChave: '11900000000' } }), false],
    ['a chave já é de OUTRA conta: não grava', () => chaveFam({ outrasContas: ['outra'] }), false],
    ['a única conta com a chave é ela mesma: grava', () => chaveFam({ outrasContas: ['mae'] }), true],
    ['a conta não tem esta criança na lista (parentUid plantado): não grava', () =>
      chaveFam({ conta: { uid: 'mae', role: 'parent', adminUids: ['tio1'], childIds: ['outra'] } }), false],
    ['pelo `childId` legado também vale', () => chaveFam({ conta: { uid: 'mae', role: 'parent', adminUids: ['tio1'], childId: 'k1' } }), true],
    ['a conta não é família deste motorista: não grava', () => chaveFam({ motorista: 'tio2' }), false],
    ['conta de motorista: não grava', () => chaveFam({ conta: { uid: 'mae', role: 'admin', adminUids: ['tio1'], childIds: ['k1'] } }), false],
    ['sem chave: não grava', () => chaveFam({ chave: null }), false],

    // ── 5. O AVISO SÓ LEVA O PRIMEIRO NOME
    ['a pergunta usa a marca do motorista e o primeiro nome', () =>
      R.avisoDaPergunta({ nomeDaCrianca: 'Lucas Silva Souza', motorista: { marcaNome: 'Tio Nino', name: 'João Pereira' } }),
      { title: 'Tio Nino cadastrou Lucas com o seu número', body: 'É seu filho? Toque para responder.', primeiroNome: 'Lucas' }],
    ['sem marca, o primeiro nome do motorista', () => R.avisoDaPergunta({ nomeDaCrianca: 'Ana', motorista: { name: 'João Pereira' } }).title,
      'João cadastrou Ana com o seu número'],
    ['o aviso não leva o sobrenome da criança', () => JSON.stringify(R.avisoDaPergunta({ nomeDaCrianca: 'Lucas Silva', motorista: null })).includes('Silva'), false],
    ['o id do aviso é determinístico', () => R.idDoAvisoDaPergunta('k1', 2), 'irmao_pergunta_k1_2'],
  ];
}

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
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const R = carregar(FONTE);
bloco('1-5 · A RÉGUA');
for (const [nome, f, esperado] of casos(R)) checar(nome, esperado, f());

/** Roda os casos num mutante e devolve quantos reprovaram. */
function reprovacoes(Rm) {
  let n = 0;
  for (const [, f, esperado] of casos(Rm)) {
    let obtido;
    try {
      obtido = f();
    } catch {
      obtido = '__lançou__';
    }
    if (JSON.stringify(obtido) !== JSON.stringify(esperado)) n += 1;
  }
  return n;
}

bloco('6 · MUTAÇÃO — cada guarda arrancado precisa reprovar algum caso');
const MUTANTES = [
  ['troca: chave igual', "if (chaveDoTelefone(antes && antes.parentPhone) === chave) return { acao: ACAO.NADA };"],
  ['troca: sem chave', 'if (!chave) return { acao: ACAO.NADA };'],
  ['troca: desativada', 'if (depois.active === false) return { acao: ACAO.NADA };'],
  ['troca: transferida', 'if (depois.transferidaPara) return { acao: ACAO.NADA };'],
  ['troca: parentUid não-texto', 'if (depois.parentUid) return { acao: ACAO.NADA };'],
  ['troca: sem motorista', "if (typeof depois.adminUid !== 'string' || !depois.adminUid) return { acao: ACAO.NADA };"],
  ['pergunta: já recusou', 'if (recusas.includes(uid)) return { motivo: MOTIVO.JA_RECUSOU, parentUid: null };'],
  ['pergunta: teto', 'if ((Number(r.perguntas) || 0) >= TETO_DE_PERGUNTAS) return { motivo: MOTIVO.TETO, parentUid: null };'],
  ['resposta: conta responsável', "if (!conta || conta.role !== 'parent') {"],
  ['resposta: criança sem responsável', '    !crianca.parentUid &&'],
  ['resposta: ativa', '    crianca.active !== false &&'],
  ['resposta: não transferida', '    !crianca.transferidaPara &&'],
  ['resposta: mesma chave', '    chaveDoTelefone(crianca.parentPhone) === aberta.chave &&'],
  ['resposta: família do motorista', '    ehFamiliaDe(conta, crianca.adminUid);'],
  ['chave: já tem chave', 'if (conta.phoneChave) return false;'],
  ['chave: criança na lista', 'if (!lista.includes(childId) && conta.childId !== childId) return false;'],
  ['chave: família do motorista', 'if (!ehFamiliaDe(conta, motorista)) return false;'],
  ['chave: outra conta', 'if (outrasContas.some((u) => u && u !== conta.uid)) return false;'],
];
function mutar(trecho) {
  if (!FONTE.includes(trecho)) return null;
  // Um `if (...) {` abre bloco: o mutante troca a condição por `if (false) {`.
  if (/^if \(.*\) \{$/.test(trecho.trim())) return FONTE.replace(trecho, 'if (false) {');
  // Uma linha de uma conjunção `a && b && c`: vira `true &&` (ou `true;` no fim).
  if (/&&$/.test(trecho.trim())) return FONTE.replace(trecho, '    true &&');
  if (/^\s*ehFamiliaDe\(.*\);$/.test(trecho)) return FONTE.replace(trecho, '    true;');
  return FONTE.replace(trecho, '');
}
for (const [nome, trecho] of MUTANTES) {
  const fonte = mutar(trecho);
  checar(`o trecho existe na régua: ${nome}`, true, fonte !== null);
  if (!fonte) continue;
  checar(`sem o guarda, algum caso reprova: ${nome}`, true, reprovacoes(carregar(fonte)) > 0);
}
checar('SONDA: a régua original não reprova nada', 0, reprovacoes(R));

bloco('7 · O GATILHO E A RESPOSTA, PELO TEXTO');
const gatilho = readFileSync(path.join(import.meta.dirname, '..', 'functions', 'lib', 'perguntaDoIrmao.js'), 'utf8');
const semComentario = gatilho.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
checar('é gatilho de ATUALIZAÇÃO em children', true, /onDocumentUpdated\(\s*\{\s*document: 'children\/\{childId\}'/.test(semComentario));
checar('o gatilho nunca reescreve o telefone nem a chave da criança (sem laço)', false,
  /parentPhone(Chave)?\s*:/.test(semComentario));
checar('a pergunta NUNCA grava `parentUid` pelo gatilho: só `gravarVinculoDeIrmao` na resposta', 1,
  (semComentario.match(/gravarVinculoDeIrmao\(tx/g) || []).length);
checar('…e essa chamada está dentro de `makeResponderIrmao`', true,
  semComentario.indexOf('gravarVinculoDeIrmao(tx') > semComentario.indexOf('function makeResponderIrmao'));
checar('o "sim" reaproveita o vínculo do irmão (mesmas escritas, outro `vinculadoPor`)', true,
  semComentario.includes("vinculadoPor: 'irmao_confirmado'"));
checar('o "não" reaproveita o aviso ao motorista do `recusarIrmao`', true,
  semComentario.includes('avisarMotoristaDaRecusa(db'));
checar('quem esperava: o mesmo `abrirPedidosDeQuemEspera` do cadastro', true,
  semComentario.includes('abrirPedidosDeQuemEspera(db'));
checar('a resposta confere o `childId` com idValido antes de virar caminho', true,
  semComentario.indexOf('idValido(childId)') < semComentario.indexOf('children/${childId}', semComentario.indexOf('function makeResponderIrmao')));
checar('o registro mora numa coleção que só o servidor lê', true,
  !/match \/perguntasDeIrmao\//.test(readFileSync(path.join(import.meta.dirname, '..', 'firestore.rules'), 'utf8')));
const vincular = readFileSync(path.join(import.meta.dirname, '..', 'functions', 'lib', 'vincularIrmao.js'), 'utf8');
checar('"Não é meu filho" do irmão automático também guarda a recusa para sempre', true,
  vincular.includes('await guardarRecusa(db, { childId, parentUid: uid'));
checar('a régua não requer o SDK', false, /require\('firebase-(admin|functions)/.test(FONTE));
const avisos = readFileSync(path.join(import.meta.dirname, '..', 'functions', 'lib', 'avisos.js'), 'utf8');
checar('a pergunta é aviso de espécie `fato` (não se desliga)', true, avisos.includes('irmao_pergunta: ESPECIE.FATO'));
const cartao = readFileSync(path.join(import.meta.dirname, '..', 'src', 'components', 'children', 'AvisoDeIrmao.jsx'), 'utf8');
checar('o cartão da mãe tem as duas respostas', true, cartao.includes('Sim, é meu filho') && cartao.includes('Não é meu filho'));
checar('o cartão manda a resposta ao servidor (não decide sozinho)', true, cartao.includes('responderIrmao(aviso.childId, resposta)'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
