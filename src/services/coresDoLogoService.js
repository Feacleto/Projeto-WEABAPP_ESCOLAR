import { coresDoLogo } from '../marca/corDaMarca.js';

/**
 * LÊ AS CORES DE UM LOGO no próprio aparelho (03/10/2026).
 *
 * A imagem é desenhada pequena num canvas (64 px no lado maior — cor de
 * marca não precisa de resolução, e o celular barato agradece) e os pixels
 * vão para a régua pura `coresDoLogo`. Nada sai do aparelho.
 *
 * Aceita o ARQUIVO recém-escolhido (o caminho normal: a cor nasce no mesmo
 * gesto do upload) ou a URL do logo já salvo. ⚠️ Pela URL o canvas só é
 * legível se o Storage responder com CORS; se não responder, devolve [] e a
 * tela pede para enviar o logo de novo — nunca uma cor inventada.
 */
const LADO = 64;

function carregar(src, cruzado) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cruzado) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function lerCoresDoLogo(fonte) {
  let url = null;
  let temporaria = false;
  try {
    if (typeof fonte === 'string') {
      url = fonte;
    } else if (fonte instanceof Blob) {
      url = URL.createObjectURL(fonte);
      temporaria = true;
    } else {
      return [];
    }
    const img = await carregar(url, !temporaria);
    const escala = Math.min(1, LADO / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || LADO) * escala));
    const h = Math.max(1, Math.round((img.naturalHeight || LADO) * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return coresDoLogo(ctx.getImageData(0, 0, w, h).data);
  } catch (err) {
    console.error('lerCoresDoLogo', err);
    return [];
  } finally {
    if (temporaria && url) URL.revokeObjectURL(url);
  }
}
