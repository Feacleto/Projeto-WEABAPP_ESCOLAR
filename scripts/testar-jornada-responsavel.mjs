/**
 * A JORNADA DA FAMÍLIA, PONTA A PONTA, CONTRA O EMULADOR.
 *
 * ── ⚠️ POR QUE ESTE ARQUIVO EXISTE
 * `testar:comunidade` e `testar:transferencia` provam RÉGUA, e `testar-regras`
 * prova rule com ator cru. Nenhum deles anda o caminho inteiro de quem usa o
 * app: a responsável diz "sim" para a foto (pelo cliente, passando pelas
 * RULES), o tio publica (callable de verdade), a família do tio parceiro lê, a
 * mãe muda de ideia, dá estrelas ao tio, pede outro tio e aceita ser passada
 * a ele. Cada passo depende do anterior — e é nas costuras que os defeitos
 * moram. Este arquivo roda a SEQUÊNCIA, e só as funcionalidades novas desde
 * a versão publicada 1.2 (comunidade etapas 1 e 2, passar a família).
 *
 * ── COMO MEDE
 * - O que a família escreve PELO CLIENTE (o "sim", as estrelas, o pedido de
 *   outro tio) vai pela API REST do Firestore com o token dela: assim passa
 *   pelas rules. O Admin SDK as ignoraria.
 * - O que é callable roda a callable de verdade (`idx.X.run`), com o Admin SDK
 *   do emulador por baixo, como em produção.
 *
 * ── COMO RODAR
 *   firebase emulators:exec --only auth,firestore,storage "node scripts/testar-jornada-responsavel.mjs"
 * (hosts lidos do ambiente: FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST,
 * FIREBASE_STORAGE_EMULATOR_HOST; padrão 9099 / 8085 / 9199.)
 *
 * ⚠️ FORA DA BATERIA ENCADEADA, como `testar-fechamento`: precisa do emulador
 * e importa o Admin SDK de `functions/node_modules`, o que `testar:imports`
 * proíbe lá.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PID = 'alobuzinou-be81f';
const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const HOST_FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const HOST_ST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
// Antes de carregar as functions: elas leem o ambiente ao subir.
process.env.GCLOUD_PROJECT = PID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = HOST_AUTH;
process.env.FIRESTORE_EMULATOR_HOST = HOST_FS;
process.env.FIREBASE_STORAGE_EMULATOR_HOST = HOST_ST;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PID, storageBucket: `${PID}.appspot.com` });

const idx = require('../functions/index.js');
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const { Timestamp } = require('../functions/node_modules/firebase-admin/lib/firestore/index.js');
const R = require('../functions/lib/reguaDaTransferencia.js');
const C = require('../functions/lib/reguaDaComunidade.js');

const db = admin.firestore();
const bucket = admin.storage().bucket();
const AUTH = `http://${HOST_AUTH}/identitytoolkit.googleapis.com/v1/accounts`;
const BASE = `http://${HOST_FS}/v1/projects/${PID}/databases/(default)`;
const FS = `${BASE}/documents`;
const H = (s) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${s.t}` });
const S = (v) => ({ stringValue: v });
const B = (v) => ({ booleanValue: v });
const I = (v) => ({ integerValue: String(v) });

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, passou, detalhe = '') {
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}${!passou && detalhe ? `  → ${detalhe}` : ''}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}
function bloco(t) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

/** Chama a callable de verdade. Devolve { ok, data } ou { ok:false, code, message, details }. */
async function chamar(fn, uid, data) {
  try {
    const resposta = await idx[fn].run({
      auth: { uid, token: {} },
      data,
      rawRequest: { ip: '127.0.0.1', headers: {} },
    });
    return { ok: true, data: resposta };
  } catch (e) {
    return { ok: false, code: e.code || 'erro', message: e.message, details: e.details };
  }
}

async function criarLogin(email) {
  const r = await fetch(`${AUTH}:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Teste123!', returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${email}: ${j.error.message}`);
  return { uid: j.localId, t: j.idToken };
}

