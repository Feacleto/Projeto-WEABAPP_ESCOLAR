/**
 * O BOTÃO DE CADA PARADA — qual é o próximo passo de uma criança na viagem.
 *
 * Saiu de `services/routeStatusService.js` (03/10/2026), onde ficava atrás de
 * um `import` do Firestore e o Node não a alcançava. É pura e não importa
 * nada.
 *
 * Fluxo por direção do turno:
 *   ida   (pickup):  home → onboard → atSchool
 *   volta (dropoff): atSchool → onboard → delivered
 */
/**
 * Decide qual ação mostrar baseado no status efetivo + direção do turno.
 * Retorna { label, shortLabel, nextStatus, variant } ou null quando não há
 * ação possível naquele turno.
 */
export function getActionForStatus(status, direction) {
  if (direction === 'pickup') {
    if (status === 'home') {
      return {
        label: 'Embarcar',
        shortLabel: 'EMBARQUEI',
        nextStatus: 'onboard',
        variant: 'primary',
      };
    }
    if (status === 'onboard') {
      return {
        label: 'Entregar na escola',
        shortLabel: 'ENTREGUEI NA ESCOLA',
        nextStatus: 'atSchool',
        variant: 'success',
      };
    }
    return null; // atSchool ou delivered: nada a fazer na ida
  }
  // dropoff
  if (status === 'atSchool') {
    return {
      label: 'Embarcar pra casa',
      shortLabel: 'EMBARQUEI',
      nextStatus: 'onboard',
      variant: 'primary',
    };
  }
  if (status === 'onboard') {
    return {
      label: 'Entregar em casa',
      shortLabel: 'ENTREGUEI',
      nextStatus: 'delivered',
      variant: 'success',
    };
  }
  return null;
}

/**
 * O PASSO ANTERIOR — para desfazer um toque errado (03/10/2026).
 *
 * Não existia volta: um EMBARQUEI na criança errada ficava gravado, e a única
 * saída era seguir mentindo até o fim da viagem. `null` quando já é o começo
 * da direção (em casa na ida; na escola na volta).
 */
export function passoAnterior(status, direction) {
  if (direction === 'pickup') {
    if (status === 'onboard') return 'home';
    if (status === 'atSchool') return 'onboard';
    return null;
  }
  if (status === 'onboard') return 'atSchool';
  if (status === 'delivered') return 'onboard';
  return null;
}

/**
 * A TRAVA DO BOTÃO DA PARADA DEPOIS DE UMA MARCAÇÃO (04/10/2026, pedido do
 * dono). O EMBARQUEI virava, no mesmo lugar e no mesmo instante, o botão da
 * PRÓXIMA criança — e o segundo toque de um polegar apressado (ou o toque
 * duplo de uma tela suja) marcava quem ainda estava na calçada.
 *
 * Por `TRAVA_DA_PARADA_MS` o botão não age: ele diz "Ana ✓ · Desfazer" no
 * lugar dele. É ESTADO, não animação — nada se mexe, o rótulo só troca.
 *
 * `marcadoEm` e `agora` em milissegundos. Sem marcação, ou com relógio
 * andando para trás (marcação "no futuro"), não trava: travar o botão da
 * rota por um relógio errado é pior que um toque duplo.
 */
export const TRAVA_DA_PARADA_MS = 1200;

export function barraTravada(marcadoEm, agora) {
  if (!Number.isFinite(marcadoEm) || !Number.isFinite(agora)) return false;
  const passou = agora - marcadoEm;
  return passou >= 0 && passou < TRAVA_DA_PARADA_MS;
}
