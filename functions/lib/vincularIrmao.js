/**
 * O IRMÃO APARECE SOZINHO NO APP DO RESPONSÁVEL (02/10/2026).
 *
 * Quando uma criança nasce em `children`, este gatilho olha o WhatsApp do
 * responsável dela. Se ele pertence a UMA conta de responsável que já usa o
 * app, a criança é vinculada a essa conta na hora — o mesmo vínculo que o
 * `redeemInvite` faz pelo link — e ela recebe um aviso com "Não é meu filho".
 * A régua (quem é o responsável) é pura: `reguaDoIrmao.js`.
 *
 * ── POR QUE GATILHO, E NÃO O CLIENTE
 * Achar a conta pelo telefone exige ler `users` de terceiros. Abrir isso ao
 * motorista entregaria a ele o telefone de qualquer responsável da base. O
 * gatilho roda com Admin SDK, não pode ser forjado, e o motorista não vê
 * nada além do resultado (`parentUid` na criança dele).
 *
 * ── ⚠️ O VÍNCULO ERRADO TEM SAÍDA, E ELA É DA MÃE
 * WhatsApp digitado errado vincula a criança a outra família. Por isso:
 *   - a criança grava `vinculadoPor: 'irmao'` (só esse vínculo pode ser
 *     desfeito pela callable abaixo — o do link, não);
 *   - a mãe recebe o aviso na hora, e "Não é meu filho" desfaz tudo e avisa
 *     o motorista para conferir o número e mandar o convite;
 *   - ambíguo (o número casa com duas contas) não vincula.
 *
 * ── CONTAS ANTIGAS
 * `phoneChave` passa a ser gravado em `users` no resgate do convite
 * (`invites.js`). Quem resgatou antes disso não o tem — para essas, o
 * gatilho olha também as crianças JÁ VINCULADAS do mesmo motorista, que
 * guardam `parentPhone`. Irmãos na mesma perua são o caso comum.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { responsavelDoIrmao, chaveDoTelefone } = require('./reguaDoIrmao');
const { abrirPedido } = require('./pedidosDeAcesso');

const REGION = 'southamerica-east1';

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

function makeVincularIrmao(db) {
  return onDocumentCreated(
    { document: 'children/{childId}', region: REGION, maxInstances: LIMITES.GATILHO },
    async (event) => {
      const crianca = event.data && event.data.data();
      if (!crianca || crianca.parentUid) return;
      const chave = chaveDoTelefone(crianca.parentPhone);
      if (!chave) return;
      const childId = event.params.childId;

      try {
        const [porChave, vinculadas] = await Promise.all([
          db.collection('users').where('phoneChave', '==', chave).limit(3).get(),
          crianca.adminUid
            ? db.collection('children').where('adminUid', '==', crianca.adminUid).get()
            : Promise.resolve({ docs: [] }),
        ]);
        const parentUid = responsavelDoIrmao({
          telefone: crianca.parentPhone,
          contas: porChave.docs.map((d) => ({ uid: d.id, ...d.data() })),
          criancas: vinculadas.docs
            .filter((d) => d.id !== childId)
            .map((d) => d.data()),
        });
        if (!parentUid) {
          // QUEM JÁ PEDIU ACESSO COM ESTE NÚMERO E ESTAVA ESPERANDO
          // (`pedidosDeAcesso.js`). O número dela não é comprovado, então
          // aqui nunca se vincula: nasce o PEDIDO, e o motorista aprova.
          const esperando = await db
            .collection('users')
            .where('telefoneAguardandoChave', '==', chave)
            .limit(3)
            .get();
          for (const d of esperando.docs) {
            const conta = d.data();
            if (conta.role !== 'parent') continue;
            await abrirPedido(db, {
              crianca: { id: childId, ...crianca },
              parentUid: d.id,
              nome: conta.name,
              email: conta.email,
              telefone: crianca.parentPhone,
            });
          }
          return;
        }

        const childRef = db.doc(`children/${childId}`);
        const userRef = db.doc(`users/${parentUid}`);
        const vinculou = await db.runTransaction(async (tx) => {
          const [c, u] = await Promise.all([tx.get(childRef), tx.get(userRef)]);
          // O link pode ter chegado antes: quem resgatou primeiro venceu.
          if (!c.exists || c.data().parentUid) return false;
          if (!u.exists || u.data().role !== 'parent') return false;
          tx.update(childRef, {
            parentUid,
            inviteStatus: 'used',
            inviteUsedAt: FieldValue.serverTimestamp(),
            vinculadoPor: 'irmao',
          });
          tx.set(
            userRef,
            {
              childIds: FieldValue.arrayUnion(childId),
              ...(crianca.adminUid ? { adminUids: FieldValue.arrayUnion(crianca.adminUid) } : {}),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          return true;
        });
        if (!vinculou) return;

        const nome = primeiroNome(crianca.name) || 'A criança';
        await db.collection('notifications').add({
          userId: parentUid,
          type: 'irmao_vinculado',
          childId,
          title: `${nome} foi adicionado ao seu app`,
          body: 'O motorista cadastrou com o seu WhatsApp. Se não for seu filho, toque para desfazer.',
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        logger.info('[irmao] vinculado', { childId, parentUid });
      } catch (err) {
        // Sem vínculo automático, a criança segue pelo convite do link — o
        // caminho de sempre. Falhar aqui não pode quebrar o cadastro.
        logger.error('[irmao] falhou', { childId, err: err?.message });
      }
    }
  );
}

/**
 * "NÃO É MEU FILHO" — a mãe desfaz o vínculo automático.
 *
 * Só desfaz o que o gatilho fez (`vinculadoPor: 'irmao'`): o vínculo pelo
 * link foi um gesto dela, e quem quer sair dele fala com o motorista. O
 * escopo vem do uid autenticado, nunca do payload.
 */
