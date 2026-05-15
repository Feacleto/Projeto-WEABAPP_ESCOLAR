/**
 * Wrapper minimalista da API HTTP do Resend (https://resend.com/docs/api-reference).
 * Não usamos SDK pra evitar dependência extra — Node 20 já tem fetch nativo.
 *
 * Espera variável de ambiente / secret `RESEND_API_KEY`.
 */

const RESEND_URL = 'https://api.resend.com/emails';

async function sendEmail({ apiKey, from, to, subject, html, text, replyTo }) {
  if (!apiKey) throw new Error('RESEND_API_KEY ausente.');
  if (!to) throw new Error('Destinatário ausente.');

  const body = {
    from,
    to: [to],
    subject,
    html,
  };
  if (text) body.text = text;
  if (replyTo) body.reply_to = replyTo;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return await res.json();
}

module.exports = { sendEmail };
