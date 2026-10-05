/**
 * A COMUNIDADE — o que só o servidor pode fazer (etapa 1, 05/10/2026).
 * A régua e o porquê estão em `reguaDaComunidade.js`.
 *
 * - `publicarFotoDaTurma`: confere o "sim" de CADA família marcada (as rules
 *   não conseguem ler criança por criança de uma lista) e só então grava a
 *   foto. O arquivo já subiu para `fotosDaTurma/{uid}/…` pelo app; aqui ele
 *   ganha o link de leitura, e o link só vai para o documento que as rules
 *   protegem (só as famílias daquele tio leem, e só até `expiraEm`).
 * - `apagarFotoDaTurma`: o tio tira a foto antes do prazo.
 * - `meusParceiros`: os tios parceiros (pela indicação) e os posts deles.
 *   Mora no servidor porque a consulta de `indicacoes` por uid não é
 *   escopada por dono nas rules — abri-la entregaria a base inteira.
 * - `limparFotosVencidas`: agendada, apaga documento e arquivo vencidos.
 *
 * F1.5 (05/10/2026): A AUXILIAR TAMBÉM POSTA, para as famílias, em nome do
 * tio. Ela sobe o arquivo para a PRÓPRIA pasta (`fotosDaTurma/{auxUid}/…`);
 * `publicarFotoDaTurma` confere o vínculo do par e a conta do tio, COPIA o
 * arquivo para a pasta do tio e apaga o original. O documento leva o
 * `adminUid` do tio e só o primeiro nome dela; o uid dela fica em
 * `autoriaDaFotoDaTurma/{fotoId}`, que só o servidor lê. `apagarFotoDaTurma`
 * aceita o tio e a autora; `minhasFotosDaTurma` devolve à auxiliar as dela.
 *
 * FASE 1 DA REDE (05/10/2026): `meusParceiros` passa a dizer as escolas de
 * cada parceiro, `avisarParceiroIndicado` avisa o parceiro que o tio o
 * indicou a uma família (sem dado nenhum dela), e a foto da turma para as
 * famílias toca no celular delas, uma vez por época.
 *
 * ── ⚠️ A FOTO DA COMUNIDADE (05/10/2026) E OS DOIS JEITOS DE LINK — decidido
 * com a QA, NÃO "uniformizar" sem decidir de novo:
 * - TURMA ('familias'): token permanente no metadata do arquivo, e o link
 *   fica no documento, que as famílias DAQUELE tio leem pelas rules. O
 *   público é fechado e conhecido, e o link morre quando o arquivo é apagado
 *   (30 dias, ou o tio apaga). O "não" da família impede só a PRÓXIMA
 *   postagem.
 * - COMUNIDADE ('comunidade'): nenhum token e nenhum link no documento. Quem
 *   vê (os tios parceiros e as famílias deles, gente que não conhece a
 *   criança) recebe pela callable `fotosDaComunidade` um link ASSINADO de
 *   `MINUTOS_DO_LINK` minutos, gerado a cada leitura, e a callable confere o
 *   "sim" de cada criança AGORA (`postAindaVale`): o "não" vale na hora.
 *   ⚠️ Assinar exige que a conta de serviço das functions tenha
 *   "Criador de tokens da conta de serviço" sobre si mesma (deploy).
 */

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const LIMITES = require('./limites');
const { carregarUsuario, exigirAuxiliar, exigirMotorista } = require('./papeis');
const { exigirContaDoMotoristaOperando } = require('./auxiliares');
const { idDoVinculo } = require('./reguaDoAuxiliar');
const { idValido } = require('./reguaDosIds');
const { palavrasDosNomes } = require('./reguaDoTextoLivre');
const {
  PUBLICO,
  caminhoValido,
  quemPublica,
  vinculoDaAuxiliarVale,
  caminhoNaPastaDoTio,
  autoriaDaFoto,
  podeApagar,
  validarPublicacao,
  parceirosDe,
  expiraEmMs,
  escolasDoParceiro,
  idDoAvisoAoParceiro,
  avisoAoParceiro,
  idDoAvisoDaFoto,
  avisoDaFoto,
  familiasDaTurma,
  semestreDe,
  MINUTOS_DO_LINK,
  postAindaVale,
  redeDaFamilia,
  postParaLeitura,
  semestreAnterior,
  resumoParaOTio,
} = require('./reguaDaComunidade');

