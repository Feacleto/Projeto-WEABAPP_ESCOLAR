import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Invite from './pages/Invite';
import DriverSignup from './pages/DriverSignup';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import FirstAccess from './pages/FirstAccess';
import FirstAdmin from './pages/FirstAdmin';
import AuthAction from './pages/AuthAction';
import TioLayout from './pages/tio/TioLayout';
import TioDashboard from './pages/tio/TioDashboard';
import TioChildren from './pages/tio/TioChildren';
import TioRoute from './pages/tio/TioRoute';
import TioRouteNow from './pages/tio/TioRouteNow';
import TioRoutePlan from './pages/tio/TioRoutePlan';
import TioFinance from './pages/tio/TioFinance';
import TioFinanceReport from './pages/tio/TioFinanceReport';
import TioExpenses from './pages/tio/TioExpenses';
import TioContract from './pages/tio/TioContract';
import TioPixConfig from './pages/tio/TioPixConfig';
import TioAgenda from './pages/tio/TioAgenda';
import TioLeads from './pages/tio/TioLeads';
import ChildForm from './components/children/ChildForm';
import PaiLayout from './pages/pai/PaiLayout';
import PaiDashboard from './pages/pai/PaiDashboard';
import PaiFinance from './pages/pai/PaiFinance';
import PaiFinanceReport from './pages/pai/PaiFinanceReport';
import PaiMap from './pages/pai/PaiMap';
import AddChild from './pages/pai/AddChild';
import PaiContract from './pages/pai/PaiContract';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import ChildDetail from './pages/ChildDetail';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
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
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<Home />} />
        {/* O convite é o caminho principal do responsável: o código vem na
          * URL, então ele não digita nada além de email e senha. */}
        <Route path="/convite/:codigo" element={<Invite />} />
        <Route path="/quero-fazer-parte" element={<DriverSignup />} />
        <Route path="/conheca" element={<Landing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/first-access" element={<FirstAccess />} />
        <Route path="/first-admin" element={<FirstAdmin />} />
        <Route path="/auth-action" element={<AuthAction />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />

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

      {/* Banner global de cookies — aparece só na primeira visita */}
      <CookieBanner />
    </>
  );
}
