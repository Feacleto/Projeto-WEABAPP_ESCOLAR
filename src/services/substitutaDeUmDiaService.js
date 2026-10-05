import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * A SUBSTITUTA DE UM DIA — o caminho até o servidor (F3, 05/10/2026). A régua
 * e o porquê estão em `functions/lib/reguaDaSubstitutaDeUmDia.js`.
 *
 * O tio LÊ os acessos dele (`acessosDeSubstituta`, só leitura pelas rules) e
 * gera/encerra por callable. A substituta não tem conta: a página pública lê
 * por `verRotaDaSubstituta`, como a página de acompanhar.
 *
 * ⚠️ O TOKEN NÃO É GUARDADO EM LUGAR NENHUM DO APARELHO DO TIO. Ele existe uma
 * vez, na resposta de `gerar`, e vai direto para a mensagem do WhatsApp — o
 * banco guarda só o hash dele.
 */

/** A URL que a substituta abre. */
export function urlDaSubstituta(token) {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/substituta/${token}`;
}

/**
 * Lembra NESTE aparelho que hoje há um link aberto — é o que deixa o
 * "Encerrar a rota" perguntar ao servidor só quando faz sentido, em vez de
 * acordar uma função a cada rota de cada tio. Só a DATA é guardada.
 */
const CHAVE_DO_DIA = 'alobuzinou:substituta-hoje';

function lembrarDoDia(dateKey) {
  try {
    localStorage.setItem(CHAVE_DO_DIA, dateKey);
  } catch {
    /* sem armazenamento: o servidor encerra pela leitura e pelo closeStaleRoutes */
  }
}

function temLinkHoje(dateKey) {
  try {
    return localStorage.getItem(CHAVE_DO_DIA) === dateKey;
  } catch {
    return false;
  }
}

/** Os acessos de HOJE do tio — a escuta estreita (duas igualdades, sem índice composto). */
export function watchAcessosDeHoje(motoristaUid, dateKey, onUpdate, onError) {
  if (!motoristaUid || !dateKey) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(
      collection(db, 'acessosDeSubstituta'),
      where('motoristaUid', '==', motoristaUid),
      where('dateKey', '==', dateKey)
    ),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchAcessosDeHoje:', err);
      onError?.(err);
    }
  );
}

/** Gera o link de hoje e devolve a URL. Gerar de novo encerra o anterior. */
export async function gerarAcessoDeSubstituta(substitutaId, dateKey) {
  exigirCloud('criar o link da substituta');
  try {
    const res = await httpsCallable(functions, 'gerarAcessoDeSubstituta')({ substitutaId });
    if (dateKey) lembrarDoDia(dateKey);
    return urlDaSubstituta(res.data.token);
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('failed-precondition')) throw new Error(err.message, { cause: err });
    if (c.includes('permission-denied')) {
      throw new Error('Esta substituta não está na sua lista.', { cause: err });
    }
    throw new Error('Não deu para criar o link. Tente de novo.', { cause: err });
  }
}

/** "Encerrar" — o link para de abrir na hora. */
export async function encerrarAcessoDeSubstituta(id) {
  exigirCloud('encerrar o link');
  try {
    await httpsCallable(functions, 'encerrarAcessoDeSubstituta')({ id });
  } catch (err) {
    throw new Error('Não deu para encerrar. Tente de novo.', { cause: err });
  }
}

/**
 * A rota acabou neste aparelho. Sem `await` de quem chama e sem erro na
 * tela: quem decide se o link morreu é o servidor, pela régua do fim do dia
 * (encerrar a IDA não mata o link de quem faz a volta).
 */
export function avisarFimDaRotaParaSubstituta(dateKey) {
  if (!dateKey || !temLinkHoje(dateKey)) return;
  try {
    exigirCloud('encerrar o link da substituta');
  } catch {
    return;
  }
  httpsCallable(functions, 'encerrarAcessoDeSubstituta')({ pelaRota: true }).catch((err) =>
    console.warn('substituta: fim da rota não avisado', err?.code)
  );
}

/**
 * A página pública lê por aqui. A recusa é uma frase só; quando o link era
 * de verdade e morreu, o servidor manda a marca do tio para a página dizer
 * com quem falar.
 */
export async function verRotaDaSubstituta(token) {
  exigirCloud('abrir a rota de hoje');
  try {
    const res = await httpsCallable(functions, 'verRotaDaSubstituta')({ token });
    return res.data;
  } catch (err) {
    const marca = err?.details?.marca || null;
    const e = new Error('Este link não vale mais.', { cause: err });
    e.marca = marca;
    e.limite = String(err?.code || '').includes('resource-exhausted');
    throw e;
  }
}
