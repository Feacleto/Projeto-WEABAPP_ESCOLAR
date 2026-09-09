/**
 * QUAL NAVEGADOR É ESTE — o interruptor de que o acesso da família depende.
 *
 * POR QUE ESTE TESTE EXISTE
 * `isInAppBrowser()` é uma linha de regex, e ela decide três coisas grandes:
 *
 *   1. Se o app SAI sozinho pro navegador de verdade quando a mãe toca no
 *      link dentro do WhatsApp (`Invite.jsx`). Este é o caminho mais
 *      percorrido do produto — ela não guarda o endereço do site, volta na
 *      conversa e toca no MESMO link, semana após semana.
 *   2. Se o botão "Continuar com Google" aparece. Dentro da webview o Google
 *      recusa OAuth (`disallowed_useragent`), e mostrar o botão ali entrega
 *      uma página de erro do Google no primeiro contato dela com o app.
 *   3. Se o formulário de email e senha aparece sozinho no login — porque na
 *      webview ele deixa de ser exceção e passa a ser a única porta.
 *
 * Um falso NEGATIVO (não reconhecer a webview) devolve os três problemas de
 * uma vez, em silêncio: ninguém vê erro, a pessoa só não consegue entrar.
 * Um falso POSITIVO manda pro navegador quem já estava no navegador.
 *
 * Nenhum dos dois aparece em teste de tela, porque os dois dependem de um
 * user agent que a máquina de teste não tem. Daí este arquivo.
 *
 * ⚠️ O QUE ESTE TESTE **NÃO** PROVA, E É IMPORTANTE SABER
 * Ele prova que a regex acerta os user agents que estão aqui dentro. Ele NÃO
 * prova que o WhatsApp do iPhone manda um destes — e essa é a única
 * verificação que não dá pra fazer sem um iPhone na mão. Se lá o user agent
 * vier como Safari puro, `isInAppBrowser()` devolve `false` e a ponte nunca
 * dispara naquele aparelho. Antes de tratar o iPhone como resolvido, abra um
 * link de convite num iPhone de verdade e confira.
 *
 * COMO RODAR
 *   node scripts/testar-navegador.mjs
 */

import {
  isInAppBrowser,
  canUseGoogleSignIn,
  isIOS,
  inAppBrowserName,
} from '../src/compartilhado/browserEnv.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = esperado === obtido;
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

/**
 * Troca o `navigator` global.
 *
 * O Node 22 já define `globalThis.navigator` (com userAgent "Node.js/22"), e
 * ele não é gravável por atribuição simples — daí o `defineProperty`. Sem
 * isso o teste rodaria inteiro contra o user agent do Node e passaria dizendo
 * "não é webview" em todos os casos, inclusive nos que deveriam falhar.
 */
function comNavegador(userAgent, maxTouchPoints = 0) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent, maxTouchPoints },
    configurable: true,
    writable: true,
  });
}

// ── Os user agents, como eles chegam de verdade ────────────────────────────
const UA = {
  whatsappAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/119.0.0.0 Mobile Safari/537.36 WhatsApp/2.23.20.79',
  whatsappIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Mobile/21B74 WhatsApp/23.24.0',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Mobile/15E148 Instagram 305.0.0.copy.0',
  facebook:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/119.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/440.0.0.30.116;]',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/119.0.0.0 Mobile Safari/537.36',
  safariIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/119.0.0.0 Safari/537.36',
  iPadOS15:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.1 Safari/605.1.15',
};

// ═══════════════════════════════════════════════════════════════════════════
bloco('═══ A WEBVIEW É RECONHECIDA — se não for, a ponte nunca dispara ═══');

comNavegador(UA.whatsappAndroid);
checar('WhatsApp no Android é webview', true, isInAppBrowser());
checar('  …e por isso o Google não é oferecido', false, canUseGoogleSignIn());
checar('  …e a instrução sabe dizer o nome do app', 'WhatsApp', inAppBrowserName());

comNavegador(UA.whatsappIOS);
checar('WhatsApp no iPhone é webview', true, isInAppBrowser());
checar('  …e o app sabe que é iOS (não existe intent:// lá)', true, isIOS());

comNavegador(UA.instagram);
checar('Instagram é webview', true, isInAppBrowser());
checar('  …e a instrução diz Instagram, não "app"', 'Instagram', inAppBrowserName());

comNavegador(UA.facebook);
checar('Facebook (FBAN/FBAV) é webview', true, isInAppBrowser());
checar('  …e a instrução diz Facebook', 'Facebook', inAppBrowserName());

// ═══════════════════════════════════════════════════════════════════════════
bloco('═══ NAVEGADOR DE VERDADE NÃO É EMPURRADO PRA LUGAR NENHUM ═══');

comNavegador(UA.chromeAndroid);
checar('Chrome no Android não é webview', false, isInAppBrowser());
checar('  …e o Google aparece', true, canUseGoogleSignIn());
checar('  …e não há nome de app pra citar', null, inAppBrowserName());

comNavegador(UA.safariIOS);
checar('Safari no iPhone não é webview', false, isInAppBrowser());
checar('  …e o Google aparece', true, canUseGoogleSignIn());

comNavegador(UA.chromeDesktop);
checar('Chrome no monitor não é webview', false, isInAppBrowser());
checar('  …e não é iOS', false, isIOS());

// ═══════════════════════════════════════════════════════════════════════════
bloco('═══ O IPAD SE DISFARÇA DE MAC, E O TOQUE O DENUNCIA ═══');
/* Importa porque `isIOS()` decide QUAL instrução manual aparece. Lido como
   Mac, o iPad receberia a instrução do Android — que fala de um menu que não
   existe ali. */

comNavegador(UA.iPadOS15, 5);
checar('iPad com dedo é iOS', true, isIOS());

comNavegador(UA.iPadOS15, 0);
checar('Mac de verdade (sem toque) não é iOS', false, isIOS());

// ═══════════════════════════════════════════════════════════════════════════
bloco('═══ SEM NAVIGATOR NENHUM, NADA EXPLODE ═══');
/* O app roda `isInAppBrowser()` no corpo de um `useState`, e um throw ali
   derruba a tela inteira em vez de degradar. */

Object.defineProperty(globalThis, 'navigator', {
  value: undefined,
  configurable: true,
  writable: true,
});
checar('sem navigator, não é webview', false, isInAppBrowser());
checar('sem navigator, não é iOS', false, isIOS());
checar('sem navigator, o Google segue oferecido', true, canUseGoogleSignIn());

// ═══════════════════════════════════════════════════════════════════════════
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
if (bad) {
  console.log('');
  falhas.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log('════════════════════════════════════════════════════════════════');
process.exit(bad ? 1 : 0);