const REGION = 'southamerica-east1';
const COLECAO = 'fotosDaTurma';
// Quem postou, pelo uid, quando foi a auxiliar. Só o servidor lê e escreve:
// o documento da foto a família lê inteiro, e o uid dela não é da conta dela.
const AUTORIA = 'autoriaDaFotoDaTurma';

function linkDeLeitura(bucket, caminho, token) {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

function makePublicarFotoDaTurma(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const { uid, dados: quem } = await carregarUsuario(db, request);
    const d = request.data || {};
    // Quem publica e em nome de quem: o tio publica em nome próprio; a
    // auxiliar, só para as famílias e em nome do tio que ela diz.
    const autor = quemPublica({ papel: quem?.role, uid, tioUid: d.tioUid, publico: d.publico });
    if (!autor.ok) throw new HttpsError('permission-denied', autor.erro);
    const { tioUid, pastaUid, pelaAuxiliar } = autor;
    if (pelaAuxiliar) {
      // O id vira caminho de documento: passa pela régua antes.
      if (!idValido(tioUid)) throw new HttpsError('invalid-argument', 'De qual perua é a foto?');
      const vinculo = await db.doc(`auxiliares/${idDoVinculo(tioUid, uid)}`).get();
      if (!vinculoDaAuxiliarVale(vinculo.exists ? vinculo.data() : null, tioUid, uid)) {
        throw new HttpsError('permission-denied', 'O seu acesso a esta perua foi encerrado pelo motorista.');
      }
      // Ela escreve com o Admin SDK por cima das rules: conta trancada do
      // tio não publica pela auxiliar (o mesmo predicado do `isAdmin()`).
      await exigirContaDoMotoristaOperando(db, tioUid);
    }
    if (!caminhoValido(pastaUid, d.caminho)) throw new HttpsError('invalid-argument', 'A foto não chegou. Tente de novo.');

    // Id que não passa na régua não vira caminho (e a validação recusa a
    // lista por estar errada, em vez de publicar sem a criança).
    const criancas = Array.isArray(d.criancas) ? d.criancas : [];
    if (!criancas.every(idValido)) throw new HttpsError('invalid-argument', 'A lista de crianças está errada.');
    const docs = criancas.length ? await db.getAll(...criancas.map((id) => db.doc(`children/${id}`))) : [];
    const turma = Object.fromEntries(docs.filter((s) => s.exists).map((s) => [s.id, s.data()]));
    const legenda = typeof d.legenda === 'string' ? d.legenda.trim() : null;
    // Para a comunidade, a legenda é lida por quem não conhece a turma: o
    // filtro precisa dos nomes DELA (crianças e responsáveis).
    let nomesDaTurma = new Set();
    if (d.publico === PUBLICO.COMUNIDADE) {
      const daTurma = await db.collection('children').where('adminUid', '==', tioUid)
        .select('name', 'parentName', 'parent2Name').limit(300).get();
      nomesDaTurma = palavrasDosNomes(daTurma.docs.flatMap((c) => [c.get('name'), c.get('parentName'), c.get('parent2Name')]));
    }
    const v = validarPublicacao({
      uid: tioUid,
      publico: d.publico,
      criancas,
      epoca: d.epoca,
      legenda: legenda || null,
      todasMarcadas: d.todasMarcadas,
      semCrianca: d.semCrianca,
      turma,
      nomesDaTurma,
    });
    if (!v.ok) throw new HttpsError('failed-precondition', v.erro, v.semSim ? { semSim: v.semSim } : undefined);

    const bucket = getStorage().bucket();
    const origem = bucket.file(d.caminho);
    const [existe] = await origem.exists();
    if (!existe) throw new HttpsError('not-found', 'A foto não chegou. Tente de novo.');

    // O arquivo da auxiliar vai para a pasta do TIO. Se a cópia falhar, nada
    // é publicado: o original fica na pasta dela, sem link, inerte (ninguém
    // lê `fotosDaTurma/` pelo Storage).
    let caminho = d.caminho;
    let arquivo = origem;
    if (pelaAuxiliar) {
      caminho = caminhoNaPastaDoTio(d.caminho, pastaUid, tioUid);
      if (!caminho) throw new HttpsError('invalid-argument', 'A foto não chegou. Tente de novo.');
      arquivo = bucket.file(caminho);
      try {
        await origem.copy(arquivo);
      } catch (err) {
        logger.warn('comunidade: cópia da foto da auxiliar falhou', { uid, tioUid, erro: err?.message });
        throw new HttpsError('unavailable', 'Não deu para publicar agora. Tente de novo.');
      }
      try {
        await origem.delete({ ignoreNotFound: true });
      } catch (err) {
        // O original fica inerte (sem link): perder a faxina não desfaz a foto.
        logger.warn('comunidade: original da auxiliar não apagado', { uid, erro: err?.message });
      }
    }
    // Só a turma ganha o token permanente (ver o cabeçalho). A comunidade é
    // lida por link assinado, gerado a cada leitura.
    const paraComunidade = d.publico === PUBLICO.COMUNIDADE;
    let url = null;
    if (!paraComunidade) {
      const token = crypto.randomUUID();
      await arquivo.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      url = linkDeLeitura(bucket, caminho, token);
    }

    const agora = Date.now();
    const expiraEm = Timestamp.fromMillis(expiraEmMs(agora));
    const ref = db.collection(COLECAO).doc();
    const autoria = autoriaDaFoto({ pelaAuxiliar, uid, nome: quem?.name, tioUid });
    const lote = db.batch();
    lote.set(ref, {
      adminUid: tioUid,
      publico: d.publico,
      criancas,
      epoca: d.epoca,
      legenda: legenda || null,
      caminho,
      url,
      ...autoria.naFoto,
      criadaEm: FieldValue.serverTimestamp(),
      expiraEm,
    });
    // O registro e a foto nascem juntos: foto da auxiliar sem registro seria
    // uma foto que ela não consegue apagar.
    if (autoria.registro) lote.set(db.doc(`${AUTORIA}/${ref.id}`), { ...autoria.registro, expiraEm });
    await lote.commit();
    // O aviso leva a MARCA do tio (lida do doc dele), nunca o nome dela.
    if (d.publico === PUBLICO.FAMILIAS) await avisarFamiliasDaFoto(db, tioUid, d.epoca);
    return { id: ref.id };
  });
}

