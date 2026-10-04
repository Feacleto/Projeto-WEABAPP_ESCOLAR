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
// `FieldValue` pelo caminho MODULAR (02/10/2026). `admin.firestore.FieldValue`
// chegava `undefined` no emulador e o `redeemInvite` caía com 500 depois de a
// conta da mãe já existir — o primeiro cadastro de família pelo link (teste
// R1). Os módulos novos já usam este caminho.
const { FieldValue } = require('firebase-admin/firestore');
const { chaveDoTelefone } = require('./indicacao');

const REGION = 'southamerica-east1';

// O FORMATO, O PRAZO DE 15 DIAS E A RESPOSTA ÚNICA moram em `reguaDoConvite.js`
// (03/10/2026). O formato LEGADO (2 letras + 4 dígitos, 9.000 combinações)
// saiu: nenhum código nasce assim desde a troca de formato, e ele só servia
// de alvo para varredura.
const {
  normalizarCodigo: normalizeCode,
  codigoValido: isValidCode,
  conviteVencido,
  MENSAGEM_DO_CONVITE_RECUSADO,
} = require('./reguaDoConvite');
const { REGRAS, MENSAGEM_DE_LIMITE } = require('./reguaDasTentativas');
const limite = require('./limiteDeTentativas');

// Tentativas erradas toleradas por conta antes de bloquear por um tempo.
// Existe pra tornar a varredura inviável mesmo com conta de verdade.
const MAX_FAILED_ATTEMPTS = 12;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

/**
 * A RECUSA ÚNICA (03/10/2026): código malformado, inexistente, já usado ou
 * vencido recebem a MESMA resposta. Diferenciar ensinava a quem varre que
 * acertou um código real.
 */
function conviteRecusado() {
  return new HttpsError('not-found', MENSAGEM_DO_CONVITE_RECUSADO);
}

/**
 * Busca a criança de um invite code válido, ainda não usado e no prazo.
 * Retorna o doc snapshot ou null.
 */
async function findPendingChild(db, code) {
  const snap = await db
    .collection('children')
    .where('inviteCode', '==', code)
    .where('inviteStatus', '==', 'pending')
    .limit(1)
    .get();
  if (snap.empty) return null;
  // ⚠️ CRIANÇA REMOVIDA NÃO TEM CONVITE (02/10/2026). Remover a criança põe
  // `inviteStatus` de volta em 'pending' (para um reenvio futuro), e o link
  // antigo — guardado no WhatsApp de quem quer que o tenha recebido —
  // voltava a funcionar e vinculava alguém a uma criança fora da turma.
  if (snap.docs[0].data().active === false) return null;
  // ⚠️ O CONVITE VALE 15 DIAS (03/10/2026, decisão do dono). Vencido, a
  // resposta é a de "não existe" — ver `reguaDoConvite.js`.
  if (conviteVencido(snap.docs[0].data(), Date.now())) return null;
  return snap.docs[0];
}

/**
 * lookupInvite — pré-visualização do convite, ANTES de ter conta.
 *
 * Deliberadamente devolve o mínimo: primeiro nome da criança e nome do
 * motorista. Nada de endereço, coordenada, escola, telefone ou email.
 *
 * ⚠️ PÚBLICA, ENTÃO CONTADA POR IP (03/10/2026): 30 códigos que não abriram
 * por hora (`REGRAS.CONVITE_PUBLICO`). Só o erro conta — ver
 * `reguaDasTentativas.js`.
 */
