import {
  Hand,
  Users,
  Map,
  DollarSign,
  Home,
  Bell,
  Receipt,
} from 'lucide-react';

// Conteúdo dos slides por role. 4 passos cada — sweet spot de "rápido e útil".
// Adicionar/remover passo aqui: o componente Tutorial recalcula dots/contagem
// automaticamente.

export const ADMIN_STEPS = [
  {
    icon: Hand,
    title: 'Bem-vindo, Tio!',
    description:
      'Aqui você gerencia crianças, rotas e pagamentos. Vamos dar uma olhada rápida nas principais funções.',
  },
  {
    icon: Users,
    title: 'Cadastre as crianças',
    description:
      'Na aba "Crianças", toque no + pra adicionar. Ao salvar, o app gera um código de convite (ex: TN4582) — entregue ao responsável pra ele criar a conta.',
  },
  {
    icon: Map,
    title: 'Inicie a rota com GPS',
    description:
      'Na aba "Rota", toque em "Iniciar rota" e mantenha o app aberto. A perua vai aparecer ao vivo no mapa dos pais a cada 30 segundos.',
  },
  {
    icon: DollarSign,
    title: 'Acompanhe pagamentos',
    description:
      'A aba "Financeiro" mostra os pagamentos do mês de cada família. Marque como pago quando receber.',
  },
];

export const PARENT_STEPS = [
  {
    icon: Hand,
    title: 'Bem-vindo!',
    description:
      'Aqui você acompanha o trajeto da criança em tempo real e os pagamentos. Vou te mostrar rapidinho as principais telas.',
  },
  {
    icon: Home,
    title: 'Status da criança',
    description:
      'Na tela inicial você vê em tempo real onde a criança está (em casa, embarcada, na escola...) e o mapa com a perua.',
  },
  {
    icon: Bell,
    title: 'Alertas de proximidade',
    description:
      'Quando a perua estiver chegando perto, o app avisa: a 2 km você vê a estimativa, e a 400 m recebe um aviso com vibração.',
  },
  {
    icon: Receipt,
    title: 'Histórico de pagamentos',
    description:
      'Na aba "Financeiro" você consulta as mensalidades pagas e em aberto. Ao pagar, o Tio marca como quitado.',
  },
];

export function getStepsForRole(role) {
  if (role === 'admin') return ADMIN_STEPS;
  if (role === 'parent') return PARENT_STEPS;
  return [];
}