/** Escrita do cliente (com rules): máscara e/ou hora do servidor; `existe` true = update, false = create. */
async function escrever(s, caminho, { fields = {}, mask = null, hora = null, existe = null } = {}) {
  const w = { update: { name: `projects/${PID}/databases/(default)/documents/${caminho}`, fields } };
  if (mask) w.updateMask = { fieldPaths: mask };
  if (hora) w.updateTransforms = [{ fieldPath: hora, setToServerValue: 'REQUEST_TIME' }];
  if (existe !== null) w.currentDocument = { exists: existe };
  const r = await fetch(`${BASE}/documents:commit`, { method: 'POST', headers: H(s), body: JSON.stringify({ writes: [w] }) });
  return r.status;
}
async function ler(s, caminho) {
  const r = await fetch(`${FS}/${caminho}`, { headers: H(s) });
  return r.status;
}

const T = (ms) => Timestamp.fromMillis(ms);
const agora = Date.now();
const sem = C.semestreDe(new Date());
const semAnt = C.semestreAnterior(sem);

async function main() {
  // ── O ELENCO ──────────────────────────────────────────────────────────
  const sufixo = Date.now();
  const [fK, fL, fB, fFora, fOutra, fM, fN] = await Promise.all(
    ['k', 'l', 'b', 'fora', 'outra', 'm', 'n'].map((n) => criarLogin(`${n}-${sufixo}@teste.local`))
  );
  const A = 'tioA';
  const Bt = 'tioB';
  const Ct = 'tioC';
  const tio = (nome, extra = {}) => ({ role: 'admin', name: nome, marcaNome: nome, plano: 'mensal', phone: '11999990000', ...extra });
  await db.doc('platformConfig/app').set({ cobrancaLigada: true });
  await db.doc(`users/${A}`).set(tio('Tio Ana'));
  await db.doc(`users/${Bt}`).set(tio('Tio Beto'));
  await db.doc(`users/${Ct}`).set(tio('Tio Cadu'));
  await db.doc('indicacoes/ab').set({ indicadorUid: A, indicadoUid: Bt, estado: 'ativa' });
  // A assinatura de B está fechada: plano + contrato aceito do mesmo plano.
  await db.doc('contratosAssociacao/tioB_1').set({
    tioUid: Bt, aceitoEm: T(agora - 86400000), emitidoEm: T(agora - 2 * 86400000), conteudo: { plano: { id: 'mensal' } },
  });
  await db.doc('schools/sB1').set({ adminUid: Bt, nome: 'Escola Sol' });

  const familia = (f, adminUid, childIds, extra = {}) => db.doc(`users/${f.uid}`).set({
    role: 'parent', name: `Mae ${f.uid.slice(0, 4)}`, adminUid, adminUids: [adminUid], childIds, childId: childIds[0], ...extra,
  });
  const crianca = (id, f, adminUid, extra = {}) => db.doc(`children/${id}`).set({
    name: id, adminUid, parentUid: f.uid, active: true, inviteStatus: 'used', ...extra,
  });
  await familia(fK, A, ['K']); await crianca('K', fK, A, { name: 'Kauan Silva' });
  await familia(fL, A, ['L']); await crianca('L', fL, A, { name: 'Lorena Souza' });
  await familia(fB, Bt, ['BB']); await crianca('BB', fB, Bt, { name: 'Bruna Lima' });
  await familia(fFora, Ct, ['F']); await crianca('F', fFora, Ct, { name: 'Felipe Rocha' });
  await familia(fOutra, A, ['O']); await crianca('O', fOutra, A, { name: 'Otavio Reis' });

  // ── 1. O "SIM" DA FOTO ────────────────────────────────────────────────
  bloco('1. O "sim" da foto (pelo cliente, passando pelas rules)');
  checar('sim com alcance "comunidade" passa', await escrever(fK, 'children/K', {
    fields: { fotoDaTurmaConsentida: B(true), fotoDaTurmaAlcance: S('comunidade') },
    mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaAlcance'], hora: 'fotoDaTurmaEm', existe: true,
  }) === 200);
  checar('"não" com alcance escrito (consentida false + comunidade) é recusado', await escrever(fOutra, 'children/O', {
    fields: { fotoDaTurmaConsentida: B(false), fotoDaTurmaAlcance: S('comunidade') },
    mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaAlcance'], hora: 'fotoDaTurmaEm', existe: true,
  }) !== 200);
  checar('alcance inventado ("mundo") é recusado', await escrever(fOutra, 'children/O', {
    fields: { fotoDaTurmaConsentida: B(true), fotoDaTurmaAlcance: S('mundo') },
    mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaAlcance'], hora: 'fotoDaTurmaEm', existe: true,
  }) !== 200);
  checar('sim ANTIGO (sem alcance) também passa', await escrever(fL, 'children/L', {
    fields: { fotoDaTurmaConsentida: B(true) }, mask: ['fotoDaTurmaConsentida'], hora: 'fotoDaTurmaEm', existe: true,
  }) === 200);
  checar('família de OUTRA criança não escreve o "sim" de K', await escrever(fOutra, 'children/K', {
    fields: { fotoDaTurmaConsentida: B(true), fotoDaTurmaAlcance: S('comunidade') },
    mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaAlcance'], hora: 'fotoDaTurmaEm', existe: true,
  }) !== 200);
  checar('data do "sim" que não é a hora do servidor é recusada', await escrever(fOutra, 'children/O', {
    fields: { fotoDaTurmaConsentida: B(true), fotoDaTurmaEm: { timestampValue: '2020-01-01T00:00:00Z' } },
    mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaEm'], existe: true,
  }) !== 200);
  const k1 = (await db.doc('children/K').get()).data();
  const l1 = (await db.doc('children/L').get()).data();
  checar('K ficou com o "sim" da comunidade; L, só com o da turma', C.podeNaComunidade(k1) === true && C.podeNaComunidade(l1) === false);

  // ── 2. A FOTO DA TURMA ────────────────────────────────────────────────
  bloco('2. Foto da turma (tio A publica para as famílias)');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const sobe = async (nome) => {
    await bucket.file(`fotosDaTurma/${A}/${nome}`).save(jpeg, { contentType: 'image/jpeg' });
    return `fotosDaTurma/${A}/${nome}`;
  };
  const p1 = await chamar('publicarFotoDaTurma', A, {
    publico: 'familias', criancas: ['K'], epoca: 'Natal', todasMarcadas: true, caminho: await sobe('turma-natal-1.jpg'), legenda: 'Natal na perua',
  });
  checar('publicarFotoDaTurma (familias, com K que disse sim) responde com id', p1.ok && !!p1.data.id, p1.message);
  if (p1.ok) {
    checar('a família de A lê o documento da foto (rules)', await ler(fK, `fotosDaTurma/${p1.data.id}`) === 200);
    checar('família de OUTRO tio não lê a foto da turma de A', await ler(fFora, `fotosDaTurma/${p1.data.id}`) !== 200);
    const doc = (await db.doc(`fotosDaTurma/${p1.data.id}`).get()).data();
    checar('a foto da turma tem link e vence em ~30 dias', !!doc.url && Math.abs(doc.expiraEm.toMillis() - (agora + 30 * 86400000)) < 3600000);
  }
  const idAviso = C.idDoAvisoDaFoto(A, 'Natal', fK.uid);
  const av1 = await db.doc(`notifications/${idAviso}`).get();
  checar('a família de K recebeu o aviso foto_da_turma', av1.exists && av1.get('type') === 'foto_da_turma' && av1.get('userId') === fK.uid);
  const criadaAv = av1.exists ? av1.get('createdAt').toMillis() : 0;
  const p1b = await chamar('publicarFotoDaTurma', A, {
    publico: 'familias', criancas: ['K'], epoca: 'Natal', todasMarcadas: true, caminho: await sobe('turma-natal-2.jpg'),
  });
  const avs = await db.collection('notifications').where('userId', '==', fK.uid).where('type', '==', 'foto_da_turma').get();
  checar('segunda foto da MESMA época publica, mas não toca de novo (um aviso por época)',
    p1b.ok && avs.size === 1 && avs.docs[0].get('createdAt').toMillis() === criadaAv);
  const pSemSim = await chamar('publicarFotoDaTurma', A, {
    publico: 'familias', criancas: ['O'], epoca: 'Natal', todasMarcadas: true, caminho: await sobe('turma-natal-3.jpg'),
  });
  checar('criança sem "sim" na foto da turma é recusada, dizendo quem',
    !pSemSim.ok && pSemSim.code === 'failed-precondition' && JSON.stringify(pSemSim.details || {}).includes('"O"'), `${pSemSim.code} ${pSemSim.message}`);

  // ── 3. A FOTO DA COMUNIDADE ───────────────────────────────────────────
  bloco('3. Foto da comunidade (tio A posta, a família do parceiro B lê)');
  const pc = await chamar('publicarFotoDaTurma', A, {
    publico: 'comunidade', criancas: ['K'], epoca: 'Natal', todasMarcadas: true, legenda: 'Festa na perua', caminho: await sobe('comunidade-1.jpg'),
  });
  checar('publicar para a comunidade com K (sim com alcance) passa', pc.ok && !!pc.data.id, pc.message);
  const docC = pc.ok ? (await db.doc(`fotosDaTurma/${pc.data.id}`).get()).data() : {};
  checar('o post da comunidade não guarda link no documento', docC.url === null);
  checar('as famílias não leem o post da comunidade direto (só pela callable)',
    pc.ok && await ler(fB, `fotosDaTurma/${pc.data.id}`) !== 200 && await ler(fK, `fotosDaTurma/${pc.data.id}`) !== 200);
  const vistaB = await chamar('fotosDaComunidade', fB.uid, {});
  checar('a família de B (parceiro) vê 1 post', vistaB.ok && vistaB.data.fotos.length === 1, vistaB.message || JSON.stringify(vistaB.data));
  if (vistaB.ok && vistaB.data.fotos.length) {
    const f = vistaB.data.fotos[0];
    checar('o post sai só com a lista fechada de campos',
      JSON.stringify(Object.keys(f).sort()) === JSON.stringify(['epoca', 'expiraEmMs', 'id', 'legenda', 'logoURL', 'marca', 'minha', 'url']), Object.keys(f).join(','));
    const json = JSON.stringify(vistaB.data);
    checar('nenhum nome de criança, childId ou escola no que sai', !/Kauan|Lorena|Bruna|"K"|childId|criancas|Escola Sol|caminho/.test(json), json.slice(0, 200));
    checar('época, legenda e marca estão certas; não é "minha"', f.epoca === 'Natal' && f.legenda === 'Festa na perua' && f.marca === 'Tio Ana' && f.minha === false);
  }
  const vistaFora = await chamar('fotosDaComunidade', fFora.uid, {});
  checar('família de fora da rede vê 0', vistaFora.ok && vistaFora.data.fotos.length === 0);
  const vistaK = await chamar('fotosDaComunidade', fK.uid, {});
  checar('a família do próprio tio A também vê o post', vistaK.ok && vistaK.data.fotos.length === 1);
  // Recusas na publicação.
  const rSemSim = await chamar('publicarFotoDaTurma', A, {
    publico: 'comunidade', criancas: ['L'], epoca: 'Natal', todasMarcadas: true, caminho: await sobe('comunidade-2.jpg'),
  });
  checar('criança só com o "sim" antigo é recusada na comunidade',
    !rSemSim.ok && rSemSim.code === 'failed-precondition' && JSON.stringify(rSemSim.details || {}).includes('"L"'), `${rSemSim.code} ${rSemSim.message}`);
  const rTel = await chamar('publicarFotoDaTurma', A, {
    publico: 'comunidade', criancas: [], semCrianca: true, epoca: 'Natal', legenda: 'Ligue (11) 98765-4321', caminho: await sobe('comunidade-3.jpg'),
  });
  checar('legenda com telefone é recusada', !rTel.ok && rTel.code === 'failed-precondition', `${rTel.code} ${rTel.message}`);
  const rNome = await chamar('publicarFotoDaTurma', A, {
    publico: 'comunidade', criancas: [], semCrianca: true, epoca: 'Natal', legenda: 'Foi lindo, Kauan adorou', caminho: await sobe('comunidade-4.jpg'),
  });
  checar('legenda com nome de criança da turma é recusada', !rNome.ok && rNome.code === 'failed-precondition', `${rNome.code} ${rNome.message}`);
  const rNome2 = await chamar('publicarFotoDaTurma', A, {
    publico: 'comunidade', criancas: [], semCrianca: true, epoca: 'Natal', legenda: 'A mãe da Lorena amou', caminho: await sobe('comunidade-5.jpg'),
  });
  checar('legenda com nome de OUTRA criança da turma (Lorena) é recusada', !rNome2.ok, `${rNome2.code}`);
  // O "não" derruba na hora.
  checar('K diz "não" (consentida false, alcance removido) pelo cliente', await escrever(fK, 'children/K', {
    fields: { fotoDaTurmaConsentida: B(false) }, mask: ['fotoDaTurmaConsentida', 'fotoDaTurmaAlcance'], hora: 'fotoDaTurmaEm', existe: true,
  }) === 200);
  const k2 = (await db.doc('children/K').get()).data();
  checar('o alcance saiu do documento com o "não"', k2.fotoDaTurmaConsentida === false && !('fotoDaTurmaAlcance' in k2));
  const vistaB2 = await chamar('fotosDaComunidade', fB.uid, {});
  checar('depois do "não", a família de B vê 0 na hora', vistaB2.ok && vistaB2.data.fotos.length === 0, JSON.stringify(vistaB2.data));
  const vistaK2 = await chamar('fotosDaComunidade', fK.uid, {});
  checar('e a própria família de K também deixa de ver o post', vistaK2.ok && vistaK2.data.fotos.length === 0);

  // ── 4. AS ESTRELAS AO TIO ─────────────────────────────────────────────
  bloco('4. Estrelas ao tio');
  const idNota = `${A}_${fK.uid}_${sem}`;
  const notaDoc = (f, nota, adminUid = A) => ({
    adminUid: S(adminUid), familiaUid: S(f.uid), semestre: S(sem), nota: I(nota),
  });
  checar('a família de K grava a nota (4) do semestre corrente', await escrever(fK, `avaliacoesDoTio/${idNota}`, { fields: notaDoc(fK, 4), hora: 'em' }) === 200);
  checar('ela muda a nota dentro do semestre (5)', await escrever(fK, `avaliacoesDoTio/${idNota}`, { fields: notaDoc(fK, 5), hora: 'em' }) === 200);
  checar('nota 6 é recusada', await escrever(fL, `avaliacoesDoTio/${A}_${fL.uid}_${sem}`, { fields: notaDoc(fL, 6), hora: 'em' }) !== 200);
  checar('nota 0 é recusada', await escrever(fL, `avaliacoesDoTio/${A}_${fL.uid}_${sem}`, { fields: notaDoc(fL, 0), hora: 'em' }) !== 200);
  checar('outra família não grava no id da família de K', await escrever(fL, `avaliacoesDoTio/${idNota}`, { fields: notaDoc(fK, 1), hora: 'em' }) !== 200);
  checar('outra família não grava no próprio id com o uid de K no corpo', await escrever(fL, `avaliacoesDoTio/${A}_${fL.uid}_${sem}`, { fields: notaDoc(fK, 1), hora: 'em' }) !== 200);
  checar('família que não é do tio C não o avalia', await escrever(fL, `avaliacoesDoTio/${Ct}_${fL.uid}_${sem}`, { fields: notaDoc(fL, 5, Ct), hora: 'em' }) !== 200);
  checar('semestre que já fechou não se escreve', await escrever(fL, `avaliacoesDoTio/${A}_${fL.uid}_${semAnt}`, {
    fields: { adminUid: S(A), familiaUid: S(fL.uid), semestre: S(semAnt), nota: I(5) }, hora: 'em',
  }) !== 200);
  checar('a família lê a nota dela', await ler(fK, `avaliacoesDoTio/${idNota}`) === 200);
  checar('outra família não lê a nota de K', await ler(fL, `avaliacoesDoTio/${idNota}`) !== 200);
  // O tio: 3 respostas no semestre fechado (menos de 5) para A, e 5 para o tio B.
  for (let i = 0; i < 3; i += 1) {
    await db.doc(`avaliacoesDoTio/${A}_x${i}_${semAnt}`).set({ adminUid: A, familiaUid: `x${i}`, semestre: semAnt, nota: 5, em: T(agora) });
  }
  for (let i = 0; i < 5; i += 1) {
    await db.doc(`avaliacoesDoTio/${Bt}_y${i}_${semAnt}`).set({ adminUid: Bt, familiaUid: `y${i}`, semestre: semAnt, nota: i < 3 ? 5 : 4, em: T(agora) });
  }
  const mA = await chamar('minhaNotaDasFamilias', A, {});
  checar('com 3 respostas no semestre fechado, o tio A não recebe média', mA.ok && mA.data.anterior.media === null && mA.data.anterior.total === 3, JSON.stringify(mA.data));
  checar('do semestre corrente o tio vê só QUANTAS responderam', mA.ok && mA.data.atual.total === 1 && !('media' in mA.data.atual), JSON.stringify(mA.data));
  const mB = await chamar('minhaNotaDasFamilias', Bt, {});
  checar('com 5 respostas o tio B recebe a média (4,6)', mB.ok && mB.data.anterior.media === 4.6, JSON.stringify(mB.data));
  const mFam = await chamar('minhaNotaDasFamilias', fK.uid, {});
  checar('a família não chama minhaNotaDasFamilias', !mFam.ok);

  // ── 5. PEDIR OUTRO TIO ────────────────────────────────────────────────
  bloco('5. A família pede outro tio');
  const idPedido = `outrotio_K_${new Date(agora - 3 * 3600000).toISOString().slice(0, 7)}`;
  const pedido = {
    userId: S(A), type: S('familia_pede_outro_tio'), title: S('A família de Kauan pediu para passar a outro tio'),
    body: S('Se fizer sentido, escolha um tio parceiro.'), childId: S('K'), read: B(false),
  };
  checar('a família cria o aviso de pedido (um por criança por mês)', await escrever(fK, `notifications/${idPedido}`, { fields: pedido, hora: 'createdAt', existe: false }) === 200);
  checar('o segundo no mesmo mês é recusado', await escrever(fK, `notifications/${idPedido}`, { fields: pedido, hora: 'createdAt' }) !== 200);
  checar('a família não avisa um tio que não é dela', await escrever(fK, 'notifications/outrotio_K_x', { fields: { ...pedido, userId: S(Ct) }, hora: 'createdAt', existe: false }) !== 200);
  checar('a família não forja a fatura da plataforma', await escrever(fK, 'notifications/fake1', { fields: { ...pedido, type: S('fatura_vence') }, hora: 'createdAt', existe: false }) !== 200);

  // ── 6. A TRANSFERÊNCIA, O LADO DA FAMÍLIA ─────────────────────────────
  bloco('6. Passar a família de A para B');
  await familia(fM, A, ['M']);
  await crianca('M', fM, A, {
    name: 'Marina Costa', gender: 'f', birthDate: '2016-03-01', turma: '4B', parentName: 'Mae M', parentPhone: '11988887777', parentPhoneChave: '5511988887777',
    address: 'Rua das Flores, 100', cep: '04763110', lat: -23.7, lng: -46.7, school: 'Escola Sol', schoolAddress: 'Av. A, 1',
    saudeNotas: 'alergia a amendoim', saudeConsentidaEm: T(agora), photoURL: 'https://x/y.jpg', monthlyFee: 350, dueDay: 10,
    contratoVigente: { numero: 1 }, horaPega: '06:40', notes: 'nota do tio', inviteCode: 'ABC12345', fotoDaTurmaConsentida: true, fotoDaTurmaEm: T(agora),
  });
  await db.doc('children/M/contratos/1').set({ numero: 1, tipo: 'contrato', status: 'aceito', adminUid: A, familia: fM.uid });
  await db.doc('payments/pgM').set({ adminUid: A, parentUid: fM.uid, childId: 'M', status: 'paid', amount: 350, month: '2026-09' });

  const ped = await chamar('pedirTransferencia', A, { childId: 'M', parceiroUid: Bt });
  checar('o tio A pede a transferência de M ao parceiro B', ped.ok && !!ped.data.id, ped.message);
  const tid = ped.ok ? ped.data.id : 'nao-existe';
  const tdoc = (await db.doc(`transferenciasDeFamilia/${tid}`).get()).data() || {};
  checar('o pedido nasce com familiaVe false e só o primeiro nome na prévia',
    tdoc.familiaVe === false && tdoc.previa?.primeiroNome === 'Marina' && !JSON.stringify(tdoc.previa).includes('Costa'));
  checar('a família NÃO lê o pedido enquanto o parceiro não aceita (familiaVe false)', await ler(fM, `transferenciasDeFamilia/${tid}`) !== 200);
  const avFamAntes = await db.collection('notifications').where('userId', '==', fM.uid).where('transferenciaId', '==', tid).get();
  checar('nenhum aviso chega à família antes do aceite do parceiro', avFamAntes.size === 0);
  const aceiteCedo = await chamar('aceitarTransferencia', fM.uid, { id: tid });
  checar('a família não aceita antes de o parceiro aceitar', !aceiteCedo.ok && aceiteCedo.code === 'failed-precondition', `${aceiteCedo.code}`);
  const respB = await chamar('responderTransferencia', Bt, { id: tid, aceito: true });
  checar('o parceiro B aceita (assinatura fechada)', respB.ok && respB.data.estado === R.ESTADO.PARCEIRO_ACEITOU, respB.message);
  checar('agora a família lê o pedido (familiaVe true)', await ler(fM, `transferenciasDeFamilia/${tid}`) === 200);
  checar('outra família continua sem ler o pedido de M', await ler(fL, `transferenciasDeFamilia/${tid}`) !== 200);
  const avFam = await db.collection('notifications').where('userId', '==', fM.uid).where('transferenciaId', '==', tid).get();
  checar('a família recebeu o aviso do pedido', avFam.size === 1);

  const aceiteOutra = await chamar('aceitarTransferencia', fOutra.uid, { id: tid });
  checar('OUTRA família não aceita o pedido de M', !aceiteOutra.ok && aceiteOutra.code === 'not-found', `${aceiteOutra.code}`);
  const aceiteTio = await chamar('aceitarTransferencia', A, { id: tid });
  checar('o próprio tio A não aceita pela família', !aceiteTio.ok && aceiteTio.code === 'not-found', `${aceiteTio.code}`);

  const ac = await chamar('aceitarTransferencia', fM.uid, { id: tid });
  checar('a família M aceita: nasce a criança nova', ac.ok && !!ac.data.novaCriancaId, ac.message);
  if (ac.ok) {
    const nova = (await db.doc(`children/${ac.data.novaCriancaId}`).get()).data();
    const velha = (await db.doc('children/M').get()).data();
    const fam = (await db.doc(`users/${fM.uid}`).get()).data();
    checar('a nova é do tio B, da mesma família, ativa', nova.adminUid === Bt && nova.parentUid === fM.uid && nova.active === true);
    checar('a nova leva nome, endereço, escola e responsável',
      nova.name === 'Marina Costa' && nova.address === 'Rua das Flores, 100' && nova.school === 'Escola Sol' && nova.parentName === 'Mae M');
    const vazou = R.CAMPOS_QUE_NUNCA_VAO.filter((c) => c in nova && !['status', 'schoolId', 'statusUpdatedAt'].includes(c));
    checar('a nova NÃO leva saúde, foto, dinheiro, contrato, horário nem "sim" da foto', vazou.length === 0, vazou.join(','));
    checar('a nova nasce em casa, com a escola do parceiro casada pelo nome e cobrança só do mês seguinte',
      nova.status === 'home' && nova.schoolId === 'sB1' && nova.primeiroMesCobrado === R.mesSeguinte(agora) && nova.transferidaDe?.childId === 'M');
    checar('a antiga fica inativa com transferidaPara = B', velha.active === false && velha.transferidaPara?.uid === Bt);
    checar('childIds troca a antiga pela nova', fam.childIds.includes(ac.data.novaCriancaId) && !fam.childIds.includes('M'));
    checar('adminUids ganha B (e A sai: sem criança ativa nem dívida)', fam.adminUids.includes(Bt) && !fam.adminUids.includes(A) && fam.adminUid === Bt);
    const fin = (await db.doc(`transferenciasDeFamilia/${tid}`).get()).data();
    checar('o pedido fecha como concluida, apontando a nova', fin.estado === R.ESTADO.CONCLUIDA && fin.novaCriancaId === ac.data.novaCriancaId);
    checar('a família ainda LÊ a criança antiga (rules)', await ler(fM, 'children/M') === 200);
    checar('a família ainda LÊ o contrato da criança antiga', await ler(fM, 'children/M/contratos/1') === 200);
    checar('a família ainda LÊ o pagamento antigo', await ler(fM, 'payments/pgM') === 200);
    checar('a família lê a criança nova', await ler(fM, `children/${ac.data.novaCriancaId}`) === 200);
    const dnv = await chamar('aceitarTransferencia', fM.uid, { id: tid });
    checar('aceitar de novo é recusado (nada duplica)', !dnv.ok);
    const vistaDepois = await chamar('fotosDaComunidade', fM.uid, {});
    checar('depois da passagem, a rede da família é a de B (a chamada funciona)', vistaDepois.ok);
  }

  // Vencido.
  await familia(fN, A, ['N']);
  await crianca('N', fN, A, { name: 'Nina Dias' });
  await db.doc('transferenciasDeFamilia/vencida').set({
    deUid: A, paraUid: Bt, familiaUid: fN.uid, childId: 'N', previa: { primeiroNome: 'Nina', escola: null }, marcaDe: 'Tio Ana', marcaPara: 'Tio Beto',
    estado: R.ESTADO.PARCEIRO_ACEITOU, familiaVe: true, criadoEm: T(agora - 9 * 86400000), expiraEm: T(agora - 86400000),
  });
  const venc = await chamar('aceitarTransferencia', fN.uid, { id: 'vencida' });
  checar('pedido vencido é recusado para a família', !venc.ok && venc.code === 'failed-precondition', `${venc.code} ${venc.message}`);
  const nN = (await db.doc('children/N').get()).data();
  checar('e a criança do pedido vencido continua com A, ativa', nN.adminUid === A && nN.active === true);
  await db.doc('platformConfig/app').set({ cobrancaLigada: false });
  await db.doc('transferenciasDeFamilia/desligada').set({
    deUid: A, paraUid: Bt, familiaUid: fN.uid, childId: 'N', previa: {}, estado: R.ESTADO.PARCEIRO_ACEITOU, familiaVe: true, criadoEm: T(agora), expiraEm: T(agora + 86400000),
  });
  const semLigada = await chamar('aceitarTransferencia', fN.uid, { id: 'desligada' });
  checar('com a cobrança desligada, a família não é passada', !semLigada.ok && semLigada.code === 'failed-precondition', `${semLigada.code}`);

  console.log(`\n${'═'.repeat(64)}\n${ok} passaram, ${bad} falharam`);
  if (falhas.length) console.log(`\nFALHAS:\n - ${falhas.join('\n - ')}`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(2); });
