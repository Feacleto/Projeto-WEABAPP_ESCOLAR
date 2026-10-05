/**
 * A IMAGEM GRANDE DO CARTÃO DO LINK (05/10/2026, modelos aprovados pelo dono)
 * — a régua pura. Sem `require` de SDK: só desenha o SVG; quem lê o banco,
 * baixa o logo e transforma em PNG é `imagemDoCartao.js`.
 * Testada em `npm run testar:imagem-do-cartao`.
 *
 * Dois desenhos, 1200×630 (a proporção que o WhatsApp mostra grande):
 *
 * - CARTÃO DO TIO (modelo 1, o convite à família): o fundo na cor da marca
 *   dele, o logo num círculo branco, o nome grande e "te convidou para o
 *   app"; embaixo, uma faixa branca com a perua e "pelo Alô Buzinou".
 * - CARTÃO DO APP (modelo 2, a indicação a outro motorista): o verde da
 *   casa, a perua, "Alô Buzinou" e "O app do transporte escolar"; embaixo, a
 *   fita "Indicado por" com o logo e a marca de quem mandou.
 *
 * ⚠️ NADA DA CRIANÇA ENTRA AQUI, e isso é FORMATO, não cuidado: as funções
 * desestruturam só `marca`, `cor` e `logo`. O cartão viaja com o link
 * encaminhado, e quem recebe o encaminhamento vê a imagem também.
 *
 * ⚠️ A COR É A COR VIVA DO APP, ESPELHADA. `corViva` repete a parte
 * `marca`/`naMarca` de `paletaDaMarca` (src/marca/corDaMarca.js) — o deploy
 * das functions não alcança `src/`. O teste compara as duas cópias numa
 * varredura do círculo de cores; mudar uma sem a outra reprova a bateria.
 * Cor inválida ou sem cor (cinza, quase preto) volta ao verde da casa.
 *
 * ⚠️ O NOME É MEDIDO, NÃO ADIVINHADO. As larguras abaixo são o avanço de cada
 * letra nas fontes que vão no PNG (`functions/fontes/`, recortadas para o
 * latim), em milésimos do corpo. Letra que a fonte não tem é tirada do nome
 * — sem fonte de sistema no servidor ela sairia como um quadrado vazio (e é
 * assim que emoji não entra no cartão). Trocar a fonte pede gerar a tabela
 * de novo.
 */

'use strict';

const SITE = 'https://alobuzinou.com';
const LARGURA = 1200;
const ALTURA = 630;

/** Sobe quando o DESENHO muda: o `?v=` muda junto e o WhatsApp busca de novo. */
const VERSAO_DO_DESENHO = 1;

// As cores da casa (tailwind.config.js → coresHex). O verde é o `primary`.
const VERDE = '#1F5F3F';
const ONDA = '#3F9B12';
const LIMAO = '#52C41A';
const VERDE_CLARO = '#CFEBD9';
const TEXTO_SUAVE = '#55635B';
const BRANCO_HEX = '#FFFFFF';

const FONTE_DO_TITULO = 'Bricolage Grotesque';
const FONTE_DO_TEXTO = 'Instrument Sans';

// ── a cor (espelho de src/marca/corDaMarca.js) ──────────────────────────

const BRANCO = [255, 255, 255];
const TINTA_ESCURA = [0x0b, 0x12, 0x10];
const CONTRASTE_DA_TINTA = 4.5;

function hexParaRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function rgbParaHsl([r, g, b]) {
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

function hslParaRgb([h, s, l]) {
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

function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function temCor(rgb) {
  const [, s, l] = rgbParaHsl(rgb);
  return s >= 0.25 && l >= 0.12 && l <= 0.9;
}

/**
 * A cor do fundo do cartão do tio e a letra em cima dela — a MESMA conta da
 * `marca`/`naMarca` do app. Sem cor que sirva, o verde da casa.
 */
function corViva(hex) {
  const rgb = hexParaRgb(hex);
  if (!rgb || !temCor(rgb)) return { marca: VERDE, naMarca: BRANCO_HEX, daCasa: true };
  const [h, sBruto, l] = rgbParaHsl(rgb);
  let marca = rgb.map(Math.round);
  let naMarca = contraste(marca, BRANCO) >= contraste(marca, TINTA_ESCURA) ? BRANCO : TINTA_ESCURA;
  for (let L = l; contraste(marca, naMarca) < CONTRASTE_DA_TINTA && L > 0.05; L -= 0.01) {
    marca = hslParaRgb([h, sBruto, L]).map(Math.round);
    naMarca = BRANCO;
  }
  return { marca: rgbParaHex(marca), naMarca: rgbParaHex(naMarca), daCasa: false };
}

/**
 * A segunda linha do cartão: a letra misturada um pouco com o fundo (o
 * "#FFE3D3" do modelo sobre o laranja), mas só enquanto ainda lê a 4,5:1.
 */
function tintaSuave(fundoHex, tintaHex) {
  const fundo = hexParaRgb(fundoHex);
  const tinta = hexParaRgb(tintaHex);
  for (let mistura = 0.2; mistura > 0; mistura -= 0.02) {
    const cor = tinta.map((t, i) => Math.round(t * (1 - mistura) + fundo[i] * mistura));
    if (contraste(cor, fundo) >= CONTRASTE_DA_TINTA) return rgbParaHex(cor);
  }
  return rgbParaHex(tinta);
}

/** As iniciais no lugar do logo: "Tio Nino" → "TN". */
function iniciais(nome) {
  const palavras = String(nome || '').split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  return palavras.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

// ── as letras ────────────────────────────────────────────────────────────

function tabela(letras, larguras) {
  const mapa = new Map();
  Array.from(letras).forEach((letra, i) => mapa.set(letra, larguras[i]));
  return mapa;
}

// Avanço de cada letra, em milésimos do corpo (gerado das fontes em functions/fontes/).
const LETRAS_DO_TITULO = tabela(
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿŒœ–—‘’‚“”…",
  [203,268,340,613,575,948,697,174,303,303,457,486,193,313,246,349,594,310,551,565,607,565,592,498,608,603,250,235,486,486,486,396,936,659,608,631,621,540,510,649,637,243,323,623,460,822,694,661,586,659,615,585,516,627,632,915,623,595,550,295,349,295,530,527,283,543,576,539,576,537,376,549,562,234,244,541,234,860,562,567,574,574,400,517,368,557,530,799,543,539,483,321,218,321,486,203,268,539,687,583,218,518,434,914,350,466,486,673,332,342,486,408,400,283,542,649,246,318,244,408,466,844,851,980,386,659,659,659,659,659,659,863,631,540,540,540,540,243,243,243,243,645,694,661,661,661,661,661,486,670,627,627,627,627,595,587,638,543,543,543,543,543,543,858,539,537,537,537,537,252,234,234,234,570,562,567,567,567,567,567,486,567,557,557,557,557,539,574,539,942,928,500,775,193,193,193,382,382,757]
);
const LETRAS_DO_TEXTO = tabela(
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¥§¨©ª«®¯°´¶·¸º»¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿŒœ–—‘’‚“”…",
  [190,306,482,732,652,786,774,268,456,456,441,551,285,486,285,445,682,385,563,582,622,585,623,575,606,624,285,285,551,551,551,587,874,736,649,750,756,626,590,763,720,254,413,722,590,894,720,798,672,815,668,652,672,700,736,1086,716,712,635,456,445,456,551,486,354,571,628,562,628,574,378,628,619,270,270,569,270,950,619,604,628,628,398,504,421,611,543,816,605,543,522,456,230,456,551,190,306,562,606,652,530,510,810,377,574,810,411,366,354,639,165,301,410,574,587,736,736,736,736,736,736,983,750,626,626,626,626,254,254,254,254,772,720,798,798,798,798,798,551,798,700,700,700,700,712,668,640,571,571,571,571,571,571,887,562,574,574,574,574,270,270,270,270,616,619,604,604,604,604,604,551,604,611,611,611,611,543,628,543,1090,949,606,906,285,285,283,502,502,765]
);

/** A largura do texto em pixels, no corpo dado. */
function larguraDoTexto(texto, corpo, letras = LETRAS_DO_TITULO) {
  let soma = 0;
  for (const letra of Array.from(String(texto))) soma += letras.get(letra) ?? 600;
  return (soma / 1000) * corpo;
}

/**
 * O nome que vai no cartão: espaços juntados, só letras que a fonte
 * desenha, no máximo 40 (o mesmo corte do título do cartão).
 */
function nomeDesenhavel(nome) {
  const so = Array.from(String(nome || '')).filter((l) => LETRAS_DO_TITULO.has(l) && l !== ' ').join('');
  return Array.from(so.replace(/\s+/g, ' ').trim()).slice(0, 40).join('').trim();
}

/** Corta com "…" até caber. */
function cortarAteCaber(texto, corpo, largura) {
  if (larguraDoTexto(texto, corpo) <= largura) return texto;
  let letras = Array.from(texto);
  while (letras.length > 1 && larguraDoTexto(`${letras.join('').trimEnd()}…`, corpo) > largura) letras = letras.slice(0, -1);
  return `${letras.join('').trimEnd()}…`;
}

/**
 * Encaixa o nome numa largura: uma linha no maior corpo que couber; se não
 * couber nem no menor, duas linhas quebradas entre palavras; se ainda não
 * couber, a segunda linha é cortada com "…". Devolve `{ linhas, corpo }`.
 */
function encaixarNome(nome, largura, { maior, menor, maiorEmDuas, menorEmDuas }) {
  for (let corpo = maior; corpo >= menor; corpo -= 4) {
    if (larguraDoTexto(nome, corpo) <= largura) return { linhas: [nome], corpo };
  }
  const palavras = nome.split(' ');
  if (palavras.length > 1) {
    // A quebra que deixa a linha mais comprida a mais curta possível.
    let melhor = null;
    for (let i = 1; i < palavras.length; i++) {
      const linhas = [palavras.slice(0, i).join(' '), palavras.slice(i).join(' ')];
      const maiorLinha = Math.max(...linhas.map((l) => larguraDoTexto(l, 1)));
      if (!melhor || maiorLinha < melhor.maiorLinha) melhor = { linhas, maiorLinha };
    }
    for (let corpo = maiorEmDuas; corpo >= menorEmDuas; corpo -= 4) {
      if (melhor.maiorLinha * corpo <= largura) return { linhas: melhor.linhas, corpo };
    }
    return {
      linhas: melhor.linhas.map((l) => cortarAteCaber(l, menorEmDuas, largura)),
      corpo: menorEmDuas,
    };
  }
  return { linhas: [cortarAteCaber(nome, menor, largura)], corpo: menor };
}

// ── o SVG ────────────────────────────────────────────────────────────────

function escaparXml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Só imagem embutida, em base64, dos formatos que o desenhista lê. */
function logoEmbutido(logo) {
  return typeof logo === 'string' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo) ? logo : null;
}

/** A perua do Alô Buzinou (public/brand/mark.svg), num quadrado de `lado`. */
function perua(x, y, lado, corpo, vidro, ondas) {
  return `<svg x="${x}" y="${y}" width="${lado}" height="${lado}" viewBox="0 0 512 512"><g transform="translate(30.720 47.273) scale(1.02122)">`
    + `<path d="M68 74H292A68 68 0 0 1 360 142V304A68 68 0 0 1 292 372H68A68 68 0 0 1 0 304V142A68 68 0 0 1 68 74ZM50 356H66A18 18 0 0 1 84 374V394A18 18 0 0 1 66 412H50A18 18 0 0 1 32 394V374A18 18 0 0 1 50 356ZM294 356H310A18 18 0 0 1 328 374V394A18 18 0 0 1 310 412H294A18 18 0 0 1 276 394V374A18 18 0 0 1 294 356Z" fill="${corpo}"/>`
    + `<path d="M213.22 286.88A12 12 0 0 1 223.05 268H254.07A12 12 0 0 1 265.93 281.78L258.23 333.14A6 6 0 0 1 247.38 335.69ZM84 126H276A32 32 0 0 1 308 158V264A32 32 0 0 1 276 296H84A32 32 0 0 1 52 264V158A32 32 0 0 1 84 126Z" fill="${vidro}"/>`
    + `<path d="M329.39 53.62A74 74 0 0 1 385.13 105.6" stroke="${ondas}" stroke-width="24" stroke-linecap="round" fill="none"/>`
    + `<path d="M338.92 8.78A119.84 119.84 0 0 1 429.2 92.97" stroke="${ondas}" stroke-width="24" stroke-linecap="round" fill="none"/>`
    + '</g></svg>';
}

/**
 * O selo do tio num círculo: o logo dele (inteiro, dentro do quadrado que
 * cabe no círculo — nunca cortado) ou as iniciais.
 */
function selo({ cx, cy, r, fundo, borda, logo, nome, corDasIniciais, id }) {
  let miolo;
  if (logo) {
    const lado = Math.round(r * 1.36);
    miolo = `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r - 2}"/></clipPath>`
      + `<image href="${logo}" x="${cx - lado / 2}" y="${cy - lado / 2}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`;
  } else {
    const letras = iniciais(nome) || 'A';
    const corpo = Math.round(r * (letras.length > 1 ? 0.92 : 1.1));
    miolo = `<text x="${cx}" y="${cy + corpo * 0.36}" text-anchor="middle" fill="${corDasIniciais}" font-family="${FONTE_DO_TITULO}" font-weight="800" font-size="${corpo}">${escaparXml(letras)}</text>`;
  }
  const contorno = borda ? ` stroke="${borda}" stroke-width="6"` : '';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fundo}"${contorno}/>${miolo}`;
}

function abrir(fundo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="0 0 ${LARGURA} ${ALTURA}">`
    + `<rect width="${LARGURA}" height="${ALTURA}" fill="${fundo}"/>`;
}

/** Modelo 1: o convite à família, na cor do tio. */
function svgDoCartaoDoTio({ marca, cor, logo } = {}) {
  const nome = nomeDesenhavel(marca);
  const { marca: fundo, naMarca } = corViva(cor);
  const suave = tintaSuave(fundo, naMarca);
  const imagem = logoEmbutido(logo);
  // Iniciais na cor da marca sobre o círculo branco; se a cor for clara
  // demais para ler ali, na tinta escura da casa.
  const corDasIniciais = contraste(hexParaRgb(fundo), BRANCO) >= 3 ? fundo : rgbParaHex(TINTA_ESCURA);

  const X = 460;
  const LARGURA_DO_TEXTO = LARGURA - X - 50;
  const { linhas, corpo } = encaixarNome(nome, LARGURA_DO_TEXTO, { maior: 120, menor: 80, maiorEmDuas: 92, menorEmDuas: 60 });
  const entrelinha = Math.round(corpo * 1.04);
  const FRASE = 'te convidou para o app';
  // A frase é fixa, mas a conta fica escrita: trocar a frase não a deixa
  // sair da imagem calada.
  let corpoDaFrase = 50;
  while (corpoDaFrase > 32 && larguraDoTexto(FRASE, corpoDaFrase, LETRAS_DO_TEXTO) > LARGURA_DO_TEXTO) corpoDaFrase -= 2;
  // O bloco (nome + frase) centrado na área colorida, acima da faixa branca.
  const altura = corpo * 0.74 + (linhas.length - 1) * entrelinha + 30 + corpoDaFrase * 0.74;
  const topo = 270 - altura / 2;
  const base1 = Math.round(topo + corpo * 0.74);
  const nomeSvg = linhas
    .map((l, i) => `<text x="${X}" y="${base1 + i * entrelinha}" fill="${naMarca}" font-family="${FONTE_DO_TITULO}" font-weight="800" font-size="${corpo}">${escaparXml(l)}</text>`)
    .join('');
  const baseFrase = Math.round(base1 + (linhas.length - 1) * entrelinha + 30 + corpoDaFrase * 0.74 + 10);

  return abrir(fundo)
    + `<circle cx="1080" cy="-40" r="260" fill="#FFFFFF" opacity=".08"/>`
    + selo({ cx: 250, cy: 270, r: 150, fundo: BRANCO_HEX, logo: imagem, nome, corDasIniciais, id: 'logo-do-tio' })
    + nomeSvg
    + `<text x="${X + 4}" y="${baseFrase}" fill="${suave}" font-family="${FONTE_DO_TEXTO}" font-weight="700" font-size="${corpoDaFrase}">${FRASE}</text>`
    + `<rect x="0" y="540" width="${LARGURA}" height="90" fill="#FFFFFF"/>`
    + perua(40, 552, 66, VERDE, BRANCO_HEX, ONDA)
    + `<text x="120" y="598" fill="${VERDE}" font-family="${FONTE_DO_TITULO}" font-weight="800" font-size="38">pelo Alô Buzinou</text>`
    + '</svg>';
}

/** Modelo 2: a indicação a outro motorista, no verde da casa, com a fita. */
function svgDoCartaoDoApp({ marca, cor, logo } = {}) {
  const nome = nomeDesenhavel(marca);
  const { marca: corDoTio, naMarca } = corViva(cor);
  const imagem = logoEmbutido(logo);
  const X = 220;
  // Na fita só cabe uma linha: do 52 ao 36, e o que ainda passar sai com "…".
  const largura = LARGURA - X - 50;
  let corpo = 52;
  while (corpo > 36 && larguraDoTexto(nome, corpo) > largura) corpo -= 4;
  const linha = cortarAteCaber(nome, corpo, largura);

  return abrir(VERDE)
    + `<circle cx="1100" cy="-60" r="280" fill="#FFFFFF" opacity=".06"/>`
    + perua(110, 120, 300, BRANCO_HEX, VERDE, LIMAO)
    + `<text x="460" y="250" fill="#FFFFFF" font-family="${FONTE_DO_TITULO}" font-weight="800" font-size="100">Alô Buzinou</text>`
    + `<text x="464" y="320" fill="${VERDE_CLARO}" font-family="${FONTE_DO_TEXTO}" font-weight="700" font-size="46">O app do transporte escolar</text>`
    + `<rect x="0" y="470" width="${LARGURA}" height="160" fill="#FFFFFF"/>`
    + (imagem
      ? selo({ cx: 130, cy: 550, r: 58, fundo: BRANCO_HEX, borda: corDoTio, logo: imagem, nome, id: 'logo-de-quem-indicou' })
      : selo({ cx: 130, cy: 550, r: 58, fundo: corDoTio, nome, corDasIniciais: naMarca, id: 'logo-de-quem-indicou' }))
    + `<text x="${X}" y="535" fill="${TEXTO_SUAVE}" font-family="${FONTE_DO_TEXTO}" font-weight="700" font-size="40">Indicado por</text>`
    + `<text x="${X}" y="590" fill="${VERDE}" font-family="${FONTE_DO_TITULO}" font-weight="800" font-size="${corpo}">${escaparXml(linha)}</text>`
    + '</svg>';
}

const TIPOS = { tio: svgDoCartaoDoTio, app: svgDoCartaoDoApp };

/** `{ tipo: 'tio' | 'app', marca, cor, logo }` → o SVG, ou null sem marca. */
function svgDoCartao({ tipo, marca, cor, logo } = {}) {
  const desenhar = TIPOS[tipo];
  if (!desenhar || !nomeDesenhavel(marca)) return null;
  return desenhar({ marca, cor, logo });
}

// ── o endereço ───────────────────────────────────────────────────────────

/** FNV-1a de 32 bits, em base 36: curto, puro, e muda com qualquer letra. */
function resumo(texto) {
  let h = 0x811c9dc5;
  for (const letra of String(texto)) {
    h ^= letra.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * A versão da imagem: muda quando a marca, a cor ou o logo mudam (e quando
 * o desenho muda). Vai no `?v=` — o WhatsApp e o CDN guardam a imagem pelo
 * endereço, e sem isso o tio trocaria o logo e o cartão velho continuaria.
 */
function versaoDaImagem({ marca, cor, logoURL } = {}) {
  return resumo([VERSAO_DO_DESENHO, nomeDesenhavel(marca), String(cor || ''), String(logoURL || '')].join('|'));
}

/** O endereço público da imagem (rewrite `/cartao/**` do hosting do app). */
function urlDaImagem(tipo, uid, dados = {}) {
  return `${SITE}/cartao/${tipo}/${uid}.png?v=${versaoDaImagem(dados)}`;
}

/** `/cartao/tio/<uid>.png` → `{ tipo, uid }`, ou null. O uid é validado por quem chama. */
function lerCaminho(caminho) {
  const m = /^\/cartao\/(tio|app)\/([^/]+)\.png$/.exec(String(caminho || ''));
  return m ? { tipo: m[1], uid: m[2] } : null;
}

module.exports = {
  LARGURA,
  ALTURA,
  VERDE,
  VERSAO_DO_DESENHO,
  FONTE_DO_TITULO,
  FONTE_DO_TEXTO,
  hexParaRgb,
  contraste,
  corViva,
  tintaSuave,
  iniciais,
  LETRAS_DO_TEXTO,
  larguraDoTexto,
  nomeDesenhavel,
  encaixarNome,
  escaparXml,
  logoEmbutido,
  svgDoCartao,
  svgDoCartaoDoTio,
  svgDoCartaoDoApp,
  versaoDaImagem,
  urlDaImagem,
  lerCaminho,
};
