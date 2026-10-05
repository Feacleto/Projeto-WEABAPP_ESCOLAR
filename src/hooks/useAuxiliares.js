import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  watchAuxiliaresDoMotorista,
  watchMeusVinculos,
  watchTurmaDaAuxiliar,
  watchFaltasDaAuxiliar,
  watchQuemBuscaDaAuxiliar,
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
 * Os vínculos da auxiliar logada, um por tio: `undefined` enquanto carrega,
 * a lista depois (vazia = conta sem vínculo). `ativos` são os tios de agora,
 * do primeiro aceite para o último — a ordem dos botões da troca de perua.
 */
export function useMeusVinculos() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, lista: undefined });
  useEffect(() => {
    if (!uid) return undefined;
    return watchMeusVinculos(uid, (lista) => setSnap({ chave: uid, lista }), () => setSnap({ chave: uid, lista: [] }));
  }, [uid]);
  const lista = snap.chave === uid ? snap.lista : undefined;
  const ativos = useMemo(
    () => (lista || [])
      .filter((v) => v.ativa === true)
      .sort((a, b) => (a.aceitoEm?.toMillis?.() || 0) - (b.aceitoEm?.toMillis?.() || 0)),
    [lista]
  );
  return { vinculos: lista, ativos };
}

/**
 * A turma de hoje da auxiliar logada (fase 2): as crianças da cópia e as
 * faltas do dia, já no formato que `diaCompleto` espera (`byChildId`).
 * `buscas` (05/10/2026): `{ [childId]: nome }` de quem busca hoje — só o
 * nome, que é tudo o que a cópia leva.
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
  const [buscasDoDia, setBuscasDoDia] = useState({ chave: null, lista: [] });
  useEffect(() => {
    if (!motoristaUid || !dateKey) return undefined;
    return watchQuemBuscaDaAuxiliar(motoristaUid, dateKey, (lista) => setBuscasDoDia({ chave: chaveFaltas, lista }), () => setBuscasDoDia({ chave: chaveFaltas, lista: [] }));
  }, [motoristaUid, dateKey, chaveFaltas]);
  const lista = criancas.chave === motoristaUid ? criancas.lista : null;
  const doDia = faltas.chave === chaveFaltas ? faltas.lista : [];
  const byChildId = {};
  for (const f of doDia) byChildId[f.childId] = f;
  const buscas = {};
  for (const b of buscasDoDia.chave === chaveFaltas ? buscasDoDia.lista : []) {
    if (b.childId && b.nome) buscas[b.childId] = b.nome;
  }
  return { criancas: lista, faltas: byChildId, buscas };
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
