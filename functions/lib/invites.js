/**
 * Resgate de convite no servidor.
 *
 * POR QUE ISTO EXISTE
 * O fluxo antigo resolvia o convite no cliente: o app consultava
 * `children` filtrando por inviteCode. Pra isso funcionar, as rules
 * precisavam liberar leitura de qualquer criança com
 * `inviteStatus == 'pending'` — e como a landing faz signInAnonymously pra
 * gravar leads, QUALQUER visitante do site conseguia rodar essa query e
 * receber a lista completa de crianças pendentes com nome, endereço,
 * coordenada, escola e telefone do responsável.
 *
 * Movendo pro servidor: as rules não precisam mais liberar nada, o cliente
 * nunca vê os dados de uma criança que não é dele, e o vínculo passa a ser
 * validado com o Admin SDK.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';

// Dois formatos aceitos (ver src/utils/generateInviteCode.js):
//   legado — 2 letras + 4 dígitos (9.000 combinações)
//   novo   — 2 letras + 6 chars de alfabeto sem ambiguidade (~730 mi)
// O legado segue valendo pra quem já recebeu convite; códigos novos
// nascem no formato grande porque o espaço pequeno era varrível.
const NEW_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const LEGACY_RE = /^[A-Z]{2}\d{4}$/;
const NEW_RE = new RegExp('^[A-Z]{2}[' + NEW_ALPHABET + ']{6}$');

function isValidCode(code) {
  return LEGACY_RE.test(code) || NEW_RE.test(code);
}

// Tentativas erradas toleradas por conta antes de bloquear por um tempo.
// Existe pra tornar a varredura inviável mesmo com conta de verdade.
const MAX_FAILED_ATTEMPTS = 12;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

/**
 * Busca a criança de um invite code válido e ainda não usado.
 * Retorna o doc snapshot ou null.
 */
async function findPendingChild(db, code) {
  const snap = await db
    .collection('children')
    .where('inviteCode', '==', code)
    .where('inviteStatus', '==', 'pending')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

/**
 * lookupInvite — pré-visualização do convite, ANTES de ter conta.
 *
 * Deliberadamente devolve o mínimo: primeiro nome da criança e nome do
 * motorista. Nada de endereço, coordenada, escola, telefone ou email.
 * Assim, mesmo que alguém varra os 9.000 códigos possíveis, não colhe
 * dado pessoal útil — só descobre que um código existe.
 */
function makeLookupInvite(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const code = normalizeCode(request.data?.code);
    if (!isValidCode(code)) {
      throw new HttpsError('invalid-argument', 'Código em formato inválido.');
    }

    const childDoc = await findPendingChild(db, code);
    if (!childDoc) {
      // Mensagem única pra código inexistente E já usado: não confirma
      // pra quem está tentando adivinhar se acertou um código real.
      throw new HttpsError('not-found', 'Convite não encontrado ou já usado.');
    }

    const child = childDoc.data();

    let driverName = '';
    let companyName = '';
    try {
      // O MOTORISTA VEM DA CRIANÇA, e não de `appState/init`.
      //
      // O ponteiro global resolve UM motorista pra plataforma inteira: com
      // dois parceiros, o responsável que resgatava o convite via o nome e a
      // marca do motorista ERRADO — logo na tela que existe pra ele
      // reconhecer com quem o filho vai andar. A criança já está carregada
      // duas linhas acima e carrega o dono certo.
      const adminUid = child.adminUid || null;
      if (adminUid) {
        const adminSnap = await db.doc(`users/${adminUid}`).get();
        if (adminSnap.exists) {
          driverName = adminSnap.data().name || '';
          companyName = adminSnap.data().companyName || '';
        }
      }
    } catch (err) {
      logger.warn('lookupInvite: falha ao ler dados do motorista', err);
    }

    return {
      childFirstName: firstName(child.name),
      driverFirstName: firstName(driverName),
      companyName,
    };
  });
}

/**
 * redeemInvite — vincula a conta autenticada à criança do convite.
 *
 * Pré-condição: o cliente JÁ criou a conta no Firebase Auth (email/senha
 * ou Google) e chama isto autenticado. Fazemos tudo em transação pra dois
 * pais não resgatarem o mesmo código ao mesmo tempo.
 *
 * Grava `childIds` (array) e `childId` (string) ao mesmo tempo: o array é
 * o modelo novo, o campo antigo segue preenchido enquanto as telas do pai
 * ainda o leem. Quem já tinha conta ganha a criança no array.
 */