/**
 * Cria o aviso só se ele ainda não existe: o id é o que impede o segundo
 * toque (`create` falha com ALREADY_EXISTS, e isso é o caminho normal).
 */
async function criarSeNaoExiste(ref, dados) {
  try {
    await ref.create(dados);
    return true;
  } catch (err) {
    if (err?.code === 6 || /already exists/i.test(String(err?.message))) return false;
    throw err;
  }
}

/**
 * ⚠️ FALHAR AQUI NÃO DESFAZ A FOTO. Ela já foi gravada e as famílias a veem
 * no Início; o aviso é um toque a mais, e perder o toque é melhor do que
 * dizer ao tio que a publicação falhou quando ela está no ar.
 */
async function avisarFamiliasDaFoto(db, uid, epoca) {
  try {
    const [tio, turma] = await Promise.all([
      db.doc(`users/${uid}`).get(),
      db.collection('children').where('adminUid', '==', uid).select('parentUid', 'active').limit(300).get(),
    ]);
    const aviso = avisoDaFoto(tio.get('marcaNome') || tio.get('name'), epoca);
    const familias = familiasDaTurma(turma.docs.map((s) => s.data()));
    await Promise.all(familias.map((parentUid) => {
      const id = idDoAvisoDaFoto(uid, epoca, parentUid);
      if (!id) return null;
      return criarSeNaoExiste(db.doc(`notifications/${id}`), {
        userId: parentUid,
        ...aviso,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }));
  } catch (err) {
    logger.warn('comunidade: aviso da foto não saiu', { uid, erro: err?.message });
  }
}

async function apagarFoto(db, ref, dados) {
  try {
    await getStorage().bucket().file(dados.caminho).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn('comunidade: arquivo não apagado', { id: ref.id, erro: err?.message });
  }
  // O registro de autoria vai junto (quando não existe, o delete é inócuo).
  const lote = db.batch();
  lote.delete(ref);
  lote.delete(db.doc(`${AUTORIA}/${ref.id}`));
  await lote.commit();
}

function makeApagarFotoDaTurma(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const { uid, dados: quem } = await carregarUsuario(db, request);
    const id = request.data?.id;
    // Todo id vindo do cliente passa pela régua antes de virar caminho.
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Foto não encontrada.');
    const ref = db.doc(`${COLECAO}/${id}`);
    const [snap, autoria] = await Promise.all([ref.get(), db.doc(`${AUTORIA}/${id}`).get()]);
    // O tio apaga tudo o que está no nome dele; a auxiliar, só o que postou
    // (inclusive desativada — o porquê está em `podeApagar`).
    const pode = snap.exists && podeApagar(snap.data(), autoria.exists ? autoria.data() : null, { uid, papel: quem?.role });
    if (!pode) throw new HttpsError('not-found', 'Foto não encontrada.');
    await apagarFoto(db, ref, snap.data());
    return { ok: true };
  });
}

