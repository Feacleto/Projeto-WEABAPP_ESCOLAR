/**
 * Wrapper minimalista da API HTTP do Resend (https://resend.com/docs/api-reference).
 * Não usamos SDK pra evitar dependência extra — Node 20 já tem fetch nativo.
 *
 * Espera variável de ambiente / secret `RESEND_API_KEY`.
 *
 * ⚠️ O ENVIO TEM PRAZO: 10 SEGUNDOS (03/10/2026). Quem chama é o `push.js`,
 * que roda dentro do gatilho de TODA notificação. Um `fetch` sem prazo contra
 * um Resend lento prende a instância do gatilho até o timeout da function — e
 * o teto de instâncias do gatilho é o mesmo que entrega "a perua está
 * chegando". Um e-mail de fatura não pode atrasar o aviso de chegada.
 *
 * ⚠️ E PODE LEVAR UMA CHAVE DE IDEMPOTÊNCIA. Gatilho do Firestore é entregue
 * "pelo menos uma vez": a mesma notificação pode disparar o gatilho duas
 * vezes, e sem a chave o motorista recebe a mesma cobrança em dobro. Com o
 * cabeçalho `Idempotency-Key`, o Resend devolve o envio anterior em vez de
 * mandar de novo (a chave vale por 24 horas do lado deles).
 */

const RESEND_URL = 'https://api.resend.com/emails';

/** Quanto o envio pode esperar o Resend antes de desistir. */
const PRAZO_DO_ENVIO_MS = 10000;

async function sendEmail({ apiKey, from, to, subject, html, text, replyTo, idempotencyKey }) {
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

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  // O Resend aceita até 256 caracteres; o id de um documento do Firestore
  // tem 20, então a chave cabe com folga mesmo prefixada.
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PRAZO_DO_ENVIO_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return await res.json();
}

module.exports = { sendEmail, PRAZO_DO_ENVIO_MS };
