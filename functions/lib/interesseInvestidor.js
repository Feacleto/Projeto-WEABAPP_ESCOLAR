/**
 * O FORMULÁRIO DO INVESTIDOR GRAVA AQUI (02/10/2026).
 *
 * A landing é HTML estático e a CSP dela só deixa falar com o próprio site
 * (`connect-src 'self'`). Por isso o formulário manda para
 * `alobuzinou.com.br/api/interesse-investidor`, e o hosting repassa para esta
 * function (rewrite em firebase.json). Não precisou abrir a CSP.
 *
 * ── O QUE ELA FAZ
 *  1. aceita só POST com JSON;
 *  2. a régua (`reguaDoLead.js`) decide se é contato, robô ou erro;
 *  3. grava em `leadsInvestidor` (só o dono lê; ninguém escreve pelo cliente);
 *  4. avisa cada conta de DONO pelo sino — contato de investidor que ninguém
 *     vê é contato perdido.
 *
 * ⚠️ `invoker: 'public'`: quem chama é um visitante do site, sem conta.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { lerLead } = require('./reguaDoLead');

const REGION = 'southamerica-east1';

function makeRegistrarInteresseInvestidor(db) {
  return onRequest(
    { region: REGION, maxInstances: LIMITES.PUBLICO, invoker: 'public' },
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ ok: false });
        return;
      }
      const lido = lerLead(req.body);
      if (!lido.ok) {
        res.status(400).json({ ok: false, erro: lido.erro });
        return;
      }
      if (lido.isca) {
        res.json({ ok: true });
        return;
      }
      try {
        await db.collection('leadsInvestidor').add({
          ...lido.lead,
          origem: 'site/investidores',
          criadoEm: FieldValue.serverTimestamp(),
        });
        const donos = await db.collection('users').where('role', '==', 'owner').get();
        await Promise.all(
          donos.docs.map((d) =>
            db.collection('notifications').add({
              userId: d.id,
              type: 'lead_investidor',
              title: `${lido.lead.nome.split(' ')[0]} quer receber o material de investidor`,
              body: lido.lead.email,
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            })
          )
        );
        res.json({ ok: true });
      } catch (err) {
        logger.error('[investidor] falhou ao gravar', { err: err?.message });
        res.status(500).json({ ok: false });
      }
    }
  );
}

module.exports = { makeRegistrarInteresseInvestidor };
