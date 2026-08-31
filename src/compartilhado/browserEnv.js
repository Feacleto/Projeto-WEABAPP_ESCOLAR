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

// ============================================================================
// Sair da webview pro navegador de verdade
// ============================================================================

/**
 * Tenta abrir a URL atual no navegador real do sistema.
 *
 * POR QUE ANTES DO LOGIN, E NÃO DEPOIS
 * O armazenamento da webview do WhatsApp é separado do Chrome/Safari. Se o
 * pai logar DENTRO da webview, aquela sessão fica presa ali: ele abre o
 * Chrome depois e está deslogado, sem entender por quê. Então a hora de
 * mandar pro navegador é antes de ele criar a conta — não depois.
 *
 * O QUE DÁ E O QUE NÃO DÁ
 *   Android: dá, de forma confiável. O esquema `intent://` abre o Chrome
 *     direto, e `browser_fallback_url` cobre quem não tem Chrome instalado.
 *   iOS: NÃO existe forma confiável. A Apple não tem equivalente do intent.
 *     `googlechrome://` funciona SE o Chrome estiver instalado; pro Safari
 *     não há esquema nenhum. Sobra instruir o menu "..." do app.
 *
 * Retorna 'launched' | 'maybe' | 'unsupported' — o chamador decide se mostra
 * instrução manual. Nunca deixa o usuário num beco: quem recebe 'maybe' ou
 * 'unsupported' precisa oferecer o passo a passo.
 */
export function openInExternalBrowser(url = window.location.href) {
  if (typeof window === 'undefined') return 'unsupported';

  const full = String(url);
  const withoutScheme = full.replace(/^https?:\/\//, '');

  if (!isIOS()) {
    // Android. O fallback garante que quem não tem Chrome não fique na mão.
    const intent =
      `intent://${withoutScheme}#Intent;scheme=https;` +
      `package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(full)};end`;
    try {
      window.location.href = intent;
      return 'launched';
    } catch {
      return 'unsupported';
    }
  }

  // iOS: só o Chrome tem esquema próprio. Se não estiver instalado, nada
  // acontece — e é por isso que devolvemos 'maybe' em vez de 'launched'.
  try {
    window.location.href = `googlechrome://${withoutScheme}`;
    return 'maybe';
  } catch {
    return 'unsupported';
  }
}

/** Nome do app de navegador pra usar no texto do botão. */
export function externalBrowserLabel() {
  return isIOS() ? 'Safari' : 'Chrome';
}

/** Nome do app que está segurando a webview, pra instrução fazer sentido. */
export function inAppBrowserName() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/\bWhatsApp\b/i.test(ua)) return 'WhatsApp';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/\bLine\//i.test(ua)) return 'Line';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  return null;
}

/**
 * Leva pro navegador de verdade JÁ NO ESTADO DE LOGIN.
 *
 * A diferença em relação a `openInExternalBrowser` é o `?auth=1`: quando o
 * Chrome abre a mesma URL, o app entende que ele veio pra entrar e sobe a
 * folha de autenticação sozinho. Sem isso a troca de app parece um
 * recomeço — ele cai na prévia outra vez e precisa achar o botão de novo.
 *
 * POR QUE NÃO REDIRECIONAR NO CARREGAMENTO DA PÁGINA
 * Seria mais simples e é tentador, mas três coisas dão errado:
 *   - No iOS sem Chrome instalado nada acontece: o pai fica olhando uma
 *     tela parada, sem mensagem nenhuma.
 *   - Trocar de app sozinho, num link sobre o filho dele, parece golpe.
 *     Parte das pessoas fecha e não volta.
 *   - Mata a prévia. O valor do fluxo é ele VER a mensalidade antes de
 *     qualquer atrito; redirecionar antes disso troca a ordem.
 *
 * Então a tentativa acontece no momento do login — quando o ganho é real e
 * o pai já sabe onde está.
 */
export function openForAuth() {
  if (typeof window === 'undefined') return 'unsupported';
  const url = new URL(window.location.href);
  url.searchParams.set('auth', '1');
  return openInExternalBrowser(url.toString());
}
