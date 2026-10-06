const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const LIMITES = require('./limites');
const { carregarUsuario, exigirDono } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const { cobrancaLigada } = require('./cobrancaLigada');
const { chaveDoDia } = require('./reguaDoAcompanhamento');
const {
  ACAO,
  PAPEL,
  avisoAoAlvo,
  avisoAoTio,
  efeitoNaConta,
  linhaDoRegistro,
  tiosParaAvisar,
  validarPedido,
} = require('./reguaDoRegistro');

const REGION = 'southamerica-east1';

/**
 * SUSPENDER, REATIVAR OU AVISAR UM MOTORISTA OU UMA FAMÍLIA — e deixar o rastro.
 *
 * Substitui o `setDoc` do dono em `users.suspenso` (as rules deixaram de
 * aceitar essa escrita pelo cliente). Tudo numa TRANSAÇÃO só, para que nunca
 * exista suspensão sem registro, nem registro sem suspensão.
 *
 * MOTORISTA:
 *   users/{alvo}           suspenso + suspensoEm (nada no "aviso")
 *   taxaParceiros/{alvo}   suspensaoAte (o prazo; só o dono lê)
 *   registroDoDono/{id}    a linha: quem, quando, motivo, evidência
 *   notifications/{id}     o aviso ao alvo: a MENSAGEM e o prazo de resposta
 *
 * FAMÍLIA (05/10/2026, alternativa A do dono):
 *   users/{alvo}           bloqueio = { grau, ate, desde } — SEM motivo
 *   registroDoDono/{id}    a linha, com o motivo e a evidência
 *   notifications/{id}     UM aviso por TIO de cada criança dela: "A família de
 *                          Ana está sem os avisos do app. Combine por telefone."
 *   e, DEPOIS do commit:   a conta desativada no Firebase Auth (e os tokens de
 *                          renovação revogados), os links de 24 horas das
 *                          crianças dela encerrados e o link de quem busca hoje
 *                          derrubado — senão o "não recebe avisos" vazaria pela
 *                          porta do lado.
 * À família não vai aviso no app (ela não entra mais): a mensagem chega por
 * e-mail, e a callable devolve o endereço para a tela abrir o e-mail do dono.
 *
 * A criança continua na turma, o tio continua marcando, e contrato e
 * mensalidade não são tocados. A régua (listas fechadas, quem pode ser alvo,
 * o texto) é pura e mora em `reguaDoRegistro.js`. O escopo é o uid
 * AUTENTICADO, nunca um campo de `request.data`.
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

      const { pedido, alvo, criancas } = await db.runTransaction(async (tx) => {
        const snap = await tx.get(refAlvo);
        if (!snap.exists) throw new HttpsError('not-found', 'Conta não encontrada.');
        const alvoLido = snap.data();

        const r = validarPedido(request.data, { cobrancaLigada: ligada, donoUid, alvo: alvoLido });
        if (!r.ok) throw new HttpsError('failed-precondition', r.erro);
        const p = r.pedido;
        const daFamilia = p.alvoPapel === PAPEL.FAMILIA;

        // As crianças da família são lidas DENTRO da transação: o aviso ao tio
        // sai de quem está na turma agora.
        const filhos = daFamilia
          ? (await tx.get(db.collection('children').where('parentUid', '==', alvoUid))).docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          : [];

        const efeito = efeitoNaConta(p);
        if (efeito && daFamilia) {
          tx.set(
            refAlvo,
            {
              bloqueio: efeito.bloqueio
                ? { ...efeito.bloqueio, desde: FieldValue.serverTimestamp() }
                : FieldValue.delete(),
            },
            { merge: true }
          );
        } else if (efeito) {
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
          ...linhaDoRegistro(p, { donoUid, donoNome: dono?.name || null, alvo: alvoLido }),
          em: FieldValue.serverTimestamp(),
        });

        if (daFamilia) {
          // O aviso vai ao TIO, uma vez por tio, e só quando o estado muda
          // (suspender ou reativar). O "aviso" à família não mexe nos avisos.
          if (p.acao !== ACAO.AVISO) {
            for (const { tioUid, nomes } of tiosParaAvisar(filhos)) {
              const texto = avisoAoTio({ acao: p.acao, nomes });
              tx.set(db.collection('notifications').doc(), {
                userId: tioUid,
                type: texto.type,
                title: texto.title,
                body: texto.body,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }
        } else {
          const aviso = avisoAoAlvo(p);
          tx.set(db.collection('notifications').doc(), {
            userId: alvoUid,
            type: aviso.type,
            title: aviso.title,
            body: aviso.body,
            respostaAte: aviso.respostaAte || null,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return { pedido: p, alvo: alvoLido, criancas: filhos };
      });

      if (pedido.alvoPapel === PAPEL.FAMILIA && pedido.acao !== ACAO.AVISO) {
        await aplicarNaContaDaFamilia(db, { alvoUid, pedido, criancas });
      }

      logger.info('[registro] ação do dono', {
        acao: pedido.acao,
        papel: pedido.alvoPapel,
        alvoUid,
        donoUid,
        registro: refRegistro.id,
      });
      return {
        ok: true,
        registro: refRegistro.id,
        // Para a tela abrir o e-mail do DONO com a mensagem pronta: a família
        // não entra mais no app, então a mensagem chega por e-mail.
        email: pedido.alvoPapel === PAPEL.FAMILIA ? alvo.email || null : null,
      };
    }
  );
}

/**
 * O que acontece FORA da transação, depois do commit, na conta da família.
 * Cada passo falha sozinho (com log) sem desfazer o registro: o registro diz o
 * que foi decidido, e o log diz o que faltou aplicar.
 */
async function aplicarNaContaDaFamilia(db, { alvoUid, pedido, criancas }) {
  const suspender = pedido.acao === ACAO.SUSPENDER;
  try {
    await getAuth().updateUser(alvoUid, { disabled: suspender });
    // Revogar faz o token de RENOVAÇÃO morrer. O token já emitido ainda vale
    // até 1 h — essa hora está escrita na Política de bloqueio.
    if (suspender) await getAuth().revokeRefreshTokens(alvoUid);
  } catch (err) {
    logger.error('[registro] o Auth da família não foi atualizado', { alvoUid, err: err?.message });
  }
  if (!suspender) return;

  const ids = criancas.map((c) => c.id).filter(Boolean);
  const hoje = chaveDoDia();
  for (const childId of ids) {
    try {
      const abertos = await db
        .collection('acessosTemporarios')
        .where('childId', '==', childId)
        .where('revogadoEm', '==', null)
        .get();
      const lote = db.batch();
      abertos.docs.forEach((d) => lote.update(d.ref, { revogadoEm: FieldValue.serverTimestamp(), fcmTokens: [] }));
      // O link de quem busca HOJE morre junto: sem o hash, o token não abre.
      const indicacao = db.doc(`altPickups/${hoje}_${childId}`);
      if ((await indicacao.get()).exists) lote.update(indicacao, { acessoHash: FieldValue.delete() });
      await lote.commit();
    } catch (err) {
      logger.error('[registro] links da criança não foram encerrados', { childId, err: err?.message });
    }
  }
}

module.exports = { makeSuspenderConta, aplicarNaContaDaFamilia };
