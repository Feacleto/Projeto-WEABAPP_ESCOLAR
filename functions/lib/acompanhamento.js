/**
 * O LINK DO DIA — quem vai pegar a criança acompanha a entrega, sem conta.
 *
 * O PROBLEMA
 * O pai indica que hoje quem pega é a avó. O app avisa o MOTORISTA
 * (`alt_pickup`) e não avisa a avó de nada: ela fica na calçada sem saber se a
 * perua já saiu, se a criança embarcou, se falta muito. O telefone dela já
 * está no app — o pai acabou de digitar — e mesmo assim o único jeito de ela
 * saber alguma coisa é ligar pro pai, que liga pro motorista.
 *
 * ── ⚠️ POR QUE ELA NÃO GANHA UMA CONTA
 * Ela vai pegar a criança UMA TARDE. Uma conta é uma credencial que sobrevive
 * à tarde, e ninguém remove o que criou pra uma tarde. O link morre à
 * meia-noite sozinho.
 *
 * ── ⚠️ E POR QUE ELE NÃO ABRE SESSÃO NO FIREBASE
 * Sessão significa rules decidindo o que ela alcança, e rules são um alfabeto
 * de "pode ler o documento X". O que ela pode ver não é um documento: é meia
 * dúzia de campos de três documentos diferentes. Uma callable pública
 * devolvendo uma lista fechada é a única forma de a resposta ser exatamente
 * essa — o mesmo desenho do `getInvitePreview`, e pelo mesmo motivo.
 *
 * ── ⚠️ O TOKEN CARREGA O ENDEREÇO E GUARDA O SEGREDO SEPARADO
 * Formato: `AAAA-MM-DD_childId.SEGREDO`. A primeira metade é só endereçamento
 * — ela diz qual documento abrir, e não protege nada. Quem protege é o
 * SEGREDO: 32 bytes aleatórios, comparados contra um SHA-256 guardado no
 * documento da indicação.
 *
 * Isso evita uma coleção inteira: sem a metade endereçável, achar o documento
 * exigiria consultar por hash, o que pede índice, regra e mais superfície. E
 * evita o pior detalhe — guardar o token em claro no banco.
 *
 * ── ⚠️ A REVOGAÇÃO JÁ EXISTIA, E NÃO PRECISOU DE CÓDIGO
 * O hash mora em `altPickups/{dia}_{crianca}`, que é o documento que o pai
 * apaga quando toca em "Trocar" (`clearDailyAltPickup`) e que ele SOBRESCREVE
 * quando indica outra pessoa (`setDailyAltPickup` usa `setDoc` sem merge).
 * Nos dois casos o hash some junto e o link para de responder no mesmo
 * instante. Gerar de novo também invalida o anterior, pelo mesmo caminho.
 *
 * ── ⚠️ O CAMINHO PÚBLICO NUNCA ESCREVE
 * `verAcompanhamento` só lê. Contador de acesso seria uma escrita disparada
 * por quem não tem conta — ou seja, um endpoint público que grava, que é como
 * se paga uma conta de Firestore sem ninguém ter feito nada errado.
 */

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const crypto = require('node:crypto');
const LIMITES = require('./limites');
const {
  chaveDoDia,
  acessoValido,
  montarAcompanhamento,
} = require('./reguaDoAcompanhamento');

const REGION = 'southamerica-east1';

/** Bytes de segredo. 32 = 256 bits: varredura não é um plano. */
const BYTES_DO_SEGREDO = 32;

function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

/**
 * Comparação de tempo constante.
 *
 * `a === b` num hash vaza, pelo tempo de resposta, quantos caracteres
 * bateram. É defesa barata e o caso aqui é público — vale pagar.
 */
function mesmoHash(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length || x.length === 0) return false;
  return crypto.timingSafeEqual(x, y);
}

function idDaIndicacao(dateKey, childId) {
  return `${dateKey}_${childId}`;
}

