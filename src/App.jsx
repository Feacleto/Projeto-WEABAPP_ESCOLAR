import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import FirstAccess from './pages/FirstAccess';
import FirstAdmin from './pages/FirstAdmin';
import AuthAction from './pages/AuthAction';
import TioLayout from './pages/tio/TioLayout';
import TioDashboard from './pages/tio/TioDashboard';
import TioChildren from './pages/tio/TioChildren';
import TioRoute from './pages/tio/TioRoute';
import TioRoutePlan from './pages/tio/TioRoutePlan';
import TioMap from './pages/tio/TioMap';
import TioFinance from './pages/tio/TioFinance';
import TioPixConfig from './pages/tio/TioPixConfig';
import ChildForm from './components/children/ChildForm';
import PaiLayout from './pages/pai/PaiLayout';
import PaiDashboard from './pages/pai/PaiDashboard';
import PaiFinance from './pages/pai/PaiFinance';
import PaiMap from './pages/pai/PaiMap';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import ChildDetail from './pages/ChildDetail';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import TermsAcceptanceGate from './components/legal/TermsAcceptanceGate';
import CookieBanner from './components/legal/CookieBanner';
import { useAuth } from './hooks/useAuth';
import { hasAcceptedCurrentTerms } from './services/consentService';
import Spinner from './components/common/Spinner';

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
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Rotas públicas */}
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
        <Route path="route" element={<TioRoute />} />
        <Route path="route/plan" element={<TioRoutePlan />} />
        <Route path="route/map" element={<TioMap />} />
        <Route path="finance" element={<TioFinance />} />
        <Route path="pix" element={<TioPixConfig />} />
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
        <Route path="map" element={<PaiMap />} />
        <Route path="child" element={<ChildDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Banner global de cookies — aparece só na primeira visita */}
      <CookieBanner />
    </>
  );
}
