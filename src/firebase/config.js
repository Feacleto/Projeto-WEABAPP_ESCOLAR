import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Todas as chaves vêm do .env (prefixo VITE_) — chaves do client são
// públicas por design; a segurança real fica nas Firestore Security Rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Garante que emails do Firebase Auth (reset de senha, verificação) cheguem
// em PT-BR mesmo se o usuário tiver outro idioma no navegador.
auth.languageCode = 'pt-BR';

// Analytics: inicializa SOMENTE se o usuário consentiu cookies analíticos
// (LGPD — opt-in é obrigatório). Lê o consentimento de localStorage diretamente
// pra evitar dependência circular com consentService.
function userAllowsAnalytics() {
  try {
    const raw = localStorage.getItem('tn_cookie_consent_v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed?.analytics;
  } catch {
    return false;
  }
}

if (userAllowsAnalytics()) {
  isSupported()
    .then((ok) => ok && getAnalytics(app))
    .catch(() => null);
}

// Permite ativar Analytics depois que o usuário aceitar cookies (sem reload).
// Chamado pelo CookieBanner via custom event.
if (typeof window !== 'undefined') {
  window.addEventListener('tn-analytics-consent', () => {
    isSupported()
      .then((ok) => ok && getAnalytics(app))
      .catch(() => null);
  });
}
