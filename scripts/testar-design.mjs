/**
 * O design system — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:design
 *
 * POR QUE ISTO EXISTE
 * Em 02/10/2026 o site e o app tinham virado dois produtos: outra fonte,
 * outros cinzas, outro botão, outro verde para o mesmo rótulo. Ninguém
 * decidiu isso — cada lado escolheu um valor no dia em que precisou, e os
 * dois nunca eram lidos juntos. O docs/design-system.md conta as nove
 * diferenças e a decisão de cada uma.
 *
 * Este teste trava o que impede a separação de voltar:
 *   1. as duas cópias em CSS são exatamente o que o tailwind.config.js gera;
 *   2. app e site carregam as mesmas fontes, e ninguém volta para a Inter;
 *   3. o site não declara cor própria por cima dos tokens;
 *   4. nenhuma letra do app fica abaixo de 12px (o público tem 40+), com as
 *      exceções nomeadas uma a uma e com motivo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from '../tailwind.config.js';
import { montarTokensCss, APELIDOS } from './tokens-css.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (passou) ok++;
  else {
    bad++;
    falhas.push(`${nome}\n      esperado: ${JSON.stringify(esperado)}\n      obtido:   ${JSON.stringify(obtido)}`);
  }
  console.log(`  ${passou ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}`);
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

function arquivos(dir, ext) {
  const out = [];
  for (const nome of readdirSync(join(raiz, dir))) {
    const p = join(raiz, dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(relative(raiz, p), ext));
    else if (ext.some((e) => nome.endsWith(e))) out.push(relative(raiz, p).replace(/\\/g, '/'));
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────── */
bloco('1 · AS CÓPIAS SÃO O QUE A FONTE GERA');
const gerado = montarTokensCss(cfg);
const normal = (t) => t.replace(/\r\n/g, '\n');
for (const copia of ['src/design/tokens.css', 'landing/tokens.css']) {
  checar(`${copia} está igual ao tailwind.config.js (rode \`npm run tokens\`)`, true, normal(ler(copia)) === gerado);
}
checar('todo apelido do site aponta para um token que existe', [],
  Object.entries(APELIDOS).filter(([, t]) => typeof cfg.theme.extend.colors[t] !== 'string').map(([a]) => a));
checar('o index.css importa os tokens antes de tudo', true,
  /^(\/\*[\s\S]*?\*\/\s*)*@import '\.\/design\/tokens\.css';/.test(ler('src/index.css')));

/* ─────────────────────────────────────────────────────────────── */
bloco('2 · AS MESMAS FONTES NOS DOIS LADOS (D1)');
const fam = cfg.theme.extend.fontFamily;
checar('o corpo do app é Instrument Sans', '"Instrument Sans"', fam.sans[0]);
checar('o título do app é Bricolage Grotesque', '"Bricolage Grotesque"', fam.display[0]);
const linkDasFontes = (h) => /family=Bricolage\+Grotesque[^"]*family=Instrument\+Sans/.test(h);
checar('o index.html do app carrega as duas', true, linkDasFontes(ler('index.html')));
checar('a home do site carrega as duas', true, linkDasFontes(ler('landing/index.html')));
checar('o molde das páginas carrega as duas', true, linkDasFontes(ler('scripts/gerar-paginas-do-site.py')));
const comInter = [...arquivos('src', ['.js', '.jsx', '.css']), 'index.html']
  .filter((f) => /(['"\s,(])Inter(['"\s,:])/.test(ler(f)));
checar('ninguém volta para a Inter', [], comInter);

/* ─────────────────────────────────────────────────────────────── */
bloco('3 · O SITE LÊ OS TOKENS E NÃO DECLARA OS PRÓPRIOS');
const paginas = readdirSync(join(raiz, 'landing')).filter((f) => f.endsWith('.html'));
checar('toda página do site carrega /tokens.css', [],
  paginas.filter((f) => !ler(`landing/${f}`).includes('href="/tokens.css"')));
checar('nas páginas, /tokens.css vem antes de /paginas.css', [],
  paginas.filter((f) => {
    const h = ler(`landing/${f}`);
    return h.includes('/paginas.css') && h.indexOf('/tokens.css') > h.indexOf('/paginas.css');
  }));
// Um `--verde:` declarado no site é o começo de um segundo valor para a mesma
// cor — exatamente como a separação começou.
const redeclara = (css) =>
  Object.keys(APELIDOS).filter((a) => new RegExp(`--${a}\\s*:`).test(css));
const estiloDaHome = ler('landing/index.html').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
checar('a home do site não redeclara token', [], redeclara(estiloDaHome));
checar('o paginas.css não redeclara token', [], redeclara(ler('landing/paginas.css')));
checar('o detector pega a redeclaração (sonda positiva)', ['verde'], redeclara(':root{ --verde:#123456 }'));

/* ─────────────────────────────────────────────────────────────── */
bloco('4 · O PISO DE 12PX (D2)');
// AS EXCEÇÕES, e o motivo de cada uma. Arquivo novo NÃO entra aqui por padrão.
const EXCECOES = {
  'src/components/admin/ContratoDoc.jsx': 'é impresso em A4, lido a 30cm numa folha, não numa tela',
  'src/components/auth/FundoDoLogin.jsx': 'cartões decorativos atrás do formulário; testar:fundo mede a geometria deles',
  'src/components/landing/BlockArt.jsx': 'ilustração, não texto de leitura',
};
const PEQUENO = /text-\[(\d+(?:\.\d+)?)px\]/g;
const abaixoDoPiso = (t) => [...t.matchAll(PEQUENO)].filter((m) => Number(m[1]) < 12).map((m) => m[0]);
const culpados = arquivos('src', ['.jsx', '.js'])
  .filter((f) => !EXCECOES[f])
  .filter((f) => abaixoDoPiso(ler(f)).length)
  .map((f) => `${f}: ${[...new Set(abaixoDoPiso(ler(f)))].join(' ')}`);
checar('nenhuma letra do app abaixo de 12px', [], culpados);
checar('as exceções ainda existem (senão saem da lista)', [],
  Object.keys(EXCECOES).filter((f) => { try { ler(f); return false; } catch { return true; } }));
checar('o detector pega 11px (sonda positiva)', ['text-[11px]'], abaixoDoPiso('className="text-[11px] text-[13px]"'));

/* ─────────────────────────────────────────────────────────────── */
bloco('5 · AS PEÇAS QUE O SISTEMA FIXOU');
const botao = ler('src/components/common/Button.jsx');
checar('o botão de perigo usa dangerText de fundo (branco sobre danger dava 3,8:1)', true,
  /danger:\s*\n?\s*'bg-dangerText text-white/.test(botao));
const selo = ler('src/components/children/StatusBadge.jsx');
checar('"na perua" é âmbar, como o pino da perua', true, /onboard:[^\n]*bg-warningChip text-warningText/.test(selo));
checar('"na escola" é violeta, como o pino da escola', true, /atSchool:[^\n]*bg-escolaChip text-escola/.test(selo));
const r = cfg.theme.extend.borderRadius;
checar('os quatro cantos: 10, 14, 20, 28', ['10px', '14px', '20px', '28px'], [r.lg, r.xl, r['2xl'], r['3xl']]);
const d = cfg.theme.extend.transitionDuration;
checar('nenhuma duração passa de meio segundo', [], Object.entries(d).filter(([, v]) => parseInt(v, 10) > 500).map(([k]) => k));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
