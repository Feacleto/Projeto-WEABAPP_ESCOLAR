import {
  Clock,
  Hand,
  Bus,
  Users,
  UserPlus,
  Play,
  DollarSign,
  Wallet,
  Bell,
  UserX,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

/**
 * Passos do tour guiado.
 *
 * O ROTEIRO ACOMPANHA O APP, E O APP MUDOU DUAS VEZES.
 *
 * PRIMEIRO as quatro abas viraram duas. O tour mandava "toque em Crianças" e
 * "toque em Rota" — dois passos `interact` ancorados em abas que já não
 * existiam. O passeio virou Início → Minha turma → Financeiro.
 *
 * DEPOIS o modelo de rota mudou inteiro: os seis turnos fixos deram lugar à
 * HORA COMBINADA COM CADA FAMÍLIA. E o tour não soube — ele ensinava a operar
 * um app cujo conceito central ele nunca mencionava. Pior: o motorista que vem
 * do modelo antigo abre o app e encontra uma cobrança ("3 a confirmar") sem
 * nenhuma explicação do que é pra confirmar. Por isso existe agora um passo
 * só sobre os horários, dos dois lados.
 *
 * E UM PASSO APONTAVA PRO ELEMENTO ERRADO. "Começar a viagem" tinha sido
 * repontado pra âncora `hero` — que é o cartão da próxima viagem, na rolagem
 * da página — enquanto o texto dizia "este mesmo quadro vira o botão de
 * iniciar a rota". O botão é uma barra FIXA no topo, e nunca foi o mesmo
 * quadro. Passo que ilumina uma coisa e descreve outra ensina errado com toda
 * a confiança do tutorial por trás.
 *
 * Um passo é uma frase curta ancorada num elemento REAL da tela — o app fica
 * visível atrás, com o elemento iluminado.
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
    body: 'Este quadro mostra a que horas sai a próxima viagem e quem você pega primeiro. Ele muda sozinho conforme o relógio.',
  },
  {
    path: '/tio',
    anchor: 'start-route',
    icon: Play,
    title: 'Começar a viagem',
    body: 'Este botão fica sempre no alto da tela. Toque nele quando sair e deixe o celular ligado — a partir daí os pais veem a perua andando no mapa.',
  },
  {
    path: '/tio',
    anchor: 'horarios',
    icon: Clock,
    title: 'A hora de cada criança',
    body: 'Seu dia é montado com as horas que VOCÊ define pra cada criança. Aqui você ajusta uma a uma. Se aparecer "presumido", é criança que o app chutou o horário — e esse chute não aparece pro responsável até você definir o seu.',
  },
  {
    path: '/tio',
    anchor: 'turma',
    interact: true,
    icon: Users,
    title: 'Agora toque em "Minha turma"',
    body: 'Pode tocar aí — eu espero você.',
  },
  {
    path: '/tio/children',
    anchor: 'add-child',
    icon: UserPlus,
    title: 'Cadastrar uma criança',
    body: 'Toque em "Nova criança" e preencha — inclusive a hora que você vai pegar e entregar. No fim o app cria um código: mande pro pai, e com ele o pai entra e já vê o filho e o horário.',
  },
  {
    path: '/tio',
    anchor: 'nav-finance',
    interact: true,
    icon: DollarSign,
    title: 'Toque em "Financeiro"',
    body: 'Último lugar do passeio. Pode tocar aí embaixo.',
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
    body: 'São duas abas só: aqui no Início você trabalha, e no Financeiro você recebe. O resto abre por aqui mesmo. Esqueceu alguma coisa? Abra seu perfil e toque em "Ver tutorial de novo".',
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
    anchor: 'horario-dia',
    icon: Clock,
    title: 'A que horas a perua passa',
    body: 'Aqui ficam a hora de buscar e a de trazer, combinadas com o motorista, e a sua posição na fila do dia. Se aparecer "combine com ele a hora", é porque isso ainda não foi acertado — fale com o motorista.',
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
