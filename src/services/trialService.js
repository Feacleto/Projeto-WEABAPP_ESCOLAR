import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * LIGAR O RELÓGIO DOS TRÊS MESES — uma escrita, uma vez na vida da conta.
 *
 * O QUE ESTE MÓDULO FAZ, E O QUE ELE NÃO FAZ
 * Ele grava `users/{uid}.trialInicio` no instante em que o motorista inicia a
 * PRIMEIRA rota. Só isso. Quanto tempo falta, qual aviso mostrar e se a conta
 * expirou são conta pura, e moram em `dominio/associacao/trial.js` — que não
 * importa Firebase nenhum e por isso é testável (`npm run testar:trial`).
 *
 * POR QUE A PRIMEIRA ROTA E NÃO O CADASTRO
 * Motorista escolar tem calendário. Ele conhece o app em dezembro, entra em
 * férias e volta a operar em fevereiro — contando do cadastro, chegaria em
 * fevereiro com três semanas de teste, e a primeira experiência real dele com
 * o produto seria a tela de cobrança. A rota é o momento em que o app começa
 * a entregar: antes dela não há posição no mapa nem aviso de chegada.
 *
 * A TRAVA DE VERDADE MORA NAS RULES, NÃO AQUI
 * `firestore.rules` só aceita `trialInicio` quando o campo AINDA NÃO EXISTE.
 * A checagem daqui é economia de escrita, não segurança: quem chamar isto com
 * o campo já gravado é recusado pelo servidor de qualquer jeito. Confiar na
 * checagem do cliente seria o motorista reiniciar o próprio teste para sempre
 * pelo devtools — a mesma armadilha de `limiteCriancas`.
 *
 * POR QUE ELE ENGOLE O ERRO
 * Esta função é chamada no meio-fio, no mesmo gesto que liga o GPS, às vezes
 * sem sinal. Se a escrita falhar, o que NÃO pode acontecer é a rota não
 * começar: vinte famílias estão esperando a perua, e o relógio do teste é
 * problema da plataforma, não delas. A próxima rota tenta de novo, e o custo
 * de errar é o motorista ganhar um dia a mais de teste.
 *
 * `serverTimestamp()` e não `new Date()`: a data de vencimento da conta não
 * pode sair do relógio do celular de quem é cobrado por ela.
 */
// ⚠️ ESTE NÃO É O ÚNICO GATILHO, desde 06/09/2026.
//
// A rota é o gatilho do CLIENTE, e tem que ser: o GPS liga no meio-fio, às
// vezes sem sinal, e esperar cold start com o passageiro na porta é a
// regressão que a decisão 2 recusou.
//
// Os outros dois moram no servidor (`functions/lib/relogioDoTeste.js`) e são
// disparados pelo primeiro responsável entrando e pela primeira mensalidade
// gerada. Sem eles havia um buraco de graça ilimitada: o app tem duas metades,
// e dava para usar a da cobrança para sempre sem nunca tocar em "iniciar
// rota".
//
// A guarda é a mesma nos três: só grava se o campo não existe.
export async function ligarRelogioDoTrial(uid) {
  if (!uid) return false;
  // O SINAL DE USO VAI JUNTO, e no mesmo gesto — ver `registrarRota` abaixo.
  registrarRota(uid);
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    // Sem documento não há o que atualizar, e criar aqui seria criar conta
    // por um caminho que não é o de criar conta.
    if (!snap.exists()) return false;
    if (snap.data()?.trialInicio) return false;

    await updateDoc(ref, { trialInicio: serverTimestamp() });
    return true;
  } catch (err) {
    console.error('[trial] Falha ao ligar o relógio do teste:', err);
    return false;
  }
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
 * ao contrário de `trialInicio`, `limiteCriancas` e `assinaturaAte`, que estão
 * na lista proibida. A diferença é o que está em jogo: mentir aqui faz ele
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
