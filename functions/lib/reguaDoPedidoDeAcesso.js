/**
 * A RESPOSTA DO MOTORISTA AO PEDIDO DE ACESSO — régua PURA (14/11/2026,
 * decisão 28: o telefone sozinho nunca prova vínculo).
 *
 * ⚠️ O PEDIDO NÃO VINCULA CONTA NENHUMA. Até aqui o motorista "aprovava" e a
 * conta que pediu virava responsável da criança. O pedido nasce do WhatsApp
 * que a conta DIGITOU e do nome que ela ESCOLHEU — quem conhece o número da
 * mãe (um ex-companheiro, por exemplo) criava a conta, pedia com o nome
 * dela, e o motorista, vendo nome e número batendo com o cadastro, aprovava:
 * a conta passava a ver endereço, escola, foto e a perua ao vivo.
 *
 * Agora o motorista tem duas saídas, e nenhuma escreve em `children` nem em
 * `users`:
 *   - ENVIAR_LINK: a tela abre o WhatsApp no número que ELE cadastrou, com o
 *     link do convite. Quem entra é quem tem aquele WhatsApp na mão — pelo
 *     link, como qualquer família. O pedido só fecha (`link_enviado`).
 *   - DESCARTAR: o pedido fecha como `recusado`, e quem pediu é avisado,
 *     como antes.
 *
 * ⚠️ `link_enviado` NÃO É LIDO POR QUEM PEDIU: as rules só mostram a ela
 * `aprovado` e `recusado`. Dizer "o link foi enviado" confirmaria a um
 * estranho que aquele número é de uma família da plataforma — e a mãe de
 * verdade já sabe, porque a mensagem chegou no WhatsApp dela.
 *
 * Cliente antigo (PWA em cache) ainda manda `aprovar: true`: vira
 * ENVIAR_LINK. Nunca vínculo.
 *
 * Régua sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 */

const ACAO = Object.freeze({ ENVIAR_LINK: 'enviar_link', DESCARTAR: 'descartar' });

const STATUS = Object.freeze({
  AGUARDANDO: 'aguardando',
  LINK_ENVIADO: 'link_enviado',
  RECUSADO: 'recusado',
  // Só existe em pedido ANTIGO, de quando aprovar vinculava. Nada grava mais.
  APROVADO: 'aprovado',
});

/** O que o cliente pediu. `null` quando não dá para saber. */
function acaoDoPedido(dados) {
  const acao = dados?.acao;
  if (acao === ACAO.ENVIAR_LINK || acao === ACAO.DESCARTAR) return acao;
  if (dados?.aprovar === true) return ACAO.ENVIAR_LINK;
  if (dados?.aprovar === false) return ACAO.DESCARTAR;
  return null;
}

/**
 * A decisão inteira. Devolve `{ ok: false, codigo, erro }` ou
 * `{ ok: true, status, avisarQuemPediu }` — e NADA além disso: não existe
 * campo de vínculo para o gravador aplicar.
 */
function respostaAoPedido({ pedido, crianca, adminUid, acao }) {
  if (!pedido || !adminUid || pedido.adminUid !== adminUid) {
    return { ok: false, codigo: 'permission-denied', erro: 'Este pedido não é seu.' };
  }
  if (pedido.status !== STATUS.AGUARDANDO) {
    return { ok: false, codigo: 'failed-precondition', erro: 'Este pedido já foi respondido.' };
  }
  if (acao === ACAO.DESCARTAR) {
    return { ok: true, status: STATUS.RECUSADO, avisarQuemPediu: true };
  }
  if (acao !== ACAO.ENVIAR_LINK) {
    return { ok: false, codigo: 'invalid-argument', erro: 'O que fazer com o pedido?' };
  }
  if (!crianca || crianca.adminUid !== adminUid) {
    return { ok: false, codigo: 'not-found', erro: 'Criança não encontrada.' };
  }
  // O link pode ter chegado antes: a família já entrou.
  if (crianca.parentUid) {
    return { ok: false, codigo: 'failed-precondition', erro: 'Esta criança já tem responsável no app.' };
  }
  return { ok: true, status: STATUS.LINK_ENVIADO, avisarQuemPediu: false };
}

module.exports = { ACAO, STATUS, acaoDoPedido, respostaAoPedido };
