/**
 * A COMUNIDADE ESTÁ LIGADA? — o lado do servidor da chave
 * `platformConfig/app.comunidadeLigada` (14/11/2026, decisão 26).
 *
 * A regra é pura e mora em `reguaDaComunidade.js` (`comunidadeEstaLigada`);
 * aqui só se lê o documento e se recusa a chamada. Mesmo desenho de
 * `cobrancaLigada.js`.
 *
 * ⚠️ DESLIGADA, NENHUMA CALLABLE DEVOLVE DADO DE OUTRO MOTORISTA. São as
 * portas em que a parceria (derivada da indicação, que aceita qualquer
 * telefone) abre o dado de um colega:
 *   - `meusParceiros`          — marca, logo, escolas, WhatsApp e fotos;
 *   - `fotosDaComunidade`      — as fotos dos parceiros (e dos tios dela);
 *   - `avisarParceiroIndicado` — escreve na caixa de outro motorista;
 *   - `publicarFotoDaTurma`    — só para `parceiros` e `comunidade`: a foto
 *                                para as FAMÍLIAS do próprio tio continua;
 *   - `pedirTransferencia`     — passa uma família a um "parceiro".
 * As callables do próprio tio (apagar a foto, as da auxiliar, a nota das
 * famílias) não leem colega e ficam de fora.
 *
 * Falha de leitura conta como DESLIGADA: errar para o lado de não abrir o
 * dado de terceiro é o erro barato.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { comunidadeEstaLigada, FRASE_DA_COMUNIDADE_FECHADA } = require('./reguaDaComunidade');

async function comunidadeLigada(db) {
  try {
    const snap = await db.doc('platformConfig/app').get();
    return comunidadeEstaLigada(snap.exists ? snap.data() : null);
  } catch (err) {
    logger.error('[comunidade] não deu para ler a chave; tratando como desligada', { err });
    return false;
  }
}

/** Recusa a chamada quando a Comunidade está desligada. */
async function exigirComunidadeLigada(db) {
  if (!(await comunidadeLigada(db))) {
    throw new HttpsError('failed-precondition', FRASE_DA_COMUNIDADE_FECHADA);
  }
}

module.exports = { comunidadeLigada, exigirComunidadeLigada };
