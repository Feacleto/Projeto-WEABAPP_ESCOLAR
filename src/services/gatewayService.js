/**
 * Gateway de pagamento — placeholder pra integração futura.
 *
 * Hoje (modo MVP): `chargeCard` retorna sucesso simulado. O pagamento é
 * gravado no Firestore com `paymentMethod: 'card'` mas NÃO é cobrado de
 * verdade — é o Tio que dá baixa quando recebe externamente.
 *
 * Quando integrar gateway real (Stripe / Mercado Pago / Pagar.me / Asaas):
 *   1. Adicione as credenciais via env (VITE_GATEWAY_PUBLIC_KEY).
 *   2. Substitua o corpo de `chargeCard` pela chamada real do SDK.
 *   3. O resto do app não precisa mudar — `paymentMethod: 'card'` já é
 *      reconhecido por PaymentRow, TioFinance, relatórios etc.
 *
 * Cobrança recorrente (mensalidade automática) virá com a integração:
 *   - Salvar `customerId` e `cardToken` em `users/{parentUid}`.
 *   - Cloud Function diária verifica `payments` vencendo e dispara cobrança.
 */

/**
 * Stub: simula uma cobrança de cartão. Retorna sucesso após 800ms.
 *
 * @returns {Promise<{ success: boolean, transactionId?: string, error?: string }>}
 */
export async function chargeCard({ amount, paymentId, description }) {
  // Validação básica (parâmetros úteis pro futuro integrador)
  if (!amount || amount <= 0) {
    return { success: false, error: 'Valor inválido.' };
  }
  if (!paymentId) {
    return { success: false, error: 'Identificador do pagamento ausente.' };
  }

  console.info(
    `[gateway:stub] chargeCard(amount=${amount}, paymentId=${paymentId}, description="${description}")`
  );

  // Simula latência de gateway
  await new Promise((r) => setTimeout(r, 800));

  // Mock: sempre sucesso (substituir pela integração real)
  return {
    success: true,
    transactionId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Indica se o gateway está em modo real. UI pode mostrar "em testes" se for stub.
 */
export function isGatewayLive() {
  return false; // mude pra true quando conectar gateway real
}
