/**
 * A FAMÍLIA INFORMA O TELEFONE DA ESCOLA (03/10/2026, pedido do dono).
 *
 * O telefone da escola é opcional, e qualquer um dos dois lados pode
 * cadastrá-lo: o motorista (no cadastro da escola, pelo cliente) ou a família
 * (aqui). Quem cadastra, mostra para os outros — o motorista e as outras
 * famílias daquela escola, na turma dele.
 *
 * ── POR QUE É FUNCTION
 * A família não lê nem escreve `schools/{id}` (as rules são do motorista), e
 * abrir isso a ela entregaria a lista de escolas dele. O que ela faz aqui é
 * provar que a criança é DELA; o servidor grava o número na escola e o COPIA
 * para cada criança daquela escola (`children.schoolPhone`), que é onde a
 * ficha e a rota o leem — o mesmo desenho do endereço da escola, que já vive
 * copiado na criança.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');

const REGION = 'southamerica-east1';

/** Só dígitos; 10 (fixo) ou 11 (celular) com DDD. */
function telefoneValido(bruto) {
  const d = String(bruto || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 10 || d.length === 11 ? d : null;
}

function makeInformarTelefoneDaEscola(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    const telefone = telefoneValido(request.data?.telefone);
    if (!childId) throw new HttpsError('invalid-argument', 'Qual criança?');
    if (!telefone) throw new HttpsError('invalid-argument', 'Telefone com DDD, só números.');

    const crianca = await db.doc(`children/${childId}`).get();
    const c = crianca.exists ? crianca.data() : null;
    if (!c || c.parentUid !== uid) {
      throw new HttpsError('permission-denied', 'Esta criança não é da sua conta.');
    }
    if (!c.schoolId || !c.adminUid) {
      throw new HttpsError('failed-precondition', 'A escola desta criança não está cadastrada.');
    }

    const escolaRef = db.doc(`schools/${c.schoolId}`);
    const irmas = await db
      .collection('children')
      .where('adminUid', '==', c.adminUid)
      .where('schoolId', '==', c.schoolId)
      .get();

    const lote = db.batch();
    lote.set(
      escolaRef,
      {
        telefone,
        telefoneInformadoPor: 'familia',
        telefoneAtualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    irmas.docs.forEach((d) => lote.update(d.ref, { schoolPhone: telefone }));
    await lote.commit();
    return { ok: true, criancas: irmas.size };
  });
}

module.exports = { makeInformarTelefoneDaEscola, telefoneValido };
