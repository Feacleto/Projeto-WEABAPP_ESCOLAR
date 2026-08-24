import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

/**
 * O QUE VEM NO PRIMEIRO DOWNLOAD, E O QUE VEM QUANDO PRECISA.
 *
 * O app tinha 37 telas num arquivo só, de 1,47 MB. Quem abria o link do
 * WhatsApp pra ver uma mensalidade baixava o mapa, o gerador de QR, as
 * telas de impressão e o painel do dono junto — tudo antes da primeira
 * pintura, em dado móvel, num aparelho de rua.
 *
 * ADIANTADO fica só o caminho de quem chega de fora: a home, o convite, o
 * login e o primeiro acesso. É o que precisa pintar rápido, porque é onde o
 * responsável decide se o app presta.
 *
 * SOB DEMANDA vai o resto — os dois painéis, o mapa, os relatórios, as
 * telas legais e o painel do dono. Quem entra num painel já está logado e
 * já esperou uma navegação; um instante ali não custa a primeira impressão.
 *
 * O <Suspense> fica no topo das rotas com o MESMO loader de tela cheia que
 * o PrivateRoute já usa — a espera parece com a espera que o app já tinha,
 * e não com uma tela nova aparecendo do nada.
 */
import Home from './pages/Home';
import Invite from './pages/Invite';
import Login from './pages/Login';
import FirstAccess from './pages/FirstAccess';
import Welcome from './pages/Welcome';
import AuthAction from './pages/AuthAction';

const DriverSignup = lazy(() => import('./pages/DriverSignup'));
const FirstAdmin = lazy(() => import('./pages/FirstAdmin'));
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

const TioLayout = lazy(() => import('./pages/tio/TioLayout'));
const TioDashboard = lazy(() => import('./pages/tio/TioDashboard'));
const TioChildren = lazy(() => import('./pages/tio/TioChildren'));
const TioRoute = lazy(() => import('./pages/tio/TioRoute'));
const TioRouteNow = lazy(() => import('./pages/tio/TioRouteNow'));
const TioRoutePlan = lazy(() => import('./pages/tio/TioRoutePlan'));
const TioFinance = lazy(() => import('./pages/tio/TioFinance'));
const TioFinanceReport = lazy(() => import('./pages/tio/TioFinanceReport'));
const TioChildStatement = lazy(() => import('./pages/tio/TioChildStatement'));
const TioExpenses = lazy(() => import('./pages/tio/TioExpenses'));
const TioContract = lazy(() => import('./pages/tio/TioContract'));
const TioPixConfig = lazy(() => import('./pages/tio/TioPixConfig'));
const TioAgenda = lazy(() => import('./pages/tio/TioAgenda'));
const TioLeads = lazy(() => import('./pages/tio/TioLeads'));
const ChildForm = lazy(() => import('./components/children/ChildForm'));

const PaiLayout = lazy(() => import('./pages/pai/PaiLayout'));
const PaiDashboard = lazy(() => import('./pages/pai/PaiDashboard'));
const PaiFinance = lazy(() => import('./pages/pai/PaiFinance'));
const PaiFinanceReport = lazy(() => import('./pages/pai/PaiFinanceReport'));
const PaiMap = lazy(() => import('./pages/pai/PaiMap'));
const AddChild = lazy(() => import('./pages/pai/AddChild'));
const PaiContract = lazy(() => import('./pages/pai/PaiContract'));

const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const ChildDetail = lazy(() => import('./pages/ChildDetail'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
import TermsAcceptanceGate from './components/legal/TermsAcceptanceGate';
import ContractAcceptanceGate from './components/contract/ContractAcceptanceGate';
import CookieBanner from './components/legal/CookieBanner';
import { useAuth } from './hooks/useAuth';
import { useActiveChild } from './hooks/useActiveChild';
import { hasAcceptedCurrentTerms } from './services/consentService';
import { hasAcceptedContract } from './services/contractService';
import Spinner from './components/common/Spinner';
import { useGlobalClickSound } from './hooks/useGlobalClickSound';

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size={32} className="text-primary" />
    </div>
  );
}

/**
 * Protege rotas autenticadas.
 *   - Não autenticado → /login (preservando origem em state.from).
 *   - Autenticado mas com role errado → painel correto.
 *   - Profile ainda não carregado (logo após signup) → loader.
 */
function PrivateRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!profile) return <FullScreenLoader />;
  if (requireRole && profile.role !== requireRole) {
    const correctPath = profile.role === 'admin' ? '/tio' : '/pai';
    return <Navigate to={correctPath} replace />;
  }
  // Bloqueia acesso ao app até aceitar a versão corrente dos termos.
  // Acontece com usuários antigos quando bumpamos LEGAL_VERSION.
  if (!hasAcceptedCurrentTerms(profile)) {
    return <TermsAcceptanceGate />;
  }
  // Gate de contrato — só pra Pai, antes de acessar o app
  if (profile.role === 'parent') {
    return <ParentContractGate>{children}</ParentContractGate>;
  }
  return children;
}

