/**
 * Prévia do convite — o que o responsável vê ANTES de ter conta.
 *
 * A ideia do fluxo: o tio manda o link, o pai abre e já entende o que o app
 * é e o que tem lá dentro. Nada de código pra digitar. A primeira AÇÃO
 * (pagar, ler recado, ver detalhe) é que pede a conta.
 *
 * POR QUE ISTO RODA NO SERVIDOR
 * Sem sessão do Firebase não existe nada pras Security Rules autorizarem —
 * uma leitura direta do Firestore seria negada. Aqui o servidor monta um
 * pacote curado e devolve só o que decidimos expor.
 *
 * TRÊS PROPRIEDADES IMPORTANTES
 *   1. Abrir o link NÃO consome o convite. Isso importa de verdade: quando
 *      o tio cola o link no WhatsApp, o WhatsApp busca a URL pra montar o
 *      cartão de prévia. Se abrir consumisse, o robô do WhatsApp gastaria
 *      o convite antes do pai tocar nele.
 *
 *   2. Dado financeiro só aparece pra quem tem direito: convite pendente
 *      (ninguém pegou ainda) ou o próprio responsável já vinculado.
 *
 *   3. O LINK É PERMANENTE, e isto é a propriedade mais importante.
 *      Na prática o pai não guarda o endereço do site nem pede link novo
 *      ao tio: ele volta na conversa do WhatsApp e toca no mesmo link,
 *      pra sempre. Então este endpoint é a porta de entrada do app, não
 *      um passo de cadastro. Se o chamador JÁ é o responsável daquela
 *      criança, devolvemos status "yours" e o app entra direto — sem
 *      tela de erro, sem toque extra.
 *      (Desde 03/10/2026 o convite AINDA NÃO USADO vale 15 dias; o link de
 *      quem já entrou continua permanente.)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
// Formato (só o novo), prazo de 15 dias e a recusa única: `reguaDoConvite.js`.
const {
  normalizarCodigo: normalizeCode,
  codigoValido: isValidCode,
  conviteVencido,
  MENSAGEM_DO_CONVITE_RECUSADO,
} = require('./reguaDoConvite');
const { REGRAS, MENSAGEM_DE_LIMITE } = require('./reguaDasTentativas');
const limite = require('./limiteDeTentativas');

const REGION = 'southamerica-east1';

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthLabel(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTHS[m - 1]} de ${y}`;
}

/**
 * Dados públicos do motorista DESTA criança, pra prévia se apresentar.
 *
 * O `adminUid` vem por parâmetro, da criança do convite. Antes saía de
 * `appState/init` — um ponteiro único pra plataforma inteira —, e com dois
 * parceiros a prévia apresentava o motorista errado a quem estava abrindo o
 * link do WhatsApp pra saber com quem o filho vai andar. É a primeira tela
 * que a família vê, e era a que mais tinha o que acertar.
 */
/**
 * O selo do motorista, ou `null`.
 *
 * ⚠️ ESPELHA `dominio/identidade/verificacao.js`, e o espelho é consciente: o
 * deploy das functions não alcança `src/`. São seis linhas e nenhuma
 * aritmética — a régua inteira ficaria desatualizada aqui, esta não.
 */
function seloDoMotorista(a) {
  if (a?.verificacao !== 'verificada') return null;
  const validade = a?.alvaraValidade?.toDate?.() || null;
  if (validade && validade.getTime() < Date.now()) return null;
  const conferido = a?.verificadoEm?.toDate?.() || null;
  return {
    texto: 'Alvará municipal de transporte escolar conferido',
    conferidoEm: conferido
      ? `${String(conferido.getMonth() + 1).padStart(2, '0')}/${conferido.getFullYear()}`
      : null,
  };
}

