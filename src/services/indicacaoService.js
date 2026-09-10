import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { notifyIndicacaoAtivou } from './notificationsService';
import {
  ESTADO,
  chaveDoTelefone,
  contarAtivas,
  escolherParaAtivar,
  montarIndicacao,
} from '../dominio/identidade/indicacao.js';
import { planoValido, valorDaIndicacao } from '../dominio/associacao/planos.js';
import { formatCurrency } from '../compartilhado/formatters';

/**
 * QUANTO A INDICAÇÃO NOVA VALE, EM REAIS, PARA QUEM INDICOU.
 *
 * ── ⚠️ POR QUE VALE UMA LEITURA A MAIS
 * O aviso de indicação ativada existe contra uma frase — *"indiquei e não
 * recebi"* — e a versão sem valor não a evitava: *"já entra na sua próxima
 * fatura"* não diz se são dez centavos ou dez reais, então a dúvida
 * sobrevive ao aviso que deveria matá-la.
 *
 * O desconto é 10% da fatura dele, e quanto isso vale depende do tamanho da
 * operação dele. Só o documento dele tem esse número, então é preciso lê-lo.
 * Uma leitura, num caminho que roda no máximo uma vez por indicado.
 *
 * ── E ELE É A DIFERENÇA ENTRE DUAS CONTAS, NÃO 10% DO BRUTO
 * Com o piso mordendo, a indicação pode valer MENOS que 10% — quem já está
 * perto do mínimo recebe só o que sobra até lá. Anunciar 10% cheios ali seria
 * a mesma promessa vazia com outro número. A conta é: o que ele pagaria com
 * as indicações de antes, menos o que paga com esta.
 *
 * Devolve `null` quando não dá para saber (sem plano, documento ausente), e
 * aí a frase cai para a versão sem valor — melhor calar o número que errar.
 */
async function quantoAIndicacaoVale(indicadorUid, ativasDepois, mes) {
  try {
    const snap = await getDoc(doc(db, 'users', indicadorUid));
    if (!snap.exists()) return null;
    const u = snap.data() || {};
    if (!planoValido(u.plano)) return null;

    const base = {
      criancas: Number(u.criancasAtivas) || 0,
      plano: u.plano,
      fundador: u.condicaoFundador || null,
      descontos: u.descontos,
      mes,
    };
    // ⚠️ A ARITMÉTICA SAIU DAQUI. Ela era a mesma diferença entre duas
    // chamadas de `precoDoMes`, escrita à mão num service — e as telas que
    // convidam a indicar precisam da MESMA resposta, para a próxima em vez
    // da que acabou de valer. Duas cópias da mesma conta divergiriam no dia
    // em que o piso mudasse de lugar, e o sintoma seria o aviso prometendo
    // um valor que a fatura não desconta.
    const diferenca = valorDaIndicacao({ ...base, numero: ativasDepois });
    return diferenca && diferenca > 0 ? formatCurrency(diferenca) : null;
  } catch {
    // O aviso é melhor sem número que ausente. Nunca derruba a ativação.
    return null;
  }
}

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

    // A ESCOLHA MORA NO DOMÍNIO, e saiu daqui em 09/09/2026.
    //
    // As duas regras de ordem (uma já casada ganha de qualquer pendente; entre
    // pendentes vale quem indicou primeiro) e a barreira da auto-indicação
    // estavam escritas aqui dentro. Quando a baixa da fatura passou a poder vir
    // do GATEWAY, o casamento precisou existir no servidor também — e regra de
    // dinheiro escrita duas vezes é regra que diverge.
    //
    // Agora ela é pura, testável, e tem uma cópia espelhada em
    // `functions/lib/indicacao.js` que `npm run testar:indicacao` compara.
    const todas = await listarTodasIndicacoes();
    const escolhida = escolherParaAtivar({
      indicacoes: todas,
      indicadoUid: indicado.uid,
      chave,
    });
    if (!escolhida) return 0;

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

    // ⚠️ ESTE AVISO EXISTE CONTRA UMA FRASE: *"indiquei e não recebi"*, que
    // numa rede de indicação viaja mais rápido que a própria indicação. Ela
    // nasce das duas pontas possíveis (o telefone que não bateu, e a
    // indicação que não devia valer) e as duas produzem o mesmo silêncio.
    // Dizer no minuto em que o desconto passa a valer tira a dúvida antes de
    // ela virar conversa no portão da escola.
    const agora = new Date();
    const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    await notifyIndicacaoAtivou({
      indicadorUid: escolhida.indicadorUid,
      ativas: jaAtivas + 1,
      descontoEmReais: await quantoAIndicacaoVale(
        escolhida.indicadorUid,
        jaAtivas + 1,
        mes
      ),
    });
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
