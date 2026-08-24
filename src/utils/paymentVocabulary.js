/**
 * Vocabulário único de status de pagamento.
 *
 * O modelo de estados já estava certo (pending / claimed / overdue / paid) —
 * o problema é que cada tela inventava o próprio texto, e o que o tio via
 * como "aguardando" o pai via como "pago". Um glossário, dois públicos:
 * MESMA frase e MESMA cor nas duas pontas.
 *
 * `claimed` é o caso que mais precisava disso: é o momento em que os dois
 * lados estão esperando algo um do outro, e cada um precisa entender de quem
 * é a bola.
 */

export const PAYMENT_LABELS = {
  paid: {
    parent: 'Pago',
    admin: 'Recebido',
    chip: 'Pago',
    tone: 'ok',
  },
  claimed: {
    parent: 'Aguardando confirmação do motorista',
    admin: 'Aguardando sua confirmação',
    chip: 'Aguardando confirmação',
    tone: 'wait',
  },
  overdue: {
    parent: 'Atrasado',
    admin: 'Atrasado',
    chip: 'Atrasado',
    tone: 'late',
  },
  pending: {
    parent: 'A pagar',
    admin: 'A receber',
    chip: 'A pagar',
    tone: 'neutral',
  },
};

/** Classes Tailwind do chip por tom — mesma cor nas duas pontas. */
export const TONE_CLASSES = {
  ok: 'bg-emerald-100 text-emerald-800',
  wait: 'bg-amber-100 text-amber-800',
  late: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
};

/**
 * Texto do status pro papel de quem está lendo.
 * @param status 'paid' | 'claimed' | 'overdue' | 'pending'
 * @param role   'parent' | 'admin'
 */
export function paymentLabel(status, role = 'parent') {
  const entry = PAYMENT_LABELS[status] || PAYMENT_LABELS.pending;
  return entry[role] || entry.chip;
}

export function paymentTone(status) {
  return (PAYMENT_LABELS[status] || PAYMENT_LABELS.pending).tone;
}

export function paymentChipClasses(status) {
  return TONE_CLASSES[paymentTone(status)];
}

/**
 * O rótulo do estado `claimed` COM comprovante anexado, do lado do pai.
 *
 * POR QUE ISTO É SEPARADO
 * Pra ele, um mês pago e comprovado está resolvido — ele fez tudo que
 * cabia. Mostrar "aguardando confirmação" em âmbar, do lado de meses
 * verdes, faz parecer que o pagamento não valeu e que ele precisa fazer
 * algo. Precisa não: quem tem pendência é o motorista.
 *
 * Então o pai lê "Pago" em verde, com a informação de que a baixa do
 * motorista ainda vem. É a mesma verdade, contada do lado certo.
 *
 * O tio continua vendo "aguardando SUA confirmação" — pra ele a bola
 * ainda está no pé.
 */
export function parentClaimedLabel(hasReceipt) {
  return hasReceipt ? 'Pago' : 'Aguardando confirmação do motorista';
}

export function parentClaimedTone(hasReceipt) {
  return hasReceipt ? 'ok' : 'wait';
}
