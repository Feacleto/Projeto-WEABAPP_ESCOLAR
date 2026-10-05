/**
 * AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR — régua PURA (05/10/2026, decisão
 * do dono, travas da QA).
 *
 * São duas peças com economias OPOSTAS, e misturá-las foi o que o dono
 * recusou:
 *
 *   (A) A RECOMENDAÇÃO que o tio escreve PARA ELA — sem estrela, sem número,
 *       sem média. Até 3 pontos fortes de uma lista fechada e UMA frase de
 *       até 80 letras, ASSINADA. Ela lê antes e decide: mostrar, não mostrar
 *       ou apagar. É um documento DELA sobre o trabalho dela, não uma nota
 *       da plataforma.
 *   (B) A NOTA que ela dá AO TIO — estrelas de 1 a 5, uma por par. Só a
 *       equipe do Alô Buzinou vê as notas; o tio vê só a MÉDIA, e só com
 *       pelo menos 3 auxiliares diferentes: com uma ou duas, a média diria
 *       quem deu cada nota (o tio sabe quem trabalhou com ele).
 *
 * ── POR QUE A FRASE É FILTRADA NO SERVIDOR
 * Ela vai, numa etapa futura, aparecer para OUTROS tios. Telefone, e-mail ou
 * link transformariam a recomendação em anúncio fora da plataforma; promessa
 * de segurança ("cuidadosa e segura") seria a plataforma afirmando o que não
 * confere (decisão 'NENHUM DELES AFIRMA SEGURANÇA', `src/marca/promessas.js`);
 * e o nome de uma criança ou de uma mãe da turma dele, lido por um estranho,
 * é dado de terceiro que ninguém autorizou. Filtro na tela se pula com o
 * console; aqui, não.
 *
 * ⚠️ AS RAÍZES PROIBIDAS SÃO ESPELHO de `src/marca/promessas.js` — o deploy
 * das functions não alcança `src/`. `npm run testar:avaliacao-da-auxiliar`
 * compara as duas listas por LEITURA DE ARQUIVO.
 *
 * Régua sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 * Quem conta os dias de vínculo é `diasDeVinculo` (reguaDoAuxiliar.js): a
 * callable passa o número pronto.
 */

'use strict';

/** Os cinco pontos fortes "para trabalhar junto". Lista fechada do dono. */
const PONTOS_FORTES = [
  { id: 'pontual', rotulo: 'Pontual' },
  { id: 'cuidadosa', rotulo: 'Cuidadosa com as crianças' },
  { id: 'paciente', rotulo: 'Paciente' },
  { id: 'organizada', rotulo: 'Organizada' },
  { id: 'gentil', rotulo: 'Gentil com as famílias' },
];
const IDS_DOS_PONTOS = PONTOS_FORTES.map((p) => p.id);
const MAX_PONTOS = 3;
const MAX_FRASE = 80;
/** Só recomenda quem trabalhou com ela pelo menos 30 dias (SOMA dos períodos). */
const MIN_DIAS_PARA_RECOMENDAR = 30;
/** A média só aparece ao tio com notas de pelo menos 3 auxiliares diferentes. */
const MIN_AUXILIARES_PARA_MEDIA = 3;
const MOTIVO_MIN = 5;
const MOTIVO_MAX = 200;

const ESTADO = { PENDENTE: 'pendente', APROVADA: 'aprovada', OCULTA: 'oculta' };
const ACOES_DELA = ['aprovar', 'ocultar', 'apagar'];

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

