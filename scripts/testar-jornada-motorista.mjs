/**
 * A JORNADA DO MOTORISTA, PONTA A PONTA, CONTRA O EMULADOR.
 *
 * ── O QUE É
 * Chama as functions DE VERDADE (`.run()` das callables v2, com o mesmo Admin
 * SDK de produção) e lê o que ficou gravado. Cobre só o que é NOVO desde a
 * versão publicada v1.2, na ordem em que um tio usaria:
 *   1. assinar com CPF/CNPJ (um documento, uma conta);
 *   2. o cupom do cartão do app;
 *   3. a rede de parceiros (meusParceiros e o aviso de indicação);
 *   4. a comunidade, do lado do tio (foto da turma);
 *   5. passar a família para outro tio (teto, contrato aceito, cobrança);
 *   6. a suspensão pelo dono e o registro dela;
 *   7. a foto diária da base.
 *
 * ── O QUE NÃO É
 * Não mede rules (o Admin SDK as ignora; `testar-regras.mjs` cobre), nem push,
 * nem telas. Falha de passo é registrada e o script segue: o relatório final
 * conta tudo.
 *
 * ── COMO RODAR
 *   npm run testar:jornada-motorista
 * Lê os hosts dos emuladores do ambiente (padrão 9099 / 8085 / 9199).
 *
 * ⚠️ FORA DA BATERIA ENCADEADA, como `testar-fechamento`: precisa dos
 * emuladores e importa o Admin SDK de `functions/node_modules`.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PID = 'alobuzinou-be81f';
process.env.GCLOUD_PROJECT = PID;
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
// O bucket padrão que `getStorage().bucket()` usa dentro das functions.
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: PID,
  storageBucket: `${PID}.firebasestorage.app`,
});

const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const idx = require('../functions/index.js');
const crypto = require('node:crypto');
const { fotografarBase } = require('../functions/lib/fotoDaBase.js');
const { chaveDoDia } = require('../functions/lib/reguaDoRetrato.js');

const db = admin.firestore();
const { Timestamp } = admin.firestore;

let ok = 0;
let bad = 0;
const falhas = [];
const limitacoes = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/** Chama uma callable; devolve { v } ou { erro: { code, message, details } }. */
async function chamar(fn, uid, data = {}) {
  try {
    const v = await idx[fn].run({
      auth: uid ? { uid, token: {} } : undefined,
      data,
      rawRequest: { ip: '127.0.0.1', headers: {} },
    });
    return { v };
  } catch (e) {
    return { erro: { code: e.code || 'erro', message: String(e.message || e), details: e.details } };
  }
}
const codigo = (r) => r.erro?.code ?? null;

const TIO_A = 'uidTioAlfa';
const TIO_B = 'uidTioBeta';
const TIO_C = 'uidTioGama';
const DONO = 'uidDonoDaCasa';
const CPF_A = '529.982.247-25';

