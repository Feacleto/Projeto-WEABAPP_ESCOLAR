import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, Users, Map, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import { useAuth } from '../../hooks/useAuth';
import { useAutoBilling } from '../../hooks/useAutoBilling';

const NAV_ITEMS = [
  { to: '/tio', label: 'Início', icon: Home, end: true },
  { to: '/tio/children', label: 'Crianças', icon: Users },
  { to: '/tio/route', label: 'Rota', icon: Map },
  { to: '/tio/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function TioLayout() {
  const { profile } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false); // modal central (1º acesso)
  const [tourOpen, setTourOpen] = useState(false); // tour interativo

  useAutoBilling(profile?.role);

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWelcomeOpen(true);
    }
  }, [profile?.tutorialDone, profile]);

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
    </div>
  );
}