/**
 * AS FOTOS QUE A AUXILIAR POSTOU e ainda estão no ar (F1.5). Callable, e
 * não consulta do cliente: o uid dela mora em `autoriaDaFotoDaTurma`, que
 * ninguém lê pelo app — e abrir `fotosDaTurma` à auxiliar por um campo do
 * documento seria pôr o uid dela onde a família lê. Vale desativada: ela
 * apaga a dela até os 30 dias.
 */
function makeMinhasFotosDaTurma(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirAuxiliar(db, request);
    const agoraMs = Date.now();
    const registros = await db.collection(AUTORIA).where('postadaPor', '==', uid).limit(40).get();
    const vivos = registros.docs.filter((s) => (s.get('expiraEm')?.toMillis?.() || 0) > agoraMs);
    if (!vivos.length) return { fotos: [] };
    const fotos = await db.getAll(...vivos.map((s) => db.doc(`${COLECAO}/${s.id}`)));
    return {
      fotos: fotos
        .filter((s) => s.exists)
        .map((s) => {
          const f = s.data();
          return {
            id: s.id,
            adminUid: f.adminUid,
            epoca: f.epoca,
            legenda: f.legenda || null,
            url: f.url,
            expiraEmMs: f.expiraEm?.toMillis?.() || null,
            criadaEmMs: f.criadaEm?.toMillis?.() || null,
          };
        })
        .sort((x, y) => (y.criadaEmMs || 0) - (x.criadaEmMs || 0)),
    };
  });
}

function makeMeusParceiros(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const [feitas, recebidas] = await Promise.all([
      db.collection('indicacoes').where('indicadorUid', '==', uid).limit(200).get(),
      db.collection('indicacoes').where('indicadoUid', '==', uid).limit(50).get(),
    ]);
    const lista = parceirosDe(uid, {
      feitas: feitas.docs.map((s) => s.data()),
      recebidas: recebidas.docs.map((s) => s.data()),
    }).slice(0, 60);
    if (!lista.length) return { parceiros: [], fotos: [] };

    const [perfis, escolas] = await Promise.all([
      db.getAll(...lista.map((p) => db.doc(`users/${p.uid}`))),
      // As escolas são o que o tio pergunta antes de indicar ("ele passa na
      // escola da Ana?"). Só o NOME: endereço e telefone da escola ficam
      // com o parceiro.
      Promise.all(lista.map((p) =>
        db.collection('schools').where('adminUid', '==', p.uid).select('nome').limit(12).get()
          .then((snap) => escolasDoParceiro(snap.docs.map((s) => s.get('nome'))))
          .catch(() => [])
      )),
    ]);
    const parceiros = lista.map((p, i) => {
      const u = perfis[i].exists ? perfis[i].data() : {};
      // SÓ o que ele já mostra às famílias dele: a marca, o logo e a região.
      return {
        uid: p.uid,
        papel: p.papel,
        marca: u.marcaNome || u.name || 'Motorista',
        logoURL: u.marcaLogoURL || null,
        lugar: [u.regiao, u.city].filter(Boolean).join(' · ') || null,
        escolas: escolas[i],
        // O WhatsApp é o que o tio passa à família quando INDICA o parceiro
        // (etapa 2). Os dois se conhecem pela indicação, e é o número com
        // que o parceiro já atende as famílias dele.
        whatsapp: String(u.phone || '').replace(/\D/g, '') || null,
      };
    });

    const agora = Timestamp.now();
    const fotos = [];
    for (let i = 0; i < lista.length; i += 30) {
      const pedaco = lista.slice(i, i + 30).map((p) => p.uid);
      const snap = await db
        .collection(COLECAO)
        .where('adminUid', 'in', pedaco)
        .where('publico', '==', PUBLICO.PARCEIROS)
        .where('expiraEm', '>', agora)
        .limit(60)
        .get();
      for (const s of snap.docs) {
        const f = s.data();
        fotos.push({ id: s.id, adminUid: f.adminUid, epoca: f.epoca, legenda: f.legenda || null, url: f.url, expiraEmMs: f.expiraEm.toMillis(), criadaEmMs: f.criadaEm?.toMillis?.() || null });
      }
    }
    fotos.sort((a, b) => (b.criadaEmMs || 0) - (a.criadaEmMs || 0));
    return { parceiros, fotos: fotos.slice(0, 60) };
  });
}

