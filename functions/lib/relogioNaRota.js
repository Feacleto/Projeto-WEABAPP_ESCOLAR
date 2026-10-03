/**
 * A PRIMEIRA ROTA LIGA O RELÓGIO DO TESTE — agora pelo servidor (03/10/2026).
 *
 * Era o cliente que gravava `users.trialInicio` ao ligar o GPS
 * (`trialService.ligarRelogioDoTrial`). As rules aceitavam porque era "uma vez
 * só", mas era uma vez escrita PELO COBRADO, sobre a data que decide quando a
 * cobrança dele começa. Hoje as rules recusam o campo ao cliente, e o gesto
 * que liga é a escrita que o produto não funciona sem: `liveLocation/{uid}`
 * com `routeActive: true` — é ela que põe a perua no mapa das famílias.
 * Pular `ligarRelogioDoTrial` pelo devtools era fácil; rodar rota sem
 * publicar `liveLocation` não é rodar rota.
 *
 * ── O CUSTO, CONTADO
 * `liveLocation/{uid}` é regravado a cada 30 s e no pulso de cada minuto, e
 * TODA escrita acorda este gatilho. Ele sai na primeira linha quando não é a
 * borda de subida (`rotaComecou`, puro, em `reguaDoRelogio.js`) — sem ler
 * nada. Só o início de rota faz leituras: a chave da cobrança e, com ela
 * ligada, `users` e a cópia em `taxaParceiros`.
 *
 * A chave da cobrança e o "uma vez só" são os de sempre, dentro de
 * `ligarRelogio`.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const LIMITES = require('./limites');
const { ligarRelogio } = require('./relogioDoTeste');
const { rotaComecou } = require('./reguaDoRelogio');

const REGION = 'southamerica-east1';

function makeLigarRelogioNaRota(db) {
  return onDocumentWritten(
    {
      document: 'liveLocation/{uid}',
      region: REGION,
      // ⚠️ SEM baixar a memória para 128MiB, que seria o óbvio para uma
      // função que sai na primeira linha: abaixo de 1 vCPU o v2 força
      // `concurrency: 1`, e com o teto de instâncias de gatilho isso
      // enfileira as gravações de posição da base inteira.
      maxInstances: LIMITES.GATILHO,
    },
    async (event) => {
      const antes = event.data && event.data.before && event.data.before.exists
        ? event.data.before.data()
        : null;
      const depois = event.data && event.data.after && event.data.after.exists
        ? event.data.after.data()
        : null;
      if (!rotaComecou(antes, depois)) return;
      // `ligarRelogio` nunca lança — ver o cabeçalho dele.
      await ligarRelogio(db, event.params.uid, 'primeira rota');
    }
  );
}

module.exports = { makeLigarRelogioNaRota };
