import { useEffect, useState } from 'react';
import { watchRide } from '../services/ridesService';

/**
 * A viagem de hoje de uma criança — horas de cada marco e posição na fila.
 *
 * Existe porque o responsável não consegue derivar nenhuma das duas coisas:
 * a hora real de cada etapa só o motorista registra, e a posição na fila é
 * feita das outras crianças, que ele não lê (nem deve).
 *
 * O ESTADO GUARDA DE QUEM E DE QUANDO ELE É, e não só o conteúdo.
 *
 * A versão anterior mantinha `ride` até o snapshot novo chegar, com
 * `loading: false`. Numa família com dois filhos, trocar da Ana pro Bruno
 * mostrava — por um instante e com toda a confiança do mundo — a posição na
 * fila e as horas da Ana debaixo do nome do Bruno. Na virada da meia-noite
 * acontecia o mesmo com o dia de ontem.
 *
 * Comparar a chave na hora de ler fecha essa janela sem `setState` dentro do
 * efeito (que é o que a regra `set-state-in-effect` proíbe, e com razão: é um
 * render a mais e um quadro em que a tela já sabe da troca e ainda mostra o
 * dado velho).
 */
export function useRide(childId, dateKey) {
  const chave = childId && dateKey ? `${childId}|${dateKey}` : null;
  const [snap, setSnap] = useState({ chave: null, ride: null });

  useEffect(() => {
    if (!chave) return undefined;
    return watchRide(
      childId,
      dateKey,
      (doc) => setSnap({ chave, ride: doc }),
      () => setSnap({ chave, ride: null })
    );
  }, [chave, childId, dateKey]);

  const naChave = snap.chave === chave;
  return {
    ride: naChave ? snap.ride : null,
    // Sem criança ou sem data não há o que carregar: `loading: true` pra
    // sempre deixaria a tela do pai num esqueleto eterno.
    loading: chave ? !naChave : false,
  };
}