/**
 * O tio indicou um parceiro a uma família (o WhatsApp já abriu no aparelho
 * dele): o parceiro recebe o aviso. A parceria é conferida de novo aqui —
 * sem isso, qualquer motorista mandaria aviso com o nome dele para qualquer
 * outro.
 */
function makeAvisarParceiroIndicado(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const parceiroUid = request.data?.parceiroUid;
    if (!idValido(parceiroUid) || parceiroUid === uid) throw new HttpsError('invalid-argument', 'Parceiro não encontrado.');
    const [feitas, recebidas] = await Promise.all([
      db.collection('indicacoes').where('indicadorUid', '==', uid).where('indicadoUid', '==', parceiroUid).limit(1).get(),
      db.collection('indicacoes').where('indicadorUid', '==', parceiroUid).where('indicadoUid', '==', uid).limit(1).get(),
    ]);
    const parceiros = parceirosDe(uid, {
      feitas: feitas.docs.map((s) => s.data()),
      recebidas: recebidas.docs.map((s) => s.data()),
    });
    if (!parceiros.some((p) => p.uid === parceiroUid)) throw new HttpsError('permission-denied', 'Parceiro não encontrado.');
    const tio = await db.doc(`users/${uid}`).get();
    const novo = await criarSeNaoExiste(db.doc(`notifications/${idDoAvisoAoParceiro(parceiroUid, uid)}`), {
      userId: parceiroUid,
      ...avisoAoParceiro(tio.get('marcaNome') || tio.get('name')),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true, avisado: novo };
  });
}

/** Link assinado curto; no emulador (sem conta para assinar), o link do emulador. */
async function linkCurto(bucket, caminho) {
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    return `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media`;
  }
  const [url] = await bucket.file(caminho).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + MINUTOS_DO_LINK * 60 * 1000,
  });
  return url;
}

async function parceirosDoTio(db, uid) {
  const [feitas, recebidas] = await Promise.all([
    db.collection('indicacoes').where('indicadorUid', '==', uid).limit(200).get(),
    db.collection('indicacoes').where('indicadoUid', '==', uid).limit(50).get(),
  ]);
  return parceirosDe(uid, {
    feitas: feitas.docs.map((x) => x.data()),
    recebidas: recebidas.docs.map((x) => x.data()),
  }).map((p) => p.uid);
}

/**
 * A FOTO DA COMUNIDADE, PARA QUEM VÊ (05/10/2026). O tio vê as dos parceiros
 * e as dele; a família vê as dos tios dela e dos parceiros deles. Cada post
 * só sai se TODAS as crianças dele ainda têm o "sim" da comunidade agora, e
 * sai com um link de 15 minutos — nunca o nome da criança.
 */
