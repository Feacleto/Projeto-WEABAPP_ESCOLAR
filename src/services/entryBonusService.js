import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';

/**
 * A roleta de entrada — os meses sem taxa que o motorista sorteia ao começar.
 *
 * A REGRA QUE A TELA PRECISA RESPEITAR
 * Quem sorteia é o servidor. Este módulo NÃO tem função que gere número, e
 * isso é de propósito: se existisse, alguém a usaria pra "prever" o resultado
 * e adiantar a animação, e o número da tela deixaria de ser o número gravado.
 *
 * A ordem certa na tela é:
 *   1. o usuário toca em girar
 *   2. `spinEntryBonus()` volta com o resultado JÁ REGISTRADO no servidor
 *   3. a animação gira e para NAQUELE valor
 *
 * A animação pode durar o que a arte pedir — ela encena um resultado que já
 * existe. O que não pode é a tela decidir onde parar e contar depois.
 *
 * SE A CONEXÃO CAIR NO MEIO
 * O prêmio está gravado antes de a resposta sair, então uma falha de rede
 * depois do sorteio não perde nada: `spinEntryBonus()` chamado de novo volta o
 * MESMO valor, com `novo: false`. Não existe caminho em que o motorista gire
 * duas vezes e fique com o maior — e não existe caminho em que ele gire, a rede
 * caia, e ele perca o que tirou.
 */

/**
 * Gira (ou relê, se já girou). Volta `{ meses, novo, premios }`.
 *
 * `novo: false` significa "esta conta já tinha girado" — nesse caso a tela deve
 * MOSTRAR o resultado guardado em vez de animar como se fosse a primeira vez.
 * Animar de novo dá a impressão de um segundo sorteio que não aconteceu.
 */
export async function spinEntryBonus() {
  const fn = httpsCallable(functions, 'spinEntryBonus');
  const { data } = await fn();
  return data;
}

/**
 * Lê o que esta conta já tirou, SEM girar. Volta `null` se ainda não girou.
 *
 * Existe pra a tela poder mostrar "você tem 3 meses sem taxa" numa visita
 * seguinte sem chamar a callable — leitura direta do documento, que as rules
 * liberam pro dono. Chamar `spinEntryBonus()` só pra descobrir o valor também
 * funcionaria, mas gastaria uma invocação de função pra ler o que o cliente
 * consegue ler sozinho.
 */
export async function getMyEntryBonus() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'entryBonuses', uid));
  if (!snap.exists()) return null;

  const d = snap.data();
  return {
    meses: d.meses,
    spunAt: d.spunAt?.toDate?.() || null,
    aplicadoDe: d.aplicadoDe || null,
    aplicadoAte: d.aplicadoAte || null,
  };
}
