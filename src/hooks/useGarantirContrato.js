import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { garantirContrato } from '../services/contratosDaFamiliaService';
import { dadosDaContratadaFaltando } from '../services/contractService';

/**
 * O PRIMEIRO CONTRATO SE EMITE SOZINHO, NO LADO DO MOTORISTA (02/10/2026).
 *
 * Roda nas telas dele que mostram a criança (ficha, convite, contrato): se
 * ainda não há contrato aceito e os dados dele estão completos, garante que a
 * versão esperando aceite existe e diz o que os campos dizem hoje. Nada é
 * escrito quando já está em dia (`garantirContrato` é idempotente).
 *
 * Só o motorista dono da criança roda isto — a família lê, nunca emite.
 */
export function useGarantirContrato(child, contratos) {
  const { user, profile, role } = useAuth();
  const emCurso = useRef(false);
  const podeEmitir =
    role === 'admin' &&
    child?.adminUid === user?.uid &&
    child?.active !== false &&
    dadosDaContratadaFaltando(profile).length === 0;

  useEffect(() => {
    if (!podeEmitir || !contratos || emCurso.current) return;
    emCurso.current = true;
    garantirContrato({ child, admin: profile, contratos })
      .catch((err) => console.error('garantirContrato', err))
      .finally(() => {
        emCurso.current = false;
      });
  }, [podeEmitir, child, profile, contratos]);
}
