import { Outlet } from 'react-router-dom';
import { Bus, DollarSign, UserRound } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import FolhaDaMarcaDaAuxiliar from '../../components/marca/FolhaDaMarcaDaAuxiliar';

/**
 * O APP DA AUXILIAR (05/10/2026) — a conta dela, no celular dela.
 *
 * Duas abas na fase 1: Hoje (a perua de quem ela trabalha) e Perfil. A turma
 * do dia, a rota e os pagamentos dela chegam nas próximas fases, cada um com
 * o recorte que o servidor entrega a ela: nada de mensalidade, contrato ou
 * saúde das crianças.
 *
 * Não existe troca de modo: o motorista usa a conta dele, ela a dela
 * (decisão do dono, 05/10/2026).
 *
 * O logo do tio no cabeçalho abre a FOLHA DA MARCA (05/10/2026), e é nela
 * que ela troca de perua quando trabalha para dois — o provedor mora aqui.
 */
const NAV_ITEMS = [
  { to: '/aux', label: 'Hoje', icon: Bus, end: true },
  // Fase 4: o que o motorista anotou que pagou a ela, atrás da senha dela.
  { to: '/aux/pagamentos', label: 'Pagamentos', icon: DollarSign },
  { to: '/aux/perfil', label: 'Perfil', icon: UserRound },
];

export default function AuxLayout() {
  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))' }}>
      <FolhaDaMarcaDaAuxiliar>
        <Outlet />
      </FolhaDaMarcaDaAuxiliar>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
