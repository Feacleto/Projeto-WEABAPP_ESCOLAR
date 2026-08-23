/* eslint-disable no-undef */
/**
 * Service worker do Firebase Cloud Messaging.
 *
 * Precisa viver na raiz (public/) e ser um arquivo separado do sw.js que o
 * vite-plugin-pwa gera: o FCM registra o SEU próprio worker, com escopo
 * próprio, e não convive dentro do Workbox.
 *
 * A config vem por query string no registro (pushService.js) porque um
 * service worker não tem acesso a import.meta.env. São chaves públicas de
 * cliente — a segurança real está nas Security Rules.
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

// Mensagem recebida com o app fechado ou em segundo plano.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Alô Buzinou';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: payload.data?.tag || undefined,
    data: { url },
    vibrate: [220, 100, 220],
  });
});

// Toque na notificação: foca uma aba já aberta em vez de abrir outra.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
