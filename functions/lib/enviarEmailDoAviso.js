/**
 * O E-MAIL DA COBRANÇA DA PLATAFORMA AO MOTORISTA (03/10/2026). Quais avisos,
 * para quem e o texto são régua pura, em `emailDoAviso.js`.
 *
 * ⚠️ NÃO É MAIS UM GATILHO PRÓPRIO: é chamado de dentro do `push.js`, que já
 * dispara em toda notificação nova e já leu o documento do usuário. Como
 * gatilho separado, ele acordava uma segunda função para CADA aviso do app
 * (~500 mil por mês nesta escala) só para descobrir, em quase todas, que não
 * era fatura.
 *
 * ⚠️ NÃO OBEDECE À PREFERÊNCIA DE "PRAZOS". Quem desliga prazos cala o push da
 * fatura — e a tela de preferências avisa que a cobrança continua chegando. É
 * este e-mail que a faz chegar.
 *
 * ⚠️ O REMETENTE é o parâmetro `EMAIL_REMETENTE`. Enquanto o domínio não for
 * verificado no Resend, só o remetente de teste funciona — e ele SÓ ENTREGA
 * ao e-mail do dono da conta do Resend. Ver docs/deploy.md.
 */

const { logger } = require('firebase-functions/v2');
const { sendEmail } = require('./resend');
const { urlDoAviso } = require('./destinoDoAviso');
const { vaiPorEmail, montarEmailDoAviso, PAPEL_QUE_RECEBE_EMAIL } = require('./emailDoAviso');

/** Manda o e-mail se o aviso for da lista e o destinatário for motorista. Nunca lança. */
async function enviarEmailSeFor({ aviso, usuario, notifId, chave, remetente }) {
  if (!aviso || !vaiPorEmail(aviso.type)) return;
  if (!usuario || !usuario.email || usuario.role !== PAPEL_QUE_RECEBE_EMAIL) return;
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
    logger.info(`[email] ${aviso.type} enviado`, { notifId });
  } catch (err) {
    logger.warn(`[email] ${aviso.type} falhou`, { notifId, erro: String(err && err.message) });
  }
}

module.exports = { enviarEmailSeFor };
