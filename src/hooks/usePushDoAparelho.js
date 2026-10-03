import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ouvirToqueNoAviso, sincronizarPush } from '../services/pushService';

/**
 * O APARELHO E OS AVISOS, uma vez por sessão (03/10/2026):
 *   - confere se o token do push mudou e regrava (`sincronizarPush`) — o
 *     navegador renova o token sozinho, e o velho não recebe nada;
 *   - ouve o toque no aviso quando o app já está aberto em segundo plano
 *     (`ouvirToqueNoAviso`): o worker manda o caminho, o app navega.
 */
const sincronizados = new Set();

export function usePushDoAparelho(uid, tokensGravados) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid || sincronizados.has(uid)) return;
    sincronizados.add(uid);
    sincronizarPush(uid, tokensGravados);
  }, [uid, tokensGravados]);

  useEffect(() => ouvirToqueNoAviso((caminho) => navigate(caminho)), [navigate]);
}
