/**
 * O QUE FAZER COM UMA COORDENADA QUE FICOU GRAVADA — a régua, e só ela.
 *
 * ── O QUE ESTÁ SENDO LIMPO
 * `checkpointFrom` (no cliente) gravava `lat` e `lng` do VEÍCULO do motorista
 * em dois lugares, um registro por criança por dia:
 *
 *   children/{id}.lastStatusCheckpoint      { lat, lng, at, distanceKm? }
 *   children/{id}/rides/{dia}.checkpoints   { delivered: {...}, atSchool: {...} }
 *
 * Nenhuma tela lia os dois campos. O que a conferência usa é a DISTÂNCIA até
 * a casa ou a escola, que responde *"ele estava longe quando marcou
 * entregue?"* sem dizer onde ele estava. O código parou de escrever em
 * 10/09/2026; o que já foi gravado é o que estas funções decidem.
 *
 * ── POR QUE ISTO É ARQUIVO SEPARADO, E SEM `require` NENHUM
 * Duas peças precisam da mesma decisão: a callable do dono
 * (`limpezaDoCheckpoint.js`) e o script de manutenção
 * (`scripts/limpar-coordenada-do-checkpoint.cjs`). Copiar a regra nos dois
 * seria o quarto espelho do projeto, e por um motivo pobre — aqui não há
 * fronteira de deploy nenhuma entre os dois, é a mesma máquina lendo o mesmo
 * disco. Então não há espelho: há um arquivo, e dois consumidores.
 *
 * Ele segue a regra da pasta: **módulo de `functions/lib/` que é RÉGUA não
 * requer `firebase-admin` nem `firebase-functions`** — quem toca no banco é
 * quem consome.
 */

/** O que fazer com UM checkpoint. */
const NADA = 'nada';
const TIRAR_COORDENADA = 'tirar-coordenada';
const APAGAR_INTEIRO = 'apagar-inteiro';

/**
 * @returns 'nada' | 'tirar-coordenada' | 'apagar-inteiro'
 *
 * ⚠️ AS DUAS REGRAS, E A SEGUNDA NÃO É ÓBVIA:
 *
 *   com `distanceKm`  → sai só a coordenada. A distância é a conferência.
 *   sem `distanceKm`  → sai o checkpoint inteiro. Ele nasceu quando não havia
 *                       destino esperado (`onboard`), então não carrega nada
 *                       além da posição: tirar `lat`/`lng` deixaria `{ at }`
 *                       sozinho, um objeto que não responde pergunta nenhuma
 *                       e que a próxima pessoa teria que decifrar. Em `rides`
 *                       a hora já está em `marcos[status]` — o `at` órfão
 *                       seria a segunda cópia dela.
 *
 * ⚠️ `distanceKm: 0` É DISTÂNCIA VÁLIDA — ele marcou entregue na porta, que é
 * o caso mais comum de todos. Um `if (!cp.distanceKm)` apagaria justamente o
 * checkpoint do caso perfeito.
 */
function decidir(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return NADA;
  const temCoordenada =
    checkpoint.lat !== undefined || checkpoint.lng !== undefined;
  if (!temCoordenada) return NADA;
  return checkpoint.distanceKm === undefined ? APAGAR_INTEIRO : TIRAR_COORDENADA;
}

/**
 * O plano para o mapa `checkpoints` de UMA viagem — um checkpoint por status.
 *
 * Devolve os CAMINHOS a apagar (`checkpoints.delivered.lat`), não valores: é
 * o consumidor que troca cada caminho pelo `FieldValue.delete()` dele. Assim
 * esta régua continua sem conhecer o SDK.
 *
 * ⚠️ `apagarMapa` existe porque mapa que fica VAZIO é o mesmo enigma do
 * `{ at }` solto, um nível acima — some inteiro em vez de virar `{}`.
 *
 * @returns { mexeu, apagarMapa, caminhos: string[], tiradas, inteiros }
 */
function planoDaViagem(mapa) {
  const vazio = { mexeu: false, apagarMapa: false, caminhos: [], tiradas: 0, inteiros: 0 };
  if (!mapa || typeof mapa !== 'object') return vazio;

  const caminhos = [];
  let tiradas = 0;
  let inteiros = 0;
  let sobrevive = 0;

  for (const status of Object.keys(mapa)) {
    const decisao = decidir(mapa[status]);
    if (decisao === NADA) {
      sobrevive += 1;
    } else if (decisao === APAGAR_INTEIRO) {
      inteiros += 1;
      caminhos.push(`checkpoints.${status}`);
    } else {
      tiradas += 1;
      sobrevive += 1;
      caminhos.push(`checkpoints.${status}.lat`);
      caminhos.push(`checkpoints.${status}.lng`);
    }
  }

  if (!caminhos.length) return vazio;
  return {
    mexeu: true,
    apagarMapa: sobrevive === 0,
    caminhos,
    tiradas,
    inteiros,
  };
}

module.exports = {
  NADA,
  TIRAR_COORDENADA,
  APAGAR_INTEIRO,
  decidir,
  planoDaViagem,
};
