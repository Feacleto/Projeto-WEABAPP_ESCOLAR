/**
 * TIRAR UMA CRIANÇA DA CONTA DA FAMÍLIA — sem apagar a conta (02/10/2026).
 *
 * ── POR QUE ISTO EXISTE
 * "Remover criança" (`deactivateChildAndParent`, no cliente do motorista)
 * APAGAVA o documento `users/{parentUid}` inteiro. A mãe de dois irmãos perdia
 * o acesso ao outro filho; a mãe com filho em OUTRA perua perdia o acesso ao
 * filho do outro motorista — e nenhum dos dois era avisado. Achado na leitura
 * das jornadas (teste no navegador).
 *
 * O cliente do motorista não pode fazer isto direito: as rules não deixam (e
 * não devem deixar) o motorista escrever no documento da família — só apagar.
 * Tirar UM `childId` da lista dela é trabalho de Admin SDK.
 *
 * ── O QUE FAZ, numa transação
 *   - confere que quem chama é o motorista DA criança;
 *   - tira a criança de `users.childIds` da família, e o motorista de
 *     `adminUids` se nenhum outro filho dela roda com ele (mesma regra de
 *     `recusarIrmao`);
 *   - só APAGA a conta quando não sobra filho nenhum — o comportamento antigo,
 *     que continua valendo para a família de um filho só.
 *
 * Quem desativa a criança (active:false, limpa vínculo e aceite) continua
 * sendo o cliente, depois desta chamada.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');

const REGION = 'southamerica-east1';

function makeDesvincularResponsavel(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    if (!childId) throw new HttpsError('invalid-argument', 'Qual criança?');

    const childRef = db.doc(`children/${childId}`);
    return db.runTransaction(async (tx) => {
      const c = await tx.get(childRef);
      const crianca = c.exists ? c.data() : null;
      if (!crianca) throw new HttpsError('not-found', 'Criança não encontrada.');
      // Escopo pelo uid AUTENTICADO, nunca por `request.data` (papeis.js).
      if (crianca.adminUid !== uid) {
        throw new HttpsError('permission-denied', 'Esta criança não é da sua turma.');
      }
      const parentUid = crianca.parentUid || null;
      if (!parentUid) return { ok: true, conta: 'sem-responsavel' };

      const userRef = db.doc(`users/${parentUid}`);
      const u = await tx.get(userRef);
      if (!u.exists) return { ok: true, conta: 'ja-nao-existe' };
      const familia = u.data();

      const outros = (familia.childIds || []).filter((id) => id !== childId);
      // Toda leitura antes de qualquer escrita (o Admin SDK exige, e
      // `testar:transacoes` confere).
      const outrosSnaps = await Promise.all(outros.map((id) => tx.get(db.doc(`children/${id}`))));
      if (outros.length === 0) {
        // Família de um filho só: o comportamento de sempre.
        tx.delete(userRef);
        return { ok: true, conta: 'apagada' };
      }

      // Tem outro filho (irmão ou em outra perua): a conta FICA.
      const aindaComEle = outrosSnaps.some((s) => s.exists && s.data().adminUid === uid);
      tx.set(
        userRef,
        {
          childIds: FieldValue.arrayRemove(childId),
          ...(!aindaComEle ? { adminUids: FieldValue.arrayRemove(uid) } : {}),
          ...(familia.childId === childId ? { childId: outros[0] } : {}),
          ...(familia.adminUid === uid && !aindaComEle
            ? { adminUid: outrosSnaps.find((s) => s.exists)?.data().adminUid || null }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, conta: 'mantida', filhosRestantes: outros.length };
    });
  });
}

module.exports = { makeDesvincularResponsavel };
