/**
 * A CENTRAL VIROU CARTEIRA (05/10/2026, decisão do dono).
 *
 *   node scripts/testar-nome-da-carteira.mjs
 *   (ou: npm run testar:nome-da-carteira)
 *
 * O nome pensa no futuro financeiro do app, e veio com duas condições:
 *
 *   1. Na rota a aba NÃO se chama Carteira: chama "Rota". Ali quem olha é a
 *      auxiliar, e o que ela vê é a rota.
 *   2. Enquanto o app não guarda dinheiro, a tela não sugere que guarda: nada
 *      de saldo, depositar/depósito, sacar/saque, transferir/transferência,
 *      rendimento. O número grande diz o que é ("Sobrou em outubro").
 *
 * ⚠️ "TRANSFERÊNCIA" TAMBÉM É O NOME DA PASSAGEM DE FAMÍLIA ENTRE TIOS
 * (src/components/transferencia/, "Passar para outro tio") — isso não é
 * dinheiro e NÃO pode ser reprovado. Por isso a varredura das palavras de
 * banco vale só para a ÁRVORE DA CARTEIRA: TioFinance.jsx e os componentes
 * que ela importa direto. Ela não varre `src/` inteiro, o bloco 1 exige que
 * nenhum arquivo de `components/transferencia/` entre na árvore, e uma sonda
 * prova que o detector PEGARIA a palavra lá — a exclusão é por escopo, não
 * por cegueira do detector.
 *
 * Texto visível = literais de string e texto de JSX, sem comentário (é no
 * comentário que a proibição é explicada) e sem identificador (`saldo` como
 * nome de variável não aparece na tela).
 *
 * Nomes internos FICAM: rotas `/tio/finance…`, `AuxiliarNaCentral`, âncoras
 * do tour (`nav-finance`, `nav-rota`). Renomear rota quebra link salvo.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else {
    bad++;
    falhas.push(nome);
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8');
const rel = (abs) => relative(RAIZ, abs).split('\\').join('/');

/* ─────────────────────────── o extrator ─────────────────────────── */

/** Tira comentário de bloco, de JSX ({/* *\/}) e de linha (sem pegar `://`). */
function semComentarios(fonte) {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');
}

/** Só a parte literal de um template: `${...}` é código, não texto. */
function semExpressoes(template) {
  let out = '';
  for (let i = 0; i < template.length; i++) {
    if (template[i] === '$' && template[i + 1] === '{') {
      let fundo = 0;
      for (i += 1; i < template.length; i++) {
        if (template[i] === '{') fundo++;
        else if (template[i] === '}' && --fundo === 0) break;
      }
      out += ' ';
    } else out += template[i];
  }
  return out;
}

/**
 * O que pode chegar à tela: o conteúdo dos literais de string (aspas simples,
 * duplas e crase) e o texto entre tags de JSX. Identificadores ficam de fora.
 */
