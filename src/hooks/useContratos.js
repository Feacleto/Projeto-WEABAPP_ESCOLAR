import { useEffect, useState } from 'react';
import { watchContratos, watchVersoesDaFamilia } from '../services/contratosDaFamiliaService';

/**
 * As versões do contrato de uma criança, da mais nova para a mais antiga, e
 * as duas que importam: a que VALE (aceita) e a que ESPERA aceite.
 *
 * Mesmo desenho de `useChild`: o estado carrega a chave, para a troca de
 * criança não mostrar por um quadro as versões da anterior.
 *
 * `daFamilia`: quem lê é a responsável — só as duas versões apontadas pela
 * criança, por número (ver `watchVersoesDaFamilia`).
 */
export function useContratos(child, { daFamilia = false } = {}) {
  const childId = child?.id || null;
  const vigenteN = child?.contratoVigente?.numero ?? null;
  const aguardandoN = child?.contratoAguardando ?? null;
  const chave = daFamilia ? `${childId}:${vigenteN}:${aguardandoN}` : childId;
  const [snap, setSnap] = useState({ chave: null, contratos: null });

  useEffect(() => {
    if (!childId) return undefined;
    const receber = (contratos) => setSnap({ chave, contratos });
    if (daFamilia) return watchVersoesDaFamilia(childId, [vigenteN, aguardandoN], receber);
    return watchContratos(childId, receber, () => setSnap({ chave, contratos: [] }));
  }, [childId, daFamilia, chave, vigenteN, aguardandoN]);

  const contratos = snap.chave === chave ? snap.contratos : null;
  const vigente =
    contratos?.find((c) => c.numero === child?.contratoVigente?.numero) || null;
  const aguardando =
    contratos?.find(
      (c) => c.numero === child?.contratoAguardando && c.status === 'aguardando'
    ) || null;
  return { contratos, vigente, aguardando, loading: !!childId && contratos === null };
}
