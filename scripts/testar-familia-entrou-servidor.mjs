/**
 * "A FAMÍLIA DE X ENTROU", ESCRITO DE VERDADE — contra o Firestore do emulador.
 *
 * `testar-familia-entrou.mjs` prova a régua e lê o arquivo. Este roda o
 * `redeemInvite` de verdade (`idx.redeemInvite.run`, Admin SDK do emulador por
 * baixo) e LÊ o que ficou gravado: o aviso nasce uma vez, para o motorista da
 * criança, com o id determinístico; a reentrega do mesmo convite não duplica;
 * um aviso que já existia não derruba o resgate; o irmão não gera aviso.
 *
 * ── COMO RODAR
 *   firebase emulators:exec --only firestore "node scripts/testar-familia-entrou-servidor.mjs"
 * (host lido de FIRESTORE_EMULATOR_HOST; padrão 127.0.0.1:8085.)
 *
 * ⚠️ FORA DA BATERIA ENCADEADA, como `testar-fechamento`: precisa do emulador e
 * importa o Admin SDK de `functions/node_modules`, o que `testar:imports`
 * proíbe lá.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PID = 'alobuzinou-be81f';
const HOST_FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
process.env.GCLOUD_PROJECT = PID;
process.env.FIRESTORE_EMULATOR_HOST = HOST_FS;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PID, storageBucket: `${PID}.appspot.com` });

const idx = require('../functions/index.js');
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const db = admin.firestore();

let ok = 0;
let bad = 0;
function checar(nome, passou, detalhe = '') {
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}${!passou && detalhe ? `  → ${detalhe}` : ''}`);
  if (passou) ok += 1;
  else bad += 1;
}

async function resgatar(uid, code) {
  try {
    const data = await idx.redeemInvite.run({
      auth: { uid, token: {} },
      data: { code, name: 'Mãe de teste' },
      rawRequest: { ip: '127.0.0.1', headers: {} },
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, code: e.code, message: e.message };
  }
}

async function avisosDe(uid) {
  const s = await db.collection('notifications').where('userId', '==', uid).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function limpar() {
  await fetch(`http://${HOST_FS}/emulator/v1/projects/${PID}/databases/(default)/documents`, { method: 'DELETE' });
}

async function main() {
  await limpar();
  await db.doc('users/tioA').set({ role: 'admin', name: 'Tio A' });

  // ── 1. O resgate comum
  await db.doc('children/cAna').set({
    name: 'Ana Clara', adminUid: 'tioA', active: true, monthlyFee: 350,
    inviteCode: 'AB234567', inviteStatus: 'pending', parentPhone: '',
  });
  const r1 = await resgatar('maeAna', 'AB234567');
  checar('o resgate passa', r1.ok, JSON.stringify(r1));
  let doTio = await avisosDe('tioA');
  checar('o motorista recebe UM aviso', doTio.length === 1, JSON.stringify(doTio));
  const aviso = doTio[0] || {};
  checar('com o id determinístico', aviso.id === 'familia_entrou_cAna', aviso.id);
  checar('tipo, título e corpo', aviso.type === 'familia_entrou' && aviso.title === 'A família de Ana entrou'
    && aviso.body === 'A mensalidade dela passa a aparecer na Carteira.', JSON.stringify(aviso));
  checar('não lido, com hora do servidor', aviso.read === false && typeof aviso.createdAt?.toMillis === 'function');
  checar('a família não recebe este aviso', (await avisosDe('maeAna')).every((n) => n.type !== 'familia_entrou'));

  // ── 2. A reentrega do mesmo convite: recusada, e nada a mais
  const r2 = await resgatar('maeAna', 'AB234567');
  checar('a reentrega é recusada pela transação', !r2.ok && r2.code === 'not-found', JSON.stringify(r2));
  doTio = await avisosDe('tioA');
  checar('e continua UM aviso', doTio.length === 1, String(doTio.length));

  // ── 3. Aviso que já existe (convite reaberto para a mesma criança): o
  //    resgate passa e não duplica nem sobrescreve.
  await db.doc('children/cAna').update({ inviteStatus: 'pending', inviteCode: 'CD234567', parentUid: admin.firestore.FieldValue.delete() });
  await db.doc('notifications/familia_entrou_cAna').update({ read: true });
  const r3 = await resgatar('maeNova', 'CD234567');
  checar('o resgate passa mesmo com o aviso já existindo', r3.ok, JSON.stringify(r3));
  doTio = await avisosDe('tioA');
  checar('o create() recusou o segundo: ainda UM aviso, intocado',
    doTio.length === 1 && doTio[0].read === true, JSON.stringify(doTio));

  // ── 4. Sem valor: o corpo diz o que falta
  await db.doc('children/cBia').set({
    name: 'Bia', adminUid: 'tioA', active: true,
    inviteCode: 'EF234567', inviteStatus: 'pending',
  });
  await resgatar('maeBia', 'EF234567');
  const bia = (await db.doc('notifications/familia_entrou_cBia').get()).data() || {};
  checar('sem valor: "Cadastre o valor..."', bia.body === 'Cadastre o valor da mensalidade para ela aparecer na Carteira.', bia.body);

  // ── 5. O vínculo de irmão (gatilho) não passa por aqui e não fala "entrou"
  //    — a régua recusa mesmo se a criança vier marcada assim.
  await db.doc('children/cIrmao').set({
    name: 'Caio', adminUid: 'tioA', active: true, vinculadoPor: 'irmao',
    inviteCode: 'GH234567', inviteStatus: 'pending',
  });
  await resgatar('maeCaio', 'GH234567');
  checar('criança marcada como irmão: sem aviso', !(await db.doc('notifications/familia_entrou_cIrmao').get()).exists);

  // ── 6. Criança sem motorista: resgate passa, ninguém é avisado
  await db.doc('children/cSem').set({ name: 'Leo', active: true, inviteCode: 'JK234567', inviteStatus: 'pending' });
  const r6 = await resgatar('maeLeo', 'JK234567');
  checar('sem motorista: o resgate passa', r6.ok, JSON.stringify(r6));
  checar('e não nasce aviso', !(await db.doc('notifications/familia_entrou_cSem').get()).exists);

  await limpar();
  console.log(`\n${ok} ok, ${bad} falharam`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });
