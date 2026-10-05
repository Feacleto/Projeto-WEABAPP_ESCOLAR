/**
 * A VOLTA AO ACEITE DEPOIS DE ASSINAR (05/10/2026, F2.4, decisão do dono).
 *
 * Quem ainda não paga e toca em "Aceito receber" recebe `precisaAssinar` e
 * vai aos planos. Antes, depois de assinar, ele caía no contrato da
 * plataforma e tinha de achar sozinho o caminho de volta ao pedido — a
 * família que chega por um colega se perdia ali. Agora o pedido viaja junto:
 * no `state` da navegação e, de reserva, no `sessionStorage` (o `state` some
 * se ele passear por outra tela antes de assinar).
 *
 * ⚠️ A VOLTA PASSA PELO CONTRATO (decisão do dono): para receber a família o
 * tio "antes precisa passar pelo fechamento de uma assinatura", e assinatura
 * fechada é PLANO CONTRATADO + CONTRATO ACEITO — a cobrança se apoia no
 * contrato assinado. Então os planos levam ao contrato com o pedido junto, e
 * é o ACEITE DO CONTRATO que devolve à Comunidade com o pedido aberto e o
 * aviso. Quem já tem um contrato aceito para o mesmo plano
 * (`contratoFechaAssinatura`) volta direto, sem assinar de novo.
 *
 * ⚠️ O ACEITE CONTINUA SENDO UM TOQUE DELE. A volta só mostra o pedido; nada
 * aqui chama `responderTransferencia` — ele e a família precisam ver o que
 * estão aceitando.
 *
 * O armazenamento pode falhar (janela anônima, dado bloqueado): sem ele, vale
 * o `state`, e sem os dois ele só volta pelo caminho de sempre.
 */
const CHAVE = 'alobuzinou:volta-ao-aceite';

export const CAMINHO_DA_VOLTA = '/tio/comunidade';
export const AVISO_DA_VOLTA = 'Pronto. Agora você pode aceitar a família.';

/** Guarda o pedido antes de ir aos planos. */
export function guardarVolta(id) {
  try {
    window.sessionStorage.setItem(CHAVE, String(id));
  } catch {
    // Sem armazenamento, vale o state da navegação.
  }
}

/** O pedido a que voltar: o do `state` primeiro, senão o guardado. */
export function lerVolta(state) {
  const doState = state?.voltarAoPedido;
  if (typeof doState === 'string' && doState) return doState;
  try {
    return window.sessionStorage.getItem(CHAVE) || null;
  } catch {
    return null;
  }
}

/**
 * Este contrato fecha a assinatura do plano de agora? Aceito, e com o MESMO
 * plano que o servidor gravou em `users.plano` (o mesmo campo que a rule do
 * contrato compara com `conteudo.plano.id`).
 */
export function contratoFechaAssinatura(contrato, plano) {
  return !!contrato?.aceitoEm && !!plano && contrato?.conteudo?.plano?.id === plano;
}

/** Já voltou: a próxima assinatura não deve desviar de novo. */
export function limparVolta() {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // Nada a limpar.
  }
}
