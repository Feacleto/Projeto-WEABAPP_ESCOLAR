import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import FirstAccess from './pages/FirstAccess';
import FirstAdmin from './pages/FirstAdmin';
import TioLayout from './pages/tio/TioLayout';
import TioDashboard from './pages/tio/TioDashboard';
import TioChildren from './pages/tio/TioChildren';
import TioRoute from './pages/tio/TioRoute';
import TioFinance from './pages/tio/TioFinance';
import ChildForm from './components/children/ChildForm';
import PaiLayout from './pages/pai/PaiLayout';
import PaiDashboard from './pages/pai/PaiDashboard';
import PaiFinance from './pages/pai/PaiFinance';
import { useAuth } from './hooks/useAuth';
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
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/first-access" element={<FirstAccess />} />
      <Route path="/first-admin" element={<FirstAdmin />} />

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
        <Route path="route" element={<TioRoute />} />
        <Route path="finance" element={<TioFinance />} />
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
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
