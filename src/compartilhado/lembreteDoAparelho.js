/**
 * "JÁ FIZ ISSO NESTE APARELHO" — uma marca de uma palavra no armazenamento do
 * navegador, para o que só precisa ser dito UMA vez ao tio.
 *
 * ⚠️ A MEMÓRIA É DO APARELHO, E ISSO BASTA: o pior caso é ele ler uma frase de
 * novo num celular novo. Leitura e escrita vão em try/catch — modo anônimo,
 * cota cheia ou armazenamento bloqueado não podem derrubar a tela; sem memória,
 * a explicação simplesmente aparece de novo. Mesmo padrão do `InstallPrompt`.
 *
 * Sem regra de negócio de propósito (vive em `compartilhado/`).
 */
export function jaLembrou(chave) {
  try {
    return window.localStorage.getItem(chave) === '1';
  } catch {
    return false;
  }
}

export function lembrar(chave) {
  try {
    window.localStorage.setItem(chave, '1');
  } catch {
    // sem armazenamento: a marca não fica, e nada além disso se perde
  }
}
