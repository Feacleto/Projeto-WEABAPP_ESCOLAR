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
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

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
const {
  makePedirTransferencia,
  makeResponderTransferencia,
  makeAceitarTransferencia,
  makeCancelarTransferencia,
} = require('../functions/lib/transferencias.js');
const { comunidadeLigada, exigirComunidadeLigada } = require('../functions/lib/comunidadeLigada.js');
const { makeCasarNoCadastro } = require('../functions/lib/casarNoCadastro.js');
const { FRASE_DA_COMUNIDADE_FECHADA } = require('../functions/lib/reguaDaComunidade.js');

const meusParceiros = makeMeusParceiros(db);
const fotosDaComunidade = makeFotosDaComunidade(db);
const avisarParceiroIndicado = makeAvisarParceiroIndicado(db);
const publicarFotoDaTurma = makePublicarFotoDaTurma(db);
const pedirTransferencia = makePedirTransferencia(db);
const responderTransferencia = makeResponderTransferencia(db);
const aceitarTransferencia = makeAceitarTransferencia(db);
const cancelarTransferencia = makeCancelarTransferencia(db);
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
// A família do estranho: a rede dela inclui os "parceiros" dele, então, sem
// o portão, ela receberia a foto do colega. É o que torna a sonda de verdade.
const FAMILIA = 'familiaDoEstranho';
const COLEGA = 'colegaA';
const TEL = '11988887777';

