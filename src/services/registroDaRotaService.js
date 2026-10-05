import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O REGISTRO DA ROTA DO DIA — "O que a Cida marcou" (05/10/2026).
 *
 * UMA escuta, num documento só: `registroDaRota/{tio}_{AAAA-MM-DD}`, pelo id
 * (um `get`, nunca consulta — as rules negam `list`). É o que deixa o tio
 * acompanhar a auxiliar sem abrir uma escuta por criança da turma.
 *
 * Só o servidor escreve (`marcarParadaPelaAuxiliar`). O documento nasce na
 * primeira marcação dela no dia; antes disso a escuta devolve vazio.
 */
export function watchRegistroDaRota(motoristaUid, dateKey, onUpdate) {
  if (!motoristaUid || !dateKey) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'registroDaRota', `${motoristaUid}_${dateKey}`),
    (snap) => onUpdate(snap.exists() ? snap.data().eventos || [] : []),
    (err) => {
      console.error('watchRegistroDaRota:', err);
      onUpdate([]);
    }
  );
}