/** O id do documento é o do PAR, o mesmo do vínculo: uma por par. */
function idDaAvaliacao(motoristaUid, auxiliarUid) {
  return `${motoristaUid}_${auxiliarUid}`;
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Pontos: de 1 a 3, da lista, sem repetir. Devolve `{ ok, pontos, erro }`. */
function validarPontos(pontos) {
  if (!Array.isArray(pontos) || pontos.length === 0) {
    return { ok: false, erro: 'Marque pelo menos um ponto forte.' };
  }
  if (pontos.length > MAX_PONTOS) return { ok: false, erro: `Até ${MAX_PONTOS} pontos fortes.` };
  if (!pontos.every((p) => typeof p === 'string' && IDS_DOS_PONTOS.includes(p))) {
    return { ok: false, erro: 'Ponto forte desconhecido.' };
  }
  if (new Set(pontos).size !== pontos.length) return { ok: false, erro: 'Cada ponto forte vale uma vez.' };
  // A ordem gravada é a da lista, não a do toque: duas recomendações iguais
  // ficam iguais.
  return { ok: true, pontos: IDS_DOS_PONTOS.filter((id) => pontos.includes(id)) };
}

/** Espaços repetidos viram um; a frase é aparada. */
function fraseLimpa(bruto) {
  return String(bruto == null ? '' : bruto).replace(/\s+/g, ' ').trim();
}

/** Palavras de 3+ letras, sem acento e sem caixa. */
function palavras(texto) {
  return normalizar(texto).split(/[^a-z]+/).filter((p) => p.length >= 3);
}

/**
 * As palavras dos nomes da turma DAQUELE tio (crianças e responsáveis), menos
 * as que estão no nome da própria auxiliar — "A Ana é ótima" não pode ser
 * recusada porque uma mãe da turma também se chama Ana.
 */
function palavrasDosNomes(nomes, nomeDaAuxiliar = '') {
  const dela = new Set(palavras(nomeDaAuxiliar));
  const set = new Set();
  for (const n of Array.isArray(nomes) ? nomes : []) {
    for (const p of palavras(n)) if (!dela.has(p)) set.add(p);
  }
  return set;
}

const MSG = {
  vazia: null,
  longa: `A frase tem até ${MAX_FRASE} letras.`,
  contato: 'Tire telefone, e-mail ou link da frase.',
  promessa: 'Tire da frase palavras como "segura" ou "garantida": o app não confere isso.',
  nome: 'Tire o nome de criança ou família da frase.',
};

/** 8 ou mais dígitos numa sequência, com ou sem máscara (telefone, CPF, CNPJ). */
function temNumeroLongo(texto) {
  const corridas = String(texto).match(/\d[\d\s().\-/]*\d/g) || [];
  return corridas.some((c) => (c.match(/\d/g) || []).length >= 8);
}

function temLink(t) {
  return /https?:|www\.|\.com\b|\.br\b|@/.test(t);
}

/**
 * A frase pode ir? Devolve `null` se pode, ou `{ motivo, mensagem }`. A
 * mensagem diz O QUE tirar, de forma genérica — nunca repete o nome achado.
 *
 * `nomesDaTurma` é o conjunto de `palavrasDosNomes`.
 */
function problemaNaFrase(frase, nomesDaTurma = new Set()) {
  const f = fraseLimpa(frase);
  if (!f) return null;
  if (f.length > MAX_FRASE) return { motivo: 'longa', mensagem: MSG.longa };
  const t = normalizar(f);
  if (temNumeroLongo(f) || temLink(t)) return { motivo: 'contato', mensagem: MSG.contato };
  if (RAIZES_PROIBIDAS.some((r) => t.includes(r))) return { motivo: 'promessa', mensagem: MSG.promessa };
  if (palavras(f).some((p) => nomesDaTurma.has(p))) return { motivo: 'nome', mensagem: MSG.nome };
  return null;
}

/** Trabalhou o bastante para recomendar? `dias` vem de `diasDeVinculo`. */
function podeRecomendar(dias) {
  return Number(dias) >= MIN_DIAS_PARA_RECOMENDAR;
}

/**
 * A ASSINATURA: a MARCA (como as famílias e as colegas o conhecem) e o
 * primeiro nome civil entre parênteses, quando ele existe e não é a própria
 * marca. Sem marca, o primeiro nome sozinho.
 */
function assinaturaDoTio({ marcaNome, name } = {}) {
  const marca = String(marcaNome || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const primeiro = String(name || '').trim().split(/\s+/)[0] || '';
  if (!marca) return primeiro || 'Motorista';
  if (!primeiro || palavras(marca).includes(normalizar(primeiro))) return marca;
  return `${marca} (${primeiro})`;
}

/**
 * O que a escrita do tio faz no documento. Criar e EDITAR vão os dois para
 * `pendente`, com `aprovadaEm: null`: ela aprovou um texto, não o próximo.
 */
function documentoDaRecomendacao({ existente, motoristaUid, auxiliarUid, assinatura, pontos, frase, agora }) {
  return {
    motoristaUid,
    auxiliarUid,
    assinatura,
    pontos,
    frase: fraseLimpa(frase),
    criadaEm: existente?.criadaEm || agora,
    editadaEm: existente ? agora : null,
    estado: ESTADO.PENDENTE,
    aprovadaEm: null,
    // ⚠️ `removida: false` existe para as RULES e as CONSULTAS: regra não é
    // filtro, e a lista do tio/dela só passa se a consulta provar a
    // condição (`where('removida', '==', false)`). Quem diz o porquê é
    // `removidaPeloDono`.
    removida: false,
  };
}

/** A resposta dela: o estado novo, ou `null` para apagar. */
function estadoDaResposta(acao) {
  if (acao === 'aprovar') return ESTADO.APROVADA;
  if (acao === 'ocultar') return ESTADO.OCULTA;
  return null;
}

function motivoValido(motivo) {
  const m = String(motivo || '').trim();
  return m.length >= MOTIVO_MIN && m.length <= MOTIVO_MAX;
}

function estrelasValidas(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * O QUE O TIO VÊ das notas dele: quantas auxiliares DIFERENTES responderam e,
 * só com pelo menos 3, a média com uma casa. Nunca uma nota sozinha.
 */
function resumoDasNotas(notas) {
  const porAuxiliar = new Map();
  for (const n of Array.isArray(notas) ? notas : []) {
    if (!n || !n.auxiliarUid || !estrelasValidas(n.estrelas)) continue;
    porAuxiliar.set(n.auxiliarUid, n.estrelas);
  }
  const respostas = porAuxiliar.size;
  if (respostas < MIN_AUXILIARES_PARA_MEDIA) return { respostas, media: null };
  const soma = [...porAuxiliar.values()].reduce((a, b) => a + b, 0);
  return { respostas, media: Math.round((soma / respostas) * 10) / 10 };
}

module.exports = {
  PONTOS_FORTES,
  IDS_DOS_PONTOS,
  MAX_PONTOS,
  MAX_FRASE,
  MIN_DIAS_PARA_RECOMENDAR,
  MIN_AUXILIARES_PARA_MEDIA,
  MOTIVO_MIN,
  MOTIVO_MAX,
  ESTADO,
  ACOES_DELA,
  RAIZES_PROIBIDAS,
  idDaAvaliacao,
  normalizar,
  validarPontos,
  fraseLimpa,
  palavrasDosNomes,
  problemaNaFrase,
  podeRecomendar,
  assinaturaDoTio,
  documentoDaRecomendacao,
  estadoDaResposta,
  motivoValido,
  estrelasValidas,
  resumoDasNotas,
};
