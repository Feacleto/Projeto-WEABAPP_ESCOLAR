/**
 * O E-MAIL DA PLATAFORMA — só para a COBRANÇA DA PLATAFORMA AO MOTORISTA
 * (decisão do dono, 03/10/2026).
 *
 * ── POR QUE SÓ ISSO
 * E-mail custa (o Resend grátis manda 100 por dia) e é o canal que mais cai
 * em spam. Tudo o que é do dia a dia vai pelo app: o cartão com o app aberto,
 * o push com o app fechado, e o sino como registro. O e-mail fica para o que
 * a plataforma COBRA de quem paga por ela — o motorista —, porque é dinheiro,
 * tem data, e é o aviso que não pode depender de um celular com o app.
 *
 * ── O QUE SAIU, E POR QUÊ
 *   - a mensalidade da família: é um combinado entre ela e o motorista, e é
 *     lembrada por push (`canalDaCobranca.js`);
 *   - contrato, pagamento confirmado, acesso, encerramento, indicação, contato
 *     de investidor: ficam no push e no sino. O formulário de investidor é
 *     público, e cada envio virava um e-mail — um robô gastaria a cota inteira
 *     e calaria a cobrança junto.
 *
 * ⚠️ SÓ O SERVIDOR CRIA ESTES TIPOS: as rules recusam um cliente escrevendo
 * `fatura_vence`, e o gatilho só manda para quem é MOTORISTA. Sem as duas
 * travas, um motorista escreveria um "aviso" para a família dele e o texto
 * dele sairia pelo remetente oficial.
 *
 * PURA: sem `require`. `npm run testar:notificacoes`.
 */

'use strict';

const TIPOS_POR_EMAIL = [
  // a fatura da plataforma vence em 3 dias (`reguaDosAvisos.avisoDaFatura`)
  'fatura_vence',
];

/** Quem recebe e-mail: só o motorista, que é quem paga a plataforma. */
const PAPEL_QUE_RECEBE_EMAIL = 'admin';

function vaiPorEmail(tipo) {
  return TIPOS_POR_EMAIL.indexOf(String(tipo || '')) !== -1;
}

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Monta o e-mail a partir do PRÓPRIO aviso — o mesmo título e a mesma frase
 * do push e do sino. Um texto só por aviso: três versões da mesma notícia
 * envelhecem em três ritmos.
 */
function montarEmailDoAviso({ aviso, nome, url }) {
  const titulo = String((aviso && aviso.title) || 'Aviso do Alô Buzinou');
  const corpo = String((aviso && (aviso.texto || aviso.body)) || '');
  const ola = String(nome || '').trim().split(/\s+/)[0];
  const assunto = titulo;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:24px;background:#EEF1EF;font-family:Arial,Helvetica,sans-serif;color:#0B1210">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
<p style="margin:0 0 16px;font-size:14px;color:#55606E">Alô Buzinou</p>
${ola ? `<p style="margin:0 0 12px;font-size:18px">Olá, ${escapar(ola)}!</p>` : ''}
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapar(titulo)}</h1>
${corpo ? `<p style="margin:0 0 24px;font-size:18px;line-height:1.5;white-space:pre-line">${escapar(corpo)}</p>` : ''}
<a href="${escapar(url)}" style="display:inline-block;background:#1F5F3F;color:#ffffff;text-decoration:none;font-size:18px;font-weight:bold;padding:14px 24px;border-radius:12px">Abrir no app</a>
<p style="margin:24px 0 0;font-size:14px;color:#55606E;line-height:1.5">Você recebe este e-mail porque tem uma conta no Alô Buzinou. Os avisos podem ser ajustados no próprio app, no sino.</p>
</div></body></html>`;
  const text = `${ola ? `Olá, ${ola}!\n\n` : ''}${titulo}\n\n${corpo ? `${corpo}\n\n` : ''}Abrir no app: ${url}\n\n— Alô Buzinou`;
  return { assunto, html, text };
}

module.exports = { TIPOS_POR_EMAIL, PAPEL_QUE_RECEBE_EMAIL, vaiPorEmail, montarEmailDoAviso, escapar };
