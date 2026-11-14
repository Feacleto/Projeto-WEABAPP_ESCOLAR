/**
 * O RESPONSÁVEL SEM LINK PEDE ACESSO, E O MOTORISTA APROVA (02/10/2026).
 *
 * O link continua sendo a porta principal: só quem recebeu a mensagem do
 * motorista o tem. Mas o motorista às vezes cadastra a criança e esquece de
 * mandar. Agora a pessoa entra (Google ou e-mail), informa o WhatsApp, e:
 *
 *   - se o número está numa criança ainda sem responsável, sai um PEDIDO
 *     para o motorista daquela criança, que manda o LINK do convite ao
 *     WhatsApp que ele cadastrou (14/11/2026 — antes, "aprovava");
 *   - se não está em nenhuma, ela fica com a conta criada e o app pede para
 *     ela chamar o motorista. Quando ele cadastrar a criança com esse
 *     número, o pedido nasce sozinho (`vincularIrmao.js`).
 *
 * ── ⚠️ O NÚMERO SOZINHO NÃO ABRE NADA, e esta é a decisão inteira
 * Telefone não é segredo: o ex-marido sabe, a vizinha sabe. Se digitar o
 * número bastasse, quem o conhece veria endereço, escola, foto e a perua da
 * criança ao vivo. Por isso aqui nada é vinculado — só se cria o pedido.
 *
 * ⚠️ E A RESPOSTA DO MOTORISTA TAMBÉM NÃO VINCULA (14/11/2026, decisão 28).
 * A "aprovação" era a mesma falha um passo adiante: o motorista via um nome
 * (escolhido pela conta) e um número (que ELE digitou) batendo com o
 * cadastro, e aprovava o ex-companheiro. Agora `responderPedidoDeAcesso` só
 * fecha o pedido, e a tela leva o LINK ao WhatsApp cadastrado: entra quem
 * tem aquele WhatsApp na mão. Sem SMS, sem toque a mais.
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
 * COMPROVADO — pelo link (a aprovação que também a gravava saiu em
 * 14/11/2026). Este campo guarda o número que a
 * pessoa digitou, não comprovado: serve só para gerar pedido quando o
 * motorista cadastrar a criança depois. Os dois são proibidos ao cliente.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');
const { criancasQueEsperam, chaveDoTelefone } = require('./reguaDoIrmao');
const { idValido } = require('./reguaDosIds');
const { REGRAS, MENSAGEM_DE_LIMITE } = require('./reguaDasTentativas');
const limite = require('./limiteDeTentativas');
const { acaoDoPedido, respostaAoPedido } = require('./reguaDoPedidoDeAcesso');

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
    // ⚠️ O NOME DE QUEM PEDIU NÃO ENTRA NO AVISO (14/11/2026): é o nome que
    // a conta ESCOLHEU, e o pedido não se decide mais por ele — o link vai
    // para o WhatsApp que o motorista cadastrou.
    const filho = primeiroNome(crianca.name) || 'uma criança';
    await db.collection('notifications').add({
      userId: crianca.adminUid,
      type: 'pedido_de_acesso',
      childId: crianca.id,
      title: `Pedido de acesso a ${filho}`,
      body: 'Mande o link ao WhatsApp que você cadastrou, no Início.',
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
    // pelo motorista, que só manda o link ao WhatsApp que ele cadastrou.
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
 * O MOTORISTA RESPONDE — e a resposta NUNCA vincula (14/11/2026, decisão 28).
 *
 * Era "Aprovar": a conta que pediu virava responsável da criança. Agora a
 * tela abre o WhatsApp no número que o motorista cadastrou, com o link do
 * convite, e esta callable só FECHA o pedido (`link_enviado`). Quem entra é
 * quem tem aquele WhatsApp, pelo link. "Descartar" continua avisando quem
 * pediu. A decisão é pura e testada: `reguaDoPedidoDeAcesso.js`.
 *
 * O escopo vem do uid dele — só responde pedido de criança dele.
 */
function makeResponderPedidoDeAcesso(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const adminUid = await exigirMotorista(db, request);
    const pedidoId = request.data?.pedidoId;
    const acao = acaoDoPedido(request.data);
    // O id vira caminho: sem a conferência, uma barra endereçaria outro
    // documento (ver `reguaDosIds.js`).
    if (!idValido(pedidoId)) throw new HttpsError('invalid-argument', 'Qual pedido?');

    const pedidoRef = db.doc(`pedidosDeVinculo/${pedidoId}`);

    const resposta = await db.runTransaction(async (tx) => {
      const p = await tx.get(pedidoRef);
      const pedido = p.exists ? p.data() : null;
      // TODAS AS LEITURAS ANTES DE QUALQUER ESCRITA: o Admin SDK lança com
      // leitura depois de escrita, e `testar:transacoes` lê a ordem pelo
      // texto. A conta de quem pediu NÃO é lida: nada nela muda.
      const c = pedido && idValido(pedido.childId)
        ? await tx.get(db.doc(`children/${pedido.childId}`))
        : null;
      const r = respostaAoPedido({
        pedido,
        crianca: c && c.exists ? c.data() : null,
        adminUid,
        acao,
      });
      if (!r.ok) throw new HttpsError(r.codigo, r.erro);
      // A ÚNICA escrita: o estado do pedido. Nada em `children`, nada em
      // `users` — é isso que o teste da régua e o do emulador conferem.
      tx.update(pedidoRef, { status: r.status, respondidoEm: FieldValue.serverTimestamp() });
      return { ...r, pedido };
    });

    if (resposta.avisarQuemPediu) {
      await db.collection('notifications').add({
        userId: resposta.pedido.parentUid,
        type: 'acesso_recusado',
        childId: resposta.pedido.childId,
        title: 'O motorista não confirmou o acesso',
        body: 'Fale com ele para conferir o número cadastrado.',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { ok: true };
  });
}

module.exports = { makePedirAcessoPeloTelefone, makeResponderPedidoDeAcesso, abrirPedido };
