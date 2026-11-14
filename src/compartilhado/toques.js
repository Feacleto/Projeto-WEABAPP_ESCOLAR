/**
 * O TOQUE QUE CHEGA CEDO DEMAIS NUM DIÁLOGO — o segundo toque de um duplo
 * toque que abriu o diálogo cai no botão que acabou de aparecer embaixo do
 * dedo. Diálogo sem volta ignora toques nos primeiros `ms`.
 */
export function toqueCedoDemais(abertoEmMs, agoraMs, ms = 400) {
  if (abertoEmMs == null) return false;
  return agoraMs - abertoEmMs < ms;
}
