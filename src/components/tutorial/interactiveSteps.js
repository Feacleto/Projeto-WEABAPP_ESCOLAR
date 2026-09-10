import {
  Clock,
  Hand,
  Bus,
  UserPlus,
  Play,
  DollarSign,
  Wallet,
  Bell,
  BellRing,
  UserX,
  MapPin,
  Menu,
  ListOrdered,
  AlertTriangle,
  Link2,
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
 *
 * ── `cita`: A FRASE É A DO SITE, E ISSO É TESTE
 * O motorista chega aqui tendo lido a landing. Ela promete em palavras
 * próprias — *"a rota do dia pronta, na ordem dos horários"*, *"sem caderno,
 * sem planilha e sem cobrar de boca"* — e o tour é o momento em que essas
 * frases viram tela. Dizer a MESMA coisa com OUTRAS palavras aqui dentro faz
 * o app parecer um segundo produto, e a promessa parecer propaganda.
 *
 * Então cada passo carrega a frase da landing que ele fecha, e o balão a
 * mostra citada, acima do texto. `npm run testar:tutorial` confere que cada
 * `cita` existe de verdade em `landing/index.html` — sem isso, a landing muda
 * uma linha e o tour passa a citar algo que ninguém leu.
 *
 * ── ⚠️ `interact` SÓ ONDE O TOQUE NÃO CUSTA NADA A NINGUÉM
 * Pedir o toque no elemento de verdade é o que ensina o gesto. Só que quatro
 * dos botões deste app fazem coisas no mundo:
 *
 *   `start-route`       liga o GPS, publica a perua pra todas as famílias E
 *                       ESCREVE `trialInicio` — o toque do tutorial gastaria
 *                       o primeiro dia dos três meses de teste
 *   `avancar-status`    muda o estado da criança e avisa a família
 *   `buzinar`           faz o celular de um responsável tocar
 *   `lista-pagamentos`  dá baixa em dinheiro que talvez não tenha entrado
 *
 * Nesses o passo ILUMINA e EXPLICA, e o texto diz pra não tocar agora quando
 * o toque teria efeito. Só gesto inerte — abrir folha, trocar de tela, mudar
 * de aba — pede o dedo. A lista está travada em `npm run testar:tutorial`:
 * pôr `interact` num deles falha o teste em vez de aparecer como uma rota
 * ligada sozinha no primeiro acesso de alguém.
 */

export const ADMIN_TOUR = [
  {
    path: '/tio',
    icon: Hand,
    cita: 'Este é o seu novo app.',
    title: 'Oi, Tio! Vamos junto?',
    body: 'Uns quatro minutos. Cada parada mostra onde está, na tela, uma coisa que o site te prometeu.',
  },
  {
    path: '/tio',
    anchor: 'hero',
    icon: Bus,
    cita: 'A rota do dia pronta, na ordem dos horários',
    title: 'A rota do dia, pronta',
    body: 'Ela é esta. Você preenche uma vez e o dia se monta sozinho na ordem das horas — sem você arrastar nada.',
  },
  {
    path: '/tio',
    anchor: 'start-route',
    icon: Play,
    cita: 'A rota roda e todo mundo vê',
    title: 'Todo dia você dá partida',
    // ⚠️ SEM `interact`: este toque liga o GPS de verdade e escreve
    // `trialInicio`. Ver a regra no cabeçalho.
    body: 'Este botão fica sempre no alto da tela. Toque nele quando SAIR de casa e deixe o celular ligado: daí em diante a família acompanha a perua no mapa. Agora não precisa — ele liga o GPS de verdade.',
  },
  {
    path: '/tio',
    anchor: 'avancar-status',
    icon: CheckCircle2,
    cita:
      'A hora que a criança subiu, chegou na escola e desceu em casa, registrada todo dia',
    title: 'Uma criança de cada vez',
    // A âncora só existe com a rota rodando. Sem ela o passo vira balão no
    // rodapé — e por isso o texto começa dizendo QUANDO isso aparece.
    body: 'Com a rota rodando, a tela vira um botão grande por criança: EMBARQUEI e, na escola, ENTREGUEI. Quem registra a hora é esse toque, e a família vê na hora.',
  },
  {
    path: '/tio',
    anchor: 'buzinar',
    icon: BellRing,
    cita: 'Aviso automático pra família quando você está chegando',
    title: 'A buzina que não incomoda a rua',
    body: 'O aviso de chegada vai sozinho. Se ninguém descer, "Buzinar" faz o celular do responsável tocar em tela cheia — e do lado ficam o Zap e a ligação. Use só na porta dele: toca de verdade.',
  },
  {
    path: '/tio',
    anchor: 'turma',
    interact: true,
    icon: Menu,
    cita: 'A gente vem tirar o resto do seu ombro',
    title: 'Tudo isso num lugar só',
    body: 'Turma, escolas, horários e avisos ficam nesta linha. E ela continua aqui com a rota ligada — dá pra avisar a escola parado no portão, sem encerrar nada.',
  },
  {
    path: '/tio',
    anchor: 'rota-padrao',
    interact: true,
    icon: ListOrdered,
    cita:
      'O horário combinado de embarque e desembarque, acompanhado pela família todo dia',
    title: 'O horário combinado com os pais',
    body: 'Ele mora em "Editar rota padrão". O que você escreve ali é o que a família vê, todo dia.',
  },
  {
    path: '/tio/horarios',
    anchor: 'presumido',
    icon: AlertTriangle,
    cita: 'Você preenche uma vez',
    title: '"Presumido" é chute do app',
    body: 'Enquanto você não preencheu, o app chuta pra ninguém sumir da rota. E o responsável não vê o chute: a tela dele diz que você ainda não informou. Toque no horário e defina o seu.',
  },
  {
    path: '/tio/children',
    anchor: 'add-child',
    icon: UserPlus,
    cita:
      'Cada criança com nome, foto, endereço, escola e o horário combinado com os pais',
    title: 'O tio cadastra a turma',
    body: 'É este botão. Preencha uma vez, inclusive a hora de pegar e a de entregar.',
  },
  {
    path: '/tio/children',
    icon: Link2,
    cita: 'O tio cria a conta, e com um clique no link ela já entra',
    title: 'A família entra pelo link',
    body: 'No fim do cadastro o app cria um link. Mande no WhatsApp: se ela sabe mexer no WhatsApp, sabe mexer nisso — e já entra vendo o filho e o horário.',
  },
  {
    path: '/tio',
    anchor: 'nav-finance',
    interact: true,
    icon: DollarSign,
    cita: 'Sem caderno, sem planilha e sem cobrar de boca',
    title: 'Segunda aba: o dinheiro',
    body: 'São duas abas só: no Início você trabalha, no Financeiro você recebe. Pode tocar aí embaixo.',
  },
  {
    path: '/tio/finance',
    anchor: 'lista-pagamentos',
    icon: Wallet,
    cita: 'Quem pagou, quem falta, e o PIX pronto pra mandar',
    title: 'A mensalidade se organiza sozinha',
    body: 'O app monta a lista do mês sozinho. Pagou em dinheiro? Você marca com um toque. A mensalidade não passa pela plataforma: o que a família te paga é seu, por inteiro.',
  },
  {
    path: '/tio',
    icon: CheckCircle2,
    cita: 'Você dirige, e o seu dia fica mais leve',
    title: 'Pronto, é isso!',
    body: 'Cadastre a turma inteira, rode o mês e decida depois — o teste começa na sua primeira rota, não no cadastro. Esqueceu alguma coisa? Abra "Meu transporte" e toque em "Como usar o app".',
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
