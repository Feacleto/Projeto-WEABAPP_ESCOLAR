import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * O ACESSO DE 24 HORAS DO SEGUNDO RESPONSÁVEL (03/10/2026).
 *
 * Não é uma conta: é um link que vale 24 horas, mandado pelo WhatsApp ao
 * número do segundo responsável. Quem gera é a titular ou o motorista; quem
 * decide o que ele vê é o servidor (`functions/lib/reguaDoAcessoTemporario.js`):
 * o dia da criança na perua e os avisos da rota — nunca endereço, telefone,
 * mensalidade ou contrato. Passadas as 24 horas, o link para e os avisos
 * também, sem ninguém precisar lembrar de desligar.
 */

/** Gera (ou troca) o link. Devolve `{ link, expiraEm }`. */
export async function gerarAcessoTemporario(childId) {
  exigirCloud('mandar o acesso de 24 horas');
  try {
    const { data } = await httpsCallable(functions, 'gerarAcessoTemporario')({ childId });
    return { link: `${window.location.origin}/acompanhar/${data.token}`, expiraEm: data.expiraEm };
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'mandar o acesso de 24 horas'), { cause: err });
  }
}

/** Encerra antes da hora: o link para de abrir e os avisos param. */
export async function encerrarAcessoTemporario(childId) {
  exigirCloud('encerrar o acesso');
  try {
    await httpsCallable(functions, 'encerrarAcessoTemporario')({ childId });
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'encerrar o acesso'), { cause: err });
  }
}

/**
 * O acesso aberto desta criança, ou `null`. As rules só deixam ler a titular
 * e o motorista — e exigem que a CONSULTA prove isso, por isso o filtro pelo
 * campo do papel de quem lê.
 */
export function watchAcessoTemporario({ childId, uid, papel }, onUpdate) {
  if (!childId || !uid) {
    onUpdate(null);
    return () => {};
  }
  const campo = papel === 'admin' ? 'adminUid' : 'parentUid';
  const q = query(
    collection(db, 'acessosTemporarios'),
    where(campo, '==', uid),
    where('childId', '==', childId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const agora = Date.now();
      const aberto = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => !a.revogadoEm && a.expiraEm?.toMillis?.() > agora)
        .sort((a, b) => b.expiraEm.toMillis() - a.expiraEm.toMillis())[0];
      onUpdate(aberto || null);
    },
    (err) => {
      console.error('watchAcessoTemporario:', err);
      onUpdate(null);
    }
  );
}

/**
 * A titular cadastra (ou corrige) o segundo responsável. Antes só o motorista
 * podia, e quem conhece o pai separado ou a avó é a família.
 */
export async function salvarSegundoResponsavel(childId, { nome, telefone }) {
  await updateDoc(doc(db, 'children', childId), {
    parent2Name: String(nome || '').trim().slice(0, 80),
    parent2Phone: String(telefone || '').replace(/\D/g, '').slice(0, 13),
  });
}
