import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
// `firebase/analytics` NÃO é importado no topo — ver `ligarAnalytics()`.

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
/**
 * O CLOUD STORAGE ENTRA SOB DEMANDA, e não no topo do módulo.
 *
 * POR QUE ISSO IMPORTA AQUI ESPECIFICAMENTE
 * Este arquivo é importado por todo service, então tudo que ele instancia no
 * topo cai no chunk de entrada e ganha `modulepreload` — baixado antes da
 * primeira pintura, por TODO visitante. E o único consumidor do Storage é
 * `photoService`, que só é tocado quando alguém anexa um arquivo.
 *
 * É exatamente o bug que este arquivo já corrigiu logo abaixo, com o
 * analytics: o `import` no topo anulava o gate de consentimento e fazia ~56 KB
 * serem baixados inclusive pelo responsável que abre o link do WhatsApp em
 * dado móvel. O Storage é maior que o analytics.
 *
 * Devolve sempre a MESMA instância — `getStorage` é idempotente, e o módulo
 * do SDK fica no cache do bundler depois do primeiro `import()`.
 */
let storagePromise = null;

export function getStorageLazy() {
  if (!storagePromise) {
    storagePromise = import('firebase/storage').then(async (mod) => {
      const inst = mod.getStorage(app);
      if (USE_EMULATORS) {
        mod.connectStorageEmulator(inst, '127.0.0.1', 9199);
      }
      return inst;
    });
  }
  return storagePromise;
}
// Mesma região das Cloud Functions (firebase.json / functions/index.js).
// Sem passar a região, o SDK chama us-central1 e recebe 404.
export const functions = getFunctions(app, 'southamerica-east1');

// ============================================================================
// Emuladores locais
// ============================================================================
//
// POR QUE ISTO PRECISA EXISTIR
// Sem este bloco, `npm run dev` conversa com o Firebase de PRODUÇÃO. Ou seja:
// subir o emulador não serviria de nada, e cada teste criaria criança, pai e
// cobrança de verdade no banco real — misturado com os dados do Tio Nino.
//
// Fica atrás de uma flag explícita (VITE_USE_EMULATORS=true no .env) em vez
// de ligar sozinho em desenvolvimento, porque às vezes você QUER rodar local
// contra produção pra reproduzir um problema com dado real.
//
// As portas batem com o bloco `emulators` do firebase.json. Firestore está em
// 8085 e não na 8080 padrão porque a 8080 estava ocupada pelo Apache.
const USE_EMULATORS =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true';

if (USE_EMULATORS) {
  const host = '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8085);
  connectFunctionsEmulator(functions, host, 5001);
  console.info('%c🔧 EMULADOR LOCAL — nenhum dado vai pra produção', 'color:#1F5F3F;font-weight:bold');
} else if (import.meta.env.DEV) {
  // Aviso alto de propósito: rodar dev contra produção é legítimo, mas nunca
  // deve acontecer sem você saber. É assim que dado de teste vaza pro banco
  // real e ninguém descobre até alguém estranhar uma criança chamada "teste".
  console.warn(
    '%c⚠ PRODUÇÃO — você está gravando no banco real. Pra usar o emulador, ponha VITE_USE_EMULATORS=true no .env',
    'color:#EF4444;font-weight:bold'
  );
}

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

/**
 * Carrega o SDK de analytics SÓ quando há consentimento.
 *
 * O gate de runtime já existia e estava certo; o `import` no topo do arquivo
 * anulava metade dele. O módulo caía no chunk que toda primeira tela carrega,
 * então ~56 KB de analytics eram baixados inclusive pelo responsável que abre
 * o link do WhatsApp em dado móvel e ainda NEM VIU o banner de cookie.
 *
 * O `vite.config.js` documenta exatamente esse cenário — "o primeiro acesso do
 * responsável acontece pelo link do WhatsApp, em dado móvel, num aparelho
 * barato, e é ali que ele decide se o app presta". O comentário estava certo
 * e este arquivo não o seguia.
 *
 * `import()` dinâmico dentro do gate: sem consentimento, o navegador nunca
 * pede o arquivo.
 */
async function ligarAnalytics() {
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) getAnalytics(app);
  } catch {
    // Bloqueador de rastreio, navegador sem suporte, rede caindo: analytics é
    // acessório e não pode derrubar o boot do app.
  }
}

if (userAllowsAnalytics()) ligarAnalytics();

// Permite ativar Analytics depois que o usuário aceitar cookies (sem reload).
// Chamado pelo CookieBanner via custom event.
if (typeof window !== 'undefined') {
  window.addEventListener('tn-analytics-consent', ligarAnalytics);
}
