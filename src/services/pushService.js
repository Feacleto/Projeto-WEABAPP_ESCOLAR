import { getMessaging, getToken, isSupported } from 'firebase/messaging';
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
 * O TOKEN DESTE APARELHO, sempre pelo MESMO worker.
 *
 * ⚠️ `disablePush` chamava `getToken` SEM o registro do worker — o SDK então
 * registra o padrão `/firebase-messaging-sw.js` sem a config na URL, que não
 * inicializa, e o token nunca era achado para ser removido. Um caminho só
 * para os três usos (ligar, sincronizar, desligar).
 */
async function tokenDoAparelho() {
  const registration = await navigator.serviceWorker.register(swUrl(), {
    scope: '/firebase-cloud-messaging-push-scope',
  });
  const messaging = getMessaging(app);
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
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
    const token = await tokenDoAparelho();
    if (!token) return { ok: false, reason: 'sem-token' };
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
    return { ok: true, token };
  } catch (err) {
    console.error('enablePush:', err);
    return { ok: false, reason: 'erro' };
  }
}

/**
 * A CADA ABERTURA DO APP, com a permissão já dada (03/10/2026).
 *
 * O token do FCM troca sozinho (o navegador renova, a pessoa limpa dados), e
 * ele só era gravado no gesto de "ativar avisos" — uma vez na vida. O token
 * novo nunca chegava ao servidor e o celular parava de receber sem ninguém
 * saber. Não pede permissão: só confere e grava se mudou.
 */
export async function sincronizarPush(uid, tokensGravados = []) {
  if (!uid || permissionState() !== 'granted' || !(await isPushAvailable())) return;
  try {
    const token = await tokenDoAparelho();
    if (!token || (tokensGravados || []).includes(token)) return;
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
  } catch (err) {
    console.error('sincronizarPush:', err);
  }
}

/**
 * Tira este aparelho da lista. Chamado ao SAIR DA CONTA — antes, o celular
 * continuava recebendo os avisos da conta anterior (com nome de criança) no
 * aparelho compartilhado de quem entrou depois.
 */
export async function disablePush(uid) {
  if (!uid || permissionState() !== 'granted' || !(await isPushAvailable())) return;
  try {
    const token = await tokenDoAparelho();
    if (token) await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) });
  } catch (err) {
    console.error('disablePush:', err);
  }
}

/**
 * O token, para quem NÃO tem conta: o acesso de 24h do segundo responsável
 * (`/acompanhar`) entrega o token ao servidor por callable. Pede permissão.
 */
export async function tokenParaAcessoTemporario() {
  if (!(await isPushAvailable())) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  try {
    return await tokenDoAparelho();
  } catch (err) {
    console.error('tokenParaAcessoTemporario:', err);
    return null;
  }
}

/**
 * O TOQUE NO AVISO, com o app já aberto em segundo plano: o worker manda o
 * caminho, e quem navega é o app (o worker do FCM não controla as janelas).
 */
export function ouvirToqueNoAviso(navegar) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const ouvir = (event) => {
    const m = event.data;
    if (m && m.tipo === 'abrir-aviso' && typeof m.caminho === 'string' && m.caminho.startsWith('/')) {
      navegar(m.caminho);
    }
  };
  navigator.serviceWorker.addEventListener('message', ouvir);
  return () => navigator.serviceWorker.removeEventListener('message', ouvir);
}
