import { useEffect, useState } from 'react';
import { lerViagensRecentes } from '../services/ridesService';
import { costumeDaCrianca } from '../dominio/rota/horarioDeCostume.js';

/**
 * O horário de costume da criança: a que horas ela costuma entrar na perua em
 * casa e chegar em casa. Ver `dominio/rota/horarioDeCostume.js`.
 *
 * Falhar aqui não é erro de tela: sem o número, a ficha mostra só o horário
 * combinado, como sempre mostrou.
 */
export function useCostumeDaCrianca(childId) {
  const [estado, setEstado] = useState({ childId: null, costume: null });

  useEffect(() => {
    if (!childId) return undefined;
    let vivo = true;
    lerViagensRecentes(childId)
      .then((viagens) => vivo && setEstado({ childId, costume: costumeDaCrianca(viagens) }))
      .catch((err) => {
        console.error('useCostumeDaCrianca', err);
        if (vivo) setEstado({ childId, costume: null });
      });
    return () => {
      vivo = false;
    };
  }, [childId]);

  return estado.childId === childId ? estado.costume : null;
}
