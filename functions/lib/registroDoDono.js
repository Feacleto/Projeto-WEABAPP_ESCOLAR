const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { carregarUsuario, exigirDono } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const { cobrancaLigada } = require('./cobrancaLigada');
const {
  avisoAoAlvo,
  efeitoNaConta,
  linhaDoRegistro,
  validarPedido,
} = require('./reguaDoRegistro');

const REGION = 'southamerica-east1';

/**
 * SUSPENDER, REATIVAR OU AVISAR UM MOTORISTA — e deixar o rastro.
 *
 * Substitui o `setDoc` do dono em `users.suspenso` (as rules deixaram de
 * aceitar essa escrita pelo cliente). Tudo numa TRANSAÇÃO só, para que nunca
 * exista suspensão sem registro, nem registro sem suspensão:
 *
 *   users/{alvo}           suspenso + suspensoEm (nada no "aviso")
 *   taxaParceiros/{alvo}   suspensaoAte (o prazo; só o dono lê)
 *   registroDoDono/{id}    a linha: quem, quando, motivo, evidência
 *   notifications/{id}     o aviso ao alvo: a MENSAGEM e o prazo de resposta
 *
 * A régua (listas fechadas, quem pode ser alvo, o texto) é pura e mora em
 * `reguaDoRegistro.js` — leia o cabeçalho de lá antes de mexer aqui.
 * O escopo é o uid AUTENTICADO, nunca um campo de `request.data`.
 */
function makeSuspenderConta(db) {
  return onCall(
    { ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const donoUid = await exigirDono(db, request);
      const { dados: dono } = await carregarUsuario(db, request);
      const ligada = await cobrancaLigada(db);

      const alvoUid = request.data?.alvoUid;
      // O id vira CAMINHO logo abaixo (o documento do alvo em users): passa pela régua
      // dos ids antes, como toda callable (`testar:irmaos`).
      if (!idValido(alvoUid)) throw new HttpsError('invalid-argument', 'Qual conta?');
      // A validação roda duas vezes: antes, para não abrir transação com um
      // pedido torto; e dentro, com o alvo lido na transação.
      const previa = validarPedido(request.data, { cobrancaLigada: ligada, donoUid });
      if (!previa.ok) throw new HttpsError('invalid-argument', previa.erro);

      const refAlvo = db.doc(`users/${alvoUid}`);
      const refRegistro = db.collection('registroDoDono').doc();
      const refAviso = db.collection('notifications').doc();

      const pedido = await db.runTransaction(async (tx) => {
        const snap = await tx.get(refAlvo);
        if (!snap.exists) throw new HttpsError('not-found', 'Conta não encontrada.');
        const alvo = snap.data();

        const r = validarPedido(request.data, { cobrancaLigada: ligada, donoUid, alvo });
        if (!r.ok) throw new HttpsError('failed-precondition', r.erro);
        const p = r.pedido;

        const efeito = efeitoNaConta(p);
        if (efeito) {
          tx.set(
            refAlvo,
            {
              suspenso: efeito.suspenso,
              suspensoEm: efeito.suspenso ? FieldValue.serverTimestamp() : null,
            },
            { merge: true }
          );
          tx.set(
            db.doc(`taxaParceiros/${alvoUid}`),
            { suspensaoAte: efeito.suspenso ? p.ate : null },
            { merge: true }
          );
        }

        tx.set(refRegistro, {
          ...linhaDoRegistro(p, { donoUid, donoNome: dono?.name || null, alvo }),
          em: FieldValue.serverTimestamp(),
        });

        const aviso = avisoAoAlvo(p);
        tx.set(refAviso, {
          userId: alvoUid,
          type: aviso.type,
          title: aviso.title,
          body: aviso.body,
          respostaAte: aviso.respostaAte || null,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        return p;
      });

      logger.info('[registro] ação do dono', {
        acao: pedido.acao,
        alvoUid,
        donoUid,
        registro: refRegistro.id,
      });
      return { ok: true, registro: refRegistro.id };
    }
  );
}

module.exports = { makeSuspenderConta };
