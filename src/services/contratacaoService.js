import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * CONTRATAR O PLANO — a única escrita da cláusula de preço, e ela é do servidor.
 *
 * O cliente não grava `users.plano`: as rules recusam, porque é ele que a
 * fatura multiplica pela taxa. Cláusula que o devedor edita não é cláusula.
 *
 * Então este arquivo não escreve nada — ele PEDE. Quem grava é
 * `functions/lib/contratacao.js`, que também decide em que degrau da escada ele
 * está, olhando `trialInicio` pelo relógio do SERVIDOR. Relógio de cliente é a
 * coisa mais fácil de mudar num telefone, e desde que o desconto virou
 * VITALÍCIO ele não vale mais doze meses de conta — vale a conta inteira,
 * enquanto ele ficar.
 *
 * Devolve `{ plano, descontos, fechamento, degrau, fracao }`. `fechamento` diz
 * se o desconto foi travado AGORA — a tela precisa disso para contar à pessoa
 * na hora. Descobrir um desconto só na primeira fatura transforma um presente
 * em desconfiança.
 */
export async function contratarPlano(plano) {
  // `exigirCloud` vem ANTES do try: sem Blaze a API desativada responde sem
  // CORS, e o erro que chega na tela é "falha de rede" — quem usa troca de
  // rede, quem depura procura CORS, e o conserto é ligar o faturamento.
  exigirCloud('contratar o plano');
  try {
    const fn = httpsCallable(functions, 'contratarPlano');
    const { data } = await fn({ plano });
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'contratar o plano'), { cause: err });
  }
}
