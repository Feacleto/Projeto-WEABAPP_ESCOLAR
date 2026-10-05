/**
 * A VOLTA AO ACEITE DEPOIS DE ASSINAR (05/10/2026, F2.4, decisão do dono).
 *
 * Quem ainda não paga e toca em "Aceito receber" recebe `precisaAssinar` e
 * vai aos planos. Antes, depois de assinar, ele caía no contrato da
 * plataforma e tinha de achar sozinho o caminho de volta ao pedido — a
 * família que chega por um colega se perdia ali. Agora o pedido viaja junto:
 * no `state` da navegação e, de reserva, no `sessionStorage` (o `state` some
 * se ele passear por outra tela antes de assinar). Assinou, a tela de planos
 * devolve à Comunidade com o pedido aberto e o aviso.
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

/** Já voltou: a próxima assinatura não deve desviar de novo. */
export function limparVolta() {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    // Nada a limpar.
  }
}
