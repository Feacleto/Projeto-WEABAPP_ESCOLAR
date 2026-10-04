import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { marcarAppInstalado } from '../services/fatosDoNivelService';

/**
 * OS MARCOS QUE SÓ O APARELHO SABE — hoje, um: o app aberto INSTALADO na
 * tela de início (missão do Bronze, docs/niveis.md seção 4).
 *
 * Nenhum servidor consegue ver isso: quem sabe se a janela é `standalone` é
 * o navegador. Grava `users.marcos.appInstalado` uma vez — com o campo já
 * presente no perfil, não escreve nada; e só tenta uma vez por sessão, para
 * uma falha de rede não virar uma escrita por render.
 *
 * Montado no TioLayout: é do MOTORISTA. A família não tem nível.
 */
function abertoInstalado() {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    return window.navigator?.standalone === true; // iOS
  } catch {
    return false;
  }
}

export function useMarcosDoApp() {
  const { user, profile, updateProfile } = useAuth();
  const uid = user?.uid || null;
  const jaTem = !!profile?.marcos?.appInstalado;
  const tentou = useRef(false);

  useEffect(() => {
    if (!uid || !profile || jaTem || tentou.current) return;
    if (!abertoInstalado()) return;
    tentou.current = true;
    marcarAppInstalado(uid)
      .then(() => {
        // O `profile` não é stream (AuthContext lê uma vez): sem isto, a
        // próxima montagem do layout tentaria gravar de novo.
        updateProfile?.({ marcos: { ...(profile.marcos || {}), appInstalado: true } });
      })
      .catch((err) => console.error('[marcos] appInstalado:', err));
  }, [uid, profile, jaTem, updateProfile]);
}
