/**
 * O AVISO QUE TAMBÉM VAI POR E-MAIL (03/10/2026) — o gatilho. Quais avisos e
 * o texto são régua pura, em `emailDoAviso.js`.
 *
 * Mesmo desenho do push: amarrado na criação de `notifications/{id}`, para
 * nenhum remetente novo nascer sem ele. Respeita a mesma preferência por
 * espécie do push (`tocaNoAparelho`): quem desligou "prazos" não recebe o
 * prazo por outra porta.
 *
 * ⚠️ O REMETENTE é o parâmetro `EMAIL_REMETENTE`. Enquanto o domínio não for
 * verificado no Resend, só o remetente de teste funciona — e ele SÓ ENTREGA
 * ao e-mail do dono da conta do Resend. Ver docs/deploy.md.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { sendEmail } = require('./resend');
const { tocaNoAparelho } = require('./avisos');
const { urlDoAviso } = require('./destinoDoAviso');
const { vaiPorEmail, montarEmailDoAviso } = require('./emailDoAviso');

const REGION = 'southamerica-east1';

function makeEnviarEmailDoAviso(db, { chave, remetente }) {
  return onDocumentCreated(
    {
      document: 'notifications/{notifId}',
      region: REGION,
      maxInstances: LIMITES.GATILHO,
      secrets: [chave],
    },
    async (event) => {
      const aviso = event.data && event.data.data();
      if (!aviso || !aviso.userId || !vaiPorEmail(aviso.type)) return;

      const snap = await db.doc(`users/${aviso.userId}`).get();
      if (!snap.exists) return;
      const usuario = snap.data();
      if (!usuario.email) return;
      if (!tocaNoAparelho(aviso.type, usuario.avisosDesligados)) return;

      const { assunto, html, text } = montarEmailDoAviso({
        aviso,
        nome: usuario.name,
        url: urlDoAviso(aviso, usuario.role),
      });
      try {
        await sendEmail({
          apiKey: chave.value(),
          from: remetente.value(),
          to: usuario.email,
          subject: assunto,
          html,
          text,
        });
        logger.info(`[email] ${aviso.type} enviado`, { notifId: event.params.notifId });
      } catch (err) {
        // E-mail é o canal de reserva: falhar aqui não pode quebrar nada.
        logger.warn(`[email] ${aviso.type} falhou`, { erro: String(err && err.message) });
      }
    }
  );
}

module.exports = { makeEnviarEmailDoAviso };
