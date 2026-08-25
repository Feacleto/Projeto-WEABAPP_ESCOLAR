/**
 * As duas frentes do produto, e como uma tela sabe em qual está.
 *
 * O app fala com dois públicos opostos. A home `/` vende associação: taxa,
 * vaga, credibilidade de negócio. A `/familia` não vende nada — ela só precisa
 * deixar o responsável entrar. A regra do dono é assimétrica de propósito:
 *
 *   o motorista PODE ver coisa de responsável; o responsável NÃO pode ver
 *   coisa de motorista.
 *
 * POR QUE A FRENTE VEM DA ROTA, E NÃO DO APARELHO
 * A primeira versão disto marcava o aparelho em localStorage: "este celular é
 * de um responsável". Estava errado, e o motivo é simples — UMA PESSOA PODE
 * SER OS DOIS. É raro, mas acontece: o motorista também é pai de aluno, ou o
 * responsável compra uma perua. Marcar o aparelho trava essa pessoa no último
 * papel que ela usou e esconde dela as portas do outro, que são legitimamente
 * dela.
 *
 * A rota não tem esse problema. A mesma pessoa, no mesmo celular, vê a frente
 * da família quando está em `/familia` e a do motorista quando está em `/`.
 * Nada fica trancado, e ninguém precisa ser classificado.
 *
 * COMO A FRENTE VIAJA ENTRE TELAS
 * Telas compartilhadas (o login, por exemplo) recebem a frente pelo `state` da
 * navegação — `navigate(destino, { state: { frente: FRENTE_FAMILIA } })`. O
 * padrão, na ausência de qualquer informação, é a frente do MOTORISTA: quem
 * chega sem contexto está conhecendo a plataforma, e a plataforma se apresenta
 * ali. Errar pra esse lado é seguro; errar pro outro violaria a regra.
 */

export const FRENTE_FAMILIA = 'familia';

/**
 * Para onde mandar quem acabou de sair da conta.
 *
 * Isto NÃO é marca de aparelho: o papel vem do perfil de quem estava logado
 * naquele instante, lido do servidor. Se a pessoa tem as duas contas, cada
 * logout devolve ela à porta da conta que ela estava usando — que é
 * exatamente o comportamento certo.
 *
 * Tem que ser chamado ANTES do logout: depois dele o perfil é null e a
 * informação já não existe.
 */
export function destinoAposSair(role) {
  return role === 'parent' ? '/familia' : '/';
}

/**
 * Esta navegação veio da frente da família?
 *
 * Recebe o `location` do react-router. Serve pra tela compartilhada decidir se
 * mostra as portas do motorista.
 */
export function veioDaFamilia(location) {
  return location?.state?.frente === FRENTE_FAMILIA;
}

/**
 * Os caminhos que pertencem ao responsável.
 *
 * `/pai/*` é o painel dele; `/convite/*` é como ele chega; `/familia` é a
 * porta. Qualquer um desses é sinal suficiente de frente — e é sinal que
 * sobrevive ao logout, porque mora na URL e não na sessão.
 */
const CAMINHOS_DA_FAMILIA = ['/pai', '/convite', '/familia'];

/**
 * A frente que um caminho denuncia.
 *
 * Existe porque o momento em que a frente mais importa é justamente aquele em
 * que o perfil já não existe: a sessão expirou, o guarda de rota vai mandar a
 * pessoa pro login, e `profile` é null. O que sobra é a URL onde ela estava —
 * e ela basta.
 */
export function frenteDoCaminho(pathname) {
  const p = String(pathname || '');
  return CAMINHOS_DA_FAMILIA.some((c) => p === c || p.startsWith(`${c}/`))
    ? FRENTE_FAMILIA
    : null;
}

/** O `state` de navegação que leva a frente adiante. */
export function estadoDaFrente(frente) {
  return frente === FRENTE_FAMILIA ? { frente: FRENTE_FAMILIA } : {};
}

/**
 * A porta correspondente a uma frente.
 * Sem frente conhecida, a do motorista — que é a apresentação da plataforma.
 */
export function portaDaFrente(frente) {
  return frente === FRENTE_FAMILIA ? '/familia' : '/';
}

/**
 * A ÚLTIMA PORTA USADA — uma dica, e só pro atalho instalado.
 *
 * O manifesto do PWA tem UM `start_url` pro app inteiro. O responsável
 * instala pela `/familia` e o atalho abre em `/`: com sessão a home o
 * reencaminha, sem sessão ele fica na página que vende associação.
 *
 * ISTO NÃO É A MARCA DE APARELHO QUE FOI REJEITADA no topo deste arquivo, e a
 * diferença importa. Aquela CLASSIFICAVA a pessoa e ESCONDIA dela as portas do
 * outro papel — o motorista que também é pai ficava trancado. Esta aqui só
 * escolhe onde a porta se abre quando ninguém disse nada, e:
 *
 *   - nunca esconde nada: `/` continua sendo `/` pra quem digitar ou tocar;
 *   - perde pra URL explícita, sempre;
 *   - perde pra sessão ativa, que manda direto pro painel.
 *
 * É uma preferência de atalho, não uma etiqueta de identidade.
 */
const CHAVE_ULTIMA_PORTA = 'alobuzinou:ultimaPorta';

export function lembrarFrente(frente) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_PORTA, frente === FRENTE_FAMILIA ? FRENTE_FAMILIA : '');
  } catch {
    // Modo privado: o atalho abre na porta do motorista. Aceitável — é o
    // padrão de quem chega sem contexto, não uma perda de acesso.
  }
}

export function frenteLembrada() {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_PORTA) === FRENTE_FAMILIA
      ? FRENTE_FAMILIA
      : null;
  } catch {
    return null;
  }
}