function textosVisiveis(fonte) {
  const limpo = semComentarios(fonte);
  const textos = [];
  for (const m of limpo.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    textos.push(m[3] !== undefined ? semExpressoes(m[3]) : (m[1] ?? m[2]));
  }
  // `=>` e comparações não abrem texto; e texto de JSX não tem `;` nem `=`.
  for (const m of limpo.matchAll(/(?<![=\-])>([^<>{};=]*[A-Za-zÀ-ú][^<>{};=]*)(?=[<{])/g)) {
    textos.push(m[1].trim());
  }
  return textos.filter(Boolean);
}

const PALAVRAS_DE_BANCO = /(?<![\p{L}])(saldos?|deposit\p{L}*|dep[oó]sitos?|sacar|saques?|transfer\p{L}*|rendiment\p{L}*)(?![\p{L}])/iu;
const palavrasDeBanco = (fonte) =>
  textosVisiveis(fonte).filter((t) => PALAVRAS_DE_BANCO.test(t)).map((t) => t.match(PALAVRAS_DE_BANCO)[0]);

const NOME_VELHO = /\bCentral\b/;
/** Exceções NOMEADAS: "Central" que fica no texto de propósito. */
const EXCECOES_DO_NOME = [
  // O Banco Central do Brasil, fonte da Selic e do dólar (Economia do mês).
  /\bBanco Central\b/g,
];
const nomeVelho = (fonte) =>
  textosVisiveis(fonte)
    .map((t) => EXCECOES_DO_NOME.reduce((s, re) => s.replace(re, ''), t))
    .filter((t) => NOME_VELHO.test(t));

/* ─────────────────────────── 0. sondas ─────────────────────────── */

console.log('\n0. o extrator enxerga o que existe (sondas)');
checar('sonda: "Seu saldo" no JSX é pego', ['saldo'], palavrasDeBanco('<p>Seu saldo é R$ 10</p>'));
checar('sonda: "Depositar" no botão é pego', ['Depositar'], palavrasDeBanco('<Button>Depositar</Button>'));
checar('sonda: string em prop é pega', ['Sacar'], palavrasDeBanco("<Porta titulo='Sacar agora' />"));
checar('sonda: template é pego', ['Transferência'], palavrasDeBanco('const t = `Transferência de ${mes}`;'));
checar('sonda: comentário não conta', [], palavrasDeBanco('/* nunca "saldo" */\n// nem sacar\n{/* nem depósito */}'));
checar('sonda: identificador não conta', [], palavrasDeBanco('const saldo = a - b;\nif (saldo < 0) x();'));
checar('sonda: código depois de "=>" não vira texto', [], palavrasDeBanco('const f = (x) => x + 1;\nconst saldo = 2;\nif (saldo < 0) {}'));
checar('sonda: "Sobrou em" e "Entrou" passam', [], palavrasDeBanco('<h2>Sobrou em {mes}</h2><span>Entrou {v}</span>'));
checar('sonda: "Central" no texto é pego', 1, nomeVelho('<Header title="Central" />').length);
checar('sonda: "Banco Central" é exceção nomeada', 0, nomeVelho("fonte: 'Selic · Banco Central'").length);
checar('sonda: AuxiliarNaCentral (nome interno) não conta', 0,
  nomeVelho("import AuxiliarNaCentral from './AuxiliarNaCentral';\n<AuxiliarNaCentral />").length);

/* ──────────────── 1. a árvore da Carteira e as palavras de banco ──────────────── */

console.log('\n1. a tela da Carteira não fala como banco');

/** TioFinance.jsx e os componentes de `src/components/` que ela importa direto. */
function arvoreDaCarteira() {
  const tela = 'src/pages/tio/TioFinance.jsx';
  const arquivos = [tela];
  const base = dirname(join(RAIZ, tela));
  for (const m of ler(tela).matchAll(/from\s+'(\.\.\/\.\.\/components\/[^']+)'/g)) {
    const alvo = resolve(base, m[1]);
    const achado = ['', '.jsx', '.js'].map((ext) => alvo + ext).find((p) => existsSync(p) && statSync(p).isFile());
    if (achado) arquivos.push(rel(achado));
  }
  return arquivos;
}
const ARVORE = arvoreDaCarteira();
checar('sonda: a árvore tem a tela', true, ARVORE.includes('src/pages/tio/TioFinance.jsx'));
checar('sonda: a árvore tem os blocos (BlocoSuaPerua, AuxiliarNaCentral)', true,
  ARVORE.some((a) => a.endsWith('BlocoSuaPerua.jsx')) && ARVORE.some((a) => a.endsWith('AuxiliarNaCentral.jsx')));
checar('a passagem de FAMÍLIA entre tios não está na árvore', [],
  ARVORE.filter((a) => a.includes('components/transferencia/')));

for (const arquivo of ARVORE) {
  checar(`${arquivo.split('/').pop()} sem palavra de banco`, [], palavrasDeBanco(ler(arquivo)));
}

// A exclusão é por ESCOPO: o detector pegaria a palavra na passagem de família.
const DIR_TRANSF = join(RAIZ, 'src/components/transferencia');
if (existsSync(DIR_TRANSF)) {
  const achouLa = readdirSync(DIR_TRANSF)
    .filter((n) => /\.jsx?$/.test(n))
    .some((n) => palavrasDeBanco(readFileSync(join(DIR_TRANSF, n), 'utf8')).length > 0);
  checar('sonda: o detector acharia "transferência" na passagem de família (fora do escopo)', true, achouLa);
}

