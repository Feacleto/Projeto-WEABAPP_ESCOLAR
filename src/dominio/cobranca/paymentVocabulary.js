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
 *   Pendente        ainda não venceu
 *   Conferir        o pai diz que pagou
 *
 * ⚠️ ATUALIZADO (03/10/2026, design system D5). `pending` e `claimed` eram
 * SEM PALAVRA do lado dele — "a receber" no dia 2 parecia ruído, e o
 * `claimed` era só o botão "Dar baixa". A lista nova pinta cada linha com a
 * folhinha do estado, e cor sem palavra do lado é cor pedindo para ser
 * decifrada. As duas palavras são CURTAS de propósito: "Pendente" é cinza e
 * não chama; "Conferir" é o verbo do que ELE tem que fazer, não um rótulo
 * descrevendo tarefa — e o botão "Dar baixa" continua do lado.
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
    // O nome do ESTADO depois do "Já paguei", igual em toda tela da família
    // (Financeiro, extrato, ficha) — com ou sem comprovante. Ver o fim do
    // arquivo: o "Pago" verde antes da baixa saiu em 03/10/2026.
    parent: 'Aguardando o motorista confirmar',
    // O verbo do que ele tem que fazer; o botão "Dar baixa" fica ao lado.
    admin: 'Conferir',
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
    // Ainda não venceu. Cinza: não chama, só nomeia a cor da folhinha.
    admin: 'Pendente',
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
  // O verde do chip "em dia" do design system (D5): fundo primaryChip, letra
  // accentText — a mesma tinta do StatusBadge "entregue" e da lista do mês.
  ok: 'bg-primaryChip text-accentText',
  wait: 'bg-warningChip text-warningText',
  late: 'bg-dangerChip text-dangerText',
  // Entrou, mas atrasado. Verde-acinzentado com texto âmbar: lê como
  // "resolvido" à distância e como "houve atrito" de perto.
  'late-ok': 'bg-warningSoft text-warningText ring-1 ring-warningBorder',
  neutral: 'bg-neutro text-textMuted',
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
 * ⚠️ NÃO EXISTE MAIS "PAGO" ANTES DA BAIXA (03/10/2026).
 *
 * Havia `parentClaimedLabel`/`parentClaimedTone`: com comprovante anexado, a
 * família lia "Pago" em verde antes de o motorista confirmar — o argumento era
 * que, do lado dela, estava resolvido. Três problemas, e o último decide:
 *
 *   1. O Financeiro dizia "Pago" e o extrato dizia "Aguardando" para o MESMO
 *      pagamento: dois nomes para um estado, na mesma conta.
 *   2. O comprovante é uma imagem que ela escolheu, não um fato conferido —
 *      o motorista pode não reconhecer o PIX (print errado, valor errado,
 *      duplicata). Verde ali é a tela afirmando o que ninguém conferiu.
 *   3. Quando o motorista desfaz ou não confirma, a família que leu "Pago"
 *      descobre pela cobrança seguinte — a pior hora.
 *
 * O medo do comentário antigo ("âmbar faz parecer que ela tem pendência")
 * é respondido pela FRASE, não pela cor: "Aguardando o motorista confirmar"
 * diz de quem é a vez. E a trilha logo abaixo mostra "Você avisou em …", que
 * é a prova de que ela fez a parte dela. Verde é só `paid`.
 */
