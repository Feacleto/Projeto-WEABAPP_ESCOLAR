import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Users, Map, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
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
  { to: '/tio', label: 'Início', icon: Home, end: true },
  { to: '/tio/children', label: 'Crianças', icon: Users },
  { to: '/tio/route/now', label: 'Rota', icon: Map },
  { to: '/tio/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function TioLayout() {
  const { user, profile } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false); // modal central (1º acesso)
  const [tourOpen, setTourOpen] = useState(false); // tour interativo
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

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWelcomeOpen(true);
    }
  }, [profile?.tutorialDone, profile]);

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

  const openTutorial = (opts = {}) => {
    // floating=true → tour interativo (botão "Como usar")
    // sem opts → modal central (1º acesso)
    if (opts.floating) setTourOpen(true);
    else setWelcomeOpen(true);
  };

  return (
    <div className="min-h-screen pb-28">
      <Outlet context={{ openTutorial }} />
      <BottomNav items={NAV_ITEMS} />
      {welcomeOpen && <Tutorial onClose={() => setWelcomeOpen(false)} />}
      <InteractiveTour open={tourOpen} onClose={() => setTourOpen(false)} />
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
