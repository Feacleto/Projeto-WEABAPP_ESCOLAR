/**
 * O ESTADO DO DINHEIRO DO PAI — puro, sem Firebase.
 *
 * POR QUE ISTO SAIU DE `services/paymentsService.js`
 * `computeDisplayStatus` é a definição de "atrasado" no app inteiro, e o
 * cabeçalho dela avisa que **dezessete lugares perguntam `=== 'paid'`** para
 * somar recebido, filtrar lista e montar relatório. Nenhum teste protegia
 * essa contagem — porque não podia: a função morava atrás de um
 * `import { db }`, e este projeto testa com scripts Node puros.
 *
 * A HORA ENTRA POR PARÂMETRO, e é isso que torna o teste possível de verdade.
 * Antes as três funções liam `Date.now()` direto, então "vence hoje", "venceu
 * ontem" e "a janela de 24h fechou" só dava pra testar mexendo no relógio da
 * máquina. É o mesmo desenho de `avisoDoMomento.js`, que já é testado com hora
 * injetada. O padrão continua sendo `Date.now()` — nenhum chamador mudou.
 *
 * O QUE NÃO PODE MUDAR AQUI
 * `foiPagoAtrasado` é LEITURA, não estado: "pago atrasado" continua sendo
 * `'paid'` para todo mundo que conta dinheiro. Transformá-lo num quinto valor
 * de `computeDisplayStatus` faria o dinheiro que ENTROU sumir dos totais — a
 * pior forma de regressão, porque o número continua aparecendo, só que menor.
 *
 * Este arquivo não importa nada. Não adicione import.
 */

/**
 * Quanto tempo o motorista tem para desfazer uma baixa.
 *
 * Sem janela, desfazer seria eterno e a baixa não valeria como registro; sem
 * desfazer nenhum, quem marcou "cartão" por engano — ou levou estorno na
 * maquininha — ficava sem saída.
 */
export const UNDO_WINDOW_HOURS = 24;
const UNDO_WINDOW_MS = UNDO_WINDOW_HOURS * 60 * 60 * 1000;

/** Lê um campo de data que pode vir como Timestamp do Firestore ou Date. */
function emMilissegundos(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * O estado que a tela mostra:
 *   - 'paid'     — o tio confirmou
 *   - 'claimed'  — o pai avisou que pagou, aguardando confirmação
 *   - 'overdue'  — pendente E vencido
 *   - 'pending'  — pendente E ainda no prazo (ou sem data)
 *
 * 'overdue' é derivado em runtime — evita Cloud Function só pra mudar status.
 * 'claimed' tem PRIORIDADE sobre 'overdue': se o pai avisou, mesmo depois da
 * data, o tio precisa confirmar antes de virar 'paid'. Inverter essa ordem
 * faria o app cobrar de novo quem já avisou que pagou.
 */
export function computeDisplayStatus(payment, agora = Date.now()) {
  if (!payment) return 'pending';
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'claimed') return 'claimed';
  const due = emMilissegundos(payment.dueDate);
  if (due && due < agora) return 'overdue';
  return 'pending';
}

/**
 * O pagamento entrou, mas entrou DEPOIS do vencimento?
 *
 * É o que responde "quem mais atrasa": um mês pago no dia 3 e um pago no dia
 * 28 são ambos verdes no fim do mês, e a diferença entre eles é quem vai dar
 * trabalho de novo. Derivado dos dois campos que o documento já tem — zero
 * migração.
 */
export function foiPagoAtrasado(payment) {
  if (!payment || payment.status !== 'paid') return false;
  const pago = emMilissegundos(payment.paidAt);
  const vence = emMilissegundos(payment.dueDate);
  if (!pago || !vence) return false;
  return pago > vence;
}

/**
 * A baixa ainda pode ser revertida pelo motorista?
 *
 * Devolve `{ allowed, reason }` — a razão é o que a tela mostra, então ela
 * precisa dizer o número de horas, não só "não pode".
 */
export function canUndoReceipt(payment, agora = Date.now()) {
  if (!payment) return { allowed: false, reason: 'Pagamento não encontrado.' };
  if (payment.status !== 'paid') {
    return { allowed: false, reason: 'Pagamento ainda não foi confirmado.' };
  }
  const pago = emMilissegundos(payment.paidAt);
  if (!pago) {
    // Sem timestamp → pagamento antigo. Permite desfazer (compatibilidade).
    return { allowed: true, reason: null };
  }
  const decorrido = agora - pago;
  if (decorrido > UNDO_WINDOW_MS) {
    const horas = Math.round(decorrido / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `Já se passaram ${horas}h da confirmação. Reversão liberada só em até ${UNDO_WINDOW_HOURS}h pra evitar erros.`,
    };
  }
  return { allowed: true, reason: null };
}
