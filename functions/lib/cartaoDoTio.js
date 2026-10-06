/**
 * O CARTÃO DO TIO, PARA CONHECER (05/10/2026, decisão do dono) — a callable
 * PÚBLICA `verCartaoDoTio({ uid })` que alimenta a página `/conheca/<uid>`.
 *
 * O tio manda o próprio cartão a uma família NOVA pelo WhatsApp (o "Mandar
 * meu cartão a uma família" da folha da marca). Quem abre não tem conta, e
 * a página só APRESENTA o tio: marca, logo, cor, cidade, bairro e o WhatsApp
 * dele — o `phone` que ele mesmo cadastrou, porque é ele quem está mandando
 * o cartão. Nada da turma, nada de preço.
 *
 * ── AS REGRAS (a régua pura é `recorteDoCartaoDoTio`, em reguaDoCartao.js)
 *   - o uid passa por `idValido` antes de virar caminho;
 *   - só motorista (`role == 'admin'`), não suspenso e COM marca;
 *   - uma LISTA FECHADA de seis campos, nunca um spread do doc;
 *   - qualquer outro caso responde a MESMA frase ("Este cartão não vale
 *     mais."): a callable não pode virar teste de "esse uid existe";
 *   - o limite por IP é o do convite público, e conta só o que não deu
 *     cartão. ⚠️ A ÚNICA ESCRITA é a do contador (`limitesDeTentativa`), pelo
 *     módulo do limite; nada de usuário, de criança ou de tio é escrito.
 *
 * ⚠️ Não existe busca de motorista (docs/marca.md, declaração 5): esta
 * callable responde um uid que alguém já tem no link, e nunca lista nada.
 */

const { onCall } = require('firebase-functions/v2/https');
const LIMITES = require('./limites');
const limite = require('./limiteDeTentativas');
const { REGRAS } = require('./reguaDasTentativas');
const { idValido } = require('./reguaDosIds');
const { recorteDoCartaoDoTio, FRASE_DO_CARTAO_QUE_NAO_VALE } = require('./reguaDoCartao');

const REGION = 'southamerica-east1';

function makeVerCartaoDoTio(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const naoVale = { vale: false, frase: FRASE_DO_CARTAO_QUE_NAO_VALE };
    const quem = limite.quemPeloIp(request.rawRequest);
    if (!(await limite.aindaCabe(db, REGRAS.CONVITE_PUBLICO, quem))) return naoVale;
    const uid = String(request.data?.uid || '').trim();
    let cartao = null;
    if (idValido(uid)) {
      const snap = await db.doc(`users/${uid}`).get();
      cartao = recorteDoCartaoDoTio(uid, snap.exists ? snap.data() : null);
    }
    if (!cartao) {
      await limite.contar(db, REGRAS.CONVITE_PUBLICO, quem);
      return naoVale;
    }
    return { vale: true, ...cartao };
  });
}

module.exports = { makeVerCartaoDoTio };
