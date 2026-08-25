import {
  doc,
  collection,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { removeChildFromDefaultPlan } from './routePlanService';

/**
 * Operações de exclusão de conta / vínculo — chamadas pela aba de Perfil
 * (Tio e Pai) e pela tela de detalhe da criança.
 *
 * MODELO (Opção B — soft delete com preservação financeira):
 *
 *   1. Tio remove uma criança (deactivateChildAndParent):
 *      - Criança vira `active: false` (soft delete). Não some.
 *      - Pai vinculado: apaga `users/{parentUid}` + desvincula da criança
 *        (parentUid=null, inviteStatus=pending) — pai não entra mais no app.
 *      - PAGAMENTOS preservados (histórico financeiro do Tio).
 *      - Notificações e ausências futuras do pai apagadas (limpeza).
 *
 *   2. Pai exclui própria conta (deleteOwnParentAccount):
 *      - Apaga doc `users/{uid}` + conta Firebase Auth (auth recente).
 *      - Desvincula criança (admin pode reentregar invite pra outro).
 *      - PAGAMENTOS preservados (titular é o Tio, retenção fiscal).
 *      - Notificações pessoais apagadas.
 *
 *   3. Tio encerra a operação (deleteAdminAccount):
 *      - Wipe TOTAL — todas as coleções + conta Auth. Caminho "fechar app".
 *
 * LIMITAÇÃO: o SDK web só apaga a conta Auth do usuário LOGADO. Quando o
 * Tio remove um pai, a conta Auth do pai fica órfã (sem doc users, ele não
 * passa do PrivateRoute). Pra limpar de vez, precisaria Cloud Function.
 *
 * Erro comum: `auth/requires-recent-login` — sessão velha. Pede relogin.
 */

// ============================================================================
// Helpers
// ============================================================================

const FIRESTORE_BATCH_LIMIT = 450;

/**
 * APAGA SÓ O QUE É DESTE MOTORISTA. Antes varria a coleção inteira.
 *
 * `getDocs(collection(db, name))` sem filtro nenhum, em onze coleções. Com um
 * motorista, fazia o que promete. Com vinte, o parceiro que desistisse levava
 * junto as crianças, os pagamentos, as rotas e os usuários dos outros
 * dezenove — de um botão na tela de perfil.
 *
 * Agora que as rules exigem escopo, a versão sem filtro seria pior ainda: a
 * consulta é negada INTEIRA (o Firestore não devolve "a parte que você pode"),
 * e a função lançaria no meio da limpeza. Um wipe parcial, sem transação e sem
 * como retomar, é o único resultado pior que um wipe grande demais.
 */
async function deleteOwnedCollection(name, adminUid, exceptIds = []) {
  const snap = await getDocs(
    query(collection(db, name), where('adminUid', '==', adminUid))
  );
  const docs = snap.docs.filter((d) => !exceptIds.includes(d.id));
  await deleteInBatches(docs);
}

async function deleteInBatches(docs) {
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const slice = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ============================================================================
// 1) Tio remove uma criança — soft delete + remove pai (preserva financeiro)
// ============================================================================

/**
 * Soft delete da criança + remove pai vinculado.
 * O histórico de pagamentos da criança é PRESERVADO (childName denormalizado
 * mantém a info pro Tio na Financeiro).
 *
 * Retorna { parentRemoved, deletedFutureAbsences, deletedParentNotifications }.
 */
export async function deactivateChildAndParent({ childId }) {
  if (!childId) throw new Error('Sem childId.');

  const childRef = doc(db, 'children', childId);
  const childSnap = await getDoc(childRef);
  if (!childSnap.exists()) throw new Error('Criança não encontrada.');
  const child = childSnap.data();
  const parentUid = child.parentUid || null;

  // 1. Apaga ausências futuras (hoje em diante) — não fazem sentido.
  //    Ausências passadas ficam pra auditoria.
  const todaysKey = todayKey();
  const absSnap = await getDocs(
    query(collection(db, 'absenceDeclarations'), where('childId', '==', childId))
  );
  const futureAbs = absSnap.docs.filter((d) => {
    const k = d.data().dateKey || '';
    return k >= todaysKey;
  });

  // 2. Apaga notificações do pai (limpeza)
  let parentNotifs = { docs: [] };
  if (parentUid) {
    parentNotifs = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', parentUid))
    );
  }

  // 3. Dados pessoais atrelados à criança que não fazem sentido sobreviver:
  //    - altPickups: nome/telefone de quem buscou a criança em cada dia
  //    - agendaEntries (scope=child): recados nominais sobre a criança
  //    Sem essa limpeza, os dois ficavam órfãos no banco pra sempre (LGPD).
  const altPickupsSnap = await getDocs(
    query(collection(db, 'altPickups'), where('childId', '==', childId))
  );
  const agendaSnap = await getDocs(
    query(collection(db, 'agendaEntries'), where('childId', '==', childId))
  );

  await deleteInBatches([
    ...futureAbs,
    ...parentNotifs.docs,
    ...altPickupsSnap.docs,
    ...agendaSnap.docs,
  ]);

  // 3. Apaga doc users do pai (Auth fica órfã — sem doc users, não loga)
  if (parentUid) {
    await deleteDoc(doc(db, 'users', parentUid)).catch((err) => {
      console.error('Falha ao apagar doc do pai:', err);
    });
  }

  // 4. Tira da rota padrão (já existe)
  try {
    await removeChildFromDefaultPlan(childId);
  } catch (err) {
    console.error('Falha ao remover da rota padrão:', err);
  }

  // 5. Soft delete da criança + desvincula
  // O soft delete PRESERVA o doc, então os dados pessoais de terceiros
  // (responsáveis alternativos: nome, telefone, parentesco) precisam ser
  // zerados explicitamente — senão sobrevivem indefinidamente no children/.
  await updateDoc(childRef, {
    active: false,
    deactivatedAt: serverTimestamp(),
    parentUid: null,
    inviteStatus: 'pending', // reseta pra o admin poder reentregar o invite
    altResponsibles: [],
  });

  return {
    parentRemoved: !!parentUid,
    deletedFutureAbsences: futureAbs.length,
    deletedParentNotifications: parentNotifs.docs.length,
    deletedAltPickups: altPickupsSnap.docs.length,
    deletedAgendaEntries: agendaSnap.docs.length,
  };
}

// ============================================================================
// 2) Pai exclui própria conta
// ============================================================================

/**
 * Pai exclui própria conta:
 *   - Desvincula criança (parentUid=null, inviteStatus=pending) — admin pode
 *     reentregar o invite code pra outro responsável.
 *   - Apaga próprias notificações.
 *   - Apaga doc users/{uid}.
 *   - Apaga conta Firebase Auth (precisa sessão recente).
 *
 * PAGAMENTOS NÃO são apagados (titular = Tio, retenção fiscal/contábil).
 */
export async function deleteOwnParentAccount({ uid, childIds = [] }) {
  if (!uid) throw new Error('Sem uid.');

  // Desvincula TODAS as crianças da conta (um responsável pode ter dois
  // filhos). Antes só desvinculava uma, e o segundo filho ficava preso a um
  // parentUid de conta apagada — invisível pro pai e sem convite reutilizável.
  const ids = Array.isArray(childIds) ? childIds.filter(Boolean) : [];
  for (const childId of ids) {
    try {
      await updateDoc(doc(db, 'children', childId), {
        parentUid: null,
        inviteStatus: 'pending',
      });
    } catch (err) {
      console.error('Falha ao desvincular criança ' + childId + ':', err);
      // Continua mesmo assim — UX prioriza fechar a conta
    }
  }

  // Apaga próprias notificações
  try {
    const notifsSnap = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', uid))
    );
    await deleteInBatches(notifsSnap.docs);
  } catch (err) {
    console.error('Falha ao apagar notificações:', err);
  }

  // Apaga as indicações de busca (altPickups) — carregam nome e telefone
  // de terceiros que o pai cadastrou. As rules permitem o dono apagar.
  //
  // NOTA: agendaEntries sobre o filho NÃO podem ser apagadas aqui — as rules
  // só deixam o admin apagar. Ficam pendentes até o Tio remover a criança
  // (deactivateChildAndParent) ou encerrar a operação.
  for (const childId of ids) {
    try {
      const altSnap = await getDocs(
        query(collection(db, 'altPickups'), where('childId', '==', childId))
      );
      await deleteInBatches(altSnap.docs);
    } catch (err) {
      console.error('Falha ao apagar altPickups de ' + childId + ':', err);
    }
  }

  // Apaga doc users
  await deleteDoc(doc(db, 'users', uid));

  // Apaga conta Auth — pode lançar requires-recent-login
  try {
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
    }
  } catch (err) {
    await signOut(auth).catch(() => {});
    throw err;
  }
}

