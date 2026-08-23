/**
 * ANTES este hook gerava as mensalidades do mes e apagava o historico
 * antigo quando o tio abria o app, com trava em localStorage.
 *
 * Os dois comportamentos foram pra Cloud Functions
 * (functions/lib/billing.js, agendada pra 6h todo dia) por dois motivos:
 *
 *   - Mes em que o tio nao abrisse o app, NINGUEM era cobrado.
 *   - `cleanOldPayments` era uma exclusao em massa disparada sem
 *     confirmacao no carregamento da tela. Se o localStorage fosse
 *     limpo (modo privado, troca de aparelho), rodava de novo.
 *
 * O hook segue existindo como no-op pra nao quebrar a chamada no
 * TioLayout, e pra deixar o registro do que mudou onde alguem vai olhar.
 */
export function useAutoBilling() {
  // Intencionalmente vazio — quem fatura agora e o servidor.
}
