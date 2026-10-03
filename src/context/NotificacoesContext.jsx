import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { usePushDoAparelho } from '../hooks/usePushDoAparelho';
import { avisoNaTela } from '../components/notifications/avisoNaTela';
import { NotificacoesContext } from './notificacoesContextObject';

/**
 * A ESCUTA ÚNICA DO SINO, uma por sessão (03/10/2026).
 *
 * ⚠️ POR QUE ELA SAIU DO CABEÇALHO. O `Header` é renderizado por CADA tela,
 * não pelo layout — então a escuta de `notifications` (as 100 mais recentes)
 * era desmontada e reaberta a cada navegação, e a tela seguinte pagava as
 * leituras de novo. Era a maior fonte de leitura do app, e crescia com o
 * hábito de navegar, não com o número de avisos. A folha e a página do sino
 * abriam ainda uma segunda escuta por cima.
 *
 * Aqui ela abre uma vez, montada no `TioLayout` e no `PaiLayout` — que ficam
 * de pé enquanto a pessoa anda pelas telas do próprio painel —, e o cabeçalho,
 * a folha e a página só LEEM (`useNotificacoesDaSessao`).
 *
 * Tudo o que o cabeçalho fazia com a escuta veio junto:
 *   - o cartão do aviso novo (`avisoNaTela(aviso, …)`) — só para o que chega
 *     DEPOIS de a escuta começar; ao montar, nada do histórico vira cartão;
 *   - o som por tipo (dentro de `useNotifications`);
 *   - o aparelho e o push (`usePushDoAparelho`): token regravado e toque no
 *     aviso com o app em segundo plano.
 *
 * Fica DENTRO do router (os layouts são rotas), e é isso que deixa o toque no
 * cartão navegar.
 */
export function NotificacoesProvider({ children }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const papel = profile?.role;
  usePushDoAparelho(user?.uid, profile?.fcmTokens);

  // O aviso que chega com o app aberto vira um cartão no topo, que leva ao
  // mesmo lugar do push.
  const aoChegar = useCallback(
    (aviso) => avisoNaTela(aviso, { papel, abrir: navigate }),
    [papel, navigate]
  );
  const caixa = useNotifications({ userId: user?.uid, aoChegar });

  return (
    <NotificacoesContext.Provider value={caixa}>
      {children}
    </NotificacoesContext.Provider>
  );
}
