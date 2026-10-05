/**
 * `meuCodigoDeIndicacao` — o motorista pede o código dele; o servidor cria se
 * não existir (04/10/2026).
 *
 * ── POR QUE NASCE NO SERVIDOR
 * O código casa a indicação: quem digita "NINO-4821" no cadastro foi indicado
 * pelo Tio Nino. Se o cliente escrevesse `users.codigoDeIndicacao`, um tio
 * copiaria o código de outro e levaria o crédito da indicação alheia. Por
 * isso o campo é PROIBIDO ao cliente nas rules, e a unicidade é garantida
 * aqui, numa transação sobre `codigosDeIndicacao/{codigo}` (só o servidor lê
 * e escreve essa coleção — ela não tem bloco nas rules, então é negada a
 * todo cliente).
 *
 * ── O QUE O CÓDIGO DÁ
 * Decisão do dono: o cupom dá ACESSO (o app completo por um tempo), não
 * preço. Esta função só cria e devolve o código; o benefício é de quem lê o
 * cupom no cadastro.
 *
 * A régua (formato, normalização) é pura e mora em `reguaDoCodigo.js`.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { gerarCodigo } = require('./reguaDoCodigo');

const REGION = 'southamerica-east1';
const TENTATIVAS = 6;

function makeMeuCodigoDeIndicacao(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const userRef = db.doc(`users/${uid}`);

    const atual = await userRef.get();
    const existente = atual.exists ? atual.data()?.codigoDeIndicacao : null;
    if (existente) return { codigo: existente };

    const nome = atual.data()?.marcaNome || atual.data()?.name || '';
    for (let i = 0; i < TENTATIVAS; i++) {
      const codigo = gerarCodigo(nome);
      const codigoRef = db.doc(`codigosDeIndicacao/${codigo}`);
      const criado = await db.runTransaction(async (tx) => {
        const [jaTem, usado] = await Promise.all([tx.get(userRef), tx.get(codigoRef)]);
        // Duas abas pedindo ao mesmo tempo: a segunda acha o código da primeira.
        const corrente = jaTem.exists ? jaTem.data()?.codigoDeIndicacao : null;
        if (corrente) return corrente;
        if (usado.exists) return null;
        tx.create(codigoRef, { uid, criadoEm: FieldValue.serverTimestamp() });
        tx.set(userRef, { codigoDeIndicacao: codigo }, { merge: true });
        return codigo;
      });
      if (criado) return { codigo: criado };
    }
    throw new HttpsError('resource-exhausted', 'Não deu pra criar o código agora. Tente de novo.');
  });
}

module.exports = { makeMeuCodigoDeIndicacao };
