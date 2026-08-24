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
const STYLE = 'notionists';

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
  const extra =
    opts.beardProbability === undefined
      ? ''
      : `&beardProbability=${opts.beardProbability}`;
  return `${DICEBEAR}/${STYLE}/svg?seed=${s}&backgroundColor=${backgroundColor}&radius=50${extra}`;
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
    beardProbability: 0,
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
    beardProbability: beardPor(gender),
  });
}

/** Avatar do motorista, na família de cor da marca. */
export function adminAvatarUrl({ name, seed, gender }) {
  return build(`${prefixo(gender)}${seed || name || 'driver'}`, BG_ADMIN, {
    beardProbability: beardPor(gender),
  });
}

/**
 * Quanto de barba, por gênero.
 *
 * Feminino: zero, sem exceção. Masculino: 100 — e não "às vezes", porque é
 * o ÚNICO sinal de gênero que este estilo oferece; deixar no sorteio faria
 * metade dos homens continuar com rosto ambíguo, que é o problema que a
 * gente veio resolver. Sem informação, devolve `undefined` e o estilo faz o
 * que sempre fez.
 */
function beardPor(gender) {
  if (gender === 'female') return 0;
  if (gender === 'male') return 100;
  return undefined;
}
