/**
 * O CARTÃO DO LINK NO WHATSAPP — quem responde `/convite/**` e
 * `/quero-fazer-parte` (rewrite do hosting do app, em firebase.json).
 *
 * Devolve o MESMO index.html do app, com as tags de prévia trocadas pela
 * marca do tio certo (a régua e o porquê estão em `reguaDoCartao.js`). Para a
 * pessoa nada muda: é o app de sempre, no endereço de sempre. Para o robô do
 * WhatsApp, que não roda JavaScript, o cartão passa a dizer quem mandou.
 *
 * ── ⚠️ O PREÇO É UMA FUNÇÃO NO CAMINHO DA MÃE
 * O convite é a porta de entrada da família, e agora ele passa por aqui:
 * função fria custa um ou dois segundos na primeira abertura. Por isso este
 * arquivo faz o MÍNIMO — uma leitura do index.html e no máximo duas do banco
 * — e QUALQUER falha devolve a página com o cartão padrão, nunca um erro.
 * Falhar aqui não pode impedir ninguém de abrir o convite.
 *
 * ── ⚠️ O index.html NÃO É GUARDADO EM MEMÓRIA
 * Depois de um deploy os arquivos do app mudam de nome; um index.html velho
 * em memória apontaria para arquivos que não existem mais, e a tela ficaria
 * branca. Buscar a cada vez custa uma ida ao CDN do próprio hosting.
 *
 * ── O LIMITE DE TENTATIVAS É O DO CONVITE PÚBLICO
 * O cartão diz a marca de um código válido; sem limite, ele viraria um jeito
 * de varrer códigos. Conta só o código que não vale (como `getInvitePreview`),
 * e estourar o limite não bloqueia ninguém: só serve o cartão padrão.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const limite = require('./limiteDeTentativas');
const { REGRAS } = require('./reguaDasTentativas');
const { normalizarCodigo, codigoValido, conviteVencido } = require('./reguaDoConvite');
const { PADRAO, cartaoDoConvite, cartaoDaIndicacao, trocarTagsDaPrevia } = require('./reguaDoCartao');

const REGION = 'southamerica-east1';
const SITE = 'https://alobuzinou.com';

// Só os endereços do próprio app: `x-forwarded-host` vem da requisição, e
// sem a lista quem chamasse a função direto escolheria de onde ela busca.
const HOSTS_DO_APP = ['alobuzinou.com', 'www.alobuzinou.com', 'alobuzinou-be81f.web.app', 'alobuzinou-be81f.firebaseapp.com'];

async function buscarIndex(host) {
  const base = HOSTS_DO_APP.includes(host) ? `https://${host}` : SITE;
  const resp = await fetch(`${base}/index.html`, { headers: { 'cache-control': 'no-cache' } });
  if (!resp.ok) throw new Error(`index.html respondeu ${resp.status}`);
  return resp.text();
}

async function marcaDe(db, uid) {
  if (!uid || typeof uid !== 'string' || uid.includes('/')) return null;
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const u = snap.data() || {};
  return { marca: u.marcaNome || '', logoURL: u.marcaLogoURL || null };
}

async function cartaoDoCaminho(db, req) {
  const caminho = String(req.path || '');
  const quem = limite.quemPeloIp(req);

  if (caminho.startsWith('/convite/')) {
    const codigo = normalizarCodigo(caminho.slice('/convite/'.length));
    if (!(await limite.aindaCabe(db, REGRAS.CONVITE_PUBLICO, quem))) return { ...PADRAO };
    const recusar = async () => {
      await limite.contar(db, REGRAS.CONVITE_PUBLICO, quem);
      return { ...PADRAO };
    };
    if (!codigoValido(codigo)) return recusar();
    const snap = await db.collection('children').where('inviteCode', '==', codigo).limit(1).get();
    if (snap.empty) return recusar();
    const crianca = snap.docs[0].data() || {};
    if (crianca.active === false) return recusar();
    // Convite ainda não usado e vencido: cartão padrão. O já usado continua
    // sendo a porta de volta da família, e o cartão dele segue o do tio.
    const usado = crianca.inviteStatus !== 'pending' || !!crianca.parentUid;
    if (!usado && conviteVencido(crianca, Date.now())) return recusar();
    return cartaoDoConvite((await marcaDe(db, crianca.adminUid)) || {});
  }

  // /quero-fazer-parte — a indicação. Sem cupom (ou cupom desconhecido), o
  // cartão do app sem "indicado por".
  const cupom = String(req.query?.cupom || '').trim().toUpperCase().slice(0, 20);
  if (!/^[A-Z0-9-]{4,20}$/.test(cupom)) return cartaoDaIndicacao();
  const snap = await db.collection('users').where('codigoDeIndicacao', '==', cupom).limit(1).get();
  if (snap.empty) return cartaoDaIndicacao();
  const u = snap.docs[0].data() || {};
  return cartaoDaIndicacao({ marca: u.marcaNome, logoURL: u.marcaLogoURL });
}

function makeCartaoDoLink(db, { buscar = buscarIndex } = {}) {
  return onRequest(
    { region: REGION, maxInstances: LIMITES.PUBLICO, invoker: 'public', memory: '256MiB' },
    async (req, res) => {
      const host = req.get('x-forwarded-host') || null;
      const url = `${SITE}${req.originalUrl || req.url || '/'}`;
      let html;
      try {
        html = await buscar(host);
      } catch (err) {
        // Sem o index.html não há página para devolver. Raro (é o próprio
        // hosting), e o 503 faz o navegador tentar de novo.
        logger.error('cartaoDoLink: sem index.html', { erro: err?.message });
        res.set('Retry-After', '2').status(503).send('Tente de novo em instantes.');
        return;
      }
      let cartao = { ...PADRAO };
      try {
        cartao = await cartaoDoCaminho(db, req);
      } catch (err) {
        logger.warn('cartaoDoLink: cartão padrão', { erro: err?.message });
      }
      res.set('Cache-Control', 'no-cache, max-age=0');
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.status(200).type('html').send(trocarTagsDaPrevia(html, cartao, url));
    }
  );
}

module.exports = { makeCartaoDoLink };
