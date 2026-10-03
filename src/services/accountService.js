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
  onSnapshot,
} from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { auth, db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { exigirCloud } from './callableError';
import { deleteChildPhoto } from './photoService';

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
 * ⚠️ O LOGIN RECENTE É CONFERIDO ANTES DE APAGAR QUALQUER COISA (03/10/2026).
 *
 * `deleteUser` exige login de poucos minutos atrás, e ele era o ÚLTIMO passo:
 * na sessão de dias (o normal num app instalado) os dados iam embora, o
 * `deleteUser` falhava com `requires-recent-login`, e a tela mandava "sair e
 * entrar de novo" — com o login vivo e nada mais para excluir. Para a
 * família, era a conta sem os filhos; para o motorista, o login de pé sem
 * operação nenhuma.
 *
 * O Firebase não publica a janela exata; cinco minutos é o que ele aceita na
 * prática, e errar para o lado curto custa só um login a mais.
 */
const JANELA_DO_LOGIN_RECENTE_MS = 5 * 60 * 1000;

function exigirLoginRecente() {
  const ultimo = Date.parse(auth.currentUser?.metadata?.lastSignInTime || '');
  if (!auth.currentUser || !Number.isFinite(ultimo) || Date.now() - ultimo > JANELA_DO_LOGIN_RECENTE_MS) {
    const err = new Error('Login recente necessário.');
    err.code = 'auth/requires-recent-login';
    throw err;
  }
}

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

/**
 * Apaga as VIAGENS antes das crianças, uma criança por vez.
 *
 * Por que uma de cada vez, e não tudo num lote só: a regra de `rides` faz um
 * `get()` no doc da criança, e o Firestore corta em 20 acessos por batch. Os
 * dias de UMA criança compartilham o mesmo `get()` (o Firestore cacheia o
 * mesmo caminho dentro da requisição), então por criança cabe folgado; um
 * lote com trinta crianças diferentes seria negado inteiro.
 */
async function apagarViagensDasCriancas(adminUid) {
  const snap = await getDocs(
    query(collection(db, 'children'), where('adminUid', '==', adminUid))
  );
  for (const filho of snap.docs) {
    const viagens = await getDocs(collection(db, 'children', filho.id, 'rides'));
    if (!viagens.empty) await deleteInBatches(viagens.docs);
  }
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

  // ⚠️ AS TRÊS CONSULTAS ABAIXO PRECISAM DE `adminUid`, E A FALTA DELE
  // QUEBRAVA A REMOÇÃO INTEIRA.
  //
  // `absenceDeclarations`, `altPickups` e `agendaEntries` têm `allow read`
  // escopado em `ehDoMotorista()`, que compara `resource.data.adminUid` com o
  // uid da sessão. Rule que exige campo obriga a CONSULTA a provar o filtro —
  // consulta sem ele é recusada INTEIRA, não parcialmente.
  //
  // A primeira delas não tinha `catch`, então a função lançava e a tela dizia
  // "Erro ao remover. Tente novamente." para sempre: a criança nunca era
  // desativada, o pai nunca era desvinculado e a VAGA NUNCA VOLTAVA — o
  // motorista batia no teto do plano com menos crianças do que contratou, e
  // culpava a cobrança.
  //
  // O idioma está registrado em `altPickupService.js` ("`where('adminUid',
  // '==', uid)` primeiro"), escrito quando o mesmo defeito foi consertado lá.
  const adminUid = child.adminUid || null;
  if (!adminUid) throw new Error('Criança sem motorista — não é possível remover.');

  // 1. Apaga ausências futuras (hoje em diante) — não fazem sentido.
  //    Ausências passadas ficam pra auditoria.
  const todaysKey = todayKey();
  const absSnap = await getDocs(
    query(
      collection(db, 'absenceDeclarations'),
      where('adminUid', '==', adminUid),
      where('childId', '==', childId)
    )
  );
  const futureAbs = absSnap.docs.filter((d) => {
    const k = d.data().dateKey || '';
    return k >= todaysKey;
  });

  // 2. Notificações do pai — ESTA LIMPEZA NÃO CABE NO CLIENTE DO MOTORISTA.
  //
  // `notifications` tem `allow read: resource.data.userId == request.auth.uid`
  // e a coleção não carrega `adminUid`, então não existe consulta que o
  // motorista possa provar. A varredura antiga era negada e, junto com a de
  // ausências, derrubava a remoção inteira.
  //
  // Fica registrado como pendência de function em vez de tentar e falhar: a
  // caixa do responsável some quando o doc dele é apagado no passo 3 (sem
  // documento em `users`, `isAppUser()` nega toda leitura), então o dado fica
  // inerte — mas fica. Abrir uma rule para o motorista listar a caixa da
  // família seria pagar com privacidade uma limpeza de banco.
  const parentNotifs = { docs: [] };

  // 3. Dados pessoais atrelados à criança que não fazem sentido sobreviver:
  //    - altPickups: nome/telefone de quem buscou a criança em cada dia
  //    - agendaEntries (scope=child): recados nominais sobre a criança
  //    Sem essa limpeza, os dois ficavam órfãos no banco pra sempre (LGPD).
  const altPickupsSnap = await getDocs(
    query(
      collection(db, 'altPickups'),
      where('adminUid', '==', adminUid),
      where('childId', '==', childId)
    )
  );
  const agendaSnap = await getDocs(
    query(
      collection(db, 'agendaEntries'),
      where('adminUid', '==', adminUid),
      where('childId', '==', childId)
    )
  );

  await deleteInBatches([
    ...futureAbs,
    ...parentNotifs.docs,
    ...altPickupsSnap.docs,
    ...agendaSnap.docs,
  ]);

  // 3. Apaga doc users do pai (Auth fica órfã — sem doc users, não loga)
  // ⚠️ A CONTA DA FAMÍLIA NÃO É MAIS APAGADA DAQUI (02/10/2026).
  //
  // Era um `deleteDoc(users/{parentUid})` — e a mãe de dois irmãos, ou com
  // filho na perua de OUTRO motorista, perdia a conta inteira (e o acesso aos
  // outros filhos) porque UMA criança saiu desta perua. A função
  // `desvincularResponsavel` tira só esta criança da conta dela, e só apaga a
  // conta quando não sobra filho nenhum. Ela precisa rodar ANTES do update
  // abaixo: é o `parentUid` da criança que diz de quem tirar.
  if (parentUid) {
    exigirCloud('remover a criança da conta da família');
    await httpsCallable(functions, 'desvincularResponsavel')({ childId });
  }

  // O passo "tirar da rota padrão" saiu daqui: não existe mais lista salva de
  // rota. A criança sai da operação pelo `active: false` do passo seguinte.

  // 5. Soft delete da criança + desvincula
  // O soft delete PRESERVA o doc, então os dados pessoais de terceiros
  // (responsáveis alternativos: nome, telefone, parentesco) precisam ser
  // zerados explicitamente — senão sobrevivem indefinidamente no children/.
  await updateDoc(childRef, {
    active: false,
    // `inativadoEm` é o nome que o Financeiro lê (03/10/2026, o mesmo de
    // `deactivateChild`). `deactivatedAt` fica pelos documentos antigos —
    // nenhuma tela o lê.
    inativadoEm: serverTimestamp(),
    deactivatedAt: serverTimestamp(),
    parentUid: null,
    inviteStatus: 'pending', // reseta pra o admin poder reentregar o invite
    // O convite vale 15 dias a partir daqui (03/10/2026): sem isto, o link
    // reaberto de uma criança antiga já nasceria vencido.
    inviteCriadoEm: serverTimestamp(),
    altResponsibles: [],
    // O ACEITE SAI JUNTO COM O VÍNCULO (02/10/2026): sem isto, quem viesse
    // depois herdava "Aceito por <outra pessoa>". As rules só deixam o
    // motorista APAGAR estes campos, nunca escrevê-los.
    contractAcceptedAt: null,
    contractAcceptedByUid: null,
    contractAcceptedName: null,
    contractHash: null,
    contractUserAgent: null,
    contratoVigente: null,
    contratoAguardando: null,
    contractVersion: null,
  });

  // 6. A FOTO DA CRIANÇA SAI DO STORAGE (03/10/2026).
  //
  // O documento fica (soft delete, pelo histórico financeiro), mas o rosto de
  // uma criança que deixou a perua não tem motivo para continuar guardado —
  // e `childPhotos/{childId}` é caminho determinístico: ninguém mais o
  // apagaria. `deleteChildPhoto` engole o "não existia". FORA do caminho
  // crítico: falhar aqui não pode desfazer a remoção que ele pediu.
  if (child.photoURL) {
    try {
      await deleteChildPhoto(childId);
      await updateDoc(childRef, { photoURL: null });
    } catch (err) {
      console.error('[conta] a foto da criança não foi apagada:', err);
    }
  }

  // ⚠️ A VAGA NÃO É MAIS DEVOLVIDA DAQUI (03/10/2026). Havia um
  // `increment(-1)` em `users.criancasAtivas` — o cobrado escrevendo o número
  // que multiplica a fatura dele. O contador é do servidor agora
  // (`functions/lib/contadorDaTurma.js` reconta quando `active` muda), e as
  // rules recusam o campo ao cliente.

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
  exigirLoginRecente();

  // Desvincula TODAS as crianças da conta (um responsável pode ter dois
  // filhos). Antes só desvinculava uma, e o segundo filho ficava preso a um
  // parentUid de conta apagada — invisível pro pai e sem convite reutilizável.
  const ids = Array.isArray(childIds) ? childIds.filter(Boolean) : [];

  // ⚠️ OS DADOS DE TERCEIRO SAEM ANTES DA DESVINCULAÇÃO, E A ORDEM É O BUG.
  //
  // `altPickups` guarda nome e telefone de quem buscou a criança — gente que
  // nem usa o app. A rule de delete é `ownsChild(resource.data.childId)`, que
  // se apoia em `children.parentUid == auth.uid`.
  //
  // A limpeza estava DEPOIS do laço que grava `parentUid: null`: quando ela
  // rodava, `ownsChild()` já era falso e todo delete era negado. O `catch`
  // engolia, e o comentário ao lado afirmava "as rules permitem o dono
  // apagar" — permitiam, até a desvinculação tirar o vínculo três linhas
  // acima. Resultado: a pessoa pedia exclusão de conta e o nome e o telefone
  // de terceiros ficavam no banco para sempre.
  //
  // Este bloco não pode voltar para baixo do laço.
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

  for (const childId of ids) {
    try {
      await updateDoc(doc(db, 'children', childId), {
        parentUid: null,
        inviteStatus: 'pending',
        // O aceite sai com a conta: a próxima família não herda o de outra
        // pessoa (as rules aceitam só nulo aqui).
        contractAcceptedAt: null,
        contractAcceptedByUid: null,
        contractAcceptedName: null,
        contractHash: null,
        contractUserAgent: null,
        contratoVigente: null,
        contractVersion: null,
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

  // NOTA: `agendaEntries` sobre o filho NÃO podem ser apagadas aqui — as
  // rules só deixam o motorista apagar. Ficam pendentes até ele remover a
  // criança (`deactivateChildAndParent`) ou encerrar a operação.
  //
  // A limpeza de `altPickups` subiu para o começo desta função, ANTES da
  // desvinculação — ver o aviso lá.

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
  exigirLoginRecente();

  // As coleções que já carregam `adminUid` saem escopadas.
  //
  // `children` sai por último entre as três porque as VIAGENS dependem dela:
  // a regra de `children/{id}/rides/{dia}` resolve permissão com um `get()`
  // no doc da criança. Apagando a criança primeiro, a subcoleção fica sem
  // caminho de leitura E sem caminho de exclusão pelo cliente — e o que fica
  // lá dentro é hora de embarque e LAT/LNG ligadas a uma criança.
  await apagarViagensDasCriancas(adminUid);
  await deleteOwnedCollection('children', adminUid);
  await deleteOwnedCollection('payments', adminUid);
  await deleteOwnedCollection('schools', adminUid);

  // `dailyRoutes` NÃO é mais varrida: a coleção morreu junto com o modelo de
  // turnos, e as regras dela saíram. Um `getDocs` aqui cai no
  // `match /{document=**}` e é negado — sem catch, e no MEIO do encerramento.
  // O motorista perderia crianças e pagamentos e ficaria com a conta de pé:
  // exatamente o wipe parcial que esta função foi reescrita pra evitar.

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

  // `routePlans` também saiu: a coleção e as regras dela não existem mais.

  // `appState/init` NÃO é apagado.
  //
  // Apagá-lo reabre /first-admin: o próximo visitante que souber a URL vira
  // administrador. É flag de bootstrap da PLATAFORMA, não do motorista — e a
  // rule agora só deixa o dono mexer nele, então a linha antiga também
  // lançaria aqui e derrubaria o encerramento inteiro.

  // ⚠️ ANTES DO DOC DELE, A TURMA PRECISA APARECER ZERADA (03/10/2026).
  //
  // As rules só deixam o motorista apagar o próprio `users/{uid}` com
  // `criancasAtivas == 0` — sem isso, apagar e recriar o documento seria um
  // jeito de sumir com o número que a fatura multiplica. Quem zera é o
  // gatilho do servidor, que reconta depois que as crianças acima saem; ele
  // leva alguns segundos. Apagar antes seria a negação chegando no ÚLTIMO
  // passo, com a operação inteira já destruída.
  await esperarTurmaZerada(adminUid);

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

/** Quanto se espera o servidor recontar a turma antes de desistir. */
const ESPERA_DA_TURMA_MS = 20000;

/**
 * Espera `users/{uid}.criancasAtivas` chegar a 0, escutando o documento.
 *
 * Campo AUSENTE conta como zero: motorista que nunca cadastrou criança nunca
 * acordou o gatilho, e o campo nunca foi escrito.
 *
 * Estourando o prazo, lança com uma frase para a tela — as crianças já
 * saíram, e repetir o encerramento recomeça daqui sem estrago (todas as
 * etapas anteriores apagam o que encontram).
 */
function esperarTurmaZerada(uid) {
  return new Promise((resolve, reject) => {
    let parar = () => {};
    const prazo = setTimeout(() => {
      parar();
      const err = new Error(
        'Ainda estamos terminando de remover as crianças da sua conta. Espere um minuto e toque em encerrar de novo.'
      );
      err.code = 'conta/turma-nao-zerada';
      reject(err);
    }, ESPERA_DA_TURMA_MS);
    parar = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const n = Number(snap.data()?.criancasAtivas) || 0;
        if (!snap.exists() || n === 0) {
          clearTimeout(prazo);
          parar();
          resolve();
        }
      },
      (err) => {
        clearTimeout(prazo);
        reject(err);
      }
    );
  });
}

// ============================================================================
// Helpers exportados
// ============================================================================

export function isRecentLoginRequired(err) {
  return err?.code === 'auth/requires-recent-login';
}
