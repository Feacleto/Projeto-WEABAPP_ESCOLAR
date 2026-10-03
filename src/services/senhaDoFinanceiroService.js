import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { exigirCloud, mensagemDeErro } from './callableError';

/**
 * A SENHA DO FINANCEIRO (03/10/2026).
 *
 * O celular nunca guarda nem lê a senha. Criar e conferir são callables, e a
 * senha mora em `senhasDoFinanceiro/{uid}`, que as rules fecham para TODO
 * cliente: o documento `users` do motorista é lido pelas famílias (chave PIX),
 * e 4 números se descobrem testando as 10 mil combinações. Na conferência
 * viajam os PARES tocados no teclado de banco, não a senha.
 *
 * ⚠️ É CORTINA, NÃO COFRE. A auxiliar usa o celular com a sessão do motorista,
 * e para o Firestore os dois são a mesma conta: a senha impede que ela VEJA o
 * Financeiro na tela, não que alguém com as ferramentas do navegador leia os
 * documentos. A separação de verdade é a conta própria da auxiliar.
 *
 * Que já existe uma senha se sabe por `configFinanceiro/{uid}.temSenha`,
 * gravado pelo servidor (ver configFinanceiroService).
 */

/**
 * Cria a senha (ou troca, no "esqueci a senha" — aí o servidor exige um login
 * recente, feito pela tela antes de chamar).
 */
export async function criarSenhaDoFinanceiro(senha) {
  exigirCloud('criar a senha do Financeiro');
  try {
    await httpsCallable(functions, 'criarSenhaDoFinanceiro')({ senha });
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'criar a senha do Financeiro'), { cause: err });
  }
}

/**
 * Confere os quatro pares tocados. Devolve `{ ok: true }` ou
 * `{ ok: false, restam }`. Passou do limite de tentativas, lança com a
 * mensagem de esperar.
 */
export async function conferirSenhaDoFinanceiro(pares) {
  exigirCloud('abrir o Financeiro');
  try {
    const { data } = await httpsCallable(functions, 'conferirSenhaDoFinanceiro')({ pares });
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'abrir o Financeiro'), { cause: err });
  }
}
