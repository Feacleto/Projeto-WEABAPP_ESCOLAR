/**
 * Cria as três contas do teste do Alô Buzinou.
 *
 * QUEM É QUEM — e por que NÃO ficam na mesma conta
 *
 *   DONO       você. Precisa do /admin, que mostra o negócio inteiro:
 *              tamanho da base, dinheiro que passou pelo app, fila de
 *              parceiros, notas e comentários de todo mundo. Hoje ele é um
 *              PAPEL (`role: 'owner'`), não um motorista com flag — e por
 *              isso o script cria só o LOGIN dele. Ver abaixo.
 *
 *   MOTORISTA  seu colega. Opera a perua dele em /tio. NÃO recebe
 *              `superAdmin`, e isso é o ponto: o painel do dono é o seu
 *              negócio, não o dele. Um parceiro que enxerga o GMV da
 *              plataforma e a fila de concorrentes está vendo o que não é
 *              dele.
 *
 *   RESPONSÁVEL  um pai de teste, pra ver o app do outro lado.
 *
 * ATENÇÃO: `role: 'admin'` NÃO quer dizer "dono". No código inteiro ele quer
 * dizer MOTORISTA — é o que `isAdmin()` checa nas regras pra liberar crianças,
 * pagamentos e rotas.
 *
 * O DONO MUDOU, E ESTE SCRIPT NÃO CRIA MAIS O PERFIL DELE
 * Ele era um motorista com `superAdmin: true` por cima. Não é mais: agora é
 * `role: 'owner'`, e `superAdmin` não vale nada — nem no cliente
 * (`ehDono()` em src/utils/papeis.js) nem nas regras (`isOwner()`).
 *
 * O create de `users` só aceita `role == 'admin'`, então criar um dono pelo
 * cliente é impossível por construção — e afrouxar isso pra semear teste
 * seria reabrir a escalada de privilégio que foi fechada. Então o script cria
 * o LOGIN do dono e IMPRIME o passo do console.
 *
 * Preferir imprimir a fingir é o ponto: a versão anterior deste script dizia
 * "DONO criado" e entregava um motorista. Quem fosse testar o /admin caía no
 * /tio sem entender por quê, e ia procurar o defeito no código do painel.
 *
 * A JANELA DO BOOTSTRAP
 * A regra de `users` só permite CREATE quando `role == 'admin'` E
 * `appState/init` não existe — e não restringe os outros campos. É a única
 * fresta em que `superAdmin` pode ser gravado sem console. A janela fica
 * ABERTA enquanto o script cria as duas contas de trabalho, e só fecha no
 * último passo, quando `appState/init` é escrito.
 *
 * `appState/init.adminUid` aponta pro MOTORISTA, não pra você: é esse uid que
 * a vitrine da home usa pra dizer de quem é a perua.
 *
 * O QUE ELE NÃO CONSEGUE FAZER
 * O perfil do RESPONSÁVEL. A regra proíbe criar `users/{uid}` fora do
 * bootstrap do admin, pra todo mundo — foi assim que a escalada de privilégio
 * foi fechada, e não vale afrouxar a regra pra semear dado de teste. Esse
 * passo é no console, e o script imprime o que colar lá.
 *
 * USO
 *   node scripts/criar-contas-teste.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

// ── as três contas ───────────────────────────────────────────────────────
const DONO = {
  email: 'dono.teste@alobuzinou.com',
  senha: 'TesteDono2026!',
  nome: 'Dono da Plataforma',
  telefone: '11999990001',
};

const MOTORISTA = {
  email: 'motorista.teste@alobuzinou.com',
  senha: 'TesteTio2026!',
  nome: 'Motorista Teste',
  telefone: '11999990000',
};

const RESPONSAVEL = {
  email: 'pai.teste@alobuzinou.com',
  senha: 'TestePai2026!',
  nome: 'Responsável Teste',
};

const LEGAL_VERSION = '1.0'; // igual a src/pages/legal/legalContent.js

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

async function criarLogin(apiKey, email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const j = await r.json();

  // Conta já existente não é erro: o script é seguro de rodar de novo.
  if (j.error?.message === 'EMAIL_EXISTS') {
    const r2 = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const j2 = await r2.json();
    if (j2.error) throw new Error(`${email}: já existe e a senha não confere`);
    return { uid: j2.localId, token: j2.idToken, jaExistia: true };
  }

  if (j.error) throw new Error(`${email}: ${j.error.message}`);
  return { uid: j.localId, token: j.idToken, jaExistia: false };
}

async function criarPerfilDeTrabalho(DOCS, conta, sessao, agora) {
  const r = await fetch(`${DOCS}users?documentId=${sessao.uid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessao.token}`,
    },
    body: JSON.stringify({
      fields: {
        // 'admin' aqui significa MOTORISTA — e agora SÓ o motorista passa
        // por aqui. O perfil do dono é `role: 'owner'`, que o create das
        // regras não aceita: ele sai no console, no fim da execução.
        role: { stringValue: 'admin' },
        name: { stringValue: conta.nome },
        email: { stringValue: conta.email },
        phone: { stringValue: conta.telefone },
        // Sem os quatro campos legais o app abre o muro de aceite e não sai.
        termsVersion: { stringValue: LEGAL_VERSION },
        privacyVersion: { stringValue: LEGAL_VERSION },
        termsAcceptedAt: { timestampValue: agora },
        privacyAcceptedAt: { timestampValue: agora },
        createdAt: { timestampValue: agora },
      },
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`perfil de ${conta.email}: ${j.error.message}`);
}

async function main() {
  const env = lerEnv();
  const KEY = env.VITE_FIREBASE_API_KEY;
  const PID = env.VITE_FIREBASE_PROJECT_ID;
  if (!KEY || !PID) throw new Error('Faltam VITE_FIREBASE_* no .env');

  const DOCS = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/`;
  const agora = new Date().toISOString();

  const init = await (await fetch(`${DOCS}appState/init?key=${KEY}`)).json();
  if (!init.error) {
    console.log('\nA janela do bootstrap está FECHADA: já existe administrador.');
    console.log('Pra recriar do zero:');
    console.log('  firebase firestore:delete "appState/init" -f');
    console.log(
      '  firebase firestore:delete "users/' +
        (init.fields?.adminUid?.stringValue || '<uid>') +
        '" -f'
    );
    return;
  }
  console.log('\nappState/init não existe — janela do bootstrap ABERTA.\n');

  // ── 1. dono: SÓ O LOGIN ─────────────────────────────────────────────────
  // O perfil não dá pra criar daqui (o create exige role 'admin'), e criar o
  // dono como motorista seria mentir no fixture — além de sujar a contagem de
  // parceiros do próprio painel que ele vai abrir.
  const d = await criarLogin(KEY, DONO.email, DONO.senha);
  console.log(
    '1) DONO: login pronto' +
      (d.jaExistia ? ' (já existia)' : '') +
      ' — perfil é no console (ver abaixo)'
  );

  // ── 2. motorista ────────────────────────────────────────────────────────
  const m = await criarLogin(KEY, MOTORISTA.email, MOTORISTA.senha);
  await criarPerfilDeTrabalho(DOCS, MOTORISTA, m, agora);
  console.log('2) MOTORISTA criado' + (m.jaExistia ? ' (login já existia)' : ''));

  // ── 3. fecha a janela, apontando pro MOTORISTA ──────────────────────────
  // adminUid é quem a vitrine da home mostra como parceiro — o colega, não você.
  const st = await (
    await fetch(`${DOCS}appState?documentId=init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${m.token}`,
      },
      body: JSON.stringify({
        fields: {
          hasAdmin: { booleanValue: true },
          adminUid: { stringValue: m.uid },
          createdAt: { timestampValue: agora },
        },
      }),
    })
  ).json();
  if (st.error) throw new Error('appState/init: ' + st.error.message);
  console.log('3) appState/init → aponta pro MOTORISTA (é ele que a home mostra)');

  // ── 4. responsável: só o login ──────────────────────────────────────────
  const p = await criarLogin(KEY, RESPONSAVEL.email, RESPONSAVEL.senha);
  console.log('4) RESPONSÁVEL: login pronto' + (p.jaExistia ? ' (já existia)' : ''));

  const L = '─'.repeat(66);
  console.log('\n' + L);
  console.log('DONO — /admin e também /tio');
  console.log('  ' + DONO.email + '   ' + DONO.senha);
  console.log('  uid: ' + d.uid);
  console.log('');
  console.log('MOTORISTA (seu colega) — só /tio');
  console.log('  ' + MOTORISTA.email + '   ' + MOTORISTA.senha);
  console.log('  uid: ' + m.uid);
  console.log('');
  console.log('RESPONSÁVEL — /pai (falta o perfil, ver abaixo)');
  console.log('  ' + RESPONSAVEL.email + '   ' + RESPONSAVEL.senha);
  console.log('  uid: ' + p.uid);
  console.log(L);

  console.log('\nFALTAM DOIS PASSOS, E OS DOIS SO DAO NO CONSOLE');
  console.log('');
  console.log('1) O PERFIL DO DONO - sem ele, este login NAO abre o /admin.');
  console.log('   O create de users so aceita role admin, entao o papel de');
  console.log('   dono nao se cria pelo cliente. E por construcao: foi assim');
  console.log('   que a auto-promocao a dono foi fechada.');
  console.log('');
  console.log('   Firestore > users > Add document > ID = ' + d.uid);
  console.log('       role              string     owner');
  console.log('       name              string     ' + DONO.nome);
  console.log('       email             string     ' + DONO.email);
  console.log('       phone             string     ' + DONO.telefone);
  console.log('       termsVersion      string     ' + LEGAL_VERSION);
  console.log('       privacyVersion    string     ' + LEGAL_VERSION);
  console.log('       termsAcceptedAt   timestamp  agora');
  console.log('       privacyAcceptedAt timestamp  agora');
  console.log('       createdAt         timestamp  agora');
  console.log('');
  console.log('   NAO ponha superAdmin: ele nao vale mais nada, nem no app');
  console.log('   nem nas regras. Quem manda e o papel role: owner.');
  console.log('');
  console.log('2) O PERFIL DO RESPONSAVEL');
  console.log('   Mesmo motivo: as regras proibem criar users/{uid} fora do');
  console.log('   bootstrap, e nao vale afrouxar pra semear dado de teste.');
  console.log('');
  console.log('  a) entre como MOTORISTA e cadastre uma criança; anote o ID');
  console.log('  b) Firestore > users > Add document > ID = ' + p.uid);
  console.log('       role             string     parent');
  console.log('       childIds         array      [ <ID da criança> ]');
  console.log('       childId          string     <ID da criança>');
  console.log('       name             string     ' + RESPONSAVEL.nome);
  console.log('       email            string     ' + RESPONSAVEL.email);
  console.log('       termsVersion     string     ' + LEGAL_VERSION);
  console.log('       privacyVersion   string     ' + LEGAL_VERSION);
  console.log('       termsAcceptedAt  timestamp  agora');
  console.log('  c) Firestore > children/<ID> > parentUid = ' + p.uid);
  console.log('                                 inviteStatus = used');
  console.log('');
  console.log('Ver TESTES.md pro formato das mensalidades de exemplo.');
}

main().catch((e) => {
  console.error('\nFALHOU: ' + e.message);
  process.exit(1);
});
