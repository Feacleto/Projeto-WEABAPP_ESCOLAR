/**
 * O PAGAMENTO DA AUXILIAR — as duas callables da fase 4 (05/10/2026).
 *
 *   anotarPagamentoDaAuxiliar        o MOTORISTA anota que pagou o mês dela;
 *                                    nasce o recibo E a despesa do caixa dele
 *   confirmarRecebimentoDaAuxiliar   ELA toca em "Recebi"; o motorista é
 *                                    avisado
 *
 * ── POR QUE É TUDO NO SERVIDOR
 * O recibo é lido pelos DOIS lados, e cada lado só pode escrever a sua
 * metade: ele o valor, ela o "recebi". Rule não separa metades de documento
 * com segurança suficiente para isso — o que ela escrevesse no valor, ou ele
 * no "recebi", seria um recibo falso com o nome do outro. As rules fecham a
 * escrita de `pagamentosDaAuxiliar` a todo cliente.
 *
 * ── A DESPESA NASCE NA MESMA TRANSAÇÃO
 * "Vira a despesa Auxiliar do mês" é a promessa da tela. Em duas escritas
 * separadas, a rede caindo no meio deixaria o recibo sem despesa (o caixa
 * dele sobrando R$ 900) ou a despesa sem recibo (ela sem nada para
 * confirmar). A categoria é `monitor`, que as telas do caixa já chamam de
 * "Auxiliar" — uma segunda chave partiria o custo dela em dois baldes no
 * "Preciso aumentar?" e no histórico de salários.
 *
 * ⚠️ Apagar a despesa no caixa NÃO apaga o recibo: o recibo é dos dois, e ela
 * pode já ter confirmado. A despesa guarda `pagamentoDaAuxiliar` com o id.
 *
 * A régua (valor, mês, id, quem confirma) é pura:
 * `reguaDoPagamentoDaAuxiliar.js`.
 */

'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { idValido } = require('./reguaDosIds');
const { exigirContaDoMotoristaOperando } = require('./auxiliares');
const R = require('./reguaDoPagamentoDaAuxiliar');

const REGION = 'southamerica-east1';
const COLECAO = 'pagamentosDaAuxiliar';

function makeAnotarPagamentoDaAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = await exigirMotorista(db, request);
    const auxiliarUid = String(request.data?.auxiliarUid || '');
    const mes = String(request.data?.mes || '');
    if (!idValido(auxiliarUid)) throw new HttpsError('invalid-argument', 'Qual auxiliar?');
    const agoraMs = Date.now();
    if (!R.mesPodeSerAnotado(mes, agoraMs)) throw new HttpsError('invalid-argument', 'Escolha um mês deste ano para trás.');
    const valor = R.valorValido(request.data?.valor);
    if (valor == null) {
      throw new HttpsError('invalid-argument', `O valor precisa ser maior que zero e até R$ ${R.VALOR_MAXIMO.toLocaleString('pt-BR')}.`);
    }
    await exigirContaDoMotoristaOperando(db, uid);

    const id = R.idDoPagamento(uid, auxiliarUid, mes);
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Qual auxiliar?');
    const vinculoRef = db.doc(`auxiliares/${auxiliarUid}`);
    const reciboRef = db.doc(`${COLECAO}/${id}`);
    const despesaRef = db.collection('expenses').doc();

    return db.runTransaction(async (tx) => {
      const [vinculo, recibo] = await Promise.all([tx.get(vinculoRef), tx.get(reciboRef)]);
      const v = vinculo.exists ? vinculo.data() : null;
      if (!v || v.motoristaUid !== uid || v.ativa !== true) {
        throw new HttpsError('permission-denied', 'Esta auxiliar não está ativa com você.');
      }
      // Um por mês: o segundo toque acha o primeiro e para, sem segunda despesa.
      if (recibo.exists) {
        throw new HttpsError('already-exists', 'O pagamento deste mês já foi anotado.');
      }
      const agora = FieldValue.serverTimestamp();
      const nome = String(v.nome || '').slice(0, 60);
      tx.create(reciboRef, {
        motoristaUid: uid,
        auxiliarUid,
        nomeDaAuxiliar: nome,
        mes,
        valor,
        anotadoEm: agora,
        recebidoEm: null,
        despesaId: despesaRef.id,
      });
      // O MESMO FORMATO de `addExpense` (src/services/expensesService.js):
      // o caixa, o extrato e as despesas do mês leem esta linha como
      // qualquer outra.
      tx.set(despesaRef, {
        adminUid: uid,
        amount: valor,
        category: 'monitor',
        description: R.descricaoDaDespesa(nome, mes),
        date: Timestamp.fromMillis(R.dataDaDespesa(mes, agoraMs)),
        monthKey: mes,
        pagamentoDaAuxiliar: id,
        createdAt: agora,
      });
      return { ok: true, id };
    });
  });
}

function makeConfirmarRecebimentoDaAuxiliar(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    const id = String(request.data?.id || '');
    if (!idValido(id)) throw new HttpsError('invalid-argument', 'Qual pagamento?');
    const ref = db.doc(`${COLECAO}/${id}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const pagamento = snap.exists ? snap.data() : null;
      const { pode, jaConfirmado } = R.podeConfirmar(pagamento, uid);
      if (!pode) throw new HttpsError('permission-denied', 'Este pagamento não é seu.');
      // A segunda confirmação não muda a data nem avisa o motorista de novo.
      if (jaConfirmado) return { ok: true, jaEra: true };
      const agora = FieldValue.serverTimestamp();
      tx.update(ref, { recebidoEm: agora });
      tx.set(db.collection('notifications').doc(), {
        userId: pagamento.motoristaUid,
        ...R.avisoDaConfirmacao({ nome: pagamento.nomeDaAuxiliar, mes: pagamento.mes }),
        read: false,
        createdAt: agora,
      });
      return { ok: true, jaEra: false };
    });
  });
}

module.exports = { makeAnotarPagamentoDaAuxiliar, makeConfirmarRecebimentoDaAuxiliar };
