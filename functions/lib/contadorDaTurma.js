/**
 * O CONTADOR DA TURMA — `users.criancasAtivas`, mantido pelo SERVIDOR.
 *
 * ── POR QUE (03/10/2026)
 * O número multiplica a taxa na fatura da plataforma, e era escrito pelo
 * cliente com `increment(±1)` no mesmo lote da criança. As rules conseguiam
 * exigir o passo de um em um, nunca que o passo correspondesse a uma criança
 * de verdade: descer o contador "devolvendo" a vaga de uma criança que seguia
 * ativa fazia a fatura sair menor. Agora o cliente não escreve o campo (as
 * rules recusam), e este gatilho RECONTA a cada mudança que importa.
 *
 * ── RECONTA, NUNCA INCREMENTA
 * Gatilho do Firestore entrega "pelo menos uma vez" e fora de ordem. Um
 * incremento entregue duas vezes ficaria errado para sempre; uma recontagem
 * repetida chega ao mesmo número. É a mesma escolha de `casarEAtivar` com as
 * indicações.
 *
 * ── SEM LAÇO
 * Escreve em `users`, nunca em `children` — não dispara a si mesmo.
 *
 * ── A REGRA DO QUE CONTA mora em `reguaDaTurma.js`, pura e testada.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { motoristasParaRecontar, precisaGravar } = require('./reguaDaTurma');

const REGION = 'southamerica-east1';

/** A consulta da contagem — o MESMO filtro de `billing.js` (`active == true`). */
function consultaDasAtivas(db, uid) {
  return db
    .collection('children')
    .where('adminUid', '==', uid)
    .where('active', '==', true)
    .count();
}

/** Quantas crianças ativas o motorista tem AGORA, contadas no banco. */
async function contarCriancasAtivas(db, uid) {
  if (!uid) return 0;
  const snap = await consultaDasAtivas(db, uid).get();
  return Number(snap.data().count) || 0;
}

/**
 * Reconta e grava, se mudou.
 *
 * ⚠️ EM TRANSAÇÃO, E O MOTIVO É A CORRIDA ENTRE DOIS GATILHOS. Duas crianças
 * cadastradas no mesmo segundo disparam duas recontagens; a que contou ANTES
 * da segunda criança pode gravar DEPOIS e deixar o número velho. Lendo
 * `users/{uid}` dentro da transação, a que commita por último encontra o
 * documento mudado pela outra, é repetida e reconta.
 *
 * ⚠️ `update`, nunca `set`: se o documento do motorista não existe (ele
 * encerrou a conta, e as crianças estão sendo apagadas depois), criar um
 * `users/{uid}` só com o contador seria ressuscitar uma conta pela metade.
 */
async function recontar(db, uid) {
  const ref = db.doc(`users/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const contagem = Number((await tx.get(consultaDasAtivas(db, uid))).data().count) || 0;
    if (!precisaGravar(snap.data().criancasAtivas, contagem)) return contagem;
    tx.update(ref, { criancasAtivas: contagem });
    return contagem;
  });
}

function makeContarCriancasAtivas(db) {
  return onDocumentWritten(
    { document: 'children/{childId}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = event.data && event.data.before && event.data.before.exists
        ? event.data.before.data()
        : null;
      const depois = event.data && event.data.after && event.data.after.exists
        ? event.data.after.data()
        : null;

      const uids = motoristasParaRecontar(antes, depois);
      for (const uid of uids) {
        try {
          const n = await recontar(db, uid);
          logger.info('[turma] recontada', { uid, criancasAtivas: n, childId: event.params.childId });
        } catch (err) {
          // ⚠️ LANÇA DE NOVO, para a execução aparecer como FALHA no console
          // em vez de um log qualquer. Não há `retry` ligado: o número velho
          // fica até a próxima mudança da turma — e a fatura não depende
          // dele, porque o fechamento do mês conta de novo por conta própria.
          logger.error('[turma] não deu para recontar', { uid, err });
          throw err;
        }
      }
    }
  );
}

module.exports = { makeContarCriancasAtivas, contarCriancasAtivas, recontar };
