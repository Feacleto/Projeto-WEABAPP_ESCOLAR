import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Map, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import Tutorial from '../../components/tutorial/Tutorial';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/tio', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/tio/children', label: 'Crianças', icon: Users },
  { to: '/tio/route', label: 'Rota', icon: Map },
  { to: '/tio/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * O pb-20 garante que o conteúdo não fique escondido atrás da nav.
 *
 * Hospeda também o modal de tutorial (1ª vez) e expõe `openTutorial` via
 * Outlet context pra que o Dashboard possa oferecer "Ver tutorial novamente".
 */
export default function TioLayout() {
  const { profile } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Abre automaticamente quando o usuário ainda não concluiu o tutorial.
  // Reabre se profile.tutorialDone voltar pra false (botão "Refazer tutorial").
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
