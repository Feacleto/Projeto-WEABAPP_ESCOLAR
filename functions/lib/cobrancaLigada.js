/**
 * A COBRANÇA DA PLATAFORMA ESTÁ LIGADA? — o lado do servidor da chave mestra
 * e dos MÓDULOS de cobrança, lendo `platformConfig/app`.
 *
 * O dono liga e desliga pelo painel admin. A regra em si é pura e mora em
 * `reguaDaCobranca.js` (espelho de src/dominio/associacao/modulosDeCobranca.js);
 * aqui só se lê o documento. Ver docs/estrutura-de-cobranca.md.
 *
 * Desligada, NADA conta: o relógio do teste não liga, a fatura do mês não
 * fecha, nenhum aviso de venda sai, nenhuma oferta, nenhum plano é contratado
 * e nenhuma cobrança é gerada. A mensalidade das FAMÍLIAS não passa por aqui.
 *
 * Falha de leitura conta como DESLIGADA: errar pro lado de não cobrar é o
 * erro barato.
 */
const { logger } = require('firebase-functions/v2');
const { estaLigada, moduloEstaAtivo } = require('./reguaDaCobranca');

async function lerConfig(db) {
  try {
    const snap = await db.doc('platformConfig/app').get();
    return snap.exists ? snap.data() : null;
  } catch (err) {
    logger.error('[cobranca] não deu para ler a chave; tratando como desligada', { err });
    return null;
  }
}

async function cobrancaLigada(db) {
  return estaLigada(await lerConfig(db));
}

async function moduloAtivo(db, id) {
  return moduloEstaAtivo(await lerConfig(db), id);
}

module.exports = { cobrancaLigada, moduloAtivo, estaLigada, moduloEstaAtivo };
