/**
 * O CARTÃO DO LINK NO WHATSAPP — a régua pura (sem require, como toda régua
 * de functions/lib; `npm run testar:cartao`).
 *
 * O app é um SPA: existe um index.html só, e o robô do WhatsApp não roda
 * JavaScript. Então até 04/10/2026 TODO link mostrava o mesmo cartão ("Alô
 * Buzinou — onde a perua está, agora"), e a mãe recebia a propaganda de um
 * app que não conhecia, sem nada dizendo que era o motorista DELA.
 *
 * Agora dois endereços passam por `cartaoDoLink` (functions/lib/cartaoDoLink.js),
 * que devolve o MESMO index.html com as tags de prévia trocadas:
 *
 * - o CARTÃO DO TIO (`/convite/CODIGO`, para a família): a marca dele;
 * - o CARTÃO DO APP (`/quero-fazer-parte?cupom=X`, para outro motorista): o
 *   Alô Buzinou, "indicado por" quem mandou.
 *
 * ⚠️ O CARTÃO NUNCA LEVA NADA DA CRIANÇA. Ele viaja junto com o link
 * encaminhado, e quem recebe o encaminhamento vê o cartão também. Só a marca
 * do motorista, que ele mesmo escolheu mostrar às famílias.
 *
 * ⚠️ CONVITE QUE NÃO VALE (inexistente, removido, vencido) cai no cartão
 * padrão, sem a marca: um link velho não continua anunciando ninguém, e o
 * cartão não vira um jeito de descobrir de quem é um código.
 *
 * A IMAGEM: por enquanto é o LOGO do tio (quando existe), e o WhatsApp o
 * mostra pequeno, ao lado do título. A imagem grande montada com a cor e o
 * nome dele (o modelo aprovado) pede gerar PNG no servidor, com as fontes da
 * marca — é o passo seguinte. Sem logo, a imagem padrão do app.
 */

const SITE = 'https://alobuzinou.com';
const IMAGEM_PADRAO = `${SITE}/brand/og-image.png`;

const PADRAO = {
  titulo: 'Alô Buzinou — onde a perua está, agora',
  descricao: 'Rota em tempo real, avisos do motorista e mensalidade em dia. Sem grupo de WhatsApp e sem planilha.',
  imagem: IMAGEM_PADRAO,
  imagemGrande: true,
};

/**
 * Só aceita logo do Storage do PRÓPRIO projeto. `marcaLogoURL` é escrito
 * pelo cliente; sem esta trava, o cartão de um link do app poderia apontar
 * para qualquer imagem da internet.
 */
function logoConfiavel(url) {
  return typeof url === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/marcaLogos%2F/.test(url);
}

function marcaLimpa(nome) {
  return String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function comImagem(base, logoURL) {
  return logoConfiavel(logoURL) ? { ...base, imagem: logoURL, imagemGrande: false } : { ...base, imagem: IMAGEM_PADRAO, imagemGrande: true };
}

/** O cartão do tio — texto "Direto" aprovado pelo dono. */
function cartaoDoConvite({ marca, logoURL } = {}) {
  const nome = marcaLimpa(marca);
  if (!nome) return { ...PADRAO };
  return comImagem({
    titulo: `${nome} te convidou para o app`,
    descricao: 'A perua, os avisos e a mensalidade no seu celular.',
  }, logoURL);
}

/** O cartão do app — "indicado por" quem mandou (texto "Direto"). */
function cartaoDaIndicacao({ marca, logoURL } = {}) {
  const nome = marcaLimpa(marca);
  if (!nome) {
    return {
      titulo: 'Crie sua conta de motorista no Alô Buzinou',
      descricao: 'O app do transporte escolar: rota, mensalidade e recados num lugar só.',
      imagem: IMAGEM_PADRAO,
      imagemGrande: true,
    };
  }
  return comImagem({
    titulo: `${nome} te indicou o Alô Buzinou`,
    descricao: 'O app do transporte escolar. Crie sua conta de motorista.',
  }, logoURL);
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Troca as tags de prévia do index.html pelas do cartão. Mexe só no
 * CONTEÚDO das tags que já existem (og:title, og:description, og:image,
 * og:url, twitter:card) e tira as dimensões da imagem quando ela é o logo —
 * dizer 1200×630 de um logo quadrado faz o WhatsApp cortá-lo.
 */
function trocarTagsDaPrevia(html, cartao, url) {
  let saida = String(html);
  const troca = (prop, valor) => {
    const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")[^"]*(")`);
    saida = saida.replace(re, `$1${escapar(valor)}$2`);
  };
  // As tags do index.html às vezes estão quebradas em linhas
  // (`<meta\n  property=...\n  content=...`): junta antes de trocar.
  saida = saida.replace(/<meta\s+property="(og:[a-z:_]+)"\s+content="([^"]*)"\s*\/>/g, '<meta property="$1" content="$2" />');
  troca('og:title', cartao.titulo);
  troca('og:description', cartao.descricao);
  troca('og:image', cartao.imagem);
  troca('og:url', url);
  if (!cartao.imagemGrande) {
    saida = saida
      .replace(/\s*<meta property="og:image:width" content="[^"]*" \/>/, '')
      .replace(/\s*<meta property="og:image:height" content="[^"]*" \/>/, '')
      .replace(/(<meta\s+name="twitter:card"\s+content=")[^"]*(")/, '$1summary$2');
  }
  return saida;
}

module.exports = {
  PADRAO,
  IMAGEM_PADRAO,
  logoConfiavel,
  cartaoDoConvite,
  cartaoDaIndicacao,
  trocarTagsDaPrevia,
};
