import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Home, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
import InteractiveTour from '../../components/tutorial/InteractiveTour';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/pai', label: 'Início', icon: Home, end: true },
  { to: '/pai/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function PaiLayout() {
  const { profile } = useAuth();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWelcomeOpen(true);
    }
  }, [profile?.tutorialDone, profile]);

  const openTutorial = (opts = {}) => {
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
