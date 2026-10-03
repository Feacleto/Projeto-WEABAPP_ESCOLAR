/**
 * O AVISO TAMBÉM POR E-MAIL — a régua (03/10/2026).
 *
 * ── POR QUE E QUAIS
 * O push não chega a todo mundo: iPhone só recebe com o app instalado na tela
 * de início, e quem negou a permissão uma vez não é perguntado de novo. Para
 * a maior parte dos avisos isso é aceitável — "a perua está chegando" por
 * e-mail chegaria depois da perua. Mas há uma lista curta de avisos que não
 * têm hora e não podem se perder: contrato para assinar, pagamento
 * confirmado, acesso aprovado, o fim da associação. Esses vão também por
 * e-mail. A lista é FECHADA aqui, e o teste exige que nenhum aviso de ROTA
 * entre nela.
 *
 * ── O QUE FICA DE FORA, DE PROPÓSITO
 *   - tudo da rota (chegando, chegou, embarcou, buzina): e-mail é lento;
 *   - os lembretes de mensalidade: têm régua própria de canal
 *     (`canalDaCobranca.js`, um marco, um canal) e template próprio;
 *   - oferta comercial: e-mail de venda sem pedido é o que faz o domínio
 *     inteiro cair no spam — e com ele o contrato para assinar.
 *
 * PURA: sem `require`. `npm run testar:notificacoes`.
 */

'use strict';

const TIPOS_POR_EMAIL = [
  // família
  'contrato_pronto',
  'payment_confirmed',
  'acesso_aprovado',
  'irmao_vinculado',
  'chamado_respondido',
  // motorista
  'pedido_de_acesso',
  'contract_accepted',
  'fatura_vence',
  'encerramento_30d',
  'encerramento_7d',
  'encerramento_fim',
  'indicacao_ativou',
  // dono
  'lead_investidor',
];

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

module.exports = { TIPOS_POR_EMAIL, vaiPorEmail, montarEmailDoAviso, escapar };