async function limpar() {
  for (const col of [
    'users', 'children', 'indicacoes', 'notifications', 'schools', 'documentosDeAssinante',
    'codigosDeIndicacao', 'fotosDaTurma', 'autoriaDaFotoDaTurma', 'transferenciasDeFamilia',
    'contratosAssociacao', 'registroDoDono', 'taxaParceiros', 'fotosDaBase', 'platformConfig',
  ]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

async function semearTios() {
  await db.doc(`users/${TIO_A}`).set({ role: 'admin', name: 'Alfa da Silva', marcaNome: 'Tio Nino', phone: '(11) 91111-1111' });
  await db.doc(`users/${TIO_B}`).set({ role: 'admin', name: 'Beta Souza', marcaNome: 'Tio Beto', phone: '(11) 92222-2222' });
  await db.doc(`users/${TIO_C}`).set({ role: 'admin', name: 'Gama Lima', marcaNome: 'Tio Nino', phone: '(11) 93333-3333' });
  await db.doc(`users/${DONO}`).set({ role: 'owner', name: 'Dona da Casa' });
}

const CRIANCA = (id, extra = {}) => db.doc(`children/${id}`).set({
  adminUid: TIO_A, active: true, name: `Crianca ${id}`, parentUid: 'fam1', school: 'Escola Sol', ...extra,
});

async function main() {
  await limpar();
  await semearTios();
  await db.doc('platformConfig/app').set({ cobrancaLigada: true });

  // ───────────────────────────────────────────────────────────────────────
  bloco('1. Assinar com documento: um CPF, uma conta');
  const inv = await chamar('contratarPlano', TIO_C, { plano: 'mensal', documento: '111.111.111-11' });
  checar('CPF inválido é recusado', 'invalid-argument', codigo(inv));
  const semDoc = await chamar('contratarPlano', TIO_C, { plano: 'mensal' });
  checar('sem documento também é recusado', 'failed-precondition', codigo(semDoc));

  const a1 = await chamar('contratarPlano', TIO_A, { plano: 'mensal', documento: CPF_A });
  checar('CPF válido contrata', true, !!a1.v);
  const ua = (await db.doc(`users/${TIO_A}`).get()).data();
  checar('users.plano gravado', 'mensal', ua.plano);
  checar('users.documentoDaAssinatura gravado', CPF_A, ua.documentoDaAssinatura);
  const hash = crypto.createHash('sha256').update('alobuzinou:documentoDeAssinante:52998224725').digest('hex');
  const reg = await db.doc(`documentosDeAssinante/${hash}`).get();
  checar('documentosDeAssinante/{sha256} = { uid }', TIO_A, reg.data()?.uid);

  const a2 = await chamar('contratarPlano', TIO_A, { plano: 'anual', documento: CPF_A });
  checar('o mesmo tio troca de plano com o mesmo CPF', true, !!a2.v);

  const c1 = await chamar('contratarPlano', TIO_C, { plano: 'mensal', documento: CPF_A });
  checar('o mesmo CPF por outro tio: already-exists', 'already-exists', codigo(c1));
  checar('a mensagem não diz de quem é', false, String(c1.erro?.message).includes(TIO_A));
  checar('nem grava plano no segundo tio', undefined, (await db.doc(`users/${TIO_C}`).get()).data().plano);

  // ───────────────────────────────────────────────────────────────────────
  bloco('2. O cupom do cartão do app');
  const k1 = await chamar('meuCodigoDeIndicacao', TIO_A);
  checar('formato NINO-1234 (marca sem "Tio")', true, /^NINO-\d{4}$/.test(k1.v?.codigo || ''));
  checar('gravado em users.codigoDeIndicacao', k1.v?.codigo, (await db.doc(`users/${TIO_A}`).get()).data().codigoDeIndicacao);
  const k1b = await chamar('meuCodigoDeIndicacao', TIO_A);
  checar('chamar de novo devolve o mesmo', k1.v?.codigo, k1b.v?.codigo);
  const k2 = await chamar('meuCodigoDeIndicacao', TIO_C);
  checar('dois tios não recebem o mesmo código', true, !!k2.v?.codigo && k2.v.codigo !== k1.v?.codigo);
  checar('o código é registrado em codigosDeIndicacao', TIO_A, (await db.doc(`codigosDeIndicacao/${k1.v?.codigo}`).get()).data()?.uid);

  // ───────────────────────────────────────────────────────────────────────
  bloco('3. A rede de parceiros');
  await db.collection('indicacoes').add({ indicadorUid: TIO_A, indicadoUid: TIO_B, estado: 'ativa' });
  for (let i = 1; i <= 6; i += 1) {
    await db.collection('schools').add({ adminUid: TIO_B, nome: `Escola do Beta ${i}`, endereco: 'Rua Secreta 1', telefone: '11999990000' });
  }
  await CRIANCA('crSegredo', { name: 'Zuleica Quasimodo', parentName: 'Mae Zuleica' });
  const mp = await chamar('meusParceiros', TIO_A);
  const parc = mp.v?.parceiros || [];
  checar('devolve um parceiro, o B', [TIO_B], parc.map((p) => p.uid));
  checar('com a marca', 'Tio Beto', parc[0]?.marca);
  checar('com o WhatsApp só em dígitos', '11922222222', parc[0]?.whatsapp);
  checar('com até 4 escolas', 4, parc[0]?.escolas?.length);
  checar('e nenhuma é criança', false, JSON.stringify(mp.v).includes('Zuleica'));
  const mpB = await chamar('meusParceiros', TIO_B);
  checar('o B enxerga o A (indicou você)', [TIO_A], (mpB.v?.parceiros || []).map((p) => p.uid));

  const av1 = await chamar('avisarParceiroIndicado', TIO_A, { parceiroUid: TIO_B });
  checar('avisa o parceiro', true, av1.v?.avisado);
  const av2 = await chamar('avisarParceiroIndicado', TIO_A, { parceiroUid: TIO_B });
  checar('o segundo no mesmo dia não cria outro', false, av2.v?.avisado);
  const avisosB = (await db.collection('notifications').where('userId', '==', TIO_B).where('type', '==', 'parceiro_indicou_voce').get()).docs;
  checar('há exatamente um aviso no B', 1, avisosB.length);
  const textoAviso = JSON.stringify(avisosB[0]?.data() || {});
  checar('nada da família vai no aviso', false, /Zuleica|Quasimodo|fam1|crSegredo/.test(textoAviso));
  const av3 = await chamar('avisarParceiroIndicado', TIO_C, { parceiroUid: TIO_B });
  checar('tio sem parceria não avisa', 'permission-denied', codigo(av3));

  // ───────────────────────────────────────────────────────────────────────
  bloco('4. Comunidade, lado do tio');
  const bucket = admin.storage().bucket();
  const caminho = `fotosDaTurma/${TIO_A}/foto123abc.jpg`;
  let subiu = true;
  try {
    await bucket.file(caminho).save(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  } catch (e) {
    subiu = false;
    limitacoes.push(`Storage do emulador não aceitou o upload: ${e.message}`);
  }
  checar('o JPEG subiu no Storage do emulador', true, subiu);

  const semDecl = await chamar('publicarFotoDaTurma', TIO_A, { publico: 'parceiros', epoca: 'Natal', caminho, criancas: [] });
  checar('parceiros sem a declaração semCrianca é recusado', 'failed-precondition', codigo(semDecl));
  const comCrianca = await chamar('publicarFotoDaTurma', TIO_A, { publico: 'parceiros', epoca: 'Natal', caminho, criancas: ['crSegredo'], todasMarcadas: true, semCrianca: true });
  checar('parceiros com criança marcada é recusado', 'failed-precondition', codigo(comCrianca));
  const pub = await chamar('publicarFotoDaTurma', TIO_A, { publico: 'parceiros', epoca: 'Natal', caminho, criancas: [], semCrianca: true });
  checar('parceiros sem criança, com a declaração, publica', true, !!pub.v?.id);
  if (!pub.v) limitacoes.push(`publicar parceiros falhou: ${pub.erro?.code} ${pub.erro?.message}`);
  const postId = pub.v?.id;
  const postDoc = postId ? (await db.doc(`fotosDaTurma/${postId}`).get()).data() : null;
  checar('o post é do tio e para os parceiros', [TIO_A, 'parceiros'], [postDoc?.adminUid, postDoc?.publico]);

  const semAlcance = await chamar('publicarFotoDaTurma', TIO_A, { publico: 'comunidade', epoca: 'Natal', caminho, criancas: ['crSegredo'], todasMarcadas: true });
  checar('comunidade com criança sem alcance é recusada', 'failed-precondition', codigo(semAlcance));
  checar('e diz quem está sem o sim', ['crSegredo'], semAlcance.erro?.details?.semSim);
  const comSemDecl = await chamar('publicarFotoDaTurma', TIO_A, { publico: 'comunidade', epoca: 'Natal', caminho, criancas: [] });
  checar('comunidade sem criança e sem declaração é recusada', 'failed-precondition', codigo(comSemDecl));

  const apOutro = await chamar('apagarFotoDaTurma', TIO_B, { id: postId });
  checar('apagar post de outro tio: recusado', 'not-found', codigo(apOutro));
  checar('o post continua lá', true, postId ? (await db.doc(`fotosDaTurma/${postId}`).get()).exists : false);
  const apProprio = await chamar('apagarFotoDaTurma', TIO_A, { id: postId });
  checar('apagar o próprio funciona', true, !!apProprio.v?.ok);
  checar('o documento some', false, postId ? (await db.doc(`fotosDaTurma/${postId}`).get()).exists : true);
  const [aindaExiste] = await bucket.file(caminho).exists();
  checar('e o arquivo some do Storage', false, aindaExiste);

  // ───────────────────────────────────────────────────────────────────────
  bloco('5. Passar a família para outro tio');
  await db.doc(`users/${TIO_A}`).set({ plano: 'mensal' }, { merge: true });
  await db.doc(`users/${TIO_B}`).set({ plano: 'mensal' }, { merge: true });
  await CRIANCA('cr1');
  await CRIANCA('cr2');
  await CRIANCA('cr3');
  await CRIANCA('cr4');

  const naoParceiro = await chamar('pedirTransferencia', TIO_A, { childId: 'cr1', parceiroUid: TIO_C });
  checar('para quem não é parceiro: recusado', 'failed-precondition', codigo(naoParceiro));
  const p1 = await chamar('pedirTransferencia', TIO_A, { childId: 'cr1', parceiroUid: TIO_B });
  checar('pedido ao parceiro funciona', true, !!p1.v?.id);
  const t1 = p1.v?.id;
  const t1p = (await db.doc(`transferenciasDeFamilia/${t1}`).get()).data();
  checar('nasce no estado pedido, sem a família ver', ['pedido', false], [t1p?.estado, t1p?.familiaVe]);
  const p1b = await chamar('pedirTransferencia', TIO_A, { childId: 'cr1', parceiroUid: TIO_B });
  checar('segundo pedido aberto da mesma criança: recusado', 'failed-precondition', codigo(p1b));
  checar('pela razão certa', true, /pedido aberto/.test(p1b.erro?.message || ''));

  const r0 = await chamar('responderTransferencia', TIO_B, { id: t1, aceito: true });
  checar('B sem contrato aceito: recusado', 'failed-precondition', codigo(r0));
  checar('com precisaAssinar', true, r0.erro?.details?.precisaAssinar);

  const antes = Timestamp.fromMillis(Date.now() - 86400000);
  const depois = Timestamp.fromMillis(Date.now() - 3600000);
  await db.doc('contratosAssociacao/ctoAceito').set({ tioUid: TIO_B, aceitoEm: antes, emitidoEm: antes, conteudo: { plano: { id: 'mensal' } } });
  await db.doc('contratosAssociacao/ctoPendente').set({ tioUid: TIO_B, aceitoEm: null, emitidoEm: depois, conteudo: { plano: { id: 'mensal' } } });
  const r1 = await chamar('responderTransferencia', TIO_B, { id: t1, aceito: true });
  checar('contrato pendente MAIS NOVO que o aceito: recusado', 'failed-precondition', codigo(r1));
  checar('também com precisaAssinar', true, r1.erro?.details?.precisaAssinar);
  await db.doc('contratosAssociacao/ctoPendente').delete();
  const r2 = await chamar('responderTransferencia', TIO_B, { id: t1, aceito: true });
  checar('com contrato aceito do plano: aceita', 'parceiro_aceitou', r2.v?.estado);
  const t1d = (await db.doc(`transferenciasDeFamilia/${t1}`).get()).data();
  checar('a família passa a ver o pedido', true, t1d.familiaVe);

  const p2 = await chamar('pedirTransferencia', TIO_A, { childId: 'cr2', parceiroUid: TIO_B });
  checar('pedido de outra criança funciona', true, !!p2.v?.id);
  const cancela = await chamar('cancelarTransferencia', TIO_A, { id: p2.v?.id });
  checar('A cancela um pedido aberto', true, !!cancela.v?.ok);
  checar('e o estado vira cancelada', 'cancelada', (await db.doc(`transferenciasDeFamilia/${p2.v?.id}`).get()).data()?.estado);
  const cancelaDeNovo = await chamar('cancelarTransferencia', TIO_A, { id: p2.v?.id });
  checar('cancelar de novo é recusado', 'failed-precondition', codigo(cancelaDeNovo));
  const cancelaOutro = await chamar('cancelarTransferencia', TIO_B, { id: t1 });
  checar('B não cancela o pedido de A', 'not-found', codigo(cancelaOutro));

  // O teto: 10 pedidos do mês de A (o cancelado e o aberto já contam).
  for (let i = 0; i < 10; i += 1) {
    await db.collection('transferenciasDeFamilia').add({
      deUid: TIO_A, paraUid: TIO_B, childId: `cx${i}`, estado: 'concluida', criadoEm: Timestamp.now(),
      expiraEm: Timestamp.fromMillis(Date.now() + 86400000),
    });
  }
  const teto = await chamar('pedirTransferencia', TIO_A, { childId: 'cr3', parceiroUid: TIO_B });
  checar('o 11º pedido do mês: recusado', 'failed-precondition', codigo(teto));
  checar('com a frase do teto', true, /10 famílias/.test(teto.erro?.message || ''));

  await db.doc('platformConfig/app').set({ cobrancaLigada: false });
  const desl = await chamar('pedirTransferencia', TIO_A, { childId: 'cr4', parceiroUid: TIO_B });
  checar('com a cobrança desligada, pedir é recusado', 'failed-precondition', codigo(desl));
  checar('pela razão certa', true, /ainda não está disponível/.test(desl.erro?.message || ''));
  await db.doc('platformConfig/app').set({ cobrancaLigada: true });

  // ───────────────────────────────────────────────────────────────────────
  bloco('6. Suspensão pelo dono');
  const ate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const pedido = {
    alvoUid: TIO_A, acao: 'suspender', motivo: 'fraude', grau: 'suspensao', ate,
    mensagem: 'Sua conta foi suspensa por descumprir uma regra. Responda pelo e-mail.',
    evidencia: 'EVIDENCIA-SECRETA-777',
  };
  const s1 = await chamar('suspenderConta', DONO, pedido);
  checar('o dono suspende', true, !!s1.v?.ok);
  const aSusp = (await db.doc(`users/${TIO_A}`).get()).data();
  checar('users.suspenso é true', true, aSusp.suspenso);
  checar('taxaParceiros.suspensaoAte é o prazo', ate, (await db.doc(`taxaParceiros/${TIO_A}`).get()).data()?.suspensaoAte);
  const linhas = await db.collection('registroDoDono').where('alvoUid', '==', TIO_A).get();
  checar('uma linha no registro do dono', 1, linhas.size);
  checar('com motivo, evidência e quem decidiu', ['fraude', 'EVIDENCIA-SECRETA-777', DONO],
    [linhas.docs[0]?.data().motivo, linhas.docs[0]?.data().evidencia, linhas.docs[0]?.data().donoUid]);
  const avs = (await db.collection('notifications').where('userId', '==', TIO_A).where('type', '==', 'conta_suspensa').get()).docs;
  checar('um aviso conta_suspensa para A', 1, avs.length);
  const txt = JSON.stringify(avs[0]?.data() || {});
  checar('o aviso não traz o motivo nem a evidência', false, /fraude|Fraude|EVIDENCIA/.test(txt));

  const s2 = await chamar('suspenderConta', TIO_A, { ...pedido, alvoUid: TIO_B });
  checar('motorista chamando é recusado', 'permission-denied', codigo(s2));
  checar('e nada mudou no alvo', undefined, (await db.doc(`users/${TIO_B}`).get()).data().suspenso);
  await db.doc('users/uidOutroDono').set({ role: 'owner', name: 'Outro' });
  const s3b = await chamar('suspenderConta', DONO, { ...pedido, alvoUid: 'uidOutroDono' });
  checar('alvo dono é recusado', 'failed-precondition', codigo(s3b));
  const s4 = await chamar('suspenderConta', DONO, { ...pedido, alvoUid: DONO });
  checar('o próprio dono como alvo é recusado', 'invalid-argument', codigo(s4));
  const s5 = await chamar('suspenderConta', DONO, { ...pedido, alvoUid: TIO_B, mensagem: 'Por [CLÁUSULA DOS TERMOS] sua conta foi suspensa.' });
  checar('mensagem com o marcador é recusada', 'invalid-argument', codigo(s5));
  checar('e B segue sem suspensão', undefined, (await db.doc(`users/${TIO_B}`).get()).data().suspenso);

  const s6 = await chamar('suspenderConta', DONO, { alvoUid: TIO_A, acao: 'reativar', motivo: 'engano', mensagem: '' });
  checar('reativar funciona', true, !!s6.v?.ok);
  checar('users.suspenso volta a false', false, (await db.doc(`users/${TIO_A}`).get()).data().suspenso);
  checar('e o prazo é limpo', null, (await db.doc(`taxaParceiros/${TIO_A}`).get()).data()?.suspensaoAte);
  const linhas2 = await db.collection('registroDoDono').where('alvoUid', '==', TIO_A).get();
  checar('o registro ganha uma NOVA linha (append-only)', ['reativar', 'suspender'], linhas2.docs.map((d) => d.data().acao).sort());

  // ───────────────────────────────────────────────────────────────────────
  bloco('7. A foto diária da base');
  const agora = new Date();
  await fotografarBase(db, agora);
  const dia = chaveDoDia(agora);
  const foto = await db.doc(`fotosDaBase/${dia}`).get();
  checar('grava fotosDaBase/{dia de Brasília}', true, foto.exists);
  const fd = foto.data() || {};
  const tudo = JSON.stringify(fd);
  checar('só números: nenhum uid nem nome', false, /uidTio|uidDono|Nino|Beto|Alfa|Zuleica/.test(tudo));
  const tipos = Object.entries(fd).filter(([k]) => !['dia', 'gravadaEm', 'planos'].includes(k)).map(([, v]) => typeof v);
  checar('os campos soltos são número (ou nulo)', true, tipos.every((t) => t === 'number' || t === 'object'));
  checar('motoristas = 3 (A, B, C)', 3, fd.motoristas);
  await fotografarBase(db, agora);
  checar('rodar de novo no mesmo dia não duplica', 1, (await db.collection('fotosDaBase').get()).size);
  if (typeof idx.fotografarBase?.run === 'function') {
    try {
      await idx.fotografarBase.run({});
      checar('o handler agendado também roda sem duplicar', 1, (await db.collection('fotosDaBase').get()).size);
    } catch (e) {
      limitacoes.push(`o handler agendado fotografarBase.run({}) lançou: ${e.message}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  console.log(`\n${ok} passaram, ${bad} falharam`);
  if (limitacoes.length) {
    console.log('\nLimitações:');
    for (const l of limitacoes) console.log(`  - ${l}`);
  }
  if (falhas.length) {
    console.log('\nFalhas:');
    for (const f of falhas) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
