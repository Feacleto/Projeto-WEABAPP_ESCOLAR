/**
 * O CONTATO DO INVESTIDOR QUE CHEGA PELO SITE — régua pura (02/10/2026).
 *
 * A página /investidores da landing tem um formulário curto: nome, e-mail e
 * WhatsApp opcional. Quem grava é `interesseInvestidor.js`; quem decide se o
 * que chegou é um contato é esta função, sem `require` nenhum — senão o teste
 * dela alcançaria o SDK (ver `testar:imports`).
 *
 * ── É UM FORMULÁRIO PÚBLICO, E A RÉGUA SE COMPORTA COMO TAL
 *  - tudo é cortado num tamanho máximo: o banco não guarda o que alguém colar;
 *  - o campo-isca `site` fica escondido da pessoa. Robô preenche; gente não.
 *    Com a isca preenchida a resposta é "ok" e NADA é gravado — dizer "erro"
 *    ensinaria o robô a tirar o campo;
 *  - o WhatsApp guarda só os dígitos.
 */

const LIMITE = { nome: 80, email: 120, whatsapp: 20, linkedin: 200 };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* O LinkedIn é como o dono confere que quem escreveu é investidor: link do
 * perfil, host linkedin.com ou *.linkedin.com. Sem protocolo, vira https://.
 * Devolve o link normalizado ou null. */
function linkDoLinkedin(v) {
  const bruto = String(v == null ? '' : v).trim();
  if (!bruto || bruto.length > LIMITE.linkedin || /\s/.test(bruto)) return null;
  const comProtocolo = /^[a-z][a-z0-9+.-]*:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  let u;
  try { u = new URL(comProtocolo); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase();
  if (h !== 'linkedin.com' && !h.endsWith('.linkedin.com')) return null;
  const href = u.href;
  return href.length <= LIMITE.linkedin ? href : null;
}

function texto(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Devolve `{ ok: true, lead }`, `{ ok: true, isca: true }` (robô: responder
 * ok e não gravar) ou `{ ok: false, erro }`.
 */
function lerLead(corpo) {
  const c = corpo && typeof corpo === 'object' ? corpo : {};
  if (texto(c.site, 200)) return { ok: true, isca: true };
  const nome = texto(c.nome, LIMITE.nome);
  const email = texto(c.email, LIMITE.email).toLowerCase();
  const whatsapp = String(c.whatsapp == null ? '' : c.whatsapp).replace(/\D/g, '').slice(0, LIMITE.whatsapp);
  if (nome.length < 2) return { ok: false, erro: 'nome' };
  if (!EMAIL.test(email)) return { ok: false, erro: 'email' };
  const linkedin = linkDoLinkedin(c.linkedin);
  if (!linkedin) return { ok: false, erro: 'linkedin' };
  return { ok: true, lead: { nome, email, whatsapp, linkedin } };
}

module.exports = { lerLead, LIMITE };
