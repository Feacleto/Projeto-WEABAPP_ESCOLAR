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
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo (2 abas).
 * Hospeda o modal de tutorial e expõe openTutorial via Outlet context.
 */
export default function PaiLayout() {
  const { profile } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.tutorialDone !== true) {
      setTutorialOpen(true);
    }
  }, [profile?.tutorialDone, profile]);

  return (
    <div className="min-h-screen pb-20">
      <Outlet context={{ openTutorial: () => setTutorialOpen(true) }} />
      <BottomNav items={NAV_ITEMS} />
      {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}
