/**
 * O FUNDO DA COLUNA DIREITA DO LOGIN — nove cartões, três por assunto.
 *
 * ── POR QUE ISTO EXISTE
 * A coluna direita do login era uma superfície branca com um cartão no meio.
 * E o login é a tela MAIS ACESSADA do produto — mais que a landing —, então
 * aquele vazio era o maior espaço de produto do Alô Buzinou sem nada dentro.
 *
 * O fundo mostra o app funcionando, e TROCA DE ASSUNTO conforme a tela: quem
 * passa por "já tenho conta", "criar conta" e o convite da família vê nove
 * peças diferentes em vez da mesma três vezes.
 *
 * ── POR QUE DADO, E NÃO JSX
 * Três motivos, e o terceiro é o que decidiu:
 *
 * 1. Assunto novo passa a ser um item no objeto, não uma cópia de markup.
 * 2. Nada disso vive dentro do formulário — o JSX do login não engorda.
 * 3. ⚠️ **A LISTA DO QUE NÃO PODE APARECER FICA TESTÁVEL.** Módulo puro é
 *    módulo que `node scripts/testar-fundo.mjs` importa. Se as frases
 *    morassem no componente, a única defesa seria lembrar delas.
 *
 * ── ⛔ O QUE NÃO PODE APARECER, E POR QUÊ
 * Cada linha abaixo é um número ou rótulo que EXISTIU no app e SAIU por
 * decisão registrada. Fundo que mostra a interface errada é pior que fundo
 * abstrato: ele promete uma tela que não existe, e quem cobra a promessa é
 * quem acabou de se cadastrar.
 *
 * - **"A receber R$ X"** — previsão no dia 3 do mês é quase o faturamento
 *   inteiro: um número grande, verde, que não é dinheiro. O herói do
 *   `TioFinance` tem UM número, e ele é o Recebido.
 * - **"2 abertas" / "3 atrasados"** como contagem — quem deve virou bloco com
 *   NOME e VALOR, porque "R$ 900 com 1 atrasado" pode ser R$ 100 ou R$ 800
 *   preso, e é essa diferença que decide se ele pega o telefone hoje.
 * - **Qualquer ETA em minutos** — era linha reta ÷ 18 km/h e foi arrancado do
 *   produto. A mãe lê sete minutos, desce com a criança e espera vinte na
 *   calçada; quem errou, pra ela, foi o motorista. Só distância MEDIDA.
 * - **"na perua", "próximo", pastilha "agora"** — vocabulário que nunca
 *   existiu. O app diz "Trazendo pra casa", "já foram entregues".
 * - **Foto ou nome completo de criança** — dado sensível (LGPD art. 5º, II).
 *   É também o que torna estes cartões possíveis: eles são RECRIADOS, não são
 *   print. Print de produto real levaria rosto e nome de criança para uma
 *   página pública.
 * - **Métrica de plataforma** ("+1000 motoristas") — a marca combinou não
 *   publicar número de cliente.
 * - **Âmbar** — `warning` é AVISO no app. Como enfeite, queima o sinal.
 *
 * ── AS GRANDEZAS SÃO PLAUSÍVEIS, NÃO SORTEADAS
 * "R$ 3.780", "18 crianças", "1,2 km": números de um motorista real de perua.
 * Fundo com R$ 47.000 ou 300 crianças descreve outro negócio.
 *
 * ── DE ONDE SAI CADA FRASE
 * As que o app já diz vêm COPIADAS da fonte, não parafraseadas:
 *   "Trazendo pra casa", "2 de 5 resolvidas"  → components/route/OperacaoDaRota.jsx
 *   "já foram entregues"                      → idem (o verbo da volta)
 *   "ENTREGUEI"                               → services/routeStatusService.js
 *   "Buzinar faz o celular..."                → OperacaoDaRota.jsx
 *   "A perua está a 1,2 km daqui"             → dominio/rota/routePresence.js
 *   "Avisamos quando estiver perto."          → idem
 *   "atualizado há 40 segundos"               → idem (formatFreshness)
 *
 * ⚠️ Se alguma dessas mudar na fonte, muda aqui na MESMA alteração — senão o
 * fundo passa a citar um app que não fala mais assim.
 */

/** Os três assuntos. A ordem é a do funil: entrar, criar, ser convidada. */
export const ASSUNTOS = ['entrar', 'criar', 'convite'];

/**
 * Os blocos que um cartão pode ter — primitivos que se recombinam, e é o que
 * evita nove componentes quase iguais. Cartão novo costuma ser rearranjo, não
 * bloco novo.
 *
 *   cabecalho   ícone em quadrado + título + subtítulo
 *   titulo      título + subtítulo SEM ícone (a folha de falta abre assim:
 *               o nome da criança já é o assunto)
 *   corpo       um parágrafo de texto do app
 *   progresso   a barra da viagem (fração de 0 a 1)
 *   linha       uma linha destacada: hora em mono + texto + check
 *   pessoa      iniciais + nome + detalhe + hora
 *   acao        o botão sólido (só aparência)
 *   botao       o botão de contorno, para ação secundária
 *   botaoZap    o botão do WhatsApp, na cor do WhatsApp
 *   atalhos     a fileira de três botões pequenos
 *   faixaHoras  as duas pontas do dia: ida em destaque, volta em repouso
 *   numero      rótulo mono + valor grande
 *   iniciais    rótulo + fileira de pastilhas + "+N"
 *   paradas     lista de hora + rosto (iniciais) + nome
 *   opcoes      escolhas com ícone, título e detalhe (a folha de falta)
 *   pastilhas   duas escolhas lado a lado
 *   codigo      o código do convite, em mono espaçado
 *   pago        o mês, o selo, o meio e o valor da mensalidade
 *   nota        a linha que o app escreve embaixo, em mono
 */
