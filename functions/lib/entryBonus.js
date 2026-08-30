/**
 * A roleta de entrada — sorteio de meses sem taxa, decidido pelo SERVIDOR.
 *
 * POR QUE ELA EXISTE
 * O sistema está em teste e o motorista não vai querer pagar desde o primeiro
 * dia. A roleta é o que faz ele entrar e USAR o app antes de existir cobrança:
 * ele gira uma vez, sai de um a quatro meses sem taxa, e nesse período o
 * produto tem que provar que vale a taxa que vem depois.
 *
 * POR QUE O SORTEIO NÃO PODE MORAR NO CLIENTE
 * Se o número sair no navegador, ele é escolhido por quem está no navegador.
 * Não precisa de má-fé nem de conhecimento: basta abrir o console, ou recarregar
 * a página no meio da animação até sair 4. E o pior caso não é o motorista
 * ganhar um mês a mais — é a plataforma não ter como saber o que foi concedido,
 * porque o registro dependeria da boa-fé do cliente em contar a verdade.
 *
 * Então: o servidor sorteia, GRAVA, e só depois responde. A animação do cliente
 * é encenação de um resultado que já existe — ela pode girar o tempo que quiser,
 * mas para onde ela para já está decidido e registrado.
 *
 * UMA VEZ POR CONTA, GARANTIDO PELO ID
 * O documento é `entryBonuses/{uid}` — o id É a conta. Duas chamadas
 * simultâneas não criam dois sorteios porque a transação falha na segunda: não
 * existe "verificar e depois gravar" com janela no meio. Quem já girou recebe
 * de volta o que tirou, com `novo: false`, e a tela mostra o resultado guardado
 * em vez de girar de novo.
 *
 * O REGISTRO É DEFINITIVO
 * As rules proíbem create, update e delete para TODOS, inclusive o admin — só
 * o Admin SDK escreve aqui. Um benefício que o beneficiário pode reescrever não
 * é benefício, é campo editável; e um que a plataforma pode reescrever depois
 * não sustenta discussão nenhuma sobre o que foi combinado.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const admin = require('firebase-admin');
const { randomInt } = require('node:crypto');

const REGION = 'southamerica-east1';

/**
 * Os prêmios e o peso de cada um.
 *
 * Pesos IGUAIS de propósito: 25% pra cada, valor esperado de 2,5 meses por
 * motorista. Está explícito num lugar só porque é decisão de negócio, não
 * detalhe de implementação — mexer aqui muda quanto a plataforma abre mão por
 * associado, e isso merece ser uma linha visível e não um número perdido no
 * meio de um sorteio.
 *
 * Se um dia virar desigual (mais chance de 1 mês que de 4), a soma continua
 * sendo o divisor — não precisa somar 100.
 */
const PREMIOS = [
  { meses: 1, peso: 1 },
  { meses: 2, peso: 1 },
  { meses: 3, peso: 1 },
  { meses: 4, peso: 1 },
];

/**
 * Sorteio com `randomInt` do node, não com `Math.random`.
 *
 * `Math.random` não é criptográfico e o valor aqui vale dinheiro. Não é que
 * alguém vá prever a sequência do V8 na prática — é que não há razão pra
 * escolher a versão frágil quando a robusta é a mesma linha.
 */
function sortear() {
  const total = PREMIOS.reduce((s, p) => s + p.peso, 0);
  let ponto = randomInt(0, total);
  for (const p of PREMIOS) {
    if (ponto < p.peso) return p.meses;
    ponto -= p.peso;
  }
  // Inalcançável enquanto todo peso for >= 1; existe pra não retornar undefined
  // caso alguém edite PREMIOS e zere tudo.
  return PREMIOS[0].meses;
}

function makeSpinEntryBonus(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatório.');

    // Quem gira é MOTORISTA associado, e a checagem lê o doc de usuário em vez
    // de confiar em qualquer coisa que venha do cliente. Sessão anônima da
    // landing não passa daqui: ela não tem doc em users/.
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'A roleta é do motorista associado.'
      );
    }

    const ref = db.doc(`entryBonuses/${uid}`);

    // A transação é o que garante "uma vez". Ela lê e grava no mesmo passo
    // atômico: se duas chamadas chegarem juntas (toque duplo, dois aparelhos),
    // uma grava e a outra relê o que a primeira gravou.
    const { meses, novo } = await db.runTransaction(async (tx) => {
      const atual = await tx.get(ref);
      if (atual.exists) {
        return { meses: atual.data().meses, novo: false };
      }

      const sorteado = sortear();
      tx.set(ref, {
        uid,
        meses: sorteado,
        // Guardamos a régua usada NO MOMENTO do sorteio. Se os prêmios mudarem
        // depois, ainda dá pra explicar de onde saiu este resultado — sem isso,
        // um sorteio antigo fica impossível de auditar contra a tabela nova.
        premiosNaEpoca: PREMIOS.map((p) => ({ meses: p.meses, peso: p.peso })),
        spunAt: admin.firestore.FieldValue.serverTimestamp(),
        // OBSOLETOS — NÃO USE. Quem registra consumo de isenção é a FATURA.
        //
        // Eu criei estes dois achando que facilitava a vida de quem fosse
        // implementar a cobrança: "nascem nulos, é só marcar depois". Estava
        // errado, e a sessão que foi construir a taxa apontou o porquê:
        // consumo de isenção é fato de COBRANÇA, não de sorteio. Este
        // documento responde "o que foi sorteado" e nada mais.
        //
        // Pior: pra marcar aqui, alguém precisaria escrever num doc que é
        // `update: if false` pra todos — ou seja, teria que afrouxar a regra
        // que faz a roleta valer alguma coisa. O campo "conveniente" era um
        // convite a abrir a porta.
        //
        // Cada mês de fatura carrega a própria decisão de isenção. Fica
        // auditável sem ninguém reescrever histórico.
        //
        // Continuam sendo gravados porque documento já existente os tem, e
        // tirar campo de doc imutável é migração — não porque sirvam.
        aplicadoDe: null,
        aplicadoAte: null,
      });

      return { meses: sorteado, novo: true };
    });

    if (novo) {
      logger.info(`spinEntryBonus: ${uid} tirou ${meses} mes(es) sem taxa.`);
    }

    return { meses, novo, premios: PREMIOS.map((p) => p.meses) };
  });
}

module.exports = { makeSpinEntryBonus, PREMIOS };
