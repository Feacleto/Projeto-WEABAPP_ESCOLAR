/**
 * O IRMÃO SE RECONHECE PELO WHATSAPP — e só por ele.
 *
 * `functions/lib/reguaDoIrmao.js` decide a que conta uma criança recém
 * cadastrada é vinculada SOZINHA, sem convite. Errar aqui entrega endereço,
 * escola e foto de uma criança a outra família — por isso a régua é pura e
 * cada caso abaixo é uma das formas de errar.
 *
 * COMO RODAR
 *   node scripts/testar-irmaos.mjs      (ou: npm run testar:irmaos)
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { responsavelDoIrmao, criancasQueEsperam, chaveDoTelefone, ehFamiliaDe } = require('../functions/lib/reguaDoIrmao.js');
const { podeDesvincular } = require('../functions/lib/reguaDoDesvinculo.js');
const { idValido, mesValido } = require('../functions/lib/reguaDosIds.js');

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

const CARLA = { uid: 'carla', role: 'parent', adminUids: ['tio1'], phoneChave: chaveDoTelefone('11987654321') };

bloco('1 · O NÚMERO CASA');
checar('mesmo número, mesma conta', 'carla',
  responsavelDoIrmao({ motorista: 'tio1', telefone: '(11) 98765-4321', contas: [CARLA] }));
checar('o número antigo, sem o nono dígito, é a mesma pessoa', 'carla',
  responsavelDoIrmao({ motorista: 'tio1', telefone: '(11) 8765-4321', contas: [CARLA] }));
checar('com +55 na frente também', 'carla',
  responsavelDoIrmao({ motorista: 'tio1', telefone: '+55 11 98765-4321', contas: [CARLA] }));
checar('pela criança já vinculada do mesmo motorista (conta antiga, sem chave)', 'carla',
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    criancas: [{ parentUid: 'carla', parentPhone: '11 98765-4321', inviteStatus: 'used', inviteUsedAt: 1 }],
  }));
checar('conta e criança apontando para a mesma pessoa não é ambíguo', 'carla',
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    contas: [CARLA],
    criancas: [{ parentUid: 'carla', parentPhone: '11987654321', vinculadoPor: 'irmao' }],
  }));

bloco('2 · NA DÚVIDA, NÃO VINCULA');
checar('número diferente não casa', null,
  responsavelDoIrmao({ motorista: 'tio1', telefone: '11912345678', contas: [CARLA] }));
checar('sem número, nada', null, responsavelDoIrmao({ motorista: 'tio1', telefone: '', contas: [CARLA] }));
checar('número casando com DUAS contas é ambíguo', null,
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    contas: [CARLA, { uid: 'outra', role: 'parent', adminUids: ['tio1'], phoneChave: CARLA.phoneChave }],
  }));
checar('motorista com o mesmo número não é responsável', null,
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    contas: [{ uid: 'tio', role: 'admin', adminUids: ['tio1'], phoneChave: CARLA.phoneChave }],
  }));
checar('criança ainda sem responsável não conta', null,
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    criancas: [{ parentUid: null, parentPhone: '11987654321' }],
  }));

bloco('3 · ⚠️ O TELEFONE QUE A PESSOA EDITA NÃO CONTA');
/* `phone` a responsável muda no perfil. Se a régua o lesse, pôr ali o número
   de outra mãe daria os filhos dela a quem mudou. Só `phoneChave` vale — e
   ela só é gravada pelo servidor, do número que o MOTORISTA digitou. */
checar('conta com o número só no `phone` NÃO casa', null,
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    contas: [{ uid: 'intrusa', role: 'parent', adminUids: ['tio1'], phone: '11987654321' }],
  }));
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
checar('e as rules proíbem o cliente de escrever `phoneChave`', true,
  /\.hasAny\(\[[\s\S]*?'phoneChave'[\s\S]*?\]\)/.test(rules));
const invites = readFileSync(new URL('../functions/lib/invites.js', import.meta.url), 'utf8');
checar('o resgate grava a chave do número do cadastro, não do perfil', true,
  invites.includes('chaveDoTelefone(child.parentPhone)'));

bloco('3b · ⚠️ SÓ VINCULA QUEM JÁ É FAMÍLIA DESTE MOTORISTA');
/* A conta era procurada na plataforma inteira: um motorista novo, sabendo só
   o WhatsApp de uma mãe de outra perua, ganhava acesso a ela. */