async function loadDriver(db, adminUid) {
  try {
    if (!adminUid) return {};
    const adminSnap = await db.doc(`users/${adminUid}`).get();
    if (!adminSnap.exists) return {};
    const a = adminSnap.data();
    return {
      driverFirstName: firstName(a.name),
      // A MARCA é como as famílias o chamam ("Tio Zé"). `companyName` virou o
      // NOME CIVIL do contrato (02/10/2026) e não serve de rótulo: a mãe lia
      // "José Aparecido da Silva te convidou" de alguém que ela chama de Tio Zé.
      marcaNome: a.marcaNome || '',
      companyName: a.companyName || '',
      driverPhotoURL: a.photoURL || null,
      // O SELO — decisão 6, e é aqui que ela encosta na família.
      //
      // Vai só o SELO, nunca o documento: um fato com data ("alvará municipal
      // conferido em 03/2026") em vez do papel com nome, CPF e placa. Mostrar o
      // documento seria distribuir dado de terceiro para resolver um problema
      // que uma frase resolve.
      //
      // ⚠️ A AUSÊNCIA NÃO VIRA AVISO. Quem não enviou o alvará não é suspeito —
      // o modelo inteiro parte de que esta família JÁ conhece este motorista
      // offline; a plataforma não apresenta ninguém a ninguém. Um alerta ali
      // cobraria dela uma desconfiança que não é dela, e faria a plataforma de
      // avalista de quem ela não conhece. A pressão é social: quem tem, exibe.
      //
      // Vencido some sozinho: `alvaraValidade` decide, não o campo de estado.
      // Sem isso o selo diria "conferido" três anos depois, e aí ele passaria a
      // afirmar uma coisa falsa — pior do que não existir.
      selo: seloDoMotorista(a),
    };
  } catch (err) {
    logger.warn('getInvitePreview: falha ao ler motorista', err);
    return {};
  }
}

/**
 * A mensalidade em aberto mais próxima do vencimento.
 *
 * É o gancho da prévia: é a conta DELE, é concreta, e é o motivo mais forte
 * pra criar a conta. Devolve valor, mês e dias até vencer — nada de
 * histórico, nada de outros meses.
 */
/*
 * ⚠️ SÓ AS EM ABERTO, E POUCAS (03/10/2026). Era `where('childId')` sem
 * limite: TODAS as mensalidades da criança, pagas inclusive — com a retenção
 * de 60 meses, até 60 leituras por chamada, numa callable PÚBLICA. Agora são
 * duas igualdades (`pending` e `claimed`, os dois estados que não são
 * `paid`), servidas por índices de campo único, com teto.
 *
 * O teto não esconde a mais antiga: sem `orderBy`, o Firestore devolve pelo
 * id, e o id é `{criança}_{AAAA-MM}` (billing.js) — os meses mais antigos vêm
 * primeiro, que é justamente a que a prévia mostra.
 */
const TETO_DE_ABERTAS = 6;

async function loadNextPayment(db, childId) {
  try {
    const snaps = await Promise.all(
      ['pending', 'claimed'].map((status) =>
        db
          .collection('payments')
          .where('childId', '==', childId)
          .where('status', '==', status)
          .limit(TETO_DE_ABERTAS)
          .get()
      )
    );

    const open = snaps
      .flatMap((s) => s.docs)
      .map((d) => d.data())
      .filter((p) => p.status !== 'paid')
      .map((p) => ({
        amount: Number(p.amount) || 0,
        month: p.month || '',
        status: p.status || 'pending',
        dueMs: p.dueDate?.toMillis?.() || null,
      }))
      .filter((p) => p.dueMs)
      .sort((a, b) => a.dueMs - b.dueMs);

    if (!open.length) return null;
    const next = open[0];
    const days = Math.ceil((next.dueMs - Date.now()) / 86400000);
    return {
      amount: next.amount,
      monthLabel: monthLabel(next.month),
      dueMs: next.dueMs,
      daysUntilDue: days,
      overdue: days < 0,
    };
  } catch (err) {
    logger.warn('getInvitePreview: falha ao ler pagamentos', err);
    return null;
  }
}

