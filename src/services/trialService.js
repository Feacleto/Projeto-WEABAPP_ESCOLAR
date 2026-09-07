import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
