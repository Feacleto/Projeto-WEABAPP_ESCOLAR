/**
 * Service worker do Firebase Cloud Messaging — o aviso com o APP FECHADO.
 *
 * Precisa viver na raiz (public/) e ser um arquivo separado do sw.js que o
 * vite-plugin-pwa gera: o FCM registra o SEU próprio worker, com escopo
 * próprio, e não convive dentro do Workbox.
 *
 * A config vem por query string no registro (pushService.js) porque um
 * service worker não tem acesso a import.meta.env. São chaves públicas de
 * cliente — a segurança real está nas Security Rules.
 *
 * ── O QUE MUDOU EM 03/10/2026
 * O servidor passou a mandar SÓ DADOS (sem o bloco `notification`), e é este
 * arquivo que desenha o aviso — sempre, e uma vez só. Antes o navegador
 * mostrava um e este worker mostrava outro igual.
 *   - `tag`: o "está chegando" é SUBSTITUÍDO pelo "chegou", não empilhado;
 *   - `insistente`: a buzina fica na tela até alguém tocar;
 *   - o toque leva ao endereço do aviso, numa janela do app que já esteja
 *     aberta quando houver — e só navega se a janela for do mesmo endereço
 *     do app (o `navigate` de outra origem falha calado).
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const title = d.title || (payload.notification && payload.notification.title) || 'Alô Buzinou';
  const body = d.body || (payload.notification && payload.notification.body) || '';
  return self.registration.showNotification(title, {
    body,
    icon: '/brand/icon-192.png',
    badge: '/brand/notification-badge-96.png',
    tag: d.tag || undefined,
    // Mesmo com a etiqueta repetida, o aviso novo toca de novo.
    renotify: Boolean(d.tag),
    requireInteraction: d.insistente === '1',
    data: { url: d.url || '/' },
    vibrate: d.insistente === '1' ? [400, 200, 400, 200, 400] : [220, 100, 220],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || '/', self.location.origin);
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => {
        const doApp = janelas.find((j) => new URL(j.url).origin === destino.origin);
        // ⚠️ `navigate()` só funciona em janela CONTROLADA por este worker, e
        // nenhuma do app é (o escopo dele é o do FCM): a chamada falhava
        // calada e o toque só trazia o app para a frente, na tela em que
        // estava. Quem navega é o próprio app, ao receber a mensagem
        // (`ouvirToqueNoAviso` em pushService.js).
        if (doApp) {
          doApp.postMessage({ tipo: 'abrir-aviso', caminho: destino.pathname + destino.search });
          return doApp.focus();
        }
        return self.clients.openWindow(destino.href);
      })
  );
});
