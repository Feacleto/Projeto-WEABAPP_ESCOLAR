/**
 * A TRAVESSIA — o que a porta do app mostra quando alguém entra e quando sai.
 *
 * ⚠️ DESDE 04/10/2026 ELA É O CARTÃO DA MARCA DO MOTORISTA (decisão do dono,
 * revisada pela coordenação): tela clara, um cartão com o logo e o nome da
 * marca dele (para a família, a do motorista da criança ativa), UMA palavra
 * grande e o Alô Buzinou assinando discreto no rodapé. A versão escura, com
 * plaqueta "Ambiente de trabalho" em 9px e frase de uma linha, saiu: o dono a
 * achou pesada e sem a marca dele.
 *
 * A MARCA É DADO, ENTÃO ELA SEGUE A REGRA DO DADO: aparece só se já estiver
 * em mãos no instante em que a cena começa (`marcaDaCortina`), e não muda
 * depois. Sem logo — motorista que não enviou, família ainda sem vínculo,
 * perfil que não chegou a tempo — o cartão é do Alô Buzinou do começo ao fim.
 * Trocar um pelo outro no meio da cena seria o piscão que a cortina existe
 * para cobrir.
 *
 * POR QUE A PALAVRA NÃO TEM NOME, NEM HORA, NEM CONTAGEM
 *
 *   1. Sem nome de pessoa. A marca já está no cartão; repetir é ruído.
 *   2. Sem dado. "18 crianças", "12h20" — se o snapshot ainda não voltou, ou a
 *      tela espera, ou a tela mente.
 *   3. Sem cumprimento. "Bom dia" envelhece em seis horas e obriga o app a
 *      acertar fuso e turno pra não errar uma saudação.
 *   4. Verdadeira em TODO estado: com rota rodando, parada, férias e domingo.
 *
 * "Entrando" descreve o ATO, e ato não pode ser desmentido — diferente de
 * "preparando" (promete que falta algo) e de "pronto" (promete que terminou).
 * ⚠️ A SAÍDA DIZ "Até logo" (decisão do dono, 04/10/2026). Antes era "…
 * continua aqui", a frase da permanência; o dono pediu menos texto, e "Até
 * logo" é curto e não promete nada. A troca foi feita às claras, no teste.
 *
 * Este arquivo não importa nada — nem React, nem Firebase. É o que o mantém
 * testável (`npm run testar:travessia`). Não adicione import aqui.
 */

export const CENA_ABERTURA = 'abertura';
export const CENA_ENTRADA = 'entrada';
export const CENA_SAIDA = 'saida';

/**
 * A palavra, por papel. É a mesma para os três papéis que têm painel — o que
 * muda de um para o outro é a MARCA no cartão, não o que se diz embaixo dele.
 *
 * `aguardando` (e qualquer papel desconhecido) fica de fora DE PROPÓSITO: quem
 * está numa sala de espera não está entrando em ambiente nenhum. A cortina
 * roda só com a marca.
 */
const PALAVRAS = {
  [CENA_ENTRADA]: 'Entrando',
  [CENA_SAIDA]: 'Até logo',
};
const PAPEIS_COM_PAINEL = ['admin', 'parent', 'owner'];

/** As três cenas que a cortina sabe tocar. */
const CENAS = [CENA_ABERTURA, CENA_ENTRADA, CENA_SAIDA];

/**
 * `{ linha }` ou `null` quando a cena não fala.
 *
 * A ABERTURA nunca fala: ali o balão de fala vira a porta e cresce até virar
 * a tela. Palavra em cima disso seria uma segunda coisa pra ler no único
 * momento em que o gesto já diz tudo.
 */
export function falaDaTravessia(cena, role) {
  if (cena === CENA_ABERTURA) return null;
  if (!PAPEIS_COM_PAINEL.includes(role)) return null;
  const linha = PALAVRAS[cena];
  return linha ? { linha } : null;
}

