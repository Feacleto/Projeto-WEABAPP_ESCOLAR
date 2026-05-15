import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaymentsByParent } from '../../hooks/usePayments';
import Avatar from '../common/Avatar';

/**
 * Header sticky comum às páginas autenticadas.
 *
 * Renderiza automaticamente bell (notificações) + ícone de perfil no canto
 * direito quando há usuário logado. Pages podem passar `action` extra que
 * aparece ANTES dos ícones globais.
 *
 * Props:
 *   - title:        string
 *   - showBack:     bool — mostra seta de voltar (usa navigate(-1))
 *   - action:       ReactNode — botão/ícone custom à direita (opcional)
 *   - showGlobal:   bool (default true) — exibe bell + perfil
 */
export default function Header({
  title,
  showBack = false,
  action = null,
  showGlobal = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const isAuthed = !!user;
  const role = profile?.role;
  const basePath = role === 'admin' ? '/tio' : '/pai';

  // Hooks só rodam quando autenticado pra não disparar subscribes em /login
  return (
    <header className="sticky top-0 z-20 bg-card border-b border-gray-100 h-14 px-4 flex items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="-ml-1 p-1 tap text-textMuted"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-base font-semibold text-text truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {action}
        {showGlobal && isAuthed && (
          <GlobalActions
            role={role}
            basePath={basePath}
            currentPath={location.pathname}
          />
        )}
      </div>
    </header>
  );
}

/**
 * Subcomponente que executa hooks somente quando autenticado — evita que o
 * Header dispare subscribes do Firestore em rotas públicas.
 */
function GlobalActions({ role, basePath, currentPath }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isParent = role === 'parent';
  const { payments } = usePaymentsByParent(isParent ? user?.uid : null);
  const { unreadCount } = useNotifications({
    userId: user?.uid,
    payments: isParent ? payments : [],
    deriveFor: isParent ? 'parent' : 'admin',
  });

  const isOnNotifications = currentPath === `${basePath}/notifications`;
  const isOnProfile = currentPath === `${basePath}/profile`;

  return (
    <>
      <button
        onClick={() => navigate(`${basePath}/notifications`)}
        aria-label="Notificações"
        className={`relative p-2 tap rounded-lg ${
          isOnNotifications ? 'text-primary bg-primary/10' : 'text-textMuted'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => navigate(`${basePath}/profile`)}
        aria-label="Meu perfil"
        className={`tap rounded-full p-0.5 ${
          isOnProfile ? 'ring-2 ring-primary' : ''
        }`}
      >
        <Avatar
          photoURL={profile?.photoURL}
          kind={role === 'admin' ? 'admin' : 'adult'}
          seed={user?.uid}
          name={profile?.name}
          size="sm"
        />
      </button>
    </>
  );
}
