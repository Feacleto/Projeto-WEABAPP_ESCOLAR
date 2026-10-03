/**
 * A COBRANÇA DA PLATAFORMA ESTÁ LIGADA? — a chave única (02/10/2026).
 *
 * `platformConfig/app.cobrancaLigada`, que o dono liga e desliga no painel
 * admin. O lado do servidor é `functions/lib/cobrancaLigada.js` e o das rules
 * é `cobrancaDesligada()` em firestore.rules — as três respondem igual.
 *
 * ⚠️ AUSENTE É DESLIGADA. É o oposto da `escadaAberta`, e de propósito: nesta
 * fase o app não cobra nada do motorista, e o banco sem o campo precisa
 * significar isso. Ligar é um ATO do dono; só o `true` explícito conta.
 *
 * Desligada, NADA conta para cobrança nem para desconto: o relógio do teste
 * não liga, a escada não desce, não há fatura, oferta, plano, aviso de venda
 * nem bloqueio por teste vencido. A suspensão manual pelo dono continua
 * valendo, e a mensalidade das FAMÍLIAS não passa por aqui.
 *
 * Mora no domínio (puro, sem Firebase) para a bateria alcançar.
 * Ver docs/estrutura-de-cobranca.md.
 */
export function cobrancaLigada(config) {
  return config?.cobrancaLigada === true;
}
