/**
 * A COMUNIDADE FECHADA NO SERVIDOR (14/11/2026, decisão 26) — as callables
 * DE VERDADE, contra o Firestore do emulador.
 *
 *   firebase emulators:exec --only firestore "node scripts/testar-comunidade-fechada.mjs"
 *   (ou: npm run testar:comunidade-fechada)
 *
 * O ataque que este arquivo reproduz: um ESTRANHO cria conta de motorista e
 * grava uma indicação com o telefone de um colega real (a rule de
 * `indicacoes` aceita qualquer `chave`). Quando o colega se cadastra,
 * `casarNoCadastro` grava `indicadoUid` — e a parceria, derivada da
 * indicação, abria ao estranho o WhatsApp, as escolas e as fotos do colega.
 *
 * O que se mede:
 *   - com a chave AUSENTE (ou `false`), nenhuma das cinco callables devolve
 *     dado do colega nem escreve na caixa dele;
 *   - `casarNoCadastro` continua casando a indicação (o desconto não quebra);
 *   - com `comunidadeLigada: true`, o comportamento antigo volta.
 *
 * ⚠️ Importa o Admin SDK de `functions/node_modules` por caminho explícito,
 * como `testar-fechamento.mjs`, e por isso fica FORA da bateria encadeada
 * (`testar:imports` proíbe alcançar o SDK lá).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');

const PID = 'alobuzinou-be81f';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Rode dentro do emulador (FIRESTORE_EMULATOR_HOST ausente) — nunca contra produção.');
  process.exit(2);
}
// O link "assinado" da comunidade, no emulador, é montado sem rede.
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:1';

admin.initializeApp({ projectId: PID, storageBucket: `${PID}.appspot.com` });
const db = admin.firestore();
const { Timestamp } = require('../functions/node_modules/firebase-admin/lib/firestore/index.js');

const {
  makeMeusParceiros,
  makeFotosDaComunidade,
  makeAvisarParceiroIndicado,
  makePublicarFotoDaTurma,
} = require('../functions/lib/comunidade.js');
const { makePedirTransferencia } = require('../functions/lib/transferencias.js');
const { makeCasarNoCadastro } = require('../functions/lib/casarNoCadastro.js');
const { FRASE_DA_COMUNIDADE_FECHADA } = require('../functions/lib/reguaDaComunidade.js');

const meusParceiros = makeMeusParceiros(db);
const fotosDaComunidade = makeFotosDaComunidade(db);
const avisarParceiroIndicado = makeAvisarParceiroIndicado(db);
const publicarFotoDaTurma = makePublicarFotoDaTurma(db);
const pedirTransferencia = makePedirTransferencia(db);
const casarNoCadastro = makeCasarNoCadastro(db);

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

/** Chama a callable como o SDK chamaria; devolve `{ dados }` ou `{ erro }`. */
async function chamar(fn, uid, data = {}) {
  try {
    return { dados: await fn.run({ auth: { uid }, data, rawRequest: {} }) };
  } catch (err) {
    return { erro: err.code || err.message, msg: err.message };
  }
}

const ESTRANHO = 'estranhoS';
const COLEGA = 'colegaA';
const TEL = '11988887777';