// ============================================================================
// 3) Tio (admin) encerra a operação — wipe total
// ============================================================================

/**
 * Apaga TUDO do app + a própria conta do admin.
 *
 * Ordem: doc do admin é o ÚLTIMO Firestore write (assim `isAdmin()` nas
 * rules continua passando enquanto apagamos as outras coleções).
 */
export async function deleteAdminAccount(adminUid) {
  if (!adminUid) throw new Error('Sem adminUid.');

  // As coleções que já carregam `adminUid` saem escopadas.
  await deleteOwnedCollection('children', adminUid);
  await deleteOwnedCollection('payments', adminUid);
  await deleteOwnedCollection('dailyRoutes', adminUid);

  // `users` NÃO é mais varrida aqui.
  //
  // Apagar "todos menos eu" tirava do ar as contas dos responsáveis dos
  // outros motoristas e a do próprio dono da plataforma — que perderia `role`
  // e `superAdmin` sem nenhum caminho no app pra se recriar. Os responsáveis
  // deste motorista já são apagados um a um em deactivateChildAndParent,
  // que é onde existe o vínculo pra saber quem é de quem.

  // Estas três ainda não têm `adminUid` no modelo. Enquanto não tiverem, o
  // encerramento não as toca: é melhor deixar dado órfão do motorista que
  // saiu do que apagar o dado de quem ficou. Anotado como pendência.
  //   - absenceDeclarations
  //   - notifications
  //   - schoolBroadcasts
  // Estas quatro ficavam de fora do wipe e sobreviviam ao "encerrar operação",
  // carregando nomes de crianças, telefones de terceiros e recados nominais.
  //   - altPickups
  //   - pendingCalls
  // `agendaEntries` já carimba adminUid na criação.
  await deleteOwnedCollection('agendaEntries', adminUid);
  // waitlistDrivers e waitlistParents NÃO são apagadas.
  //
  // São dado da PLATAFORMA, não do motorista: é a fila de motoristas e
  // de pais interessados, construída pela página pública. Se o Tio Nino
  // tocar em "encerrar operação", ele apagaria o funil inteiro de
  // captação — que não é dele.
  //
  // A distinção que vale a regra: esta função apaga o que o motorista
  // GEROU (crianças, pagamentos, rotas, recados). O que a plataforma
  // captou fica.
  // Despesas são dado de negócio do tio: saem junto quando ele encerra.
  await deleteOwnedCollection('expenses', adminUid);

  // O id da rota padrão passou a ser `{uid}_default`. O `routePlans/default`
  // que esta linha apagava é o id legado — apagava o doc errado e deixava o
  // certo de pé.
  await deleteDoc(doc(db, 'routePlans', `${adminUid}_default`)).catch((err) =>
    console.error('routePlans do motorista:', err)
  );

  // `appState/init` NÃO é apagado.
  //
  // Apagá-lo reabre /first-admin: o próximo visitante que souber a URL vira
  // administrador. É flag de bootstrap da PLATAFORMA, não do motorista — e a
  // rule agora só deixa o dono mexer nele, então a linha antiga também
  // lançaria aqui e derrubaria o encerramento inteiro.

  // Por ÚLTIMO: doc do admin
  await deleteDoc(doc(db, 'users', adminUid));

  try {
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
    }
  } catch (err) {
    await signOut(auth).catch(() => {});
    throw err;
  }
}

// ============================================================================
// Helpers exportados
// ============================================================================

export function isRecentLoginRequired(err) {
  return err?.code === 'auth/requires-recent-login';
}
