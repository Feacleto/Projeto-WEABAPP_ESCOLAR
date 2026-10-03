import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * AS CRIANÇAS QUE SAÍRAM DA TURMA (03/10/2026).
 *
 * O cartão "Minha turma" da tela trancada do Financeiro conta quantas saíram
 * no mês, e `useChildren` só traz as ATIVAS. Esta é a outra metade:
 * `active == false` deste motorista.
 *
 * Dois filtros de IGUALDADE, como `watchActiveChildren` — o Firestore resolve
 * sem índice composto, e o escopo por `adminUid` é o mesmo que as rules
 * exigem. A data de saída (`inativadoEm`) é filtrada na régua, não aqui:
 * filtrar por ela na consulta pediria índice novo para uma lista que cresce
 * devagar (uma criança por saída).
 */
export function watchCriancasInativas(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'children'),
    where('adminUid', '==', adminUid),
    where('active', '==', false)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchCriancasInativas error:', err);
      if (onError) onError(err);
    }
  );
}
