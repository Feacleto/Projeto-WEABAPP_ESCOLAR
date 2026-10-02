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

/**
 * Navegador embutido de app de MENSAGEM/REDE SOCIAL — onde vale a ponte.
 *
 * ⚠️ O APP DO GOOGLE NÃO ENTRA AQUI, DE PROPÓSITO (02/10/2026). Ele já
 * esteve na lista, e a ponte ("Abra no Chrome pra continuar") passou a
 * aparecer para quem usa o app do Google COMO NAVEGADOR — gente que não tem
 * Chrome (iPhone) ou não sabe onde ele está. A tela parecia um bloqueio, a
 * saída era um link cinza no pé, e houve quem não conseguisse entrar.
 *
 * A ponte existe porque a sessão criada no WhatsApp fica presa lá e a pessoa
 * volta pelo Chrome. Para quem vive no app do Google o raciocínio inverte:
 * ele É o navegador dela, e é por ele que ela volta. Mandá-la sair é pedir
 * que troque de navegador para usar o produto.
 *
 * O que continua valendo no app do Google é o bloqueio do OAuth — e isso
 * mora em `canUseGoogleSignIn`, não aqui.
 */
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // FBAN/FBAV = Facebook; FB_IAB = in-app browser; Line/MicroMessenger
  // (WeChat) entram porque o comportamento é o mesmo.
  // TikTok (musical_ly / Bytedance), Kwai, Telegram, LinkedIn, Pinterest,
  // Snapchat e X entraram em 02/10/2026: o botão do Google aparecia neles.
  const patterns = [
    /FBAN|FBAV|FB_IAB/i,
    /Instagram/i,
    /\bWhatsApp\b/i,
    /\bLine\//i,
    /MicroMessenger/i,
    /musical_ly|Bytedance|TikTok/i,
    /\bKwai/i,
    /Telegram/i,
    /LinkedInApp/i,
    /Pinterest/i,
    /Snapchat/i,
    /\bTwitter/i,
  ];
  return patterns.some((re) => re.test(ua));
}

/**
 * Navegador embutido de QUALQUER app, mesmo um que não está na lista acima.
 *
 * A lista por nome sempre fica para trás — o próximo app popular nasce fora
 * dela, e ali o botão do Google aparece e entrega a página de erro. Esta é a
 * rede por baixo, pela forma do user agent, não pelo nome:
 *
 *   Android: a webview do sistema se declara com `; wv)`. O Chrome não
 *     manda, nem a aba do Chrome que os apps abrem (Custom Tab) — e nesta o
 *     login com Google FUNCIONA, então deixá-la de fora é o certo.
 *   iPhone: Safari, Chrome, Firefox e Edge do iPhone mandam `Safari/`; a
 *     webview de app não manda. ⚠️ O ícone da tela de início também NÃO
 *     manda, e não é webview — por isso `isStandalone()` sai antes.
 *
 * Usada SÓ para esconder o Google, nunca para a ponte: errar aqui custa um
 * botão a menos (o email continua), errar na ponte empurraria alguém para
 * fora do navegador em que ele já estava.
 */
export function isWebviewGenerica() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return /;\s*wv\)/.test(ua);
  if (isIOS()) return !isStandalone() && !/Safari\//.test(ua);
  return false;
}

/**
 * O app do Google (a barra de pesquisa), no Android e no iPhone.
 *
 * Os dois mandam `GSA/` no user agent. No Android, quando o app abre o
 * resultado numa aba do Chrome (Custom Tab) o `GSA/` não vem — e ali o login
 * com Google funciona, então não reconhecer é o certo.
 */
export function isGoogleApp() {
  if (typeof navigator === 'undefined') return false;
  return /\bGSA\//i.test(navigator.userAgent || '');
}

/**
 * O login com Google é confiável aqui?
 *
 * Em webview embutida, não: o Google bloqueia (`disallowed_useragent`) —
 * inclusive dentro do PRÓPRIO app do Google. Melhor nem oferecer do que
 * oferecer e entregar erro; sem ele, o formulário de email aparece sozinho.
 */
export function canUseGoogleSignIn() {
  return !isInAppBrowser() && !isGoogleApp() && !isWebviewGenerica();
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
 *   iOS: NÃO existe forma documentada. A Apple não tem equivalente do
 *     intent. `x-safari-https://` abre o Safari no iOS 17+ — é esquema NÃO
 *     documentado e pode parar de funcionar numa atualização, por isso o
 *     retorno é 'maybe' e quem chama mostra o menu "..." como plano B.
 *     ⚠️ Era `googlechrome://`, e o botão dizia "Abrir no Safari": no iPhone
 *     quase ninguém tem Chrome, então o toque não fazia nada.
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

  // iOS: o Safari, que todo iPhone tem. Esquema não documentado — se não
  // pegar, nada acontece, e é por isso que devolvemos 'maybe'.
  try {
    window.location.href = `x-safari-https://${withoutScheme}`;
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
  if (/musical_ly|Bytedance|TikTok/i.test(ua)) return 'TikTok';
  if (/\bKwai/i.test(ua)) return 'Kwai';
  if (/Telegram/i.test(ua)) return 'Telegram';
  if (/\bGSA\//i.test(ua)) return 'Google';
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
