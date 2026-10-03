import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { registrarVisita } from '../services/analyticsService';

/**
 * Conta a tela a cada troca de rota — só o CAMINHO, e o service tira o
 * segredo dele antes de sair (ver `analyticsService`). Query e âncora nem
 * chegam lá: o `oobCode` do link de senha mora na query.
 */
export function useRegistroDeVisita() {
  const { pathname } = useLocation();
  useEffect(() => {
    registrarVisita(pathname);
  }, [pathname]);
}