checar('mãe de OUTRO motorista não é vinculada', null,
  responsavelDoIrmao({ motorista: 'intruso', telefone: '11987654321', contas: [CARLA] }));
checar('sem motorista na criança, nenhuma conta casa', null,
  responsavelDoIrmao({ telefone: '11987654321', contas: [CARLA] }));
checar('o campo singular antigo também vale como vínculo', 'carla',
  responsavelDoIrmao({ motorista: 'tio9', telefone: '11987654321',
    contas: [{ uid: 'carla', role: 'parent', adminUid: 'tio9', phoneChave: CARLA.phoneChave }] }));
checar('o gatilho passa o motorista da criança', true,
  readFileSync(new URL('../functions/lib/vincularIrmao.js', import.meta.url), 'utf8').includes('motorista: crianca.adminUid'));

bloco('3c · ⚠️ SÓ CONTA CRIANÇA VINCULADA PELO SERVIDOR (03/10/2026)');
/* O `parentUid` de uma criança do motorista pode ter sido escrito por ELE:
   uid da vítima + telefone dela, e a criança seguinte com esse número
   entraria sozinha na conta dela. */
const plantada = { parentUid: 'vitima', parentPhone: '11987654321' };
checar('criança com parentUid plantado (sem marca do resgate) NÃO vincula', null,
  responsavelDoIrmao({ motorista: 'tio1', telefone: '11987654321', criancas: [plantada] }));
checar('inviteStatus "used" sem inviteUsedAt também não', null,
  responsavelDoIrmao({ motorista: 'tio1', telefone: '11987654321', criancas: [{ ...plantada, inviteStatus: 'used' }] }));
checar('com a marca do resgate (used + inviteUsedAt), conta', 'vitima',
  responsavelDoIrmao({ motorista: 'tio1', telefone: '11987654321',
    criancas: [{ ...plantada, inviteStatus: 'used', inviteUsedAt: { seconds: 1 } }] }));
checar('com `vinculadoPor` (aprovação/irmão), conta', 'vitima',
  responsavelDoIrmao({ motorista: 'tio1', telefone: '11987654321',
    criancas: [{ ...plantada, vinculadoPor: 'aprovacao' }] }));
