/**
 * Passos do tour guiado.
 *
 * ── O DO MOTORISTA SÃO QUATRO PARADAS (02/10/2026)
 * Eram treze, cada uma citando uma frase da landing, e metade apontava para
 * botões que quem acabou de criar a conta NÃO TEM na tela: iniciar rota,
 * avançar status e buzinar só existem com a turma cadastrada. O tour abria
 * logo depois do cadastro e passava quatro minutos descrevendo uma tela que
 * a pessoa não estava vendo.
 *
 * Agora ele mostra os lugares-chave da operação que JÁ ESTÃO lá — cadastrar
 * a primeira criança, "Meu transporte", a aba Financeiro, e o topo do Início, onde a
 * partida vai aparecer. Desde 04/10/2026 o cadastro da primeira criança é a
 * ÚLTIMA parada, e o botão final ("Cadastrar criança") abre o cadastro. Título curto e uma frase. Pedido do dono: simples,
 * curto e memorável. O que torna memorável é o balão (ver `InteractiveTour`):
 * uma estradinha com uma parada por passo, e a perua andando nela.
 *
 * A citação da landing (`cita`) SAIU: com quatro paradas, a frase do site em
 * cima da frase do app dobrava o texto de cada balão.
 *
 * Campos:
 *   - path:     rota pra onde navegar antes de mostrar o passo
 *   - anchor:   valor de um atributo data-tour="..." no elemento a destacar.
 *               Se o elemento não existir na tela, o passo continua válido:
 *               o balão encosta no rodapé, sem destaque.
 *   - prefer:   âncora a tentar ANTES de `anchor`. O topo do Início vira o
 *               botão de iniciar rota quando há turma; sem turma, é o cartão
 *               vazio. Os dois são "onde você dá a partida".
 *   - interact: true → tocar no próprio elemento avança o passo. Só o tour do
 *               responsável usa; o do motorista avança só por "Próximo".
 *   - title / body
 *   - ctaLabel / ctaPath: só na ÚLTIMA parada. O botão final do balão diz
 *               `ctaLabel` e, além de fechar o tour, leva a `ctaPath`.
 *
 * REGRA DE ESCRITA (vale pros dois papéis)
 * Quem lê isso aqui não é usuário de app — é um motorista de 55 anos parado
 * no ponto e uma mãe no intervalo do trabalho. Então: frase curta, zero
 * jargão. Nada de "dashboard", "sincronizar", "status".
 *
 * ── ⚠️ `interact` SÓ ONDE O TOQUE NÃO CUSTA NADA A NINGUÉM
 * Quatro dos botões deste app fazem coisas no mundo:
 *
 *   `start-route`       liga o GPS, publica a perua pra todas as famílias E
 *                       ESCREVE `trialInicio`
 *   `avancar-status`    muda o estado da criança e avisa a família
 *   `buzinar`           faz o celular de um responsável tocar
 *   `lista-pagamentos`  dá baixa em dinheiro que talvez não tenha entrado
 *
 * Nesses o passo pode ILUMINAR, nunca pedir o toque. E fora dos passos
 * `interact` o app por baixo não recebe toque nenhum enquanto o balão está
 * aberto (ver `InteractiveTour`). A lista está travada em
 * `npm run testar:tutorial`.
 */

export const ADMIN_TOUR = [
  {
    path: '/tio',
    anchor: 'turma',
    title: 'Todo o seu ambiente de operação está aqui',
    body: 'Crianças, escolas, horários e avisos.',
  },
  {
    path: '/tio',
    anchor: 'nav-finance',
    title: 'Esta é a sua Carteira',
    body: 'Quem pagou, quem falta e o PIX pronto.',
  },
  {
    path: '/tio',
    prefer: 'start-route',
    anchor: 'hero',
    title: 'Aqui você dá a partida',
    body: 'Com a turma pronta, o botão Iniciar rota aparece aqui.',
  },
  // ⚠️ A ÚLTIMA PARADA É O PRIMEIRO GESTO (04/10/2026, aprovado pelo dono).
  // Era a primeira, e o tour terminava longe dela, no "Começar" que só
  // fechava o balão. Agora ele termina apontando para o botão do Início
  // vazio, e o botão final do balão FAZ o gesto: abre o cadastro.
  {
    path: '/tio',
    anchor: 'primeira-crianca',
    title: 'Comece pelas crianças',
    body: 'A escola você cadastra no caminho.',
    ctaLabel: 'Cadastrar criança',
    ctaPath: '/tio/children/new',
  },
];

/* O DO RESPONSÁVEL TAMBÉM SÃO QUATRO PARADAS (02/10/2026), no mesmo balão
 * do motorista — pedido do dono: os dois primeiros acessos têm que ser
 * parecidos. Eram nove passos, um deles pedindo o toque em "Financeiro"
 * ("eu espero você"). Agora só "Próximo" anda, e cada parada é um lugar que
 * ela vai usar toda semana. */
export const PARENT_TOUR = [
  {
    path: '/pai',
    anchor: 'hero',
    title: 'Onde seu filho está',
    body: 'Em casa, na perua ou na escola, ao vivo.',
  },
  {
    path: '/pai',
    anchor: 'horario-dia',
    title: 'A hora da perua',
    body: 'A que horas ela passa hoje.',
  },
  {
    path: '/pai',
    anchor: 'absence',
    title: 'Ele não vai hoje?',
    body: 'Avise aqui e o motorista não passa à toa.',
  },
  {
    path: '/pai',
    anchor: 'nav-finance',
    title: 'A mensalidade',
    body: 'O que já pagou e o que vence.',
  },
];

export function getInteractiveTour(role) {
  if (role === 'admin') return ADMIN_TOUR;
  if (role === 'parent') return PARENT_TOUR;
  return [];
}
