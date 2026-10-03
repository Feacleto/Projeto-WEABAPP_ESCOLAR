/**
 * O RESPONSÁVEL SEM LINK PEDE ACESSO, E O MOTORISTA APROVA (02/10/2026).
 *
 * O link continua sendo a porta principal: só quem recebeu a mensagem do
 * motorista o tem. Mas o motorista às vezes cadastra a criança e esquece de
 * mandar. Agora a pessoa entra (Google ou e-mail), informa o WhatsApp, e:
 *
 *   - se o número está numa criança ainda sem responsável, sai um PEDIDO
 *     para o motorista daquela criança, que aprova com um toque;
 *   - se não está em nenhuma, ela fica com a conta criada e o app pede para
 *     ela chamar o motorista. Quando ele cadastrar a criança com esse
 *     número, o pedido nasce sozinho (`vincularIrmao.js`).
 *
 * ── ⚠️ O NÚMERO SOZINHO NÃO ABRE NADA, e esta é a decisão inteira
 * Telefone não é segredo: o ex-marido sabe, a vizinha sabe. Se digitar o
 * número bastasse, quem o conhece veria endereço, escola, foto e a perua da
 * criança ao vivo. O dono preferiu a aprovação do motorista ao SMS (custo).
 * Por isso aqui nada é vinculado — só se cria o pedido. Quem vincula é
 * `responderPedidoDeAcesso`, chamado pelo motorista dono da criança.
 *
 * ── ⚠️ E A RESPOSTA NÃO DIZ NEM SE ACHOU (03/10/2026)
 * Quem digita um número alheio não pode sair sabendo que ali existe "Lucas" —
 * nem que ali existe ALGUÉM. A resposta era `{ encontrou: N }`, e a tela
 * dizia "encontramos um cadastro com este número": um oráculo de quais
 * telefones têm criança cadastrada na plataforma. Agora a resposta é sempre
 * `{ ok: true }` e a tela diz "se o número estiver cadastrado, o motorista
 * recebe o pedido". E cada conta faz no máximo 5 pedidos por dia
 * (`REGRAS.PEDIDO_DE_ACESSO`).
 *
 * ── ⚠️ O PEDIDO NÃO LEVA O E-MAIL DE QUEM PEDIU (03/10/2026)
 * O motorista decide pelo nome e pelo WhatsApp — é por eles que ele conhece a
 * família. O e-mail de uma conta ainda não aprovada ia para o documento de
 * um terceiro sem servir a decisão nenhuma.
 *
 * ── A CONTA NASCE SEM FILHO
 * `role: 'parent'`, `childIds: []`. O cliente não pode criar responsável
 * (o `allow create` de `users` só aceita motorista), por isso é aqui. Os
 * termos ela aceita depois, no `TermsAcceptanceGate`, como qualquer conta.
 *
 * ── ⚠️ `telefoneAguardandoChave` NÃO É `phoneChave`
 * A chave do vínculo automático de irmão (`phoneChave`) só nasce de número
 * COMPROVADO — por link ou por aprovação. Este campo guarda o número que a
 * pessoa digitou, não comprovado: serve só para gerar pedido quando o
 * motorista cadastrar a criança depois. Os dois são proibidos ao cliente.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { criancasQueEsperam, chaveDoTelefone } = require('./reguaDoIrmao');
const { ligarRelogioComSnap } = require('./relogioDoTeste');
const { cobrancaLigada } = require('./cobrancaLigada');
const { idValido } = require('./reguaDosIds');
const { REGRAS, MENSAGEM_DE_LIMITE } = require('./reguaDasTentativas');
const limite = require('./limiteDeTentativas');

const REGION = 'southamerica-east1';

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/**
 * Cria (ou atualiza) o pedido de uma criança e avisa o motorista dela.
 * Idempotente: o id é `{childId}_{parentUid}`, e pedido já respondido não
 * volta a "aguardando" sozinho.
 */
