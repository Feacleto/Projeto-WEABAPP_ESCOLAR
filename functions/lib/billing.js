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
const { ligarRelogio } = require('./relogioDoTeste');
const LIMITES = require('./limites');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';
const FALLBACK_DUE_DAY = 10;
/**
 * ⚠️ 60 MESES, E O NÚMERO VEM DA POLÍTICA DE PRIVACIDADE — NÃO O CONTRÁRIO.
 *
 * Era 12, e a seção 8 da Política promete, com estas palavras: "dados
 * financeiros podem ser retidos pelo prazo de 5 (cinco) anos para cumprimento
 * de obrigações fiscais e contábeis (art. 16, II da LGPD)".
 *
 * Ou seja: o app apagava em 12 meses o que o documento diz guardar por 5 anos.
 * Das duas versões, a que vale contra a plataforma é a ESCRITA — e a outra
 * apagava justamente a prova de que a obrigação fiscal foi cumprida.
 *
 * O custo prático de guardar é irrisório (uma linha por criança por mês), e o
 * custo de ter apagado aparece na pior hora: numa conversa sobre atraso, num
 * pedido de titular, ou numa conferência fiscal.
 *
 * Havia um segundo defeito no mesmo lugar: a varredura não filtra `status`,
 * então ela apagava mensalidade PAGA — com `receiptHash` e trilha de eventos —
 * sem nenhum export antes. Com 60 meses isso deixa de morder no primeiro ano,
 * mas continua sendo o que precisa de export quando o prazo chegar.
 *
 * SE ESTE NÚMERO MUDAR, a seção 8 da Política muda na mesma alteração. Os dois
 * já discordaram uma vez.
 */
const RETENTION_MONTHS = 60;
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

  // Um relógio por motorista, não um por criança: numa perua de 25, seriam 25
  // leituras do mesmo documento para gravar o mesmo campo uma vez.
  const relogiosLigados = new Set();
  let withoutParent = 0;
  let withoutFee = 0;
  // ⚠️ AS ESCRITAS VÃO PARA UMA FILA, NÃO DIRETO PARA O BATCH.
  //
  // `batch.create()` sobre um id que já existe REJEITA, e o commit é atômico:
  // um único documento fora do formato levava até 400 mensalidades com ele. O
  // filtro `existing` só protege quando o pagamento tem o campo `month`
  // daquele mês — e o `docs/testes.md` chega a ensinar a criar pagamentos à
  // mão pelo console, sem esse campo.
  //
  // Para o motorista a falha era muda: ele abria o Financeiro e o mês estava
  // vazio. O Scheduler retentava duas vezes e falhava igual.
  //
  // A fila permite o que o batch não permite: quando o lote falha, cada item
  // é tentado sozinho, e só o documento problemático fica de fora. O id
  // determinístico continua sendo a garantia de "uma cobrança por mês" — o
  // que faltava era não deixar um documento levar 399.
  const fila = [];

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
    // faturasParceiro/{uid}_{mes},
    // absenceDeclarations/{dia}_{criança}, notifications/confirm_{dia}_{criança}.
    fila.push({
      ref: db.collection('payments').doc(`${childDoc.id}_${monthKey}`),
      dados: {
        adminUid: child.adminUid,
        childId: childDoc.id,
        childName: child.name || '', // denormalizado pra evitar join na leitura
        parentUid: child.parentUid,
        month: monthKey,
        amount: fee,
        // MEIO-DIA, E NAO MEIA-NOITE. As functions rodam em UTC — nao ha `TZ`
        // no `firebase.json` nem no `package.json`, e o `timeZone` do
        // `onSchedule` governa so o gatilho, nunca o `new Date()` de dentro.
        //
        // A 00:00, um vencimento combinado para o dia 10 nascia
        // `2026-10-10T00:00Z`, que no Brasil e 09/10 as 21h: a tela do
        // responsavel imprimia "Vence: 09/10", `statusPagamento` o marcava
        // atrasado 27 horas cedo, e o e-mail de "vence hoje" — que usa outra
        // conta, com `startOfDay` em UTC — disparava no dia 10. A tela e o
        // e-mail discordavam sobre a mesma data.
        //
        // `dataDeVencimento` da taxa ja fazia certo, com este mesmo comentario.
        // O CLAUDE.md chegou a afirmar que este arquivo tambem fazia.
        dueDate: admin.firestore.Timestamp.fromDate(
          new Date(year, month - 1, safeDueDay, 12, 0, 0)
        ),
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      childId: childDoc.id,
    });
    // ⚠️ O TERCEIRO GATILHO DO RELÓGIO DO TESTE (06/09/2026).
    //
    // Gerar mensalidade é o dinheiro dele passando por aqui — é uso do
    // produto, tanto quanto rodar a rota. Sem este gatilho, um motorista
    // cobrava as famílias pelo app para sempre sem nunca entrar no relógio.
    //
    // FORA DO BATCH de propósito: o batch é da COBRANÇA, e uma falha ao ligar
    // o relógio não pode fazer a mensalidade do mês não existir. `ligarRelogio`
    // engole o próprio erro pelo mesmo motivo.
    //
    // O `Set` evita reler o doc do mesmo motorista uma vez por criança — numa
    // perua de 25, seriam 25 leituras do mesmo documento para gravar um campo.
    if (!relogiosLigados.has(child.adminUid)) {
      relogiosLigados.add(child.adminUid);
      await ligarRelogio(db, child.adminUid, 'primeira mensalidade');
    }

  }

  // `created` vem de quem grava, não de um contador do laço: enfileirar não é
  // criar, e a diferença entre os dois é exatamente o que o lote pode recusar.
  const { criadas: created, recusadas } = await gravarEmLotes(db, fila);

  if (recusadas.length) {
    logger.error('[cobranca] mensalidades recusadas', {
      monthKey,
      quantas: recusadas.length,
      // Os ids importam: quase sempre é documento fora do formato que já
      // ocupa o id determinístico, e é preciso saber qual para consertar.
      ids: recusadas.slice(0, 20).map((r) => r.id),
      primeiroErro: recusadas[0]?.erro || null,
    });
  }

  return {
    monthKey,
    created,
    skipped: existing.size,
    withoutParent,
    withoutFee,
    recusadas: recusadas.length,
  };
}

