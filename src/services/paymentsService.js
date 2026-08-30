import {
  collection,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { playSound } from './soundService';
import { exigirCloud } from './callableError';

// NOTA: a geracao das mensalidades do mes e a limpeza do historico
// antigo NAO vivem mais aqui. Foram pra functions/lib/billing.js,
// agendadas pra 6h todo dia: rodando no cliente, o mes em que o tio nao
// abrisse o app ficava sem cobranca, e a limpeza era exclusao em massa
// disparada sem confirmacao no carregamento da tela.

/**
 * Pai marca o pagamento como "paguei" (aguardando confirmação do tio).
 * O Firestore Rules garante que pai só pode escrever 'pending' -> 'claimed'.
 *
 * @param method 'pix' | 'cash' — como ele pagou (opcional, default 'pix')
 */
export async function claimPayment(
  paymentId,
  method = 'pix',
  receiptURL = null,
  receiptHash = null
) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'claimed',
    claimedAt: serverTimestamp(),
    paymentMethod: method,
    // Hash do arquivo: uma Cloud Function compara com os outros
    // pagamentos e avisa o tio se for o mesmo comprovante de outro mês.
    receiptHash: receiptHash || null,
    // Comprovante anexado fecha o ciclo dentro do app: sem ele, "paguei"
    // virava conversa paralela no WhatsApp com print de tela.
    receiptURL: receiptURL || null,
  });
  // Som "pagar" — feedback pro pai que marcou como pago
  playSound('pay');
}


/**
 * Anexa (ou troca) o comprovante de um pagamento já existente.
 *
 * POR QUE O TIO PRECISA DISTO
 * O caminho ideal é o pai anexar ao avisar que pagou. Mas o caminho real,
 * na maioria das vezes, é ele pagar pelo banco e mandar o print no
 * WhatsApp — porque foi assim que ele sempre fez. Sem uma forma de o tio
 * anexar aquilo, o comprovante fica fora do app e o histórico do mês
 * mente: aparece como pago sem lastro nenhum.
 *
 * Não muda o STATUS, só o anexo. Confirmar recebimento continua sendo uma
 * decisão separada e explícita do tio.
 */
export async function attachReceipt(paymentId, receiptURL, receiptHash = null) {
  if (!paymentId) throw new Error('Sem paymentId.');
  await updateDoc(doc(db, 'payments', paymentId), {
    receiptURL: receiptURL || null,
    receiptHash: receiptHash || null,
    receiptAttachedAt: serverTimestamp(),
  });
}
/**
 * Pai desfaz "marquei como pago" (caso tenha clicado errado e o tio ainda
 * não confirmou). Volta pra 'pending'.
 */
export async function unclaimPayment(paymentId) {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'pending',
    claimedAt: null,
    paymentMethod: null,
    receiptURL: null,
  });
}

/**
 * Tio confirma que recebeu o pagamento — admin only.
 * Funciona tanto pra dar baixa direto ('pending' -> 'paid') quanto pra
 * confirmar um claim do pai ('claimed' -> 'paid').
 *
 * `method` ('pix' | 'cash' | 'card') registra como o tio recebeu — preserva
 * o método declarado pelo pai (se houver) ou sobrescreve com o que o tio
 * informar na hora de dar baixa.
 */
export async function confirmReceipt(paymentId, method = null) {
  const updates = {
    status: 'paid',
    paidAt: serverTimestamp(),
  };
  if (method) updates.paymentMethod = method;
  await updateDoc(doc(db, 'payments', paymentId), updates);
  // Som "caixa registrando" — feedback pro Tio que deu baixa
  playSound('cash_in');
}

/**
 * Janela em que o Tio pode reverter um recebimento que ele mesmo deu baixa.
 * Depois disso, a confirmação fica definitiva — evita zicas tipo o pai
 * recolher o dinheiro 1 mês depois ou o Tio se confundir muito tempo
 * após o fato.
 *
 * VALE PRA TODO MÉTODO, INCLUSIVE CARTÃO
 * A versão anterior negava reversão a 'card' para sempre, alegando que
 * cartão "é reconhecido automaticamente pelo gateway". Não existe gateway
 * neste app: o pai paga o motorista direto, por PIX, dinheiro ou maquininha,
 * e os três chegam aqui do mesmo jeito — o motorista digitando como
 * recebeu. Tratar um deles como se tivesse confirmação automática dava a
 * ele a única baixa irreversível do sistema, e com a justificativa errada:
 * quem marcou "cartão" por engano, ou levou estorno na maquininha, ficava
 * sem saída nenhuma.
 */
