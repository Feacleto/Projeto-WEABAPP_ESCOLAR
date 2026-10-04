/**
 * O TERCEIRO DIA DE ROTA LIGA O RELÓGIO DO TESTE — pelo servidor.
 *
 * ── 04/10/2026: DO PRIMEIRO PARA O TERCEIRO DIA, E SÓ ELE (decisão do dono)
 * O teste começava na PRIMEIRA rota (ou na primeira família, ou na primeira
 * mensalidade). Agora começa no 3º DIA DIFERENTE em que ele inicia uma rota, e
 * os outros dois gatilhos saíram: quem inicia a rota só para testar ganha
 * tempo para sentir o app antes de o relógio andar. A conta é pura, em
 * `reguaDoRelogio.contarDiaDeRota` (`npm run testar:trial`).
 *
 * Os dias contados moram em `taxaParceiros/{uid}.diasDeRotaNoTeste`, ao lado
 * da cópia de `trialInicio`: só o servidor escreve ali, e apagar e recriar a
 * conta não zera a contagem. O dia é o do SERVIDOR, em Brasília — nunca a
 * `ultimaRota` que o cliente grava.
 *
 * ── 03/10/2026: QUEM GRAVA É O SERVIDOR
 * Era o cliente que gravava `users.trialInicio` ao ligar o GPS — a data que
 * decide quando a cobrança dele começa, escrita PELO COBRADO. Hoje as rules
 * recusam o campo ao cliente, e quem grava é `ligarRelogio`.
 *
 * ── POR QUE ESCUTA `users`, E NÃO `liveLocation`
 * A posição é regravada a cada minuto de rota: ~750 mil execuções por mês com
 * 100 motoristas, para agir em UMA por dia. O sinal do início da rota é
 * `users.ultimaRota`, gravada pelo próprio motorista no mesmo gesto
 * (`registrarRota`) — uma escrita por rota.
 *
 * A chave da cobrança e o "uma vez só" são os de sempre, dentro de
 * `ligarRelogio`. Com a cobrança desligada nem os dias são contados: senão,
 * ao religar, quem rodou três dias meses atrás começaria o teste na hora.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const LIMITES = require('./limites');
const { logger } = require('firebase-functions/v2');
const { ligarRelogio } = require('./relogioDoTeste');
const { cobrancaLigada } = require('./cobrancaLigada');
const { rotaRegistrada, contarDiaDeRota, diaEmBrasilia } = require('./reguaDoRelogio');

const REGION = 'southamerica-east1';

function makeLigarRelogioNaRota(db) {
  return onDocumentUpdated(
    { document: 'users/{uid}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = event.data && event.data.before ? event.data.before.data() : null;
      const depois = event.data && event.data.after ? event.data.after.data() : null;
      if (!rotaRegistrada(antes, depois)) return;
      const uid = event.params.uid;
      // Já ligado? `ligarRelogio` só confere as duas cópias. Nunca lança.
      if (depois.trialInicio) {
        await ligarRelogio(db, uid, 'rota');
        return;
      }
      if (!(await cobrancaLigada(db))) return;
      let ligar;
      try {
        const copiaRef = db.doc(`taxaParceiros/${uid}`);
        ligar = await db.runTransaction(async (tx) => {
          const copia = await tx.get(copiaRef);
          const dados = copia.exists ? copia.data() : {};
          if (dados.trialInicio) return true;
          const conta = contarDiaDeRota(dados.diasDeRotaNoTeste, diaEmBrasilia(Date.now()));
          if (conta.mudou) tx.set(copiaRef, { diasDeRotaNoTeste: conta.dias }, { merge: true });
          return conta.ligar;
        });
      } catch (err) {
        logger.error('[teste] não deu para contar o dia de rota', { uid, err });
        return;
      }
      if (ligar) await ligarRelogio(db, uid, '3º dia de rota');
    }
  );
}

module.exports = { makeLigarRelogioNaRota };