function makeRecusarIrmao(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    if (!childId) throw new HttpsError('invalid-argument', 'Qual criança?');

    const childRef = db.doc(`children/${childId}`);
    const userRef = db.doc(`users/${uid}`);
    const crianca = await db.runTransaction(async (tx) => {
      const [c, u] = await Promise.all([tx.get(childRef), tx.get(userRef)]);
      const dados = c.exists ? c.data() : null;
      if (!dados || dados.parentUid !== uid || dados.vinculadoPor !== 'irmao') {
        throw new HttpsError('failed-precondition', 'Esta criança não pode ser desfeita por aqui.');
      }
      // O motorista só sai de `adminUids` se nenhum OUTRO filho dela roda com
      // ele — senão ela perderia a chave PIX e o mapa do irmão de verdade.
      const outros = (u.data()?.childIds || []).filter((id) => id !== childId);
      const outrosSnaps = await Promise.all(outros.map((id) => tx.get(db.doc(`children/${id}`))));
      const aindaComEle = outrosSnaps.some((s) => s.exists && s.data().adminUid === dados.adminUid);

      tx.update(childRef, {
        parentUid: null,
        inviteStatus: 'pending',
        inviteUsedAt: FieldValue.delete(),
        vinculadoPor: FieldValue.delete(),
        irmaoRecusadoEm: FieldValue.serverTimestamp(),
      });
      tx.set(
        userRef,
        {
          childIds: FieldValue.arrayRemove(childId),
          ...(!aindaComEle && dados.adminUid
            ? { adminUids: FieldValue.arrayRemove(dados.adminUid) }
            : {}),
          ...(u.data()?.childId === childId ? { childId: outros[0] || null } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return dados;
    });

    if (crianca.adminUid) {
      const nome = primeiroNome(crianca.name) || 'a criança';
      await db.collection('notifications').add({
        userId: crianca.adminUid,
        type: 'irmao_recusado',
        childId,
        title: `O WhatsApp de ${nome} pode estar errado`,
        body: 'A pessoa desse número disse que não é responsável. Confira o número e mande o convite pelo link.',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { ok: true };
  });
}

module.exports = { makeVincularIrmao, makeRecusarIrmao };
