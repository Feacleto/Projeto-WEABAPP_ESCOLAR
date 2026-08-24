/**
 * Vocabulário único de status de pagamento.
 *
 * O modelo de estados já estava certo (pending / claimed / overdue / paid) —
 * o problema é que cada tela inventava o próprio texto, e o que o tio via
 * como "aguardando" o pai via como "pago". Um glossário, dois públicos:
 * MESMA frase e MESMA cor nas duas pontas.
 *
 * ─────────────────────────────────────────────────────────────────────
 * O TIO LÊ TRÊS PALAVRAS. O PAI CONTINUA LENDO QUATRO.
 *
 * O motorista lia quatro estados — Recebido, Aguardando sua confirmação,
 * Atrasado, A receber — e três deles descrevem dinheiro que NÃO entrou. Ele
 * não opera assim: ele quer saber quanto entrou e quem está devendo. Quanto
 * vai entrar até o fim do mês é uma pergunta que ele não faz.
 *
 * Então, do lado dele:
 *
 *   Recebido        dinheiro que entrou, no prazo
 *   Pago atrasado   entrou, mas depois do vencimento — é o histórico de
 *                   quem dá trabalho, e some se a gente chamar tudo de
 *                   "Recebido"
 *   Atrasado        venceu e não entrou
 *   (nada)          ainda não venceu. Sem palavra: uma lista inteira
 *                   dizendo "a receber" no dia 2 do mês é ruído com
 *                   aparência de informação
 *
 * `claimed` sai do vocabulário DELE — mas não some do mundo. É o único
 * estado que exige uma decisão humana ("o pai diz que pagou; confirmo?"), e
 * decisão não é rótulo, é botão. Vira a ação "Dar baixa", que é o termo que
 * ele já usa. Rótulo cinza descrevendo tarefa pendente é a forma mais
 * comum de uma tarefa nunca ser feita.
 *
 * O PAI NÃO MUDA. Do lado dele os quatro estados continuam, porque pra ele
 * eles significam coisas diferentes: "a pagar" é uma agenda, e "aguardando
 * confirmação" é a diferença entre ter feito a parte dele ou não.
 * ─────────────────────────────────────────────────────────────────────
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
    // Vazio de propósito: do lado do tio isto é tarefa, e a tarefa está no
    // botão "Dar baixa" ao lado. Ver o cabeçalho deste arquivo.
    admin: '',
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
    // Também vazio: ainda não venceu, não há nada pra ele fazer nem saber.
    admin: '',
    chip: 'A pagar',
    tone: 'neutral',
  },
};

/**
 * O rótulo do que entrou DEPOIS do vencimento, do lado do tio.
 *
 * Separado do mapa acima porque não é um estado — é 'paid' com uma história
 * (ver `foiPagoAtrasado` em services/paymentsService). Âmbar e não verde: o
 * dinheiro entrou, então não é vermelho; mas deu trabalho, e verde apagaria
 * exatamente isso.
 */
export const PAGO_ATRASADO = { label: 'Pago atrasado', tone: 'late-ok' };

/** Classes Tailwind do chip por tom — mesma cor nas duas pontas. */
export const TONE_CLASSES = {
  ok: 'bg-emerald-100 text-emerald-800',
  wait: 'bg-amber-100 text-amber-800',
  late: 'bg-red-100 text-red-800',
  // Entrou, mas atrasado. Verde-acinzentado com texto âmbar: lê como
  // "resolvido" à distância e como "houve atrito" de perto.
  'late-ok': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  neutral: 'bg-gray-100 text-gray-700',
};

/**
 * Texto do status pro papel de quem está lendo.
 * @param status 'paid' | 'claimed' | 'overdue' | 'pending'
 * @param role   'parent' | 'admin'
 */
export function paymentLabel(status, role = 'parent', opts = {}) {
  // "Pago atrasado" é só do lado do tio: pro pai, um mês pago é um mês
  // resolvido, e carimbar o atraso dele meses depois é cobrança sem ação.
  if (role === 'admin' && status === 'paid' && opts.pagoAtrasado) {
    return PAGO_ATRASADO.label;
  }
  const entry = PAYMENT_LABELS[status] || PAYMENT_LABELS.pending;
  const texto = entry[role];
  // String vazia é resposta legítima ("não há palavra pra isto deste lado"),
  // e `|| entry.chip` a atropelaria. Só cai no chip quando o papel não existe
  // no mapa.
  return texto === undefined ? entry.chip : texto;
}

export function paymentTone(status, role = 'parent', opts = {}) {
  if (role === 'admin' && status === 'paid' && opts.pagoAtrasado) {
    return PAGO_ATRASADO.tone;
  }
  return (PAYMENT_LABELS[status] || PAYMENT_LABELS.pending).tone;
}

export function paymentChipClasses(status, role = 'parent', opts = {}) {
  return TONE_CLASSES[paymentTone(status, role, opts)];
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
