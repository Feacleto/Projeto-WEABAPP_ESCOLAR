import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useChildren } from './useChildren';
import { useEscolas } from './useEscolas';
import { useAbsences } from './useAbsences';
import { useLiveLocation } from './useLiveLocation';
import {
  getDateKey,
  diaCompleto,
  blocoDoMomento,
  precisaDaPerua,
} from '../dominio/rota/horarios';
import { quemFicouSemRegistro } from '../dominio/rota/focoDaViagem.js';
import { statusNaDirecao, getActionForStatus } from '../services/routeStatusService';
import { publicarOrdemDoDia } from '../services/ridesService';

/**
 * A VIAGEM DO DIA — o que "Minha rota" (`/tio/rota`) precisa para mostrar a
 * rota padrão e iniciar a rota (04/10/2026).
 *
 * É a mesma conta que o Início fazia: os blocos do dia (`diaCompleto`), a
 * viagem do momento (`blocoDoMomento`), quem ainda depende da perua, as casas
 * que o celular mede para o "está chegando" e a ordem do dia que o
 * responsável lê. ⚠️ O Início ainda tem a sua cópia; quando ele passar a usar
 * este hook, a cópia sai.
 */
export function useViagemDoDia() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { children, loading } = useChildren();
  const { mapa: escolasPorId, escolas } = useEscolas();
  const todayKey = getDateKey();
  const { byChildId: declaracoes } = useAbsences(todayKey);
  const { location: minhaPosicao } = useLiveLocation(uid);
  const rotaAtiva = !!minhaPosicao?.routeActive;

  // O relógio anda: sem isto a viagem do momento ficaria presa na da manhã.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const blocos = useMemo(
    () => diaCompleto(children, { declaracoes, escolasPorId }),
    [children, declaracoes, escolasPorId]
  );

  const paradasPendentes = useCallback(
    (b) => {
      if (!b) return [];
      const dir = b.direcao === 'ida' ? 'pickup' : 'dropoff';
      return b.paradas.filter((p) => {
        if (!precisaDaPerua(p.estado)) return false;
        const st = statusNaDirecao(p.child, declaracoes?.[p.child.id], dir);
        return !!getActionForStatus(st, dir);
      });
    },
    [declaracoes]
  );
  const temPendencia = useCallback((b) => paradasPendentes(b).length > 0, [paradasPendentes]);

  const bloco = useMemo(
    () => blocoDoMomento(blocos, new Date(), temPendencia),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocos, tick, temPendencia]
  );

  const pendentes = useMemo(() => paradasPendentes(bloco), [bloco, paradasPendentes]);

  const pendentesDaViagem = useMemo(() => {
    const dir = bloco?.direcao === 'ida' ? 'pickup' : 'dropoff';
    return quemFicouSemRegistro(
      pendentes.map((p) => {
        const st = statusNaDirecao(p.child, declaracoes?.[p.child.id], dir);
        return { child: p.child, status: st, hora: p.hora, action: getActionForStatus(st, dir) };
      })
    );
  }, [bloco, pendentes, declaracoes]);

  // Só a viagem de agora, e só quem depende da perua (ver o Início).
  const alvosDaRota = useMemo(
    () =>
      (bloco?.paradas || [])
        .filter((p) => precisaDaPerua(p.estado))
        .map((p) => ({
          childId: p.child?.id,
          lat: Number(p.child?.lat),
          lng: Number(p.child?.lng),
          parentUid: p.child?.parentUid || null,
        }))
        .filter((a) => a.childId && Number.isFinite(a.lat) && Number.isFinite(a.lng)),
    [bloco]
  );

  const publicarOrdem = useCallback(async () => {
    try {
      const contexto = {};
      for (const b of blocos) {
        for (const p of b.paradas) contexto[p.child.id] = { adminUid: uid };
      }
      await publicarOrdemDoDia(blocos, todayKey, contexto);
    } catch (err) {
      // Não trava a saída: posição na fila é conforto do responsável.
      console.error('Falha ao publicar a ordem do dia:', err);
    }
  }, [blocos, todayKey, uid]);

  return {
    carregando: loading,
    children,
    escolas,
    blocos,
    bloco,
    pendentes,
    pendentesDaViagem,
    alvosDaRota,
    publicarOrdem,
    rotaAtiva,
    temViagem: !!bloco && pendentes.length > 0,
  };
}