function makeRedeemInvite(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Faça login antes de usar o convite.');
    }

    const code = normalizeCode(request.data?.code);
    if (!isValidCode(code)) {
      await registerFailedAttempt(db, uid);
      throw new HttpsError('invalid-argument', 'Código em formato inválido.');
    }

    // Conta ANÔNIMA só resgata código do formato NOVO.
    //
    // O motivo é aritmético. Identidade anônima é grátis e ilimitada, então
    // o limite de tentativas por conta não segura nada contra ela: o
    // atacante cria uma conta nova a cada 12 erros. O que segura é o
    // tamanho do espaço. Código legado tem 9.000 combinações — varredura de
    // minutos. Código novo tem ~730 milhões — semanas pra 1% de chance.
    const provider = request.auth.token?.firebase?.sign_in_provider;
    const isAnonymous = !provider || provider === 'anonymous';
    if (isAnonymous && LEGACY_RE.test(code)) {
      throw new HttpsError(
        'permission-denied',
        'Este convite é antigo. Peça um link novo ao motorista, ou entre com email/Google.'
      );
    }

    await assertNotThrottled(db, uid);

    const name = String(request.data?.name || '').trim().slice(0, 120);
    const acceptedLegalVersion = String(request.data?.legalVersion || '').slice(0, 20);

    const childDoc = await findPendingChild(db, code);
    if (!childDoc) {
      // Cada erro conta: é assim que a varredura fica inviável.
      await registerFailedAttempt(db, uid);
      throw new HttpsError('not-found', 'Convite não encontrado ou já usado.');
    }

    const childRef = childDoc.ref;
    const userRef = db.doc(`users/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const freshChild = await tx.get(childRef);
      if (!freshChild.exists) {
        throw new HttpsError('not-found', 'Criança não encontrada.');
      }
      const child = freshChild.data();

      // Revalida DENTRO da transação — evita dois pais resgatando o mesmo
      // código em paralelo (o último sobrescreveria o primeiro).
      if (child.inviteStatus !== 'pending' || child.parentUid) {
        throw new HttpsError(
          'failed-precondition',
          'Este convite já foi usado. Peça um novo ao motorista.'
        );
      }

      const userSnap = await tx.get(userRef);
      const existing = userSnap.exists ? userSnap.data() : null;

      // Uma conta de admin não pode virar responsável de criança.
      if (existing && existing.role === 'admin') {
        throw new HttpsError(
          'failed-precondition',
          'Esta conta é de motorista e não pode ser vinculada como responsável.'
        );
      }

      tx.update(childRef, {
        parentUid: uid,
        inviteStatus: 'used',
        inviteUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userPayload = {
        role: 'parent',
        // DE QUAL MOTORISTA ESTE RESPONSÁVEL É.
        //
        // Sem este campo, `users` não tinha como ser escopado, e as rules
        // caíam em `isAdmin()` solto — que aqui significa QUALQUER motorista.
        // Na prática: um parceiro reescrevia a `pixKey` de outro (sondado em
        // produção, HTTP 200) e apagava o doc de qualquer conta, inclusive a
        // do dono. É também o que diz ao responsável qual perua ele pode
        // acompanhar no mapa.
        //
        // Um responsável com filhos em peruas diferentes fica com o primeiro
        // motorista aqui; o vínculo por criança continua em `child.adminUid`,
        // que é o dado real. Este campo é a chave de escopo, não a verdade.
        adminUid: existing?.adminUid || child.adminUid || null,
        // TODOS os motoristas dos filhos dela, e não só o primeiro.
        //
        // O campo singular acima é a chave de escopo histórica e guarda quem
        // veio primeiro. Mas a interface resolve o motorista pelo `adminUid`
        // da CRIANÇA ATIVA, então a mãe com filhos em peruas diferentes
        // precisa alcançar os dois documentos — é de lá que saem a chave PIX
        // e a marca de cada um. A rule de `users` lê esta lista.
        //
        // `arrayUnion` não duplica quando é o mesmo motorista, que é o caso
        // comum (irmãos na mesma perua).
        ...(child.adminUid
          ? { adminUids: admin.firestore.FieldValue.arrayUnion(child.adminUid) }
          : {}),
        childIds: admin.firestore.FieldValue.arrayUnion(childRef.id),
        // Campo legado: as telas do pai ainda leem `childId`. Só definimos
        // quando não havia nenhum, pra não trocar o filho ativo de quem
        // está adicionando o segundo.
        childId: existing?.childId || childRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // O vínculo é por POSSE DO LINK, não por email igual ao cadastro.
      // Exigir email igual recriaria a burocracia: o tio digita errado, ou
      // o pai usa outra conta Google, e o acesso trava. Em vez de barrar,
      // REGISTRAMOS se casou — assim o tio vê a divergência na ficha e
      // decide se quer conferir.
      const authEmail = (request.auth.token?.email || '').toLowerCase();
      const cadastroEmail = String(child.parentEmail || '').toLowerCase();
      if (authEmail && cadastroEmail) {
        tx.update(childRef, {
          linkedEmailMatchesCadastro: authEmail === cadastroEmail,
          linkedEmail: authEmail,
        });
      }

      if (!existing) {
        userPayload.name = name || child.parentName || '';
        userPayload.email = request.auth.token?.email || child.parentEmail || '';
        userPayload.phone = child.parentPhone || '';
        userPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        // Nomes destes campos vêm de consentService.hasAcceptedCurrentTerms —
        // se divergirem, o TermsAcceptanceGate barra o pai que acabou de
        // aceitar os termos na tela de convite.
        if (acceptedLegalVersion) {
          const now = admin.firestore.FieldValue.serverTimestamp();
          userPayload.termsVersion = acceptedLegalVersion;
          userPayload.termsAcceptedAt = now;
          userPayload.privacyVersion = acceptedLegalVersion;
          userPayload.privacyAcceptedAt = now;
        }
      }

      tx.set(userRef, userPayload, { merge: true });

      return {
        childId: childRef.id,
        childFirstName: firstName(child.name),
        isNewAccount: !existing,
      };
    });

    logger.info(`Convite resgatado: code=${code} child=${result.childId} uid=${uid}`);
    return result;
  });
}

/**
 * joinDriverWaitlist — inscrição de motorista + posição na fila.
 *
 * Existe como função porque as rules (corretamente) não deixam o próprio
 * inscrito ler a coleção, então ele não conseguiria saber sua posição.
 * Aqui contamos no servidor e devolvemos só o número.
 */
function makeJoinDriverWaitlist(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const d = request.data || {};
    const name = String(d.name || '').trim().slice(0, 120);
    const phone = String(d.phone || '').replace(/\D/g, '').slice(0, 15);
    const email = String(d.email || '').trim().toLowerCase().slice(0, 160);
    const city = String(d.city || '').trim().slice(0, 120);
    // Quantas crianças ele transporta hoje. Substituiu o tamanho da frota:
    // van é patrimônio dele, criança é o tamanho da operação — e é sobre
    // criança que a associação é dimensionada e contratada.
    //
    // Teto de 500 pra recusar dedo escorregado e lixo de bot sem barrar
    // ninguém real: a maior frota escolar plausível não chega perto.
    const criancas = Math.min(
      500,
      Math.max(0, Math.trunc(Number(d.criancas) || 0))
    );
    const message = String(d.message || '').trim().slice(0, 600);

    if (!name || (!phone && !email)) {
      throw new HttpsError(
        'invalid-argument',
        'Precisamos do seu nome e de um WhatsApp ou email pra falar com você.'
      );
    }

    // Já se inscreveu antes? Devolve a posição existente em vez de duplicar.
    if (email) {
      const dup = await db
        .collection('waitlistDrivers')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!dup.empty) {
        const position = await positionOf(db, dup.docs[0]);
        return { position, alreadyOnList: true };
      }
    }

    const ref = await db.collection('waitlistDrivers').add({
      name,
      phone,
      email,
      city,
      criancas,
      message,
      contacted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    const position = await positionOf(db, created);
    return { position, alreadyOnList: false };
  });
}

/**
 * Posição na fila = quantos ainda-não-contatados entraram antes dele, +1.
 * Quem já foi contatado sai da conta — a fila é de espera, não histórico.
 */
async function positionOf(db, docSnap) {
  const createdAt = docSnap.data()?.createdAt;
  if (!createdAt) return 1;
  const before = await db
    .collection('waitlistDrivers')
    .where('contacted', '==', false)
    .where('createdAt', '<', createdAt)
    .count()
    .get();
  return (before.data().count || 0) + 1;
}


/**
 * Contagem de tentativas erradas por conta, em `inviteAttempts/{uid}`.
 *
 * A coleção não aparece nas Security Rules de propósito: só o Admin SDK
 * escreve nela, e o default deny cuida do resto. Se aparecesse, o próprio
 * atacante poderia zerar o contador.
 */
async function assertNotThrottled(db, uid) {
  const snap = await db.doc(`inviteAttempts/${uid}`).get();
  if (!snap.exists) return;
  const d = snap.data();
  const first = d.windowStart?.toMillis?.() || 0;
  if (Date.now() - first > ATTEMPT_WINDOW_MS) return; // janela expirou
  if ((d.failed || 0) >= MAX_FAILED_ATTEMPTS) {
    throw new HttpsError(
      'resource-exhausted',
      'Muitas tentativas erradas. Aguarde uma hora ou peça um link novo ao motorista.'
    );
  }
}

async function registerFailedAttempt(db, uid) {
  const ref = db.doc(`inviteAttempts/${uid}`);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const first = snap.exists ? snap.data().windowStart?.toMillis?.() || 0 : 0;
      const fresh = !snap.exists || now - first > ATTEMPT_WINDOW_MS;
      tx.set(
        ref,
        {
          failed: fresh ? 1 : (snap.data().failed || 0) + 1,
          windowStart: fresh
            ? admin.firestore.FieldValue.serverTimestamp()
            : snap.data().windowStart,
          lastAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  } catch (err) {
    // Falhar em CONTAR não deve impedir o usuário legítimo de tentar.
    logger.warn('registerFailedAttempt:', err);
  }
}
module.exports = {
  makeLookupInvite,
  makeRedeemInvite,
  makeJoinDriverWaitlist,
  normalizeCode,
  isValidCode,
};

/**
 * getShowcase — dados públicos da plataforma pra home (sem login).
 *
 * A home precisa mostrar o motorista parceiro, mas as rules (corretamente)
 * exigem login pra ler `users`. Em vez de duplicar os dados num doc público
 * que o tio teria que manter em sincronia, lemos aqui com Admin SDK e
 * devolvemos só o que é de vitrine: nome, cidade, quantas famílias.
 *
 * Nada de email, telefone, chave PIX ou nome de criança.
 *
 * E NADA DE FOTO DE PERFIL — o motivo importa mais que a proibição.
 * Esta função roda com Admin SDK e SEM login: o que ela devolve está na
 * internet, pra qualquer um. O `photoURL` de `users/{uid}` é o avatar que
 * o motorista subiu (ou que veio da conta Google dele) numa tela de
 * PERFIL, que sempre foi privada. Ninguém nunca lhe perguntou se aquele
 * rosto podia ir pra home — e é o rosto dele, num app cujo público são as
 * famílias da rua dele.
 *
 * Vitrine mostra MARCA, não pessoa. Quando existir imagem de marca com
 * consentimento explícito pra uso público (`brandImageURL` + `brandKind`
 * na camada de parceiro), é ELA que entra aqui. Avatar de perfil, nunca.
 */
function makeGetShowcase(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.PUBLICO }, async () => {
    try {
      const initSnap = await db.doc('appState/init').get();
      if (!initSnap.exists) return { drivers: [], hasAdmin: false };

      const adminUid = initSnap.data().adminUid;
      if (!adminUid) return { drivers: [], hasAdmin: true };

      const adminSnap = await db.doc(`users/${adminUid}`).get();
      if (!adminSnap.exists) return { drivers: [], hasAdmin: true };
      const a = adminSnap.data();

      const familiesSnap = await db
        .collection('children')
        .where('active', '==', true)
        .count()
        .get();

      // Responsáveis COM CONTA — não é o mesmo número que `families`, e a
      // diferença importa pra quem for usar um ou outro.
      //
      // `families` conta CRIANÇA ativa: é o tamanho da operação do motorista,
      // e existe desde o cadastro dela, antes de qualquer pai entrar no app.
      // Isto aqui conta GENTE que resgatou o convite e tem login. É sempre
      // menor, e é o que responde "quantas pessoas usam isto".
      //
      // Não existe sinal de atividade em `users` (sem lastSeen, sem
      // lastLogin), então "ativo" aqui significa TER CONTA, não ter aberto o
      // app recentemente. Se um dia a distinção importar, é este contador que
      // muda — e o nome do campo já não vai servir.
      //
      // A contagem é agregação no servidor: não baixa documento nenhum, então
      // nada de nome, e-mail ou telefone de responsável trafega pra montar um
      // número que vai pra uma página pública.
      const responsaveisSnap = await db
        .collection('users')
        .where('role', '==', 'parent')
        .count()
        .get();

      return {
        hasAdmin: true,
        responsaveis: responsaveisSnap.data().count || 0,
        drivers: [
          {
            name: a.companyName || (a.name ? `Perua do ${a.name}` : 'Perua parceira'),
            driverFirstName: firstName(a.name),
            city: a.companyCity || a.city || '',
            families: familiesSnap.data().count || 0,
          },
        ],
      };
    } catch (err) {
      logger.error('getShowcase:', err);
      // Home nunca deve quebrar por causa da vitrine.
      return { drivers: [], hasAdmin: true };
    }
  });
}

module.exports.makeGetShowcase = makeGetShowcase;
