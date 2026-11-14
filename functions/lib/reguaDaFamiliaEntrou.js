/**
 * "A FAMÍLIA DE X ENTROU" — o aviso ao motorista quando o convite é usado
 * (14/11/2026, RC2; docs/analise/13b, momento 7). Régua PURA: sem `require`.
 *
 * ── O BURACO QUE ISTO FECHA
 * A mãe entrar é o maior momento de valor do convite — é a partir dele que a
 * mensalidade dela pode nascer e que ela recebe os avisos da perua —, e era
 * SILENCIOSO: `redeemInvite` gravava `inviteUsedAt` e não escrevia aviso
 * nenhum. O tio só descobria abrindo a ficha da criança.
 *
 * ── ESPÉCIE `fato`, NÃO SE DESLIGA
 * É um fato sobre a turma dele, não um empurrão de hábito: a decisão 31 veta
 * push de LOOP no teste, não de fato. Ver `avisos.js`.
 *
 * ── UMA VEZ POR CRIANÇA
 * O id do documento é determinístico (`familia_entrou_{childId}`) e quem
 * escreve usa `create()`: uma reentrega da callable, ou dois resgates que
 * passassem pela transação, não produzem dois avisos. Consequência aceita: se
 * a família for desvinculada e entrar de novo pelo link, o segundo aviso só
 * sai depois que a limpeza dos 90 dias apagar o primeiro.
 *
 * ── SÓ O LINK
 * O vínculo automático de irmão (`vincularIrmao.js`) grava `vinculadoPor:
 * 'irmao'` e já tem o aviso dele (`irmao_vinculado`, para a família). Ele não
 * passa por `redeemInvite`, mas a régua recusa do mesmo jeito: se um dia os
 * dois caminhos se cruzarem, o motorista não recebe "entrou" de uma família
 * que não fez nada.
 *
 * ── O TEXTO
 * Espelho de `src/marca/valorDosAvisos.js` (`FAMILIA_ENTROU`), onde cada frase
 * carrega `sustenta` e `condicao`. `npm run testar:valor-dos-avisos` compara
 * os dois. A mensalidade só nasce com VALOR cadastrado (`billing.js` pula
 * `monthlyFee <= 0`), então o corpo escolhe a frase pelo valor: com valor,
 * "passa a aparecer" (sem dizer quando, porque a geração é às 6h ou no "Gerar
 * agora"); sem valor, o que ele precisa fazer para ela aparecer.
 */

'use strict';

const TIPO = 'familia_entrou';

const FORMATO_DO_ID = /^[A-Za-z0-9_-]{1,128}$/;

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

/** O id do aviso, ou null quando o id da criança não serve de caminho. */
function idDoAvisoDaFamiliaEntrou(childId) {
  if (typeof childId !== 'string' || !FORMATO_DO_ID.test(childId)) return null;
  return `${TIPO}_${childId}`;
}

function tituloDaFamiliaEntrou(nomeDaCrianca) {
  const nome = primeiroNome(nomeDaCrianca);
  return nome ? `A família de ${nome} entrou` : 'Uma família entrou';
}

function corpoDaFamiliaEntrou(temValor) {
  return temValor
    ? 'A mensalidade dela passa a aparecer na Carteira.'
    : 'Cadastre o valor da mensalidade para ela aparecer na Carteira.';
}

/**
 * O documento do aviso (sem `read` nem `createdAt`, que são de quem grava), ou
 * null quando não há a quem avisar.
 *
 *   crianca — os dados da criança como estavam no resgate
 *   childId — o id do documento da criança
 */
function avisoDaFamiliaEntrou(crianca, childId) {
  if (!crianca || typeof crianca !== 'object') return null;
  if (crianca.vinculadoPor === 'irmao') return null;
  const motorista = crianca.adminUid;
  if (typeof motorista !== 'string' || !FORMATO_DO_ID.test(motorista)) return null;
  if (!idDoAvisoDaFamiliaEntrou(childId)) return null;
  const temValor = (Number(crianca.monthlyFee) || 0) > 0;
  return {
    userId: motorista,
    type: 'familia_entrou',
    childId,
    title: tituloDaFamiliaEntrou(crianca.name),
    body: corpoDaFamiliaEntrou(temValor),
  };
}

module.exports = {
  TIPO,
  idDoAvisoDaFamiliaEntrou,
  tituloDaFamiliaEntrou,
  corpoDaFamiliaEntrou,
  avisoDaFamiliaEntrou,
};
