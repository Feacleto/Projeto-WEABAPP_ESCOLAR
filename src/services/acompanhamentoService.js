import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * O LINK DO DIA — quem vai pegar a criança acompanha a entrega, sem conta.
 *
 * As duas pontas moram em `functions/lib/acompanhamento.js`, e o motivo de o
 * servidor decidir tudo está lá: o que essa pessoa pode ver não é um
 * documento, é meia dúzia de campos de três documentos diferentes. Rules
 * sabem dizer "pode ler `children/x`"; elas não sabem dizer "pode ler o
 * primeiro nome e mais nada".
 *
 * ⚠️ O TOKEN NUNCA É GUARDADO EM LUGAR NENHUM DO CLIENTE. Ele existe uma vez
 * — na resposta da callable — e vai direto pra mensagem do WhatsApp. Guardar
 * em estado, em `localStorage` ou em log seria multiplicar por N as cópias de
 * uma credencial que a gente acabou de tomar o cuidado de não gravar nem no
 * banco (lá só mora o hash dele).
 */

/** A URL que a pessoa abre. Mesmo formato do `inviteUrl`, e pelo mesmo motivo. */
export function urlDoAcompanhamento(token) {
  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origem}/acompanhar/${token}`;
}

/**
 * Gera (ou ROTACIONA) o link de hoje para a criança.
 *
 * Chamar de novo derruba o link anterior: o servidor troca o hash guardado na
 * indicação do dia. É a rotação, e ela é o que sobra de revogação quando a
 * pessoa do outro lado não tem nome — junto com o "Trocar", que apaga a
 * indicação inteira.
 */
export async function gerarAcessoDoDia(childId) {
  exigirCloud('criar o link de acompanhamento');
  const fn = httpsCallable(functions, 'gerarAcessoDoDia');
  try {
    const res = await fn({ childId });
    return urlDoAcompanhamento(res.data.token);
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('failed-precondition')) {
      throw new Error('Indique primeiro quem vai pegar a criança hoje.', { cause: err });
    }
    if (c.includes('permission-denied')) {
      throw new Error('Esta criança não é da sua conta.', { cause: err });
    }
    throw new Error('Não deu pra criar o link. Tente de novo.', { cause: err });
  }
}

/**
 * Lê o acompanhamento a partir do token da URL.
 *
 * ⚠️ UMA MENSAGEM SÓ PARA TODA RECUSA, e ela vem pronta do servidor. Link de
 * ontem, indicação removida e token inventado respondem a mesma coisa —
 * diferenciar contaria a quem está sondando que o endereço existe.
 */
export async function verAcompanhamento(token) {
  exigirCloud('abrir o acompanhamento');
  const fn = httpsCallable(functions, 'verAcompanhamento');
  try {
    const res = await fn({ token });
    return res.data;
  } catch (err) {
    throw new Error(
      'Este link não vale mais. Peça um novo a quem te mandou.',
      { cause: err }
    );
  }
}

/**
 * O ACESSO DE 24 HORAS quer os avisos no celular (03/10/2026): o aparelho de
 * quem NÃO tem conta entra no acesso, por callable pública — quem prova o
 * direito é o token do link. Para quando o acesso acaba.
 */
export async function inscreverAvisosDoAcesso(token, fcmToken) {
  exigirCloud('ligar os avisos');
  await httpsCallable(functions, 'inscreverAvisosDoAcesso')({ token, fcmToken });
}

/**
 * A AVALIAÇÃO RÁPIDA DE QUEM ABRIU O LINK (03/10/2026). Uma por link, e só
 * depois da entrega — quem decide é o servidor (`reguaDaAvaliacao.js`).
 */
export async function avaliarAcompanhamento(token, { nota, comentario }) {
  exigirCloud('enviar a avaliação');
  try {
    await httpsCallable(functions, 'avaliarAcompanhamento')({ token, nota, comentario });
  } catch (err) {
    // Já avaliou por este link: para quem está na tela, deu certo.
    if (String(err?.code || '').includes('already-exists')) return;
    throw new Error('Não deu para enviar agora. Tente de novo.', { cause: err });
  }
}