/**
 * Quantos recados esperam por ele — e a data do mais recente.
 *
 * Deliberadamente SEM o conteúdo: um recado pode falar de saúde da criança
 * ou de outra família. O número cria o motivo pra entrar; o texto fica atrás
 * da conta.
 */
/*
 * ⚠️ CONTADO NO SERVIDOR, E SÓ DO MOTORISTA DESTA CRIANÇA (03/10/2026).
 *
 * Eram duas leituras SEM LIMITE, e a segunda era de toda a plataforma: os
 * recados de escola de TODOS os motoristas cujo `schoolName` batesse com o
 * desta criança. Numa escola grande, dez peruas somavam os avisos umas das
 * outras — a mãe lia "12 recados esperando você" sobre recados que o
 * motorista dela nunca mandou e que ela nunca vai ver lá dentro (as rules e
 * `watchParentAgenda` escopam por `adminUid`). E cada chamada desta callable
 * PÚBLICA pagava a leitura de todos eles.
 *
 * Agora as duas consultas levam `adminUid` (igualdades, índices de campo
 * único) e usam `count()`: uma leitura por mil documentos, nenhum documento
 * trafega. As duas são disjuntas — recado de criança é `scope: 'child'` —,
 * então a soma não conta nada duas vezes.
 *
 * `latestMs` volta sempre `null`: saber o mais recente exigiria ler os
 * documentos (ou um índice composto com `createdAt`), e nenhuma tela o lê —
 * `Invite.jsx` usa só `count`.
 */
async function loadNoticeSummary(db, child) {
  try {
    if (!child.adminUid) return { count: 0, latestMs: null };
    const queries = [
      db
        .collection('agendaEntries')
        .where('adminUid', '==', child.adminUid)
        .where('childId', '==', child.id)
        .count()
        .get(),
    ];
    if (child.school) {
      queries.push(
        db
          .collection('agendaEntries')
          .where('adminUid', '==', child.adminUid)
          .where('scope', '==', 'school')
          .where('schoolName', '==', child.school)
          .count()
          .get()
      );
    }
    const snaps = await Promise.all(queries);
    const count = snaps.reduce((soma, s) => soma + (Number(s.data().count) || 0), 0);
    return { count, latestMs: null };
  } catch (err) {
    // A PRÉVIA NÃO CAI POR CAUSA DO CONTADOR — mas o log tem que dizer POR QUE
    // ele zerou, e antes não dizia.
    //
    // O comentário anterior era "índice faltando não deve derrubar a prévia",
    // e ele mandou uma auditoria concluir que este contador estava
    // permanentemente em zero. Não estava: as duas consultas acima são
    // IGUALDADES SEM `orderBy`, e o Firestore serve isso por merge join de
    // índices de campo único — não existe índice composto a faltar aqui.
    // Comentário que nomeia a causa errada custa mais que comentário nenhum.
    //
    // O que realmente pode zerar o contador é o casamento de texto:
    // `children.school` contra `agendaEntries.schoolName`, os dois digitados à
    // mão. Grafia diferente devolve zero SEM erro, e nem chega neste `catch`.
    const semIndice = err?.code === 9 || /index/i.test(err?.message || '');
    logger.warn('getInvitePreview: falha ao contar recados', {
      causa: semIndice ? 'consulta sem índice' : 'erro de leitura',
      escola: child.school || null,
      erro: err?.message || String(err),
    });
    return { count: 0, latestMs: null };
  }
}

