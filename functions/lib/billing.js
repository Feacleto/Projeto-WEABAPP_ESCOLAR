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
const { exigirMotorista } = require('./papeis');
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
 *
 * `adminUid` OPCIONAL, E A DIFERENÇA IMPORTA:
 *   - ausente  → a plataforma inteira. É o modo da AGENDADA, e é o certo pra
 *                ela: ninguém dispara, e todo parceiro precisa ser faturado.
 *   - presente → só a base daquele motorista. É o modo do disparo MANUAL.
 *
 * Sem o parâmetro, `runBillingNow` fazia um parceiro gerar a cobrança dos
 * outros: as duas consultas abaixo não tinham filtro de dono, e o gate da
 * callable era `role === 'admin'` — que neste projeto significa QUALQUER
 * motorista. Um toque no botão escrevia na base alheia, e o log não
 * distinguia quem pediu de quem foi cobrado.
 */
async function generateForMonth(db, monthKey, adminUid = null) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) {
    throw new HttpsError('invalid-argument', 'monthKey inválido (use "YYYY-MM").');
  }

  let criancas = db.collection('children').where('active', '==', true);
  let pagamentos = db.collection('payments').where('month', '==', monthKey);
  if (adminUid) {
    criancas = criancas.where('adminUid', '==', adminUid);
    pagamentos = pagamentos.where('adminUid', '==', adminUid);
  }

  const [childrenSnap, existingSnap] = await Promise.all([
    criancas.get(),
    pagamentos.get(),
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

    // O ID É `{criança}_{mês}`, E É ELE QUE GARANTE "UMA COBRANÇA POR MÊS".
    //
    // Era `doc()` — id aleatório — e a idempotência que o cabeçalho promete
    // vinha de CONSULTAR ANTES DE CRIAR. Entre a leitura da linha 59 e o
    // commit não há nada: duas execuções concorrentes (a agendada das 6h mais
    // um `runBillingNow`, ou o retry do Scheduler sobre um commit parcial)
    // leem o mesmo `existing` vazio e criam DUAS cobranças da mesma criança no
    // mesmo mês. E `paymentsService.js` afirma ao usuário, com essas palavras,
    // que "chamar isto nunca duplica nada".
    //
    // `create()` em vez de `set()`: com id determinístico, `set` sobrescreveria
    // — e sobrescrever uma cobrança já PAGA a devolveria para `pending`. Aqui
    // a segunda tentativa precisa falhar, não vencer.
    //
    // O `existing` continua, mas mudou de papel: era a garantia, virou
    // otimização (evita o erro no caminho comum). A garantia é o id.
    //
    // É o padrão que a casa já usa em cinco coleções: rides/{data},
    // faturasParceiro/{uid}_{mes}, entryBonuses/{uid},
    // absenceDeclarations/{dia}_{criança}, notifications/confirm_{dia}_{criança}.
    batch.create(db.collection('payments').doc(`${childDoc.id}_${monthKey}`), {
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

  // EM LAÇO, COM TETO — e não uma leitura só.
  //
  // Era `.get()` sem `limit()`, e o corte em lotes de 400 protegia só a
  // ESCRITA: o `.get()` já tinha materializado a cauda inteira em memória.
  // Com 20 crianças isso são 20 documentos. Com mil, é a base de um mês
  // inteiro por dia — e qualquer janela em que a função tenha ficado sem
  // rodar (deploy, falha do agendador) multiplica isso até ela morrer por
  // memória sem apagar nada.
  let apagados = 0;
  for (;;) {
    const snap = await db
      .collection('payments')
      .where('month', '<', cutoffKey)
      .limit(BATCH_LIMIT)
      .get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    apagados += snap.docs.length;

    // Lote incompleto significa que acabou — evita uma consulta extra.
    if (snap.docs.length < BATCH_LIMIT) break;
  }
  return { deleted: apagados, cutoffKey };
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
    // O ESCOPO SAI DO CHAMADOR, NUNCA DO PAYLOAD.
    // `exigirMotorista` devolve o uid autenticado — é ele que limita a
    // geração à base deste parceiro. Aceitar um `adminUid` vindo do
    // `request.data` seria devolver exatamente o furo que isto fecha.
    const uid = await exigirMotorista(db, request);

    const monthKey = request.data?.monthKey || monthKeyOf(new Date());
    return await generateForMonth(db, monthKey, uid);
  });
}

module.exports = {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
  generateForMonth,
  purgeOld,
};
