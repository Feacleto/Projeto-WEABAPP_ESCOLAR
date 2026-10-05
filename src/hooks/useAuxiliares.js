import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  watchAuxiliaresDoMotorista,
  watchMeuVinculo,
  watchTurmaDaAuxiliar,
  watchFaltasDaAuxiliar,
  watchPagamentosDoMotorista,
  watchMeusPagamentosDeAuxiliar,
} from '../services/auxiliarService';

/**
 * As auxiliares do motorista logado (ativas e as que já saíram). `null`
 * enquanto carrega, lista depois — com a chave junto, para a troca de conta
 * não mostrar a lista da conta anterior.
 */
export function useAuxiliaresDoMotorista() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, lista: null });
  useEffect(() => {
    if (!uid) return undefined;
    return watchAuxiliaresDoMotorista(uid, (lista) => setSnap({ chave: uid, lista }), () => setSnap({ chave: uid, lista: [] }));
  }, [uid]);
  return snap.chave === uid ? snap.lista : null;
}

/**
 * O vínculo da auxiliar logada: `undefined` enquanto carrega, `null` se não há
 * (conta sem vínculo), o vínculo depois.
 */
export function useMeuVinculo() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, vinculo: undefined });
  useEffect(() => {
    if (!uid) return undefined;
    return watchMeuVinculo(uid, (vinculo) => setSnap({ chave: uid, vinculo }), () => setSnap({ chave: uid, vinculo: null }));
  }, [uid]);
  return snap.chave === uid ? snap.vinculo : undefined;
}

/**
 * A turma de hoje da auxiliar logada (fase 2): as crianças da cópia e as
 * faltas do dia, já no formato que `diaCompleto` espera (`byChildId`).
 */
export function useTurmaDaAuxiliar(motoristaUid, dateKey) {
  const [criancas, setCriancas] = useState({ chave: null, lista: null });
  const [faltas, setFaltas] = useState({ chave: null, lista: [] });
  useEffect(() => {
    if (!motoristaUid) return undefined;
    return watchTurmaDaAuxiliar(motoristaUid, (lista) => setCriancas({ chave: motoristaUid, lista }), () => setCriancas({ chave: motoristaUid, lista: [] }));
  }, [motoristaUid]);
  const chaveFaltas = `${motoristaUid}|${dateKey}`;
  useEffect(() => {
    if (!motoristaUid || !dateKey) return undefined;
    return watchFaltasDaAuxiliar(motoristaUid, dateKey, (lista) => setFaltas({ chave: chaveFaltas, lista }), () => setFaltas({ chave: chaveFaltas, lista: [] }));
  }, [motoristaUid, dateKey, chaveFaltas]);
  const lista = criancas.chave === motoristaUid ? criancas.lista : null;
  const doDia = faltas.chave === chaveFaltas ? faltas.lista : [];
  const byChildId = {};
  for (const f of doDia) byChildId[f.childId] = f;
  return { criancas: lista, faltas: byChildId };
}

/**
 * OS RECIBOS DE PAGAMENTO (fase 4). `null` enquanto carrega. Do motorista:
 * os que ele anotou, de todas as auxiliares. Da auxiliar: os dela.
 */
function usePagamentos(assinar) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, lista: null });
  useEffect(() => {
    if (!uid) return undefined;
    return assinar(uid, (lista) => setSnap({ chave: uid, lista }), () => setSnap({ chave: uid, lista: [] }));
  }, [uid, assinar]);
  return snap.chave === uid ? snap.lista : null;
}

export function usePagamentosDoMotorista() {
  return usePagamentos(watchPagamentosDoMotorista);
}

export function useMeusPagamentosDeAuxiliar() {
  return usePagamentos(watchMeusPagamentosDeAuxiliar);
}
