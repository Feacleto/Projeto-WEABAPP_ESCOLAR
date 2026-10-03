/**
 * ATÉ QUANDO O CONVITE VALE (03/10/2026) — o lado do app.
 *
 * Decisão do dono: o convite ainda não usado vale 15 DIAS, contados de
 * `inviteCriadoEm` (gravado ao cadastrar a criança e a cada "Gerar link
 * novo"), e na falta dele de `createdAt`. Sem nenhum dos dois, vale — são
 * cadastros anteriores ao carimbo.
 *
 * ⚠️ ESPELHA `functions/lib/reguaDoConvite.js`, que é quem RECUSA. Esta cópia
 * só escreve "Este link vale até 18/10" na ficha; se as duas divergirem, a
 * tela promete um prazo que o servidor não cumpre. `npm run testar:auth`
 * compara as duas caso a caso.
 */

export const VALIDADE_DO_CONVITE_DIAS = 15;
const DIA_MS = 24 * 60 * 60 * 1000;

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  return null;
}

/** Quando o prazo do convite desta criança acaba, em ms — ou null (sem prazo). */
export function conviteValidoAteMs(crianca) {
  const criado = emMs(crianca?.inviteCriadoEm) ?? emMs(crianca?.createdAt);
  if (criado == null) return null;
  return criado + VALIDADE_DO_CONVITE_DIAS * DIA_MS;
}

/** O convite (ainda não usado) desta criança já venceu? */
export function conviteVencido(crianca, agoraMs) {
  const ate = conviteValidoAteMs(crianca);
  if (ate == null) return false;
  return agoraMs > ate;
}
