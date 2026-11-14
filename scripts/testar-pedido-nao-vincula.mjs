/**
 * O PEDIDO DE ACESSO NÃO VINCULA CONTA NENHUMA (14/11/2026, decisão 28) — as
 * callables DE VERDADE, contra o Firestore do emulador.
 *
 *   firebase emulators:exec --only firestore "node scripts/testar-pedido-nao-vincula.mjs"
 *   (ou: npm run testar:pedido-nao-vincula)
 *
 * O ataque: quem conhece o WhatsApp da mãe cria uma conta, pede acesso com o
 * nome dela e esse número; o motorista cadastra a criança, o gatilho abre o
 * pedido, e ele "aprovava". Aqui o pedido é aberto pelo caminho real
 * (`pedirAcessoPeloTelefone`) e respondido pelos três jeitos que um cliente
 * pode mandar — a ação nova, a recusa e o `aprovar: true` de um PWA antigo —
 * e depois se LÊ a criança e a conta: nenhuma das duas pode ter mudado.
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

const { makePedirAcessoPeloTelefone, makeResponderPedidoDeAcesso } = require('../functions/lib/pedidosDeAcesso.js');
const pedir = makePedirAcessoPeloTelefone(db);
const responder = makeResponderPedidoDeAcesso(db);

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

async function chamar(fn, uid, data, token = { firebase: { sign_in_provider: 'password' } }) {
  try {
    return { dados: await fn.run({ auth: { uid, token }, data, rawRequest: {} }) };
  } catch (err) {
    return { erro: err.code || err.message, msg: err.message };
  }
}

async function limpar() {
  for (const col of ['users', 'children', 'pedidosDeVinculo', 'notifications', 'limitesDeTentativas', 'tentativas']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

const TIO = 'tioP';
const TEL = '11987654321';

async function cenario(sufixo) {
  const kid = `kid${sufixo}`;
  const estranho = `estranho${sufixo}`;
  await db.doc(`users/${TIO}`).set({ role: 'admin', name: 'Tio P' });
  await db.doc(`children/${kid}`).set({
    name: 'Lucas Silva', adminUid: TIO, parentUid: null, inviteStatus: 'pending', inviteCode: `CODE${sufixo}`,
    parentPhone: TEL, parentPhoneChave: TEL, active: true,
  });
  const r = await chamar(pedir, estranho, { telefone: TEL, nome: 'Maria (a mãe)' });
  return { kid, estranho, r, pedidoId: `${kid}_${estranho}` };
}

async function main() {
  await limpar();

  for (const [rotulo, data] of [
    ['a ação nova (enviar_link)', { acao: 'enviar_link' }],
    ['o PWA antigo (aprovar: true)', { aprovar: true }],
    ['descartar', { acao: 'descartar' }],
  ]) {
    console.log(`\n· ${rotulo}`);
    const { kid, estranho, r, pedidoId } = await cenario(rotulo.replace(/\W/g, '').slice(0, 10));
    checar('o pedido responde o mesmo de sempre', { ok: true }, r.dados);
    const antes = await db.doc(`pedidosDeVinculo/${pedidoId}`).get();
    checar('o pedido nasceu aguardando', 'aguardando', antes.get('status'));
    const resp = await chamar(responder, TIO, { pedidoId, ...data });
    checar('o motorista responde', { ok: true }, resp.dados);
    const crianca = (await db.doc(`children/${kid}`).get()).data();
    const conta = (await db.doc(`users/${estranho}`).get()).data();
    checar('a criança continua SEM responsável', null, crianca.parentUid);
    checar('o convite continua pendente', 'pending', crianca.inviteStatus);
    checar('a criança não ganhou `vinculadoPor`', undefined, crianca.vinculadoPor);
    checar('a conta que pediu continua sem filho', [], conta.childIds);
    checar('a conta não ganhou motorista', [undefined, undefined], [conta.adminUid, conta.adminUids]);
    checar('nem a chave do irmão (o número dela não foi comprovado)', undefined, conta.phoneChave);
    const depois = (await db.doc(`pedidosDeVinculo/${pedidoId}`).get()).get('status');
    checar('o pedido fechou', data.acao === 'descartar' ? 'recusado' : 'link_enviado', depois);
    const avisos = await db.collection('notifications').where('userId', '==', estranho).get();
    checar(data.acao === 'descartar' ? 'quem pediu é avisado da recusa' : 'quem pediu NÃO é avisado (nada de oráculo)',
      data.acao === 'descartar' ? ['acesso_recusado'] : [], avisos.docs.map((d) => d.get('type')));
    const segunda = await chamar(responder, TIO, { pedidoId, acao: 'enviar_link' });
    checar('responder de novo é recusado', 'failed-precondition', segunda.erro);
  }

  console.log('\n· escopo');
  const { pedidoId } = await cenario('escopo');
  await db.doc('users/outroTio').set({ role: 'admin', name: 'Outro' });
  const alheio = await chamar(responder, 'outroTio', { pedidoId, acao: 'enviar_link' });
  checar('outro motorista não responde o pedido', 'permission-denied', alheio.erro);
  const aviso = await db.collection('notifications').where('userId', '==', TIO).where('type', '==', 'pedido_de_acesso').limit(1).get();
  checar('o aviso ao motorista não leva o nome que a conta escolheu', false, /Maria/.test(aviso.docs[0]?.get('title') || ''));

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
