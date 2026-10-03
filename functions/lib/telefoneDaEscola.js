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
const { idValido } = require('./reguaDosIds');

const REGION = 'southamerica-east1';

/** Só dígitos; 10 (fixo) ou 11 (celular) com DDD. */
function telefoneValido(bruto) {
  const d = String(bruto || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 10 || d.length === 11 ? d : null;
}

function makeInformarTelefoneDaEscola(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    const telefone = telefoneValido(request.data?.telefone);
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Qual criança?');
    if (!telefone) throw new HttpsError('invalid-argument', 'Telefone com DDD, só números.');

    const crianca = await db.doc(`children/${childId}`).get();
    const c = crianca.exists ? crianca.data() : null;
    if (!c || c.parentUid !== uid) {
      throw new HttpsError('permission-denied', 'Esta criança não é da sua conta.');
    }
    // `schoolId` foi escrito pelo motorista: também passa por `idValido`
    // antes de virar caminho.
    if (!idValido(c.schoolId) || !c.adminUid) {
      throw new HttpsError('failed-precondition', 'A escola desta criança não está cadastrada.');
    }

    const escolaRef = db.doc(`schools/${c.schoolId}`);
    const irmasQuery = db
      .collection('children')
      .where('adminUid', '==', c.adminUid)
      .where('schoolId', '==', c.schoolId);

    return db.runTransaction(async (tx) => {
      const escolaSnap = await tx.get(escolaRef);
      const escola = escolaSnap.exists ? escolaSnap.data() : null;
      // A escola tem que existir e ser do motorista DESTA criança — senão o
      // `set` com merge criaria um documento de escola sem dono.
      if (!escola || escola.adminUid !== c.adminUid) {
        throw new HttpsError('failed-precondition', 'A escola desta criança não está cadastrada.');
      }
      // ⚠️ SÓ PREENCHE O VAZIO (03/10/2026). Antes a família SOBRESCREVIA o
      // número, e ele é copiado para todas as crianças daquela escola na
      // turma — uma família trocava o telefone que as outras veem. Já tendo
      // número, quem corrige é o motorista.
      if (telefoneValido(escola.telefone)) return { ok: true, jaTinha: true };

      const irmas = await tx.get(irmasQuery);
      tx.set(
        escolaRef,
        {
          telefone,
          telefoneInformadoPor: 'familia',
          telefoneAtualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      irmas.docs.forEach((d) => tx.update(d.ref, { schoolPhone: telefone }));
      return { ok: true, criancas: irmas.size };
    });
  });
}

module.exports = { makeInformarTelefoneDaEscola, telefoneValido };
