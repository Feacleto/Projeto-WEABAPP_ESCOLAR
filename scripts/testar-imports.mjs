/**
 * A BATERIA CHEGA AO FIM NUM CHECKOUT LIMPO — e este arquivo é o que prova.
 *
 * ── POR QUE ELE EXISTE
 * `scripts/testar-gateway.mjs` importava `functions/lib/contratacao.js`, cuja
 * primeira linha é `require('firebase-functions/v2/https')`.
 * `firebase-functions` só existe em `functions/node_modules` — que não é
 * rastreado pelo git —, e o CI roda **um** `npm ci` na raiz.
 *
 * Medido em 09/09/2026, simulando o CI: `node scripts/testar-gateway.mjs`
 * morria com `Cannot find module 'firebase-functions/v2/https'`, exit 1. E como
 * `npm run testar` encadeia os scripts com `&&`, ele parava no 15º de 26 — os
 * **11 seguintes nunca rodaram no CI**: carteira, proposta, chamados, risco,
 * fila, concessao, selo, indicacao, origem, abas, transacoes.
 *
 * A aposta central deste projeto é "regra pura, provada por script Node puro".
 * Ela estava com o fio cortado no meio, e **nada acusava** — na máquina de quem
 * desenvolve tudo passava, porque ali `functions/node_modules` existe.
 *
 * ⚠️ Teste que não roda é PIOR que teste nenhum: ele ocupa o lugar dele. Um
 * arquivo com 98 casos verdes na máquina local e zero execução no CI é uma
 * garantia que não existe, com a aparência de uma que existe.
 *
 * ── O QUE ELE AFIRMA
 * Que nenhum módulo alcançável pelos scripts da bateria requer o SDK do
 * Firebase. Não é uma checagem de estilo: é a diferença entre a bateria rodar
 * inteira no CI e parar no meio sem ninguém ver.
 *
 * A regra que ele estabelece: **módulo de `functions/lib/` que é RÉGUA não faz
 * `require` de `firebase-admin` nem de `firebase-functions`.** Quem precisa do
 * SDK é o `onCall`/`onSchedule`/`onRequest`, e ele mora noutro arquivo. Sete dos
 * 21 módulos já obedeciam por acidente — e eram exatamente os sete que os
 * testes conseguiam importar.
 *
 * ── POR QUE ESTÁTICO, E NÃO "TENTA IMPORTAR E VÊ"
 * Tentar importar aqui teria o mesmo defeito do problema original: passaria na
 * máquina de quem tem `functions/node_modules` e falharia só no CI. Ler o TEXTO
 * dos arquivos dá a mesma resposta nos dois lugares — que é a propriedade que
 * este arquivo precisa ter para valer alguma coisa.
 *
 * COMO RODAR
 *   node scripts/testar-imports.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');

/**
 * Os pacotes que EXISTEM SÓ em `functions/node_modules`.
 *
 * ⚠️ Mantenha em par com as `dependencies` de `functions/package.json`. Um
 * pacote novo lá que um módulo de régua venha a requerer reabre exatamente o
 * buraco que este arquivo fecha.
 */
const SO_NO_FUNCTIONS = [
  'firebase-functions',
  'firebase-admin',
  '@google-cloud',
];

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, condicao, detalhe = '') {
  if (condicao) {
    ok += 1;
    console.log(`  ok   ${nome}`);
  } else {
    bad += 1;
    falhas.push(`${nome}${detalhe ? ' — ' + detalhe : ''}`);
    console.log(`  FALHA ${nome}`);
    if (detalhe) console.log(`        ${detalhe}`);
  }
}

/** Remove comentários e strings — menção em prosa não é dependência. */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

function resolver(de, spec) {
  if (!spec.startsWith('.')) return null;
  const p = path.join(path.dirname(de), spec);
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (existsSync(p + '.js')) return p + '.js';
  return null;
}

