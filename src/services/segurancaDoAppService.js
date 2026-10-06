import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * A SEGURANÇA DO APP, do lado do painel — só LÊ. Quem escreve é a agendada
 * `vigiarSeguranca` (functions/lib/vigiaDaSeguranca.js), um documento por dia
 * de Brasília, só com números. Só o dono lê.
 */
export const DIAS_DA_SEGURANCA = 7;

export async function listarSeguranca() {
  const snap = await getDocs(
    query(collection(db, 'segurancaDoApp'), orderBy('dia', 'desc'), limit(DIAS_DA_SEGURANCA))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