function makeFotosDaComunidade(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const { uid, dados: eu } = await carregarUsuario(db, request);
    let tios;
    if (eu?.role === 'admin') {
      tios = [uid, ...(await parceirosDoTio(db, uid))];
    } else if (eu?.role === 'parent') {
      const dela = [...new Set([...(Array.isArray(eu.adminUids) ? eu.adminUids : []), eu.adminUid].filter(idValido))].slice(0, 5);
      const parceiros = {};
      for (const t of dela) parceiros[t] = await parceirosDoTio(db, t);
      tios = redeDaFamilia(dela, parceiros);
    } else {
      throw new HttpsError('permission-denied', 'Esta tela é do motorista ou da família.');
    }
    tios = [...new Set(tios.filter(idValido))].slice(0, 90);
    if (!tios.length) return { fotos: [] };

    const agora = Timestamp.now();
    const posts = [];
    for (let i = 0; i < tios.length; i += 30) {
      const snap = await db.collection(COLECAO)
        .where('adminUid', 'in', tios.slice(i, i + 30))
        .where('publico', '==', PUBLICO.COMUNIDADE)
        .where('expiraEm', '>', agora)
        .limit(60)
        .get();
      posts.push(...snap.docs);
    }
    if (!posts.length) return { fotos: [] };

    // O "sim" de cada criança, lido AGORA.
    const ids = [...new Set(posts.flatMap((p) => (p.get('criancas') || []).filter(idValido)))];
    const criancas = {};
    for (let i = 0; i < ids.length; i += 100) {
      const docs = await db.getAll(...ids.slice(i, i + 100).map((id) => db.doc(`children/${id}`)));
      for (const c of docs) if (c.exists) criancas[c.id] = c.data();
    }
    const valem = posts.filter((p) => postAindaVale(p.data(), criancas));

    const donos = [...new Set(valem.map((p) => p.get('adminUid')))];
    const perfis = donos.length ? await db.getAll(...donos.map((u) => db.doc(`users/${u}`))) : [];
    const marcaDe = Object.fromEntries(perfis.map((p) => [p.id, p.exists ? p.data() : {}]));
    const bucket = getStorage().bucket();
    const fotos = [];
    for (const p of valem) {
      const post = p.data();
      try {
        const u = marcaDe[post.adminUid] || {};
        fotos.push({
          foto: postParaLeitura(post, {
            id: p.id,
            url: await linkCurto(bucket, post.caminho),
            marca: u.marcaNome || u.name,
            logoURL: u.marcaLogoURL,
            minha: post.adminUid === uid,
          }),
          ordem: post.criadaEm?.toMillis?.() || 0,
        });
      } catch (err) {
        logger.warn('comunidade: link da foto não saiu', { id: p.id, erro: err?.message });
      }
    }
    fotos.sort((a, b) => b.ordem - a.ordem);
    // A ordem só serviu para ordenar: não sai.
    return { fotos: fotos.slice(0, 60).map((x) => x.foto) };
  });
}

/**
 * A NOTA DAS FAMÍLIAS — o que o tio pode ver (etapa 2). Mora no servidor
 * porque as rules não deixam o tio ler as avaliações uma a uma (é o que
 * mantém o anonimato): daqui sai só a média do semestre FECHADO, com o
 * mínimo de respostas, e quantas famílias já responderam no corrente.
 */
function makeMinhaNotaDasFamilias(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const semestre = semestreDe(new Date());
    const [anterior, atual] = await Promise.all([
      db.collection('avaliacoesDoTio').where('adminUid', '==', uid)
        .where('semestre', '==', semestreAnterior(semestre)).select('nota').limit(500).get(),
      db.collection('avaliacoesDoTio').where('adminUid', '==', uid)
        .where('semestre', '==', semestre).select().limit(500).get(),
    ]);
    return resumoParaOTio({
      semestre,
      notasDoAnterior: anterior.docs.map((s) => s.get('nota')),
      totalAtual: atual.size,
    });
  });
}

function makeLimparFotosVencidas(db) {
  return onSchedule(
    {
      // 3h30, longe das rotas e antes das outras limpezas.
      schedule: '30 3 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      let apagadas = 0;
      for (let rodada = 0; rodada < 20; rodada += 1) {
        const snap = await db.collection(COLECAO).where('expiraEm', '<=', Timestamp.now()).limit(200).get();
        if (snap.empty) break;
        for (const s of snap.docs) {
          await apagarFoto(db, s.ref, s.data());
          apagadas += 1;
        }
      }
      logger.info('comunidade: fotos vencidas apagadas', { apagadas });
    }
  );
}

module.exports = {
  makePublicarFotoDaTurma,
  makeApagarFotoDaTurma,
  makeMinhasFotosDaTurma,
  makeMeusParceiros,
  makeLimparFotosVencidas,
  makeMinhaNotaDasFamilias,
  makeAvisarParceiroIndicado,
  makeFotosDaComunidade,
};
