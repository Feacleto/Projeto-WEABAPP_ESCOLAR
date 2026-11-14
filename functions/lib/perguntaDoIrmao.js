/**
 * O TELEFONE DIGITADO DEPOIS — o gatilho da TROCA e a resposta da mãe
 * (14/11/2026). As decisões são puras: `reguaDaPerguntaDoIrmao.js`.
 *
 * `vincularIrmao.js` só roda na CRIAÇÃO da criança, e a Lista da turma deixa
 * o telefone para depois. Este gatilho cobre a troca de `parentPhone`:
 *
 *   - criança SEM responsável, número de UMA mãe que já é família deste
 *     motorista → o servidor PERGUNTA a ela ("É seu filho?"). ⚠️ Nunca vincula
 *     sozinho: na troca o motorista poderia anexar uma criança dele à conta
 *     de qualquer família dele, uma depois da outra (decisão 28 pelo outro
 *     lado — ver a régua). "Sim" vincula pelo MESMO caminho do irmão
 *     automático; "Não" guarda a recusa para sempre e avisa o motorista,
 *     como o `recusarIrmao`;
 *   - ninguém a perguntar, mas alguém PEDIU acesso com esse número
 *     (`telefoneAguardandoChave`) → abre o pedido ao motorista, como no
 *     cadastro. Nunca vincula;
 *   - criança JÁ com responsável que entrou pelo link sem número → grava a
 *     `phoneChave` dela, se ainda não houver — o que reabilita o irmão
 *     automático para ela no futuro.
 *
 * ── ⚠️ SEM LAÇO
 * O gatilho nunca reescreve `parentPhone` nem `parentPhoneChave`, e a régua
 * só age quando a CHAVE do telefone muda. As escritas que ele mesmo provoca
 * na criança (o vínculo, a recusa) não mudam o telefone, e voltam como NADA.
 *
 * ── ⚠️ O REGISTRO É SÓ DO SERVIDOR
 * `perguntasDeIrmao/{childId}` (contador, recusas, pergunta aberta) cai no
 * `{document=**}` das rules, que nega tudo ao cliente. A mãe vê a pergunta
 * pelo AVISO (`notifications`, tipo `irmao_pergunta`), que é dela; mas quem
 * decide se a resposta vale é o registro. Um aviso forjado — o motorista pode
 * criar aviso para a família dele — não abre nada: sem pergunta aberta no
 * registro, "Sim" é recusado.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { idValido } = require('./reguaDosIds');
const R = require('./reguaDaPerguntaDoIrmao');
const {
  vinculoAindaCabe,
  gravarVinculoDeIrmao,
  abrirPedidosDeQuemEspera,
  avisarMotoristaDaRecusa,
  COLECAO_DAS_PERGUNTAS,
} = require('./vincularIrmao');
const { avisoDaFamiliaEntrou, idDoAvisoDaFamiliaEntrou } = require('./reguaDaFamiliaEntrou');

const REGION = 'southamerica-east1';

/** A família que entrou pelo link sem número ganha a `phoneChave`. */
async function gravarChaveDaFamilia(db, { childId, depois, chave, parentUid }) {
  if (!idValido(parentUid)) return { gravou: false };
  const userRef = db.doc(`users/${parentUid}`);
  const outrasQuery = db.collection('users').where('phoneChave', '==', chave).limit(3);
  const gravou = await db.runTransaction(async (tx) => {
    const [u, outras] = await Promise.all([tx.get(userRef), tx.get(outrasQuery)]);
    if (!u.exists) return false;
    const pode = R.podeGravarChaveDaFamilia({
      conta: { uid: u.id, ...u.data() },
      childId,
      motorista: depois.adminUid,
      chave,
      outrasContas: outras.docs.map((d) => d.id),
    });
    if (!pode) return false;
    tx.update(userRef, { phoneChave: chave, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (gravou) logger.info('[irmao-depois] chave da família gravada', { childId, parentUid });
  return { gravou };
}

/** Criança sem responsável: perguntar a uma mãe, ou abrir o pedido de quem espera. */
async function perguntarOuAbrirPedido(db, { childId, chave }) {
  const childRef = db.doc(`children/${childId}`);
  const registroRef = db.doc(`${COLECAO_DAS_PERGUNTAS}/${childId}`);
  const atual = await childRef.get();
  if (!atual.exists) return { motivo: R.MOTIVO.NINGUEM };
  const crianca = atual.data();
  if (typeof crianca.adminUid !== 'string' || !idValido(crianca.adminUid)) return { motivo: R.MOTIVO.NINGUEM };

  const [porChave, vinculadas, motoristaSnap] = await Promise.all([
    db.collection('users').where('phoneChave', '==', chave).limit(3).get(),
    db.collection('children').where('adminUid', '==', crianca.adminUid).get(),
    db.doc(`users/${crianca.adminUid}`).get(),
  ]);
  const contas = porChave.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const criancas = vinculadas.docs.filter((d) => d.id !== childId).map((d) => d.data());
  const motorista = motoristaSnap.exists ? motoristaSnap.data() : null;

  const resultado = await db.runTransaction(async (tx) => {
    const [c, reg] = await Promise.all([tx.get(childRef), tx.get(registroRef)]);
    if (!c.exists) return { motivo: R.MOTIVO.NINGUEM };
    const agora = c.data();
    // Algo mudou entre o evento e aqui (outro número, o link chegou antes):
    // a troca seguinte, se houver, decide.
    const troca = R.oQueFazerComATroca({ antes: null, depois: agora });
    if (troca.acao !== R.ACAO.PROCURAR || troca.chave !== chave) return { motivo: R.MOTIVO.NINGUEM, mudou: true };
    const registro = reg.exists ? reg.data() : null;
    const decisao = R.aQuemPerguntar({ crianca: agora, contas, criancas, registro });
    if (decisao.motivo !== R.MOTIVO.PERGUNTAR) return decisao;

    const n = (Number(registro && registro.perguntas) || 0) + 1;
    const notifId = R.idDoAvisoDaPergunta(childId, n);
    const aviso = R.avisoDaPergunta({ nomeDaCrianca: agora.name, motorista });
    tx.set(
      registroRef,
      {
        childId,
        adminUid: agora.adminUid,
        perguntas: n,
        aberta: { parentUid: decisao.parentUid, chave, adminUid: agora.adminUid, notifId, em: FieldValue.serverTimestamp() },
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    // O aviso nasce NA MESMA transação: pergunta registrada sem aviso seria
    // uma pergunta que ninguém vê, e gastaria o teto.
    tx.create(db.doc(`notifications/${notifId}`), {
      userId: decisao.parentUid,
      type: 'irmao_pergunta',
      childId,
      title: aviso.title,
      body: aviso.body,
      primeiroNome: aviso.primeiroNome,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ...decisao, perguntas: n };
  });

  if (resultado.motivo === R.MOTIVO.NINGUEM && !resultado.mudou) {
    // Ninguém com este número na família do motorista: quem PEDIU acesso
    // com ele recebe o pedido aberto — o mesmo que o cadastro faz.
    const abertos = await abrirPedidosDeQuemEspera(db, { childId, crianca, chave });
    return { ...resultado, pedidos: abertos };
  }
  return resultado;
}

/**
 * O corpo do gatilho, separado para o teste do emulador chamar de verdade.
 * Devolve o que fez (o gatilho ignora; o teste lê).
 */
async function aoMudarOTelefone(db, { childId, antes, depois }) {
  if (!idValido(childId)) return { acao: R.ACAO.NADA };
  const troca = R.oQueFazerComATroca({ antes, depois });
  if (troca.acao === R.ACAO.NADA) return troca;
  if (troca.acao === R.ACAO.CHAVE_DA_FAMILIA) {
    return { ...troca, ...(await gravarChaveDaFamilia(db, { childId, depois, ...troca })) };
  }
  return { ...troca, ...(await perguntarOuAbrirPedido(db, { childId, chave: troca.chave })) };
}

function makeIrmaoNaTrocaDoTelefone(db) {
  return onDocumentUpdated(
    { document: 'children/{childId}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const antes = event.data && event.data.before && event.data.before.data();
      const depois = event.data && event.data.after && event.data.after.data();
      try {
        const r = await aoMudarOTelefone(db, { childId: event.params.childId, antes, depois });
        if (r.acao !== R.ACAO.NADA) logger.info('[irmao-depois]', { childId: event.params.childId, acao: r.acao, motivo: r.motivo });
      } catch (err) {
        // Falhar aqui não pode quebrar a edição da ficha: a criança segue
        // pelo convite do link, o caminho de sempre.
        logger.error('[irmao-depois] falhou', { childId: event.params.childId, err: err?.message });
      }
    }
  );
}

/**
 * "SIM, É MEU FILHO" / "NÃO É MEU FILHO" — a resposta à pergunta.
 *
 * O escopo é o uid autenticado contra a pergunta ABERTA no registro do
 * servidor. "Sim" vincula pelo caminho do irmão (`vinculadoPor:
 * 'irmao_confirmado'`, porque foi ela quem disse) e o motorista recebe "a
 * família de X entrou", o mesmo aviso do link — é exatamente o que aconteceu.
 * "Não" guarda a recusa para sempre e avisa o motorista como o `recusarIrmao`.
 */
function makeResponderIrmao(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    // `idValido` antes de virar caminho: `db.doc` aceita barra (reguaDosIds.js).
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Qual criança?');
    const resposta = request.data?.resposta;

    const childRef = db.doc(`children/${childId}`);
    const userRef = db.doc(`users/${uid}`);
    const registroRef = db.doc(`${COLECAO_DAS_PERGUNTAS}/${childId}`);

    const r = await db.runTransaction(async (tx) => {
      const [reg, c, u] = await Promise.all([tx.get(registroRef), tx.get(childRef), tx.get(userRef)]);
      const registro = reg.exists ? reg.data() : null;
      const notifId = registro && registro.aberta && registro.aberta.notifId;
      const notifRef = notifId && idValido(notifId) ? db.doc(`notifications/${notifId}`) : null;
      const n = notifRef ? await tx.get(notifRef) : null;
      const decisao = R.respostaDaPergunta({
        uid,
        resposta,
        registro,
        crianca: c.exists ? c.data() : null,
        conta: u.exists ? u.data() : null,
      });
      if (!decisao.ok) return decisao;
      if (decisao.vincular && !vinculoAindaCabe(c, u)) {
        return { ok: false, codigo: 'failed-precondition', erro: R.PERGUNTA_VENCIDA };
      }

      if (decisao.vincular) {
        gravarVinculoDeIrmao(tx, { childRef, userRef, adminUid: c.data().adminUid, vinculadoPor: 'irmao_confirmado' });
      } else if (c.exists) {
        tx.update(childRef, { irmaoRecusadoEm: FieldValue.serverTimestamp() });
      }
      tx.set(
        registroRef,
        {
          aberta: null,
          ...(decisao.vincular ? {} : { recusadoPor: FieldValue.arrayUnion(uid) }),
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      // A pergunta respondida some do Início. Só se o aviso ainda existe:
      // ela pode tê-lo apagado do sino.
      if (n && n.exists && n.data().userId === uid) {
        tx.update(notifRef, { respondida: resposta, read: true });
      }
      return { ...decisao, crianca: c.exists ? c.data() : null };
    });

    if (!r.ok) throw new HttpsError(r.codigo, r.erro);

    if (r.vincular) {
      // "A família de X entrou" — fora da transação, e falhar não desfaz nada.
      const aviso = avisoDaFamiliaEntrou({ ...r.crianca, vinculadoPor: 'irmao_confirmado' }, childId);
      const id = aviso && idDoAvisoDaFamiliaEntrou(childId);
      if (id) {
        try {
          await db.doc(`notifications/${id}`).create({ ...aviso, read: false, createdAt: FieldValue.serverTimestamp() });
        } catch (err) {
          if (!(err?.code === 6 || err?.code === 'already-exists')) {
            logger.warn('[irmao-depois] aviso ao motorista não saiu', { childId, erro: err?.message });
          }
        }
      }
      logger.info('[irmao-depois] confirmado', { childId, uid });
      return { ok: true, vinculado: true };
    }

    await avisarMotoristaDaRecusa(db, r.crianca, childId);
    logger.info('[irmao-depois] recusado', { childId, uid });
    return { ok: true, vinculado: false };
  });
}

module.exports = { makeIrmaoNaTrocaDoTelefone, makeResponderIrmao, aoMudarOTelefone };
