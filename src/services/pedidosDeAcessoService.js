import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * O PEDIDO DE ACESSO SEM LINK (02/10/2026) — `pedidosDeVinculo`.
 *
 * Quem chega sem o link informa o WhatsApp; se o número está numa criança
 * sem responsável, o motorista dela recebe um pedido e aprova com um toque.
 * O número sozinho não vincula nada — telefone não é segredo, e quem
 * conhece a família é o motorista. Tudo que escreve é callable
 * (`functions/lib/pedidosDeAcesso.js`); daqui só se lê.
 */

/**
 * A pessoa informa o WhatsApp. Devolve `{ ok: true }` — SEMPRE o mesmo, ache
 * ou não criança com o número (03/10/2026): a resposta não pode servir de
 * consulta de quais telefones estão cadastrados. Ver `pedidosDeAcesso.js`.
 */
export async function pedirAcessoPeloTelefone({ telefone, nome = '' }) {
  exigirCloud('pedir o acesso');
  try {
    const res = await httpsCallable(functions, 'pedirAcessoPeloTelefone')({ telefone, nome });
    return res.data || { ok: true };
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'pedir o acesso'), { cause: err });
  }
}

/** O motorista aprova ou diz "não conheço". */
export async function responderPedidoDeAcesso(pedidoId, aprovar) {
  exigirCloud('responder o pedido');
  try {
    await httpsCallable(functions, 'responderPedidoDeAcesso')({ pedidoId, aprovar });
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'responder o pedido'), { cause: err });
  }
}

function assistir(campo, uid, onUpdate) {
  if (!uid) return () => {};
  return onSnapshot(
    query(collection(db, 'pedidosDeVinculo'), where(campo, '==', uid)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('pedidosDeVinculo:', err);
      onUpdate([]);
    }
  );
}

/** Os pedidos DELA — para o card de "aguardando" saber em que pé está. */
export const watchPedidosDoResponsavel = (uid, onUpdate) =>
  assistir('parentUid', uid, onUpdate);

/** Os pedidos das crianças DELE. As rules recusam a consulta sem o escopo. */
export const watchPedidosDoMotorista = (uid, onUpdate) =>
  assistir('adminUid', uid, onUpdate);
