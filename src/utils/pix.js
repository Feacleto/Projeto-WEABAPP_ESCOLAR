/**
 * A CHAVE PIX — uma definição só, para validar e para normalizar.
 *
 * POR QUE ISTO EXISTE
 * Havia DUAS `normalizePixKey`, com a ORDEM DOS ARGUMENTOS INVERTIDA:
 *
 *   services/userService.js →  normalizePixKey(type, value)
 *   utils/pixPayload.js     →  normalizePixKey(key,  type)
 *
 * Trocar um import pelo outro compilava, passava no lint e produzia uma chave
 * PIX inválida em silêncio — o QR sairia apontando para o nada, e ninguém
 * descobriria até um pai tentar pagar. As duas ainda divergiam no
 * comportamento: só uma minúsculava e-mail, só uma tratava CPF/CNPJ. E as duas
 * se conheciam: `pixPayload` citava `userService.PIX_KEY_TYPES` como fonte dos
 * tipos, sem nunca convergir.
 *
 * A assinatura que ficou é `(type, value)` — a mesma de `validatePixKey`, que
 * é a única das duas com chamadores externos. Assim o par tem uma ordem só.
 *
 * ESTE ARQUIVO NÃO IMPORTA FIREBASE, e é o que o torna testável
 * (`npm run testar:pix`). Chave PIX é o campo que decide para onde vai o
 * dinheiro; ele não pode continuar sendo o único do fluxo sem cobertura.
 */

import { unmaskPhone, isValidEmail } from './masks.js';

/** Os tipos que o app oferece no cadastro. */
export const PIX_KEY_TYPES = {
  phone: { label: 'Celular', placeholder: '(11) 99999-9999' },
  email: { label: 'Email', placeholder: 'tio@email.com' },
  random: {
    label: 'Chave aleatória',
    placeholder: '12345678-1234-1234-1234-123456789012',
  },
};

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * A chave é válida para este tipo? Devolve a mensagem de erro, ou `null`.
 *
 * O TELEFONE PASSA PELO `unmaskPhone` ANTES DE CONTAR, e isso conserta uma
 * recusa real: a contagem era feita sobre os dígitos crus, então a chave
 * copiada do banco no formato internacional (`+5511973185800`, 13 dígitos)
 * era rejeitada — enquanto `masks.js` aceita o MESMO número no campo de
 * telefone do cadastro, e `normalizePixKey` logo abaixo sabe lidar com o 55.
 * Três lugares com três opiniões sobre o mesmo número.
 *
 * O e-mail usa o `isEmail` de `masks.js` em vez de um regex próprio: havia
 * dois, e eles discordavam sobre `a@b.c` — válido como chave PIX, inválido
 * como e-mail de cadastro.
 */
export function validatePixKey(type, value) {
  const v = String(value || '').trim();
  if (!v) return 'Informe a chave PIX.';

  switch (type) {
    case 'phone': {
      const digits = unmaskPhone(v);
      // 10 ou 11 (DDD + número), ou os mesmos com o 55 na frente.
      const semPais = digits.startsWith('55') ? digits.slice(2) : digits;
      if (semPais.length !== 10 && semPais.length !== 11) {
        return 'Celular inválido. Use DDD + número (10 ou 11 dígitos).';
      }
      return null;
    }
    case 'email':
      return isValidEmail(v) ? null : 'Email inválido.';
    case 'random':
      return UUID_RE.test(v)
        ? null
        : 'Chave aleatória deve seguir o formato UUID (32 caracteres com hífens).';
    case 'cpf':
    case 'cnpj': {
      const digits = v.replace(/\D/g, '');
      const tamanho = type === 'cpf' ? 11 : 14;
      return digits.length === tamanho
        ? null
        : `${type.toUpperCase()} inválido.`;
    }
    default:
      return 'Tipo de chave inválido.';
  }
}

/**
 * A chave no formato que o PIX espera — para exibir, copiar e virar QR.
 *
 * `cpf`/`cnpj` continuam aceitos por compatibilidade: cadastro feito direto no
 * console do Firebase pode ter usado esses tipos, e devolver o valor cru ali
 * geraria um BR Code que o banco recusa.
 */
export function normalizePixKey(type, value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  if (type === 'cpf' || type === 'cnpj') return raw.replace(/\D/g, '');
  if (type === 'phone') {
    const digits = unmaskPhone(raw);
    // Telefone no PIX vai no formato +55DDNNNNNNNNN.
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }
  if (type === 'email') return raw.toLowerCase();
  return raw; // random — vai como está
}
