/**
 * O TELEFONE DIGITADO DEPOIS — o gatilho de TROCA e a resposta da mãe DE
 * VERDADE, contra o Firestore do emulador (14/11/2026).
 *
 *   firebase emulators:exec --only firestore "node scripts/testar-irmao-depois.mjs"
 *   (ou: npm run testar:irmao-depois)
 *
 * O tio cadastra a criança sem telefone e o digita depois. Aqui a escrita é
 * feita no Firestore e o gatilho roda com o antes/depois REAL (`.run(evento)`),
 * e depois se LÊ o que ficou:
 *   - o número de uma mãe que já é família dele → nasce a PERGUNTA, e NADA é
 *     vinculado; "Sim" vincula; "Não" guarda a recusa, avisa o motorista, e
 *     voltar ao número dela NÃO pergunta de novo;
 *   - o teto de perguntas por criança;
 *   - quem pediu acesso com o número → o pedido abre, nada é vinculado;
 *   - a família que entrou pelo link sem número → ganha a `phoneChave`, sem
 *     sobrescrever e sem roubar a de outra conta;
 *   - o "Não é meu filho" do irmão AUTOMÁTICO também vale para sempre.
 *
 * ⚠️ Importa o Admin SDK de `functions/node_modules` por caminho explícito
 * e fica FORA da bateria encadeada (`testar:imports`).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');

const PID = 'alobuzinou-be81f';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Rode dentro do emulador (FIRESTORE_EMULATOR_HOST ausente) — nunca contra produção.');
  process.exit(2);
}
admin.initializeApp({ projectId: PID });
const db = admin.firestore();

const { makeIrmaoNaTrocaDoTelefone, makeResponderIrmao } = require('../functions/lib/perguntaDoIrmao.js');
const { makeVincularIrmao, makeRecusarIrmao } = require('../functions/lib/vincularIrmao.js');
const gatilho = makeIrmaoNaTrocaDoTelefone(db);
const responder = makeResponderIrmao(db);
const noCadastro = makeVincularIrmao(db);
const recusar = makeRecusarIrmao(db);

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

async function chamar(fn, uid, data) {
  try {
    return { dados: await fn.run({ auth: { uid, token: { firebase: { sign_in_provider: 'password' } } }, data, rawRequest: {} }) };
  } catch (err) {
    return { erro: err.code || err.message, msg: err.message };
  }
}

const COLECOES = ['users', 'children', 'notifications', 'perguntasDeIrmao', 'pedidosDeVinculo'];
async function limpar() {
  for (const col of COLECOES) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

/** O tio edita a criança, e o gatilho roda com o antes/depois de verdade. */
async function editar(childId, mudanca) {
  const ref = db.doc(`children/${childId}`);
  const antes = (await ref.get()).data();
  await ref.update(mudanca);
  const depois = (await ref.get()).data();
  await gatilho.run({
    params: { childId },
    data: { before: { data: () => antes }, after: { data: () => depois } },
  });
}
const digitar = (childId, tel) => editar(childId, { parentPhone: tel, parentPhoneChave: tel || null });

const avisosDe = async (userId, type) =>
  (await db.collection('notifications').where('userId', '==', userId).get()).docs
    .filter((d) => !type || d.get('type') === type)
    .map((d) => ({ id: d.id, ...d.data() }));
const ler = async (p) => (await db.doc(p).get()).data();

const TIO = 'tio1';
const TEL = '11987654321';

async function semear() {
  await db.doc(`users/${TIO}`).set({ role: 'admin', name: 'João Pereira', marcaNome: 'Tio Nino' });
  await db.doc('users/carla').set({
    role: 'parent', name: 'Carla', phoneChave: TEL, childIds: ['irmao1'], childId: 'irmao1', adminUid: TIO, adminUids: [TIO],
  });
  await db.doc('children/irmao1').set({
    name: 'Pedro Souza', adminUid: TIO, parentUid: 'carla', parentPhone: TEL, inviteStatus: 'used', inviteUsedAt: new Date(), active: true,
  });
}
const novaCrianca = (id, extra = {}) =>
  db.doc(`children/${id}`).set({ name: 'Lucas Souza', adminUid: TIO, parentUid: null, inviteStatus: 'pending', active: true, ...extra });

