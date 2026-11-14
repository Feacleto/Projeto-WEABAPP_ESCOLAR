/**
 * NENHUMA ANIMAÇÃO DE TELA FICA PREENCHENDO DEPOIS DO FIM.
 *
 * ── POR QUE ESTE TESTE
 * O contêiner que envolve as telas do motorista e da família
 * (`entradaDaTela` em TioLayout e PaiLayout) animava com `fill-mode: both`. O
 * keyframe final já era `transform: none`, e mesmo assim, no Chrome, uma
 * animação de `transform` que continua PREENCHENDO mantém o elemento como bloco
 * de referência de todo filho `position: fixed`. Resultado, medido num
 * navegador a 360x640 (`fixed inset-0`, página de 3000 px):
 *
 *     both       → 3000 px de altura
 *     forwards   → 3000 px de altura
 *     backwards  →  640 px
 *     (nenhum)   →  640 px
 *
 * Em tela, foi isto: os painéis de confirmação da rota (desfazer, encerrar com
 * criança em casa, entrega em lote) e o de "Lançar despesa" escureciam a tela e
 * abriam no fim da página, com `top` negativo. O motorista via só o escuro.
 * Nada quebrava, nenhum relatório de código pegava — só aparece renderizado.
 *
 * ── O QUE ELE AFIRMA
 * Toda animação FINITA declarada em `tailwind.config.js` e em `rota.css` usa
 * `backwards` (ou nenhum preenchimento), nunca `both` nem `forwards`; e as
 * animações que os dois layouts aplicam ao contêiner da tela existem e passam
 * nessa regra. As animações `infinite` não preenchem nada (não terminam) e
 * ficam fora.
 *
 * ⚠️ `index.css` fica de fora de propósito: a travessia (`trav-*`) é uma cortina
 * que ELA MESMA é `fixed` e some do DOM, e precisa segurar o estado final.
 *
 * COMO RODAR
 *   node scripts/testar-preenchimento.mjs   (ou: npm run testar:preenchimento)
 */

import { readFileSync } from 'node:fs';
import cfg from '../tailwind.config.js';

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

/** Uma animação (a string do atalho `animation`) que segura o estado depois do fim. */
export function preencheDepoisDoFim(atalho) {
  if (/\binfinite\b/.test(atalho)) return false; // nunca termina, não há "depois"
  return /\b(both|forwards)\b/.test(atalho);
}

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

// ── 0. A sonda do próprio detector ─────────────────────────────────────────
bloco('0. O detector reprova o que deve e deixa passar o que deve');
checar('"both" é reprovado', preencheDepoisDoFim('entra-dir 300ms ease both'));
checar('"forwards" é reprovado', preencheDepoisDoFim('entra-dir 300ms ease forwards'));
checar('"both" depois do atraso é reprovado', preencheDepoisDoFim('x 1s ease 200ms both'));
checar('"backwards" passa', !preencheDepoisDoFim('entra-dir 300ms ease backwards'));
checar('sem preenchimento passa', !preencheDepoisDoFim('entra-dir 300ms ease'));
checar('"infinite" não é preenchimento', !preencheDepoisDoFim('ponto 1s ease infinite'));

// ── 1. As animações do tailwind.config.js ──────────────────────────────────
bloco('1. tailwind.config.js — toda animação finita solta o elemento no fim');
const animacoes = cfg.theme?.extend?.animation ?? {};
const nomes = Object.keys(animacoes);
checar('a lista de animações foi lida (não está vazia)', nomes.length >= 6, `veio ${nomes.length}`);
for (const nome of nomes) {
  checar(
    `animate-${nome}: "${animacoes[nome]}"`,
    !preencheDepoisDoFim(animacoes[nome]),
    'usa both/forwards — um filho `fixed` passa a medir a página, não a tela',
  );
}

// ── 2. As animações que os layouts põem no contêiner da tela ───────────────
bloco('2. Os contêineres de tela só usam animações que passam na regra');
for (const arquivo of ['src/pages/tio/TioLayout.jsx', 'src/pages/pai/PaiLayout.jsx']) {
  const fonte = ler(arquivo);
  const trecho = fonte.slice(fonte.indexOf('const entradaDaTela'), fonte.indexOf('const entradaDaTela') + 400);
  const usadas = [...trecho.matchAll(/(?<![:\w-])animate-([a-z-]+)/g)].map((m) => m[1]).filter((n) => n !== 'none');
  checar(`${arquivo} aplica ao menos uma animação na tela`, usadas.length >= 1);
  for (const nome of usadas) {
    checar(
      `${arquivo}: animate-${nome} está definida`,
      nome in animacoes,
      'a classe não existe no tailwind.config.js',
    );
    checar(
      `${arquivo}: animate-${nome} não preenche depois do fim`,
      nome in animacoes && !preencheDepoisDoFim(animacoes[nome]),
    );
  }
}

// ── 3. As animações do cartão da rota (rota.css) ───────────────────────────
bloco('3. rota.css — as entradas dos cartões da rota');
const css = ler('src/components/route/rota.css').replace(/\/\*[\s\S]*?\*\//g, '');
const declaradas = [...css.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1].trim());
checar('rota.css declara animações', declaradas.length >= 3, `veio ${declaradas.length}`);
for (const d of declaradas) {
  checar(`rota.css: "${d}"`, !preencheDepoisDoFim(d));
}

console.log('');
console.log(`${ok} ok, ${bad} falhas`);
if (bad) {
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
