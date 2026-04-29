import { Outlet } from 'react-router-dom';
import { LayoutDashboard, DollarSign } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';

const NAV_ITEMS = [
  { to: '/pai', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/pai/finance', label: 'Financeiro', icon: DollarSign },
];

/**
 * Layout do painel do Pai: <Outlet /> + BottomNav fixo (2 abas).
 */
export default function PaiLayout() {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
