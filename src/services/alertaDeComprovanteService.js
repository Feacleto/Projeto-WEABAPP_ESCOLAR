import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O AVISO DE COMPROVANTE DUPLICADO — e por que ele não mora no pagamento.
 *
 * ── O QUE ELE É
 * `flagDuplicateReceipts` compara o hash do arquivo com os outros pagamentos
 * DAQUELE motorista. Quando bate, o app avisa: *"comprovante igual ao de
 * julho, vale conferir"*. É aviso, nunca bloqueio — boa parte das vezes não é
 * má-fé, a pessoa procura na galeria e pega o print errado.
 *
 * ── POR QUE SAIU DE `payments` (11/09/2026)
 * Ele era um campo do próprio pagamento, e a tela o mostrava só para o
 * motorista:
 *
 *     {role === 'admin' && payment.receiptDuplicateOf && ...}
 *
 * Só que a RESPONSÁVEL lê o documento do pagamento inteiro — é a mensalidade
 * dela, e a regra permite com razão. **Esconder na tela não esconde o dado**:
 * quem abre o console do navegador lê o campo. Ou seja, ela via que a
 * plataforma marcou o comprovante dela como suspeito — exatamente o
 * julgamento que o desenho decidiu não mostrar a ela.
 *
 * ⚠️ E TINHA PIOR: o aviso guarda o `childName` do OUTRO pagamento. Entre
 * famílias diferentes do mesmo motorista, isso é o nome da criança de um
 * terceiro dentro do documento dela.
 *
 * ── ONDE ELE FICA AGORA
 * `alertasDeComprovante/{paymentId}`, com `adminUid` no corpo — é por ele que
 * a regra escopa, sem precisar de um `get()` no pagamento. Só o motorista
 * daquele pagamento e o dono leem. **Nenhum cliente escreve**: quem grava é a
 * function, com Admin SDK.
 *
 * ── A LIÇÃO, QUE VALE PARA O PRÓXIMO CAMPO
 * Quando a tela esconde algo por PAPEL, a pergunta é se aquilo é
 * irrelevância ou segredo. Irrelevância pode ficar no documento (o total
 * acumulado que o pai não vê é a soma do que ele já lê). Segredo tem que sair
 * do documento — não existe esconder de quem baixou o JSON.
 */

/** Os avisos abertos de um motorista. Chave: o id do pagamento. */
export function watchAlertasDeComprovante(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate({});
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'alertasDeComprovante'), where('adminUid', '==', adminUid)),
    (snap) => {
      const porPagamento = {};
      snap.docs.forEach((d) => {
        porPagamento[d.id] = { id: d.id, ...d.data() };
      });
      onUpdate(porPagamento);
    },
    (err) => {
      // Degrada calado, como a vitrine: sem o aviso o motorista confere o
      // comprovante do mesmo jeito. Derrubar a tela do dinheiro dele por
      // causa de uma dica seria a troca errada.
      console.error('watchAlertasDeComprovante:', err);
      if (onError) onError(err);
      else onUpdate({});
    }
  );
}