export const UNDO_WINDOW_HOURS = 24;
const UNDO_WINDOW_MS = UNDO_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Diz se um pagamento ainda pode ser revertido pelo Tio. Combina:
 *   - tempo desde a confirmação (limite UNDO_WINDOW_HOURS)
 *
 * Retorna { allowed, reason } pra UI exibir mensagem clara.
 */
export function canUndoReceipt(payment) {
  if (!payment) return { allowed: false, reason: 'Pagamento não encontrado.' };
  if (payment.status !== 'paid') {
    return { allowed: false, reason: 'Pagamento ainda não foi confirmado.' };
  }
  const paidAt =
    payment.paidAt?.toDate?.() ||
    (payment.paidAt ? new Date(payment.paidAt) : null);
  if (!paidAt) {
    // Sem timestamp → pagamento antigo. Permite desfazer (compatibilidade).
    return { allowed: true, reason: null };
  }
  const elapsed = Date.now() - paidAt.getTime();
  if (elapsed > UNDO_WINDOW_MS) {
    const hours = Math.round(elapsed / (60 * 60 * 1000));
    return {
      allowed: false,
      reason: `Já se passaram ${hours}h da confirmação. Reversão liberada só em até ${UNDO_WINDOW_HOURS}h pra evitar erros.`,
    };
  }
  return { allowed: true, reason: null };
}

/**
 * Reverte uma confirmação (em caso de erro do tio). Sujeito às regras
 * de `canUndoReceipt` — joga erro se não for permitido (a UI evita o
 * caminho mas a verificação aqui é a fonte da verdade).
 *
 * Volta pra 'pending' — perde o claim do pai (ele precisa marcar de novo).
 */
export async function undoReceipt(paymentId, payment = null) {
  if (payment) {
    const { allowed, reason } = canUndoReceipt(payment);
    if (!allowed) throw new Error(reason || 'Reversão não permitida.');
  }
  // claimedAt NÃO é zerado.
  //
  // A versão anterior apagava esse campo, e com ele a prova de que o pai
  // um dia declarou o pagamento. Numa discussão — "eu avisei que paguei",
  // "não avisou" — a evidência de um dos lados era destruída pela ação do
  // outro. Se ele avisou, isso aconteceu; desfazer a confirmação não
  // desfaz o aviso.
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'pending',
    paidAt: null,
    revertedAt: serverTimestamp(),
  });
}

/**
 * Calcula o status de exibição.
 *
 * Estados possíveis:
 *   - 'paid'     — pago e confirmado pelo tio
 *   - 'claimed'  — pai marcou como pago, aguardando confirmação do tio
 *   - 'overdue'  — pendente E dueDate < hoje
 *   - 'pending'  — pendente E dueDate >= hoje (ou sem dueDate)
 *
 * 'overdue' é derivado em runtime — evita Cloud Function pra atualizar status.
 * 'claimed' tem prioridade sobre 'overdue': se o pai marcou como pago, mesmo
 * que esteja após a data, o tio precisa confirmar antes de virar 'paid'.
 */
export function computeDisplayStatus(payment) {
  if (!payment) return 'pending';
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'claimed') return 'claimed';
  const due = payment.dueDate?.toDate?.()?.getTime();
  if (due && due < Date.now()) return 'overdue';
  return 'pending';
}

