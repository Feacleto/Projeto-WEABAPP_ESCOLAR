/**
 * TIRAR A CRIANÇA DA TURMA NÃO APAGA A CONTA DA FAMÍLIA (14/11/2026, decisão
 * do dono) — a callable `desvincularResponsavel` DE VERDADE, contra o
 * Firestore do emulador, e depois o `redeemInvite` religando a mesma conta.
 *
 *   firebase emulators:exec --only firestore "node scripts/testar-desvincular.mjs"
 *   (ou: npm run testar:desvincular)
 *
 * Antes, a mãe de um filho só perdia o documento `users` inteiro: a conta do
 * Auth ficava órfã e ela caía em "Falta ligar sua conta". Agora ela perde só
 * a criança. O que este arquivo LÊ depois de cada chamada:
 *   - um filho só: a conta existe, `role: 'parent'`, sem filho, sem
 *     motorista, sem o `childId` legado (que `getChildIds` contaria), com
 *     `semFilhoDesde`; e o que é DELA continua (nome, telefone, termos,
 *     aparelhos, `phoneChave`);
 *   - dois filhos: perde só um, e o motorista fica enquanto o irmão roda com
 *     ele;
 *   - religar: um convite novo resgatado com a MESMA conta funciona — o
 *     `redeemInvite` barra motorista virando responsável, não responsável
 *     que já existe.
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

const { makeDesvincularResponsavel } = require('../functions/lib/desvincularResponsavel.js');
const { makeRedeemInvite } = require('../functions/lib/invites.js');
const desvincular = makeDesvincularResponsavel(db);
const resgatar = makeRedeemInvite(db);

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

async function chamar(fn, uid, data, token = { firebase: { sign_in_provider: 'password' }, email: `${uid}@x.test` }) {
  try {
    return { dados: await fn.run({ auth: { uid, token }, data, rawRequest: { ip: '127.0.0.1', headers: {} } }) };
  } catch (err) {
    return { erro: err.code || err.message, msg: err.message };
  }
}

async function limpar() {
  for (const col of ['users', 'children', 'notifications', 'inviteAttempts', 'limitesDeTentativas', 'tentativas']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

const TIO = 'tioD';
const TIO2 = 'tioD2';
const TEL = '11987654321';

/** O que o cliente do motorista faz DEPOIS da callable (accountService). */
async function desativarComoOCliente(kid) {
  await db.doc(`children/${kid}`).update({ active: false, parentUid: null, inviteStatus: 'pending' });
}