export const BLOCOS = [
  'cabecalho', 'titulo', 'progresso', 'linha', 'pessoa', 'acao',
  'atalhos', 'numero', 'iniciais', 'paradas', 'pastilhas', 'nota',
  'corpo', 'botao', 'botaoZap', 'faixaHoras', 'opcoes', 'codigo', 'pago',
];

// ── TRIO A · "Já tenho conta" ─────────────────────────────────────────────
//
// Quem chega aqui é usuário voltando, e o que ele reconhece é o PRÓPRIO
// trabalho. Os três cartões são o dia dele rodando: a viagem, a criança na
// porta, e o dinheiro que entrou.
const A = [
  {
    id: 'viagem',
    slot: 1,
    blocos: [
      { b: 'cabecalho', icone: 'casa', titulo: 'Trazendo pra casa', subtitulo: '2 de 5 resolvidas' },
      { b: 'progresso', fracao: 0.4 },
      { b: 'linha', hora: '16:52', texto: 'Maria Clara', check: true },
      { b: 'nota', texto: 'já foram entregues' },
    ],
  },
  {
    id: 'foco',
    slot: 2,
    blocos: [
      { b: 'pessoa', iniciais: 'PH', nome: 'Pedro Henrique', detalhe: 'R. das Acácias, 214', hora: '17:10' },
      { b: 'acao', rotulo: 'ENTREGUEI' },
      {
        b: 'atalhos',
        itens: [
          { rotulo: 'Buzinar', icone: 'sino', halo: true },
          { rotulo: 'Zap', icone: 'zap' },
          { rotulo: 'Ligar', icone: 'ligar' },
        ],
      },
      { b: 'nota', texto: 'Buzinar faz o celular do responsável tocar' },
    ],
  },
  {
    id: 'dinheiro',
    slot: 3,
    blocos: [
      { b: 'numero', rotulo: 'recebido · setembro', valor: 'R$ 3.780' },
      { b: 'iniciais', rotulo: 'quem já pagou', itens: ['MC', 'PH', 'JL', 'AS'], mais: '+10' },
    ],
  },
];

// ── TRIO B · "Criar conta" ────────────────────────────────────────────────
//
// Quem chega aqui já se interessou e a pergunta virou "quanto trabalho isso
// me dá?". Os três cartões são o caminho até funcionar — e os três terminam
// numa frase que diz o que ele NÃO precisa fazer.
const B = [
  {
    id: 'horarios',
    slot: 1,
    blocos: [
      { b: 'cabecalho', icone: 'relogio', titulo: 'Nenhuma viagem hoje' },
      {
        b: 'corpo',
        texto:
          'Defina a hora de pegar e entregar cada criança — a rota se monta a partir disso, e é o que o responsável vê.',
      },
      { b: 'botao', rotulo: 'Definir horários', contorno: true },
    ],
  },
  {
    id: 'viagem',
    slot: 2,
    blocos: [
      { b: 'faixaHoras', ida: '06:40', volta: '16:50' },
      { b: 'cabecalho', icone: 'casa', titulo: 'Levando pra escola', subtitulo: '3 crianças nesta viagem' },
      {
        b: 'paradas',
        itens: [
          { hora: '06:40', nome: 'Maria Clara', iniciais: 'MC' },
          { hora: '06:48', nome: 'Pedro Henrique', iniciais: 'PH' },
          { hora: '06:55', nome: 'Júlia Lima', iniciais: 'JL' },
        ],
      },
    ],
  },
  {
    id: 'convite',
    slot: 3,
    blocos: [
      { b: 'botaoZap', rotulo: 'Mandar convite no WhatsApp' },
      // ⚠️ O RÓTULO DESTE CÓDIGO MUDOU EM RELAÇÃO AO PROTÓTIPO, e de
      // propósito. Ele dizia "se precisar ditar por telefone" — e ditar por
      // telefone servia para ela DIGITAR o código, entrada que saiu do
      // produto em 09/09/2026 (ver o cabeçalho de `pages/FirstAccess.jsx`).
      // Um fundo que oferece um caminho que a próxima tela não tem é o mesmo
      // defeito da bifurcação do login, que foi corrigido no mesmo dia.
      //
      // O código continua indo na mensagem, e continua tendo função: é por
      // ele que ela confere que aquele link é daquele convite.
      { b: 'codigo', rotulo: 'o código vai junto na mensagem', valor: 'TN4582' },
    ],
  },
];

