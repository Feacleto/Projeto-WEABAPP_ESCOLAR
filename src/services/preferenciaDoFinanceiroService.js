import { preferenciaValida } from '../dominio/identidade/trancaDoFinanceiro.js';

/**
 * "PEDIR A SENHA" É ESCOLHA DO APARELHO, NÃO DA CONTA (03/10/2026).
 *
 * O celular que fica no painel da perua e o tablet de casa pedem coisas
 * diferentes, e quem empresta um aparelho decide por aquele aparelho. Por
 * isso mora no `localStorage` (`alobuzinou:financeiro:pedirSenha`), não em
 * `users` — e não viaja para outra sessão.
 *
 * Sem leitura (janela anônima, site bloqueado), vale 'sempre': o erro barato
 * é pedir a senha uma vez a mais. A régua de quanto tempo cada escolha deixa
 * passar é `dominio/identidade/trancaDoFinanceiro.js`.
 */
const CHAVE = 'alobuzinou:financeiro:pedirSenha';

export function lerPedirSenha() {
  try {
    return preferenciaValida(window.localStorage.getItem(CHAVE));
  } catch {
    return preferenciaValida(null);
  }
}

export function gravarPedirSenha(valor) {
  const v = preferenciaValida(valor);
  try {
    window.localStorage.setItem(CHAVE, v);
  } catch {
    // Sem armazenamento a escolha vale só nesta aba — a tela já a mostra.
  }
  return v;
}
