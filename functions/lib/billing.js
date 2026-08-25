/**
 * Geração e retenção de mensalidades — no servidor.
 *
 * POR QUE SAIU DO CLIENTE
 * Isto rodava no hook useAutoBilling, disparado quando o tio abria o app,
 * com uma trava em localStorage. Duas consequências:
 *   - mês em que ele não abrisse o app, NINGUÉM era cobrado;
 *   - `cleanOldPayments` era uma exclusão em massa disparada sem confirmação
 *     no carregamento da tela — e se o localStorage fosse limpo (modo
 *     privado, troca de aparelho, cache limpo), rodava de novo.
 *
 * Aqui as duas coisas acontecem uma vez por dia, independentes de alguém
 * abrir o aplicativo, e a exclusão fica registrada no log.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';
const FALLBACK_DUE_DAY = 10;
const RETENTION_MONTHS = 12;
const BATCH_LIMIT = 400;

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Cria as mensalidades do mês pra toda criança ativa que ainda não tem.
 * Idempotente: consulta o que já existe antes de criar.
 */
async function generateForMonth(db, monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) {
    throw new HttpsError('invalid-argument', 'monthKey inválido (use "YYYY-MM").');
  }

  const [childrenSnap, existingSnap] = await Promise.all([
    db.collection('children').where('active', '==', true).get(),
    db.collection('payments').where('month', '==', monthKey).get(),
  ]);

  const existing = new Set(existingSnap.docs.map((d) => d.data().childId));
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  let created = 0;
  let withoutParent = 0;
  let withoutFee = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const childDoc of childrenSnap.docs) {
    const child = childDoc.data();
    if (existing.has(childDoc.id)) continue;
    // Criança sem responsável vinculado não tem pra quem cobrar.
    if (!child.parentUid) {
      withoutParent += 1;
      continue;
    }

    // Mensalidade sem valor NÃO gera cobrança.
    //
    // O campo é opcional de propósito no cadastro (o tio salva a criança
    // no meio da rota e completa depois). Mas gerar cobrança de R$ 0,00
    // era pior que não gerar: o pai via "nada a pagar" num mês que devia,
    // e o tio não recebia sem nenhum aviso de que faltava configurar.
    const fee = Number(child.monthlyFee) || 0;
    if (fee <= 0) {
      withoutFee += 1;
      continue;
    }

    const dueDay = Number(child.dueDay) || FALLBACK_DUE_DAY;
    // Clampa pro último dia do mês: dia 31 em fevereiro viraria março.
    const safeDueDay = Math.min(Math.max(1, dueDay), lastDayOfMonth);

    // SEM `adminUid` O PAGAMENTO NASCE ÓRFÃO — e o aviso já estava escrito.
    //
    // `firestore.rules` avisa, em maiúsculas, que a geração de mensalidade
    // precisa gravar este campo. A geração voltou a rodar e o campo não veio.
    // As quatro consultas do motorista filtram por ele, então a mensalidade
    // gerada pelo servidor é INVISÍVEL pra quem tem que receber: o pai vê a
    // cobrança (a consulta dele é por `parentUid`), o motorista abre o
    // Financeiro e encontra o mês vazio. Sem erro no console — o pior
    // formato de falha que existe.
    //
    // E não dá nem pra dar baixa: o `allow update` compara `adminUid` dos
    // dois lados, e comparação sobre chave ausente é erro, e erro nega.
    if (!child.adminUid) {
      logger.warn(
        `Criança sem adminUid, mensalidade NÃO gerada: child=${childDoc.id} mes=${monthKey}`
      );
      continue;
    }

    batch.set(db.collection('payments').doc(), {
      adminUid: child.adminUid,
      childId: childDoc.id,
      childName: child.name || '', // denormalizado pra evitar join na leitura
      parentUid: child.parentUid,
      month: monthKey,
      amount: fee,
      dueDate: admin.firestore.Timestamp.fromDate(
        new Date(year, month - 1, safeDueDay)
      ),
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    created += 1;
    inBatch += 1;

    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();

  return { monthKey, created, skipped: existing.size, withoutParent, withoutFee };
}

/** Apaga mensalidades mais antigas que a janela de retenção. */
async function purgeOld(db, retentionMonths = RETENTION_MONTHS) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const cutoffKey = monthKeyOf(cutoff);

  const snap = await db
    .collection('payments')
    .where('month', '<', cutoffKey)
    .get();
  if (snap.empty) return { deleted: 0, cutoffKey };

  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return { deleted: snap.docs.length, cutoffKey };
}

/**
 * Roda todo dia às 6h. Diário e não mensal de propósito: criança cadastrada
 * no dia 15 ganha a mensalidade do mês corrente no dia seguinte, sem
 * ninguém precisar lembrar de gerar à mão.
 */
function makeGenerateMonthlyPayments(db) {
  return onSchedule(
    {
      schedule: '0 6 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
    },
    async () => {
      const result = await generateForMonth(db, monthKeyOf(new Date()));
      logger.info('generateMonthlyPayments', result);
      if (result.withoutFee > 0) {
        // Fica no log porque é configuração faltando, não erro do sistema:
        // alguém precisa preencher a mensalidade daquelas crianças.
        logger.warn(
          `${result.withoutFee} criança(s) sem mensalidade configurada — nenhuma cobrança gerada pra elas.`
        );
      }

      const purged = await purgeOld(db);
      if (purged.deleted > 0) {
        logger.info(
          `Retenção: ${purged.deleted} mensalidades anteriores a ${purged.cutoffKey} apagadas.`
        );
      }
    }
  );
}

/** Disparo manual pelo admin — usado pra fechar mês fora de hora. */
function makeRunBillingNow(db) {
  return onCall({ region: REGION }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatório.');

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists || userSnap.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas o motorista responsável.');
    }

    const monthKey = request.data?.monthKey || monthKeyOf(new Date());
    return await generateForMonth(db, monthKey);
  });
}

module.exports = {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
  generateForMonth,
  purgeOld,
};
