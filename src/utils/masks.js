import { isValidInviteCodeFormat } from './generateInviteCode';

// "TN" + 6 caracteres do formato novo. O legado (TN + 4 dígitos) cabe
// dentro deste limite, então uma constante serve pros dois.
const MAX_INVITE_LENGTH = 8;
// Máscaras e validações usadas em formulários (Brasil-first).

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX (celular, 11 dígitos)
 * ou (XX) XXXX-XXXX (fixo, 10 dígitos). Aceita string parcial — usado em onChange.
 */
export function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Retorna apenas os dígitos do telefone (útil pra salvar no banco). */
export function unmaskPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Telefone válido se tiver 10 (fixo) ou 11 (celular) dígitos. */
export function isValidPhone(value) {
  const digits = unmaskPhone(value);
  return digits.length === 10 || digits.length === 11;
}

/**
 * Validação de email — regex pragmática (cobre o que importa: usuário@domínio.tld).
 * Não tenta cobrir 100% da RFC 5322 porque ninguém precisa disso na prática.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

/**
 * Máscara do invite code: força maiúsculas, prefixo TN + 4 dígitos.
 * Aceita digitação progressiva — usado em onChange.
 */
export function maskInviteCode(value) {
  const upper = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Se o usuário começou direto com dígitos, prefixa TN automaticamente
  if (/^\d/.test(upper)) {
    return ('TN' + upper).slice(0, MAX_INVITE_LENGTH);
  }
  return upper.slice(0, MAX_INVITE_LENGTH);
}

/**
 * Valida o código de convite nos DOIS formatos.
 *
 * A regra vive em generateInviteCode porque é lá que o formato é
 * definido. Duplicar o regex aqui foi o que gerou divergência entre
 * cliente e Cloud Function na primeira versão.
 */
export function isValidInviteCode(value) {
  return isValidInviteCodeFormat(value);
}
