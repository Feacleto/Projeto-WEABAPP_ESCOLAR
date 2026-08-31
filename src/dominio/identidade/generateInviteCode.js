/**
 * Código de convite.
 *
 * FORMATO NOVO: "TN" + 6 caracteres de um alfabeto sem ambiguidade visual
 * (sem O/0, I/1, L) — cerca de 730 milhões de combinações.
 *
 * POR QUE MUDOU
 * O formato antigo era "TN" + 4 dígitos: 9.000 combinações. Como o resgate
 * do convite é uma operação autenticada e o Firebase permite conta anônima,
 * dava pra varrer o espaço inteiro e se vincular a uma criança de verdade —
 * ganhando nome, endereço, coordenada, escola e telefone do responsável.
 * Fechar essa porta exige espaço grande o suficiente pra varredura não
 * valer a pena.
 *
 * Códigos ANTIGOS continuam válidos: `isLegacyInviteCode` reconhece o
 * formato de 4 dígitos, e quem já recebeu um convite não fica de fora.
 */

// Sem O, 0, I, 1, L, U — reduz erro de quem dita o código por telefone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const NEW_LENGTH = 6;

export const INVITE_PREFIX = 'TN';

export function generateInviteCode() {
  // crypto.getRandomValues em vez de Math.random: um gerador previsível
  // encolheria o espaço de busca de volta, anulando o ganho acima.
  const bytes = new Uint8Array(NEW_LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < NEW_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < NEW_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${INVITE_PREFIX}${out}`;
}

/** Formato antigo, ainda aceito: TN + 4 dígitos. */
export function isLegacyInviteCode(code) {
  return /^[A-Z]{2}\d{4}$/.test(String(code || '').toUpperCase());
}

/** Formato novo: TN + 6 caracteres do alfabeto sem ambiguidade. */
export function isNewInviteCode(code) {
  return new RegExp(`^[A-Z]{2}[${ALPHABET}]{${NEW_LENGTH}}$`).test(
    String(code || '').toUpperCase()
  );
}

/** Aceita os dois formatos — legado e novo. */
export function isValidInviteCodeFormat(code) {
  return isLegacyInviteCode(code) || isNewInviteCode(code);
}

// "TN" + 6 caracteres do formato novo. O legado (TN + 4 dígitos) cabe dentro
// deste limite, então uma constante serve pros dois.
const MAX_INVITE_LENGTH = 8;

/**
 * A máscara do código, digitada progressivamente — força maiúsculas e
 * prefixa `TN` sozinha quando a pessoa começa pelos dígitos.
 *
 * MORAVA EM `masks.js`, e era a única seta ao contrário do projeto: um
 * formatador genérico importando uma regra de identidade pra validar o que
 * ele mesmo mascarava. Quem digita o código não está formatando texto — está
 * dizendo quem é. O formato do convite tem UM dono, e é este arquivo.
 */
export function maskInviteCode(value) {
  const upper = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (/^\d/.test(upper)) {
    return (INVITE_PREFIX + upper).slice(0, MAX_INVITE_LENGTH);
  }
  return upper.slice(0, MAX_INVITE_LENGTH);
}
