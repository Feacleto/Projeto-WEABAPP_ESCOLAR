/**
 * A IMAGEM GRANDE DO CARTÃO DO LINK — quem responde `/cartao/tio/<uid>.png` e
 * `/cartao/app/<uid>.png` (rewrite `/cartao/**` do hosting do app, em
 * firebase.json). É o og:image que `cartaoDoLink` põe na prévia do WhatsApp.
 *
 * Lê `users/<uid>` (marca, cor e logo), baixa o logo, monta o SVG pela régua
 * pura (`reguaDaImagemDoCartao.js`) e o transforma em PNG com o resvg, com as
 * fontes da marca que vão junto no deploy (`functions/fontes/`, OFL). Sem
 * fonte do sistema: o servidor não tem as da marca, e o que ele tivesse
 * mudaria o desenho de uma máquina para outra.
 *
 * ── ⚠️ SÓ DE MOTORISTA, E NADA DA CRIANÇA
 * O uid está no endereço, e qualquer um pode trocá-lo. Por isso só sai
 * imagem de conta `role: 'admin'` com marca — o que ele já escolheu mostrar a
 * toda família dele. Qualquer outro uid recebe a imagem padrão do app, igual
 * a um uid que não existe: a imagem não diz se uma conta existe.
 *
 * ── ⚠️ QUALQUER FALHA DEVOLVE A IMAGEM PADRÃO
 * Um 302 para `/brand/og-image.png`, com cache curto — o cartão nunca fica
 * sem imagem por causa desta função, e a falha não fica guardada uma semana.
 * O logo que não baixa (ou não é JPEG/PNG) não derruba a imagem: no lugar
 * dele vão as iniciais.
 *
 * ── O CACHE É LONGO PORQUE O ENDEREÇO MUDA
 * O `?v=` do endereço muda quando a marca, a cor ou o logo mudam, então a
 * imagem de um endereço nunca muda: o CDN do hosting guarda por uma semana,
 * e a função quase não roda.
 */

const path = require('node:path');
const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { Resvg } = require('@resvg/resvg-js');
const LIMITES = require('./limites');
const { idValido } = require('./reguaDosIds');
const { IMAGEM_PADRAO, logoConfiavel } = require('./reguaDoCartao');
const { svgDoCartao, lerCaminho, LARGURA, FONTE_DO_TEXTO } = require('./reguaDaImagemDoCartao');

const REGION = 'southamerica-east1';

const FONTES = ['BricolageGrotesque-ExtraBold.ttf', 'InstrumentSans-Bold.ttf']
  .map((arquivo) => path.join(__dirname, '..', 'fontes', arquivo));

/** O logo sobe redimensionado pelo app; acima disto, alguém pôs outra coisa ali. */
const MAXIMO_DO_LOGO = 2 * 1024 * 1024;

/** O tipo pelo CONTEÚDO, não pelo cabeçalho: só JPEG e PNG entram. */
function tipoDaImagem(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

async function baixarLogo(url, buscar = fetch) {
  if (!logoConfiavel(url)) return null;
  try {
    const resp = await buscar(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const bytes = Buffer.from(await resp.arrayBuffer());
    if (bytes.length > MAXIMO_DO_LOGO) return null;
    const tipo = tipoDaImagem(bytes);
    return tipo ? `data:${tipo};base64,${bytes.toString('base64')}` : null;
  } catch (err) {
    logger.warn('imagemDoCartao: logo não baixou', { erro: err?.message });
    return null;
  }
}

function desenharPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: LARGURA },
    font: { fontFiles: FONTES, loadSystemFonts: false, defaultFontFamily: FONTE_DO_TEXTO },
  });
  return resvg.render().asPng();
}

/** O PNG do cartão, ou null (e aí quem chama manda a imagem padrão). */
async function imagemDoCaminho(db, caminho, { buscar = fetch } = {}) {
  const pedido = lerCaminho(caminho);
  if (!pedido || !idValido(pedido.uid)) return null;
  const snap = await db.doc(`users/${pedido.uid}`).get();
  if (!snap.exists) return null;
  const u = snap.data() || {};
  if (u.role !== 'admin' || !u.marcaNome) return null;
  const logo = await baixarLogo(u.marcaLogoURL, buscar);
  const svg = svgDoCartao({ tipo: pedido.tipo, marca: u.marcaNome, cor: u.marcaCor, logo });
  return svg ? desenharPng(svg) : null;
}

function makeImagemDoCartao(db, opcoes = {}) {
  return onRequest(
    { region: REGION, maxInstances: LIMITES.PUBLICO, invoker: 'public', memory: '256MiB' },
    async (req, res) => {
      let png = null;
      try {
        png = await imagemDoCaminho(db, String(req.path || ''), opcoes);
      } catch (err) {
        logger.warn('imagemDoCartao: imagem padrão', { erro: err?.message });
      }
      if (!png) {
        res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
        res.redirect(302, IMAGEM_PADRAO);
        return;
      }
      res.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      res.set('X-Robots-Tag', 'noindex');
      res.status(200).type('image/png').send(png);
    }
  );
}

module.exports = { makeImagemDoCartao, imagemDoCaminho, tipoDaImagem };
