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

const REGION = 'southamerica-east1';

function makeFlagDuplicateReceipts(db) {
  return onDocumentWritten(
    { document: 'payments/{paymentId}', region: REGION },
    async (event) => {
      const before = event.data?.before?.data();
      const after = event.data?.after?.data();
      if (!after) return;

      const hash = after.receiptHash;
      // Só age quando o hash MUDOU: senão cada escrita no pagamento
      // dispararia a varredura de novo.
      if (!hash || hash === before?.receiptHash) return;

      const dupSnap = await db
        .collection('payments')
        .where('receiptHash', '==', hash)
        .limit(5)
        .get();

      const others = dupSnap.docs.filter((d) => d.id !== event.params.paymentId);

      if (others.length === 0) {
        // Deixa de sinalizar se o comprovante foi trocado por um inédito.
        if (after.receiptDuplicateOf) {
          await event.data.after.ref.update({ receiptDuplicateOf: null });
        }
        return;
      }

      // Guarda o MÊS do outro pagamento, não o id: é o que o tio precisa ler
      // ("idêntico ao de julho"), e evita uma leitura extra na tela dele.
      const first = others[0].data();
      await event.data.after.ref.update({
        receiptDuplicateOf: {
          paymentId: others[0].id,
          month: first.month || null,
          childName: first.childName || null,
        },
      });

      logger.warn(
        `Comprovante duplicado: payment=${event.params.paymentId} igual a ${others[0].id}`
      );
    }
  );
}

module.exports = { makeFlagDuplicateReceipts };
