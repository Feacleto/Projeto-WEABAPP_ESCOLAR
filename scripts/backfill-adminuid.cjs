/**
 * Carimba `adminUid` nas crianças e nos pagamentos que nasceram sem dono.
 *
 * POR QUE ISTO EXISTE
 * `children` e `payments` não guardavam de qual motorista eram. As regras
 * liberavam qualquer `isAdmin()` a ler e escrever qualquer documento das duas
 * coleções — com um parceiro só ninguém via, no segundo cada um passaria a
 * ler o endereço e o telefone das famílias do outro, e a dar baixa no dinheiro
 * alheio. As regras novas fecham isso comparando `adminUid` com quem está
 * pedindo. Documento antigo não tem esse campo, e sem ele fica invisível pro
 * próprio dono.
 *
 * A ORDEM IMPORTA, E ELA NÃO PERDOA
 *
 *   1. rode este script (as regras ANTIGAS ainda estão publicadas, e é
 *      justamente por isso que ele consegue escrever);
 *   2. confira o relatório;
 *   3. só então publique as regras novas.
 *
 * Invertido, você tranca o motorista fora das próprias crianças: as regras
 * novas exigem o campo que o backfill ainda não escreveu, e o painel abre
 * vazio. O caminho de volta existe (republicar as antigas), mas o susto é
 * real e acontece no ar.
 *
 * SÓ ESCREVE COM `--aplicar`
 * Sem a flag ele apenas CONTA e mostra o que faria. Backfill que escreve por
 * padrão é como se apaga dado bom: alguém roda "só pra ver".
 *
 * DE ONDE VEM O UID
 * Do login que você passar — o dono do dado é quem opera. Hoje existe um
 * motorista real, então é a conta dele:
 *
 *   BACKFILL_EMAIL=motorista@exemplo.com BACKFILL_SENHA=... \
 *     node scripts/backfill-adminuid.cjs
 *   BACKFILL_EMAIL=... BACKFILL_SENHA=... node scripts/backfill-adminuid.cjs --aplicar
 *
 * COM MAIS DE UM MOTORISTA JÁ OPERANDO, NÃO USE ISTO.
 * Ele carimba TUDO com o mesmo uid, o que resolveria o caso de um e
 * entregaria as crianças de um parceiro pro outro. Nesse cenário o vínculo
 * tem que ser decidido documento a documento, e isso não é trabalho de script
 * genérico. O script recusa sozinho: ele conta os motoristas antes.
 *
 * EMULADOR: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
 * FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` — os endereços mudam sozinhos.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const APLICAR = process.argv.includes('--aplicar');

function lerEnv() {
  const bruto = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
  const env = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const i = linha.indexOf('=');
    if (i > 0 && !linha.trim().startsWith('#')) {
      env[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return env;
}

/** Endereços de produção, ou do emulador quando as variáveis existem. */
function endereços(projectId) {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return {
    docs: fsHost
      ? `http://${fsHost}/v1/projects/${projectId}/databases/(default)/documents/`
      : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`,
    identity: authHost
      ? `http://${authHost}/identitytoolkit.googleapis.com/v1/`
      : 'https://identitytoolkit.googleapis.com/v1/',
    emulando: !!fsHost,
  };
}

async function entrar(identity, apiKey, email, senha) {
  const r = await fetch(`${identity}accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`login de ${email}: ${j.error.message}`);
  return { uid: j.localId, token: j.idToken };
}

/** Lista uma coleção inteira, seguindo a paginação. */
async function listar(docs, token, colecao) {
  const out = [];
  let pageToken = '';
  do {
    const url =
      `${docs}${colecao}?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.error) throw new Error(`listar ${colecao}: ${j.error.message}`);
    for (const d of j.documents || []) out.push(d);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

/** Escreve UM campo, sem tocar no resto do documento (updateMask). */
async function carimbar(docs, token, nomeCompleto, uid) {
  const caminho = nomeCompleto.split('/documents/')[1];
  const r = await fetch(
    `${docs}${caminho}?updateMask.fieldPaths=adminUid`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields: { adminUid: { stringValue: uid } } }),
    }
  );
  const j = await r.json();
  if (j.error) throw new Error(`${caminho}: ${j.error.message}`);
}