async function limpar() {
  for (const col of ['users', 'indicacoes', 'fotosDaTurma', 'notifications', 'platformConfig', 'schools', 'children', 'transferenciasDeFamilia']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

async function semear() {
  await db.doc(`users/${ESTRANHO}`).set({ role: 'admin', name: 'Estranho', phone: '11911112222' });
  // A indicação "plantada": o telefone de um colega que o estranho nunca viu.
  await db.doc(`indicacoes/${ESTRANHO}_${TEL}`).set({
    indicadorUid: ESTRANHO, indicadorNome: 'Estranho', chave: TEL, telefoneDigitado: TEL,
    nome: 'Colega', estado: 'pendente', em: Timestamp.now(),
  });
  // O colega se cadastra com o número dele — o gatilho roda como em produção.
  const colega = { role: 'admin', name: 'Colega Real', phone: `(11) 98888-7777`, marcaNome: 'Tio do Colega', marcaLogoURL: 'https://logo', city: 'São Paulo' };
  await db.doc(`users/${COLEGA}`).set(colega);
  await casarNoCadastro.run({ data: { data: () => colega }, params: { uid: COLEGA } });
  await db.doc('schools/escA').set({ adminUid: COLEGA, nome: 'EMEF do Colega' });
  const expira = Timestamp.fromMillis(Date.now() + 86400000);
  await db.doc('fotosDaTurma/fotoParceiros').set({
    adminUid: COLEGA, publico: 'parceiros', criancas: [], epoca: 'Natal', legenda: null,
    caminho: `fotosDaTurma/${COLEGA}/p.jpg`, url: 'https://foto-permanente-do-colega',
    criadaEm: Timestamp.now(), expiraEm: expira,
  });
  await db.doc('fotosDaTurma/fotoComunidade').set({
    adminUid: COLEGA, publico: 'comunidade', criancas: [], epoca: 'Natal', legenda: null,
    caminho: `fotosDaTurma/${COLEGA}/c.jpg`, url: null, criadaEm: Timestamp.now(), expiraEm: expira,
  });
  await db.doc('children/kidS').set({ name: 'Ana', adminUid: ESTRANHO, active: true });
}

async function main() {
  await limpar();
  await semear();

  console.log('\n1. o programa de indicação NÃO quebrou');
  const ind = (await db.doc(`indicacoes/${ESTRANHO}_${TEL}`).get()).data();
  checar('casarNoCadastro casou a indicação (indicadoUid gravado)', COLEGA, ind.indicadoUid);
  checar('…e ela foi a "cadastrada"', 'cadastrado', ind.estado);

  for (const [rotulo, config] of [['sem platformConfig', null], ['comunidadeLigada: false', { comunidadeLigada: false, cobrancaLigada: true }]]) {
    console.log(`\n2. a chave DESLIGADA (${rotulo}): o estranho não alcança o colega`);
    if (config) await db.doc('platformConfig/app').set(config);
    else await db.doc('platformConfig/app').delete();

    const mp = await chamar(meusParceiros, ESTRANHO);
    checar('meusParceiros recusa', 'failed-precondition', mp.erro);
    checar('…com a frase da Comunidade fechada', FRASE_DA_COMUNIDADE_FECHADA, mp.msg);
    checar('…e nenhum WhatsApp do colega sai', false, JSON.stringify(mp).includes('988887777'));
    const fc = await chamar(fotosDaComunidade, ESTRANHO);
    checar('fotosDaComunidade recusa (o motorista)', 'failed-precondition', fc.erro);
    const av = await chamar(avisarParceiroIndicado, ESTRANHO, { parceiroUid: COLEGA });
    checar('avisarParceiroIndicado recusa', 'failed-precondition', av.erro);
    const caixa = await db.collection('notifications').where('userId', '==', COLEGA).get();
    checar('…e nada chega à caixa do colega', 0, caixa.size);
    const pubP = await chamar(publicarFotoDaTurma, ESTRANHO, { publico: 'parceiros', caminho: `fotosDaTurma/${ESTRANHO}/x.jpg`, criancas: [], epoca: 'Natal', semCrianca: true });
    checar('publicar para os parceiros recusa', 'failed-precondition', pubP.erro);
    const pubC = await chamar(publicarFotoDaTurma, ESTRANHO, { publico: 'comunidade', caminho: `fotosDaTurma/${ESTRANHO}/x.jpg`, criancas: [], epoca: 'Natal', semCrianca: true });
    checar('publicar para a comunidade recusa', 'failed-precondition', pubC.erro);
    // Sonda: a foto para as FAMÍLIAS não passa pelo portão — cai adiante,
    // no caminho inválido, com outro erro.
    const pubF = await chamar(publicarFotoDaTurma, ESTRANHO, { publico: 'familias', caminho: 'caminho/errado.jpg', criancas: [], epoca: 'Natal' });
    checar('publicar para as famílias NÃO passa pelo portão', true, pubF.msg !== FRASE_DA_COMUNIDADE_FECHADA);
    const tr = await chamar(pedirTransferencia, ESTRANHO, { childId: 'kidS', parceiroUid: COLEGA });
    checar('pedirTransferencia recusa', 'failed-precondition', tr.erro);
    checar('…com a frase da Comunidade (não a da cobrança)', FRASE_DA_COMUNIDADE_FECHADA, tr.msg);
  }

  console.log('\n3. a chave LIGADA: o comportamento antigo volta');
  await db.doc('platformConfig/app').set({ comunidadeLigada: true });
  const mp = await chamar(meusParceiros, ESTRANHO);
  checar('meusParceiros responde', undefined, mp.erro);
  const p = mp.dados?.parceiros?.[0] || {};
  checar('…com o colega como parceiro (o motivo de religar exigir confirmação)', COLEGA, p.uid);
  checar('…com o WhatsApp dele', TEL, p.whatsapp);
  checar('…e a foto dos parceiros', ['fotoParceiros'], (mp.dados?.fotos || []).map((f) => f.id));
  const fc = await chamar(fotosDaComunidade, ESTRANHO);
  checar('fotosDaComunidade responde com a foto do colega', ['fotoComunidade'], (fc.dados?.fotos || []).map((f) => f.id));
  const av = await chamar(avisarParceiroIndicado, ESTRANHO, { parceiroUid: COLEGA });
  checar('avisarParceiroIndicado avisa', true, av.dados?.ok);

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
