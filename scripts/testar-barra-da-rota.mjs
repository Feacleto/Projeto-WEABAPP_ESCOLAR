/**
 * A BARRA DO BOTÃO NÃO FICA ATRÁS DO MENU DE ABAS.
 *
 * ── POR QUE ESTE TESTE
 * Em 360x640 o "Iniciar a rota" de `Minha rota` aparecia só 10 px acima das
 * abas e o toque no centro do botão caía em "Carteira". A barra era
 * `sticky bottom-0`: `bottom: 0` mede a borda da JANELA, e é nela que o menu
 * fixo (`BottomNav`, `--altura-do-menu` mais a área segura) está encostado.
 * Em 412x915 a página é curta, a barra pousa no fim do conteúdo e tudo parece
 * certo — só rolando uma tela comprida o `sticky` passa a grudar atrás do menu.
 *
 * ── A CONTA
 * O conteúdo JÁ reserva o espaço do menu: o `paddingBottom` do `TioLayout` é
 * `calc(var(--altura-do-menu) + env(safe-area-inset-bottom, 0px))`. O
 * deslocamento do `sticky` é essa MESMA expressão — ele não soma uma segunda
 * reserva, só diz ao `sticky` onde a janela útil termina. (Medido num
 * navegador, 360x640, menu de 64 px: com `bottom: 0` a barra ia de 560 a
 * 640 durante a rolagem e de 496 a 576 no fim — pulava 64 px; com a
 * expressão fica em 496–576 o tempo todo.)
 *
 * ── O QUE ELE AFIRMA
 *  1. Nenhuma barra `sticky` de BAIXO (sem `top-`) usa `bottom-N` do Tailwind:
 *     o deslocamento vem de `style={{ bottom: calc(var(--altura-do-menu) …) }}`
 *     com a área segura, nas três: Minha rota, Carteira e qualquer outra.
 *  2. As duas barras que o passeio visual mandou conferir — a do Início
 *     (`TioDashboard`) e a da operação da rota (`OperacaoDaRota`) — são a
 *     `BarraDaAcao`, cujo CSS (`.barra-da-acao`) usa a mesma variável.
 *  3. O `TioLayout` reserva o espaço do menu com a mesma expressão (a conta de
 *     cima só fecha se for a mesma).
 *
 * COMO RODAR
 *   node scripts/testar-barra-da-rota.mjs   (ou: npm run testar:barra-da-rota)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, passou, detalhe = '') {
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(detalhe ? `${nome} — ${detalhe}` : nome);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8');

function arquivosDe(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivosDe(p));
    else if (/\.(jsx|js)$/.test(nome)) saida.push(p);
  }
  return saida;
}

// A altura do menu E a área segura, em qualquer ordem (`TioBuzi` soma na outra).
const MENU = {
  test: (t) => /var\(--altura-do-menu/.test(t) && /env\(safe-area-inset-bottom/.test(t),
};

/**
 * As tags de abertura de barras `sticky` presas ao PÉ (sem `top-`) e o que cada
 * uma diz sobre o `bottom`. `usaClasseBottom`: pôs `bottom-N` no Tailwind.
 * `usaMenu`: o `style` tem `bottom:` com a altura do menu e a área segura.
 */
export function barrasStickyDoPe(fonte) {
  const achadas = [];
  for (const m of fonte.matchAll(/<(div|footer|nav|section)\s[^>]*className="[^"]*"[^>]*>/gs)) {
    const tag = m[0];
    const classes = tag.match(/className="([^"]*)"/)?.[1] ?? '';
    if (!/(^|\s)sticky(\s|$)/.test(classes)) continue;
    if (/(^|\s)(top-|inset-)/.test(classes)) continue; // sticky de TOPO: não é o pé
    const estilo = tag.match(/style=\{\{([\s\S]*?)\}\}/)?.[1] ?? '';
    const bottom = estilo.match(/bottom:\s*([^}]*)/)?.[1] ?? '';
    achadas.push({
      tag,
      usaClasseBottom: /(^|\s)-?bottom-/.test(classes),
      usaMenu: MENU.test(bottom),
    });
  }
  return achadas;
}