/** Todo módulo local que um script alcança, transitivamente. */
function alcancados(entrada) {
  const vistos = new Set();
  const fila = [entrada];
  while (fila.length) {
    const f = fila.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    let t;
    try { t = readFileSync(f, 'utf8'); } catch { continue; }
    const limpo = semComentarios(t);
    for (const m of limpo.matchAll(/(?:from|require)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const r = resolver(f, m[1]);
      if (r) fila.push(r);
    }
  }
  vistos.delete(entrada);
  return [...vistos];
}

/** Os pacotes externos que um arquivo requer. */
function externosDe(arquivo) {
  const limpo = semComentarios(readFileSync(arquivo, 'utf8'));
  const fora = new Set();
  for (const m of limpo.matchAll(/(?:from|require)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('node:')) continue;
    fora.add(spec);
  }
  return [...fora];
}

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

console.log('\n═══ OS SCRIPTS DA BATERIA RODAM NUM CHECKOUT LIMPO ═══\n');

// A bateria REAL, lida do `package.json` — e não uma lista escrita à mão aqui,
// que envelheceria em silêncio.
const pkg = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const naBateria = pkg.scripts.testar
  .split('&&')
  .map((x) => x.trim().replace(/^npm run /, ''))
  .map((nome) => pkg.scripts[nome])
  .filter(Boolean)
  .map((cmd) => cmd.replace(/^node\s+/, '').trim());

checar('a bateria foi lida do package.json', naBateria.length > 0,
  'nenhum script encontrado — o formato do `testar` mudou e este teste ficou cego');

for (const script of naBateria) {
  const entrada = path.join(RAIZ, script);
  if (!existsSync(entrada)) {
    checar(`${script} existe`, false, 'está no package.json e não no disco — a CI quebra aqui');
    continue;
  }
  const modulos = alcancados(entrada);
  const proibidos = [];
  for (const m of modulos) {
    for (const ext of externosDe(m)) {
      if (SO_NO_FUNCTIONS.some((p) => ext === p || ext.startsWith(p + '/'))) {
        proibidos.push(`${rel(m)} requer '${ext}'`);
      }
    }
  }
  checar(
    `${path.basename(script)} não alcança o SDK do Firebase`,
    proibidos.length === 0,
    proibidos.join(' · ')
  );
}

// ── A SONDA POSITIVA ────────────────────────────────────────────────────────
//
// Sem ela, este arquivo fica verde no dia em que o casamento de imports parar
// de funcionar (um `await import()` dinâmico, um alias novo) e NENHUM módulo
// for encontrado. Verde por não ter medido nada é o defeito que este arquivo
// existe para combater.
console.log('\n─── o detector detecta ───');
{
  const gateway = path.join(RAIZ, 'scripts/testar-gateway.mjs');
  const modulos = alcancados(gateway);
  checar('o testar-gateway alcança módulos de functions/',
    modulos.some((m) => rel(m).startsWith('functions/lib/')),
    'o seguidor de imports não achou nada em functions/ — ele parou de funcionar');
  checar('e alcança módulos de src/',
    modulos.some((m) => rel(m).startsWith('src/')));
}
{
  // E um arquivo que SABIDAMENTE requer o SDK tem que ser detectado. Se este
  // caso passar a falhar, o detector cegou.
  const comSdk = path.join(RAIZ, 'functions/lib/contratacao.js');
  checar('um módulo com o SDK é reconhecido como tal',
    externosDe(comSdk).some((e) => e.startsWith('firebase-functions')),
    'contratacao.js deveria requerer firebase-functions e o detector não viu');
}

// ── TODO SCRIPT DE TESTE TEM PORTA ──────────────────────────────────────────
//
// Script de teste fora do `package.json` é teste que ninguém roda — e ninguém
// sabe se ainda passa. Dois existiam nessa situação em 09/09/2026.
console.log('\n─── todo scripts/testar-*.mjs está na bateria ───');
{
  const noDisco = readdirSync(path.join(RAIZ, 'scripts'))
    .filter((f) => f.startsWith('testar-') && f.endsWith('.mjs'));
  // Os que ficam FORA de propósito, com o motivo. Lista nomeada, não padrão:
  // exceção sem razão vira permissão.
  const foraDePropósito = {
    'testar-regras.mjs': 'precisa do emulador do Firestore',
    'testar-storage.mjs': 'precisa dos emuladores auth+firestore+storage',
    'testar-avatar.mjs': 'bate na API do DiceBear — precisa de rede',
    'testar-navegador.mjs': 'precisa de navegador',
    'testar-imports.mjs': 'é este arquivo',
  };
  const orfaos = noDisco.filter(
    (f) => !naBateria.some((s) => s.endsWith(f)) && !foraDePropósito[f]
  );
  checar('nenhum script de teste ficou órfão', orfaos.length === 0,
    orfaos.length ? `sem porta no package.json: ${orfaos.join(', ')}` : '');
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('────────────────────────────────────────────────────────────────');
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log('════════════════════════════════════════════════════════════════\n');
process.exit(bad > 0 ? 1 : 0);
