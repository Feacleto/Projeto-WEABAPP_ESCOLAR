/**
 * O CARTÃO DO LINK NO WHATSAPP — a régua pura (sem SDK, como toda régua de
 * functions/lib: só requer outras réguas puras; `npm run testar:cartao`).
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
 * A IMAGEM GRANDE (05/10/2026, modelos aprovados pelo dono): 1200×630, montada
 * pelo servidor com a cor, o logo e o nome do tio (`imagemDoCartao.js`, régua
 * do desenho em `reguaDaImagemDoCartao.js`). O og:image aponta para
 * `/cartao/tio/<uid>.png` ou `/cartao/app/<uid>.png` com um `?v=` que muda
 * quando a marca, a cor ou o logo mudam — o WhatsApp guarda a imagem pelo
 * endereço, e sem a versão o logo novo nunca apareceria. Sem uid válido, ou
 * sem marca, a imagem padrão do app.
 */

const { urlDaImagem } = require('./reguaDaImagemDoCartao');
const { idValido } = require('./reguaDosIds');

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

/**
 * A imagem grande do cartão — `tipo` é 'tio' (convite) ou 'app' (indicação).
 * Só o logo do próprio Storage entra na versão: o que não é confiável nem é
 * desenhado (`imagemDoCartao.js` confere de novo).
 */
function comImagem(base, tipo, { uid, marca, cor, logoURL } = {}) {
  if (!idValido(uid)) return { ...base, imagem: IMAGEM_PADRAO, imagemGrande: true };
  const logo = logoConfiavel(logoURL) ? logoURL : null;
  return { ...base, imagem: urlDaImagem(tipo, uid, { marca, cor, logoURL: logo }), imagemGrande: true };
}

/** O cartão do tio — texto "Direto" aprovado pelo dono. */
function cartaoDoConvite({ uid, marca, cor, logoURL } = {}) {
  const nome = marcaLimpa(marca);
  if (!nome) return { ...PADRAO };
  return comImagem({
    titulo: `${nome} te convidou para o app`,
    descricao: 'A perua, os avisos e a mensalidade no seu celular.',
  }, 'tio', { uid, marca, cor, logoURL });
}

/** O cartão do app — "indicado por" quem mandou (texto "Direto"). */
function cartaoDaIndicacao({ uid, marca, cor, logoURL } = {}) {
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
  }, 'app', { uid, marca, cor, logoURL });
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
 * og:url, twitter:card). A imagem é sempre a grande (1200×630); o ramo
 * `imagemGrande: false` tira as dimensões, porque dizer 1200×630 de uma
 * imagem quadrada faz o WhatsApp cortá-la.
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
  // O texto alternativo da imagem diz o que ela mostra: a marca dele, não a do app.
  if (cartao.imagem !== IMAGEM_PADRAO) troca('og:image:alt', cartao.titulo);
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
