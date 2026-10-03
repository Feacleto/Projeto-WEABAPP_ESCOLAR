import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { caminhoSemSegredo } from '../compartilhado/caminhoSemSegredo.js';
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

// ============================================================================
// App Check — DESLIGADO enquanto não existir a chave (03/10/2026)
// ============================================================================
//
// App Check prova ao Firebase que a chamada saiu DESTE app, e não de um
// script com a mesma chave pública do `firebaseConfig`. As rules continuam
// sendo a segurança de verdade; isto fecha a porta para quem chama as
// functions e o banco direto, fora do navegador, em volume.
//
// ⚠️ SÓ LIGA COM `VITE_APPCHECK_SITE_KEY`. Sem a chave, inicializar com uma
// chave vazia faria cada requisição tentar um token que não vem — e, no dia
// em que a imposição fosse ligada no console, o app inteiro pararia. A ordem
// certa está em docs/deploy.md: chave no .env, deploy, conferir as métricas
// de App Check no console, e SÓ ENTÃO impor.
//
// ⚠️ É IMPORT ESTÁTICO, e não `import()` como o analytics abaixo. Com a
// imposição ligada, toda leitura precisa do token; carregado depois, as
// primeiras consultas da tela de entrar sairiam sem ele e seriam recusadas.
//
// No emulador, o token de DEPURAÇÃO: o SDK imprime um token no console, que
// se cadastra em App Check → Apps → Gerenciar tokens de depuração.
const APPCHECK_SITE_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (APPCHECK_SITE_KEY && typeof window !== 'undefined') {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Sem imposição, falhar aqui não pode derrubar o boot: o app segue como
    // seguia antes da chave existir.
    console.warn('[app-check] não inicializou:', err);
  }
}
export const auth = getAuth(app);
// ⚠️ SEM CACHE PERSISTENTE, DE PROPÓSITO (03/10/2026). Ele foi ligado para a
// marcação feita sem sinal sobreviver ao app fechado — e o SDK 12 derrubou a
// tela da FAMÍLIA com "INTERNAL ASSERTION FAILED (ca9 / b815)" (teste M7,
// escutas de vários documentos com o cache em IndexedDB). Uma tela quebrada
// é pior que a marcação perdida num caso raro. Sem sinal, a rota continua
// funcionando: `gravarSemTravar` (routeStatusService) não prende os botões e a
// escrita sobe quando o sinal volta — enquanto o app estiver aberto. Religar
// isto exige o teste M7 dos dois lados.
export const db = initializeFirestore(app, {});
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
/**
 * ⚠️ O REGISTRO DE TELA É MANUAL, E O ENDEREÇO VAI SEM SEGREDO (03/10/2026).
 *
 * Com o padrão do SDK, cada tela virava um `page_view` com a URL INTEIRA —
 * e três rotas têm a chave na URL: `/convite/CÓDIGO`, `/acompanhar/TOKEN` e
 * `/auth-action?oobCode=…`. O código de convite e o link de acompanhar iam
 * parar no relatório do Analytics. Agora `send_page_view` é falso, o
 * `page_location` padrão de todo evento é o endereço limpo
 * (`caminhoSemSegredo`), e quem conta a tela é `analyticsService`, a cada
 * troca de rota.
 */
let analyticsPromise = null;

function ligarAnalytics() {
  // No emulador não há projeto de verdade para medir: a chave é de mentira e
  // o SDK enchia o console de 400, escondendo os erros que importam.
  if (USE_EMULATORS) return Promise.resolve(null);
  if (analyticsPromise) return analyticsPromise;
  analyticsPromise = (async () => {
    try {
      const { initializeAnalytics, isSupported } = await import('firebase/analytics');
      if (!(await isSupported())) return null;
      const limpo = `${window.location.origin}${caminhoSemSegredo(window.location.pathname)}`;
      return initializeAnalytics(app, {
        config: { send_page_view: false, page_location: limpo },
      });
    } catch {
      // Bloqueador de rastreio, navegador sem suporte, rede caindo: analytics é
      // acessório e não pode derrubar o boot do app.
      return null;
    }
  })();
  return analyticsPromise;
}

/** A instância do Analytics, ou `null` sem consentimento — nunca liga sozinha. */
export function analyticsLigado() {
  return analyticsPromise || Promise.resolve(null);
}

if (userAllowsAnalytics()) ligarAnalytics();

// Permite ativar Analytics depois que o usuário aceitar cookies (sem reload).
// Chamado pelo CookieBanner via custom event.
if (typeof window !== 'undefined') {
  window.addEventListener('tn-analytics-consent', ligarAnalytics);
}