function semDono(doc) {
  const v = doc.fields?.adminUid?.stringValue;
  return !v;
}

async function main() {
  const env = lerEnv();
  const KEY = env.VITE_FIREBASE_API_KEY;
  const PID = env.VITE_FIREBASE_PROJECT_ID;
  if (!KEY || !PID) throw new Error('Faltam VITE_FIREBASE_* no .env');

  const email = process.env.BACKFILL_EMAIL;
  const senha = process.env.BACKFILL_SENHA;
  if (!email || !senha) {
    console.error(
      'Faltam as credenciais do MOTORISTA dono do dado.\n' +
        '  BACKFILL_EMAIL=... BACKFILL_SENHA=... node scripts/backfill-adminuid.cjs'
    );
    process.exit(1);
  }

  const { docs, identity, emulando } = endereços(PID);
  console.log(`\nAlvo: ${emulando ? 'EMULADOR' : 'PRODUÇÃO'} (${PID})`);

  const sessao = await entrar(identity, KEY, email, senha);
  console.log(`Autenticado como ${email}\n  uid: ${sessao.uid}`);

  // TRAVA DE SEGURANÇA: com dois motoristas, carimbar tudo com um uid só
  // entregaria as crianças de um pro outro. Melhor recusar que adivinhar.
  //
  // MAS O DONO NÃO É UM MOTORISTA, mesmo carregando `role: 'admin'`.
  //
  // A conta do dono ainda é `role: 'admin'` + `superAdmin: true`, porque
  // migrar pra `role: 'owner'` exige console e ele não tem esse caminho. Sem
  // descontar, a trava contava 2 e recusava — protegendo contra um segundo
  // parceiro que não existe, e travando o backfill de que a base precisa.
  //
  // É o mesmo desconto que `contaParceiros()` faz nas métricas do painel, e
  // pelo mesmo motivo: `role: 'admin'` responde "opera uma perua?", e o dono
  // responde sim por acidente de modelagem, não por operar alguma.
  const usuarios = await listar(docs, sessao.token, 'users');
  const ehDono = (u) =>
    u.fields?.role?.stringValue === 'owner' ||
    u.fields?.superAdmin?.booleanValue === true;
  const motoristas = usuarios.filter(
    (u) => u.fields?.role?.stringValue === 'admin' && !ehDono(u)
  );
  if (motoristas.length > 1) {
    console.error(
      `\nRECUSADO: existem ${motoristas.length} motoristas nesta base.\n` +
        'Este script carimba tudo com um uid só, então ele entregaria as\n' +
        'crianças de um parceiro pro outro. O vínculo aqui precisa ser\n' +
        'decidido documento a documento — no console, ou num script feito\n' +
        'pra essa base específica.'
    );
    process.exit(1);
  }

  let total = 0;
  for (const colecao of ['children', 'payments']) {
    const todos = await listar(docs, sessao.token, colecao);
    const pendentes = todos.filter(semDono);
    total += pendentes.length;
    console.log(
      `\n${colecao}: ${todos.length} documento(s), ${pendentes.length} sem adminUid`
    );

    if (!APLICAR) continue;
    for (const d of pendentes) {
      await carimbar(docs, sessao.token, d.name, sessao.uid);
    }
    if (pendentes.length) console.log(`  carimbados com ${sessao.uid}`);
  }

  if (!APLICAR) {
    console.log(
      total
        ? `\nSimulação: ${total} documento(s) seriam carimbados.` +
            '\nPra aplicar de verdade: node scripts/backfill-adminuid.cjs --aplicar'
        : '\nNada a fazer — todos os documentos já têm dono.'
    );
  } else {
    console.log(`\nPronto. ${total} documento(s) carimbados.`);
    console.log('Agora sim: firebase deploy --only firestore:rules');
  }
}

main().catch((e) => {
  console.error('\nFALHOU:', e.message);
  process.exit(1);
});
