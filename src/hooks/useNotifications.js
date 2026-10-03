import { useEffect, useMemo, useRef, useState } from 'react';
import { watchUserNotifications } from '../services/notificationsService';
import { playSound } from '../services/soundService';
import { useConfigDaPlataforma } from './useCobrancaLigada';
import { avisoVisivel } from '../dominio/associacao/modulosDeCobranca';

/**
 * Combina notificações persistidas do Firestore + lembretes derivados dos
 * pagamentos (pré/pós-vencimento). Resolve "lidas" usando:
 *   - readAt do doc, pra eventos
 *   - localStorage, pra lembretes derivados (não tem doc no Firestore)
 *
 * Re-renderiza quando o conjunto de pagamentos muda — assim os lembretes
 * derivados acompanham (ex: pagamento confirmado deixa de gerar lembrete).
 */
/**
 * `aoChegar(aviso)` — chamado para cada aviso NOVO que chega com o app
 * aberto (nunca para os que já estavam lá quando a escuta começou). É por
 * ele que o cabeçalho mostra o cartão do aviso (`avisoNaTela`).
 */
export function useNotifications({ userId, aoChegar = null }) {
  // O retorno mais recente, sem reabrir a escuta a cada render.
  const aoChegarRef = useRef(aoChegar);
  useEffect(() => {
    aoChegarRef.current = aoChegar;
  }, [aoChegar]);
  const [stored, setStored] = useState([]);
  const [loading, setLoading] = useState(true);
  // Bump pra forçar re-cálculo de derivados após "marcar tudo como lido".
  const [readBump, setReadBump] = useState(0);

  // Trackeia ids já vistos pra detectar notif nova → dispara som apropriado.
  // Inicializa com o snapshot atual (não dispara som na 1ª carga).
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
    const unsub = watchUserNotifications(
      userId,
      (list) => {
        // Detecta notifs novas comparando com o snapshot anterior
        if (seenIdsRef.current != null) {
          const previous = seenIdsRef.current;
          const newOnes = list.filter((n) => !previous.has(n.id));
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

  const refreshReads = () => setReadBump((v) => v + 1);

  return { notifications: merged, loading, unreadCount, refreshReads };
}
