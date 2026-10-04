import { useEffect, useState } from 'react';
import { watchNivel } from '../services/nivelService';

/**
 * O selo OFICIAL de um motorista — `niveis/{uid}`, gravado pelo servidor.
 *
 * Recebe o uid em vez de ler da sessão porque são DOIS leitores: o próprio
 * motorista (o selo no cabeçalho do /tio) e a família dele (o selo ao lado da
 * marca no /pai, com o `adminUid` da criança ativa).
 *
 * Documento ausente vira `'sem_nivel'`: o servidor só cria o documento quando
 * há o que dizer. Erro de leitura também vira `'sem_nivel'` — o selo é
 * enfeite de reconhecimento, e nenhum erro dele pode virar tela de erro.
 *
 * O estado guarda DE QUEM ele é (como `useRide`): trocar de criança ativa para
 * a do outro motorista não mostra, nem por um quadro, o selo do primeiro.
 */
export function useNivel(uid) {
  const [snap, setSnap] = useState({ uid: null, nivel: 'sem_nivel' });

  useEffect(() => {
    if (!uid) return undefined;
    return watchNivel(
      uid,
      (doc) => setSnap({ uid, nivel: doc?.nivel || 'sem_nivel' }),
      () => setSnap({ uid, nivel: 'sem_nivel' })
    );
  }, [uid]);

  const naChave = snap.uid === uid;
  return {
    nivel: uid && naChave ? snap.nivel : 'sem_nivel',
    // Sem uid não há o que carregar — `true` para sempre seria um esqueleto eterno.
    carregando: uid ? !naChave : false,
  };
}
