/**
 * A TRAVESSIA — o que a marca do app diz quando alguém entra e quando sai.
 *
 * POR QUE SÓ AQUI, E EM LUGAR NENHUM MAIS
 * O `<Logo />` aparece em 8 telas do app, e todas são públicas ou de exceção.
 * Dentro de `/tio` e `/pai` ele não aparece NENHUMA vez, e isso é decisão: o
 * `<Header />` põe ali a marca do MOTORISTA, o nome que ele escolheu pras
 * famílias dele. Marca do app se mexendo lá dentro estaria disputando espaço
 * que não é dela.
 *
 * A travessia não é de ninguém. É o único instante em que a marca do app tem
 * o que dizer sem atropelar o motorista — e por isso o teatro mora só aqui.
 *
 * POR QUE A FALA NÃO TEM NOME, NEM HORA, NEM CONTAGEM
 * Quatro regras filtraram oito frases candidatas até sobrarem estas:
 *
 *   1. Sem nome. Ele vê o próprio nome no perfil e a marca dele no cabeçalho
 *      dois segundos depois. Repetir é o app se apresentando a quem já entrou.
 *   2. Sem dado. "18 crianças", "12h20" — está tudo no primeiro cartão do
 *      painel. Aqui só criaria dependência: se o snapshot ainda não voltou, ou
 *      a tela espera, ou a tela mente.
 *   3. Sem cumprimento. "Bom dia" envelhece em seis horas e obriga o app a
 *      acertar fuso e turno pra não errar uma saudação. Risco sem prêmio.
 *   4. Verdadeira em TODO estado. As frases abaixo valem com rota rodando,
 *      rota parada, férias e domingo. Nenhuma precisa ser conferida antes de
 *      aparecer, e é isso que as torna baratas.
 *
 * "Entrando" descreve o ATO, e ato não pode ser desmentido — diferente de
 * "preparando" (promete que falta algo) e de "pronto" (promete que terminou).
 * "Continua aqui" fala de permanência e cai na SAÍDA de propósito: é o único
 * momento em que a pessoa poderia achar que fechou e perdeu.
 *
 * Este arquivo não importa nada — nem React, nem Firebase. É o que o mantém
 * testável (`npm run testar:travessia`). Não adicione import aqui.
 */

export const CENA_ABERTURA = 'abertura';
export const CENA_ENTRADA = 'entrada';
export const CENA_SAIDA = 'saida';

/**
 * A fala, por papel.
 *
 * `owner` tem par próprio: quem administra a plataforma não tem transporte
 * nem acompanha filho, e "Entrando no seu transporte" seria falso pra ele.
 *
 * `aguardando` fica de fora DE PROPÓSITO, e não por esquecimento: o motorista
 * que ainda não foi aprovado não está entrando em ambiente de trabalho nenhum
 * — ele está numa sala de espera. Prometer ambiente ali seria a mesma família
 * de mentira que as quatro regras acima existem pra evitar. A cortina roda sem
 * fala: só a marca.
 */
const FALAS = {
  admin: {
    plaqueta: 'Ambiente de trabalho',
    [CENA_ENTRADA]: 'Entrando no seu transporte.',
    [CENA_SAIDA]: 'Seu transporte continua aqui.',
  },
  parent: {
    plaqueta: 'Ambiente da família',
    [CENA_ENTRADA]: 'Entrando no acompanhamento.',
    [CENA_SAIDA]: 'O acompanhamento continua aqui.',
  },
  owner: {
    plaqueta: 'Ambiente da plataforma',
    [CENA_ENTRADA]: 'Entrando na plataforma.',
    [CENA_SAIDA]: 'A plataforma continua aqui.',
  },
};

/** As três cenas que a cortina sabe tocar. */
const CENAS = [CENA_ABERTURA, CENA_ENTRADA, CENA_SAIDA];

/**
 * `{ plaqueta, linha }` ou `null` quando a cena não fala.
 *
 * A ABERTURA nunca fala: ali o balão de fala vira a porta e cresce até virar
 * a tela. Palavra em cima disso seria uma segunda coisa pra ler no único
 * momento em que o gesto já diz tudo.
 */
export function falaDaTravessia(cena, role) {
  if (cena === CENA_ABERTURA) return null;
  const conjunto = FALAS[role];
  const linha = conjunto?.[cena];
  if (!linha) return null;
  return { plaqueta: conjunto.plaqueta, linha };
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
  return cena === CENA_ABERTURA ? 1700 : 1760;
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