/**
 * O pagamento entrou, mas entrou DEPOIS do vencimento?
 *
 * POR QUE ISTO NÃO É UM QUINTO ESTADO
 * A tentação era `computeDisplayStatus` devolver 'paidLate'. Seria errado:
 * dezessete lugares perguntam `=== 'paid'` pra somar recebido, filtrar lista
 * e montar relatório. Um estado novo faria o dinheiro que ENTROU sumir dos
 * totais — o pior tipo de regressão, porque o número continua aparecendo,
 * só que menor.
 *
 * Então "pago atrasado" é LEITURA, não estado. Continua sendo 'paid' pra
 * todo mundo que conta; só o rótulo na tela conta a história completa.
 *
 * É o que responde "quem mais atrasa": um mês pago no dia 3 e um pago no dia
 * 28 são ambos verdes no fim do mês, e é a diferença entre eles que diz com
 * quem o tio vai ter trabalho de novo.
 *
 * Derivado em tempo de execução dos dois campos que já existem no documento.
 * Zero migração.
 */
export function foiPagoAtrasado(payment) {
  if (!payment || payment.status !== 'paid') return false;
  const pago = payment.paidAt?.toDate?.()?.getTime();
  const vence = payment.dueDate?.toDate?.()?.getTime();
  if (!pago || !vence) return false;
  return pago > vence;
}

/**
 * Busca os pagamentos DESTE motorista desde `fromMonthKey` (YYYY-MM).
 * Uso no relatório financeiro do Tio — one-shot, não-reativo.
 *
 * Sobre o `adminUid` obrigatório, ver a nota em `watchPaymentsByMonth`.
 */
