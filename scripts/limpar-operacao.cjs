/**
 * Zera a OPERAÇÃO do banco, preservando quem entra no app.
 *
 * O QUE ELE APAGA
 * Tudo que o dia a dia produz: crianças, pagamentos e a trilha deles, rotas,
 * planos de rota, agenda, avisos de escola, ausências, caronas alternativas,
 * chamadas pendentes, notificações, posição ao vivo, despesas, depoimentos,
 * bônus da roleta e as filas de espera.
 *
 * O QUE ELE PRESERVA, E POR QUÊ
 *   users/      os perfis. Sem eles, quem loga vira "conta sem perfil" e o
 *               app não sabe quem é — o dono perde o /admin e o motorista
 *               perde o /tio, sem caminho de volta dentro do app.
 *   appState/   a flag de bootstrap. Apagar reabre o /first-admin, e aí o
 *               próximo visitante que abrir aquela URL vira administrador.
 *
 * Ou seja: depois de rodar isto, o banco fica como no primeiro dia, mas as
 * contas continuam entrando e dá pra cadastrar do zero.
 *
 * PRA APAGAR TAMBÉM OS PERFIS: --tudo
 * Aí é sério — o acesso ao app some junto, e voltar exige refazer o bootstrap
 * pelo /first-admin. O script pede confirmação digitada.
 *
 * COMO ELE APAGA
 * Autenticado como MOTORISTA e como DONO, porque as regras dividem o que cada
 * um alcança: operação é do motorista, fila de parceiros e depoimento são do
 * dono. Documento que nenhum dos dois alcança é reportado, não escondido —
 * um "apaguei tudo" que deixou resto para trás é pior que um relatório
 * honesto de que sobrou.
 *
 * USO
 *   node scripts/limpar-operacao.cjs            simula
 *   node scripts/limpar-operacao.cjs --aplicar  apaga
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const RAIZ = path.resolve(__dirname, '..');
const APLICAR = process.argv.includes('--aplicar');
const TUDO = process.argv.includes('--tudo');

/** Operação: some tudo. */
const OPERACAO = [
  'children',
  'payments',
  'absenceDeclarations',
  'agendaEntries',
  'altPickups',
  'dailyRoutes',
  'liveLocation',
  'notifications',
  'pendingCalls',
  'routePlans',
  'schoolBroadcasts',
  'expenses',
  'feedbacks',
  'entryBonuses',
  'waitlistDrivers',
  'waitlistParents',
];

/** Acesso: só com --tudo. */
const ACESSO = ['users', 'appState'];

function lerEnv() {
  const bruto = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
  const env = {};
  for (const l of bruto.split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return env;
}

const env = lerEnv();
const KEY = env.VITE_FIREBASE_API_KEY;
const PID = env.VITE_FIREBASE_PROJECT_ID;
const D = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents`;

const CONTAS = [
  { rotulo: 'motorista', email: 'motorista.teste@alobuzinou.com', senha: 'TesteTio2026!' },
  { rotulo: 'dono', email: 'dono.teste@alobuzinou.com', senha: 'TesteDono2026!' },
];

async function entrar({ email, senha }) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (j.error) return null;
  return j.idToken;
}

/** Lista os documentos de uma coleção com o primeiro token que conseguir ler. */
async function listar(colecao, tokens) {
  for (const { rotulo, token } of tokens) {
    const r = await fetch(`${D}/${colecao}?pageSize=300`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const j = await r.json();
      return { docs: (j.documents || []).map((d) => d.name), via: rotulo };
    }
  }
  return { docs: null, via: null };
}

async function apagar(nome, tokens) {
  for (const { token } of tokens) {
    const r = await fetch(`https://firestore.googleapis.com/v1/${nome}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) return true;
  }
  return false;
}

function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

async function main() {
  const tokens = [];
  for (const c of CONTAS) {
    const t = await entrar(c);
    if (t) tokens.push({ rotulo: c.rotulo, token: t });
  }
  if (tokens.length === 0) throw new Error('nenhuma conta de teste conseguiu entrar');

  console.log(`\nAlvo: PRODUÇÃO (${PID})`);
  console.log(`Autenticado como: ${tokens.map((t) => t.rotulo).join(' e ')}`);
  console.log(APLICAR ? '\nMODO: APAGAR DE VERDADE\n' : '\nMODO: simulação (use --aplicar)\n');

  const colecoes = TUDO ? [...OPERACAO, ...ACESSO] : OPERACAO;

  if (TUDO && APLICAR) {
    console.log('--tudo inclui `users` e `appState`.');
    console.log('Isso REMOVE O ACESSO AO APP: o dono perde o /admin, o');
    console.log('motorista perde o /tio, e voltar exige refazer o bootstrap');
    console.log('pelo /first-admin.\n');
    const r = await perguntar('Digite APAGAR TUDO para confirmar: ');
    if (r.trim() !== 'APAGAR TUDO') {
      console.log('\nCancelado. Nada foi apagado.');
      return;
    }
    console.log('');
  }

  let apagados = 0;
  let restaram = 0;

  for (const col of colecoes) {
    const { docs, via } = await listar(col, tokens);
    if (docs === null) {
      console.log(`  ${col.padEnd(22)} sem permissão de leitura — NÃO VERIFICADA`);
      continue;
    }
    if (docs.length === 0) continue;

    if (!APLICAR) {
      console.log(`  ${col.padEnd(22)} ${docs.length} documento(s) seriam apagados (via ${via})`);
      apagados += docs.length;
      continue;
    }

    let ok = 0;
    let falhou = 0;
    for (const nome of docs) {
      if (await apagar(nome, tokens)) ok += 1;
      else falhou += 1;
    }
    apagados += ok;
    restaram += falhou;
    console.log(
      `  ${col.padEnd(22)} ${ok} apagado(s)` + (falhou ? `, ${falhou} RECUSADO(S)` : '')
    );
  }

  console.log('');
  if (!APLICAR) {
    console.log(`Simulação: ${apagados} documento(s) seriam apagados.`);
    console.log('Pra valer: node scripts/limpar-operacao.cjs --aplicar');
  } else {
    console.log(`${apagados} documento(s) apagados.`);
    if (restaram > 0) {
      console.log(`${restaram} RECUSADO(S) pelas regras — precisam do console.`);
    }
    if (!TUDO) {
      console.log('\n`users` e `appState` preservados: as contas continuam entrando.');
    }
  }
}

main().catch((e) => {
  console.error('\nFALHOU: ' + e.message);
  process.exit(1);
});
