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
 * Um selo por disparo.
 *
 * A primeira versão chaveava a cortina em `location.key`, do react-router, e
 * isso QUEBROU A SAÍDA: as duas navegações usam `replace`, e o replace
 * reaproveita a chave da entrada anterior. A guarda de "já toquei esta" via a
 * mesma chave duas vezes e engolia a segunda cena — o teatro de entrar
 * funcionava e o de sair nunca aparecia.
 *
 * A lição é a de sempre: não chaveie em identidade que outro dono gera. Este
 * selo é nosso, é único por disparo, e não depende de detalhe interno de
 * biblioteca nenhuma.
 */
let selo = 0;

/**
 * O estado de navegação que dispara a cortina.
 *
 * A cena viaja pelo `state` do react-router, do mesmo jeito que a frente viaja
 * em `frentes.js` — sem contexto novo e sem barramento de eventos. Quem navega
 * já sabe a cena e o papel; a cortina só lê.
 *
 * Isso resolve sozinho o problema que qualquer outra abordagem teria: a
 * cortina e a tela de destino chegam na MESMA renderização, então a tela nova
 * nunca pisca antes de ser coberta.
 */
export function estadoDaTravessia(cena, role, extra) {
  selo += 1;
  return {
    ...extra,
    travessia: cena,
    papelDaTravessia: role || null,
    seloDaTravessia: `${Date.now()}-${selo}`,
  };
}

/**
 * Lê a cena de um `location` do react-router. Devolve `null` quando não há
 * travessia pedida — inclusive se alguém mandar um valor que não existe, que
 * é o caso de link velho ou estado adulterado.
 */
export function lerTravessia(location) {
  const cena = location?.state?.travessia;
  if (!CENAS.includes(cena)) return null;
  return {
    cena,
    role: location.state.papelDaTravessia || null,
    selo: location.state.seloDaTravessia || cena,
  };
}

/**
 * O `state` sem a travessia, pra limpar depois que a cortina tocou.
 *
 * Sem isso, um F5 no painel repetiria o teatro — o `state` fica no histórico.
 * Devolve `undefined` quando não sobra nada, porque `state: {}` e `state:
 * undefined` não são a mesma coisa pro react-router.
 */
export function estadoSemTravessia(state) {
  if (!state) return undefined;
  const resto = { ...state };
  delete resto.travessia;
  delete resto.papelDaTravessia;
  delete resto.seloDaTravessia;
  return Object.keys(resto).length ? resto : undefined;
}
