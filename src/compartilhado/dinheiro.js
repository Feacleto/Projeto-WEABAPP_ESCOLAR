/**
 * O VALOR EM DINHEIRO, DO JEITO QUE A PESSOA DIGITA, FALA E OUVE.
 *
 * Três conversões puras, e as três existem pelo mesmo motivo: o público do
 * app tem uns quarenta anos e lê dinheiro como lê no extrato do banco —
 * "R$ 1.200,00". Campo `type="number"` mostrava "1200" (ou "1200.5", com
 * ponto americano), e um zero a mais numa mensalidade passa batido até a
 * cobrança sair errada para a família.
 *
 *   - `valorDoDigitado`: o campo funciona como caixa eletrônico — cada dígito
 *     entra pela direita, nos centavos. Ninguém precisa achar a vírgula no
 *     teclado do celular, e o valor nunca fica ambíguo.
 *   - `valorDoQueFoiDito`: o que o reconhecimento de voz devolveu ("350
 *     reais", "mil e duzentos", "R$ 1.200,50") vira número.
 *   - `valorPorExtenso`: o número volta como frase ("mil e duzentos reais"),
 *     escrita embaixo do campo e falada pelo aparelho. É a conferência que o
 *     cheque sempre teve: quem lê "mil e duzentos" percebe na hora que
 *     digitou doze mil.
 *
 * O valor viaja entre o campo e quem o usa como TEXTO com ponto ("1200.50"),
 * ou '' quando vazio — é o formato que `parseFloat` já lia nas três telas, e
 * por isso nenhuma conta mudou com a troca do campo.
 *
 * Sem import nenhum: é compartilhado, não conhece o domínio.
 * Testado em `npm run testar:dinheiro`.
 */

/** Texto do campo ("1.200,50") a partir do valor ("1200.5"). Vazio fica vazio. */
export function textoDoValor(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * O que a pessoa digitou ("1.200,505") vira o valor ("12005.05"): só os
 * dígitos contam, e os dois últimos são centavos. Sem dígito, ''.
 * Teto de 9 dígitos (R$ 9.999.999,99): ninguém paga isso de mensalidade, e
 * sem teto um dedo apoiado no teclado vira um número sem fim.
 */
export function valorDoDigitado(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  if (!digitos) return '';
  return (Number(digitos) / 100).toFixed(2);
}

// ── Por extenso ─────────────────────────────────────────────────────────

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove',
];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n) {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    partes.push(DEZENAS[Math.floor(resto / 10)]);
    if (resto % 10) partes.push(UNIDADES[resto % 10]);
  }
  return partes.join(' e ');
}

function inteiroPorExtenso(n) {
  const milhoes = Math.floor(n / 1e6);
  const milhares = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`);
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));
  if (partes.length < 2) return partes[0] || '';
  // "mil e duzentos", "mil e cinquenta", mas "mil duzentos e trinta": o "e"
  // antes do último grupo só entra quando ele é redondo ou menor que cem.
  const ultimo = resto || milhares;
  const comE = ultimo < 100 || ultimo % 100 === 0;
  return partes.slice(0, -1).join(' ') + (comE ? ' e ' : ' ') + partes[partes.length - 1];
}

/** 1200.5 → "mil e duzentos reais e cinquenta centavos". Zero ou vazio → ''. */
export function valorPorExtenso(valor) {
  const n = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '';
  const totalCentavos = Math.round(n * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  let parteReais = '';
  if (reais === 1) parteReais = 'um real';
  else if (reais) {
    // "um milhão DE reais", mas "um milhão e duzentos mil reais".
    const redondoEmMilhao = reais % 1e6 === 0;
    parteReais = `${inteiroPorExtenso(reais)}${redondoEmMilhao ? ' de' : ''} reais`;
  }
  const parteCentavos = centavos
    ? `${ate999(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
    : '';

  return [parteReais, parteCentavos].filter(Boolean).join(' e ');
}

// ── O que foi dito ──────────────────────────────────────────────────────

const PALAVRAS = (() => {
  const mapa = { cem: 100, cento: 100, catorze: 14, zero: 0, uma: 1, duas: 2 };
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  UNIDADES.forEach((p, i) => { if (p) mapa[semAcento(p)] = i; });
  DEZENAS.forEach((p, i) => { if (p) mapa[p] = i * 10; });
  CENTENAS.forEach((p, i) => { if (p && i > 1) mapa[p] = i * 100; });
  return mapa;
})();

/** "1.200,50" → 1200.5 · "350" → 350 · "1200.50" → 1200.5 · "2.500" → 2500 */
function numeroEscrito(token) {
  if (!/^\d[\d.,]*$/.test(token)) return null;
  let t = token.replace(/[.,]$/, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * A frase do reconhecimento de voz vira valor ("1200.50"), ou null se não
 * houver número nela. Aceita algarismo, palavra e a mistura dos dois — o
 * Chrome devolve "350 reais", mas também "trezentos e cinquenta", e às vezes
 * "2 mil".
 */
export function valorDoQueFoiDito(frase) {
  const texto = String(frase ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/r\$/g, ' ');
  const tokens = texto.split(/[\s-]+/).filter(Boolean);

  let total = 0;
  let grupo = 0;
  let viuNumero = false;
  let reais = null;
  let centavos = 0;

  for (const bruto of tokens) {
    const token = bruto.replace(/[!?;:]+$/, '');
    const escrito = numeroEscrito(token);
    if (escrito !== null) {
      grupo += escrito;
      viuNumero = true;
    } else if (token in PALAVRAS) {
      grupo += PALAVRAS[token];
      viuNumero = true;
    } else if (token === 'mil') {
      total += (grupo || 1) * 1000;
      grupo = 0;
      viuNumero = true;
    } else if (token === 'milhao' || token === 'milhoes') {
      total += (grupo || 1) * 1e6;
      grupo = 0;
      viuNumero = true;
    } else if (token === 'real' || token === 'reais') {
      reais = total + grupo;
      total = 0;
      grupo = 0;
    } else if (token === 'centavo' || token === 'centavos') {
      centavos = total + grupo;
      total = 0;
      grupo = 0;
    } else if (token === 'virgula') {
      reais = total + grupo;
      total = 0;
      grupo = 0;
    }
  }

  if (!viuNumero) return null;
  if (reais === null) reais = total + grupo;
  else if (total + grupo) centavos = total + grupo; // "vinte vírgula cinquenta"

  const valor = Math.round((reais + centavos / 100) * 100) / 100;
  if (!(valor > 0)) return null;
  return valor.toFixed(2);
}
