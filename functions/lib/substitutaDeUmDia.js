/**
 * A SUBSTITUTA DE UM DIA — as callables (F3, 05/10/2026). A régua, o porquê
 * e o que ela nunca vê estão em `reguaDaSubstitutaDeUmDia.js`.
 *
 *   gerarAcessoDeSubstituta     o TIO gera o link de hoje para uma pessoa da
 *                               lista dele; gerar de novo encerra o anterior
 *   encerrarAcessoDeSubstituta  o tio encerra um link — ou, com
 *                               `{ pelaRota: true }`, pede ao servidor que
 *                               confira se a rota do dia acabou
 *   verRotaDaSubstituta         PÚBLICA: a página `/substituta/:token` lê aqui
 *
 * ── ⚠️ O CAMINHO PÚBLICO NÃO ESCREVE
 * `verRotaDaSubstituta` só lê — nem contador de acesso, nem "visto em". A
 * única escrita possível é o limite por IP (`limitesDeTentativa`), no mesmo
 * desenho da prévia do convite: CONFERE sem escrever, e CONTA só a recusa de
 * quem sonda (token mal formado ou segredo errado). A substituta com o link
 * certo, relendo depois da rota, nunca grava nada.
 *
 * ── ⚠️ POR QUE O FIM DA ROTA NÃO É UM GATILHO EM `liveLocation`
 * `liveLocation/{tio}` é regravado a cada um ou dois minutos de rota: um
 * gatilho ali acordaria o servidor centenas de milhares de vezes por mês para
 * agir em uma por dia — a mesma conta que tirou o relógio do teste de lá
 * (relogioNaRota.js). O fim da rota mata o link de três jeitos, sem gatilho:
 *   1. NA LEITURA: `verRotaDaSubstituta` lê `liveLocation/{tio}` e recusa
 *      quando a rota do dia acabou depois de o link nascer
 *      (`rotaDoDiaAcabou`). É o que vale, mesmo que nada mais rode;
 *   2. o app do tio, ao encerrar a rota, chama `encerrarAcessoDeSubstituta
 *      ({ pelaRota: true })` — o servidor confere a MESMA régua antes de
 *      encerrar e avisar;
 *   3. o `closeStaleRoutes` (a rota abandonada) chama
 *      `encerrarAcessosPelaRota` para quem ele fechou.
 * Os dois últimos gravam `encerradoEm` e mandam o aviso ao tio.
 */

'use strict';

const crypto = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const { exigirContaDoMotoristaOperando } = require('./auxiliares');
const { faltaParaAuxiliar } = require('./reguaDoAuxiliar');
const limite = require('./limiteDeTentativas');
const { REGRAS, MENSAGEM_DE_LIMITE } = require('./reguaDasTentativas');
const R = require('./reguaDaSubstitutaDeUmDia');

const REGION = 'southamerica-east1';
const COLECAO = 'acessosDeSubstituta';
const BYTES_DO_SEGREDO = 32;

function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

/** A turma do tio, pela cópia da auxiliar se existir; senão por `children`. */
async function lerTurmaDoTio(db, motoristaUid, hojeChave) {
  const copia = await db.doc(`turmaDaAuxiliar/${motoristaUid}`).get();
  if (copia.exists) {
    const [criancas, faltas] = await Promise.all([
      db.collection(`turmaDaAuxiliar/${motoristaUid}/criancas`).get(),
      db.collection(`turmaDaAuxiliar/${motoristaUid}/faltas`).where('dateKey', '==', hojeChave).get(),
    ]);
    return {
      criancas: criancas.docs.map((d) => ({ id: d.id, ...d.data() })),
      faltas: faltas.docs.map((d) => d.data()),
    };
  }
  const [criancas, faltas] = await Promise.all([
    db.collection('children').where('adminUid', '==', motoristaUid).where('active', '==', true).get(),
    db.collection('absenceDeclarations').where('adminUid', '==', motoristaUid).where('dateKey', '==', hojeChave).get(),
  ]);
  return {
    criancas: criancas.docs.map((d) => ({ id: d.id, ...d.data() })),
    // O mesmo recorte da falta que a auxiliar recebe: nunca o recado.
    faltas: faltas.docs.map((d) => faltaParaAuxiliar(d.data())).filter(Boolean),
  };
}

