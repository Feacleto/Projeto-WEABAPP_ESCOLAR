import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * A ROLETA — o prêmio que o motorista sorteia AO CONTRATAR.
 *
 * Ela era de entrada (`entryBonusService`), e girava no primeiro acesso para
 * ele usar o app antes de existir cobrança. Esse papel virou do teste de três
 * meses em 06/09/2026; empilhar as duas coisas custava até cinco meses e meio
 * sem receita por associado e comprava o que o teste já comprava.
 *
 * ── A REGRA QUE A TELA PRECISA RESPEITAR
 * Quem sorteia é o servidor. Este módulo NÃO tem função que gere número, e é
 * de propósito: se existisse, alguém a usaria para "prever" o resultado e
 * adiantar a animação, e o número da tela deixaria de ser o número gravado.
 *
 * A ordem certa é:
 *   1. o motorista toca em girar
 *   2. `girarPremio()` volta com o resultado JÁ REGISTRADO E JÁ APLICADO
 *   3. a animação gira e para NAQUELE valor
 *
 * A animação pode durar o que a arte pedir — ela encena um resultado que já
 * existe. O que não pode é a tela decidir onde parar e contar depois.
 *
 * ── SE A CONEXÃO CAIR NO MEIO
 * O prêmio é gravado e aplicado na mesma transação, antes de a resposta sair.
 * Uma falha de rede depois disso não perde nada: chamar de novo devolve o
 * MESMO prêmio, com `novo: false`. Não existe caminho em que ele gire duas
 * vezes e fique com o maior, nem em que gire e perca o que tirou.
 */

/**
 * Gira (ou relê, se já girou).
 *
 * Volta `{ premioId, meses, fracao, novo, premios }`. Dois prêmios são meses
 * sem fatura (`meses`, sem `fracao`) e dois são desconto pelos 12 meses do
 * contrato (`fracao` + `meses` de validade).
 *
 * `novo: false` significa "esta conta já tinha girado" — a tela deve MOSTRAR o
 * resultado guardado em vez de animar como se fosse a primeira vez. Animar de
 * novo dá a impressão de um segundo sorteio que não aconteceu.
 *
 * Recusa quem ainda não contratou: é prêmio de conversão, não de entrada.
 */
export async function girarPremio() {
  exigirCloud('girar a roleta');
  const fn = httpsCallable(functions, 'girarPremio');
  const { data } = await fn();
  return data;
}

/**
 * Lê o que esta conta já tirou, SEM girar. Volta `null` se ainda não girou.
 *
 * Existe para a tela mostrar o prêmio numa visita seguinte sem chamar a
 * callable — leitura direta do documento, que as rules liberam para o dono
 * dele. Chamar `girarPremio()` só para descobrir o valor também funcionaria,
 * mas gastaria uma invocação de função para ler o que o cliente lê sozinho.
 */
export async function meuPremio() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'premios', uid));
  if (!snap.exists()) return null;

  const d = snap.data();
  return {
    premioId: d.premioId || null,
    meses: d.meses ?? null,
    fracao: d.fracao ?? null,
    giradoEm: d.giradoEm?.toDate?.() || null,
  };
}
