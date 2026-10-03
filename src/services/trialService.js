import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O GESTO DE INICIAR A ROTA, DO LADO DO CLIENTE — só o sinal de uso.
 *
 * ⚠️ ESTE ARQUIVO NÃO GRAVA MAIS `trialInicio` (03/10/2026).
 *
 * Ele gravava: no instante em que o GPS ligava, o próprio motorista escrevia
 * a data em que o teste de 90 dias começa. As rules aceitavam "uma vez só",
 * mas a caneta continuava na mão de quem é cobrado — e bastava não chamar
 * esta função (devtools) para rodar rota para sempre com o relógio parado.
 *
 * Hoje as rules recusam o campo ao cliente, e quem liga é o SERVIDOR: a
 * escrita em `liveLocation/{uid}` com `routeActive: true`, que é o que põe a
 * perua no mapa das famílias, dispara `functions/lib/relogioNaRota.js`. Os
 * três gatilhos (rota, responsável, mensalidade) moram todos em
 * `functions/lib/relogioDoTeste.js`, com a chave da cobrança e o "uma vez
 * só". A tela continua lendo `profile.trialInicio` — ele só chega alguns
 * segundos depois, gravado pelo gatilho.
 *
 * O nome ficou porque `useGeolocation` o chama no gesto que liga o GPS; o
 * que ele faz agora é registrar o uso. Quanto falta e qual aviso mostrar
 * continua sendo conta pura em `dominio/associacao/trial.js`.
 */
export async function ligarRelogioDoTrial(uid) {
  if (!uid) return false;
  // O SINAL DE USO continua sendo do cliente — ver `registrarRota` abaixo.
  await registrarRota(uid);
  return false;
}

/**
 * O SINAL DE USO — quando ele rodou pela última vez, e quantas rotas no mês.
 *
 * ── POR QUE ISTO EXISTE
 * Abandono é o que antecede o cancelamento, e ele era invisível: o painel só
 * saberia que alguém parou quando a fatura não fosse paga — semanas depois de
 * a pessoa ter desistido, e tarde demais para conversar.
 *
 * ── A DATA É O SINAL, O CONTADOR É O CONTEXTO
 * `ultimaRota` é uma data e não desanda. `rotasNoMes` é contador, e contador
 * desanda — `criancasAtivas` já ensinou isso aqui, com o decremento duplo de
 * duas abas. Por isso o termômetro de risco decide pela DATA
 * (`dominio/associacao/risco.js`), e o contador só aparece na ficha como
 * complemento: "roda todo dia" e "roda às terças" são operações diferentes, e a
 * data sozinha não distingue as duas.
 *
 * O contador zera na virada do mês porque ele guarda o MÊS junto: quando o mês
 * muda, o valor é sobrescrito em vez de incrementado. Sem isso ele cresceria
 * para sempre e deixaria de dizer qualquer coisa.
 *
 * ── ELE NÃO DECIDE DINHEIRO, E POR ISSO O CLIENTE PODE ESCREVER
 * As rules deixam o motorista gravar estes dois campos no próprio documento —
 * ao contrário de `trialInicio`, `criancasAtivas`, `limiteCriancas` e
 * `assinaturaAte`, que estão na lista proibida. A diferença é o que está em jogo: mentir aqui faz ele
 * parecer ativo e sumir de uma lista de acompanhamento; mentir lá seria não
 * pagar. Um é sinal de saúde, o outro é cláusula.
 *
 * ── ENGOLE O ERRO, PELO MESMO MOTIVO DO RELÓGIO
 * Isto roda no meio-fio, no gesto que liga o GPS. A rota não pode esperar nem
 * falhar por causa de um campo de acompanhamento.
 */
export async function registrarRota(uid) {
  if (!uid) return false;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;

    const agora = new Date();
    const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    const atual = snap.data()?.rotasNoMes;

    await updateDoc(ref, {
      ultimaRota: serverTimestamp(),
      // Mês diferente: começa do 1 em vez de somar ao mês passado.
      rotasNoMes:
        atual?.mes === mes ? { mes, total: increment(1) } : { mes, total: 1 },
    });
    return true;
  } catch (err) {
    console.error('[uso] não deu pra registrar a rota:', err);
    return false;
  }
}
