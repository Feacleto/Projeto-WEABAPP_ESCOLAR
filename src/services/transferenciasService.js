import { collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';
import { estaAberta, idDoPedidoDaFamilia, pedidoDaFamilia } from '../dominio/identidade/transferencia.js';

/**
 * PASSAR A FAMÍLIA PARA OUTRO TIO (fase 2 da rede, 05/10/2026). Quem decide é
 * o servidor (`functions/lib/transferencias.js`); `transferenciasDeFamilia`
 * só é lida daqui, e as três consultas provam o filtro das rules: o tio de
 * agora pelo `deUid`, o parceiro pelo `paraUid`, e a família pelo
 * `familiaUid` E por `familiaVe == true` — antes de o parceiro aceitar, ela
 * não sabe de nada.
 */

const COLECAO = 'transferenciasDeFamilia';

async function chamar(nome, dados, oQue) {
  exigirCloud(oQue);
  try {
    const { data } = await httpsCallable(functions, nome)(dados);
    return data;
  } catch (err) {
    const e = new Error(mensagemDeErro(err, oQue), { cause: err });
    e.precisaAssinar = !!err?.details?.precisaAssinar;
    throw e;
  }
}

export const pedirTransferencia = (childId, parceiroUid) =>
  chamar('pedirTransferencia', { childId, parceiroUid }, 'pedir a passagem');
export const responderTransferencia = (id, aceito) =>
  chamar('responderTransferencia', { id, aceito }, 'responder o pedido');
export const cancelarTransferencia = (id) =>
  chamar('cancelarTransferencia', { id }, 'cancelar o pedido');
export const aceitarTransferencia = (id) =>
  chamar('aceitarTransferencia', { id }, 'aceitar a passagem');

function ouvir(q, cb) {
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

/** Os pedidos do tio de agora para uma criança (abertos e o último fechado). */
export function watchTransferenciasDaCrianca(deUid, childId, cb) {
  if (!deUid || !childId) return () => {};
  return ouvir(
    query(collection(db, COLECAO), where('deUid', '==', deUid), where('childId', '==', childId), limit(20)),
    cb
  );
}

/** Os pedidos que chegaram para o parceiro e ainda esperam a resposta dele. */
export function watchPedidosParaMim(paraUid, cb) {
  if (!paraUid) return () => {};
  return ouvir(
    query(collection(db, COLECAO), where('paraUid', '==', paraUid), where('estado', '==', 'pedido'), limit(20)),
    cb
  );
}

/** O que a família precisa aceitar (o parceiro já aceitou). */
export function watchTransferenciasDaFamilia(familiaUid, cb) {
  if (!familiaUid) return () => {};
  return ouvir(
    query(
      collection(db, COLECAO),
      where('familiaUid', '==', familiaUid),
      where('familiaVe', '==', true),
      limit(10)
    ),
    // O estado aberto se confere aqui (`estaAberta`, que também vê o prazo):
    // filtrar no banco pediria um índice composto a mais.
    (lista) => cb(lista.filter((t) => estaAberta(t)))
  );
}

/**
 * A família pede ao tio DELA para ser passada a outro tio. É um aviso no
 * sino dele (as rules já deixam a família avisar o motorista dela), um por
 * criança por mês: o segundo no mesmo mês é recusado (o aviso já existe e só
 * o dono da caixa mexe nele), e isso conta como "já pedido".
 */
export async function pedirParaPassarAOutroTio(child) {
  try {
    await setDoc(doc(db, 'notifications', idDoPedidoDaFamilia(child.id)), {
      userId: child.adminUid,
      childId: child.id,
      ...pedidoDaFamilia({ nomeCrianca: child.name }),
      read: false,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}
