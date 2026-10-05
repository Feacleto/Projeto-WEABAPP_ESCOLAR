import { useEffect, useState } from 'react';
import { watchFotosDaTurma, watchMinhasFotos } from '../services/comunidadeService';

/**
 * As fotos da turma "para as famílias" do motorista (`adminUid`) que ainda
 * valem — o que a família vê. O estado guarda DE QUEM é, como useNivel.
 * Erro de leitura vira lista vazia: foto é enfeite, nunca tela de erro.
 */
export function useFotosDaTurma(adminUid) {
  const [snap, setSnap] = useState({ chave: null, fotos: [] });
  useEffect(() => {
    if (!adminUid) return undefined;
    return watchFotosDaTurma(
      adminUid,
      (fotos) => setSnap({ chave: adminUid, fotos }),
      () => setSnap({ chave: adminUid, fotos: [] })
    );
  }, [adminUid]);
  return snap.chave === adminUid ? snap.fotos : [];
}

/** As fotos que o próprio tio publicou e ainda valem. `null` enquanto carrega. */
export function useMinhasFotos(uid) {
  const [snap, setSnap] = useState({ chave: null, fotos: null });
  useEffect(() => {
    if (!uid) return undefined;
    return watchMinhasFotos(
      uid,
      (fotos) => setSnap({ chave: uid, fotos }),
      () => setSnap({ chave: uid, fotos: [] })
    );
  }, [uid]);
  return snap.chave === uid ? snap.fotos : null;
}
