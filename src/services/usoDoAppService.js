import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O RETRATO DO USO — o documento mais recente de `usoDoApp`, gravado toda
 * noite pela agendada `contarUsoDoApp` (functions/lib/usoDoApp.js). Só
 * números por recurso; nenhum uid. Só o dono lê (rules). Sem documento ainda
 * (antes da primeira noite) ou com falha, devolve `null` — a tela diz que o
 * primeiro retrato sai na primeira noite, em vez de mostrar zeros.
 */
export async function getUsoDoApp() {
  try {
    const snap = await getDocs(query(collection(db, 'usoDoApp'), orderBy('dia', 'desc'), limit(1)));
    return snap.empty ? null : snap.docs[0].data();
  } catch (err) {
    console.error('[admin] o uso do app não veio:', err);
    return null;
  }
}
