import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * CONTRATAR A FAIXA — a única escrita da cláusula de preço, e ela é do servidor.
 *
 * O cliente não grava `planoId` nem `limiteCriancas`: as rules recusam os dois,
 * porque um é o que a fatura cobra e o outro é o que elas mesmas cobram a cada
 * criança cadastrada. Cláusula que o devedor edita não é cláusula.
 *
 * Então este arquivo não escreve nada — ele PEDE. Quem grava é
 * `functions/lib/contratacao.js`, que também decide se o desconto de
 * antecipação ainda vale, olhando `trialInicio` pelo relógio do SERVIDOR.
 * Relógio de cliente é a coisa mais fácil de mudar num telefone, e aqui ele
 * valeria metade da conta por doze meses.
 *
 * Devolve `{ planoId, limiteCriancas, descontos, antecipacao }`. O último diz
 * se o desconto foi concedido AGORA — a tela precisa disso para contar à
 * pessoa na hora. Descobrir um desconto só na primeira fatura transforma um
 * presente em desconfiança.
 */
export async function contratarPlano(planoId) {
  // `exigirCloud` vem ANTES do try: sem Blaze a API desativada responde sem
  // CORS, e o erro que chega na tela é "falha de rede" — quem usa troca de
  // rede, quem depura procura CORS, e o conserto é ligar o faturamento.
  exigirCloud('contratar a faixa');
  try {
    const fn = httpsCallable(functions, 'contratarPlano');
    const { data } = await fn({ planoId });
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'contratar a faixa'), { cause: err });
  }
}
