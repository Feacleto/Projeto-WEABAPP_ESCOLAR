/**
 * Carimba `parentUids` nos avisos de escola que nasceram sem ele.
 *
 * POR QUE ISTO EXISTE
 * O aviso de escola (`agendaEntries` com `scope: 'school'`) não dizia QUEM ele
 * alcançava. A rule de leitura, por isso, só sabia checar `scope == 'school'`
 * — e com isso o responsável de um motorista lia os recados de escola de todos
 * os outros. A filtragem por escola era client-side, e filtro de tela não é
 * permissão.
 *
 * A rule nova exige que o uid do responsável esteja em `parentUids`. Aviso
 * antigo não tem esse campo, e sem ele some do caderno da família — não é
 * vazamento, é história perdida. Este script devolve.
 *
 * A ORDEM É: PUBLIQUE AS REGRAS NOVAS PRIMEIRO.
 *
 *   1. publique as regras novas;
 *   2. rode este script (sem flag: ele conta e mostra o que faria);
 *   3. confira o relatório e rode de novo com `--aplicar`.
 *
 * ISTO AQUI DIZIA O CONTRÁRIO, e o conselho custava caro.
 *
 * A versão anterior mandava rodar com as regras ANTIGAS ainda publicadas,
 * alegando que depois o script "não enxergaria os próprios avisos e reportaria
 * zero, parecendo sucesso". Não é o que acontece: as duas consultas dele já
 * filtram `where('adminUid','==',uid)` (ver `carregarAvisos` e `carregarCriancas`),
 * e a regra nova (`isAppUser() && ehDoMotorista()`) aprova exatamente esse
 * conjunto. Funciona igual antes e depois.
 *
 * O custo do conselho errado era concreto: ele empurrava o operador a MANTER
 * publicada a regra antiga — aquela em que o responsável de um motorista lê os
 * recados de escola de todos os outros — durante todo o tempo do backfill.
 * Segurar uma janela aberta pra proteger um passo que não precisava de
 * proteção.
 *
 * SÓ ESCREVE COM `--aplicar`
 * Sem a flag ele CONTA e mostra o que faria. Backfill que escreve por padrão é
 * como se apaga dado bom: alguém roda "só pra ver".
 *
 *   BACKFILL_EMAIL=motorista@exemplo.com BACKFILL_SENHA=... \
 *     node scripts/backfill-avisos-escola.cjs
 *   BACKFILL_EMAIL=... BACKFILL_SENHA=... node scripts/backfill-avisos-escola.cjs --aplicar
 *
 * COMO ELE DECIDE QUEM ENTRA
 * Casa o `schoolName` do aviso com a escola das crianças DESTE motorista,
 * ignorando pontuação e acento — "E.M. Rui Barbosa" e "EM Rui Barbosa" são a
 * mesma escola, e essa divergência é justamente o motivo de metade das
 * famílias nunca ter recebido o recado.
 *
 * Aviso cuja escola não casa com criança nenhuma fica SEM carimbo e é listado
 * no relatório: melhor um aviso órfão visível no relatório do que um aviso
 * entregue à família errada.
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} = require('firebase/firestore');
const {
  getAuth,
  signInWithEmailAndPassword,
} = require('firebase/auth');

const APLICAR = process.argv.includes('--aplicar');

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

/** Mesma normalização de src/dominio/escola/nomeEscola.js — se mudar lá, muda aqui. */
function chaveDoNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function main() {
  if (!config.projectId) {
    console.error(
      'Faltam as variáveis VITE_FIREBASE_*. Rode com o .env carregado.'
    );
    process.exit(1);
  }
  const email = process.env.BACKFILL_EMAIL;
  const senha = process.env.BACKFILL_SENHA;
  if (!email || !senha) {
    console.error('Defina BACKFILL_EMAIL e BACKFILL_SENHA.');
    process.exit(1);
  }

  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);

  const cred = await signInWithEmailAndPassword(auth, email, senha);
  const uid = cred.user.uid;
  console.log(`\nEntrei como ${email} (${uid})`);
  console.log(APLICAR ? 'MODO: APLICAR\n' : 'MODO: simulação (sem --aplicar)\n');

  // Crianças deste motorista → mapa escola normalizada -> uids dos responsáveis
  const criancas = await getDocs(
    query(collection(db, 'children'), where('adminUid', '==', uid))
  );
  const porEscola = new Map();
  for (const d of criancas.docs) {
    const c = d.data();
    if (c.active === false) continue;
    if (!c.parentUid) continue;
    const chave = chaveDoNome(c.school);
    if (!chave) continue;
    if (!porEscola.has(chave)) porEscola.set(chave, new Set());
    porEscola.get(chave).add(c.parentUid);
  }
  console.log(`${criancas.size} crianças · ${porEscola.size} escolas distintas`);

  const avisos = await getDocs(
    query(collection(db, 'agendaEntries'), where('adminUid', '==', uid))
  );

  const paraCarimbar = [];
  const orfaos = [];
  let jaOk = 0;

  for (const d of avisos.docs) {
    const a = d.data();
    if (a.scope !== 'school') continue;
    if (Array.isArray(a.parentUids) && a.parentUids.length > 0) {
      jaOk += 1;
      continue;
    }
    const uids = porEscola.get(chaveDoNome(a.schoolName));
    if (!uids || uids.size === 0) {
      orfaos.push({ id: d.id, escola: a.schoolName });
      continue;
    }
    paraCarimbar.push({ id: d.id, escola: a.schoolName, uids: [...uids] });
  }

  console.log(`\nAvisos de escola: ${avisos.size} lidos`);
  console.log(`  já com parentUids: ${jaOk}`);
  console.log(`  a carimbar:        ${paraCarimbar.length}`);
  console.log(`  sem escola casada: ${orfaos.length}`);

  for (const o of orfaos) {
    console.log(`    ! ${o.id} — "${o.escola}" não casou com criança nenhuma`);
  }

  if (!paraCarimbar.length) {
    console.log('\nNada a fazer.');
    process.exit(0);
  }

  if (!APLICAR) {
    for (const p of paraCarimbar.slice(0, 10)) {
      console.log(`    · ${p.id} — "${p.escola}" → ${p.uids.length} responsáveis`);
    }
    if (paraCarimbar.length > 10) {
      console.log(`    · … e mais ${paraCarimbar.length - 10}`);
    }
    console.log('\nRode de novo com --aplicar pra gravar.');
    process.exit(0);
  }

  const CHUNK = 400;
  for (let i = 0; i < paraCarimbar.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const p of paraCarimbar.slice(i, i + CHUNK)) {
      batch.update(doc(db, 'agendaEntries', p.id), { parentUids: p.uids });
    }
    await batch.commit();
    console.log(`  gravadas ${Math.min(i + CHUNK, paraCarimbar.length)}/${paraCarimbar.length}`);
  }

  console.log('\nPronto. Agora publique as regras novas.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFalhou:', err.message || err);
  process.exit(1);
});
