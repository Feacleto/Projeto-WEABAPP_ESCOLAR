/**
 * Avatares automáticos via DiceBear (CDN público, sem chave).
 *
 * O ESTILO: `notionists`
 * É o traço de ilustração que o Notion usa — linha simples, rosto amigável,
 * fundo chapado. Escolhido no lugar do cartoon anterior (`adventurer`) e das
 * iniciais porque resolve os três públicos com UMA linguagem visual: criança,
 * responsável e motorista ficam do mesmo mundo, o que faz o app parecer um
 * produto e não três telas costuradas.
 *
 * NINGUÉM FICA SEM AVATAR
 * Antes, responsável caía numa letra dentro de um círculo e o motorista caía
 * num ícone de van — ou seja, os dois adultos do app não tinham rosto. Agora
 * todos recebem um avatar de verdade, e a foto enviada só substitui algo que
 * já estava bom.
 *
 * A SEED É ESTÁVEL
 * O mesmo id sempre gera o mesmo avatar. Sem isso, cada render sortearia um
 * rosto diferente e a pessoa nunca reconheceria o próprio.
 */

const DICEBEAR = 'https://api.dicebear.com/9.x';

/**
 * O ESTILO MUDOU DE `notionists` PRA `avataaars`, e o motivo é o gênero.
 *
 * O texto abaixo continha a confissão honesta de que o estilo anterior não
 * escutava o campo: ele não expõe nenhum eixo de gênero, e a única coisa
 * controlável era a BARBA. Isso resolvia metade — homem barbado lê como
 * homem —, mas deixava as outras duas de fora: mulher e criança caíam num
 * rosto sorteado que saía masculino em boa parte das vezes. É o que o Felipe
 * viu ao cadastrar uma menina e receber um menino.
 *
 * `avataaars` expõe o CABELO como parâmetro (`top`), com nomes que dizem o
 * que são — `longHair*` e `shortHair*`. Cabelo é o sinal de gênero mais forte
 * que um avatar plano consegue dar, e ele funciona nas três faixas, inclusive
 * na criança, que não tem barba pra ajudar.
 *
 * O CUSTO É REAL E VALE ESTAR ESCRITO: todo rosto do app muda de uma vez,
 * inclusive os que alguém já reconhecia como seu. Foi feito agora porque
 * agora é barato — ainda não há motorista em produção. Depois de a base
 * crescer, essa troca vira uma perda de reconhecimento pra todo mundo, e a
 * resposta certa passa a ser conviver com o problema.
 */
const STYLE = 'avataaars';

/**
 * OS CABELOS QUE CARREGAM O SINAL.
 *
 * Listas curtas de propósito: quanto mais variante entra, mais alguma delas
 * é ambígua — e uma ambígua no meio devolve exatamente o problema que a troca
 * veio resolver, só que mais raro e mais difícil de reproduzir.
 *
 * Sem gênero informado (conta antiga, ninguém foi perguntado), NÃO passamos
 * `top` nenhum: o estilo sorteia do catálogo inteiro, que é o comportamento
 * de antes. Chutar um lado seria pior que não saber — metade das pessoas
 * receberia um rosto errado com aparência de decisão.
 */
// Os nomes vêm do schema da API (`/9.x/avataaars/schema.json`), e não da
// memória: a v9 encurtou tudo — é `bob`, não `longHairBob`. Valor fora do
// catálogo não degrada, devolve HTTP 400 e a imagem não carrega.
const CABELO_FEM = [
  'straight01',
  'straight02',
  'straightAndStrand',
  'bob',
  'bun',
  'curly',
  'curvy',
  'longButNotTooLong',
  'miaWallace',
  'bigHair',
].join(',');

const CABELO_MASC = [
  'shortFlat',
  'shortRound',
  'shortWaved',
  'shortCurly',
  'sides',
  'theCaesar',
  'theCaesarAndSidePart',
  'frizzle',
].join(',');

function cabeloPor(gender) {
  if (gender === 'female') return CABELO_FEM;
  if (gender === 'male') return CABELO_MASC;
  return undefined;
}

/**
 * As paletas.
 *
 * Todas claras e de baixa saturação de propósito: o avatar aparece ao lado de
 * nome e status, e fundo saturado rouba a atenção do texto que importa. Cada
 * grupo tem sua família de cor, então bate o olho e sabe se é criança,
 * responsável ou motorista — sem precisar de rótulo.
 */

// Criança: seis tons suaves. Seis dá variedade suficiente pra uma turma de
// vinte parecer variada sem virar arco-íris.
const BG_CHILD = 'd1e8d5,cfe3ee,f3e2c7,e6dcef,f7d8d3,dfe6e2';

// Responsável: tons frios e sóbrios, menos hues. Adulto no app é contexto,
// não protagonista.
const BG_PARENT = 'dfe6e2,cfe3ee,e3e6ea,d8dee3';

// Motorista: família do esmeralda da marca. Ele é um só e aparece em todas as
// telas do pai — vale ter identidade própria.
const BG_ADMIN = 'c8ded1,b9d6c6,d1e8d5';