const financa = semComentarios(ler('src/pages/tio/TioFinance.jsx'));
checar('o número grande diz "Sobrou em {mês}"', true, financa.includes('`Sobrou em ${mes}`'));
checar('e "Faltou em {mês}" quando é negativo', true, financa.includes('`Faltou em ${mes}`'));
checar('o título da tela é "Carteira"', true, /<Header title="Carteira"/.test(financa));

/* ─────────────────────────── 2. o rodapé ─────────────────────────── */

console.log('\n2. a aba diz "Carteira" fora da rota e "Rota" na rota');
const layout = semComentarios(ler('src/pages/tio/TioLayout.jsx'));
const navItems = layout.slice(layout.indexOf('const NAV_ITEMS'), layout.indexOf('];', layout.indexOf('const NAV_ITEMS')));
const emRota = layout.slice(layout.indexOf('const ITENS_EM_ROTA'), layout.indexOf('];', layout.indexOf('const ITENS_EM_ROTA')));
checar('sonda: os dois blocos foram achados', true, navItems.length > 0 && emRota.length > 0);
checar('NAV_ITEMS: /tio/finance com o rótulo "Carteira"', true,
  /to:\s*'\/tio\/finance',\s*label:\s*'Carteira'/.test(navItems));
checar('NAV_ITEMS: ícone de carteira (Wallet)', true, /label:\s*'Carteira',\s*icon:\s*Wallet/.test(navItems));
checar('ITENS_EM_ROTA: /tio/route/now com o rótulo "Rota"', true,
  /to:\s*'\/tio\/route\/now',\s*label:\s*'Rota'/.test(emRota));
checar('ITENS_EM_ROTA não diz "Carteira" nem "Central"', false, /Carteira|Central/.test(emRota));
checar('a âncora do tour continua nav-finance / nav-rota', true,
  /tour:\s*'nav-finance'/.test(navItems) && /tour:\s*'nav-rota'/.test(emRota));

/* ─────────────────── 3. nenhum "Central" visível no app ─────────────────── */

console.log('\n3. nenhum texto visível do app ainda diz "Central"');
function varrer(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...varrer(p));
    else if (/\.(jsx?|mjs)$/.test(nome)) out.push(p);
  }
  return out;
}
const TODOS = varrer(join(RAIZ, 'src'));
checar('sonda: a varredura acha a Carteira', true, TODOS.some((p) => p.endsWith('TioFinance.jsx')));
const comNomeVelho = TODOS
  .map((p) => ({ arquivo: rel(p), achados: nomeVelho(readFileSync(p, 'utf8')) }))
  .filter((x) => x.achados.length > 0)
  .map((x) => `${x.arquivo}: ${x.achados.join(' | ')}`);
checar('nenhum "Central" visível em src/ (fora as exceções nomeadas)', [], comNomeVelho);
checar('os "Voltar" do Buzi e da Auxiliar dizem "Carteira"', true,
  /backLabel="Carteira"/.test(ler('src/pages/tio/TioBuzi.jsx')) && /backLabel="Carteira"/.test(ler('src/pages/tio/TioAuxiliar.jsx')));

/* ─────────────────────── 4. as rotas não mudaram ─────────────────────── */

console.log('\n4. as rotas /tio/finance continuam as mesmas');
const app = semComentarios(ler('src/App.jsx'));
for (const caminho of ['finance', 'finance/buzi', 'finance/auxiliar', 'finance/turma', 'finance/reserva', 'route/now']) {
  checar(`rota "${caminho}" existe`, true, app.includes(`path="${caminho}"`));
}
checar('o Voltar do Buzi leva a /tio/finance', true, /backTo="\/tio\/finance"/.test(ler('src/pages/tio/TioBuzi.jsx')));

console.log(`\n${ok} ok, ${bad} falha(s)`);
if (bad > 0) {
  console.log(falhas.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
