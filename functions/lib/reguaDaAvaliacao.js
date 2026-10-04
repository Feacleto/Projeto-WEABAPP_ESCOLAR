/**
 * A AVALIAÇÃO RÁPIDA DE QUEM NÃO TEM CONTA — a régua do servidor (03/10/2026).
 *
 * Espelho do pedaço de `src/dominio/suporte/avaliacaoRapida.js` que o
 * servidor precisa: o deploy das functions não alcança `src/`.
 * `npm run testar:avaliacao` compara os dois caso a caso.
 *
 * Quem avalia por aqui é quem abriu o LINK (`/acompanhar`): a pessoa que vai
 * pegar a criança hoje, ou o segundo responsável com o acesso de 24 horas.
 * Uma avaliação por link, e só depois da entrega.
 *
 * PURA: sem `require` (régua de `functions/lib/` não requer SDK).
 */

'use strict';

const COMENTARIO_MAX = 140;

const PAPEL = {
  ACOMPANHANTE: 'acompanhante',
  SEGUNDO_RESPONSAVEL: 'segundo_responsavel',
};

function notaValida(nota) {
  return Number.isInteger(nota) && nota >= 1 && nota <= 5;
}

function comentarioLimpo(texto) {
  return String(texto == null ? '' : texto).trim().slice(0, COMENTARIO_MAX);
}

/** Ausente é LIGADA — só `false` explícito desliga. */
function avaliacaoLigada(config) {
  return !config || config.avaliacaoRapida !== false;
}

/**
 * A página do link pede a avaliação? Só com a criança ENTREGUE, uma vez por
 * link, e com o interruptor do dono ligado.
 */
function pedirAvaliacaoNoLink({ estado, avaliadoEm, config }) {
  return estado === 'entregue' && !avaliadoEm && avaliacaoLigada(config);
}

/** O documento gravado em `feedbacks`. Sem nome, sem telefone de quem avaliou. */
function documentoDaAvaliacao({ papel, nota, comentario, childId, adminUid }) {
  return {
    uid: null,
    role: papel,
    momento: 'acompanhamento',
    answers: { rating: nota },
    comment: comentarioLimpo(comentario),
    childId: childId || null,
    adminUid: adminUid || null,
    allowTestimonial: false,
    hiddenByOwner: true,
    allowPhoto: false,
  };
}

module.exports = {
  COMENTARIO_MAX,
  PAPEL,
  notaValida,
  comentarioLimpo,
  avaliacaoLigada,
  pedirAvaliacaoNoLink,
  documentoDaAvaliacao,
};
