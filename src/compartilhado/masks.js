// Máscaras e validações usadas em formulários (Brasil-first).

/**
 * Aplica máscara de telefone brasileiro: (XX) XXXXX-XXXX (celular, 11 dígitos)
 * ou (XX) XXXX-XXXX (fixo, 10 dígitos). Aceita string parcial — usado em onChange.
 */
/**
 * O 55 DO PAÍS SAI ANTES DE QUALQUER CORTE — e a ordem era o bug.
 *
 * O preenchimento automático do navegador devolve o número no formato
 * internacional: `+55 11 97318-5800`. A máscara limpava a pontuação e cortava
 * em 11 dígitos ANTES de olhar o que eram, então `5511973185800` virava
 * `55119731858` e o resultado na tela era `(55) 11973-1858` — DDD errado,
 * último dígito perdido, e nada avisando. O motorista salvava e a gente
 * ligava pro número de outra pessoa.
 *
 * POR QUE 12 E 13, E NÃO "COMEÇA COM 55"
 * Porque 55 TAMBÉM É DDD — Santa Maria, no Rio Grande do Sul. Um celular de
 * lá tem 11 dígitos e começa com 55, e cortar o prefixo dele estragaria um
 * número legítimo pra consertar outro.
 *
 * A contagem desfaz a ambiguidade sem chutar: número brasileiro com DDD tem
 * 10 (fixo) ou 11 (celular) dígitos. Então 12 e 13 só existem com o país na
 * frente — e 11 começando com 55 é gaúcho, e fica como está.
 */
function tirarCodigoDoPais(digits) {
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

export function maskPhone(value) {
  const digits = tirarCodigoDoPais(
    String(value || '').replace(/\D/g, '')
  ).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Só os dígitos, no formato que o banco guarda: DDD + número, SEM o país.
 *
 * Tira o 55 pela mesma regra da máscara, e não por simetria estética: um
 * número colado do WhatsApp ou vindo do preenchimento automático chega com
 * ele, e `isValidPhone` logo abaixo recusa 13 dígitos. O usuário via "confira
 * o telefone" olhando pra um telefone certo.
 *
 * Quem monta link de wa.me recoloca o 55 na frente — e agora recoloca sempre
 * em cima da mesma base, em vez de adivinhar se já estava lá.
 */
export function unmaskPhone(value) {
  return tirarCodigoDoPais(String(value || '').replace(/\D/g, ''));
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

