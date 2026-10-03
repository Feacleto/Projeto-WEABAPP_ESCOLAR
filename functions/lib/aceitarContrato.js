/**
 * A FAMÍLIA ACEITA O CONTRATO — pelo servidor (02/10/2026).
 *
 * ── POR QUE NÃO PELO CLIENTE, COMO ERA
 * O aceite era gravado pelo celular da família nos campos da criança, com um
 * hash calculado ali mesmo sobre um contrato remontado na hora (com a hora da
 * abertura dentro). O hash não podia ser conferido nunca mais, e o motorista
 * conseguia reescrever os campos. Aqui:
 *
 *   - o contrato aceito é o DOCUMENTO GRAVADO (`children/{id}/contratos/{n}`),
 *     que ninguém edita depois de emitido;
 *   - o hash é tirado pelo servidor do JSON CANÔNICO desse documento — quem
 *     quiser conferir refaz a conta sobre o mesmo dado;
 *   - a versão anterior vira `substituido` no mesmo lote;
 *   - no ADITIVO, os valores novos (mensalidade, vencimento, vigência) só
 *     passam a valer na criança AGORA — a cobrança do mês continua lendo
 *     `monthlyFee`/`dueDay`, e eles não mudam antes de a família concordar.
 */
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { jsonCanonico, valoresDoAditivo } = require('./reguaDoContrato');
const { idValido } = require('./reguaDosIds');

const REGION = 'southamerica-east1';

function makeAceitarContrato(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    const numero = Number(request.data?.numero);
    const nome = String(request.data?.nome || '').trim().slice(0, 120);
    // `idValido` antes de virar caminho: `db.doc` aceita barra, e um
    // `childId` com "/" endereçaria outro documento (ver reguaDosIds.js).
    if (!idValido(childId) || !Number.isInteger(numero) || numero < 1 || numero > 100000) {
      throw new HttpsError('invalid-argument', 'Qual contrato?');
    }
    if (nome.split(/\s+/).filter(Boolean).length < 2) {
      throw new HttpsError('invalid-argument', 'Digite o nome completo.');
    }
    const userAgent = String(request.rawRequest?.headers?.['user-agent'] || '').slice(0, 300);

    const childRef = db.doc(`children/${childId}`);
    const contratoRef = childRef.collection('contratos').doc(String(numero));

    return db.runTransaction(async (tx) => {
      const [cSnap, kSnap] = await Promise.all([tx.get(childRef), tx.get(contratoRef)]);
      const crianca = cSnap.exists ? cSnap.data() : null;
      if (!crianca) throw new HttpsError('not-found', 'Criança não encontrada.');
      if (crianca.parentUid !== uid) {
        throw new HttpsError('permission-denied', 'Este contrato não é seu.');
      }
      const contrato = kSnap.exists ? kSnap.data() : null;
      if (!contrato || contrato.status !== 'aguardando' || crianca.contratoAguardando !== numero) {
        throw new HttpsError(
          'failed-precondition',
          'Este contrato mudou enquanto você lia. Abra de novo para ver o atual.'
        );
      }
      const anterior = crianca.contratoVigente?.numero;
      const antRef = anterior ? childRef.collection('contratos').doc(String(anterior)) : null;
      const antSnap = antRef ? await tx.get(antRef) : null;

      const hash = crypto.createHash('sha256').update(jsonCanonico(contrato.dados)).digest('hex');
      const agora = Timestamp.now();

      tx.update(contratoRef, {
        status: 'aceito',
        aceitoEm: agora,
        aceitoPorUid: uid,
        aceitoNome: nome,
        aceitoUserAgent: userAgent,
        hash,
        // A versão aceita passa a ser DESTA família — a próxima não a lê.
        familia: uid,
      });
      if (antSnap?.exists && antSnap.data().status === 'aceito') {
        tx.update(antRef, { status: 'substituido', substituidoPor: numero });
      }
      const periodo = contrato.dados?.period || {};
      tx.update(childRef, {
        ...(contrato.tipo === 'aditivo' ? valoresDoAditivo(contrato.novosValores) : {}),
        contratoAguardando: null,
        contratoVigente: {
          numero,
          tipo: contrato.tipo || 'contrato',
          aceitoEm: agora,
          aceitoNome: nome,
          inicio: periodo.inicio || null,
          fim: periodo.fim || null,
          hash,
        },
        // Os campos antigos continuam escritos: telas e rules que ainda os
        // leem passam a ler o aceite de verdade, do servidor.
        contractVersion: contrato.dados?.version || 1,
        contractAcceptedAt: agora,
        contractAcceptedByUid: uid,
        contractAcceptedName: nome,
        contractHash: hash,
        contractUserAgent: userAgent,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, numero, hash };
    });
  });
}

module.exports = { makeAceitarContrato };
