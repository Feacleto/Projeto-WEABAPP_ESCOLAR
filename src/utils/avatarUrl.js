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

function build(seed, backgroundColor) {
  const s = encodeURIComponent(String(seed || 'anon'));
  return `${DICEBEAR}/${STYLE}/svg?seed=${s}&backgroundColor=${backgroundColor}&radius=50`;
}

/**
 * Avatar de criança, estável por id.
 *
 * O gênero entra como prefixo da seed, não como filtro de cor: assim irmão e
 * irmã com ids parecidos não saem com o mesmo rosto, e a criança não fica
 * marcada por cor de fundo "de menino" ou "de menina".
 */
export function childAvatarUrl({ id, gender }) {
  const prefix = gender === 'female' ? 'g-' : gender === 'male' ? 'b-' : '';
  return build(`${prefix}${id || 'unknown'}`, BG_CHILD);
}

/** Avatar do responsável. A seed prefere o uid, que nunca muda. */
export function adultAvatarUrl({ name, seed }) {
  return build(seed || name || 'user', BG_PARENT);
}

/** Avatar do motorista, na família de cor da marca. */
export function adminAvatarUrl({ name, seed }) {
  return build(seed || name || 'driver', BG_ADMIN);
}
