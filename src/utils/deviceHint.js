/**
 * De quem é este aparelho — a migalha que sobrevive ao logout.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * Deslogado, o app não sabe com quem está falando. E as duas frentes do
 * produto falam com públicos opostos: a home do motorista vende associação
 * (taxa, vaga, credibilidade de negócio); a do responsável não vende nada —
 * ela só precisa deixar ele entrar e dizer que o que ele procura está ali.
 *
 * Sem esta migalha, o responsável que sai da conta, erra a URL ou abre um
 * favorito antigo cai na página que vende associação pra motorista. Não fica
 * preso — tem "Entrar" no topo — mas lê uma página endereçada a outra pessoa,
 * falando de taxa e vaga limitada. E é justamente quem menos vai insistir:
 * o responsável não decora o endereço do site, ele volta pelo link do
 * WhatsApp.
 *
 * O QUE ISTO NÃO É
 * Não é autenticação e não decide permissão nenhuma. É uma DICA de qual
 * página mostrar — o papel de verdade continua vindo de `users/{uid}.role`,
 * lido do servidor. Se a migalha estiver errada, mentindo ou ausente, o pior
 * que acontece é a pessoa ver a página do outro público e ter que tocar em
 * "Entrar" — exatamente o que acontece hoje, sempre.
 *
 * Por isso ela pode morar em localStorage sem cuidado especial: guarda um
 * papel ('admin' ou 'parent'), nunca nome, e-mail, id ou token.
 *
 * POR QUE ELA SOBREVIVE AO LOGOUT (de propósito)
 * Sair da conta não muda de quem é o celular. O aparelho do responsável
 * continua sendo dele na próxima visita, e é aí que a migalha trabalha.
 * Quem quiser apagar, apaga os dados do site no navegador.
 */

const KEY = 'alobuzinou:aparelhoDe';

/** Papéis que a migalha aceita. Qualquer outra coisa é tratada como ausente. */
const VALIDOS = ['admin', 'parent'];

/**
 * Guarda o papel de quem usou este aparelho.
 *
 * Chamado quando o perfil carrega, não no login: assim ele também é gravado
 * pra quem já estava logado antes desta versão existir.
 */
export function marcarAparelho(role) {
  if (!VALIDOS.includes(role)) return;
  try {
    localStorage.setItem(KEY, role);
  } catch {
    // Navegador em modo privado ou com dados de site bloqueados. A migalha é
    // conveniência: sem ela o app funciona como sempre funcionou.
  }
}

/** Devolve 'admin', 'parent' ou null. */
export function aparelhoDe() {
  try {
    const v = localStorage.getItem(KEY);
    return VALIDOS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Este aparelho já foi usado por um responsável? */
export function aparelhoDeResponsavel() {
  return aparelhoDe() === 'parent';
}

/**
 * Para onde mandar quem acabou de sair da conta.
 *
 * O motorista vai pra home dele — que é a vitrine dele, e faz sentido ele ver.
 * O responsável vai pra porta da família, que é onde alguém fala com ele.
 */
export function destinoAposSair(role) {
  return role === 'parent' ? '/familia' : '/';
}
