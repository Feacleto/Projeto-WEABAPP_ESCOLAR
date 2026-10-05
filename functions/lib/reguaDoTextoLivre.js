/**
 * O FILTRO DO TEXTO LIVRE QUE OUTRA PESSOA VAI LER — régua PURA (05/10/2026).
 *
 * Nasceu dentro de `reguaDaAvaliacaoDaAuxiliar.js` (a frase da recomendação)
 * e saiu para cá quando a LEGENDA da foto da comunidade precisou da mesma
 * régua: as duas são texto que o tio escreve e que gente de fora da turma dele
 * lê. Uma régua só, para as duas não divergirem.
 *
 * O que não passa:
 * - CONTATO: telefone (8+ dígitos, com ou sem máscara), e-mail, link e "@".
 *   Transformaria o texto em anúncio fora da plataforma.
 * - PROMESSA DE SEGURANÇA: a plataforma não inspeciona van, não confere CNH;
 *   "segura" ou "garantida" seria ela afirmando o que não confere (decisão
 *   "NENHUM DELES AFIRMA SEGURANÇA", `src/marca/promessas.js`).
 * - NOME de criança ou de família da turma DAQUELE tio: lido por um estranho,
 *   é dado de terceiro que ninguém autorizou.
 *
 * ⚠️ AS RAÍZES PROIBIDAS SÃO ESPELHO de `src/marca/promessas.js` — o deploy
 * das functions não alcança `src/`. `npm run testar:avaliacao-da-auxiliar`
 * compara as duas listas por LEITURA DE ARQUIVO.
 *
 * Sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 */

'use strict';

/** ⚠️ ESPELHO de `PROIBIDAS` em src/marca/promessas.js — mesma ordem. */
const RAIZES_PROIBIDAS = [
  'segur',
  'protegid',
  'protecao',
  'vistoriad',
  'certificad',
  'garant',
  'fiscalizad',
  'homologad',
  'confiavel',
  'aprovado pela',
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Espaços repetidos viram um; o texto é aparado. */
function fraseLimpa(bruto) {
  return String(bruto == null ? '' : bruto).replace(/\s+/g, ' ').trim();
}

/** Palavras de 3+ letras, sem acento e sem caixa. */
function palavras(texto) {
  return normalizar(texto).split(/[^a-z]+/).filter((p) => p.length >= 3);
}

/**
 * As palavras dos nomes da turma DAQUELE tio (crianças e responsáveis), menos
 * as que estão em `permitidos` — na recomendação, o nome da própria auxiliar:
 * "A Ana é ótima" não pode ser recusada porque uma mãe da turma também se
 * chama Ana. Na legenda da foto não há nada a permitir.
 */
function palavrasDosNomes(nomes, permitidos = '') {
  const livres = new Set(palavras(permitidos));
  const set = new Set();
  for (const n of Array.isArray(nomes) ? nomes : []) {
    for (const p of palavras(n)) if (!livres.has(p)) set.add(p);
  }
  return set;
}

/** 8 ou mais dígitos numa sequência, com ou sem máscara (telefone, CPF, CNPJ). */
function temNumeroLongo(texto) {
  const corridas = String(texto).match(/\d[\d\s().\-/]*\d/g) || [];
  return corridas.some((c) => (c.match(/\d/g) || []).length >= 8);
}

function temLink(t) {
  return /https?:|www\.|\.com\b|\.br\b|@/.test(t);
}

/**
 * O texto pode ir? Devolve `null` se pode, ou `{ motivo, mensagem }`.
 * `mensagens` traz as frases de cada motivo (`longa`, `contato`, `promessa`,
 * `nome`) — quem chama decide como dizer, porque a tela da recomendação e a
 * da foto falam de coisas diferentes ("a frase", "a legenda"). A mensagem
 * nunca repete o nome achado.
 */
function problemaNoTexto(texto, { max, nomes = new Set(), mensagens = {} } = {}) {
  const f = fraseLimpa(texto);
  if (!f) return null;
  if (max && f.length > max) return { motivo: 'longa', mensagem: mensagens.longa || null };
  const t = normalizar(f);
  if (temNumeroLongo(f) || temLink(t)) return { motivo: 'contato', mensagem: mensagens.contato || null };
  if (RAIZES_PROIBIDAS.some((r) => t.includes(r))) return { motivo: 'promessa', mensagem: mensagens.promessa || null };
  if (palavras(f).some((p) => nomes.has(p))) return { motivo: 'nome', mensagem: mensagens.nome || null };
  return null;
}

module.exports = {
  RAIZES_PROIBIDAS,
  normalizar,
  fraseLimpa,
  palavras,
  palavrasDosNomes,
  temNumeroLongo,
  temLink,
  problemaNoTexto,
};
