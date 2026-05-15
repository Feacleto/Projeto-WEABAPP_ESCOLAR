import {
  Hand,
  Sparkles,
  Users,
  Map,
  DollarSign,
  Bell,
  UserX,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

/**
 * Passos do tour interativo. Cada passo:
 *   - path:        rota pra navegar antes de mostrar
 *   - icon:        Lucide
 *   - title:       frase curta (≤ 5 palavras)
 *   - body:        explicação ≤ 18 palavras
 *
 * O tour navega entre as telas reais — usuário pode tocar no app
 * enquanto vê o tooltip flutuante. Use frases coloquiais.
 */

export const ADMIN_TOUR = [
  {
    path: '/tio',
    icon: Hand,
    title: 'Bem-vindo!',
    body: 'Vou te mostrar o app em poucos passos. Toque em "Próximo".',
  },
  {
    path: '/tio',
    icon: Sparkles,
    title: 'O hero verde é o foco',
    body: 'Toque nele pra começar ou ver a rota. É a ação mais importante.',
  },
  {
    path: '/tio/children',
    icon: Users,
    title: 'Sua turma',
    body: 'Aqui você cadastra crianças e gera convite pros pais entrarem.',
  },
  {
    path: '/tio/route',
    icon: Map,
    title: 'Rota do dia',
    body: 'Comece a rota, gerencie ausências e arraste pra reordenar a fila.',
  },
  {
    path: '/tio/finance',
    icon: DollarSign,
    title: 'Pagamentos',
    body: 'Cada mês é gerado automaticamente. Você dá baixa quando recebe.',
  },
  {
    path: '/tio',
    icon: CheckCircle2,
    title: 'Pronto!',
    body: 'Você pode rever esse tour quando quiser em "Como usar o app".',
  },
];

export const PARENT_TOUR = [
  {
    path: '/pai',
    icon: Hand,
    title: 'Bem-vindo!',
    body: 'Vou te mostrar como acompanhar seu filho. Toque em "Próximo".',
  },
  {
    path: '/pai',
    icon: Sparkles,
    title: 'Status ao vivo',
    body: 'O card colorido te diz onde a criança está agora. Muda em tempo real.',
  },
  {
    path: '/pai',
    icon: UserX,
    title: 'Avisar ausência',
    body: 'Se a criança vai faltar, toque em "vai faltar?" e avise o motorista.',
  },
  {
    path: '/pai/finance',
    icon: DollarSign,
    title: 'Pagamentos',
    body: 'Veja o que tá em dia, o que vence e marque quando pagar.',
  },
  {
    path: '/pai',
    icon: Bell,
    title: 'Avisos automáticos',
    body: 'Quando o motorista tá chegando, você é avisado — com vibração.',
  },
  {
    path: '/pai',
    icon: HelpCircle,
    title: 'Pronto!',
    body: 'Rever esse tour quando quiser em "Como usar o app".',
  },
];

export function getInteractiveTour(role) {
  if (role === 'admin') return ADMIN_TOUR;
  if (role === 'parent') return PARENT_TOUR;
  return [];
}
