import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { watchUserNotifications } from '../services/notificationsService';
import { playSound } from '../services/soundService';
import { useConfigDaPlataforma } from './useCobrancaLigada';
import { avisoVisivel } from '../dominio/associacao/modulosDeCobranca';
import { avisosQueChegaram } from '../dominio/identidade/caixaDeAvisos.js';
import { NotificacoesContext } from '../context/notificacoesContextObject';

/**
 * A ESCUTA DO SINO — chamada UMA vez por sessão, pelo `NotificacoesProvider`
 * (context/NotificacoesContext.jsx). Quem precisa da lista lê
 * `useNotificacoesDaSessao()`, nunca isto.
 *
 * ⚠️ ELA MORAVA NO `Header` (até 03/10/2026), e cada tela monta o seu: toda
 * navegação derrubava a escuta e a próxima tela relia as 100 mais recentes do
 * zero — a maior fonte de leitura do app. A folha e a página do sino ainda
 * abriam uma SEGUNDA escuta por cima da do cabeçalho.
 *
 * `aoChegar(aviso)` — chamado para cada aviso NOVO que chega com o app
 * aberto (nunca para os que já estavam lá quando a escuta começou). É por
 * ele que o app mostra o cartão do aviso (`avisoNaTela`).
 */
export function useNotifications({ userId, aoChegar = null }) {
  // O retorno mais recente, sem reabrir a escuta a cada render.
  const aoChegarRef = useRef(aoChegar);
  useEffect(() => {
    aoChegarRef.current = aoChegar;
  }, [aoChegar]);
  const [stored, setStored] = useState([]);
  const [loading, setLoading] = useState(true);
  // Bump pra forçar re-cálculo após "marcar tudo como lido".
  const [readBump, setReadBump] = useState(0);

  // Ids da lista anterior, pra detectar aviso novo → cartão e som.
  // Nulo até a 1ª carga: nada da primeira lista é novo, tudo é histórico.
  const seenIdsRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStored([]);
      setLoading(false);
      seenIdsRef.current = null;
      return;
    }
    setLoading(true);
    seenIdsRef.current = null;
    // Quando a escuta começou — o piso de "aviso novo" (ver `avisosQueChegaram`).
    const inicio = Date.now();
    const unsub = watchUserNotifications(
      userId,
      (list) => {
        // Novo = não estava na lista anterior E nasceu depois de a escuta
        // começar. Só o id não basta: a lista é uma janela das 100 mais
        // recentes, e quando uma sai (a limpeza dos 90 dias, ou a pessoa
        // apagando), uma mais VELHA entra por baixo — e ganharia cartão e som.
        const newOnes = avisosQueChegaram(list, seenIdsRef.current, inicio);
        if (newOnes.length > 0) {
          // Toca som apropriado por tipo. payment_confirmed → pay,
          // payment_claimed → cash_in. Outros → notify genérico.
          const first = newOnes[0];
          newOnes.forEach((n) => aoChegarRef.current?.(n));
          // A perua chegando soa como perua; a buzina já toca a dela, em
          // tela cheia — um segundo som por cima só atrapalha.
          if (first.type === 'buzina') {
            /* o toque é do IncomingCallModal */
          } else if (first.type === 'perua_chegando') {
            playSound('horn_short');
          } else if (first.type === 'perua_chegou') {
            playSound('horn_long');
          } else if (first.type === 'payment_confirmed') {
            playSound('pay');
          } else if (first.type === 'payment_claimed') {
            playSound('cash_in');
          } else {
            playSound('notify');
          }
        }
        seenIdsRef.current = new Set(list.map((n) => n.id));

        setStored(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId]);

  /* ⚠️ OS LEMBRETES DE MENSALIDADE DEIXARAM DE SER DERIVADOS AQUI.
   *
   * Eles eram calculados na hora, a partir de `payments`, e nunca viravam
   * documento — existiam só pra desenhar esta lista. Sem documento não há
   * push, e um lembrete que só aparece pra quem abre o app é exatamente o que
   * um lembrete existe pra evitar.
   *
   * Agora quem os escreve é a varredura diária (`enviarAvisosDoDia`), com os
   * MESMOS nomes de tipo — o desenho do sino não mudou. E a derivação teve que
   * sair junto: esta lista concatenava os derivados com os gravados, então as
   * duas de pé mostrariam cada lembrete DUAS VEZES.
   *
   * Foi embora com ela a leitura por `localStorage`, que existia só porque
   * lembrete derivado não tinha doc onde gravar `readAt`. Agora tem. */
  // ⚠️ AVISO DE COBRANÇA SÓ APARECE COM O MÓDULO DELE LIGADO (02/10/2026).
  // "Seu teste começou" e "sua fatura vence" recebidos antes da pausa não
  // continuam no sino durante ela — nem no contador de não lidas. Nada é
  // apagado: ligou o módulo, voltam. Ver `dominio/associacao/modulosDeCobranca.js`.
  const config = useConfigDaPlataforma();

  const merged = useMemo(() => {
    const all = stored
      .filter((n) => avisoVisivel(config, n.type))
      .map((n) => ({ ...n, isRead: !!n.readAt }));
    all.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    return all;
    // readBump força recomputo após marcar tudo como lido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, readBump, config]);

  const unreadCount = useMemo(
    () => merged.filter((n) => !n.isRead).length,
    [merged]
  );

  const refreshReads = useCallback(() => setReadBump((v) => v + 1), []);

  // Memorizado: este objeto é o valor do contexto, e um objeto novo a cada
  // render faria todo consumidor (cabeçalho, folha, página) renderizar junto.
  return useMemo(
    () => ({ notifications: merged, loading, unreadCount, refreshReads }),
    [merged, loading, unreadCount, refreshReads]
  );
}

const SEM_SESSAO = Object.freeze({
  notifications: [],
  loading: false,
  unreadCount: 0,
  refreshReads: () => {},
});

/**
 * A LISTA DO SINO, lida da escuta única da sessão.
 *
 * Fora de um `NotificacoesProvider` devolve a caixa vazia em vez de abrir uma
 * escuta própria: abrir aqui seria o vazamento de volta, uma escuta por
 * cabeçalho. Todo `Header` com sino mora dentro do `TioLayout` ou do
 * `PaiLayout`, e `npm run testar:notificacoes` confere que os dois montam o
 * provider.
 */
export function useNotificacoesDaSessao() {
  return useContext(NotificacoesContext) || SEM_SESSAO;
}