checar('ehFamiliaDe: a lista de motoristas da conta', true, ehFamiliaDe({ adminUids: ['tio1'] }, 'tio1'));
checar('ehFamiliaDe: conta de outro motorista', false, ehFamiliaDe({ adminUids: ['tio2'] }, 'tio1'));
const vincularTxt = readFileSync(new URL('../functions/lib/vincularIrmao.js', import.meta.url), 'utf8');
checar('o gatilho reconfere ehFamiliaDe na conta escolhida ANTES de escrever', true,
  /if \(!ehFamiliaDe\(u\.data\(\), crianca\.adminUid\)\) return false;[\s\S]*?tx\.update\(childRef/.test(vincularTxt));

bloco('4 · SÓ O VÍNCULO AUTOMÁTICO PODE SER DESFEITO PELA MÃE');
const vincular = readFileSync(new URL('../functions/lib/vincularIrmao.js', import.meta.url), 'utf8');
checar('o gatilho marca o vínculo como de irmão', true,
  vincular.includes("vinculadoPor: 'irmao'"));
checar('e a recusa só aceita esse vínculo', true,
  vincular.includes("dados.vinculadoPor !== 'irmao'"));
checar('o escopo da recusa vem de quem chama', true,
  /dados\.parentUid !== uid/.test(vincular));

bloco('5 · O PEDIDO DE ACESSO SEM LINK SÓ PEDE, NUNCA LIGA');
/* Quem chega sem o link informa o WhatsApp. As crianças SEM responsável
   cadastradas com ele viram pedido para o motorista; nenhuma é vinculada. */
const LUCAS = { id: 'k1', parentUid: null, parentPhone: '11 98765-4321', adminUid: 'tio1', name: 'Lucas' };
checar('a criança que espera é achada pelo número', ['k1'],
  criancasQueEsperam({ telefone: '(11) 8765-4321', criancas: [LUCAS] }).map((k) => k.id));
checar('criança que já tem responsável não vira pedido', [],
  criancasQueEsperam({ telefone: '11987654321', criancas: [{ ...LUCAS, parentUid: 'outra' }] }));
checar('número diferente, nada', [],
  criancasQueEsperam({ telefone: '11912345678', criancas: [LUCAS] }));
checar('o mesmo número em duas peruas vira dois pedidos', 2,
  criancasQueEsperam({
    telefone: '11987654321',
    criancas: [LUCAS, { ...LUCAS, id: 'k2', adminUid: 'tio2' }],
  }).length);
const pedidos = readFileSync(new URL('../functions/lib/pedidosDeAcesso.js', import.meta.url), 'utf8');
const pedirAcesso = pedidos.slice(
  pedidos.indexOf('function makePedirAcessoPeloTelefone'),
  pedidos.indexOf('function makeResponderPedidoDeAcesso')
);
checar('o pedido não grava `parentUid` em criança nenhuma', false,
  /parentUid:\s*uid/.test(pedirAcesso) && /children\//.test(pedirAcesso));
checar('nem a chave do irmão — o número dela não é comprovado', false,
  pedirAcesso.includes('phoneChave'));
checar('quem aprova é o motorista dono da criança', true,
  pedidos.includes('dados.adminUid !== adminUid') && pedidos.includes('exigirMotorista'));
/* ⚠️ A RESPOSTA ERA `{ encontrou: N }` E PASSOU A SER `{ ok: true }`
   (03/10/2026). Ela não dizia o nome da criança, mas dizia SE havia criança
   com aquele número — e quem digita números um atrás do outro lia, na
   resposta, quais telefones estão cadastrados na plataforma. Agora a mesma
   resposta sai com ou sem criança achada, e a tela diz "se o número estiver
   cadastrado, o motorista recebe o pedido". */
checar('a resposta é a mesma, ache ou não criança com o número', true,
  /return \{ ok: true \};/.test(pedirAcesso));
checar('e não devolve mais quantas achou', false,
  /return \{[^}]*encontrou/.test(pedirAcesso));
checar('cada conta faz no máximo 5 pedidos por dia', true,
  pedirAcesso.includes('limite.consumir(db, REGRAS.PEDIDO_DE_ACESSO, uid)'));
const abrir = pedidos.slice(pedidos.indexOf('async function abrirPedido'), pedidos.indexOf('function makePedirAcessoPeloTelefone'));
checar('o pedido não leva o e-mail de quem pediu (e apaga o de pedido antigo)', true,
  !/email:\s*email/.test(abrir) && abrir.includes('email: FieldValue.delete()'));
// Sem os comentários: o cabeçalho do card CITA as frases antigas para
// explicar por que saíram, e a explicação não pode reprovar o teste.
const cardDeEspera = readFileSync(new URL('../src/components/acesso/AguardandoVinculo.jsx', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n');
checar('o card de espera não diz se achou', false,
  /Encontramos um cadastro|Não encontramos seu motorista/.test(cardDeEspera));
checar('e diz a frase única', true,
  cardDeEspera.includes('Se o número estiver cadastrado, o motorista recebe o'));
checar('o motorista não vê e-mail no pedido', false,
  readFileSync(new URL('../src/components/tio/PedidosDeAcesso.jsx', import.meta.url), 'utf8').includes('p.email'));

bloco('5b · A CRIANÇA GUARDA A CHAVE DO TELEFONE (03/10/2026)');
/* `pedirAcessoPeloTelefone` lia TODA criança sem responsável da plataforma a
   cada chamada. Agora consulta por `parentPhoneChave`, que o app grava ao
   cadastrar e ao editar o telefone — e a chave do app tem de ser a mesma do
   servidor, senão a consulta não acha ninguém, em silêncio. */
const { chaveDoTelefone: chaveDoApp } = await import('../src/dominio/identidade/indicacao.js');
for (const fone of ['(11) 98765-4321', '11 8765-4321', '+55 11 98765-4321', '011987654321', '(11) 3456-7890', '123', '']) {
  checar(`a chave do app é a do servidor: "${fone}"`, chaveDoTelefone(fone), chaveDoApp(fone));
}
const filhos = readFileSync(new URL('../src/services/childrenService.js', import.meta.url), 'utf8');
const addChild = filhos.slice(filhos.indexOf('export async function addChild'), filhos.indexOf('export async function getChild'));
checar('o cadastro grava a chave junto do telefone', true,
  /parentPhone: data\.parentPhone[\s\S]{0,400}chaveDoTelefoneDaCrianca\(data\.parentPhone\)/.test(addChild));
const updateChild = filhos.slice(filhos.indexOf('export async function updateChild'), filhos.indexOf('function toCoord'));
checar('editar o telefone regrava a chave no mesmo write', true,
  /'parentPhone' in updates[\s\S]{0,200}chaveDoTelefoneDaCrianca\(updates\.parentPhone\)/.test(updateChild));
checar('telefone inválido grava null (não deixa a chave do número antigo)', true,
  /parentPhoneChave: chaveDoTelefone\(telefone\) \|\| null/.test(filhos));
checar('o pedido de acesso consulta pela chave', true,
  /where\('parentPhoneChave', '==', chave\)\s*\.limit\(/.test(pedirAcesso));
checar('e não lê mais toda criança sem responsável', false,
  /where\('parentUid', '==', null\)/.test(pedirAcesso));
checar('a chave achada é reconferida pela régua (não confia no campo)', true,
  /criancasQueEsperam\(/.test(pedirAcesso));
checar('o gatilho do cadastro completa a chave do app antigo', true,
  /crianca\.parentPhoneChave !== chave[\s\S]{0,300}parentPhoneChave: chave/.test(vincular));
/* A régua continua recusando a criança cuja chave gravada mente: o pedido só
   nasce se o `parentPhone` dela casar de verdade. */
checar('chave forjada não abre pedido', [],
  criancasQueEsperam({
    telefone: '11987654321',
    criancas: [{ id: 'x', adminUid: 'tio1', parentUid: null, parentPhone: '11911112222', parentPhoneChave: '11987654321' }],
  }).map((c) => c.id));

bloco('6 · SONDA POSITIVA');
checar('o detector da rule reprovaria uma lista sem a chave', false,
  /\.hasAny\(\[[\s\S]*?'phoneChave'[\s\S]*?\]\)/.test(".hasAny(['role', 'childIds'])"));

bloco('7 · ⚠️ DESVINCULAR NUNCA APAGA QUEM NÃO É A FAMÍLIA DESTA CRIANÇA (03/10/2026)');
/* `desvincularResponsavel` apagava qualquer conta: o `childId` com barra
   endereçava uma viagem com `parentUid` plantado pelo próprio motorista. */
checar('responsável com a criança na lista: pode', true,
  podeDesvincular({ role: 'parent', childIds: ['k1', 'k2'] }, 'k1'));
checar('responsável pelo campo legado `childId`: pode', true,
  podeDesvincular({ role: 'parent', childId: 'k1' }, 'k1'));
checar('responsável SEM esta criança na lista: não', false,
  podeDesvincular({ role: 'parent', childIds: ['k2'] }, 'k1'));
checar('conta do DONO, mesmo com a criança na lista: não', false,
  podeDesvincular({ role: 'owner', childIds: ['k1'] }, 'k1'));
checar('conta de MOTORISTA: não', false,
  podeDesvincular({ role: 'admin', childIds: ['k1'] }, 'k1'));
checar('conta sem papel: não', false, podeDesvincular({ childIds: ['k1'] }, 'k1'));
const desvincularTxt = readFileSync(new URL('../functions/lib/desvincularResponsavel.js', import.meta.url), 'utf8');
{
  const guarda = desvincularTxt.indexOf('if (!podeDesvincular(familia, childId))');
  const apaga = desvincularTxt.indexOf('tx.delete(userRef)');
  const escreve = desvincularTxt.indexOf('tx.set(');
  checar('a function confere a régua ANTES de apagar ou escrever na conta', true,
    guarda > 0 && apaga > guarda && escreve > guarda);
}

bloco('8 · ⚠️ TODO ID QUE VEM DO CLIENTE PASSA POR `idValido` ANTES DE VIRAR CAMINHO');
checar('id comum', true, idValido('AbC123_-x'));
checar('id com barra é recusado', false, idValido('k1/rides/2026-10-03'));
checar('id vazio é recusado', false, idValido(''));
checar('não-string é recusado', false, idValido({ toString: () => 'k1' }));
checar('".." é recusado', false, idValido('..'));
checar('mês válido', true, mesValido('2026-10'));
checar('mês 13 é recusado', false, mesValido('2026-13'));
checar('mês com barra é recusado', false, mesValido('2026-10/x'));

/* A varredura: em cada arquivo de functions/lib com `onCall`, toda variável
   tirada de `request.data` que vira caminho (`${var}` num template, ou
   `.doc(var`) precisa ter passado por `idValido(var)`/`mesValido(var)` ANTES,
   no texto. Os arquivos de outros donos ficam numa lista nomeada. */
const { readdirSync } = await import('node:fs');
const FORA_DA_VARREDURA = new Set([
  'invites.js', 'invitePreview.js', 'pedidosDeAcesso.js', 'interesseInvestidor.js',
  'fechamento.js', 'relogioDoTeste.js', 'contadorDaTurma.js',
]);
function idsSemConferencia(texto) {
  const faltas = [];
  const decl = /const (\w+) = [^;\n]*request\.data/g;
  let m;
  while ((m = decl.exec(texto))) {
    const v = m[1];
    const usos = [texto.indexOf('${' + v + '}', m.index), texto.indexOf('.doc(' + v, m.index)]
      .filter((i) => i >= 0);
    if (!usos.length) continue;
    const primeiroUso = Math.min(...usos);
    const conf = [texto.indexOf('idValido(' + v + ')', m.index), texto.indexOf('mesValido(' + v + ')', m.index)]
      .filter((i) => i >= 0);
    if (!conf.length || Math.min(...conf) > primeiroUso) faltas.push(v);
  }
  return faltas;
}
const dirLib = new URL('../functions/lib/', import.meta.url);
const comCallable = readdirSync(dirLib).filter((f) => f.endsWith('.js') && !FORA_DA_VARREDURA.has(f))
  .map((f) => [f, readFileSync(new URL(f, dirLib), 'utf8')])
  .filter(([, t]) => t.includes("require('firebase-functions/v2/https')") && /\bonCall\(/.test(t));
checar('a varredura achou as callables (não está olhando para o vazio)', true, comCallable.length >= 9);
for (const [f, t] of comCallable) {
  checar(`${f}: nenhum id de request.data vira caminho sem conferência`, [], idsSemConferencia(t));
  const chamadas = (t.match(/\bonCall\(/g) || []).length;
  const comAppCheck = (t.match(/onCall\(\s*\{\s*\.\.\.LIMITES\.APP_CHECK/g) || []).length;
  checar(`${f}: toda onCall espalha LIMITES.APP_CHECK`, chamadas, comAppCheck);
}
const acompTxt = readFileSync(new URL('../functions/lib/acompanhamento.js', import.meta.url), 'utf8');
const lerTokenTxt = acompTxt.slice(acompTxt.indexOf('function lerToken'), acompTxt.indexOf('function makeGerarAcessoDoDia'));
checar('o token público do acompanhamento confere o childId com idValido', true,
  lerTokenTxt.includes('idValido(childId)'));
checar('SONDA: a varredura reprova id sem conferência', ['childId'],
  idsSemConferencia("const childId = String(request.data?.childId || '');\nawait db.doc(`children/${childId}`).get();"));
checar('SONDA: e reprova conferência DEPOIS do uso', ['childId'],
  idsSemConferencia("const childId = request.data.childId;\nawait db.doc(`children/${childId}`).get();\nidValido(childId);"));
checar('SONDA: e aprova conferência antes do uso', [],
  idsSemConferencia("const childId = request.data.childId;\nif (!idValido(childId)) throw x;\nawait db.doc(`children/${childId}`).get();"));

bloco('9 · ⚠️ A FAMÍLIA SÓ PREENCHE O TELEFONE DA ESCOLA QUE ESTÁ VAZIO (03/10/2026)');
/* Antes ela sobrescrevia, e o número é copiado para todas as famílias
   daquela escola na turma — uma família trocava o telefone das outras. */
const telTxt = readFileSync(new URL('../functions/lib/telefoneDaEscola.js', import.meta.url), 'utf8');
checar('já tendo telefone, responde `jaTinha` antes de qualquer escrita', true,
  /if \(telefoneValido\(escola\.telefone\)\) return \{ ok: true, jaTinha: true \};[\s\S]*?tx\.set\(\s*escolaRef/.test(telTxt));
checar('a escola tem de ser do motorista DESTA criança', true,
  telTxt.includes('escola.adminUid !== c.adminUid'));
const telTela = readFileSync(new URL('../src/components/children/TelefoneDaEscola.jsx', import.meta.url), 'utf8');
checar('a tela diz por que não gravou', true,
  telTela.includes('r?.jaTinha') && telTela.includes('A escola já tem telefone cadastrado pelo motorista.'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
