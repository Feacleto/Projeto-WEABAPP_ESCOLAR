import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * A CONTA DA AUXILIAR — o caminho do app até o servidor (05/10/2026).
 *
 * Convidar, aceitar e desativar são callables (`functions/lib/auxiliares.js`):
 * o cliente não escreve `role` nem o vínculo. Aqui só se chama o servidor e se
 * escuta o vínculo, que as rules deixam ler: ela os dela, o motorista os dele.
 *
 * O vínculo é por PAR — `auxiliares/{motoristaUid}_{auxiliarUid}` — e as
 * duas escutas são consultas por campo (`motoristaUid` ou `auxiliarUid`), não
 * leitura pelo id: ele vê todas as que já trabalharam com ele, ela vê os tios
 * dela (até dois ativos, e os que já encerraram).
 */

function chamar(nome) {
  exigirCloud();
  return httpsCallable(functions, nome);
}

export async function convidarAuxiliar({ nome, telefone, valorMensal = null }) {
  const { data } = await chamar('convidarAuxiliar')({ nome, telefone, valorMensal });
  return data?.codigo;
}

export async function cancelarConviteDeAuxiliar(codigo) {
  await chamar('cancelarConviteDeAuxiliar')({ codigo });
}

export async function verConviteDeAuxiliar(codigo) {
  const { data } = await chamar('verConviteDeAuxiliar')({ codigo });
  return data;
}

export async function aceitarConviteDeAuxiliar({ codigo, acceptedLegalVersion }) {
  const { data } = await chamar('aceitarConviteDeAuxiliar')({ codigo, acceptedLegalVersion });
  return data;
}

export async function desativarAuxiliar(auxiliarUid) {
  await chamar('desativarAuxiliar')({ auxiliarUid });
}

/**
 * A conta de e-mail da auxiliar. Se o e-mail já tem conta, entra nela — quem
 * abre o link duas vezes não pode receber "este e-mail já existe" no meio do
 * convite.
 */
export async function contaDeEmailDaAuxiliar(email, senha) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    return cred.user;
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      return cred.user;
    }
    throw err;
  }
}

/** As auxiliares do motorista — as ativas e as que já saíram (o histórico). */
export function watchAuxiliaresDoMotorista(motoristaUid, onUpdate, onError) {
  if (!motoristaUid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'auxiliares'), where('motoristaUid', '==', motoristaUid)),
    // `uid` é o DELA: o id do documento é o do par.
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data(), uid: d.data().auxiliarUid }))),
    (err) => {
      console.error('watchAuxiliaresDoMotorista:', err);
      onError?.(err);
    }
  );
}

/**
 * Os vínculos da própria auxiliar — um por tio, os ativos e os encerrados.
 * Os encerrados ficam porque os pagamentos dizem de qual perua vieram.
 */
export function watchMeusVinculos(auxUid, onUpdate, onError) {
  if (!auxUid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'auxiliares'), where('auxiliarUid', '==', auxUid)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchMeusVinculos:', err);
      onError?.(err);
    }
  );
}

/**
 * A TURMA DELA (fase 2): a cópia sem valor que o servidor mantém em
 * `turmaDaAuxiliar/{motoristaUid}` — as crianças e as faltas do dia. Só a
 * auxiliar ATIVA daquele motorista lê (rules).
 */
export function watchTurmaDaAuxiliar(motoristaUid, onUpdate, onError) {
  if (!motoristaUid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'turmaDaAuxiliar', motoristaUid, 'criancas'),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchTurmaDaAuxiliar:', err);
      onError?.(err);
    }
  );
}

export function watchFaltasDaAuxiliar(motoristaUid, dateKey, onUpdate, onError) {
  if (!motoristaUid || !dateKey) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'turmaDaAuxiliar', motoristaUid, 'faltas'), where('dateKey', '==', dateKey)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchFaltasDaAuxiliar:', err);
      onError?.(err);
    }
  );
}

/**
 * A AUXILIAR MARCA NA ROTA (fase 3): EMBARQUEI / ENTREGUEI pelo servidor —
 * ela não escreve em `children`. Só para a frente; desfazer é do motorista.
 */
export async function marcarParadaPelaAuxiliar(childId, proximo, motoristaUid) {
  // Com dois tios, o servidor confere o vínculo DAQUELE par.
  const { data } = await chamar('marcarParadaPelaAuxiliar')({ childId, proximo, motoristaUid });
  return data;
}

/**
 * O PAGAMENTO DA AUXILIAR (fase 4, 05/10/2026) — o recibo dos dois em
 * `pagamentosDaAuxiliar`. Escrever é do servidor: ele ANOTA (e nasce a
 * despesa do caixa dele), ela CONFIRMA. Aqui só se chama e se escuta.
 *
 * As consultas têm UM campo só (sem `orderBy`), então não pedem índice
 * composto; a ordem por mês é feita na tela.
 */
export async function anotarPagamentoDaAuxiliar({ auxiliarUid, mes, valor }) {
  const { data } = await chamar('anotarPagamentoDaAuxiliar')({ auxiliarUid, mes, valor });
  return data;
}

export async function confirmarRecebimentoDaAuxiliar(id) {
  const { data } = await chamar('confirmarRecebimentoDaAuxiliar')({ id });
  return data;
}

function watchPagamentos(campo, uid, onUpdate, onError) {
  if (!uid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'pagamentosDaAuxiliar'), where(campo, '==', uid)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchPagamentosDaAuxiliar:', err);
      onError?.(err);
    }
  );
}

/** Os recibos que o motorista anotou (de todas as auxiliares dele). */
export function watchPagamentosDoMotorista(motoristaUid, onUpdate, onError) {
  return watchPagamentos('motoristaUid', motoristaUid, onUpdate, onError);
}

/** Os recibos da própria auxiliar — continuam depois de desativada. */
export function watchMeusPagamentosDeAuxiliar(auxUid, onUpdate, onError) {
  return watchPagamentos('auxiliarUid', auxUid, onUpdate, onError);
}