export async function getPaymentsSince(fromMonthKey, adminUid) {
  if (!fromMonthKey || !adminUid) return [];
  const q = query(
    collection(db, 'payments'),
    where('adminUid', '==', adminUid),
    where('month', '>=', fromMonthKey)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}


/**
 * A DÍVIDA QUE SE ARRASTA — pagamentos abertos de meses ANTERIORES ao pedido.
 *
 * POR QUE ISSO PRECISOU EXISTIR
 * A tela do financeiro é por competência: agosto mostra as mensalidades DE
 * agosto. Isso deixava um buraco perigoso — a mensalidade de julho que ninguém
 * pagou ficava só em julho, e o motorista que olha o mês corrente (todo mundo)
 * não via a dívida antiga. Ela sumia de vista justamente porque envelheceu, e
 * quanto mais velha, mais difícil de receber.
 *
 * O QUE CONTA COMO ARRASTANDO
 * Qualquer cobrança de mês anterior que não está `paid`: 'pending' e também
 * 'claimed' (o pai disse que pagou e o motorista ainda não deu baixa — o
 * dinheiro pode até ter entrado, mas a conta continua aberta no sistema, e é
 * ele que precisa fechar). Vencimento não entra na conta aqui: cobrança de
 * mês passado ainda aberta está atrasada por definição, mesmo que o
 * `dueDate` tenha sido salvo torto.
 *
 * POR QUE FILTRAR O MÊS EM JS, E NÃO NA CONSULTA
 * `where('status','in',[...])` + `where('month','<',key)` mistura `in` com
 * desigualdade em campos diferentes: pede índice composto e uma migração de
 * firestore.indexes.json pra cada ambiente. Cobrança aberta é conjunto
 * pequeno por natureza (o que está pago sai da conta sozinho), então trazer
 * as abertas e cortar o mês na memória custa menos que manter um índice.
 */
export function watchArrears(beforeMonthKey, adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'payments'),
    where('adminUid', '==', adminUid),
    where('status', 'in', ['pending', 'claimed'])
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => (p.month || '') < beforeMonthKey);
      // Mais velho primeiro: é a ordem de quem precisa ser cobrado antes.
      list.sort((a, b) => (a.month || '').localeCompare(b.month || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchArrears error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe aos pagamentos de um mês específico (visão do Tio).
 *
 * O `adminUid` NÃO É OPCIONAL — e isto vale pras quatro consultas daqui.
 * As rules exigem que a consulta prove o escopo do motorista, e consulta sem
 * o filtro não volta filtrada: volta NEGADA, inteira. O sintoma é financeiro
 * vazio com erro no console, não "alguns pagamentos". Sem uid devolvemos
 * lista vazia e um unsubscribe inerte, em vez de gastar uma consulta que já
 * se sabe que vai ser recusada.
 *
 * Ordena por nome da criança (client-side, evita índice composto).
 */
export function watchPaymentsByMonth(monthKey, adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'payments'),
    where('adminUid', '==', adminUid),
    where('month', '==', monthKey)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        (a.childName || '').localeCompare(b.childName || '', 'pt-BR')
      );
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByMonth error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe aos pagamentos de uma criança específica.
 *
 * O ESCOPO AQUI MUDA COM O PAPEL, E ISSO NÃO É DETALHE
 * Esta consulta serve as DUAS pontas: o histórico que o motorista abre na
 * ficha da criança, e o mesmo histórico que o responsável vê no app dele
 * (`ChildPaymentHistory` recebe `role` e é montado nos dois lugares). As
 * rules liberam o motorista pelo `adminUid` e o responsável pelo `parentUid`
 * — filtros diferentes, e usar o do motorista na tela do pai devolveria a
 * consulta NEGADA, ou seja, histórico vazio pra quem tem direito de ver.
 *
 * Por isso o segundo parâmetro é um objeto de escopo explícito:
 *   { adminUid }   → visão do motorista
 *   { parentUid }  → visão do responsável
 */
export function watchPaymentsByChild(childId, escopo, onUpdate, onError) {
  const { adminUid, parentUid } = escopo || {};
  if (!childId || (!adminUid && !parentUid)) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'payments'),
    where(adminUid ? 'adminUid' : 'parentUid', '==', adminUid || parentUid),
    where('childId', '==', childId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByChild error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe aos pagamentos de um responsável (visão do Pai).
 *
 * Filtra por parentUid pra alinhar com as Firestore Security Rules
 * (que liberam read se parentUid == request.auth.uid). Ordena por mês desc.
 */
export function watchPaymentsByParent(parentUid, onUpdate, onError) {
  const q = query(
    collection(db, 'payments'),
    where('parentUid', '==', parentUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      onUpdate(list);
    },
    (err) => {
      console.error('watchPaymentsByParent error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Dispara a geração de cobranças do mês na hora, sem esperar as 6h.
 *
 * POR QUE ISTO PRECISA EXISTIR NA INTERFACE
 * A função agendada roda uma vez por dia. Então quando o tio cadastra uma
 * criança à tarde, ou preenche a mensalidade que tinha deixado em branco, a
 * cobrança só nasce na manhã seguinte — e nesse meio-tempo o pai abre o app,
 * lê "nada a pagar" e vai embora achando que está tudo certo.
 *
 * Pior: se a mensalidade só foi configurada DEPOIS da geração daquele mês,
 * aquela criança fica sem cobrança até o mês seguinte. A geração é idempotente
 * (consulta o que já existe), então chamar isto nunca duplica nada.
 */
export async function runBillingNow(monthKey = null) {
  exigirCloud('gerar as cobranças');
  const fn = httpsCallable(functions, 'runBillingNow');
  try {
    const res = await fn(monthKey ? { monthKey } : {});
    return res.data;
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('permission-denied')) {
      // Mensagem mais específica que a genérica de `mensagemDeErro`, e ela
      // passa direto por lá (erro sem `code` cai no ramo do `message`).
      throw new Error('Só o motorista responsável pode gerar cobranças.', {
        cause: err,
      });
    }

    // O ERRO ORIGINAL SOBE INTEIRO — e é isto que estava quebrado.
    //
    // Aqui havia um `new Error('Não conseguimos gerar agora. Tente em alguns
    // segundos.')`. Quem chama (BillingBlockers) passa o erro por
    // `mensagemDeErro`, que classifica pelo `err.code` — e o embrulho jogava
    // o `code` fora. Resultado: `functions/internal` (o código que o SDK
    // devolve quando a function não está publicada) nunca era reconhecido, e o
    // motorista lia "tente em alguns segundos" pra uma coisa que, sem o plano
    // Blaze, não vai funcionar em nenhum número de segundos.
    //
    // É exatamente o engano que `callableError.js` foi escrito pra evitar:
    // "quem lê 'internal' tenta de novo, troca de rede, reinicia o celular".
    // A camada certa existia; uma camada abaixo dela apagava a informação de
    // que ela precisava.
    throw err;
  }
}
