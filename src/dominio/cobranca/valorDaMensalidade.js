/**
 * O VALOR DA MENSALIDADE É OBRIGATÓRIO PARA HAVER CONTRATO (decisão do dono,
 * 14/11/2026: "valor zero não").
 *
 * Contrato sem valor não obriga a nada, e o servidor nem gera a mensalidade
 * (`functions/lib/billing.js` pula a criança com `monthlyFee <= 0`): o tio
 * cadastrava a turma, mandava o convite e descobria no dia do fechamento,
 * contando as cobranças que não nasceram. A régua é uma só e é pura — o
 * formulário, a emissão do contrato e as telas perguntam a mesma coisa.
 *
 * ⚠️ O QUE CONTA COMO "SEM VALOR": ausente, vazio, zero, negativo ou texto que
 * não é número. Texto com vírgula ("350,00") vale — é como o tio escreve.
 *
 * Sem Firebase e sem React: `npm run testar:valor-da-mensalidade`.
 */

/** O valor como número maior que zero, ou 0 quando não há valor utilizável. */
export function valorDaMensalidade(valor) {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** O que foi digitado (ou gravado) NÃO é um valor que sustente um contrato? */
export function valorDoCampoFalta(valor) {
  return valorDaMensalidade(valor) <= 0;
}

/** A criança está sem valor de mensalidade? */
export function valorDaMensalidadeFalta(child) {
  return valorDoCampoFalta(child?.monthlyFee);
}
