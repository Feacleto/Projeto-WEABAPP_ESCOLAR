/**
 * Gera o "PIX Copia e Cola" (BR Code, padrão EMV do Banco Central).
 *
 * Antes a chave PIX era só texto na tela: o pai tinha que selecionar,
 * copiar e digitar o valor no app do banco. Com o BR Code ele cola uma vez
 * e o valor, o nome e a identificação já vão embutidos — menos erro de
 * digitação e menos "paguei errado".
 *
 * Referência: Manual de Padrões para Iniciação do PIX (BCB), seção BR Code.
 */

/** Campo EMV: id + tamanho em 2 dígitos + valor. */
function field(id, value) {
  const v = String(value ?? '');
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

/**
 * CRC16/CCITT-FALSE — polinômio 0x1021, valor inicial 0xFFFF.
 * É o checksum que o BCB exige no campo 63; banco recusa o código sem ele.
 */
export function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Remove acentos e caracteres que o padrão não aceita nos campos de texto.
 * Nome e cidade vão em ASCII maiúsculo — banco que recebe acento costuma
 * exibir lixo ou recusar.
 */
function sanitizeText(value, maxLength) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Chave PIX normalizada por tipo.
 *
 * Os tipos vêm de userService.PIX_KEY_TYPES ('phone' | 'email' | 'random').
 * 'cpf'/'cnpj'/'aleatoria' seguem aceitos por compatibilidade, caso algum
 * cadastro antigo tenha sido feito direto no console do Firebase.
 */
export function normalizePixKey(key, type) {
  const raw = String(key || '').trim();
  if (type === 'cpf' || type === 'cnpj') return raw.replace(/\D/g, '');
  if (type === 'phone') {
    const digits = raw.replace(/\D/g, '');
    // Telefone no PIX vai no formato +55DDNNNNNNNNN
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  }
  if (type === 'email') return raw.toLowerCase();
  return raw; // random / aleatoria — vai como está
}

/**
 * Monta o BR Code estático.
 *
 * @param key          chave PIX (já normalizada ou crua)
 * @param keyType      'phone' | 'email' | 'random' (ver PIX_KEY_TYPES)
 * @param merchantName nome de quem recebe
 * @param city         cidade de quem recebe
 * @param amount       valor em número (opcional — sem ele o pai digita)
 * @param txid         identificação livre, até 25 caracteres
 * @returns string do copia-e-cola, ou null se falta a chave
 */
export function buildPixPayload({
  key,
  keyType = 'random',
  merchantName = '',
  city = '',
  amount = null,
  txid = '',
}) {
  const pixKey = normalizePixKey(key, keyType);
  if (!pixKey) return null;

  const merchantAccount =
    field('00', 'br.gov.bcb.pix') + field('01', pixKey);

  // txid só aceita alfanumérico; '***' é o valor neutro do padrão.
  const cleanTxid =
    String(txid || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 25) || '***';

  let payload =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986');

  // Valor é opcional no padrão. Enviamos com 2 decimais quando existe —
  // é o que evita o pai digitar 32,00 no lugar de 320,00.
  if (amount != null && Number(amount) > 0) {
    payload += field('54', Number(amount).toFixed(2));
  }

  payload +=
    field('58', 'BR') +
    field('59', sanitizeText(merchantName, 25) || 'RECEBEDOR') +
    field('60', sanitizeText(city, 15) || 'SAO PAULO') +
    field('62', field('05', cleanTxid));

  // O CRC é calculado sobre o payload JÁ COM '6304' no fim.
  const withCrcId = `${payload}6304`;
  return `${withCrcId}${crc16(withCrcId)}`;
}
