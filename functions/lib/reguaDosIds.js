/**
 * O QUE UM IDENTIFICADOR VINDO DO CLIENTE PODE SER (03/10/2026) — régua pura.
 *
 * ⚠️ O ATAQUE QUE ISTO FECHA: `db.doc('children/' + childId)` aceita BARRAS.
 * Um `childId = "<minhaCrianca>/rides/2026-10-03"` endereça outro documento —
 * e a função de remover criança, lendo ali um `parentUid` plantado, apagava a
 * conta de QUALQUER pessoa (o dono incluído). Todo id que vem de
 * `request.data` passa por aqui antes de virar caminho.
 *
 * PURA: sem `require`.
 */

'use strict';

const FORMATO_DO_ID = /^[A-Za-z0-9_-]{1,128}$/;

function idValido(valor) {
  return typeof valor === 'string' && FORMATO_DO_ID.test(valor);
}

/** 'AAAA-MM' com mês de 01 a 12. */
function mesValido(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

module.exports = { FORMATO_DO_ID, idValido, mesValido };
