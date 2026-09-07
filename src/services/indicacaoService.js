import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  ESTADO,
  chaveDoTelefone,
  contarAtivas,
  montarIndicacao,
} from '../dominio/identidade/indicacao.js';

/**
 * A INDICAÇÃO — o registro que faltava.
 *
 * Antes disto existia só `users.indicacoesAtivas`, um número que o dono
 * escrevia à mão. Não havia como conferir, como o motorista acompanhar, nem
 * como saber se a indicação foi real.
 *
 * ── ⚠️ O CONTADOR CONTINUA SENDO O QUE COBRA, E ELE É DERIVADO
 * `precoDoMes` lê `users.indicacoesAtivas`; a coleção `indicacoes` é a
 * memória. Os dois precisam concordar, e o jeito de garantir isso não é
 * disciplina: `casarEAtivar` RECONTA as ativas e grava o total, em vez de
 * incrementar. Incremento erra para sempre depois de uma falha no meio; a
 * recontagem se conserta sozinha na próxima ativação.
 *
 * ── QUEM MOVE O ESTADO NÃO É O INDICADOR
 * É o ponto inteiro da carência. `casarEAtivar` roda quando a primeira fatura
 * do indicado é quitada, e é ação do DONO. Se o indicador pudesse marcar
 * `ativa`, ele indicaria cinco cadastros de teste e zeraria a conta com receita
 * que nunca entrou.
 *
 * As rules refletem isso: ele CRIA a indicação dele e lê as dele; mudar estado
 * é do dono. O cabeçalho de `casarEAtivar` conta por que o casamento não pode
 * acontecer no cadastro do indicado.
 */

const COL = 'indicacoes';

/** Id determinístico: um indicador não indica o mesmo número duas vezes. */
const ID = (indicadorUid, chave) => `${indicadorUid}_${chave}`;

/** O motorista indica alguém. A validação inteira é do domínio. */
export async function indicar(indicador, { telefone, nome }) {
  const jaIndicados = (await listarIndicacoesDe(indicador.uid)).map((i) => i.chave);
  const registro = montarIndicacao({ indicador, telefone, nome });
  if (jaIndicados.includes(registro.chave)) {
    throw new Error('Você já indicou esse número.');
  }
  await setDoc(doc(db, COL, ID(indicador.uid, registro.chave)), {
    ...registro,
    em: serverTimestamp(),
  });
  return registro;
}

/** As indicações de um motorista — a tela dele e a ficha dele. */
export async function listarIndicacoesDe(indicadorUid) {
  if (!indicadorUid) return [];
  const snap = await getDocs(query(collection(db, COL), where('indicadorUid', '==', indicadorUid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchIndicacoesDe(indicadorUid, cb, onError) {
  return onSnapshot(
    query(collection(db, COL), where('indicadorUid', '==', indicadorUid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/**
 * O CASAMENTO E A ATIVAÇÃO — os dois passos, e os dois são do DONO.
 *
 * ── ⚠️ POR QUE NÃO ACONTECE NO CADASTRO DO INDICADO
 * A tentação era casar no instante em que o motorista novo se cadastra: ele
 * digita o telefone, o app procura uma indicação com aquela chave e marca
 * `cadastrado`. Ela foi RECUSADA, e vale registrar por quê.
 *
 * Uma consulta `where('chave', '==', ...)` não é escopada por dono. Para ela
 * passar, `indicacoes` precisaria de `allow list` para qualquer motorista — e
 * isso entrega a lista de telefones que a base inteira indicou a quem criar uma
 * conta em trinta segundos. É exatamente o furo que a chave PIX, a trilha de
 * pagamento e os leads de família já custaram neste projeto: regra que para num
 * `isAdmin()` solto é porta pública.
 *
 * ── ENTÃO OS DOIS PASSOS ACONTECEM QUANDO O DINHEIRO ENTRA
 * `casarEAtivar` roda dentro da baixa da fatura, que é ação do dono. E o
 * momento é o certo, não um consolo: a indicação só vale quando o indicado
 * PAGA — antes disso, marcar `cadastrado` seria contabilidade sem
 * consequência.
 *
 * A carência continua expressa nos dois estados: o registro passa por
 * `cadastrado` e por `ativa` no mesmo lote, porque o sistema observou os dois
 * fatos ao mesmo tempo. `podeTransitar` continua recusando pular a etapa, e é
 * ela que documenta a ordem.
 *
 * ── ⚠️ RECONTA, NÃO INCREMENTA
 * Um `increment(1)` que rode duas vezes — o webhook do gateway e a baixa manual
 * do dono podem quitar a mesma fatura — daria dois descontos por um cliente, e
 * o erro ficaria para sempre. A recontagem é idempotente: rodar de novo chega
 * no mesmo número.
 *
 * Os dois writes vão no MESMO lote: o estado da indicação e o contador que
 * cobra. Separados, existiria a indicação ativa que não desconta nada — que é
 * literalmente o "indiquei e não recebi".
 */
export async function casarEAtivar(indicado) {
  try {
    const chave = chaveDoTelefone(indicado?.phone);
    if (!chave || !indicado?.uid) return 0;

    // Só as pendentes e as já casadas com ESTE uid. Quem já está `ativa` fica
    // de fora: reativar contaria a mesma indicação duas vezes.
    const todas = await listarTodasIndicacoes();
    const minhas = todas.filter(
      (i) =>
        (i.estado === ESTADO.PENDENTE && i.chave === chave) ||
        (i.estado === ESTADO.CADASTRADO && i.indicadoUid === indicado.uid)
    );
    if (!minhas.length) return 0;

    // ⚠️ SE DOIS MOTORISTAS INDICARAM A MESMA PESSOA, VALE QUEM INDICOU
    // PRIMEIRO. Premiar os dois pagaria 20% por um cliente; premiar o último
    // premiaria quem chegou depois de o trabalho estar feito.
    const porIndicador = new Map();
    minhas
      .sort((a, b) => (a.em?.toMillis?.() || 0) - (b.em?.toMillis?.() || 0))
      .forEach((i) => {
        if (!porIndicador.size) porIndicador.set(i.indicadorUid, i);
      });
    const escolhida = [...porIndicador.values()][0];
    if (!escolhida) return 0;

    // O indicador NÃO pode ser o próprio indicado. O domínio já barra isso na
    // criação, mas a rule não sabe comparar telefones — e este é o último
    // ponto antes de o desconto virar dinheiro.
    if (escolhida.indicadorUid === indicado.uid) return 0;

    const dele = await listarIndicacoesDe(escolhida.indicadorUid);
    const jaAtivas = contarAtivas(dele);

    const lote = writeBatch(db);
    lote.update(doc(db, COL, escolhida.id), {
      estado: ESTADO.ATIVA,
      indicadoUid: indicado.uid,
      cadastradoEm: escolhida.cadastradoEm || serverTimestamp(),
      ativaEm: serverTimestamp(),
    });
    lote.set(
      doc(db, 'users', escolhida.indicadorUid),
      { indicacoesAtivas: jaAtivas + 1 },
      { merge: true }
    );
    await lote.commit();
    return 1;
  } catch (err) {
    // ENGOLE, e é decidido: isto roda DEPOIS de o dono dar baixa numa fatura.
    // A baixa não pode falhar por causa do desconto de um terceiro.
    console.error('[indicacao] não deu pra casar/ativar:', err);
    return 0;
  }
}

/** Todas as indicações — a visão do dono, para conferir uma reclamação. */
export async function listarTodasIndicacoes() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