async function limpar() {
  for (const col of ['users', 'indicacoes', 'fotosDaTurma', 'notifications', 'platformConfig', 'schools', 'children', 'transferenciasDeFamilia', 'payments', 'contratosAssociacao']) {
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
  await db.doc(`users/${FAMILIA}`).set({ role: 'parent', name: 'Mãe da Ana', adminUid: ESTRANHO, adminUids: [ESTRANHO], childIds: ['kidS'] });
  // Um pedido de transferência ABERTO ANTES da chave, para o "parceiro"
  // forjado — o que a auditoria achou escapando do portão.
  await db.doc('transferenciasDeFamilia/trAberta').set({
    deUid: ESTRANHO, paraUid: COLEGA, familiaUid: FAMILIA, childId: 'kidS',
    estado: 'pedido', previa: { primeiroNome: 'Ana' }, criadoEm: Timestamp.now(),
  });
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
    const fcFam = await chamar(fotosDaComunidade, FAMILIA);
    checar('fotosDaComunidade recusa (a FAMÍLIA)', 'failed-precondition', fcFam.erro);
    checar('…e a família não recebe a foto do colega', false, JSON.stringify(fcFam).includes('fotoComunidade'));
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
    // O pedido JÁ ABERTO: o parceiro não responde e a família não aceita.
    for (const aceito of [true, false]) {
      const rt = await chamar(responderTransferencia, COLEGA, { id: 'trAberta', aceito });
      checar(`responderTransferencia (aceito: ${aceito}) recusa`, ['failed-precondition', FRASE_DA_COMUNIDADE_FECHADA], [rt.erro, rt.msg]);
    }
    const at = await chamar(aceitarTransferencia, FAMILIA, { id: 'trAberta' });
    checar('aceitarTransferencia (a família) recusa', ['failed-precondition', FRASE_DA_COMUNIDADE_FECHADA], [at.erro, at.msg]);
    const tr2 = (await db.doc('transferenciasDeFamilia/trAberta').get()).data();
    checar('…e o pedido continua como estava', 'pedido', tr2.estado);
    const novas = await db.collection('children').where('adminUid', '==', COLEGA).get();
    checar('…e nenhuma criança nasceu na conta do "parceiro"', 0, novas.size);
  }

  console.log('\n2b. a leitura da chave FALHA: fecha (fail-closed)');
  {
    // Um db que deixa tudo passar, menos a leitura de platformConfig/app,
    // que LANÇA — com a chave ligada no banco de verdade. Se a falha abrisse
    // a porta, meusParceiros devolveria o WhatsApp do colega.
    await db.doc('platformConfig/app').set({ comunidadeLigada: true });
    const quebrado = new Proxy(db, {
      get(alvo, prop) {
        if (prop === 'doc') {
          return (caminho) => (caminho === 'platformConfig/app'
            ? { get: async () => { throw new Error('rede caiu'); } }
            : alvo.doc(caminho));
        }
        const v = alvo[prop];
        return typeof v === 'function' ? v.bind(alvo) : v;
      },
    });
    checar('comunidadeLigada com leitura que lança: false', false, await comunidadeLigada(quebrado));
    let erro = null;
    try { await exigirComunidadeLigada(quebrado); } catch (e) { erro = e.code; }
    checar('exigirComunidadeLigada com leitura que lança: recusa', 'failed-precondition', erro);
    const mpq = await chamar(makeMeusParceiros(quebrado), ESTRANHO);
    checar('meusParceiros com a leitura quebrada (chave LIGADA no banco): recusa', 'failed-precondition', mpq.erro);
    checar('…e nenhum WhatsApp sai', false, JSON.stringify(mpq).includes('988887777'));
    checar('sonda: com o db de verdade e a chave ligada, ela abre', true, await comunidadeLigada(db));
    await db.doc('platformConfig/app').delete();
  }

  console.log('\n2c. SONDA: o portão dentro do ramo do motorista seria pego');
  {
    // Muta uma CÓPIA do arquivo: move o portão para dentro do
    // `if (eu?.role === 'admin')`. O caso da família tem de falhar nela —
    // senão ele não protege nada.
    const fonte = readFileSync(new URL('../functions/lib/comunidade.js', import.meta.url), 'utf8');
    const antes = "    const { uid, dados: eu } = await carregarUsuario(db, request);\n    await exigirComunidadeLigada(db);\n    let tios;\n    if (eu?.role === 'admin') {\n";
    const depois = "    const { uid, dados: eu } = await carregarUsuario(db, request);\n    let tios;\n    if (eu?.role === 'admin') {\n      await exigirComunidadeLigada(db);\n";
    const normal = fonte.replace(/\r\n/g, '\n');
    checar('sonda: o trecho a mutar existe no arquivo', true, normal.includes(antes));
    const tmp = new URL('../functions/lib/.sonda-comunidade.tmp.js', import.meta.url);
    writeFileSync(tmp, normal.replace(antes, depois));
    try {
      const mutante = require('../functions/lib/.sonda-comunidade.tmp.js');
      const fam = await chamar(mutante.makeFotosDaComunidade(db), FAMILIA);
      const doMotorista = await chamar(mutante.makeFotosDaComunidade(db), ESTRANHO);
      checar('sonda: no mutante, o motorista continua recusado', 'failed-precondition', doMotorista.erro);
      checar('sonda: no mutante, a FAMÍLIA vaza a foto do colega (o caso acima pegaria)', ['fotoComunidade'],
        (fam.dados?.fotos || []).map((f) => f.id));
    } finally {
      rmSync(tmp, { force: true });
    }
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
  const fcFam = await chamar(fotosDaComunidade, FAMILIA);
  checar('a família volta a ver a foto do parceiro do tio dela', ['fotoComunidade'], (fcFam.dados?.fotos || []).map((f) => f.id));
  const rt = await chamar(responderTransferencia, COLEGA, { id: 'trAberta', aceito: false });
  checar('responderTransferencia passa do portão (recusar funciona)', true, rt.dados?.ok);
  const at = await chamar(aceitarTransferencia, FAMILIA, { id: 'trAberta' });
  checar('aceitarTransferencia passa do portão (cai em outra regra, não na da Comunidade)', true,
    at.msg !== FRASE_DA_COMUNIDADE_FECHADA);
  await db.doc('transferenciasDeFamilia/trCancelar').set({ deUid: ESTRANHO, paraUid: COLEGA, familiaUid: FAMILIA, childId: 'kidS', estado: 'pedido', criadoEm: Timestamp.now() });
  await db.doc('platformConfig/app').delete();
  const cc = await chamar(cancelarTransferencia, ESTRANHO, { id: 'trCancelar' });
  checar('cancelar o próprio pedido continua possível com a chave DESLIGADA', true, cc.dados?.ok);

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
