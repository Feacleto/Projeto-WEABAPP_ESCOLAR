import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/pai', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/pai/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo.
 * Notificações e perfil ficam no Header (sino + ícone à direita).
 */
export default function PaiLayout() {
  const { profile } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialFloating, setTutorialFloating] = useState(false);

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTutorialOpen(true);
      setTutorialFloating(false);
    }
  }, [profile?.tutorialDone, profile]);

  const openTutorial = (opts = {}) => {
    setTutorialFloating(!!opts.floating);
    setTutorialOpen(true);
  };

  return (
    <div className="min-h-screen pb-20">
      <Outlet context={{ openTutorial }} />
      <BottomNav items={NAV_ITEMS} />
      {tutorialOpen && (
        <Tutorial
          floating={tutorialFloating}
          onClose={() => setTutorialOpen(false)}
        />
      )}
    </div>
  );
}
