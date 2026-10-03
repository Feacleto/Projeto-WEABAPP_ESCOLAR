/**
 * Envio de push quando nasce uma notificação — o aviso com o APP FECHADO.
 *
 * Amarramos no gatilho de criação de `notifications/{id}` em vez de mandar
 * push em cada lugar que cria notificação: assim todo aviso do app ganha
 * push de graça, e não há risco de um caminho novo esquecer de enviar.
 *
 * ── O QUE MUDOU EM 03/10/2026, E POR QUÊ
 *
 *   1. ⚠️ O LINK ERA RELATIVO ("/pai"). O FCM exige HTTPS absoluto em
 *      `fcmOptions.link` e recusa a mensagem com `invalid-argument` — que este
 *      arquivo tratava como TOKEN MORTO e apagava do usuário. O primeiro
 *      envio tirava o aparelho da pessoa da lista, para sempre e em silêncio.
 *      Hoje o endereço é inteiro (`urlDoAviso`) e só os dois códigos que dizem
 *      "este token não existe mais" apagam token.
 *
 *   2. ⚠️ A MENSAGEM SÓ TEM DADOS, sem o bloco `notification`. Com ele, o SDK
 *      do navegador mostrava o aviso sozinho E o `onBackgroundMessage` do
 *      service worker mostrava outro: dois avisos iguais por evento. Agora
 *      quem desenha é o worker, sempre, com a etiqueta (`tag`) que faz o
 *      "está chegando" ser substituído pelo "chegou" em vez de empilhar.
 *
 *   3. O DESTINO SAI DE UMA TABELA SÓ (`destinoDoAviso`), a mesma do sino, e
 *      depende do PAPEL de quem recebe. Mais de dez tipos abriam "/" — que
 *      manda para o login.
 *
 *   4. O ACESSO DE 24 HORAS do segundo responsável recebe os avisos da ROTA
 *      do filho (`acessosTemporarios`), sem conta e só enquanto vale.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { tocaNoAparelho } = require('./avisos');
const { urlDoAviso, ORIGEM_DO_APP } = require('./destinoDoAviso');
const { TIPOS_DO_ACESSO_TEMPORARIO, acessoTemporarioValendo } = require('./reguaDoAcessoTemporario');
const { enviarEmailSeFor } = require('./enviarEmailDoAviso');

const REGION = 'southamerica-east1';

/** Só estes dois dizem que o token morreu. Qualquer outro erro é da MENSAGEM. */
const TOKEN_MORTO = ['registration-token-not-registered', 'invalid-registration-token'];

/**
 * Avisos que se SUBSTITUEM no aparelho, em vez de empilhar: a perua chegando
 * e depois chegando de novo é uma notícia só, a mais nova.
 */
function etiquetaDoAviso(notif) {
  const crianca = notif.childId || 'familia';
  if (notif.type === 'perua_chegando' || notif.type === 'perua_chegou') return `perua_${crianca}`;
  if (notif.type === 'buzina') return `buzina_${crianca}`;
  return String(notif.type || 'aviso');
}

function mensagem({ tokens, notif, url, notifId }) {
  return {
    tokens,
    data: {
      title: String(notif.title || ''),
      body: String(notif.body || ''),
      url,
      type: String(notif.type || ''),
      notifId: String(notifId || ''),
      tag: etiquetaDoAviso(notif),
      // A buzina insiste: fica na tela até alguém tocar.
      insistente: notif.type === 'buzina' ? '1' : '',
    },
    webpush: {
      // Alta urgência acorda o aparelho em economia de bateria — o aviso da
      // perua chegando não pode chegar depois da perua.
      headers: { Urgency: 'high', TTL: notif.type === 'buzina' ? '900' : '86400' },
    },
  };
}

function tokensMortos(response, tokens) {
  const dead = [];
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = (r.error && r.error.code) || '';
    if (TOKEN_MORTO.some((m) => code.includes(m))) dead.push(tokens[i]);
    else logger.warn('[push] envio recusado (token mantido)', { code });
  });
  return dead;
}

/** Os aparelhos do acesso de 24h ligado a esta família, se o aviso é da rota. */
async function aparelhosDoAcessoTemporario(db, notif) {
  if (!TIPOS_DO_ACESSO_TEMPORARIO.includes(notif.type)) return [];
  const snap = await db
    .collection('acessosTemporarios')
    .where('parentUid', '==', notif.userId)
    .get();
  const agora = Date.now();
  const saida = [];
  for (const d of snap.docs) {
    const a = d.data();
    if (!acessoTemporarioValendo(a, agora)) continue;
    if (notif.childId && a.childId !== notif.childId) continue;
    for (const t of a.fcmTokens || []) saida.push({ token: t, ref: d.ref });
  }
  return saida;
}

/**
 * `email` — { chave, remetente }: o segredo do Resend e o remetente. O e-mail
 * da cobrança da plataforma sai daqui, no mesmo gatilho (`enviarEmailDoAviso`).
 */
function makeSendPushOnNotification(db, email) {
  return onDocumentCreated(
    {
      document: 'notifications/{notifId}',
      region: REGION,
      maxInstances: LIMITES.GATILHO,
      secrets: email ? [email.chave] : [],
    },
    async (event) => {
      const notif = event.data && event.data.data();
      if (!notif || !notif.userId || !notif.title) return;
      const notifId = event.params.notifId;

      const userSnap = await db.doc(`users/${notif.userId}`).get();
      if (!userSnap.exists) return;
      const usuario = userSnap.data();

      // A cobrança da plataforma também por e-mail — antes da preferência,
      // que só cala o PUSH (ver enviarEmailDoAviso.js).
      if (email) {
        await enviarEmailSeFor({ aviso: notif, usuario, notifId, ...email });
      }

      if (!tocaNoAparelho(notif.type, usuario.avisosDesligados)) {
        logger.info('[push] calado por preferência', { tipo: notif.type, notifId });
      } else {
        const tokens = Array.isArray(usuario.fcmTokens) ? usuario.fcmTokens : [];
        if (tokens.length) {
          const url = urlDoAviso(notif, usuario.role);
          const response = await admin
            .messaging()
            .sendEachForMulticast(mensagem({ tokens, notif, url, notifId }));
          const dead = tokensMortos(response, tokens);
          if (dead.length) {
            await userSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) });
          }
          logger.info(
            `Push: ok=${response.successCount} falhou=${response.failureCount} removidos=${dead.length}`
          );
        }
      }

      // O SEGUNDO RESPONSÁVEL, com o acesso de 24h. A preferência da titular
      // não vale para ele: avisos da rota são todos `fato`, que não desligam.
      try {
        const temporarios = await aparelhosDoAcessoTemporario(db, notif);
        if (temporarios.length) {
          const tokens = temporarios.map((t) => t.token);
          const response = await admin.messaging().sendEachForMulticast(
            mensagem({ tokens, notif, url: `${ORIGEM_DO_APP}/acompanhar`, notifId })
          );
          const dead = tokensMortos(response, tokens);
          for (const t of temporarios.filter((x) => dead.includes(x.token))) {
            await t.ref.update({ fcmTokens: FieldValue.arrayRemove(t.token) });
          }
        }
      } catch (err) {
        logger.warn('[push] acesso temporário falhou', err);
      }
    }
  );
}

module.exports = { makeSendPushOnNotification, etiquetaDoAviso, TOKEN_MORTO };
