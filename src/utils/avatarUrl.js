/**
 * Avatares automáticos via DiceBear (CDN público, sem chave).
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
 * O ESTILO É `adventurer`, E A ESCOLHA SAIU DE DUAS MEDIÇÕES.
 *
 * A história curta: o app já usou `notionists`, que não expõe eixo de gênero
 * nenhum — os 64 cortes de cabelo dele se chamam `variant01` a `variant64`, e
 * sem saber qual é longo não há como obedecer ao campo. Foi assim que uma
 * menina cadastrada saiu com cara de menino: o dado estava certo no banco e o
 * desenho não escutava. Depois veio `avataaars`, que resolveu isso.
 *
 * A troca pro `adventurer` é sobre a segunda medição, a de REPETIÇÃO. Fixado
 * o cabelo pelo gênero, o que sobra de variação decide quantas crianças da
 * mesma perua recebem o rosto idêntico — e o rosto é como a mãe reconhece o
 * filho no cartão do dia. Rodando a conta numa perua de 25:
 *
 *   dylan        350 rostos     58% de chance de duas iguais
 *   thumbs     3.600 rostos      8%   (e sem gênero nenhum)
 *   adventurer  68 milhões       praticamente zero
 *
 * O `adventurer` tem 45 cortes nomeados — 26 `long*` e 19 `short*`, nenhum
 * ambíguo — mais 15 sobrancelhas, 26 olhos e 30 bocas. É o catálogo mais bem
 * dividido de todos os 30 estilos do DiceBear, e é o traço mais jovem entre
 * os que sabem separar gênero, o que serve a um app que cuida de criança.
 *
 * O QUE ELE CUSTA, E VALE ESTAR ESCRITO: `adventurer` NÃO TEM BARBA. O
 * motorista tinha dois sinais de gênero e passa a ter um. Com 19 cortes
 * masculinos o cabelo dá conta, mas o Tio Nino fica com cara mais nova do que
 * provavelmente é.
 *
 * E o custo que vale pra qualquer troca de estilo: TODO ROSTO DO APP MUDA DE
 * UMA VEZ, inclusive os que alguém já reconhecia como seu. Continua barato
 * porque ainda não há motorista em produção. Depois de a base crescer, a
 * resposta certa passa a ser conviver com o que estiver aí.
 */
const STYLE = 'adventurer';

/**
 * OS CABELOS QUE CARREGAM O SINAL.
 *
 * Aqui entram TODOS os 45 do catálogo, e não uma seleção — diferente do que
 * era preciso no estilo anterior, onde as listas eram curtas de propósito
 * porque algumas variantes eram ambíguas e uma ambígua no meio devolve o
 * problema que a troca veio resolver. No `adventurer` o nome é a garantia:
 * `long*` é longo e `short*` é curto, sem exceção no catálogo inteiro.
 *
 * Sem gênero informado (conta antiga, ninguém foi perguntado), NÃO passamos
 * `hair` nenhum: o estilo sorteia entre os 45, que é o comportamento de
 * antes. Chutar um lado seria pior que não saber — metade das pessoas
 * receberia um rosto errado com aparência de decisão.
 */
// Os nomes vêm do schema da API (`/9.x/adventurer/schema.json`), e não da
// memória. Valor fora do catálogo não degrada: devolve HTTP 400 e a imagem
// não carrega.
const CABELO_FEM = Array.from(
  { length: 26 },
  (_, i) => `long${String(i + 1).padStart(2, '0')}`,
).join(',');

const CABELO_MASC = Array.from(
  { length: 19 },
  (_, i) => `short${String(i + 1).padStart(2, '0')}`,
).join(',');

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
 * OS ACESSÓRIOS, E A REGRA QUE DECIDE CADA UM.
 *
 * O estilo anterior levava um `accessoriesProbability=0` chapado, e o motivo
 * escrito era "metade da turma de óculos escuros". `adventurer` não tem esse
 * parâmetro — tem três, com probabilidades próprias e muito mais baixas —,
 * então a regra teve que ser reescrita em vez de copiada.
 *
 * A regra nova é mais estreita e diz melhor o que se quer: SAI O ACESSÓRIO
 * QUE CARREGA GÊNERO, FICA O QUE NÃO CARREGA.
 *
 *   brinco   → ZERO. É o único que significa alguma coisa sobre a pessoa, e
 *              ele seria sorteado sem olhar o campo: um brinco num avatar de
 *              cabelo curto contradiz o sinal que este arquivo inteiro existe
 *              pra emitir. É a mesma falha da menina com cara de menino, só
 *              que menor e mais difícil de reproduzir.
 *   óculos   → fica nos 10% do padrão. Não diz nada sobre gênero, e uma
 *              criança de óculos a cada dez é a turma parecendo uma turma.
 *   features → fica nos 5% do padrão. São sarda e pinta. Mesmo caso.
 */
const SEM_BRINCO = 'earringsProbability=0';

function build(seed, backgroundColor, opts = {}) {
  const s = encodeURIComponent(String(seed || 'anon'));
  const partes = [
    `seed=${s}`,
    `backgroundColor=${backgroundColor}`,
    'radius=50',
    SEM_BRINCO,
  ];
  // `hair` só entra quando há decisão a comunicar — parâmetro ausente devolve
  // o sorteio padrão do estilo, que é o certo pra quem nunca informou gênero.
  if (opts.hair) partes.push(`hair=${opts.hair}`);
  return `${DICEBEAR}/${STYLE}/svg?${partes.join('&')}`;
}

/** Prefixo de seed por gênero — mantém irmão e irmã com rostos diferentes. */
function prefixo(gender) {
  return gender === 'female' ? 'g-' : gender === 'male' ? 'b-' : '';
}

/**
 * Avatar de criança, estável por id.
 *
 * O gênero entra como prefixo da seed E como filtro de cabelo. O prefixo
 * sozinho não resolve nada de gênero — ele só garante que irmão e irmã com
 * ids parecidos não saiam com o mesmo rosto. Quem obedece ao campo é o
 * `hair`.
 *
 * Não há nada aqui zerando barba, como havia antes: `adventurer` não desenha
 * barba em ninguém, então a criança está protegida pelo estilo e não por uma
 * regra que alguém precise lembrar de manter.
 */
export function childAvatarUrl({ id, gender }) {
  return build(`${prefixo(gender)}${id || 'unknown'}`, BG_CHILD, {
    hair: cabeloPor(gender),
  });
}

/**
 * Avatar do responsável. A seed prefere o uid, que nunca muda.
 *
 * `gender` é opcional e chega vazio pra toda conta criada antes deste campo
 * existir — nesse caso o cabelo é sorteado entre os 45. Não há migração
 * possível (ninguém sabe o gênero de quem nunca foi perguntado), e a pessoa
 * resolve sozinha ao preencher no perfil.
 */
export function adultAvatarUrl({ name, seed, gender }) {
  return build(`${prefixo(gender)}${seed || name || 'user'}`, BG_PARENT, {
    hair: cabeloPor(gender),
  });
}

/** Avatar do motorista, na família de cor da marca. */
export function adminAvatarUrl({ name, seed, gender }) {
  return build(`${prefixo(gender)}${seed || name || 'driver'}`, BG_ADMIN, {
    hair: cabeloPor(gender),
  });
}
