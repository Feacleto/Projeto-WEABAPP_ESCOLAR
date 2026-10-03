/**
 * A PRIMEIRA ROTA LIGA O RELÓGIO DO TESTE — agora pelo servidor (03/10/2026).
 *
 * Era o cliente que gravava `users.trialInicio` ao ligar o GPS
 * (`trialService.ligarRelogioDoTrial`). As rules aceitavam porque era "uma vez
 * só", mas era uma vez escrita PELO COBRADO, sobre a data que decide quando a
 * cobrança dele começa — e com o valor que ele quisesse. Hoje as rules recusam
 * o campo ao cliente, e quem grava é `ligarRelogio`, aqui.
 *
 * ── POR QUE ESCUTA `users`, E NÃO `liveLocation`
 * A primeira versão escutava `liveLocation/{uid}` (a escrita sem a qual a
 * perua não aparece no mapa). Só que a posição é regravada a cada minuto de
 * rota: ~750 mil execuções por mês com 100 motoristas, para agir em UMA por
 * dia. O sinal do início da rota que já existe é `users.ultimaRota`, gravada
 * pelo próprio motorista no mesmo gesto (`registrarRota`) — uma escrita por
 * rota. Quem a pular mexendo no devtools ainda cai nos outros dois gatilhos do
 * relógio, que são do servidor: o primeiro responsável entrando e a primeira
 * mensalidade gerada (`relogioDoTeste.js`) — sem família no app, o motorista
 * não usa o que a plataforma cobra.
 *
 * A chave da cobrança e o "uma vez só" são os de sempre, dentro de
 * `ligarRelogio`.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const LIMITES = require('./limites');
const { ligarRelogio } = require('./relogioDoTeste');
const { rotaRegistrada } = require('./reguaDoRelogio');

const REGION = 'southamerica-east1';

function makeLigarRelogioNaRota(db) {
  return onDocumentUpdated(
    { document: 'users/{uid}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = event.data && event.data.before ? event.data.before.data() : null;
      const depois = event.data && event.data.after ? event.data.after.data() : null;
      if (!rotaRegistrada(antes, depois)) return;
      // `ligarRelogio` nunca lança — ver o cabeçalho dele.
      await ligarRelogio(db, event.params.uid, 'primeira rota');
    }
  );
}

module.exports = { makeLigarRelogioNaRota };
