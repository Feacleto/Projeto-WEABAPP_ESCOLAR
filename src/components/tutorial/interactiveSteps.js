import {
  Hand,
  Bus,
  Users,
  UserPlus,
  Map,
  Play,
  DollarSign,
  Wallet,
  Bell,
  UserX,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

/**
 * Passos do tour guiado. Um passo é uma frase curta ancorada num elemento
 * REAL da tela — o app fica visível atrás, com o elemento iluminado.
 *
 * Campos:
 *   - path:     rota pra onde navegar antes de mostrar o passo
 *   - anchor:   valor de um atributo data-tour="..." no elemento a destacar.
 *               Se o elemento não existir na tela (ex: rota já iniciada
 *               esconde o botão "Começar agora"), o passo continua válido:
 *               o cartão vira um balão no rodapé, sem destaque.
 *   - interact: true → tocar no próprio elemento avança o passo. É o que
 *               tira o tour do "leia e clique em próximo" e ensina o gesto.
 *   - icon / title / body
 *
 * REGRA DE ESCRITA (vale pros dois papéis)
 * Quem lê isso aqui não é usuário de app — é um motorista de 55 anos parado
 * no ponto e uma mãe no intervalo do trabalho. Então: frase curta, verbo no
 * imperativo, zero jargão. Nada de "dashboard", "sincronizar", "status".
 * Diga "perua", "seu filho", "o dinheiro do mês".
 */

export const ADMIN_TOUR = [
  {
    path: '/tio',
    icon: Hand,
    title: 'Oi, Tio! Vamos junto?',
    body: 'Em um minutinho eu te mostro onde fica cada coisa. É só ir tocando em "Próximo".',
  },
  {
    path: '/tio',
    anchor: 'hero',
    icon: Bus,
    title: 'Aqui é o seu dia',
    body: 'Este quadro mostra a que horas sai a próxima viagem e quem você pega primeiro. É por ele que o dia começa.',
  },
  {
    path: '/tio',
    anchor: 'nav-children',
    interact: true,
    icon: Users,
    title: 'Agora toque em "Crianças"',
    body: 'Pode tocar aí embaixo — eu espero você.',
  },
  {
    path: '/tio/children',
    anchor: 'add-child',
    icon: UserPlus,
    title: 'Cadastrar uma criança',
    body: 'Toque em "Nova criança" e preencha. No fim o app cria um código — mande pro pai. Com esse código ele entra e já vê o filho.',
  },
  {
    path: '/tio/children',
    anchor: 'nav-route',
    interact: true,
    icon: Map,
    title: 'Toque em "Rota"',
    body: 'É a tela que você mais vai usar.',
  },
  {
    path: '/tio/route/now',
    anchor: 'start-route',
    icon: Play,
    title: 'Começar a viagem',
    body: 'Toque em "Iniciar rota" e deixe o celular ligado. A partir daí os pais veem a perua andando no mapa.',
  },
  {
    path: '/tio/route/now',
    anchor: 'nav-finance',
    interact: true,
    icon: DollarSign,
    title: 'Toque em "Financeiro"',
    body: 'Último lugar do passeio.',
  },
  {
    path: '/tio/finance',
    icon: Wallet,
    title: 'O dinheiro do mês',
    body: 'O app monta sozinho a lista de quem tem que pagar. Quando alguém te paga, é só marcar como recebido.',
  },
  {
    path: '/tio',
    icon: CheckCircle2,
    title: 'Pronto, é isso!',
    body: 'Esqueceu alguma coisa? Abra seu perfil e toque em "Ver tutorial de novo".',
  },
];

export const PARENT_TOUR = [
  {
    path: '/pai',
    icon: Hand,
    title: 'Oi! Vamos dar uma olhada?',
    body: 'Em um minutinho eu te mostro como acompanhar seu filho. É só ir tocando em "Próximo".',
  },
  {
    path: '/pai',
    anchor: 'hero',
    icon: Bus,
    title: 'Onde seu filho está agora',
    body: 'Este quadro muda sozinho: em casa, dentro da perua ou já na escola.',
  },
  {
    path: '/pai',
    anchor: 'absence',
    icon: UserX,
    title: 'Ele não vai hoje?',
    body: 'Toque aqui pra avisar. O motorista recebe o aviso na hora e não passa na sua porta à toa.',
  },
  {
    path: '/pai',
    anchor: 'map',
    icon: MapPin,
    title: 'Ver a perua no mapa',
    body: 'Dá pra acompanhar ao vivo por onde ela está.',
  },
  {
    path: '/pai',
    anchor: 'map',
    icon: Bell,
    title: 'O celular te avisa',
    body: 'Quando a perua estiver chegando perto da sua casa, o app avisa e vibra. Não precisa ficar olhando.',
  },
  {
    path: '/pai',
    anchor: 'nav-finance',
    interact: true,
    icon: DollarSign,
    title: 'Toque em "Financeiro"',
    body: 'Pode tocar aí embaixo — eu espero você.',
  },
  {
    path: '/pai/finance',
    icon: Wallet,
    title: 'Suas mensalidades',
    body: 'Aqui você vê o que já pagou e o que está pra vencer. Depois de pagar, avise por aqui.',
  },
  {
    path: '/pai',
    icon: CheckCircle2,
    title: 'Pronto, é isso!',
    body: 'Esqueceu alguma coisa? Abra seu perfil e toque em "Ver tutorial de novo".',
  },
];

export function getInteractiveTour(role) {
  if (role === 'admin') return ADMIN_TOUR;
  if (role === 'parent') return PARENT_TOUR;
  return [];
}
