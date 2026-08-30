import { formatCurrency, formatMonthLabel } from './formatters.js';

/**
 * Monta a mensagem de cobrança que o tio manda no WhatsApp.
 *
 * POR QUE ISTO EXISTE
 * O app mostrava "3 atrasados" e parava aí. Pra cobrar, o tio saía do app,
 * abria o WhatsApp, procurava o contato e escrevia o texto do zero — todas as
 * vezes. Informação sem ação é só ansiedade, e era exatamente o atrito que o
 * empurrava de volta pra planilha que ele já domina.
 *
 * O TOM IMPORTA
 * Cobrança de transporte escolar é conversa entre vizinhos, não carta de
 * cobrança de banco. O texto é curto, sem ameaça, e já entrega a chave PIX
 * pra a pessoa resolver na hora — porque a maioria dos atrasos é esquecimento,
 * não falta de dinheiro. Uma cobrança dura por esquecimento estraga uma
 * relação que o tio depende que dure anos.
 */
export function buildChargeMessage({
  payment,
  displayStatus,
  pixKey,
  driverName,
}) {
  const childFirst = String(payment?.childName || '')
    .trim()
    .split(/\s+/)[0];
  const mes = formatMonthLabel(payment?.month);
  const valor = formatCurrency(payment?.amount);

  const abertura = childFirst
    ? `Oi! Aqui é ${driverName || 'do transporte escolar'}, sobre a mensalidade do/da ${childFirst}.`
    : `Oi! Aqui é ${driverName || 'do transporte escolar'}, sobre a mensalidade.`;

  const corpo =
    displayStatus === 'overdue'
      ? `A de ${mes} (${valor}) venceu e ainda não caiu. Deve ser só esquecimento — quando puder dar uma olhada, agradeço!`
      : `Passando pra lembrar da de ${mes}: ${valor}.`;

  const pix = pixKey ? `\n\nChave PIX: ${pixKey}` : '';
  const fecho = '\n\nSe já pagou, me manda o comprovante que eu dou baixa. Obrigado!';

  return `${abertura}\n\n${corpo}${pix}${fecho}`;
}
