import { useState, useEffect, useCallback } from 'react';
import {
  startTracking,
  stopTracking,
  subscribePosition,
  isTracking,
} from '../services/locationService';
import { ligarRelogioDoTrial } from '../services/trialService';
import {
  avisarSaidaDaRota,
  avisarQuemFicou,
} from '../services/routeStatusService';
import { avisarFimDaRotaParaSubstituta } from '../services/substitutaDeUmDiaService';
import { chaveDeHoje } from '../dominio/rota/rotaDaSubstituta.js';

/**
 * Hook do lado do motorista (Tio): controla o tracking GPS.
 *
 * O watchPosition vive em locationService (nível de módulo) — o hook só
 * espelha o estado em React. Isso permite que o tracking continue rodando
 * quando o Tio navega entre abas do BottomNav (ex: pra atualizar o status
 * de uma criança durante a rota) sem reiniciar GPS.
 *
 * Retorna:
 *   - watching:  bool, se há tracking ativo neste device
 *   - position:  GeolocationPosition mais recente (sem throttle)
 *   - error:     erro do GPS (permissão negada, timeout, etc.)
 *   - stopping:  bool, durante o async stop
 *   - start(driverUid)
 *   - stop()
 */
export function useGeolocation() {
  const [watching, setWatching] = useState(() => isTracking());
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    // O `useState(() => isTracking())` acima JÁ lê o valor no mount, e o
    // mount acontece depois de qualquer outro componente ter iniciado o
    // rastreio. A linha `setWatching(isTracking())` que ficava aqui era
    // redundante e custava um render extra na tela que segura o GPS.
    const unsub = subscribePosition((payload) => {
      if (payload.position) {
        setPosition(payload.position);
        setError(null);
      } else if (payload.error) {
        setError(payload.error);
      } else {
        // payload com ambos null = stopTracking notificando "parou"
        setPosition(null);
      }
    });
    return unsub;
  }, []);

  const start = useCallback((driverUid, opcoes = {}) => {
    setError(null);
    try {
      // `opcoes` leva os ALVOS da rota (criança + onde ela mora) e a escolha
      // de compartilhar a posição. Os dois vivem no módulo do service, e não
      // numa tela, porque a medição tem que continuar enquanto a rota roda —
      // o motorista troca de tela o tempo todo, a perua não para.
      startTracking(driverUid, opcoes);
      setWatching(true);
      // O RELÓGIO DOS TRÊS MESES COMEÇA AQUI, e este é o único gatilho do CLIENTE — os outros dois (primeiro responsável, primeira mensalidade) são do servidor, em `functions/lib/relogioDoTeste.js`.
      //
      // A primeira rota é o momento em que o produto começa a entregar —
      // antes dela não há posição no mapa nem aviso de chegada, e contar do
      // cadastro faria o motorista que conhece o app em dezembro chegar em
      // fevereiro com três semanas de teste.
      //
      // Sem esperar de propósito: a rota NÃO PODE aguardar por isto. O GPS
      // liga no meio-fio, às vezes sem sinal, com vinte famílias esperando a
      // perua — e o relógio do teste é problema da plataforma, não delas. O
      // service engole o próprio erro e a próxima rota tenta de novo; o pior
      // caso é o motorista ganhar um dia a mais.
      ligarRelogioDoTrial(driverUid);

      // AS FAMÍLIAS FICAM SABENDO QUE A PERUA SAIU.
      //
      // É o único instante do dia em que elas precisam DECIDIR algo — descer
      // com a criança ou esperar — e até agora o app estava calado: a perua
      // aparecia no mapa e cabia a elas ficar conferindo.
      //
      // Sem `await`, pelo mesmo motivo do relógio logo acima: a rota não pode
      // esperar por um leque de escritas no meio-fio, às vezes sem sinal. O
      // service engole o próprio erro e tem trava de uma vez por dia — ida e
      // volta são duas rotas, e na volta ela já está em casa.
      avisarSaidaDaRota(driverUid, opcoes.saida);
    } catch (err) {
      setError(err);
    }
  }, []);

  /**
   * RELIGA O GPS DE UMA ROTA QUE JÁ ESTAVA ABERTA (03/10/2026) — o app
   * recarregou no meio do caminho (atualização, falta de memória). Não é
   * começar: não liga o relógio do teste nem avisa "a perua saiu" de novo.
   * Sem isto, o Início seguia mostrando a rota enquanto nada era gravado, e o
   * servidor a encerrava como abandonada.
   */
  const retomar = useCallback((driverUid, opcoes = {}) => {
    setError(null);
    try {
      startTracking(driverUid, { ...opcoes, retomando: true });
      setWatching(true);
    } catch (err) {
      setError(err);
    }
  }, []);

  const stop = useCallback(async (driverUid, pendentes = []) => {
    setStopping(true);
    try {
      await stopTracking();
      setWatching(false);
      setPosition(null);

      /* QUEM NÃO FOI MARCADO FICA SABENDO — e o fim da rota é o único momento
       * em que isso é FATO e não inferência. Marcar fora de ordem é rotina, e
       * dizer "seu filho ficou pra trás" a partir da ordem das marcações
       * assustaria mães à toa; aqui a rota acabou.
       *
       * Quem ficou vem da FILA DA VIAGEM (`quemFicouSemRegistro`), não do
       * relógio. E sem `await` — encerrar a rota não pode esperar por avisos. */
      if (driverUid) {
        avisarQuemFicou({ adminUid: driverUid, pendentes });
      }
      // A SUBSTITUTA DE UM DIA (F3): o servidor confere se esta era a rota
      // do DIA (a ida não mata o link da volta) e, se era, encerra o link
      // dela e avisa. Só pergunta se este aparelho gerou um link hoje.
      avisarFimDaRotaParaSubstituta(chaveDeHoje());
    } catch (err) {
      setError(err);
    } finally {
      setStopping(false);
    }
  }, []);

  return { watching, position, error, stopping, start, stop, retomar };
}