/**
 * getInvitePreview — chamável sem autenticação.
 *
 * Retorna { status, childFirstName, driver..., nextPayment, notices }.
 *   'pending' → ninguém pegou ainda e está no prazo: a prévia completa
 *   'yours'   → o chamador JÁ é o responsável: o app entra direto
 *
 * ⚠️ O 'taken' SAIU (03/10/2026). Ele respondia "vinculado a outra conta" com
 * o primeiro nome da criança e o motorista — para qualquer um, sem login.
 * Quem varria códigos ganhava, a cada acerto, a confirmação e um nome. Agora
 * inexistente, removido, vinculado a outra conta e vencido recebem a MESMA
 * recusa (`not-found` com a mensagem de `reguaDoConvite.js`), e a tela
 * oferece "entrar com sua conta" a quem já entrou antes.
 *
 * ⚠️ O 'yours' NÃO VENCE: para a família já vinculada, este link é a porta de
 * volta ao app, pra sempre. O prazo de 15 dias é do convite AINDA NÃO USADO.
 *
 * ⚠️ PÚBLICA, ENTÃO CONTADA POR IP: 30 códigos que não abriram por hora
 * (`REGRAS.CONVITE_PUBLICO`). Só a recusa conta — a mãe que reabre o link toda
 * semana nunca encosta no limite, mesmo atrás do IP da operadora.
 */
function makeGetInvitePreview(db) {
  return onCall({ ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.PUBLICO }, async (request) => {
    const quem = limite.quemPeloIp(request.rawRequest);
    if (!(await limite.aindaCabe(db, REGRAS.CONVITE_PUBLICO, quem))) {
      throw new HttpsError('resource-exhausted', MENSAGEM_DE_LIMITE);
    }
    const recusar = async () => {
      await limite.contar(db, REGRAS.CONVITE_PUBLICO, quem);
      return new HttpsError('not-found', MENSAGEM_DO_CONVITE_RECUSADO);
    };

    const code = normalizeCode(request.data?.code);
    if (!isValidCode(code)) throw await recusar();

    // Busca SEM filtrar por inviteStatus: o convite já usado ainda é a porta
    // de volta de quem o usou ('yours').
    const snap = await db
      .collection('children')
      .where('inviteCode', '==', code)
      .limit(1)
      .get();
    if (snap.empty) throw await recusar();

    const childDoc = snap.docs[0];
    const child = { id: childDoc.id, ...childDoc.data() };
    // Criança removida da turma: o link antigo não abre mais nada (02/10/2026).
    if (child.active === false) throw await recusar();

    const callerUid = request.auth?.uid || null;
    const claimed = child.inviteStatus !== 'pending' || !!child.parentUid;

    if (claimed) {
      // O chamador é o próprio responsável? Chamadas autenticadas trazem
      // request.auth, então dá pra saber. Este é o caminho da SEGUNDA
      // sessão em diante — e é o mais percorrido de todos, porque o link
      // do WhatsApp é o que o pai guarda pra sempre.
      if (!callerUid || child.parentUid !== callerUid) throw await recusar();
      const [driver, nextPayment, notices] = await Promise.all([
        loadDriver(db, child.adminUid),
        loadNextPayment(db, child.id),
        loadNoticeSummary(db, child),
      ]);
      return {
        status: 'yours',
        childId: child.id,
        childFirstName: firstName(child.name),
        childGender: child.gender || null,
        ...driver,
        monthlyFee: Number(child.monthlyFee) || 0,
        nextPayment,
        notices,
      };
    }

    // Ainda não usado, mas fora do prazo de 15 dias.
    if (conviteVencido(child, Date.now())) throw await recusar();

    const [driver, nextPayment, notices] = await Promise.all([
      loadDriver(db, child.adminUid),
      loadNextPayment(db, child.id),
      loadNoticeSummary(db, child),
    ]);

    return {
      status: 'pending',
      childFirstName: firstName(child.name),
      childGender: child.gender || null,
      ...driver,
      // Mensalidade combinada, pra quando ainda não existe cobrança gerada.
      monthlyFee: Number(child.monthlyFee) || 0,
      nextPayment,
      notices,
    };
  });
}

module.exports = { makeGetInvitePreview };
