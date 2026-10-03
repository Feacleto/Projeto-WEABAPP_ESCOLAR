/**
 * O CONTADOR DE TENTATIVAS (03/10/2026) — quem escreve o que
 * `reguaDasTentativas.js` decide.
 *
 * Um documento por `{escopo}_{quem}_{janela}` em `limitesDeTentativa`, só
 * pelo Admin SDK: a coleção não aparece nas rules, e o padrão (negar) é o que
 * impede quem está sendo contado de zerar o próprio contador. `expiraEm` é o
 * fim da janela — com a política de TTL do Firestore ligada nesse campo, os
 * documentos velhos somem sozinhos.
 *
 * ⚠️ FALHAR EM CONTAR NÃO TRANCA NINGUÉM. Se a leitura ou a transação cair, a
 * chamada segue: um limite que derruba a família quando o banco soluça é pior
 * que o laço que ele segura.
 */

'use strict';

const crypto = require('crypto');
const { logger } = require('firebase-functions/v2');
const {
  chaveDaTentativa,
  fimDaJanelaMs,
  cabeMaisUma,
  ipDaRequisicao,
} = require('./reguaDasTentativas');

const COLECAO = 'limitesDeTentativa';

/** O IP de quem chamou, resumido — o IP cru não vai para o banco. */
function quemPeloIp(rawRequest) {
  const ip = ipDaRequisicao({ ip: rawRequest?.ip, headers: rawRequest?.headers });
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

function refDe(db, regra, quem, agoraMs) {
  return db.doc(`${COLECAO}/${chaveDaTentativa({ regra, quem, agoraMs })}`);
}

/** Só confere: `true` se ainda cabe uma tentativa. Não escreve. */
async function aindaCabe(db, regra, quem, agoraMs = Date.now()) {
  try {
    const snap = await refDe(db, regra, quem, agoraMs).get();
    return cabeMaisUma({ regra, contagem: snap.exists ? snap.data().contagem : 0 });
  } catch (err) {
    logger.warn('[limite] falhou ao conferir', { escopo: regra.escopo, err: err?.message });
    return true;
  }
}

/** Conta uma tentativa (sem conferir). Usado para contar só o erro. */
async function contar(db, regra, quem, agoraMs = Date.now()) {
  const ref = refDe(db, regra, quem, agoraMs);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const contagem = (snap.exists ? Number(snap.data().contagem) || 0 : 0) + 1;
      tx.set(ref, {
        contagem,
        escopo: regra.escopo,
        expiraEm: new Date(fimDaJanelaMs({ regra, agoraMs })),
      });
    });
  } catch (err) {
    logger.warn('[limite] falhou ao contar', { escopo: regra.escopo, err: err?.message });
  }
}

/**
 * Confere E conta, na mesma transação: `true` se a tentativa foi aceita.
 * Usado onde toda chamada custa (pedido de acesso, formulário público).
 */
async function consumir(db, regra, quem, agoraMs = Date.now()) {
  const ref = refDe(db, regra, quem, agoraMs);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.exists ? Number(snap.data().contagem) || 0 : 0;
      if (!cabeMaisUma({ regra, contagem: atual })) return false;
      tx.set(ref, {
        contagem: atual + 1,
        escopo: regra.escopo,
        expiraEm: new Date(fimDaJanelaMs({ regra, agoraMs })),
      });
      return true;
    });
  } catch (err) {
    logger.warn('[limite] falhou ao consumir', { escopo: regra.escopo, err: err?.message });
    return true;
  }
}

module.exports = { quemPeloIp, aindaCabe, contar, consumir, COLECAO };
