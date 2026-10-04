/**
 * A COR DO MOTORISTA, TIRADA DO LOGO DELE (03/10/2026, pedido do dono).
 *
 * O app do motorista — e o das famílias dele — passa a ter a cor da marca
 * dele: o verde do Alô Buzinou fica para o que é relação com a PLATAFORMA
 * (plano, taxa, suporte, sair da conta). Duas peças puras moram aqui:
 *
 *   - `coresDoLogo(pixels)`: as cores que MAIS APARECEM e que mais chamam a
 *     atenção no logo, da mais forte para a mais fraca (até três). Fundo
 *     branco, preto e cinza não contam — num logo, quase sempre são o fundo
 *     ou o contorno, nunca a "cor da marca".
 *   - `paletaDaMarca(hex)`: a cor escolhida vira as seis tintas que o app usa
 *     no lugar do verde. ⚠️ A REGRA QUE NÃO SE NEGOCIA É LEITURA: o tom
 *     principal é escurecido até o texto branco em cima dele e ele como texto
 *     sobre o fundo da página passarem com folga — um logo amarelo-claro vira
 *     mostarda legível, nunca um botão amarelo com letra branca invisível.
 *     Cor sem cor (cinza, quase preto, quase branco) devolve null, e o app
 *     fica no verde da casa.
 *
 * Sem import: é `marca/`, testado em `npm run testar:cor-da-marca`, que varre
 * o círculo de cores inteiro atrás de uma combinação ilegível.
 */

/** O fundo da página e o cartão — onde o `primary` aparece como texto. */
const FUNDO = [0xee, 0xf1, 0xef];
const BRANCO = [255, 255, 255];

/** Contraste mínimo do tom principal: contra o fundo da página E sob texto branco. */
export const CONTRASTE_MINIMO = 5.5;

// ── conversões ──────────────────────────────────────────────────────────

export function hexParaRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbParaHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function rgbParaHsl([r, g, b]) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
}

export function hslParaRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((v) => (v + m) * 255);
}

function luminancia([r, g, b]) {
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── a cor tem cor? ──────────────────────────────────────────────────────

/** Cinza, quase preto e quase branco não são "a cor da marca". */
export function temCor(rgb) {
  const [, s, l] = rgbParaHsl(rgb);
  return s >= 0.25 && l >= 0.12 && l <= 0.9;
}

// ── as cores do logo ────────────────────────────────────────────────────

const FATIAS = 24; // fatias de 15° no círculo de cores
const DISTANCIA_MINIMA = 30; // graus entre duas sugestões

/**
 * `pixels` é o RGBA cru de um canvas (Uint8ClampedArray ou array). Devolve
 * até três hex, da cor mais forte para a mais fraca. Peso = quantos pixels
 * daquela cor × o quanto ela é viva: um logo com muito azul-claro e um
 * pouco de vermelho forte não perde o vermelho.
 */
export function coresDoLogo(pixels, maximo = 3) {
  const fatias = Array.from({ length: FATIAS }, () => ({ peso: 0, r: 0, g: 0, b: 0, n: 0 }));
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // transparente
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (!temCor(rgb)) continue;
    const [h, s, l] = rgbParaHsl(rgb);
    const f = fatias[Math.floor(h / (360 / FATIAS)) % FATIAS];
    const vivacidade = s * (1 - Math.abs(l - 0.5));
    f.peso += vivacidade;
    f.r += rgb[0];
    f.g += rgb[1];
    f.b += rgb[2];
    f.n += 1;
  }
  const ordenadas = fatias
    .map((f, i) => ({ ...f, i }))
    .filter((f) => f.n > 0)
    .sort((a, b) => b.peso - a.peso);

  const escolhidas = [];
  for (const f of ordenadas) {
    const media = [f.r / f.n, f.g / f.n, f.b / f.n];
    const [h] = rgbParaHsl(media);
    const longe = escolhidas.every(({ h: outro }) => {
      const d = Math.abs(h - outro);
      return Math.min(d, 360 - d) >= DISTANCIA_MINIMA;
    });
    if (!longe) continue;
    escolhidas.push({ h, hex: rgbParaHex(media) });
    if (escolhidas.length === maximo) break;
  }
  return escolhidas.map((e) => e.hex);
}

// ── a paleta ────────────────────────────────────────────────────────────

/** Escurece mantendo matiz e saturação até passar no contraste pedido. */
function escurecerAte(h, s, l, alvo) {
  let L = l;
  for (let i = 0; i < 100; i++) {
    // Arredondada ANTES de medir: medir a cor com casas decimais deixava
    // passar um tom que, virado hex, ficava um fio abaixo do mínimo.
    const rgb = hslParaRgb([h, s, L]).map(Math.round);
    if (contraste(rgb, FUNDO) >= alvo && contraste(rgb, BRANCO) >= alvo) return rgb;
    L -= 0.01;
    if (L <= 0.05) break;
  }
  return hslParaRgb([h, s, 0.05]);
}

/**
 * As tintas do app a partir de UMA cor. Devolve
 * `{ primary, primaryDark, primarySoft, primaryChip, primaryBorder, menta }`
 * em hex, ou null quando a cor não serve (sem cor, ou hex inválido).
 */
export function paletaDaMarca(hex) {
  const rgb = hexParaRgb(hex);
  if (!rgb || !temCor(rgb)) return null;
  const [h, sBruto, l] = rgbParaHsl(rgb);
  // Saturação dentro de uma faixa: cinza-azulado vira azul de verdade, e neon
  // não vira um botão que vibra na tela.
  const s = Math.min(Math.max(sBruto, 0.4), 0.85);

  const primary = escurecerAte(h, s, Math.min(l, 0.45), CONTRASTE_MINIMO);
  const [, , lP] = rgbParaHsl(primary);
  const primaryDark = hslParaRgb([h, s, Math.max(lP * 0.68, 0.06)]);
  const primarySoft = hslParaRgb([h, s * 0.55, 0.96]);
  const primaryChip = hslParaRgb([h, s * 0.6, 0.91]);
  const primaryBorder = hslParaRgb([h, s * 0.55, 0.81]);
  // O rótulo claro que mora SOBRE o primary (o "SUA TURMA" do cartão).
  // Clareia aos poucos até ler: com a cor principal clara demais para o
  // tom de 84%, ele sobe até quase branco.
  let menta = hslParaRgb([h, s * 0.75, 0.84]).map(Math.round);
  for (let L = 0.84; contraste(menta, primary) < 4.5 && L < 0.99; L += 0.01) {
    menta = hslParaRgb([h, s * 0.6, L]).map(Math.round);
  }

  return {
    primary: rgbParaHex(primary),
    primaryDark: rgbParaHex(primaryDark),
    primarySoft: rgbParaHex(primarySoft),
    primaryChip: rgbParaHex(primaryChip),
    primaryBorder: rgbParaHex(primaryBorder),
    menta: rgbParaHex(menta),
  };
}

/** "#1F5F3F" → "31 95 63", o formato que a variável CSS do tema guarda. */
export function canais(hex) {
  const rgb = hexParaRgb(hex);
  return rgb ? rgb.join(' ') : null;
}
