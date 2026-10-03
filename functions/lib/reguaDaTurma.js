/**
 * QUANTAS CRIANÇAS ATIVAS O MOTORISTA TEM — a régua do contador do servidor.
 *
 * ⚠️ RÉGUA PURA: nenhum `require`. Quem conta e grava é `contadorDaTurma.js`,
 * que requer o SDK; esta metade é a que `npm run testar:trial` alcança sem
 * `functions/node_modules` (ver `testar:imports`).
 *
 * ── POR QUE O CONTADOR SAIU DO CLIENTE (03/10/2026)
 * `users.criancasAtivas` é o número que a fatura da plataforma multiplica pela
 * taxa. Ele era escrito pelo CLIENTE com `increment(±1)`, e as rules só
 * conseguiam exigir que ele andasse de um em um — não que andasse JUNTO de uma
 * criança de verdade. Dois devtools bastavam para a fatura sair menor: criar a
 * criança e depois descer o contador "devolvendo a vaga" de uma criança que
 * continuava ativa. Agora o cliente não escreve o campo (as rules recusam), e
 * quem o mantém é o gatilho em `children/{id}`, que RECONTA.
 *
 * ── O QUE CONTA COMO ATIVA
 * `active === true`, exatamente o filtro de `billing.js` (que gera a
 * mensalidade das famílias) e de `watchActiveChildren` (a turma na tela). Um
 * documento sem o campo não gera mensalidade nem aparece na turma — cobrar a
 * plataforma por ele seria cobrar por uma criança que o app não opera.
 */

/** A criança entra na conta da fatura? */
function contaComoAtiva(crianca) {
  return Boolean(crianca) && crianca.active === true;
}

/**
 * Quais motoristas precisam de recontagem depois de uma escrita em
 * `children/{id}`. `antes`/`depois` são os dados (ou `null` na criação e na
 * exclusão).
 *
 * ⚠️ OS DOIS LADOS, porque a criança pode MUDAR de motorista: o de antes perde
 * uma, o de depois ganha. Recontar só o de depois deixaria o primeiro pagando
 * por uma criança que já não é dele.
 *
 * Escrita que não mexe nem em `adminUid` nem em `active` não reconta ninguém:
 * mudar o status da criança na rota acontece dezenas de vezes por dia, e cada
 * uma seria uma consulta de agregação à toa.
 */
function motoristasParaRecontar(antes, depois) {
  const uidAntes = (antes && antes.adminUid) || null;
  const uidDepois = (depois && depois.adminUid) || null;
  const ativaAntes = contaComoAtiva(antes);
  const ativaDepois = contaComoAtiva(depois);

  if (uidAntes === uidDepois && ativaAntes === ativaDepois) return [];

  const uids = [];
  if (uidAntes) uids.push(uidAntes);
  if (uidDepois && uidDepois !== uidAntes) uids.push(uidDepois);
  return uids;
}

/**
 * Grava só o que mudou. Campo ausente é gravado mesmo quando a contagem é 0:
 * as rules deixam o motorista apagar a própria conta só com
 * `criancasAtivas == 0`, e "ausente" ali seria uma pergunta sem resposta.
 */
function precisaGravar(atual, contagem) {
  if (typeof atual !== 'number') return true;
  return atual !== contagem;
}

module.exports = { contaComoAtiva, motoristasParaRecontar, precisaGravar };
