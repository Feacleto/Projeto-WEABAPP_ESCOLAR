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