/**
 * GRAVA A FILA EM LOTES, E DEGRADA PARA ITEM A ITEM QUANDO UM LOTE CAI.
 *
 * O caminho comum é um commit por 400 mensalidades. O caminho ruim é um
 * documento já ocupando o id determinístico com formato divergente: aí o lote
 * inteiro é rejeitado, e cada item é retentado sozinho para que apenas o
 * problemático fique de fora.
 *
 * ⚠️ NÃO troque `create` por `set` no caminho de degradação. `set`
 * sobrescreveria — e sobrescrever uma cobrança já PAGA a devolve para
 * `pending`. Aqui a segunda tentativa precisa FALHAR, não vencer.
 */
async function gravarEmLotes(db, fila) {
  let criadas = 0;
  const recusadas = [];

  for (let i = 0; i < fila.length; i += BATCH_LIMIT) {
    const pedaco = fila.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const item of pedaco) batch.create(item.ref, item.dados);

    try {
      await batch.commit();
      criadas += pedaco.length;
    } catch (erroDoLote) {
      logger.warn('[cobranca] lote recusado, tentando uma a uma', {
        tamanho: pedaco.length,
        erro: erroDoLote?.message || String(erroDoLote),
      });
      for (const item of pedaco) {
        try {
          await item.ref.create(item.dados);
          criadas += 1;
        } catch (erro) {
          recusadas.push({
            id: item.ref.id,
            childId: item.childId,
            erro: erro?.message || String(erro),
          });
        }
      }
    }
  }

  return { criadas, recusadas };
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
      maxInstances: LIMITES.AGENDADO,
      // Varredura da plataforma + purgeOld na mesma execução — ver limites.js.
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
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
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
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
