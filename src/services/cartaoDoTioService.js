import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * O CARTÃO DO TIO, PARA CONHECER (05/10/2026) — a página pública
 * `/conheca/<uid>` lê a marca e o WhatsApp do tio pela callable pública
 * `verCartaoDoTio` (functions/lib/cartaoDoTio.js). Quem abre não tem conta,
 * e as rules não deixam um anônimo ler `users`: o servidor devolve uma lista
 * fechada de seis campos e mais nada.
 *
 * ⚠️ UMA FRASE SÓ PARA TODA RECUSA, e ela vem pronta do servidor: uid
 * inventado, família, conta suspensa e tio sem marca respondem a mesma
 * coisa — diferenciar contaria a quem está sondando que o uid existe.
 */
export const FRASE_DO_CARTAO_QUE_NAO_VALE = 'Este cartão não vale mais.';

export async function verCartaoDoTio(uid) {
  try {
    // Dentro do try: sem as functions, a página diz a frase em vez de girar.
    exigirCloud('abrir o cartão do motorista');
    const { data } = await httpsCallable(functions, 'verCartaoDoTio')({ uid });
    return data?.vale ? data : { vale: false, frase: data?.frase || FRASE_DO_CARTAO_QUE_NAO_VALE };
  } catch (err) {
    console.warn('verCartaoDoTio falhou:', err);
    return { vale: false, frase: FRASE_DO_CARTAO_QUE_NAO_VALE, falhou: true };
  }
}