async function main() {
  await limpar();
  await db.doc(`users/${TIO}`).set({ role: 'admin', name: 'Tio D' });
  await db.doc(`users/${TIO2}`).set({ role: 'admin', name: 'Tio D2' });

  // ── 1. UM FILHO SÓ ─────────────────────────────────────────────────────
  console.log('\n· um filho só: a conta fica');
  await db.doc('children/k1').set({
    name: 'Lucas Silva', adminUid: TIO, parentUid: 'mae1', inviteStatus: 'used', inviteUsedAt: new Date(),
    parentPhone: TEL, active: true, inviteCode: 'TNAB23CD',
  });
  await db.doc('users/mae1').set({
    role: 'parent', name: 'Carla', email: 'carla@x.test', phone: TEL, phoneChave: TEL,
    childIds: ['k1'], childId: 'k1', adminUid: TIO, adminUids: [TIO],
    termsVersion: '1.2', fcmTokens: ['tok1'], marcos: { appInstalado: 1 },
  });
  const r1 = await chamar(desvincular, TIO, { childId: 'k1' });
  checar('a callable responde conta mantida', { ok: true, conta: 'mantida', filhosRestantes: 0 }, r1.dados);
  await desativarComoOCliente('k1');
  const c1 = await db.doc('users/mae1').get();
  checar('o documento da conta CONTINUA existindo', true, c1.exists);
  const m1 = c1.data() || {};
  checar('…e continua responsável', 'parent', m1.role);
  checar('…sem filho na lista', [], m1.childIds);
  checar('…sem o `childId` legado', undefined, m1.childId);
  checar('…sem motorista (singular e lista)', [undefined, []], [m1.adminUid, m1.adminUids]);
  checar('…marcada com `semFilhoDesde`', true, Boolean(m1.semFilhoDesde));
  checar('o que é DELA fica: nome, e-mail, telefone', ['Carla', 'carla@x.test', TEL], [m1.name, m1.email, m1.phone]);
  checar('…o aceite dos termos', '1.2', m1.termsVersion);
  checar('…os aparelhos e os marcos', [['tok1'], { appInstalado: 1 }], [m1.fcmTokens, m1.marcos]);
  checar('…e a `phoneChave` (o número dela)', TEL, m1.phoneChave);

  // Chamar de novo (reentrega, ou dois toques) não quebra nada.
  const r1b = await chamar(desvincular, TIO, { childId: 'k1' });
  checar('desvincular de novo responde sem responsável', { ok: true, conta: 'sem-responsavel' }, r1b.dados);

  // ── 2. RELIGAR: CONVITE NOVO, MESMA CONTA ──────────────────────────────
  console.log('\n· religar com um convite novo, a mesma conta');
  // O motorista põe a criança de volta e manda um link novo.
  await db.doc('children/k1').update({ active: true, inviteCode: 'TNCD45EF', inviteStatus: 'pending', inviteCriadoEm: new Date() });
  const r2 = await chamar(resgatar, 'mae1', { code: 'TNCD45EF', name: 'Carla' });
  checar('o resgate funciona com a conta que já existe', { childId: 'k1', childFirstName: 'Lucas', isNewAccount: false }, r2.dados);
  const m2 = (await db.doc('users/mae1').get()).data();
  checar('a criança volta para a lista dela', ['k1'], m2.childIds);
  checar('o `childId` legado volta', 'k1', m2.childId);
  checar('o motorista volta (singular e lista)', [TIO, [TIO]], [m2.adminUid, m2.adminUids]);
  checar('o nome e o aceite dela não foram reescritos', ['Carla', '1.2'], [m2.name, m2.termsVersion]);
  const k1 = (await db.doc('children/k1').get()).data();
  checar('a criança aponta para ela de novo', ['mae1', 'used'], [k1.parentUid, k1.inviteStatus]);

  console.log('\n· religar pela perua de OUTRO motorista');
  await chamar(desvincular, TIO, { childId: 'k1' });
  await desativarComoOCliente('k1');
  await db.doc('children/k9').set({
    name: 'Lucas Silva', adminUid: TIO2, parentUid: null, inviteStatus: 'pending', inviteCode: 'TNGH67JK',
    inviteCriadoEm: new Date(), parentPhone: TEL, active: true,
  });
  const r3 = await chamar(resgatar, 'mae1', { code: 'TNGH67JK' });
  checar('o resgate funciona', 'k9', r3.dados?.childId);
  const m3 = (await db.doc('users/mae1').get()).data();
  checar('o motorista é o NOVO, não o antigo que ficou para trás', [TIO2, [TIO2]], [m3.adminUid, m3.adminUids]);
  checar('…e o filho também', [['k9'], 'k9'], [m3.childIds, m3.childId]);

  // ── 3. DOIS FILHOS ─────────────────────────────────────────────────────
  console.log('\n· dois filhos: perde só um');
  await db.doc('children/a1').set({ name: 'Ana', adminUid: TIO, parentUid: 'mae2', inviteStatus: 'used', active: true });
  await db.doc('children/a2').set({ name: 'Bia', adminUid: TIO, parentUid: 'mae2', inviteStatus: 'used', active: true });
  await db.doc('users/mae2').set({
    role: 'parent', name: 'Dora', childIds: ['a1', 'a2'], childId: 'a1', adminUid: TIO, adminUids: [TIO],
  });
  const r4 = await chamar(desvincular, TIO, { childId: 'a1' });
  checar('conta mantida, um filho restante', { ok: true, conta: 'mantida', filhosRestantes: 1 }, r4.dados);
  const m4 = (await db.doc('users/mae2').get()).data();
  checar('só a outra criança fica', ['a2'], m4.childIds);
  checar('o `childId` legado passa para a que ficou', 'a2', m4.childId);
  checar('o motorista fica (o irmão roda com ele)', [TIO, [TIO]], [m4.adminUid, m4.adminUids]);
  checar('sem a marca de "sem filho"', undefined, m4.semFilhoDesde);

  console.log('\n· dois filhos em peruas diferentes: o motorista que tirou sai');
  await db.doc('children/b1').set({ name: 'Caio', adminUid: TIO, parentUid: 'mae3', inviteStatus: 'used', active: true });
  await db.doc('children/b2').set({ name: 'Duda', adminUid: TIO2, parentUid: 'mae3', inviteStatus: 'used', active: true });
  await db.doc('users/mae3').set({
    role: 'parent', name: 'Eva', childIds: ['b1', 'b2'], childId: 'b1', adminUid: TIO, adminUids: [TIO, TIO2],
  });
  await chamar(desvincular, TIO, { childId: 'b1' });
  const m5 = (await db.doc('users/mae3').get()).data();
  checar('fica a criança da outra perua', ['b2'], m5.childIds);
  checar('o motorista que tirou sai da lista, o outro fica', [TIO2], m5.adminUids);
  checar('o singular passa para o outro motorista', TIO2, m5.adminUid);

  // ── 4. O ESCOPO CONTINUA ──────────────────────────────────────────────
  console.log('\n· escopo');
  const alheio = await chamar(desvincular, TIO2, { childId: 'a2' });
  checar('outro motorista não tira criança alheia', 'permission-denied', alheio.erro);
  await db.doc('children/plantada').set({ name: 'X', adminUid: TIO, parentUid: TIO2, active: true });
  const dono = await chamar(desvincular, TIO, { childId: 'plantada' });
  checar('conta que não é responsável desta criança não é tocada', 'failed-precondition', dono.erro);
  checar('…e continua inteira', 'admin', (await db.doc(`users/${TIO2}`).get()).data()?.role);

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
