import { useEffect, useMemo, useState, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Map, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import InstallPrompt from '../../components/common/InstallPrompt';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import { useAuth } from '../../hooks/useAuth';
import { useAutoBilling } from '../../hooks/useAutoBilling';
import { useActiveCallsForAdmin } from '../../hooks/usePendingCall';
import { useChildren } from '../../hooks/useChildren';
import OutgoingCallPanel from '../../components/call/OutgoingCallPanel';
import BirthdayModal from '../../components/festive/BirthdayModal';
import {
  getTodaysBirthdayChildren,
  shouldShowBirthdayModal,
  markBirthdayModalShown,
} from '../../services/birthdayService';

const NAV_ITEMS = [
  { to: '/tio', label: 'Início', icon: Home, end: true, tour: 'nav-home' },
  { to: '/tio/children', label: 'Crianças', icon: Users, tour: 'nav-children' },
  { to: '/tio/route/now', label: 'Rota', icon: Map, tour: 'nav-route' },
  {
    to: '/tio/finance',
    label: 'Financeiro',
    icon: DollarSign,
    tour: 'nav-finance',
  },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function TioLayout() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // null | 'first' (primeiro acesso) | 'review' (pediu pra rever no perfil)
  const [tour, setTour] = useState(null);
  // Abre sozinho UMA vez por sessão: o profile é refetchado em vários
  // momentos, e sem isso o tour reabriria por cima de quem acabou de
  // fechá-lo. Quem pulou reencontra o tour no próximo login.
  const autoOpened = useRef(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  useAutoBilling(profile?.role);

  // Chamadas que o Tio disparou — pop-up flutuante mostra status em tempo real
  const activeCalls = useActiveCallsForAdmin(user?.uid);

  // Aniversariantes do dia — só dispara o modal 1x por dia (localStorage)
  const { children } = useChildren();
  const birthdayChildren = useMemo(
    () => getTodaysBirthdayChildren(children),
    [children]
  );

  // Primeiro acesso: o tour abre sozinho e volta a cada login enquanto o Tio
  // não chegar no último passo. Pular é permitido; concluir é o que desliga.
  useEffect(() => {
    if (autoOpened.current) return;
    if (profile && profile.tutorialDone !== true) {
      autoOpened.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTour('first');
    }
  }, [profile?.tutorialDone, profile]);

  // "Ver tutorial de novo" no perfil manda pra cá com esse state: o tour
  // precisa da tela inicial embaixo pra ter o que iluminar.
  useEffect(() => {
    if (location.state?.openTour) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTour('review');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (birthdayChildren.length > 0 && shouldShowBirthdayModal()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBirthdayOpen(true);
    }
  }, [birthdayChildren.length]);

  const onCloseBirthday = () => {
    setBirthdayOpen(false);
    markBirthdayModalShown();
  };

  // Usado pelo "Como usar o app" do painel
  const openTutorial = () => setTour('review');

  return (
    <div className="min-h-screen pb-28">
      <Outlet context={{ openTutorial }} />
      <BottomNav items={NAV_ITEMS} />
      <InstallPrompt />
      <InteractiveTour
        open={!!tour}
        mode={tour || 'review'}
        onClose={() => setTour(null)}
      />
      <OutgoingCallPanel calls={activeCalls} />
      {birthdayOpen && (
        <BirthdayModal
          children={birthdayChildren}
          role="tio"
          onClose={onCloseBirthday}
        />
      )}
    </div>
  );
}
