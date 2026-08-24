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
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');

const REGION = 'southamerica-east1';

const NEW_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const LEGACY_RE = /^[A-Z]{2}\d{4}$/;
const NEW_RE = new RegExp('^[A-Z]{2}[' + NEW_ALPHABET + ']{6}$');

function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidCode(code) {
  return LEGACY_RE.test(code) || NEW_RE.test(code);
}

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

/** Dados públicos do motorista, pra prévia se apresentar. */
async function loadDriver(db) {
  try {
    const initSnap = await db.doc('appState/init').get();
    const adminUid = initSnap.exists ? initSnap.data().adminUid : null;
    if (!adminUid) return {};
    const adminSnap = await db.doc(`users/${adminUid}`).get();
    if (!adminSnap.exists) return {};
    const a = adminSnap.data();
    return {
      driverFirstName: firstName(a.name),
      companyName: a.companyName || '',
      driverPhotoURL: a.photoURL || null,
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
async function loadNextPayment(db, childId) {
  try {
    const snap = await db
      .collection('payments')
      .where('childId', '==', childId)
      .get();

    const open = snap.docs
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
async function loadNoticeSummary(db, child) {
  try {
    const queries = [
      db.collection('agendaEntries').where('childId', '==', child.id).get(),
    ];
    if (child.school) {
      queries.push(
        db
          .collection('agendaEntries')
          .where('scope', '==', 'school')
          .where('schoolName', '==', child.school)
          .get()
      );
    }
    const snaps = await Promise.all(queries);

    const seen = new Set();
    let count = 0;
    let latestMs = null;
    for (const snap of snaps) {
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        count += 1;
        const ms = doc.data().createdAt?.toMillis?.() || null;
        if (ms && (!latestMs || ms > latestMs)) latestMs = ms;
      }
    }
    return { count, latestMs };
  } catch (err) {
    // Índice faltando não deve derrubar a prévia inteira.
    logger.warn('getInvitePreview: falha ao contar recados', err);
    return { count: 0, latestMs: null };
  }
}

/**
 * getInvitePreview — chamável sem autenticação.
 *
 * Retorna { status, childFirstName, driver..., nextPayment, notices }.
 *   'pending' → ninguém pegou ainda: mostra a prévia completa
 *   'yours'   → o chamador JÁ é o responsável: o app entra direto
 *   'taken'   → vinculado a outra conta: manda pro login, sem alarme
 */
function makeGetInvitePreview(db) {
  return onCall({ region: REGION }, async (request) => {
    const code = normalizeCode(request.data?.code);
    if (!isValidCode(code)) {
      throw new HttpsError('invalid-argument', 'Código em formato inválido.');
    }

    // Busca SEM filtrar por inviteStatus: precisamos distinguir "não existe"
    // de "já foi usado" pra saber qual tela mostrar ao pai que volta no link.
    const snap = await db
      .collection('children')
      .where('inviteCode', '==', code)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new HttpsError('not-found', 'Convite não encontrado.');
    }

    const childDoc = snap.docs[0];
    const child = { id: childDoc.id, ...childDoc.data() };
    const driver = await loadDriver(db);

    const callerUid = request.auth?.uid || null;
    const claimed = child.inviteStatus !== 'pending' || !!child.parentUid;

    if (claimed) {
      // O chamador é o próprio responsável? Chamadas autenticadas trazem
      // request.auth, então dá pra saber. Este é o caminho da SEGUNDA
      // sessão em diante — e é o mais percorrido de todos, porque o link
      // do WhatsApp é o que o pai guarda pra sempre.
      if (callerUid && child.parentUid === callerUid) {
        const [nextPayment, notices] = await Promise.all([
          loadNextPayment(db, child.id),
          loadNoticeSummary(db, child),
        ]);
        return {
          status: 'yours',
          childId: child.id,
          childFirstName: firstName(child.name),
          ...driver,
          monthlyFee: Number(child.monthlyFee) || 0,
          nextPayment,
          notices,
        };
      }

      // Vinculado a outra conta (ou chamador sem login). Sem dado
      // financeiro: não temos como saber se é o responsável.
      return {
        status: 'taken',
        childFirstName: firstName(child.name),
        ...driver,
        nextPayment: null,
        notices: { count: 0, latestMs: null },
      };
    }

    const [nextPayment, notices] = await Promise.all([
      loadNextPayment(db, child.id),
      loadNoticeSummary(db, child),
    ]);

    return {
      status: 'pending',
      childFirstName: firstName(child.name),
      ...driver,
      // Mensalidade combinada, pra quando ainda não existe cobrança gerada.
      monthlyFee: Number(child.monthlyFee) || 0,
      nextPayment,
      notices,
    };
  });
}

module.exports = { makeGetInvitePreview };
