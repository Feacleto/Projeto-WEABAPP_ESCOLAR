/**
 * TIRAR UMA CRIANÇA DA CONTA DA FAMÍLIA — sem apagar a conta (02/10/2026).
 *
 * ── POR QUE ISTO EXISTE
 * "Remover criança" (`deactivateChildAndParent`, no cliente do motorista)
 * APAGAVA o documento `users/{parentUid}` inteiro. A mãe de dois irmãos perdia
 * o acesso ao outro filho; a mãe com filho em OUTRA perua perdia o acesso ao
 * filho do outro motorista — e nenhum dos dois era avisado. Achado na leitura
 * das jornadas (teste no navegador).
 *
 * O cliente do motorista não pode fazer isto direito: as rules não deixam (e
 * não devem deixar) o motorista escrever no documento da família — só apagar.
 * Tirar UM `childId` da lista dela é trabalho de Admin SDK.
 *
 * ── O QUE FAZ, numa transação
 *   - confere que quem chama é o motorista DA criança;
 *   - tira a criança de `users.childIds` da família, e o motorista de
 *     `adminUids` se nenhum outro filho dela roda com ele (mesma regra de
 *     `recusarIrmao`);
 *   - ⚠️ NUNCA APAGA A CONTA (14/11/2026, decisão do dono). Era assim que a
 *     família de um filho só terminava: o documento `users` sumia, a conta do
 *     Auth ficava órfã e, ao entrar, ela caía em "Falta ligar sua conta" —
 *     uma tela que manda começar uma conta que ela já tem. Agora ela perde
 *     SÓ o acesso àquela criança. Sem outro filho, fica `role: 'parent'`
 *     sem criança, no card de espera que o app já tem (`SemVinculoGate`),
 *     marcada com `semFilhoDesde` para o card dizer o que aconteceu em vez
 *     de "Pedido enviado". Um convite novo a religa (`redeemInvite` aceita
 *     responsável que já existe), e apagar a conta é escolha dela.
 *
 * O que sai do documento dela é o que era DO FILHO: o id na lista, o
 * motorista (singular e lista) quando nenhum outro filho roda com ele, e o
 * `childId` legado — que `getChildIds` soma à lista, e que sobrando faria o
 * app achar que ela ainda tem filho. O que é DELA fica: nome, telefone,
 * e-mail, aceite dos termos, aparelhos (`fcmTokens`), marcos, e a
 * `phoneChave` (o número dela, não do filho).
 *
 * Quem desativa a criança (active:false, limpa vínculo e aceite) continua
 * sendo o cliente, depois desta chamada.
 *
 * ⚠️ ESTA FUNÇÃO JÁ APAGOU QUALQUER CONTA (corrigido em 03/10/2026). O
 * `childId` vinha de `request.data` sem conferência, e `db.doc` aceita barra:
 * `"<minhaCrianca>/rides/x"` endereçava uma viagem onde o próprio motorista
 * tinha plantado `{ adminUid: ele, parentUid: vítima }` — e a conta da vítima
 * (o dono incluído) era apagada. Hoje são duas travas, e cada uma sozinha já
 * fecharia o caminho:
 *   - o id passa por `idValido` antes de virar caminho;
 *   - o alvo precisa ser RESPONSÁVEL e ter ESTA criança na lista dele
 *     (`podeDesvincular`, em reguaDoDesvinculo.js).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { idValido } = require('./reguaDosIds');
const { podeDesvincular } = require('./reguaDoDesvinculo');

const REGION = 'southamerica-east1';

function makeDesvincularResponsavel(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const childId = String(request.data?.childId || '');
    if (!idValido(childId)) throw new HttpsError('invalid-argument', 'Qual criança?');

    const childRef = db.doc(`children/${childId}`);
    return db.runTransaction(async (tx) => {
      const c = await tx.get(childRef);
      const crianca = c.exists ? c.data() : null;
      if (!crianca) throw new HttpsError('not-found', 'Criança não encontrada.');
      // Escopo pelo uid AUTENTICADO, nunca por `request.data` (papeis.js).
      if (crianca.adminUid !== uid) {
        throw new HttpsError('permission-denied', 'Esta criança não é da sua turma.');
      }
      const parentUid = crianca.parentUid || null;
      if (!parentUid) return { ok: true, conta: 'sem-responsavel' };
      if (!idValido(parentUid)) {
        throw new HttpsError('failed-precondition', 'O responsável desta criança não confere.');
      }

      const userRef = db.doc(`users/${parentUid}`);
      const u = await tx.get(userRef);
      if (!u.exists) return { ok: true, conta: 'ja-nao-existe' };
      const familia = u.data();
      // Nunca uma conta de motorista ou de dono, e nunca uma família que não
      // tenha ESTA criança na lista que o servidor mantém.
      if (!podeDesvincular(familia, childId)) {
        throw new HttpsError('failed-precondition', 'O responsável desta criança não confere.');
      }

      const outros = (familia.childIds || []).filter((id) => id !== childId && idValido(id));
      // Toda leitura antes de qualquer escrita (o Admin SDK exige, e
      // `testar:transacoes` confere).
      const outrosSnaps = await Promise.all(outros.map((id) => tx.get(db.doc(`children/${id}`))));
      if (outros.length === 0) {
        // O último filho: a conta FICA, sem criança e sem motorista. O
        // motorista sai do singular e da lista inteira — sem filho, nenhum
        // motorista tem por que ler o documento dela (as rules escopam por
        // esses dois campos) — e `childId` sai, senão `getChildIds` ainda o
        // contaria e o card de espera nunca apareceria.
        tx.set(
          userRef,
          {
            childIds: [],
            childId: FieldValue.delete(),
            adminUid: FieldValue.delete(),
            adminUids: [],
            semFilhoDesde: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { ok: true, conta: 'mantida', filhosRestantes: 0 };
      }

      // Tem outro filho (irmão ou em outra perua): a conta FICA.
      const aindaComEle = outrosSnaps.some((s) => s.exists && s.data().adminUid === uid);
      tx.set(
        userRef,
        {
          childIds: FieldValue.arrayRemove(childId),
          ...(!aindaComEle ? { adminUids: FieldValue.arrayRemove(uid) } : {}),
          ...(familia.childId === childId ? { childId: outros[0] } : {}),
          ...(familia.adminUid === uid && !aindaComEle
            ? { adminUid: outrosSnaps.find((s) => s.exists)?.data().adminUid || null }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, conta: 'mantida', filhosRestantes: outros.length };
    });
  });
}

module.exports = { makeDesvincularResponsavel };
