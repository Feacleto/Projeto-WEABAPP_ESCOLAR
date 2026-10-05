/**
 * O CÓDIGO DE INDICAÇÃO DO TIO — régua PURA (04/10/2026).
 *
 * É o cupom que vai no "cartão do app": "Use o cupom NINO-4821". Quem digita
 * ganha o app completo por um tempo (decisão do dono: o cupom dá ACESSO, não
 * preço), e quem indicou fica sabendo na hora.
 *
 * Régua sem `require`, como toda régua de `functions/lib/` — o
 * `testar:imports` derruba a bateria se ela alcançar o SDK.
 *
 * Formato: a MARCA dele (ou o nome) em maiúsculas, sem acento, só letras, até
 * 6, um hífen e 4 dígitos. A marca é o que a família e o colega reconhecem
 * ("Tio Nino" → NINO); o "TIO" da frente cai, porque metade da base se chama
 * "Tio Alguma Coisa" e todo código começaria igual.
 */

const PALAVRAS_QUE_CAEM = new Set(['TIO', 'TIA', 'DO', 'DA', 'DE', 'DOS', 'DAS', 'TRANSPORTE', 'ESCOLAR', 'VAN', 'PERUA']);

/** A parte de letras: "Tio Nino Transporte" → "NINO". Sem nada útil, "TIO". */
function prefixoDoCodigo(nome) {
  const limpo = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ');
  const palavras = limpo.split(/\s+/).filter((p) => p && !PALAVRAS_QUE_CAEM.has(p));
  const base = (palavras[0] || '').slice(0, 6);
  return base.length >= 2 ? base : 'TIO';
}

/** `aleatorio` é injetado (0 ≤ x < 1) para o teste ser determinístico. */
function gerarCodigo(nome, aleatorio = Math.random) {
  const numero = 1000 + Math.floor(aleatorio() * 9000);
  return `${prefixoDoCodigo(nome)}-${numero}`;
}

/**
 * O que a pessoa digitou ou veio no link (`?cupom=`), já no formato da chave:
 * maiúsculas, sem espaço, hífen no lugar certo. Devolve `null` se não parece
 * um código — nunca adivinha.
 */
function normalizarCodigo(bruto) {
  const s = String(bruto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{2,6})(\d{4})$/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}

module.exports = { prefixoDoCodigo, gerarCodigo, normalizarCodigo };
