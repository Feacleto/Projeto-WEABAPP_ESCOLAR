import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Map, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';

const NAV_ITEMS = [
  { to: '/tio', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/tio/children', label: 'Crianças', icon: Users },
  { to: '/tio/route', label: 'Rota', icon: Map },
  { to: '/tio/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Tio: <Outlet /> + BottomNav fixo.
 * O pb-20 garante que o conteúdo não fique escondido atrás da nav.
 */
export default function TioLayout() {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
