/**
 * O QUE UM CONVITE PRECISA SER PARA VALER (03/10/2026) — régua pura.
 *
 * `lookupInvite`, `redeemInvite` e `getInvitePreview` decidiam o formato do
 * código cada um com a sua cópia, e duas das três aceitavam o formato LEGADO
 * (2 letras + 4 dígitos: 9.000 combinações, varríveis em minutos). Desde
 * 2026 nenhum código nasce assim — o legado só servia de alvo.
 *
 * TRÊS DECISÕES, todas contra a tentativa e erro:
 *
 *  1. SÓ O FORMATO NOVO (2 letras + 6 do alfabeto sem ambiguidade, ~730 mi).
 *     Quem ainda tiver um link antigo recebe a resposta genérica e pede um
 *     link novo ao motorista — que agora tem o botão "Gerar link novo".
 *
 *  2. O CONVITE VALE 15 DIAS (decisão do dono). Conta de `inviteCriadoEm`
 *     (gravado ao criar e ao gerar link novo), e na falta dele de `createdAt`.
 *     ⚠️ SEM NENHUM DOS DOIS O CONVITE CONTINUA VALENDO: são crianças antigas,
 *     anteriores ao carimbo, e recusar ali derrubaria convites legítimos sem
 *     o motorista saber por quê. Um link parado no WhatsApp de alguém para
 *     sempre é exatamente o que o prazo veio fechar — nos novos.
 *     ⚠️ O PRAZO VALE SÓ PARA O CONVITE AINDA NÃO USADO. Para a família já
 *     vinculada o mesmo link é a porta de volta ao app, pra sempre
 *     (`status: 'yours'` em invitePreview.js) — isso não muda.
 *
 *  3. UMA RESPOSTA SÓ para "não existe", "já foi usado" e "venceu". Respostas
 *     diferentes ensinam a quem está varrendo que acertou um código real (e
 *     o 'taken' ainda entregava o primeiro nome da criança).
 *
 * PURA: sem `require` (ver `npm run testar:imports`).
 */

'use strict';

const ALFABETO = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const FORMATO_DO_CODIGO = new RegExp('^[A-Z]{2}[' + ALFABETO + ']{6}$');

const VALIDADE_DO_CONVITE_DIAS = 15;
const DIA_MS = 24 * 60 * 60 * 1000;

const MENSAGEM_DO_CONVITE_RECUSADO = 'Este convite não vale mais. Peça um link novo ao motorista.';

function normalizarCodigo(bruto) {
  return String(bruto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function codigoValido(codigo) {
  return typeof codigo === 'string' && FORMATO_DO_CODIGO.test(codigo);
}

/** Milissegundos de um Timestamp do Admin SDK, Date ou número; senão null. */
function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  return null;
}

/** Quando o prazo do convite desta criança acaba, em ms — ou null (sem prazo). */
function conviteValidoAteMs(crianca) {
  const criado = emMs(crianca?.inviteCriadoEm) ?? emMs(crianca?.createdAt);
  if (criado == null) return null;
  return criado + VALIDADE_DO_CONVITE_DIAS * DIA_MS;
}

/** O convite (ainda não usado) desta criança já venceu? */
function conviteVencido(crianca, agoraMs) {
  const ate = conviteValidoAteMs(crianca);
  if (ate == null) return false;
  return agoraMs > ate;
}

module.exports = {
  ALFABETO,
  FORMATO_DO_CODIGO,
  VALIDADE_DO_CONVITE_DIAS,
  MENSAGEM_DO_CONVITE_RECUSADO,
  normalizarCodigo,
  codigoValido,
  conviteValidoAteMs,
  conviteVencido,
};
