import { useEffect, useState } from 'react';
import { watchActiveChildren, watchChild } from '../services/childrenService';
import { useAuth } from './useAuth';

/**
 * As crianças que dão ROSTO aos avisos do sino (ver `rostoDoAviso`).
 *
 * Motorista: a turma ativa dele. Família: os filhos de `childIds`, um a um —
 * a família não pode consultar `children` por motorista, só ler os próprios.
 *
 * ⚠️ NÃO É LEITURA NOVA NA PRÁTICA. O sino só monta isto com a folha aberta,
 * e as duas consultas são IDÊNTICAS às que o Início (motorista) e a criança
 * ativa (família) já mantêm abertas: o SDK do Firestore reaproveita a escuta
 * de mesma consulta em vez de abrir outra.
 */
export function useCriancasDoSino() {
  const { user, role, childIds } = useAuth();
  const uid = user?.uid || null;
  const ehMotorista = role === 'admin';
  const chave = ehMotorista ? `m:${uid}` : `f:${(childIds || []).join(',')}`;
  const [snap, setSnap] = useState({ chave: null, criancas: [] });

  useEffect(() => {
    if (!uid) return undefined;
    if (ehMotorista) {
      return watchActiveChildren(
        uid,
        (lista) => setSnap({ chave, criancas: lista }),
        () => setSnap({ chave, criancas: [] })
      );
    }
    const ids = childIds || [];
    if (ids.length === 0) return undefined;
    const porId = {};
    const publicar = () =>
      setSnap({ chave, criancas: ids.map((id) => porId[id]).filter(Boolean) });
    const unsubs = ids.map((id) =>
      watchChild(
        id,
        (c) => {
          porId[id] = c;
          publicar();
        },
        () => {
          porId[id] = null;
          publicar();
        }
      )
    );
    return () => unsubs.forEach((u) => u());
    // `chave` resume uid, papel e childIds — a lista em si muda de identidade
    // a cada render do contexto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return snap.chave === chave ? snap.criancas : [];
}