const C = [
  {
    id: 'perua',
    slot: 1,
    blocos: [
      { b: 'cabecalho', icone: 'perua', halo: true, titulo: 'A perua está a 1,2 km daqui', subtitulo: 'Avisamos quando estiver perto.' },
      { b: 'nota', texto: 'atualizado há 40 segundos' },
    ],
  },
  {
    id: 'falta',
    slot: 2,
    blocos: [
      { b: 'titulo', titulo: 'Maria vai faltar?', subtitulo: 'Escolha o dia e o que se aplica' },
      {
        b: 'opcoes',
        itens: [
          { icone: 'semEscola', titulo: 'Não vai à escola', detalhe: 'Motorista não busca nem traz hoje' },
          { icone: 'manha', titulo: 'Eu vou levar de manhã', detalhe: 'Motorista só busca à tarde' },
          { icone: 'tarde', titulo: 'Eu vou buscar à tarde', detalhe: 'Motorista só leva de manhã' },
        ],
      },
      { b: 'nota', texto: 'Um toque, e a rota do Tio Nino já muda.' },
    ],
  },
  {
    id: 'mensalidade',
    slot: 3,
    blocos: [
      { b: 'pago', mes: 'setembro', chip: 'Pago', meio: 'no PIX · dia 5', valor: 'R$ 270' },
      { b: 'nota', texto: 'Com o comprovante guardado, e o contrato do lado.' },
    ],
  },
];

export const TRIOS = { entrar: A, criar: B, convite: C };

/**
 * A FRASE QUE APRESENTA A TIRA NO CELULAR.
 *
 * No monitor os cartões são CENÁRIO: eles ficam atrás do formulário, sem
 * título, e quem olha entende sozinho que é o app aparecendo. No celular eles
 * viram uma seção depois do formulário — e seção sem chapéu lê como conteúdo
 * solto, não como demonstração.
 *
 * ⚠️ UMA FRASE POR ASSUNTO, E NÃO UMA SÓ. "É isto que te espera" está errado
 * para quem já tem conta: essa pessoa não está esperando nada, ela está
 * voltando pro próprio trabalho. Frase genérica economiza três linhas aqui e
 * fala errado com dois dos três públicos.
 *
 * Nenhuma delas promete o que o app não faz — a régua é a mesma da lista ⛔
 * do topo deste arquivo.
 */
export const INTRO = {
  entrar: 'O seu dia, do jeito que o app organiza',
  criar: 'No app, é isto que te espera',
  convite: 'No app, é isto que você acompanha',
};

/**
 * OS TRÊS SLOTS — e eles se ancoram no CARD, não na borda da coluna.
 *
 * ⚠️ A PRIMEIRA VERSÃO USAVA `left` FIXO E O CARD ENCOSTADO À DIREITA, e o
 * resultado era um buraco: numa tela de 1900px o formulário voava para a
 * borda e sobravam ~320px de vazio entre ele e os cartões. Funcionava em
 * 1340 e ficava errado em tudo acima disso.
 *
 * Agora o card fica CENTRADO e os cartões penduram na esquerda dele com
 * `right: calc(50% + …)`. A distância entre fundo e formulário passa a ser
 * constante em qualquer largura — é o vazio que cresce nas pontas, e vazio
 * na ponta lê como respiro, não como peça faltando.
 *
 * ⚠️ O QUE O SLOT GUARDA É O VÃO, NÃO O OFFSET PRONTO. O offset depende da
 * largura do formulário, e ela não é a mesma nas duas telas — 380px no login,
 * 520px no convite. Guardar `calc(50% + 214px)` aqui amarraria o fundo ao
 * card de 380 e faria os cartões entrarem por baixo do outro.
 *
 * Quem soma é o componente: `50% + (largura do card / 2) + vão`.
 * O slot do meio tem vão MENOR (8 contra 24), então ele fica 16px mais perto
 * do formulário que os outros dois.
 *
 * O desalinho do meio continua sendo o ponto: três cartões alinhados leem
 * como coluna de conteúdo, e a pessoa tenta ler; desalinhados leem como fundo.
 *
 * Os atrasos da flutuação também são diferentes de propósito: com o mesmo
 * atraso os três respiram juntos, e três coisas subindo em sincronia é
 * exatamente o que denuncia a animação.
 */
export const SLOTS = {
  1: { vao: 24, top: 82, atraso: '0s' },
  2: { vao: 8, top: 330, atraso: '1.4s' },
  3: { vao: 24, bottom: 104, atraso: '2.6s' },
};

/**
 * Toda string que o fundo imprime, achatada — o insumo do teste.
 *
 * Ele existe para que a lista ⛔ do cabeçalho seja VERIFICADA em vez de
 * lembrada. Sem isto, a única defesa contra "a receber R$ 4.200" voltar num
 * cartão novo seria alguém reler este arquivo.
 */
export function textosDoFundo() {
  const saida = [];
  const anda = (v) => {
    if (typeof v === 'string') saida.push(v);
    else if (Array.isArray(v)) v.forEach(anda);
    else if (v && typeof v === 'object') Object.values(v).forEach(anda);
  };
  anda(TRIOS);
  return saida;
}
