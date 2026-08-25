import { useEffect, useState } from 'react';
import { watchAdminProfile } from '../services/userService';

/**
 * Subscribe ao perfil do tio (admin único do app). Pai usa pra ler chave PIX
 * + telefone (deep link do WhatsApp).
 */
export function useAdminProfile() {
  // `pronto` em vez de `setLoading(true)` no corpo do efeito: a assinatura é
  // única (sem chave que mude), então basta saber se o primeiro resultado já
  // chegou.
  const [estado, setEstado] = useState({ pronto: false, admin: null });

  useEffect(() => {
    return watchAdminProfile(
      (profile) => setEstado({ pronto: true, admin: profile }),
      () => setEstado({ pronto: true, admin: null })
    );
  }, []);

  return { admin: estado.admin, loading: !estado.pronto };
}
