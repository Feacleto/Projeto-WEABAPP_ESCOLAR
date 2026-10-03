/**
 * OS GATILHOS DOS AVISOS DA ROTA AO VIVO (03/10/2026) — "está chegando" e a
 * buzina com o app fechado. O texto e a decisão são régua pura, em
 * `reguaDaRotaAoVivo.js`; aqui só se lê o que ela precisa e se escreve a
 * notificação. Quem a leva ao aparelho é `push.js`, como todo aviso.
 */

const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { avisoDeAproximacao, textoDaAproximacao, textoDaBuzina } = require('./reguaDaRotaAoVivo');
const { statusDeHoje } = require('./reguaDosAvisos');

const REGION = 'southamerica-east1';

async function marcaDoMotorista(db, adminUid) {
  if (!adminUid) return '';
  const snap = await db.doc(`users/${adminUid}`).get();
  if (!snap.exists) return '';
  const u = snap.data();
  return String(u.marcaNome || '').trim();
}

/** A faixa da perua mudou em `rides/{dia}` → talvez "está chegando". */
function makeAvisarAproximacao(db) {
  return onDocumentWritten(
    { document: 'children/{childId}/rides/{dia}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = event.data && event.data.before && event.data.before.exists
        ? event.data.before.data()
        : {};
      const depois = event.data && event.data.after && event.data.after.exists
        ? event.data.after.data()
        : null;
      if (!depois || depois.proximidade === antes.proximidade) return;

      const childId = event.params.childId;
      const childSnap = await db.doc(`children/${childId}`).get();
      if (!childSnap.exists) return;
      const crianca = childSnap.data();
      if (!crianca.parentUid || crianca.active === false) return;

      const statusDaCrianca = statusDeHoje(crianca, new Date());
      const zona = avisoDeAproximacao({
        anterior: antes.proximidade || null,
        atual: depois.proximidade,
        statusDaCrianca,
      });
      if (!zona) return;

      const quem = await marcaDoMotorista(db, crianca.adminUid);
      const texto = textoDaAproximacao({ zona, quem, nomeDaCrianca: crianca.name, statusDaCrianca });
      await db.collection('notifications').add({
        userId: crianca.parentUid,
        ...texto,
        childId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      logger.info(`[rota] ${texto.type} child=${childId}`);
    }
  );
}

/** A buzina nasceu → a notificação que toca com o app fechado. */
function makeAvisarBuzina(db) {
  return onDocumentCreated(
    { document: 'pendingCalls/{callId}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const chamada = event.data && event.data.data();
      if (!chamada || !chamada.parentUid || chamada.status !== 'ringing') return;
      const quem = await marcaDoMotorista(db, chamada.adminUid);
      const texto = textoDaBuzina({ quem, momento: chamada.momento, nomeDaCrianca: chamada.childName });
      await db.collection('notifications').add({
        userId: chamada.parentUid,
        ...texto,
        childId: chamada.childId || null,
        callId: event.params.callId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  );
}

module.exports = { makeAvisarAproximacao, makeAvisarBuzina };
