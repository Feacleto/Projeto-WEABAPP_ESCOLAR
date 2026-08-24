import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';

/**
 * Listas de espera / interesse — formulários públicos da landing.
 *
 * Como o Firestore exige auth pra writes (rules), fazemos `signInAnonymously`
 * antes do submit caso o usuário não esteja logado. Isso permite captar
 * leads sem exigir cadastro completo, e mantém as rules apertadas.
 *
 * O admin vê os leads via console do Firebase ou (futuramente) numa tela
 * privada — a leitura está restrita a `isAdmin()` nas rules.
 */

/**
 * ATENÇÃO: O LOGIN ANÔNIMO ESTÁ DESLIGADO NESTE PROJETO.
 *
 * `signInAnonymously` responde ADMIN_ONLY_OPERATION — conferido contra o
 * ambiente real. Então `submitParentWaitlist` abaixo FALHA se alguém a ligar
 * numa tela: ela não chega a escrever nada.
 *
 * Hoje isso não quebra ninguém porque ela não é chamada de lugar nenhum (a
 * captação de responsável acontece pelo link do motorista, não por formulário
 * público). Fica o aviso pra quem for ligar: ou habilita o login anônimo no
 * console, ou passa esta escrita por Cloud Function, como o
 * `joinDriverWaitlist` já faz.
 *
 * A segunda opção é melhor, e o motivo está no vizinho: a function deduplica
 * por email e devolve a posição na fila. Um addDoc direto não faz nenhum dos
 * dois — e a coleção `waitlistParents` hoje não tem NENHUMA tela que a leia.
 */
async function ensureSignedIn() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

/**
 * Inscrição de motorista na lista de espera.
 *
 * Vai por Cloud Function em vez de addDoc direto por dois motivos:
 *   - devolve a POSIÇÃO na fila, que o próprio inscrito não conseguiria
 *     calcular (as rules, corretamente, não deixam ele ler a coleção);
 *   - deduplica por email, pra quem se inscreve duas vezes não virar dois
 *     leads na tela do tio.
 *
 * Retorna { position, alreadyOnList }.
 */
export async function submitDriverWaitlist({
  name,
  email,
  phone,
  city,
  fleet,
  message,
}) {
  await ensureSignedIn();
  const fn = httpsCallable(functions, 'joinDriverWaitlist');
  try {
    const res = await fn({ name, email, phone, city, fleet, message });
    return res.data;
  } catch (err) {
    const c = String(err?.code || '');
    if (c.includes('invalid-argument')) {
      throw new Error(
        err?.message || 'Confira seu nome e o WhatsApp ou email.',
        { cause: err }
      );
    }
    throw new Error('Não conseguimos enviar agora. Tente em alguns segundos.', {
      cause: err,
    });
  }
}

export async function submitParentWaitlist({
  name,
  email,
  phone,
  city,
  childName,
  message,
}) {
  await ensureSignedIn();
  await addDoc(collection(db, 'waitlistParents'), {
    name: name?.trim() || '',
    email: email?.trim().toLowerCase() || '',
    phone: phone?.trim() || '',
    city: city?.trim() || '',
    childName: childName?.trim() || '',
    message: message?.trim() || '',
    createdAt: serverTimestamp(),
  });
}

// ============================================================================
// Leitura pelo admin — leads de motoristas interessados
// ============================================================================

/**
 * Observa os motoristas que pediram acesso, mais recentes primeiro.
 *
 * `orderBy('createdAt')` sozinho não exige índice composto (campo único).
 * Rules: `waitlistDrivers` libera read só pra isAdmin().
 *
 * Retorna função de unsubscribe.
 */
export function watchDriverLeads(onUpdate, onError) {
  const q = query(
    collection(db, 'waitlistDrivers'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('watchDriverLeads:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Marca/desmarca um lead como já contatado. Só admin (rules).
 * Guardamos quem falou e quando pra não perder o histórico.
 */
export async function setLeadContacted(id, contacted, adminUid) {
  if (!id) throw new Error('Sem id do lead.');
  await updateDoc(doc(db, 'waitlistDrivers', id), {
    contacted: !!contacted,
    contactedAt: contacted ? serverTimestamp() : null,
    contactedBy: contacted ? adminUid || null : null,
  });
}

/**
 * Move um pedido da lista de parceiros pelo funil.
 *
 * `status` ∈ 'pending' | 'contacted' | 'approved' | 'rejected'.
 *
 * IMPORTANTE — isto marca a DECISÃO, não cria a conta. Aprovar aqui é dizer
 * "esse motorista entra"; provisionar (criar o usuário, o tenant e o link de
 * primeiro acesso) é operação privilegiada e tem que acontecer numa Cloud
 * Function com Admin SDK, nunca no cliente. Enquanto essa function não
 * existir, `approved` é um recado pra você mesmo: já falei, já decidi, falta
 * liberar. Ver o brief de arquitetura.
 */
export async function setLeadStatus(id, status, adminUid) {
  if (!id) throw new Error('Sem id do lead.');
  const permitidos = ['pending', 'contacted', 'approved', 'rejected'];
  if (!permitidos.includes(status)) throw new Error('Status inválido.');
  await updateDoc(doc(db, 'waitlistDrivers', id), {
    status,
    // Mantém o booleano antigo em sincronia: a tela de leads do tio ainda
    // lê `contacted`, e dois campos discordando é bug garantido depois.
    contacted: status !== 'pending',
    statusBy: adminUid || null,
    statusAt: serverTimestamp(),
  });
}
