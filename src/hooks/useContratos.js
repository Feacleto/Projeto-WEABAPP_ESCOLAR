import { useEffect, useState } from 'react';
import { watchContratos } from '../services/contratosDaFamiliaService';

/**
 * As versões do contrato de uma criança, da mais nova para a mais antiga, e
 * as duas que importam: a que VALE (aceita) e a que ESPERA aceite.
 *
 * Mesmo desenho de `useChild`: o estado carrega a chave, para a troca de
 * criança não mostrar por um quadro as versões da anterior.
 */
export function useContratos(child) {
  const childId = child?.id || null;
  const [snap, setSnap] = useState({ chave: null, contratos: null });

  useEffect(() => {
    if (!childId) return undefined;
    return watchContratos(
      childId,
      (contratos) => setSnap({ chave: childId, contratos }),
      () => setSnap({ chave: childId, contratos: [] })
    );
  }, [childId]);

  const contratos = snap.chave === childId ? snap.contratos : null;
  const vigente =
    contratos?.find((c) => c.numero === child?.contratoVigente?.numero) || null;
  const aguardando =
    contratos?.find(
      (c) => c.numero === child?.contratoAguardando && c.status === 'aguardando'
    ) || null;
  return { contratos, vigente, aguardando, loading: !!childId && contratos === null };
}
