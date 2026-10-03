import { analyticsLigado } from '../firebase/config';
import { caminhoSemSegredo } from '../compartilhado/caminhoSemSegredo.js';

/**
 * O REGISTRO DE TELA DO ANALYTICS — manual, e sem o segredo da URL.
 *
 * O `send_page_view` automático saiu em 03/10/2026 (ver `firebase/config.js`):
 * ele mandava a URL inteira, com o código do convite e o link de acompanhar
 * dentro. Agora quem conta é esta função, chamada a cada troca de rota, e o
 * endereço passa antes por `caminhoSemSegredo`.
 *
 * Sem consentimento, `analyticsLigado()` devolve `null` e nada sai. Quem
 * aceita os cookies no meio da visita tem a tela ATUAL contada no instante
 * do aceite — senão a primeira tela de todo mundo que aceita sumiria.
 */
let ultimoCaminho = null;

async function enviar(caminho) {
  const analytics = await analyticsLigado();
  if (!analytics) return;
  try {
    const { logEvent, setDefaultEventParameters } = await import('firebase/analytics');
    const limpo = caminhoSemSegredo(caminho);
    const page_location = `${window.location.origin}${limpo}`;
    // O padrão de TODO evento, não só deste: o SDK carimba `page_location`
    // em cada evento com o endereço do documento.
    setDefaultEventParameters({ page_location, page_path: limpo });
    logEvent(analytics, 'page_view', { page_location, page_path: limpo });
  } catch {
    // Analytics é acessório: nunca derruba uma navegação.
  }
}

export function registrarVisita(caminho) {
  ultimoCaminho = caminho;
  enviar(caminho);
}

if (typeof window !== 'undefined') {
  window.addEventListener('tn-analytics-consent', () => {
    if (ultimoCaminho) enviar(ultimoCaminho);
  });
}
