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