async function main() {
  await limpar();
  await semear();

  // ── 1. A PERGUNTA, E NADA VINCULADO ────────────────────────────────────
  console.log('\n· o tio digita o número da Carla depois');
  await novaCrianca('k1');
  await digitar('k1', '(11) 98765-4321');
  let k1 = await ler('children/k1');
  checar('a criança continua SEM responsável', null, k1.parentUid);
  checar('…sem `vinculadoPor`', undefined, k1.vinculadoPor);
  checar('o gatilho não reescreveu o telefone', '(11) 98765-4321', k1.parentPhone);
  checar('a conta da Carla não ganhou a criança', ['irmao1'], (await ler('users/carla')).childIds);
  let reg = await ler('perguntasDeIrmao/k1');
  checar('a pergunta está aberta para a Carla', ['carla', TEL, 1], [reg?.aberta?.parentUid, reg?.aberta?.chave, reg?.perguntas]);
  let perguntas = await avisosDe('carla', 'irmao_pergunta');
  checar('a Carla recebeu UM aviso de pergunta', 1, perguntas.length);
  checar('o aviso leva a marca e só o primeiro nome', ['Tio Nino cadastrou Lucas com o seu número', 'Lucas'],
    [perguntas[0]?.title, perguntas[0]?.primeiroNome]);
  checar('o aviso não leva sobrenome, endereço nem escola', false, /Souza|address|endereco|school/i.test(JSON.stringify(perguntas[0])));
  checar('o motorista não recebe nada ainda', [], (await avisosDe(TIO)).map((a) => a.type));

  console.log('\n· o mesmo evento entregue de novo');
  const antesIgual = await ler('children/k1');
  await gatilho.run({ params: { childId: 'k1' }, data: { before: { data: () => ({ ...antesIgual, parentPhone: '' }) }, after: { data: () => antesIgual } } });
  checar('não pergunta de novo nem gasta o teto', [1, 1],
    [(await avisosDe('carla', 'irmao_pergunta')).length, (await ler('perguntasDeIrmao/k1')).perguntas]);

  console.log('\n· quem responde');
  const intrusa = await chamar(responder, 'intrusa', { childId: 'k1', resposta: 'sim' });
  checar('outra conta não responde a pergunta da Carla', 'failed-precondition', intrusa.erro);
  const forjado = await chamar(responder, 'carla', { childId: 'irmao1', resposta: 'sim' });
  checar('criança sem pergunta aberta (aviso forjado): recusado', 'failed-precondition', forjado.erro);
  const barra = await chamar(responder, 'carla', { childId: 'k1/rides/x', resposta: 'sim' });
  checar('id com barra é recusado', 'invalid-argument', barra.erro);

  console.log('\n· "Sim, é meu filho"');
  const sim = await chamar(responder, 'carla', { childId: 'k1', resposta: 'sim' });
  checar('a resposta vincula', { ok: true, vinculado: true }, sim.dados);
  k1 = await ler('children/k1');
  checar('a criança é da Carla, confirmado por ela', ['carla', 'irmao_confirmado', 'used'], [k1.parentUid, k1.vinculadoPor, k1.inviteStatus]);
  const carla = await ler('users/carla');
  checar('a conta dela ganhou a criança, e o motorista continua um só', [['irmao1', 'k1'], [TIO]], [carla.childIds, carla.adminUids]);
  reg = await ler('perguntasDeIrmao/k1');
  checar('a pergunta fechou', null, reg.aberta);
  checar('o aviso da pergunta ficou respondido', 'sim', (await avisosDe('carla', 'irmao_pergunta'))[0]?.respondida);
  checar('o motorista recebe "a família entrou" (o aviso do link), e só ele', ['familia_entrou'], (await avisosDe(TIO)).map((a) => a.type));
  const deNovo = await chamar(responder, 'carla', { childId: 'k1', resposta: 'sim' });
  checar('responder de novo é recusado', 'failed-precondition', deNovo.erro);
  // A escrita do vínculo dispara o gatilho de novo: o número não mudou.
  checar('o vínculo não reabre a pergunta (sem laço)', 1, (await avisosDe('carla', 'irmao_pergunta')).length);

  // ── 2. "NÃO É MEU FILHO" VALE PARA SEMPRE ─────────────────────────────
  console.log('\n· "Não é meu filho"');
  await novaCrianca('k2', { name: 'Bia Lima' });
  await digitar('k2', TEL);
  const nao = await chamar(responder, 'carla', { childId: 'k2', resposta: 'nao' });
  checar('a resposta não vincula', { ok: true, vinculado: false }, nao.dados);
  const k2 = await ler('children/k2');
  checar('a criança continua sem responsável', null, k2.parentUid);
  checar('a recusa ficou guardada, no registro do servidor', ['carla'], (await ler('perguntasDeIrmao/k2')).recusadoPor);
  const avisoTio = (await avisosDe(TIO, 'irmao_recusado'))[0];
  checar('o motorista é avisado como no "Não é meu filho" de sempre', 'O WhatsApp de Bia pode estar errado', avisoTio?.title);
  await digitar('k2', '11911112222');
  await digitar('k2', TEL);
  checar('trocar o número e voltar ao dela NÃO pergunta de novo', 1,
    (await avisosDe('carla', 'irmao_pergunta')).filter((a) => a.childId === 'k2').length);
  checar('…e continua sem vincular', null, (await ler('children/k2')).parentUid);

  // ── 3. O TETO ─────────────────────────────────────────────────────────
  console.log('\n· o teto de perguntas por criança');
  const MAES = [['m1', '11911110001'], ['m2', '11911110002'], ['m3', '11911110003'], ['m4', '11911110004']];
  for (const [uid, tel] of MAES) {
    await db.doc(`users/${uid}`).set({ role: 'parent', name: uid, phoneChave: tel, childIds: ['x'], adminUid: TIO, adminUids: [TIO] });
  }
  await novaCrianca('k3');
  for (const [, tel] of MAES) await digitar('k3', tel);
  const porMae = await Promise.all(MAES.map(([uid]) => avisosDe(uid, 'irmao_pergunta')));
  checar('três mães perguntadas, a quarta não (teto 3)', [1, 1, 1, 0], porMae.map((l) => l.length));
  await digitar('k3', MAES[0][1]);
  checar('voltar à primeira depois do teto não pergunta', 1, (await avisosDe('m1', 'irmao_pergunta')).length);
  checar('a pergunta antiga perdeu a validade (o número mudou)', 'failed-precondition',
    (await chamar(responder, 'm1', { childId: 'k3', resposta: 'sim' })).erro);
  checar('nada foi vinculado a ninguém', null, (await ler('children/k3')).parentUid);

  // ── 4. QUEM ESPERAVA ─────────────────────────────────────────────────
  console.log('\n· quem pediu acesso pelo número');
  const TEL_E = '21987650000';
  await db.doc('users/espera').set({ role: 'parent', name: 'Rita', childIds: [], telefoneAguardandoChave: TEL_E });
  await novaCrianca('k4');
  await digitar('k4', TEL_E);
  const pedido = await ler('pedidosDeVinculo/k4_espera');
  checar('o pedido abriu para o motorista', ['aguardando', TIO], [pedido?.status, pedido?.adminUid]);
  checar('o motorista recebe o aviso do pedido', 1, (await avisosDe(TIO, 'pedido_de_acesso')).length);
  checar('NADA foi vinculado: a criança', null, (await ler('children/k4')).parentUid);
  checar('…nem a conta que pediu', [[], undefined], [(await ler('users/espera')).childIds, (await ler('users/espera')).phoneChave]);
  checar('…e não houve pergunta (ela não é família deste motorista)', [], await avisosDe('espera', 'irmao_pergunta'));

  // ── 5. A FAMÍLIA QUE ENTROU PELO LINK SEM NÚMERO ──────────────────────
  console.log('\n· a família que entrou sem número ganha a chave');
  const TEL_F = '31987651111';
  await db.doc('users/semnum').set({ role: 'parent', name: 'Lia', childIds: ['k5'], childId: 'k5', adminUid: TIO, adminUids: [TIO] });
  await novaCrianca('k5', { parentUid: 'semnum', inviteStatus: 'used', inviteUsedAt: new Date() });
  await digitar('k5', TEL_F);
  checar('a `phoneChave` dela nasce do número que o motorista digitou', TEL_F, (await ler('users/semnum')).phoneChave);
  await digitar('k5', '31900002222');
  checar('trocar de novo NÃO sobrescreve', TEL_F, (await ler('users/semnum')).phoneChave);
  await db.doc('users/semnum2').set({ role: 'parent', name: 'Ivo', childIds: ['k6'], adminUid: TIO, adminUids: [TIO] });
  await novaCrianca('k6', { parentUid: 'semnum2', inviteStatus: 'used', inviteUsedAt: new Date() });
  await digitar('k6', TEL);
  checar('a chave que já é da Carla não vai para outra conta', undefined, (await ler('users/semnum2')).phoneChave);
  await db.doc('users/vitima').set({ role: 'parent', name: 'Vi', childIds: ['outra'], adminUid: TIO, adminUids: [TIO] });
  await novaCrianca('k7', { parentUid: 'vitima' });
  await digitar('k7', '41987653333');
  checar('`parentUid` plantado pelo tio não dá chave à conta (a criança não está na lista dela)', undefined,
    (await ler('users/vitima')).phoneChave);

  // ── 6. O QUE NÃO PEDE NADA ──────────────────────────────────────────
  console.log('\n· o que não pede nada');
  await novaCrianca('k8', { active: false });
  await digitar('k8', TEL);
  checar('criança desativada: nenhuma pergunta', undefined, await ler('perguntasDeIrmao/k8'));
  await novaCrianca('k9', { transferidaPara: 'tio2' });
  await digitar('k9', TEL);
  checar('criança transferida: nenhuma pergunta', undefined, await ler('perguntasDeIrmao/k9'));
  await db.doc('users/tio2').set({ role: 'admin', name: 'Outro' });
  await db.doc('children/k10').set({ name: 'Zé', adminUid: 'tio2', parentUid: null, active: true });
  await digitar('k10', TEL);
  checar('motorista de quem ela NÃO é família: nenhuma pergunta', undefined, await ler('perguntasDeIrmao/k10'));

  // ── 7. O IRMÃO AUTOMÁTICO E O "NÃO" PARA SEMPRE ─────────────────────
  console.log('\n· o "Não é meu filho" do irmão automático também vale para sempre');
  // A k6 (bloco 5) é da conta `semnum2` com o número da Carla: com ela na
  // turma o número seria ambíguo, e o cadastro não vincularia ninguém — que
  // é o certo, mas não é o que este bloco mede.
  await db.doc('children/k6').delete();
  const auto = { name: 'Caio Souza', adminUid: TIO, parentUid: null, parentPhone: TEL, active: true, inviteStatus: 'pending' };
  await db.doc('children/k11').set(auto);
  await noCadastro.run({ params: { childId: 'k11' }, data: { data: () => auto } });
  checar('no CADASTRO o irmão continua entrando sozinho', ['carla', 'irmao'],
    [(await ler('children/k11')).parentUid, (await ler('children/k11')).vinculadoPor]);
  const rec = await chamar(recusar, 'carla', { childId: 'k11' });
  checar('ela desfaz', { ok: true }, rec.dados);
  checar('a recusa foi guardada no registro do servidor', ['carla'], (await ler('perguntasDeIrmao/k11'))?.recusadoPor);
  await digitar('k11', '11900003333');
  await digitar('k11', TEL);
  checar('trocar o número e voltar ao dela não pergunta', [], (await avisosDe('carla', 'irmao_pergunta')).filter((a) => a.childId === 'k11'));
  checar('…nem vincula', null, (await ler('children/k11')).parentUid);

  await limpar();
  console.log(`\n${ok} passaram, ${bad} falharam`);
  if (bad) {
    console.log('\nFALHAS:');
    for (const f of falhas) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
