/**
 * O PRAZO DO RECADO DO DIA, no servidor (05/10/2026, decisão do dono).
 *
 * `recadosDoDia/{AAAA-MM-DD}_{childId}` é o recado curto da família para o
 * tio sobre AQUELE dia (ver `src/dominio/rota/recadoDoDia.js`). Ele serve no
 * dia; uma semana depois, é texto livre de uma família parado num lugar que
 * ninguém lê. `apagarViagensAntigas` apaga os de mais de 7 dias.
 *
 * O número é o mesmo de `DIAS_DO_RECADO` no app — o deploy das functions
 * não alcança `src/`, e `testar:rota-ao-vivo` compara os dois.
 *
 * Régua sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 */

const DIAS_DO_RECADO = 7;

/** O dia de corte ('AAAA-MM-DD'): recados com `dateKey` antes dele são apagados. */
function corteDoRecado(agora = new Date()) {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - DIAS_DO_RECADO);
  return limite.toISOString().slice(0, 10);
}

module.exports = { DIAS_DO_RECADO, corteDoRecado };