// ── 0. A sonda do detector ─────────────────────────────────────────────────
bloco('0. O detector reprova o que deve e deixa passar o que deve');
{
  const velha = '<div className="sticky bottom-0 z-10 border-t bg-bg px-5 py-3">';
  const nova =
    '<div className="sticky z-10 border-t" style={{ bottom: \'calc(var(--altura-do-menu) + env(safe-area-inset-bottom, 0px))\' }}>';
  const soVariavel = '<div className="sticky z-10" style={{ bottom: \'var(--altura-do-menu)\' }}>';
  const deTopo = '<div className="sticky top-0 z-20 bg-bg">';
  const a = barrasStickyDoPe(velha)[0];
  checar('`sticky bottom-0` é achado e reprovado', !!a && a.usaClasseBottom && !a.usaMenu);
  const b = barrasStickyDoPe(nova)[0];
  checar('`sticky` com a expressão do menu passa', !!b && !b.usaClasseBottom && b.usaMenu);
  const c = barrasStickyDoPe(soVariavel)[0];
  checar('só a variável, sem a área segura, é reprovado', !!c && !c.usaMenu);
  checar('`sticky top-0` (cabeçalho) não entra na conta', barrasStickyDoPe(deTopo).length === 0);
}

// ── 1. Toda barra sticky de baixo do app ───────────────────────────────────
bloco('1. Nenhuma barra sticky de baixo gruda na borda da janela');
let total = 0;
for (const caminho of arquivosDe(new URL('src', raiz).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const fonte = readFileSync(caminho, 'utf8');
  const rel = caminho.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/');
  for (const barra of barrasStickyDoPe(fonte)) {
    total += 1;
    checar(
      `${rel}: sticky do pé usa a altura do menu`,
      !barra.usaClasseBottom && barra.usaMenu,
      'tem `bottom-N` do Tailwind ou falta `calc(var(--altura-do-menu) + env(safe-area-inset-bottom…))`',
    );
  }
}
checar('as duas barras conhecidas foram encontradas (MinhaRota e Carteira)', total >= 2, `achei ${total}`);

// ── 2. As barras do Início e da operação da rota ───────────────────────────
bloco('2. Início e operação da rota usam a BarraDaAcao, que já respeita o menu');
const css = ler('src/index.css');
const regra = css.match(/\.barra-da-acao\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
checar('.barra-da-acao existe', regra.length > 0);
checar(
  '.barra-da-acao é `fixed` e o `bottom` é o menu mais a área segura',
  /\bfixed\b/.test(regra) && /bottom:\s*calc\(\s*env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*var\(--altura-do-menu\)\s*\)/.test(regra),
);
const barraDaAcao = ler('src/components/layout/BarraDaAcao.jsx');
checar('BarraDaAcao usa a classe .barra-da-acao', /className="barra-da-acao"/.test(barraDaAcao));
checar('BarraDaAcao reserva o espaço dela no fim (bloco com a altura medida)', /height:\s*altura/.test(barraDaAcao));
for (const arq of ['src/pages/tio/TioDashboard.jsx', 'src/components/route/OperacaoDaRota.jsx']) {
  const f = ler(arq);
  checar(`${arq} usa <BarraDaAcao>`, /<BarraDaAcao>/.test(f) || /<BarraDoInicio>/.test(f));
}

// ── 3. A reserva do conteúdo é a mesma expressão ───────────────────────────
bloco('3. O TioLayout reserva o menu com a mesma conta');
const layout = ler('src/pages/tio/TioLayout.jsx');
checar(
  'TioLayout: paddingBottom = var(--altura-do-menu) + área segura',
  /paddingBottom:\s*'calc\(var\(--altura-do-menu\) \+ env\(safe-area-inset-bottom, 0px\)\)'/.test(layout),
);
const menu = ler('src/components/layout/BottomNav.jsx');
checar(
  'BottomNav: a altura é var(--altura-do-menu) + área segura',
  /height:\s*'calc\(var\(--altura-do-menu\) \+ env\(safe-area-inset-bottom, 0px\)\)'/.test(menu),
);

console.log('');
console.log(`${ok} ok, ${bad} falhas`);
if (bad) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