/**
 * Painel do dono — só pra quem tem `superAdmin: true` no doc de usuário.
 *
 * ATENÇÃO, ISTO É GATE DE PRODUTO, NÃO DE SEGURANÇA. Todo usuário com role
 * 'admin' já pode ler users, children, payments e feedbacks pelas rules —
 * esconder a rota evita mostrar o negócio inteiro pra um parceiro, e nada
 * além disso. Pra virar segurança de verdade: custom claim `superAdmin` +
 * rules dedicadas por coleção (está no brief de arquitetura).
 */
function SuperAdminRoute({ children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!profile) return <FullScreenLoader />;
  if (!profile.superAdmin) {
    return <Navigate to={profile.role === 'admin' ? '/tio' : '/pai'} replace />;
  }
  return children;
}

/**
 * Sub-gate específico do Pai: bloqueia até aceitar o contrato.
 * Carrega o child do profile, verifica `hasAcceptedContract`.
 */
function ParentContractGate({ children }) {
  const { child, loading } = useActiveChild();

  if (loading) return <FullScreenLoader />;
  // Se não tem child vinculado, deixa entrar — o próprio dashboard mostra erro
  if (!child) return children;
  if (!hasAcceptedContract(child)) {
    return <ContractAcceptanceGate />;
  }
  return children;
}

export default function App() {
  // Som global de clique em qualquer elemento .tap — desabilitável no Profile
  useGlobalClickSound();

  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<Home />} />
        {/* O convite é o caminho principal do responsável: o código vem na
          * URL, então ele não digita nada além de email e senha. */}
        <Route path="/convite/:codigo" element={<Invite />} />
        <Route path="/quero-fazer-parte" element={<DriverSignup />} />
        {/* A /conheca (o folheto verde antigo) saiu do ar: a home nova
          * cobre tudo que ela fazia. Link velho, QR impresso e favorito
          * caem na home em vez de numa versão do produto que não existe
          * mais.
          *
          * O Landing.jsx foi APAGADO, e com ele imagemvanescolar.png —
          * 7,9 MB, 2392x1792. A imagem era usada só por aquela página e
          * respondia por 55% do precache do PWA: todo mundo que instalava
          * o app baixava 7,9 MB pra servir uma tela que ninguém alcançava.
          * O limite de tamanho no precache tinha sido subido de 2 pra 10
          * MiB só pra ela caber; voltou ao padrão. */}
        <Route path="/conheca" element={<Navigate to="/" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/first-access" element={<FirstAccess />} />
        <Route path="/first-admin" element={<FirstAdmin />} />
        <Route path="/auth-action" element={<AuthAction />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />

      {/* Painel do dono do produto — fora do /tio de propósito: são dois
        * papéis diferentes na mesma pessoa hoje, e vão ser duas pessoas
        * quando houver o segundo parceiro. */}
      <Route
        path="/admin"
        element={
          <SuperAdminRoute>
            <AdminPanel />
          </SuperAdminRoute>
        }
      />

      {/* Painel do Tio (admin) — rotas aninhadas com layout compartilhado */}
      <Route
        path="/tio"
        element={
          <PrivateRoute requireRole="admin">
            <TioLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<TioDashboard />} />
        <Route path="children" element={<TioChildren />} />
        <Route path="children/new" element={<ChildForm />} />
        <Route path="children/:id" element={<ChildDetail />} />
        <Route path="children/:id/contract" element={<TioContract />} />
        <Route
          path="children/:id/extrato"
          element={<TioChildStatement />}
        />
        <Route path="route" element={<TioRoute />} />
        <Route path="route/now" element={<TioRouteNow />} />
        <Route path="route/plan" element={<TioRoutePlan />} />
        <Route path="finance" element={<TioFinance />} />
        <Route path="finance/report" element={<TioFinanceReport />} />
        <Route path="finance/expenses" element={<TioExpenses />} />
        <Route path="pix" element={<TioPixConfig />} />
        <Route path="agenda" element={<TioAgenda />} />
        <Route path="leads" element={<TioLeads />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Painel do Pai (parent) — rotas aninhadas com layout compartilhado */}
      <Route
        path="/pai"
        element={
          <PrivateRoute requireRole="parent">
            <PaiLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<PaiDashboard />} />
        <Route path="finance" element={<PaiFinance />} />
        <Route path="finance/report" element={<PaiFinanceReport />} />
        <Route path="map" element={<PaiMap />} />
        <Route path="child" element={<ChildDetail />} />
        <Route path="adicionar-filho" element={<AddChild />} />
        <Route path="contrato" element={<PaiContract />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

        {/* A escolha "sou pai / sou motorista" saiu do caminho: o papel vem
          * do doc users. /welcome segue existindo pra links antigos. */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Banner global de cookies — aparece só na primeira visita */}
      <CookieBanner />
    </>
  );
}
