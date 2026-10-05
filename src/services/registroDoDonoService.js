import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { exigirCloud } from './callableError';

/**
 * O REGISTRO DE AÇÕES DO DONO, do lado do app.
 *
 * ESCREVER é só pela callable `suspenderConta` (functions/lib/registroDoDono.js):
 * as rules recusam `registroDoDono` a todo cliente, dono incluído, e deixaram de
 * aceitar o `users.suspenso` escrito pelo dono. Foi o que substituiu o antigo
 * `suspenderParceiro` do taxaService — ele gravava a suspensão sem motivo, sem
 * prazo de resposta e sem rastro de quem decidiu.
 *
 * LER é só do dono, e com teto: as 200 linhas mais recentes.
 */
export const LINHAS_DO_REGISTRO_NO_PAINEL = 200;

export async function suspenderConta(pedido) {
  exigirCloud('registrar a ação');
  const r = await httpsCallable(functions, 'suspenderConta')(pedido);
  return r.data;
}

export async function listarRegistro() {
  const snap = await getDocs(
    query(
      collection(db, 'registroDoDono'),
      orderBy('em', 'desc'),
      limit(LINHAS_DO_REGISTRO_NO_PAINEL)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
