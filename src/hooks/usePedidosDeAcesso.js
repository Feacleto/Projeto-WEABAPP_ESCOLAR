import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  watchPedidosDoMotorista,
  watchPedidosDoResponsavel,
} from '../services/pedidosDeAcessoService';

/**
 * Os pedidos de acesso sem link, ao vivo — do lado de quem pediu
 * (`responsavel`) ou do motorista que aprova (`motorista`).
 *
 * Devolve `{ pedidos, carregando }`. O estado carrega a chave, como
 * `useChild`: trocar de uid não mostra um quadro com os pedidos do anterior.
 */
export function usePedidosDeAcesso(lado) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, pedidos: [] });

  useEffect(() => {
    if (!uid) return undefined;
    const watch = lado === 'motorista' ? watchPedidosDoMotorista : watchPedidosDoResponsavel;
    return watch(uid, (pedidos) => setSnap({ chave: uid, pedidos }));
  }, [uid, lado]);

  const naChave = snap.chave === uid;
  return { pedidos: naChave ? snap.pedidos : [], carregando: uid ? !naChave : false };
}
