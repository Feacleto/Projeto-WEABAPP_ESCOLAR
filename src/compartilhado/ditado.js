/**
 * O TEXTO QUE VEIO DA VOZ (04/10/2026, pedido do dono).
 *
 * O motorista prefere falar a escrever, e cadastro é onde ele mais escreve:
 * se a tela parece pedir muito texto, ele desiste. O microfone na tela existe
 * porque muita gente não sabe (ou não lembra) que o teclado do celular já tem
 * um — principalmente no iPhone.
 *
 * O reconhecimento devolve o que entendeu do jeito que entendeu: "maria da
 * silva", "onze nove nove oito sete...", "ele chega mais tarde hoje". Estas
 * funções põem o texto na forma do campo antes de ele chegar na tela:
 *
 *   - NOME: iniciais maiúsculas, mas "da", "de", "do", "dos", "das" e "e"
 *     minúsculos ("Maria da Silva", não "Maria Da Silva");
 *   - TELEFONE: só os números — a máscara do campo faz o resto;
 *   - TEXTO: primeira letra maiúscula, espaços limpos.
 *
 * E `juntarTexto` serve aos campos longos (recado, aviso): o que ele fala SE
 * SOMA ao que já estava escrito, em vez de apagar — ele dita uma frase, para,
 * pensa e dita a próxima.
 *
 * Sem DOM e sem React: só texto. `npm run testar:ditado`.
 */

export const TIPOS_DE_DITADO = ['texto', 'nome', 'telefone'];

const MINUSCULAS_NO_NOME = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

function limpar(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

/** "maria DA silva" → "Maria da Silva". */
export function nomeProprio(texto) {
  return limpar(texto)
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .filter(Boolean)
    .map((parte, i) =>
      i > 0 && MINUSCULAS_NO_NOME.has(parte)
        ? parte
        : parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1)
    )
    .join(' ');
}

/** "11 98765-4321" → "11987654321": só os dígitos; a máscara do campo formata. */
export function soDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

/** "ele chega mais tarde" → "Ele chega mais tarde". */
export function frase(texto) {
  const t = limpar(texto);
  return t ? t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1) : '';
}

/** O texto ditado, na forma do campo. Tipo desconhecido vale como texto. */
export function textoDitado(bruto, tipo = 'texto') {
  if (tipo === 'nome') return nomeProprio(bruto);
  if (tipo === 'telefone') return soDigitos(bruto);
  return frase(bruto);
}

/**
 * Junta o que foi ditado ao que já estava escrito, num campo longo.
 * Se o anterior não termina com pontuação, entra um ponto antes — duas
 * frases ditas em sequência não podem virar uma só sem pausa.
 */
export function juntarTexto(atual, novo) {
  const a = String(atual ?? '').replace(/\s+$/, '');
  const n = frase(novo);
  if (!n) return a;
  if (!a) return n;
  return /[.!?…]$/.test(a) ? `${a} ${n}` : `${a}. ${n}`;
}
