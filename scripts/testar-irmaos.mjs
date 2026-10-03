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
const { responsavelDoIrmao, criancasQueEsperam, chaveDoTelefone } = require('../functions/lib/reguaDoIrmao.js');

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
    criancas: [{ parentUid: 'carla', parentPhone: '11 98765-4321' }],
  }));
checar('conta e criança apontando para a mesma pessoa não é ambíguo', 'carla',
  responsavelDoIrmao({
    motorista: 'tio1',
    telefone: '11987654321',
    contas: [CARLA],
    criancas: [{ parentUid: 'carla', parentPhone: '11987654321' }],
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
checar('e a resposta não diz o nome da criança a quem pediu', true,
  /return \{ encontrou: achadas\.length \}/.test(pedidos));

bloco('6 · SONDA POSITIVA');
checar('o detector da rule reprovaria uma lista sem a chave', false,
  /\.hasAny\(\[[\s\S]*?'phoneChave'[\s\S]*?\]\)/.test(".hasAny(['role', 'childIds'])"));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
