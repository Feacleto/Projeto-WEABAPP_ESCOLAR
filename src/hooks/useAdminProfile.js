import { useEffect, useState } from 'react';
import { watchAdminProfile } from '../services/userService';

/**
 * Subscribe ao perfil do tio (admin único do app). Pai usa pra ler chave PIX
 * + telefone (deep link do WhatsApp).
 */
export function useAdminProfile() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = watchAdminProfile(
      (profile) => {
        setAdmin(profile);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return { admin, loading };
}
