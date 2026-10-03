/**
 * NENHUM COMENTÁRIO DE CÓDIGO APARECE NA TELA (03/10/2026).
 *
 * Dentro do JSX, um comentário só fica invisível com chaves: `{/* … *\/}`.
 * Sem elas, `/* … *\/` vira TEXTO e é desenhado na tela. Foi o que aconteceu
 * com o comentário "A ÂNCORA DO TUTORIAL MORA AQUI…" em ControleDeRota: um
 * parágrafo inteiro de explicação técnica impresso acima do "INICIAR ROTA",
 * no Início do motorista. Lint, build e bateria passavam — nenhum deles olha
 * o texto que a tela desenha.
 *
 * Este teste lê cada .jsx de src/ com o mesmo tipo de parser que o build usa
 * e procura nós de TEXTO do JSX que começam como comentário (`/*`, `//`) ou
 * carregam um fecho de comentário (`*\/`).
 *
 * Rode: npm run testar:comentario-na-tela
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const src = join(raiz, 'src');

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.jsx$/.test(nome) ? [p] : [];
  });
}

function pareceComentario(texto) {
  const t = texto.trim();
  return t.startsWith('/*') || t.startsWith('//') || t.includes('*/');
}

function textosDoJsx(no, saida = []) {
  if (!no || typeof no !== 'object') return saida;
  if (Array.isArray(no)) {
    no.forEach((n) => textosDoJsx(n, saida));
    return saida;
  }
  if (no.type === 'JSXText' && pareceComentario(no.value)) saida.push(no);
  for (const chave of Object.keys(no)) {
    if (chave === 'loc' || chave === 'start' || chave === 'end' || chave === 'extra') continue;
    const valor = no[chave];
    if (valor && typeof valor === 'object') textosDoJsx(valor, saida);
  }
  return saida;
}

function procurar(codigo) {
  const ast = parse(codigo, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  return textosDoJsx(ast.program);
}

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

const lista = arquivos(src);
const achados = [];
for (const arq of lista) {
  for (const no of procurar(readFileSync(arq, 'utf8'))) {
    achados.push(`${relative(raiz, arq)}:${no.loc.start.line} "${no.value.trim().slice(0, 50)}…"`);
  }
}
checar(`nenhum comentário vira texto na tela (${lista.length} arquivos .jsx)`, [], achados);

// SONDA POSITIVA: o detector reprova exatamente o defeito que existiu.
checar('o detector pega o comentário sem chaves', 1,
  procurar('const A = () => (<>\n  /* A ÂNCORA MORA AQUI */\n  <b>x</b>\n</>);').length);
checar('e não reprova o comentário com chaves', 0,
  procurar('const A = () => (<>\n  {/* A ÂNCORA MORA AQUI */}\n  <b>x</b>\n</>);').length);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
