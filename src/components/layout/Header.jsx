import { useState } from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaymentsByParent } from '../../hooks/usePayments';
import ProfileMenu from './ProfileMenu';
import NotificationsSheet from '../notifications/NotificationsSheet';

/**
 * Header sticky comum às páginas autenticadas.
 *
 * Renderiza automaticamente bell (notificações) + menu de perfil no canto
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
    /* O RECORTE DA TELA FAZ PARTE DO CABEÇALHO.
     *
     * O index.html declara `viewport-fit=cover`: o app pinta até a borda
     * física do aparelho. Sem devolver a faixa do sistema, no iPhone
     * instalado como app o título e o rosto do perfil ficam POR BAIXO do
     * relógio e da bateria — some justamente a linha que diz onde a pessoa
     * está. Em Android e desktop o env() vale 0 e nada muda.
     *
     * A faixa é padding do <header>, não do conteúdo: a barra continua
     * grudada no topo e a tarja do sistema fica com a cor do cabeçalho. */
    <header
      className="sticky top-0 z-20 bg-card border-b border-gray-100 print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div className="h-14 px-4 flex items-center justify-between gap-3">
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
          <h1 className="text-base font-semibold text-text truncate">
            {title}
          </h1>
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
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
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
      {/* O SINO ABRE FOLHA, NÃO OUTRA TELA.
        * Ele existe no cabeçalho de todas as telas; navegar daqui custava a
        * rolagem, o filtro e o lugar de quem só queria dar uma olhada. A
        * exceção é quando ele JÁ está na página de notificações (chegou por
        * push ou link): ali a folha seria uma cópia do que está atrás. */}
      <button
        onClick={() =>
          isOnNotifications
            ? navigate(`${basePath}/notifications`)
            : setNotifOpen(true)
        }
        aria-label="Notificações"
        aria-haspopup="dialog"
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
      {/* O rosto abre MENU, não outra tela: as ações que a pessoa vem
       * buscar aqui (sair, tutorial, suporte) cabem num menu, e ela não
       * perde o lugar onde estava. Ver ProfileMenu. */}
      <ProfileMenu role={role} basePath={basePath} active={isOnProfile} />

      <NotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </>
  );
}