function makeLookupInvite(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const quem = limite.quemPeloIp(request.rawRequest);
    if (!(await limite.aindaCabe(db, REGRAS.CONVITE_PUBLICO, quem))) {
      throw new HttpsError('resource-exhausted', MENSAGEM_DE_LIMITE);
    }

    const code = normalizeCode(request.data?.code);
    const childDoc = isValidCode(code) ? await findPendingChild(db, code) : null;
    if (!childDoc) {
      // Uma resposta só para malformado, inexistente, usado e vencido.
      await limite.contar(db, REGRAS.CONVITE_PUBLICO, quem);
      throw conviteRecusado();
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
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Faça login antes de usar o convite.');
    }

    // A trava vem ANTES do formato: o código malformado também conta como
    // erro, e conferir depois deixaria 12 erros "de formato" de graça.
    //
    // (A exceção para conta ANÔNIMA com código legado saiu em 03/10/2026
    // junto com o próprio formato legado: só o espaço de ~730 milhões é
    // aceito, para qualquer conta.)
    await assertNotThrottled(db, uid);

    const code = normalizeCode(request.data?.code);
    if (!isValidCode(code)) {
      await registerFailedAttempt(db, uid);
      throw conviteRecusado();
    }

    const name = String(request.data?.name || '').trim().slice(0, 120);
    const acceptedLegalVersion = String(request.data?.legalVersion || '').slice(0, 20);

    const childDoc = await findPendingChild(db, code);
    if (!childDoc) {
      // Cada erro conta: é assim que a varredura fica inviável.
      await registerFailedAttempt(db, uid);
      throw conviteRecusado();
    }

    const childRef = childDoc.ref;
    const userRef = db.doc(`users/${uid}`);


    const result = await db.runTransaction(async (tx) => {
      const freshChild = await tx.get(childRef);
      if (!freshChild.exists) throw conviteRecusado();
      const child = freshChild.data();
      // Removida entre a busca e a transação: o convite morreu junto.
      if (child.active === false) throw conviteRecusado();

      // Revalida DENTRO da transação — evita dois pais resgatando o mesmo
      // código em paralelo (o último sobrescreveria o primeiro). A resposta
      // é a recusa única: "já foi usado" confirmaria que o código existe.
      if (child.inviteStatus !== 'pending' || child.parentUid || child.inviteCode !== code) {
        throw conviteRecusado();
      }

      const userSnap = await tx.get(userRef);
      const existing = userSnap.exists ? userSnap.data() : null;

      // ⚠️ QUALQUER PAPEL EXISTENTE QUE NÃO SEJA `parent` RECUSA — E ANTES A
      // CONDIÇÃO ERA SÓ `=== 'admin'`.
      //
      // O `userPayload` abaixo sempre traz `role: 'parent'` e é escrito com
      // Admin SDK, que não passa por rules. Com a checagem olhando só para
      // motorista, o DONO que abrisse um link de convite — o gesto de suporte
      // mais natural que existe, "deixa eu ver o que a mãe vê" — tinha o
      // `role: 'owner'` sobrescrito e perdia o `/admin`.
      //
      // E era IRREVERSÍVEL pelo produto: o cliente não escreve `role`
      // (firestore.rules), então o conserto é console.
      //
      // Papel ausente continua passando: é o caso normal de quem acabou de
      // criar sessão pelo link.
      if (existing && existing.role && existing.role !== 'parent') {
        throw new HttpsError(
          'failed-precondition',
          existing.role === 'admin'
            ? 'Esta conta é de motorista e não pode ser vinculada como responsável.'
            : 'Esta conta não pode ser vinculada como responsável. Entre com a conta da família.'
        );
      }


      tx.update(childRef, {
        parentUid: uid,
        inviteStatus: 'used',
        inviteUsedAt: FieldValue.serverTimestamp(),
      });

      // O RELÓGIO DO TESTE NÃO LIGA MAIS AQUI (04/10/2026): a família entrar
      // deixou de ser gatilho — o teste começa no 3º dia de rota, e só nele
      // (ver `relogioNaRota.js`).

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
          ? { adminUids: FieldValue.arrayUnion(child.adminUid) }
          : {}),
        childIds: FieldValue.arrayUnion(childRef.id),
        // Campo legado: as telas do pai ainda leem `childId`. Só definimos
        // quando não havia nenhum, pra não trocar o filho ativo de quem
        // está adicionando o segundo.
        childId: existing?.childId || childRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // A CHAVE DO IRMÃO (02/10/2026). Criança nova cadastrada com este
      // WhatsApp entra sozinha nesta conta (`vincularIrmao.js`). Ela sai do
      // número que o MOTORISTA digitou nesta criança — nunca do `phone` da
      // conta, que a própria pessoa edita — e só é gravada uma vez: a
      // primeira família define a chave, e as rules a proíbem ao cliente.
      if (!existing?.phoneChave) {
        const chave = chaveDoTelefone(child.parentPhone);
        if (chave) userPayload.phoneChave = chave;
      }

      // O vínculo é por POSSE DO LINK, não por email igual ao cadastro.
      // Exigir email igual recriaria a burocracia: o tio digita errado, ou
      // o pai usa outra conta Google, e o acesso trava. Em vez de barrar,
      // REGISTRAMOS se casou — assim o tio vê a divergência na ficha e
      // decide se quer conferir.
      const authEmail = (request.auth.token?.email || '').toLowerCase();
      const cadastroEmail = String(child.parentEmail || '').toLowerCase();
      // ⚠️ "CASOU" SÓ COM E-MAIL VERIFICADO (03/10/2026). Uma conta de e-mail
      // e senha nasce com qualquer endereço digitado, sem prova de posse — e
      // o selo de "e-mail confere com o cadastro" na ficha do motorista
      // virava atestado de identidade para quem só digitou o e-mail da mãe.
      // Sem verificação o resultado é `false`: a ficha mostra a divergência
      // e o motorista confere.
      const emailVerificado = request.auth.token?.email_verified === true;
      // ⚠️ O E-MAIL DA FAMÍLIA É GRAVADO SEMPRE (02/10/2026). O cadastro da
      // criança deixou de pedir o e-mail ao motorista — ele quase nunca
      // sabe —, então este passa a ser O e-mail dela, lido pelo contrato e
      // pela ficha. A comparação com o digitado só existe quando há um
      // (cadastros antigos).
      if (authEmail) {
        tx.update(childRef, {
          linkedEmail: authEmail,
          ...(cadastroEmail
            ? { linkedEmailMatchesCadastro: emailVerificado && authEmail === cadastroEmail }
            : {}),
        });
      }

      if (!existing) {
        userPayload.name = name || child.parentName || '';
        userPayload.email = request.auth.token?.email || child.parentEmail || '';
        userPayload.phone = child.parentPhone || '';
        userPayload.createdAt = FieldValue.serverTimestamp();
        // Nomes destes campos vêm de consentService.hasAcceptedCurrentTerms —
        // se divergirem, o TermsAcceptanceGate barra o pai que acabou de
        // aceitar os termos na tela de convite.
        if (acceptedLegalVersion) {
          const now = FieldValue.serverTimestamp();
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

    // Sem o CÓDIGO no log (03/10/2026): log é lido por mais gente que o
    // banco, e o código é a chave da conta da família.
    logger.info('Convite resgatado', { child: result.childId, uid });
    return result;
  });
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
            ? FieldValue.serverTimestamp()
            : snap.data().windowStart,
          lastAt: FieldValue.serverTimestamp(),
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
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async () => {
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
