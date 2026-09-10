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
 * Os blocos que um cartão pode ter. Onze primitivos que se recombinam — é o
 * que evita nove componentes quase iguais.
 *
 *   cabecalho  ícone em quadrado + título + subtítulo
 *   progresso  a barra da viagem (fração de 0 a 1)
 *   linha      uma linha destacada: hora em mono + texto + check
 *   pessoa     iniciais + nome + detalhe + hora
 *   acao       o botão sólido (só aparência)
 *   atalhos    a fileira de três botões pequenos
 *   numero     rótulo mono + valor grande
 *   iniciais   rótulo + fileira de pastilhas + "+N"
 *   paradas    lista de bolinha + nome + hora
 *   pastilhas  duas escolhas lado a lado
 *   nota       a linha que o app escreve embaixo, em mono
 */
export const BLOCOS = [
  'cabecalho', 'progresso', 'linha', 'pessoa', 'acao',
  'atalhos', 'numero', 'iniciais', 'paradas', 'pastilhas', 'nota',
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
      { b: 'iniciais', rotulo: 'quem já pagou', itens: ['MC', 'PH', 'JS', 'AL'], mais: '+10' },
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
    id: 'turma',
    slot: 1,
    blocos: [
      { b: 'cabecalho', icone: 'turma', titulo: 'Minha turma', subtitulo: '18 crianças · 3 escolas' },
      { b: 'iniciais', itens: ['MC', 'PH', 'JS', 'AL', 'BR'], mais: '+13' },
      { b: 'nota', texto: 'Cadastrada uma vez. A rota nasce daqui.' },
    ],
  },
  {
    id: 'rota',
    slot: 2,
    blocos: [
      { b: 'cabecalho', icone: 'relogio', titulo: 'A rota de amanhã' },
      {
        b: 'paradas',
        itens: [
          { hora: '06:40', nome: 'Maria Clara' },
          { hora: '06:48', nome: 'Pedro Henrique' },
          { hora: '06:55', nome: 'Júlia' },
        ],
      },
      { b: 'nota', texto: 'Na ordem dos horários. Você não monta nada.' },
    ],
  },
  {
    id: 'convite',
    slot: 3,
    blocos: [
      { b: 'cabecalho', icone: 'elo', titulo: 'Convite enviado', subtitulo: 'mãe da Maria Clara · WhatsApp' },
      { b: 'nota', texto: 'A conta dela nasce do link. Sem senha pra inventar.' },
    ],
  },
];

// ── TRIO C · o convite da família (`/first-access`) ───────────────────────
//
// Aqui quem olha é a RESPONSÁVEL, e ela não compra nada: ela foi convidada.
// Os três cartões são o lado dela — onde a perua está, como avisar a falta, e
// a mensalidade que ela paga direto ao motorista.
//
// ⚠️ O C1 é o único cartão com frase copiada palavra por palavra de um módulo
// de domínio, e é de propósito: `routePresence` é justamente onde a promessa
// de ETA foi arrancada. Reescrever a frase aqui reabriria a porta.
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
      { b: 'cabecalho', icone: 'falta', titulo: 'Avisar a falta de hoje' },
      {
        b: 'pastilhas',
        itens: [
          { rotulo: 'Não vai hoje', destaque: true },
          { rotulo: 'Só na volta' },
        ],
      },
      { b: 'nota', texto: 'Um toque, e a rota do Tio Nino já muda.' },
    ],
  },
  {
    id: 'mensalidade',
    slot: 3,
    blocos: [
      { b: 'cabecalho', icone: 'check', titulo: 'Mensalidade paga', subtitulo: 'no PIX · dia 5' },
      { b: 'numero', valor: 'R$ 270' },
      { b: 'nota', texto: 'Com o comprovante guardado, e o contrato do lado.' },
    ],
  },
];

export const TRIOS = { entrar: A, criar: B, convite: C };

/**
 * OS TRÊS SLOTS, e por que o do meio é desalinhado.
 *
 * Alinhamento perfeito de três cartões lê como COLUNA DE CONTEÚDO — a pessoa
 * tenta ler, e depois tenta tocar. O desalinho de 16px lê como fundo.
 *
 * Os atrasos da flutuação também são diferentes de propósito: com o mesmo
 * atraso os três respiram juntos, e três coisas subindo em sincronia é
 * exatamente o que denuncia a animação.
 */
export const SLOTS = {
  1: { left: 24, top: 82, atraso: '0s' },
  2: { left: 40, top: 330, atraso: '1.4s' },
  3: { left: 24, bottom: 104, atraso: '2.6s' },
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
