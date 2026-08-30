import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app, db } from '../firebase/config';

/**
 * Push (FCM) — alertas que chegam com o app fechado.
 *
 * Hoje o alerta de proximidade só existe enquanto a aba está aberta na tela,
 * o que é justamente quando o pai menos precisa dele. Com push, "a perua
 * está chegando" chega no bolso.
 *
 * CONFIGURAÇÃO NECESSÁRIA (uma vez, no Firebase Console):
 *   1. Console → Project settings → Cloud Messaging → Web Push certificates
 *      → gerar par de chaves.
 *   2. Colar a chave pública no .env como VITE_FIREBASE_VAPID_KEY.
 * Sem essa variável tudo aqui vira no-op silencioso e o app segue
 * funcionando — nada quebra, o push simplesmente não é oferecido.
 */

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Registro do SW do FCM: a config vai por query string porque service
// worker não lê import.meta.env.
function swUrl() {
  const c = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  return `/firebase-messaging-sw.js?${new URLSearchParams(c).toString()}`;
}

/** Push está disponível neste navegador E configurado neste projeto? */
export async function isPushAvailable() {
  if (!VAPID_KEY) return false;
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function permissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Pede permissão, registra o token e guarda em users/{uid}.fcmTokens.
 *
 * Guardamos um ARRAY porque a mesma pessoa usa o app no celular e no
 * desktop — um campo único faria o segundo aparelho derrubar o primeiro.
 *
 * Retorna { ok, reason }.
 */
export async function enablePush(uid) {
  if (!uid) return { ok: false, reason: 'sem-usuario' };
  if (!(await isPushAvailable())) return { ok: false, reason: 'indisponivel' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'negado' };

  try {
    // ESCOPO PRÓPRIO — sem ele, este registro DERRUBA o service worker do PWA.
    //
    // `navigator.serviceWorker.register(url)` sem `scope` assume o diretório
    // do script. Como os dois arquivos moram na raiz, o do FCM e o do PWA
    // disputavam o escopo `/`, e registrar um substitui o outro: quem ligasse
    // as notificações perdia o cache offline E o aviso de versão nova, sem
    // nenhum erro na tela.
    //
    // `/firebase-cloud-messaging-push-scope` é o caminho que o próprio SDK do
    // Firebase usa quando registra sozinho — não é invenção nossa, é voltar
    // ao padrão que a passagem manual do registro tinha atropelado.
    //
    // A pasta não precisa existir: escopo de service worker é um prefixo de
    // URL, não um diretório. Mas o ARQUIVO tem que estar na raiz pra poder
    // reivindicar esse prefixo — e está.
    const registration = await navigator.serviceWorker.register(swUrl(), {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: 'sem-token' };

    await updateDoc(doc(db, 'users', uid), {
      fcmTokens: arrayUnion(token),
    });
    return { ok: true, token };
  } catch (err) {
    console.error('enablePush:', err);
    return { ok: false, reason: 'erro' };
  }
}

/**
 * Remove o token deste aparelho. Não revoga a permissão do navegador —
 * isso só o usuário faz nas configurações do browser.
 */
export async function disablePush(uid) {
  if (!uid || !(await isPushAvailable())) return;
  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayRemove(token),
      });
    }
  } catch (err) {
    console.error('disablePush:', err);
  }
}

/**
 * Mensagem recebida com o app ABERTO. O SW não dispara notificação nesse
 * caso, então quem decide o que mostrar é a UI.
 * Retorna unsubscribe (ou no-op quando push não está disponível).
 */
export function onForegroundPush(handler) {
  let unsub = () => {};
  isPushAvailable().then((ok) => {
    if (!ok) return;
    try {
      unsub = onMessage(getMessaging(app), handler);
    } catch (err) {
      console.error('onForegroundPush:', err);
    }
  });
  return () => unsub();
}