/**
 * O QUE DÁ E O QUE NÃO DÁ PRA GARANTIR SOBRE GÊNERO.
 *
 * O `notionists` não tem parâmetro de gênero. Durante muito tempo este
 * arquivo fingiu que tinha: prefixava a seed com 'b-' ou 'g-' e seguia em
 * frente. Isso muda QUAL rosto sai do sorteio, não SE ele parece menino ou
 * menina — dois sorteios diferentes, ambos aleatórios. Foi por isso que a
 * Mariana saiu com cara de menino: o dado estava certo e o desenho não
 * escutava.
 *
 * O único eixo que o estilo expõe e que carrega gênero de verdade é a
 * BARBA. Então é o que a gente controla, e só isso — cabelo tem 60 variantes
 * numeradas, sem catálogo de qual é longo ou curto, e escolher no chute daria
 * a mesma aleatoriedade de antes com aparência de intenção.
 *
 * CRIANÇA NUNCA TEM BARBA, de nenhum gênero. Isso é bug puro e é
 * consertado pra todo mundo, independente do que estiver gravado no campo.
 *
 * O resultado é honesto: rosto de adulto masculino ganha barba, feminino
 * nunca ganha, e criança nunca ganha. O resto do rosto continua sorteado.
 * Quem quiser garantia de gênero em cada traço precisa trocar de estilo — e
 * aí TODOS os rostos do app mudam de uma vez, inclusive os que as pessoas já
 * reconhecem como seus.
 */
function build(seed, backgroundColor, opts = {}) {
  const s = encodeURIComponent(String(seed || 'anon'));
  const partes = [
    `seed=${s}`,
    `backgroundColor=${backgroundColor}`,
    'radius=50',
  ];
  // `top` é o cabelo; `facialHairProbability` é a barba. Cada um só entra
  // quando há decisão a comunicar — parâmetro ausente devolve o sorteio
  // padrão do estilo, que é o certo pra quem nunca informou o gênero.
  if (opts.top) partes.push(`top=${opts.top}`);
  if (opts.facialHairProbability !== undefined) {
    partes.push(`facialHairProbability=${opts.facialHairProbability}`);
  }
  // Óculos e chapéu no sorteio padrão viravam ruído: metade da turma de
  // óculos escuros, e o acessório rouba o pouco espaço que o rosto tem em
  // 32px. Zero pros dois, sempre.
  partes.push('accessoriesProbability=0');
  return `${DICEBEAR}/${STYLE}/svg?${partes.join('&')}`;
}

/** Prefixo de seed por gênero — mantém irmão e irmã com rostos diferentes. */
function prefixo(gender) {
  return gender === 'female' ? 'g-' : gender === 'male' ? 'b-' : '';
}

/**
 * Avatar de criança, estável por id.
 *
 * O gênero entra como prefixo da seed, não como filtro de cor: assim irmão e
 * irmã com ids parecidos não saem com o mesmo rosto, e a criança não fica
 * marcada por cor de fundo "de menino" ou "de menina".
 */
export function childAvatarUrl({ id, gender }) {
  // Barba zero SEMPRE: criança não tem barba, e o padrão do estilo dava.
  return build(`${prefixo(gender)}${id || 'unknown'}`, BG_CHILD, {
    top: cabeloPor(gender),
    // Criança não tem barba, de nenhum gênero e por nenhum sorteio.
    facialHairProbability: 0,
  });
}

/**
 * Avatar do responsável. A seed prefere o uid, que nunca muda.
 *
 * `gender` é opcional e chega vazio pra toda conta criada antes deste campo
 * existir — nesse caso o comportamento é o de sempre: barba no sorteio. Não
 * há migração possível (ninguém sabe o gênero de quem nunca foi perguntado),
 * e a pessoa resolve sozinha ao preencher no perfil.
 */
export function adultAvatarUrl({ name, seed, gender }) {
  return build(`${prefixo(gender)}${seed || name || 'user'}`, BG_PARENT, {
    top: cabeloPor(gender),
    facialHairProbability: beardPor(gender),
  });
}

/** Avatar do motorista, na família de cor da marca. */
export function adminAvatarUrl({ name, seed, gender }) {
  return build(`${prefixo(gender)}${seed || name || 'driver'}`, BG_ADMIN, {
    top: cabeloPor(gender),
    facialHairProbability: beardPor(gender),
  });
}

/**
 * Quanto de barba, por gênero.
 *
 * Feminino: zero, sem exceção — barba em rosto feminino não é variedade, é
 * erro. Masculino: 60, e não mais os 100 de antes. A queda é consequência da
 * troca de estilo: quando a barba era o ÚNICO sinal disponível, ela tinha que
 * ser certeza. Agora o cabelo carrega o gênero, e barba obrigatória em todo
 * homem do app fazia todos parecerem o mesmo senhor.
 *
 * Sem informação, devolve `undefined` e o estilo sorteia como sempre fez.
 */
function beardPor(gender) {
  if (gender === 'female') return 0;
  if (gender === 'male') return 60;
  return undefined;
}
