/**
 * A TURMA DA AUXILIAR — a cópia que o servidor mantém para ela (fase 2,
 * 05/10/2026).
 *
 *   turmaDaAuxiliar/{motoristaUid}                   { ativa: true } — existe
 *                                                    só enquanto ele tem
 *                                                    auxiliar ativa
 *   turmaDaAuxiliar/{motoristaUid}/criancas/{id}     o recorte da criança
 *   turmaDaAuxiliar/{motoristaUid}/faltas/{dia_id}   a falta do dia, sem recado
 *
 * ── POR QUE UMA CÓPIA
 * Ela não pode ler `children`: mensalidade, contrato e saúde moram lá, e
 * regra não esconde campo. O recorte é uma LISTA FECHADA
 * (`recorteParaAuxiliar` em reguaDoAuxiliar.js).
 *
 * ── CUSTO
 * Os gatilhos leem o documento-raiz do motorista e só escrevem quando ele tem
 * auxiliar ativa: quem não tem auxiliar paga uma leitura por escrita na turma,
 * nunca uma escrita.
 *
 * ── QUANDO A ÚLTIMA SAI, A CÓPIA SOME
 * `desativarAuxiliar` chama `apagarTurmaDaAuxiliar` quando não sobra
 * nenhuma ativa: dado de criança não fica parado num lugar que ninguém usa.
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { recorteParaAuxiliar, faltaParaAuxiliar } = require('./reguaDoAuxiliar');

const REGION = 'southamerica-east1';

function dadosDe(lado) {
  return lado && lado.exists ? lado.data() : null;
}

async function temAuxiliarAtiva(db, motoristaUid) {
  if (!motoristaUid) return false;
  const raiz = await db.doc(`turmaDaAuxiliar/${motoristaUid}`).get();
  return raiz.exists;
}

/** Copia a turma inteira dele (usado quando a primeira auxiliar entra). */
async function copiarTurmaParaAuxiliar(db, motoristaUid) {
  await db.doc(`turmaDaAuxiliar/${motoristaUid}`).set({ ativa: true }, { merge: true });
  const snap = await db.collection('children').where('adminUid', '==', motoristaUid).get();
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    const r = recorteParaAuxiliar(d.data());
    const ref = db.doc(`turmaDaAuxiliar/${motoristaUid}/criancas/${d.id}`);
    if (r) batch.set(ref, r); else batch.delete(ref);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  // As faltas de hoje em diante — as de antes não servem a ninguém na rota.
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const faltas = await db.collection('absenceDeclarations')
    .where('adminUid', '==', motoristaUid).where('dateKey', '>=', hoje).get();
  for (const d of faltas.docs) {
    const f = faltaParaAuxiliar(d.data());
    if (f) batch.set(db.doc(`turmaDaAuxiliar/${motoristaUid}/faltas/${d.id}`), f);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  return n;
}

/** Apaga a cópia inteira (a raiz e as duas subcoleções). */
async function apagarTurmaDaAuxiliar(db, motoristaUid) {
  for (const sub of ['criancas', 'faltas']) {
    const snap = await db.collection(`turmaDaAuxiliar/${motoristaUid}/${sub}`).get();
    let batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
  }
  await db.doc(`turmaDaAuxiliar/${motoristaUid}`).delete();
}

function makeEspelharCriancaParaAuxiliar(db) {
  return onDocumentWritten(
    { document: 'children/{childId}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = dadosDe(event.data?.before);
      const depois = dadosDe(event.data?.after);
      const id = event.params.childId;
      // A criança pode ter mudado de motorista: o antigo perde a cópia.
      const doAntes = antes?.adminUid || null;
      const doDepois = depois?.adminUid || null;
      if (doAntes && doAntes !== doDepois && (await temAuxiliarAtiva(db, doAntes))) {
        await db.doc(`turmaDaAuxiliar/${doAntes}/criancas/${id}`).delete();
      }
      if (!doDepois || !(await temAuxiliarAtiva(db, doDepois))) return;
      const ref = db.doc(`turmaDaAuxiliar/${doDepois}/criancas/${id}`);
      const r = recorteParaAuxiliar(depois);
      if (r) await ref.set(r); else await ref.delete();
      logger.info('[auxiliar] turma copiada', { motoristaUid: doDepois, childId: id });
    }
  );
}

function makeEspelharFaltaParaAuxiliar(db) {
  return onDocumentWritten(
    { document: 'absenceDeclarations/{id}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = dadosDe(event.data?.before);
      const depois = dadosDe(event.data?.after);
      const motoristaUid = depois?.adminUid || antes?.adminUid || null;
      if (!motoristaUid || !(await temAuxiliarAtiva(db, motoristaUid))) return;
      const ref = db.doc(`turmaDaAuxiliar/${motoristaUid}/faltas/${event.params.id}`);
      const f = faltaParaAuxiliar(depois);
      if (f) await ref.set(f); else await ref.delete();
    }
  );
}

module.exports = {
  copiarTurmaParaAuxiliar,
  apagarTurmaDaAuxiliar,
  makeEspelharCriancaParaAuxiliar,
  makeEspelharFaltaParaAuxiliar,
};
