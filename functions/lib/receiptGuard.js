/**
 * Detecção de comprovante reusado.
 *
 * O QUE ISTO É E O QUE NÃO É
 * Não é verificação de pagamento. Nenhuma análise de imagem prova que um PIX
 * aconteceu — só a conciliação com o extrato do banco prova. Isto aqui é
 * detecção de DUPLICATA: o mesmo arquivo anexado em dois meses diferentes.
 *
 * É o abuso mais comum, e boa parte das vezes não é nem má-fé: a pessoa
 * procura na galeria e pega o print errado. Por isso o resultado é um AVISO
 * pro tio ("idêntico ao de julho"), não um bloqueio. Heurística que acusa
 * sozinha erra e estraga uma relação que precisa durar anos.
 *
 * Roda no servidor porque o cliente do pai não pode — e não deve — enxergar
 * os pagamentos das outras famílias pra comparar.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');

const REGION = 'southamerica-east1';

function makeFlagDuplicateReceipts(db) {
  return onDocumentWritten(
    {
      document: 'payments/{paymentId}',
      region: REGION,
      maxInstances: LIMITES.GATILHO,
    },
    async (event) => {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!after) return;

      const hash = after.receiptHash;
      // Só age quando o hash MUDOU: senão cada escrita no pagamento
      // dispararia a varredura de novo.
      if (!hash || hash === before?.receiptHash) return;

      // ⚠️ ESCOPADO POR `adminUid` — SEM ISSO A BUSCA ATRAVESSAVA CARTEIRAS.
      //
      // A varredura era por `receiptHash` na coleção inteira. Como isto roda
      // com Admin SDK, não passa por rules: o isolamento que `payments`
      // conquistou era furado por dentro.
      //
      // O estrago não é a detecção errada, é o que ela ESCREVE: o bloco
      // abaixo grava `childName` e `month` do outro pagamento dentro do
      // documento deste — e o motorista tem permissão de ler o documento
      // dele. Ou seja, o nome de uma criança de outra operação aparecia na
      // tela de financeiro de um parceiro que não deveria conhecê-la.
      //
      // Colisão de hash entre inquilinos não é só teórica: o mesmo print
      // genérico de comprovante reencaminhado dá o mesmo hash. E o pai pode
      // escrever `receiptHash` à mão, o que torna a colisão forjável.
      //
      // Duplicata que interessa é sempre dentro da MESMA carteira: quem cobra
      // é o motorista, e "este comprovante é igual ao de julho" só faz sentido
      // entre os pagamentos dele.
      const adminUid = after.adminUid || before?.adminUid || null;
      if (!adminUid) {
        logger.warn('[comprovante] pagamento sem adminUid — duplicata não conferida', {
          paymentId: event.params.paymentId,
        });
        return;
      }

      const dupSnap = await db
        .collection('payments')
        .where('adminUid', '==', adminUid)
        .where('receiptHash', '==', hash)
        .limit(5)
        .get();

      const others = dupSnap.docs.filter((d) => d.id !== event.params.paymentId);

      if (others.length === 0) {
        // Deixa de sinalizar se o comprovante foi trocado por um inédito.
        await db.doc(`alertasDeComprovante/${event.params.paymentId}`).delete();
        // ⚠️ E LIMPA O CAMPO LEGADO NO PAGAMENTO. Ele ficou lá até
        // 11/09/2026 e é lido pela RESPONSÁVEL — ver o bloco abaixo. Todo
        // pagamento que passar por aqui de novo sai limpo de graça.
        if (after.receiptDuplicateOf !== undefined) {
          await event.data.after.ref.update({ receiptDuplicateOf: FieldValue.delete() });
        }
        return;
      }

      // Guarda o MÊS do outro pagamento, não o id: é o que o tio precisa ler
      // ("idêntico ao de julho"), e evita uma leitura extra na tela dele.
      const first = others[0].data();

      // ⚠️ O AVISO NÃO MORA NO PAGAMENTO, E ISSO É CORREÇÃO DE VAZAMENTO.
      //
      // Ele era um campo do próprio documento, e a tela o mostrava só ao
      // motorista (`role === 'admin' && payment.receiptDuplicateOf`). Só que
      // a RESPONSÁVEL lê o pagamento inteiro — é a mensalidade dela, e a
      // regra permite com razão. Esconder na tela não esconde o dado: quem
      // abre o console lê o campo e descobre que a plataforma marcou o
      // comprovante dela como suspeito. Era o julgamento que o desenho
      // decidiu explicitamente não mostrar a ela ("aviso, não bloqueio, e só
      // pro tio — é ele quem decide").
      //
      // ⚠️ E O `childName` É DO OUTRO PAGAMENTO: entre famílias diferentes do
      // mesmo motorista, isso é o nome da criança de um terceiro dentro do
      // documento dela.
      //
      // `adminUid` vai no corpo porque é por ele que a regra escopa — sem
      // isso ela precisaria de um `get()` no pagamento a cada leitura.
      await db.doc(`alertasDeComprovante/${event.params.paymentId}`).set({
        paymentId: event.params.paymentId,
        adminUid,
        outroPagamentoId: others[0].id,
        month: first.month || null,
        childName: first.childName || null,
        em: FieldValue.serverTimestamp(),
      });

      // O campo antigo sai do pagamento no mesmo gesto.
      if (after.receiptDuplicateOf !== undefined) {
        await event.data.after.ref.update({ receiptDuplicateOf: FieldValue.delete() });
      }

      logger.warn(
        `Comprovante duplicado: payment=${event.params.paymentId} igual a ${others[0].id}`
      );
    }
  );
}

module.exports = { makeFlagDuplicateReceipts };
