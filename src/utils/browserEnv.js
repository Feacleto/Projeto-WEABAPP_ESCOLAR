/**
 * Detecção do ambiente do navegador.
 *
 * POR QUE ISTO EXISTE
 * O caminho principal do responsável é tocar num link dentro da conversa do
 * WhatsApp. E o WhatsApp (como Instagram, Facebook e Messenger) abre a URL
 * num navegador EMBUTIDO, não no Chrome nem no Safari. Isso quebra duas
 * coisas que o app depende:
 *
 *   1. Login com Google. O Google recusa OAuth em webview embutida por
 *      política de segurança — devolve `disallowed_useragent`. O pai toca em
 *      "Continuar com Google" e recebe uma página de erro do Google, que é a
 *      pior coisa que pode acontecer no primeiro contato dele com o app.
 *
 *   2. Persistência da sessão. O armazenamento da webview é separado do
 *      navegador de verdade. Ele loga dentro do WhatsApp, e ao abrir o
 *      Chrome depois está deslogado — sem entender por quê.
 *
 * Então em webview embutida: email/senha vira o caminho principal, e a gente
 * oferece abrir no navegador de verdade.
 */

/** Navegador embutido de app de mensagem/rede social. */
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // FBAN/FBAV = Facebook; FB_IAB = in-app browser; Line/MicroMessenger
  // (WeChat) entram porque o comportamento é o mesmo.
  const patterns = [
    /FBAN|FBAV|FB_IAB/i,
    /Instagram/i,
    /\bWhatsApp\b/i,
    /\bLine\//i,
    /MicroMessenger/i,
    /\bGSA\//i, // app do Google no iOS
  ];
  return patterns.some((re) => re.test(ua));
}

/**
 * O login com Google é confiável aqui?
 *
 * Em webview embutida, não: o Google bloqueia. Melhor nem oferecer como
 * caminho principal do que oferecer e entregar erro.
 */
export function canUseGoogleSignIn() {
  return !isInAppBrowser();
}

/** iOS — o prompt de instalação do PWA não existe, é instrução manual. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPad com iOS 13+ se apresenta como Mac; o toque no ponteiro delata.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/** Já está rodando como app instalado (tela de início)? */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    // iOS usa uma propriedade própria, fora do padrão.
    window.navigator.standalone === true
  );
}
