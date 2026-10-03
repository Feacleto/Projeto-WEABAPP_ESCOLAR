/**
 * O TECLADO DE BANCO DO FINANCEIRO (03/10/2026).
 *
 * Cinco botões, cada um com dois números ("1 ou 7"), embaralhados a cada vez
 * que o teclado aparece e depois de cada erro. Quem olha por cima do ombro vê
 * o botão tocado, não o número — e o celular manda ao servidor os PARES, nunca
 * a senha: quem confere é `functions/lib/reguaDaSenhaDoFinanceiro.js`, o
 * espelho desta régua (`npm run testar:senha-financeiro` compara os dois).
 *
 * A senha tem 4 números (decisão do dono). Puro de propósito: sem Firebase,
 * sem React, e o sorteio entra por parâmetro para o teste ser reproduzível.
 */

export const DIGITOS_DA_SENHA = 4;

/** Quatro números, nada mais. */
export function formatoValido(senha) {
  return typeof senha === 'string' && /^\d{4}$/.test(senha);
}

/**
 * Senha que qualquer um tenta primeiro: tudo igual (1111) ou sequência
 * (1234, 4321, 0123). Recusada na criação, nunca na conferência.
 */
export function senhaFacil(senha) {
  if (!formatoValido(senha)) return true;
  if (/^(\d)\1{3}$/.test(senha)) return true;
  return '0123456789'.includes(senha) || '9876543210'.includes(senha);
}

/**
 * Os cinco pares do teclado, cada um em ordem crescente. `aleatorio` é uma
 * função que devolve [0, 1) — `Math.random` na tela, uma semente no teste.
 */
export function embaralharPares(aleatorio = Math.random) {
  const n = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = n.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [n[i], n[j]] = [n[j], n[i]];
  }
  const pares = [];
  for (let k = 0; k < 10; k += 2) {
    pares.push([Math.min(n[k], n[k + 1]), Math.max(n[k], n[k + 1])]);
  }
  return pares;
}

/** Um par é dois números diferentes de 0 a 9. */
export function parValido(par) {
  return (
    Array.isArray(par) &&
    par.length === 2 &&
    par.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) &&
    par[0] !== par[1]
  );
}

/**
 * A senha bate com os botões tocados? Cada número da senha precisa estar no
 * par tocado naquela posição. Entrada malformada é sempre `false`.
 */
export function conferePares(senha, pares) {
  if (!formatoValido(senha)) return false;
  if (!Array.isArray(pares) || pares.length !== DIGITOS_DA_SENHA) return false;
  if (!pares.every(parValido)) return false;
  return pares.every((par, i) => par.includes(Number(senha[i])));
}