async function lerRota(db, motoristaUid) {
  const snap = await db.doc(`liveLocation/${motoristaUid}`).get();
  return snap.exists ? snap.data() : null;
}

/** Encerra os acessos abertos do tio num lote, com o aviso de cada um. */
function encerrarNoLote(db, lote, motoristaUid, acessos, por, { avisar }) {
  for (const a of acessos) {
    lote.update(db.doc(`${COLECAO}/${a.id}`), {
      encerradoEm: FieldValue.serverTimestamp(),
      encerradoPor: por,
    });
    if (avisar) {
      lote.set(db.collection('notifications').doc(), {
        userId: motoristaUid,
        ...R.avisoDeEncerrado({ nome: a.nome, por }),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}

async function acessosAbertos(db, motoristaUid) {
  const snap = await db
    .collection(COLECAO)
    .where('motoristaUid', '==', motoristaUid)
    .where('encerradoEm', '==', null)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * A rota do tio acabou: encerra os links de HOJE que a régua diz que
 * morreram, e avisa. Usado pelo app do tio (via callable) e pelo
 * `closeStaleRoutes`. Nunca lança: o fim da rota não pode falhar por isto.
 */
async function encerrarAcessosPelaRota(db, motoristaUid) {
  try {
    const abertos = await acessosAbertos(db, motoristaUid);
    if (!abertos.length) return 0;
    const hoje = R.chaveDoDia();
    const [rota, turma] = await Promise.all([
      lerRota(db, motoristaUid),
      lerTurmaDoTio(db, motoristaUid, hoje),
    ]);
    const paradas = R.recorteDaSubstituta({ ...turma, hojeChave: hoje });
    const ultimaParadaMin = R.ultimaParadaDoDia(paradas);
    const morreram = abertos.filter((a) => a.dateKey === hoje && R.rotaDoDiaAcabou({
      criadoEmMs: a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : null,
      rota,
      ultimaParadaMin,
    }));
    if (!morreram.length) return 0;
    const lote = db.batch();
    encerrarNoLote(db, lote, motoristaUid, morreram, 'rota', { avisar: true });
    await lote.commit();
    logger.info(`[substituta] ${morreram.length} link(s) encerrado(s) pela rota: tio=${motoristaUid}`);
    return morreram.length;
  } catch (err) {
    logger.warn('[substituta] não deu para encerrar pela rota', { motoristaUid, err: err?.message });
    return 0;
  }
}

function makeGerarAcessoDeSubstituta(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    // O link abre a turma dele a um terceiro: conta trancada não chama
    // ninguém (o mesmo predicado do `isAdmin()` das rules).
    await exigirContaDoMotoristaOperando(db, uid);
    const substitutaId = String(request.data?.substitutaId || '').trim();
    if (!idValido(substitutaId)) throw new HttpsError('invalid-argument', 'Escolha a substituta.');

    const sub = await db.doc(`substitutasDoTio/${substitutaId}`).get();
    // O escopo é o uid AUTENTICADO contra o dono da substituta — nunca um
    // campo do payload.
    if (!sub.exists || sub.data().motoristaUid !== uid) {
      throw new HttpsError('permission-denied', 'Esta substituta não está na sua lista.');
    }
    const nome = String(sub.data().nome || '').trim().slice(0, 60) || 'Substituta';

    // Um link aberto por tio: gerar de novo encerra o anterior (sem aviso —
    // foi ele mesmo que tocou).
    const abertos = await acessosAbertos(db, uid);
    const encerrar = new Set(R.anterioresParaEncerrar(abertos));
    const lote = db.batch();
    encerrarNoLote(db, lote, uid, abertos.filter((a) => encerrar.has(a.id)), 'tio', { avisar: false });

    const ref = db.collection(COLECAO).doc();
    const segredo = crypto.randomBytes(BYTES_DO_SEGREDO).toString('base64url');
    lote.set(ref, {
      motoristaUid: uid,
      substitutaId,
      nome,
      dateKey: R.chaveDoDia(),
      // Só o HASH vai para o banco. O segredo existe uma vez, nesta resposta.
      segredoHash: sha256(segredo),
      criadoEm: FieldValue.serverTimestamp(),
      encerradoEm: null,
      encerradoPor: null,
    });
    await lote.commit();
    logger.info(`[substituta] link de hoje gerado: tio=${uid}`);
    return { id: ref.id, token: R.montarToken(ref.id, segredo) };
  });
}

function makeEncerrarAcessoDeSubstituta(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    if (request.data?.pelaRota === true) {
      return { encerrados: await encerrarAcessosPelaRota(db, uid) };
    }
    const id = String(request.data?.id || '').trim();
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Link não informado.');
    const ref = db.doc(`${COLECAO}/${id}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().motoristaUid !== uid) {
      throw new HttpsError('permission-denied', 'Este link não é seu.');
    }
    if (snap.data().encerradoEm) return { encerrados: 0 };
    const lote = db.batch();
    encerrarNoLote(db, lote, uid, [{ id, ...snap.data() }], 'tio', { avisar: true });
    await lote.commit();
    return { encerrados: 1 };
  });
}

/**
 * A página da substituta. ⚠️ ZERO ESCRITA, exceto o limite por IP — e ele só
 * conta a sondagem (`recusaDeSondagem`). As recusas respondem a MESMA frase;
 * quem provou o segredo leva, nos `details`, só a marca do tio, para a página
 * dizer "Fale com o Tio Nino" — sem o segredo, nada.
 */
function makeVerRotaDaSubstituta(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const quem = limite.quemPeloIp(request.rawRequest);
    if (!(await limite.aindaCabe(db, REGRAS.SUBSTITUTA_PUBLICA, quem))) {
      throw new HttpsError('resource-exhausted', MENSAGEM_DE_LIMITE);
    }
    const recusar = async (motivo, marca = null) => {
      if (R.recusaDeSondagem(motivo)) await limite.contar(db, REGRAS.SUBSTITUTA_PUBLICA, quem);
      return new HttpsError('not-found', R.FRASE_DO_LINK_MORTO, marca && marca.nome ? { marca } : undefined);
    };

    const partes = R.lerTokenDaSubstituta(request.data?.token);
    if (!partes || !idValido(partes.id)) throw await recusar('formato');

    const snap = await db.doc(`${COLECAO}/${partes.id}`).get();
    const acesso = snap.exists ? snap.data() : null;
    const hoje = R.chaveDoDia();
    const hash = sha256(partes.segredo);
    const primeiro = R.acessoVale({ acesso, hashDoSegredo: hash, hojeChave: hoje });
    if (!primeiro.ok && R.recusaDeSondagem(primeiro.motivo)) throw await recusar(primeiro.motivo);

    // Daqui em diante, quem chamou provou o segredo.
    const motoristaUid = acesso.motoristaUid;
    const motorista = await db.doc(`users/${motoristaUid}`).get();
    const marca = R.marcaParaSubstituta(motorista.exists ? motorista.data() : null);
    if (!primeiro.ok) throw await recusar(primeiro.motivo, marca);

    const [rota, turma] = await Promise.all([
      lerRota(db, motoristaUid),
      lerTurmaDoTio(db, motoristaUid, hoje),
    ]);
    const paradas = R.recorteDaSubstituta({ ...turma, hojeChave: hoje });
    const veredito = R.acessoVale({ acesso, hashDoSegredo: hash, hojeChave: hoje, rota, paradas });
    if (!veredito.ok) throw await recusar(veredito.motivo, marca);

    return {
      marca,
      substituta: R.primeiroNome(acesso.nome),
      dia: hoje,
      paradas,
    };
  });
}

module.exports = {
  makeGerarAcessoDeSubstituta,
  makeEncerrarAcessoDeSubstituta,
  makeVerRotaDaSubstituta,
  encerrarAcessosPelaRota,
};
