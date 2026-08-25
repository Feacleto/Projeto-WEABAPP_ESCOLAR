import { useEffect, useState } from 'react';
import { watchAdminProfile } from '../services/userService';

/**
 * Subscribe ao perfil do tio (admin único do app). Pai usa pra ler chave PIX
 * + telefone (deep link do WhatsApp).
 */
export function useAdminProfile(adminUid) {
  // `pronto` em vez de `setLoading(true)` no corpo do efeito: a assinatura é
  // única (sem chave que mude), então basta saber se o primeiro resultado já
  // chegou.
  // O estado carrega a chave: trocar de filho troca de motorista, e mostrar a
  // chave PIX do anterior por um instante é dinheiro na conta errada.
  const [snap, setSnap] = useState({ chave: null, admin: null });

  useEffect(() => {
    if (!adminUid) return undefined;
    return watchAdminProfile(
      adminUid,
      (profile) => setSnap({ chave: adminUid, admin: profile }),
      () => setSnap({ chave: adminUid, admin: null })
    );
  }, [adminUid]);

  const naChave = snap.chave === adminUid;
  return {
    admin: naChave ? snap.admin : null,
    loading: adminUid ? !naChave : false,
  };
}
