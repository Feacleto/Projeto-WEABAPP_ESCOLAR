/**
 * A TRILHA DE UM PAGAMENTO — o que aconteceu, em ordem, e quem fez.
 *
 * ── POR QUE ELA EXISTE (o cabeçalho de `paymentAuditService` conta a origem)
 * Um pagamento guardava só o estado FINAL, e desfazer apagava a prova de quem
 * tinha agido antes. Numa discussão — *"eu avisei que paguei em julho"* — a
 * evidência de um dos lados era destruída pela ação do outro, e quem cede por
 * cansaço é sempre quem tem menos poder na relação. As rules deixaram a
 * subcoleção append-only por isso: nem o dono apaga um evento.
 *
 * ── E ELA NUNCA FOI MOSTRADA A NINGUÉM
 * `listPaymentEvents` e `eventLabel` existiam sem um único chamador: os
 * eventos eram gravados, as rules deixavam **os dois lados** lerem (o
 * comentário delas diz isso com todas as letras), e nenhuma tela abria a
 * lista. Prova que ninguém consegue ver não resolve discussão nenhuma — é o
 * mesmo custo do campo escrito sem leitor, com o agravante de que aqui o
 * leitor estava autorizado e faltava a tela.
 *
 * ── A PRIMEIRA LINHA É SINTETIZADA, NÃO GRAVADA
 * `created` está no vocabulário desde o começo e nunca foi escrito: quem cria
 * a mensalidade é a agendada `generateMonthlyPayments`, e gravar um evento
 * por mensalidade por mês é uma escrita a mais para dizer o que o próprio
 * documento já diz em `createdAt`. Então a linha zero sai daí. Se um dia o
 * evento real for gravado, ele VENCE — a síntese só entra quando não existe.
 *
 * ── O QUE NÃO ENTRA AQUI
 * Nada de Firebase e nada de formatação de data: a função recebe o documento
 * e os eventos já lidos, e devolve `Date`. Quem escreve "12/11" é a tela.
 */

export const EVENTO = {
  CREATED: 'created',
  CLAIMED: 'claimed',
  UNCLAIMED: 'unclaimed',
  CONFIRMED: 'confirmed',
  REVERTED: 'reverted',
  RECEIPT_ATTACHED: 'receipt_attached',
  RECEIPT_REPLACED: 'receipt_replaced',
};

/**
 * ⚠️ O RÓTULO DIZ QUEM AGIU, e isso não é estilo.
 *
 * "Comprovante substituído" sozinho não diz que alguém trocou a prova de
 * outra pessoa — e é justamente o caso em que a trilha precisa ser lida. Cada
 * frase nomeia o autor, para a linha fazer sentido fora de contexto.
 */
const ROTULOS = {
  created: 'Mensalidade gerada',
  claimed: 'Responsável informou o pagamento',
  unclaimed: 'Responsável desfez o aviso de pagamento',
  confirmed: 'Motorista confirmou o recebimento',
  reverted: 'Motorista desfez a confirmação',
  receipt_attached: 'Comprovante anexado',
  receipt_replaced: 'Comprovante substituído',
};

export function rotuloDoEvento(tipo) {
  return ROTULOS[tipo] || tipo;
}

/** Timestamp do Firestore, Date, número ou string → Date (ou null). */
function paraData(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A trilha pronta pra desenhar, do mais antigo pro mais novo.
 *
 * @param payment  o doc de `payments` (só `createdAt` é usado)
 * @param eventos  o que veio de `payments/{id}/events`
 * @returns [{ tipo, rotulo, quando, quem, nota, sintetizado }]
 *
 * ⚠️ EVENTO SEM DATA NÃO É DESCARTADO. `at` é `serverTimestamp()`, então ele
 * chega nulo no instante entre a escrita local e o eco do servidor — jogar
 * fora faria a linha recém-criada sumir e voltar. Ele vai para o FIM, que é
 * onde acabou de acontecer.
 */
export function montarTrilha({ payment = null, eventos = [] } = {}) {
  const lista = Array.isArray(eventos) ? eventos : [];

  const linhas = lista.map((e) => ({
    tipo: e?.type || null,
    rotulo: rotuloDoEvento(e?.type),
    quando: paraData(e?.at),
    quem: e?.actorRole || null,
    nota: e?.note || null,
    sintetizado: false,
  }));

  // A linha zero, só quando o evento real não existe. Ver o cabeçalho.
  const jaTemCriacao = linhas.some((l) => l.tipo === EVENTO.CREATED);
  const nascimento = paraData(payment?.createdAt);
  if (!jaTemCriacao && nascimento) {
    linhas.push({
      tipo: EVENTO.CREATED,
      rotulo: rotuloDoEvento(EVENTO.CREATED),
      quando: nascimento,
      quem: null,
      nota: null,
      sintetizado: true,
    });
  }

  return linhas.sort((a, b) => {
    if (!a.quando) return 1;
    if (!b.quando) return -1;
    return a.quando - b.quando;
  });
}