async function abrirPedido(db, { crianca, parentUid, nome, telefone }) {
  const ref = db.doc(`pedidosDeVinculo/${crianca.id}_${parentUid}`);
  const atual = await ref.get();
  if (atual.exists && atual.data().status !== 'aguardando') return false;
  await ref.set(
    {
      childId: crianca.id,
      // ⚠️ SEM O NOME DA CRIANÇA (03/10/2026). Quem pediu lê este documento,
      // e quem pediu só provou saber um WhatsApp: a tela dela escondia o
      // nome, mas o documento o entregava inteiro ao console do navegador.
      // O motorista acha o nome pelo `childId`, na turma dele.
      adminUid: crianca.adminUid,
      parentUid,
      nome: nome || '',
      // Sem e-mail (ver o cabeçalho) — e o de um pedido antigo sai aqui.
      email: FieldValue.delete(),
      telefone: String(telefone || '').replace(/\D/g, ''),
      status: 'aguardando',
      criadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  if (!atual.exists) {
    const quem = primeiroNome(nome) || 'Um responsável';
    const filho = primeiroNome(crianca.name) || 'uma criança';
    await db.collection('notifications').add({
      userId: crianca.adminUid,
      type: 'pedido_de_acesso',
      childId: crianca.id,
      title: `${quem} pediu acesso a ${filho}`,
      body: 'Confira se é o responsável e aprove no Início.',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  return true;
}

function makePedirAcessoPeloTelefone(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('permission-denied', 'Entre com Google ou e-mail.');
    }
    const telefone = String(request.data?.telefone || '');
    const chave = chaveDoTelefone(telefone);
    if (!chave) throw new HttpsError('invalid-argument', 'WhatsApp com DDD.');
    // Cinco por conta por dia: quem corrige o número uma ou duas vezes passa
    // folgado; quem testa a lista telefônica, não.
    if (!(await limite.consumir(db, REGRAS.PEDIDO_DE_ACESSO, uid))) {
      throw new HttpsError('resource-exhausted', MENSAGEM_DE_LIMITE);
    }
    const nome = String(request.data?.nome || request.auth.token?.name || '').trim().slice(0, 80);
    const email = String(request.auth.token?.email || '').toLowerCase();

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const existente = userSnap.exists ? userSnap.data() : null;
    // Mesma trava do `redeemInvite`: motorista e dono não viram responsável.
    if (existente?.role && existente.role !== 'parent') {
      throw new HttpsError('failed-precondition', 'Esta conta já é de motorista.');
    }

    await userRef.set(
      {
        role: 'parent',
        ...(existente ? {} : { name: nome, email, createdAt: FieldValue.serverTimestamp() }),
        ...(existente?.phone ? {} : { phone: chave }),
        ...(existente?.childIds ? {} : { childIds: [] }),
        telefoneAguardandoChave: chave,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ⚠️ PELA CHAVE DO TELEFONE, NÃO PELA PLATAFORMA (03/10/2026). Era a
    // consulta por `parentUid` nulo, sem limite: TODA criança sem
    // responsável da plataforma, a cada chamada — numa base de 3.000
    // crianças, centenas de leituras para achar uma ou duas, e numa callable
    // que qualquer conta recém-criada dispara.
    //
    // `parentPhoneChave` é `chaveDoTelefone(parentPhone)`, gravado pelo app
    // ao cadastrar e ao editar o telefone (childrenService), e completado nas
    // crianças antigas pela varredura diária dos convites
    // (`enviarAvisosDoDia.varrerConvites`). Campo único, índice automático.
    //
    // ⚠️ A CHAVE GRAVADA NÃO É CONFIADA: quem escreve é o cliente do
    // motorista. `criancasQueEsperam` recalcula a chave do `parentPhone` de
    // cada criança achada e descarta a que já tem responsável — uma chave
    // forjada só faz a criança não ser achada, e o pedido continua passando
    // pela aprovação do motorista.
    //
    // ⚠️ CRIANÇA ANTIGA AINDA SEM CHAVE não é achada até a varredura das 9h
    // passar por ela — uma janela de um dia, uma vez. O pedido não se perde:
    // `telefoneAguardandoChave` fica gravado aqui, e a varredura, ao gravar a
    // chave que faltava, procura quem está esperando por ela e abre o pedido
    // (o mesmo que o gatilho do cadastro faz para criança nova).
    const snap = await db
      .collection('children')
      .where('parentPhoneChave', '==', chave)
      .limit(20)
      .get();
    const achadas = criancasQueEsperam({
      telefone,
      criancas: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
    for (const crianca of achadas) {
      await abrirPedido(db, { crianca, parentUid: uid, nome: nome || existente?.name, telefone });
    }
    logger.info('[pedido] pedido de acesso', { uid, encontrou: achadas.length });
    // A MESMA resposta com ou sem criança achada — ver o cabeçalho.
    return { ok: true };
  });
}

/**
 * O MOTORISTA RESPONDE: aprova (vincula como o link faria) ou "não conheço".
 * O escopo vem do uid dele — só responde pedido de criança dele.
 */
function makeResponderPedidoDeAcesso(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const adminUid = await exigirMotorista(db, request);
    const pedidoId = request.data?.pedidoId;
    const aprovar = request.data?.aprovar === true;
    // O id vira caminho: sem a conferência, uma barra endereçaria outro
    // documento (ver `reguaDosIds.js`).
    if (!idValido(pedidoId)) throw new HttpsError('invalid-argument', 'Qual pedido?');

    const pedidoRef = db.doc(`pedidosDeVinculo/${pedidoId}`);
    const cobrancaOn = await cobrancaLigada(db);

    const pedido = await db.runTransaction(async (tx) => {
      const p = await tx.get(pedidoRef);
      const dados = p.exists ? p.data() : null;
      if (!dados || dados.adminUid !== adminUid) {
        throw new HttpsError('permission-denied', 'Este pedido não é seu.');
      }
      if (dados.status !== 'aguardando') {
        throw new HttpsError('failed-precondition', 'Este pedido já foi respondido.');
      }
      // TODAS AS LEITURAS ANTES DE QUALQUER ESCRITA, mesmo as que a recusa
      // não usa: o Admin SDK lança com leitura depois de escrita, e
      // `testar:transacoes` lê a ordem pelo texto, não pelo caminho.
      const childRef = db.doc(`children/${dados.childId}`);
      const userRef = db.doc(`users/${dados.parentUid}`);
      const relogioRef = db.doc(`users/${adminUid}`);
      const [c, u, relogio] = await Promise.all([
        tx.get(childRef),
        tx.get(userRef),
        tx.get(relogioRef),
      ]);

      if (!aprovar) {
        tx.update(pedidoRef, { status: 'recusado', respondidoEm: FieldValue.serverTimestamp() });
        return dados;
      }
      const nomeDaCrianca = c.exists ? c.data().name : '';
      const crianca = c.exists ? c.data() : null;
      if (!crianca || crianca.adminUid !== adminUid) {
        throw new HttpsError('not-found', 'Criança não encontrada.');
      }
      // O link pode ter chegado antes: quem entrou primeiro venceu.
      if (crianca.parentUid) {
        throw new HttpsError('failed-precondition', 'Esta criança já tem responsável no app.');
      }
      const conta = u.exists ? u.data() : {};
      if (conta.role && conta.role !== 'parent') {
        throw new HttpsError('failed-precondition', 'Esta conta não é de responsável.');
      }

      tx.update(childRef, {
        parentUid: dados.parentUid,
        inviteStatus: 'used',
        inviteUsedAt: FieldValue.serverTimestamp(),
        vinculadoPor: 'aprovacao',
      });
      // O mesmo vínculo do `redeemInvite`. E o número agora está COMPROVADO
      // pelo motorista: vira `phoneChave`, a chave do irmão automático.
      const chave = chaveDoTelefone(crianca.parentPhone);
      tx.set(
        userRef,
        {
          role: 'parent',
          adminUid: conta.adminUid || adminUid,
          adminUids: FieldValue.arrayUnion(adminUid),
          childIds: FieldValue.arrayUnion(dados.childId),
          childId: conta.childId || dados.childId,
          ...(!conta.phoneChave && chave ? { phoneChave: chave } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.update(pedidoRef, { status: 'aprovado', respondidoEm: FieldValue.serverTimestamp() });
      // Uma família entrando é o mesmo gatilho do relógio que o link liga.
      if (cobrancaOn) ligarRelogioComSnap(relogioRef, relogio, 'primeiro responsável', tx);
      return { ...dados, nomeDaCrianca };
    });

    const filho = primeiroNome(pedido.nomeDaCrianca) || 'Seu filho';
    await db.collection('notifications').add({
      userId: pedido.parentUid,
      type: aprovar ? 'acesso_aprovado' : 'acesso_recusado',
      childId: pedido.childId,
      title: aprovar ? `${filho} já aparece no seu app` : 'O motorista não confirmou o acesso',
      body: aprovar
        ? 'O motorista confirmou que você é o responsável.'
        : 'Fale com ele para conferir o número cadastrado.',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  });
}

module.exports = { makePedirAcessoPeloTelefone, makeResponderPedidoDeAcesso, abrirPedido };
