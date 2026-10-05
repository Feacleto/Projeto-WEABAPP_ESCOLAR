import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { watchFaltasDeHoje } from '../services/substitutasService';
import { getDateKey } from '../dominio/rota/horarios.js';
import { linhasDaFaltaDeHoje } from '../dominio/identidade/faltaDaAuxiliar.js';

/**
 * As linhas "Cida faltou hoje" do Início do motorista (05/10/2026). Só a
 * falta de HOJE, numa escuta estreita (`watchFaltasDeHoje`) — a escuta larga
 * de `useSubstitutas` é da Carteira. O dia é o mesmo `getDateKey` com que a
 * Carteira GRAVA a falta: chave calculada de outro jeito aqui seria uma falta
 * gravada que o Início não acha.
 *
 * O dia é recalculado a cada render (o Início já re-renderiza com o relógio
 * dele), então a escuta troca sozinha na virada da meia-noite.
 *
 * ⚠️ Devolve só nomes — a régua não deixa valor sair (ver
 * `linhasDaFaltaDeHoje`). Lista vazia enquanto carrega: linha que aparece
 * um segundo depois é melhor que "Para resolver" piscando.
 */
export function useFaltaDaAuxiliarHoje() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const dateKey = getDateKey();
  const chave = `${uid}|${dateKey}`;
  const [snap, setSnap] = useState({ chave: null, lista: [] });
  useEffect(() => {
    if (!uid) return undefined;
    return watchFaltasDeHoje(uid, dateKey, (lista) => setSnap({ chave, lista }), () => setSnap({ chave, lista: [] }));
  }, [uid, dateKey, chave]);
  return useMemo(
    () => linhasDaFaltaDeHoje(snap.chave === chave ? snap.lista : [], dateKey),
    [snap, chave, dateKey]
  );
}