/**
 * QUE MARCA VAI NO CARTÃO — decidida UMA vez, quando a cena começa.
 *
 * Recebe o que `useMarcaDoTio` sabe naquele instante (`{ nome, logoURL }`).
 * Com logo: a marca do motorista, com o nome dele se houver. Sem logo: o Alô
 * Buzinou — inclusive quando o nome existe sem logo, porque um cartão só com
 * texto parece faltar alguma coisa, e o logo do Alô preenche com verdade.
 */
export function marcaDaCortina(marca) {
  const logoURL = typeof marca?.logoURL === 'string' && marca.logoURL.trim() ? marca.logoURL : null;
  if (!logoURL) return { tipo: 'alo', nome: 'Alô Buzinou', logoURL: null };
  const nome = typeof marca?.nome === 'string' && marca.nome.trim() ? marca.nome.trim() : null;
  return { tipo: 'motorista', nome, logoURL };
}

/**
 * Quanto tempo a cortina fica na frente, em ms.
 *
 * Com movimento reduzido a cortina não vira instantânea — ela ainda aparece e
 * some, só que sem escala e sem escalonamento (o CSS cuida disso). Manter uma
 * duração curta em vez de zero evita o corte seco piscando.
 */
export function duracaoDaTravessia(cena, movimentoReduzido = false) {
  if (movimentoReduzido) return 480;
  // 2 s para entrar e para sair (decisão do dono, 04/10/2026): o cartão abre,
  // a palavra chega e ainda sobra tempo de ler antes de a tela trocar.
  return cena === CENA_ABERTURA ? 1700 : 2000;
}

/**
 * O DISPARO — e por que ele NÃO passa pelo `state` da navegação.
 *
 * A primeira versão mandava a cena no `state` do react-router, junto com a
 * navegação. Funcionava na entrada e NUNCA funcionou na saída, por uma corrida
 * que não dá pra ganhar:
 *
 *   1. `logout()` zera o `user` no AuthContext.
 *   2. O `PrivateRoute` re-renderiza e devolve `<Navigate to="/login" replace>`.
 *   3. Esse `<Navigate>` navega DENTRO DE UM EFEITO — ou seja, depois da
 *      pintura, e possivelmente depois do nosso `navigate(destino)`.
 *   4. Quando ele chega por último, substitui a entrada de histórico e leva o
 *      `state` da cortina junto. A cena some antes de alguém ver.
 *
 * Dá pra tentar vencer a corrida com atraso ou com flag. Não vale: decoração
 * não deve disputar ordem de efeito com o roteamento de sessão, e qualquer
 * redirecionamento futuro reabriria o mesmo buraco.
 *
 * Então a cortina não escuta a rota. Ela escuta AQUI. Quem sai avisa antes de
 * deslogar, a cortina sobe sobre a tela que ainda está lá, e o logout e a
 * navegação acontecem por baixo dela — que é também a ordem dramática certa:
 * o ambiente fecha, e só então a pessoa está do lado de fora.
 *
 * A cortina é montada uma vez, no topo das rotas, e não desmonta em troca de
 * tela. É isso que faz a peça atravessar a navegação inteira.
 */
const ouvintes = new Set();
let selo = 0;

/** Liga a cortina. Devolve a função que desliga — use no cleanup do efeito. */
export function assinarTravessia(fn) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

/**
 * Pede uma cena. Devolve o pedido, ou `null` se a cena não existe — estado
 * adulterado ou chamada errada não podem acender uma cena inventada.
 *
 * O selo é único por disparo. Sem ele, sair e entrar de novo na mesma sessão
 * pediriam a mesma cena e a cortina não teria como saber que é outra vez.
 */
export function travessar(cena, role) {
  if (!CENAS.includes(cena)) return null;
  selo += 1;
  const pedido = { cena, role: role || null, selo: `${Date.now()}-${selo}` };
  ouvintes.forEach((fn) => fn(pedido));
  return pedido;
}