/** `AAAA-MM-DD_childId.SEGREDO` → as três partes, ou null. */
function lerToken(bruto) {
  const texto = String(bruto || '').trim();
  const ponto = texto.indexOf('.');
  if (ponto < 1 || ponto === texto.length - 1) return null;
  const endereco = texto.slice(0, ponto);
  const segredo = texto.slice(ponto + 1);
  const corte = endereco.indexOf('_');
  if (corte < 1) return null;
  const dateKey = endereco.slice(0, corte);
  const childId = endereco.slice(corte + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  if (!childId || childId.length > 200 || segredo.length > 200) return null;
  return { dateKey, childId, segredo, endereco };
}

/**
 * gerarAcessoDoDia — o pai cria o link para quem vai pegar hoje.
 *
 * Exige que a indicação do dia JÁ EXISTA: o link é sobre uma pessoa concreta,
 * e sem ela não há o que compartilhar nem o que revogar depois.
 */
function makeGerarAcessoDoDia(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');

    const childId = String((request.data && request.data.childId) || '').trim();
    if (!childId) throw new HttpsError('invalid-argument', 'Criança não informada.');

    const childSnap = await db.doc(`children/${childId}`).get();
    if (!childSnap.exists) throw new HttpsError('not-found', 'Criança não encontrada.');

    // ⚠️ O ESCOPO É O `parentUid` DA CRIANÇA, e vem do BANCO — nunca de
    // `request.data`. É a mesma regra dos outros callables do projeto.
    if (childSnap.data().parentUid !== uid) {
      throw new HttpsError('permission-denied', 'Esta criança não é da sua conta.');
    }

    const dateKey = chaveDoDia();
    const ref = db.doc(`altPickups/${idDaIndicacao(dateKey, childId)}`);
    const indicacao = await ref.get();
    if (!indicacao.exists) {
      throw new HttpsError(
        'failed-precondition',
        'Indique primeiro quem vai pegar a criança hoje.'
      );
    }

    const segredo = crypto.randomBytes(BYTES_DO_SEGREDO).toString('base64url');
    // Só o HASH vai pro banco. O segredo existe uma vez, nesta resposta.
    // Gerar de novo troca o hash e derruba o link anterior — é a rotação.
    await ref.update({ acessoHash: sha256(segredo) });

    logger.info(`acesso do dia gerado: child=${childId} dia=${dateKey}`);
    return { token: `${idDaIndicacao(dateKey, childId)}.${segredo}` };
  });
}

/**
 * verAcompanhamento — a página pública lê por aqui.
 *
 * ⚠️ UMA MENSAGEM SÓ PARA TODAS AS RECUSAS. Link inexistente, link de ontem,
 * indicação removida e segredo errado respondem a mesma coisa. Diferenciar
 * conta a quem está sondando que o endereço existe — a mesma discrição que o
 * `lookupInvite` já pratica.
 */
function makeVerAcompanhamento(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const recusa = () =>
      new HttpsError('not-found', 'Este link não vale mais. Peça um novo a quem te mandou.');

    const partes = lerToken(request.data && request.data.token);
    if (!partes) throw recusa();

    const ref = db.doc(`altPickups/${partes.endereco}`);
    const snap = await ref.get();
    if (!snap.exists) throw recusa();
    const indicacao = snap.data();

    if (!mesmoHash(indicacao.acessoHash, sha256(partes.segredo))) throw recusa();

    const veredito = acessoValido({
      acesso: { dateKey: partes.dateKey, childId: partes.childId },
      altPickup: indicacao,
    });
    if (!veredito.ok) {
      logger.info(`acesso recusado: ${veredito.motivo} dia=${partes.dateKey}`);
      throw recusa();
    }

    const childSnap = await db.doc(`children/${partes.childId}`).get();
    if (!childSnap.exists) throw recusa();
    const child = childSnap.data();

    // Criança desativada não tem mais acompanhamento — e o link não pode
    // sobreviver à saída dela da perua.
    if (child.active === false) throw recusa();

    const [rideSnap, motoristaSnap] = await Promise.all([
      db.doc(`children/${partes.childId}/rides/${partes.dateKey}`).get(),
      child.adminUid ? db.doc(`users/${child.adminUid}`).get() : Promise.resolve(null),
    ]);

    return montarAcompanhamento({
      child,
      ride: rideSnap.exists ? rideSnap.data() : null,
      motorista: motoristaSnap && motoristaSnap.exists ? motoristaSnap.data() : null,
    });
  });
}

module.exports = { makeGerarAcessoDoDia, makeVerAcompanhamento, lerToken, sha256 };
