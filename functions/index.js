/**
 * Cloud Functions — envio de lembrete de mensalidade por email.
 *
 * Fluxo:
 *   1. Função agendada roda diariamente (9h da manhã, horário BR).
 *   2. Busca payments com status != 'paid'.
 *   3. Pra cada um, calcula a distância em dias até dueDate e define
 *      qual "milestone" se aplica (reminder_3d, due_today, overdue_3d).
 *   4. Verifica se já enviou esse milestone (campo emailSentMilestones).
 *      Idempotente — não dispara duas vezes.
 *   5. Monta o email com template HTML e envia via Resend.
 *   6. Marca o milestone como enviado no doc do payment.
 *
 * Configuração necessária (1x):
 *   firebase functions:secrets:set RESEND_API_KEY
 *   firebase deploy --only functions
 *
 * Trigger manual pra testar:
 *   firebase functions:shell  (depois) sendPaymentReminders()
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { exigirMotorista } = require('./lib/papeis');
const { makeAsaasWebhook } = require('./lib/asaasWebhook');
const { makeCriarCobrancaDaFatura } = require('./lib/asaasCobranca');
const { makeContratarPlano } = require('./lib/contratacao');
const {
  makeFecharMesDosParceiros,
  makeFecharMesAgora,
} = require('./lib/fechamento');
const { makeEnviarAvisosComerciais } = require('./lib/enviarAvisos');
const { makeCasarNoCadastro } = require('./lib/casarNoCadastro');
const {
  makeLimparCoordenadaDoCheckpoint,
} = require('./lib/limpezaDoCheckpoint');
const { makeApagarViagensAntigas } = require('./lib/retencaoDasViagens');
const { defineSecret, defineString } = require('firebase-functions/params');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./lib/limites');
const admin = require('firebase-admin');

const { buildEmailHtml, buildEmailText, subjectFor } = require('./lib/emailTemplate');
const { emailMandaEm } = require('./lib/canalDaCobranca');
const { sendEmail } = require('./lib/resend');
const {
  makeLookupInvite,
  makeRedeemInvite,
  makeGetShowcase,
} = require('./lib/invites');
const { makeCloseStaleRoutes } = require('./lib/routes');
const { makeSendPushOnNotification } = require('./lib/push');
const { makeConfirmarAusencias } = require('./lib/confirmarAusencias');
const {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
} = require('./lib/billing');
const { makeGetInvitePreview } = require('./lib/invitePreview');
const {
  makeGerarAcessoDoDia,
  makeVerAcompanhamento,
} = require('./lib/acompanhamento');
const {
  makeEnviarAvisosDoDia,
  makeVarrerAtrasos,
  makeVarrerOfertas,
} = require('./lib/enviarAvisosDoDia');
const { makeFlagDuplicateReceipts } = require('./lib/receiptGuard');
const {
  makeBackfillTestimonialPrivacy,
} = require('./lib/privacyBackfill');

admin.initializeApp();
const db = admin.firestore();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Configuração — ajustar se trocar de domínio.
//
// FROM_EMAIL: enquanto não há domínio próprio configurado no Resend,
//   usa o sandbox `onboarding@resend.dev`. Quando configurar domínio
//   (ex: alobuzinou.com.br), trocar pra `cobranca@alobuzinou.com.br`.
//
// APP_URL: URL de produção da hospedagem (Firebase Hosting).
//   Trocar pelo domínio próprio quando configurar.
const FROM_EMAIL = 'Alô Buzinou! <onboarding@resend.dev>';
const APP_URL = 'https://alobuzinou.com';

// Milestones de cobrança (dias em relação ao vencimento).
//   diffDays positivo = ainda falta vencer
//   diffDays zero     = vence hoje
//   diffDays negativo = já venceu
// ⚠️ O DIA DO VENCIMENTO SAIU DAQUI, e não porque o e-mail dele fosse ruim.
//
// Este agendado e o `enviarAvisosDoDia` rodavam às 9h falando da MESMA dívida
// para a MESMA família: e-mail em 3, 0 e −3 dias; push em 5, 3, 0, −3 e −7.
// Nos três marcos do meio ela recebia as duas coisas no mesmo minuto — o
// jeito mais rápido de ensinar alguém a ignorar os dois canais, e o primeiro
// que ela desliga é o que também avisa que a criança chegou.
//
// A divisão mora em `canalDaCobranca.js`, um arquivo só, e é ela que decide.
// O dia do vencimento ficou com o PUSH: é o marco em que só a hora importa, e
// este público lê push muito mais do que e-mail. O e-mail ficou com os dois
// marcos em que ela precisa RESOLVER com o dado na mão — 3 dias antes e 3 de
// atraso —, porque é ele que carrega valor, mês, botão e a chave PIX.
//
// O template `due_today` continua existindo: o disparo manual do dono ainda
// pode usá-lo, e apagá-lo tiraria a peça de quem quiser mandá-la à mão.
const MILESTONES = [
  { key: 'reminder_3d', diffDays: 3 },
  { key: 'overdue_3d', diffDays: -3 },
].filter((m) => emailMandaEm(m.diffDays));

// ===== Helpers =====

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffInDays(due, today) {
  const a = startOfDay(due);
  const b = startOfDay(today);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

function formatMonthLabel(date) {
  if (!date) return '';
  const MONTHS = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${MONTHS[date.getMonth()]}/${date.getFullYear()}`;
}

// ATENÇÃO: as chaves aqui têm que casar com userService.PIX_KEY_TYPES no
// cliente. Antes esta tabela usava 'aleatoria' enquanto o app grava
// 'random', e o email de cobrança saía com o rótulo do tipo em branco.
const PIX_TYPE_LABELS = {
  phone: 'Celular',
  email: 'Email',
  random: 'Chave aleatória',
  // Aceitos por compatibilidade caso o cadastro venha de outra origem.
  cpf: 'CPF',
  cnpj: 'CNPJ',
};

// ===== Lógica principal =====

/**
 * Processa todos os pagamentos pendentes/claimed e envia emails dos
 * milestones aplicáveis. Retorna sumário com contagens.
 */
/**
 * `adminUid` OPCIONAL — mesma divisão de `generateForMonth`:
 * ausente é o modo da AGENDADA (a plataforma inteira, que é o certo pra ela);
 * presente é o disparo MANUAL, limitado à base de quem disparou.
 *
 * Sem isso, o botão de um parceiro mandava e-mail de cobrança para as famílias
 * de todos os outros — e o gate da callable era `role === 'admin'`, que neste
 * projeto significa qualquer motorista.
 */
async function processReminders(apiKey, now = new Date(), adminUid = null) {
  const today = startOfDay(now);

  let consulta = db
    .collection('payments')
    .where('status', 'in', ['pending', 'claimed']);
  if (adminUid) consulta = consulta.where('adminUid', '==', adminUid);
  const paymentsSnap = await consulta.get();

  let evaluated = 0;
  let sent = 0;
  let skipped = 0;
  const errors = [];

  // Cache simples de parents/children/admin pra evitar N reads quando
  // tem várias mensalidades do mesmo pai/criança/admin.
  //
  // `adminCache` É UM MAPA, E NÃO UM SÓ — o motivo vale dinheiro.
  // Ele era `let adminCache = null`, preenchido UMA vez a partir de
  // `appState/init.adminUid` e reusado no laço inteiro. Ou seja: a chave PIX
  // de UM motorista ia no e-mail de cobrança de TODOS os pagamentos da
  // plataforma. Com dois parceiros, o responsável do B recebia a chave do A e
  // pagava nela — o dinheiro ia pra conta errada e nada no sistema saberia.
  //
  // É o mesmo bug que o cliente já tinha consertado e documentado em
  // src/services/userService.js:76-86; a cópia do servidor ficou pra trás.
  const parentCache = new Map();
  const childCache = new Map();
  const adminCache = new Map();

  for (const paymentDoc of paymentsSnap.docs) {
    evaluated += 1;
    try {
      const p = paymentDoc.data();
      const dueDate =
        p.dueDate?.toDate?.() ||
        (p.dueDate ? new Date(p.dueDate) : null);
      if (!dueDate) {
        skipped += 1;
        continue;
      }
      const diff = diffInDays(dueDate, today);
      const milestone = MILESTONES.find((m) => m.diffDays === diff);
      if (!milestone) {
        skipped += 1;
        continue;
      }

      const sentMap = p.emailSentMilestones || {};
      if (sentMap[milestone.key]) {
        skipped += 1;
        continue;
      }

      // Carrega dados do pai (email) — cacheia
      const parentUid = p.parentUid;
      if (!parentUid) {
        skipped += 1;
        continue;
      }
      let parent = parentCache.get(parentUid);
      if (!parent) {
        const ps = await db.doc(`users/${parentUid}`).get();
        if (!ps.exists) {
          skipped += 1;
          continue;
        }
        parent = ps.data();
        parentCache.set(parentUid, parent);
      }
      if (!parent.email) {
        skipped += 1;
        continue;
      }

      // Carrega dados da criança — cacheia
      const childId = p.childId;
      let child = childId ? childCache.get(childId) : null;
      if (!child && childId) {
        const cs = await db.doc(`children/${childId}`).get();
        if (cs.exists) {
          child = cs.data();
          childCache.set(childId, child);
        }
      }

      // Carrega o motorista DESTE pagamento — cacheia por uid.
      //
      // `p.adminUid` é a verdade: billing.js:99 grava e se RECUSA a gerar
      // mensalidade sem ele (:91). `child.adminUid` cobre pagamento antigo,
      // e a criança já foi carregada logo acima. Os dois são por inquilino;
      // `appState/init` saiu daqui e não volta.
      const adminUid = p.adminUid || child?.adminUid || null;
      // ⚠️ `motorista`, NUNCA `admin` — E O NOME ERA UM BUG, NÃO ESTILO.
      //
      // `const admin = require('firebase-admin')` está no topo do arquivo.
      // Um `let admin` aqui sombreia o MÓDULO no bloco inteiro, e a linha que
      // marca a idempotência mais abaixo chama
      // `admin.firestore.FieldValue.serverTimestamp()` — que passava a operar
      // sobre o documento do motorista e era `undefined`.
      //
      // O estrago ficava escondido pela ORDEM: o `TypeError` estourava DEPOIS
      // do `sendEmail`. O e-mail saía, `emailSentMilestones` nunca era
      // gravado, `sent` nunca incrementava, e a função devolvia `sent: 0` com
      // N erros tendo entregue N e-mails. Rodada duas vezes no mesmo dia, a
      // mesma mãe recebia "vence hoje" duas vezes — exatamente a duplicação
      // que o cabeçalho deste arquivo promete impedir.
      //
      // `no-shadow` não está no config do eslint, então o lint não pega.
      let motorista = adminUid ? adminCache.get(adminUid) : null;
      if (!motorista && adminUid) {
        const as = await db.doc(`users/${adminUid}`).get();
        motorista = as.exists ? as.data() : {};
        adminCache.set(adminUid, motorista);
      }
      motorista = motorista || {};

      // Monta payload do template
      const monthLabel = p.monthLabel || formatMonthLabel(dueDate);
      // SEM MOTORISTA RESOLVIDO, SEM CHAVE — e é a falha para o lado certo.
      // O e-mail sai sem o PIX (o template já trata `pixKey: null`) e o
      // responsável cobra o motorista pelo caminho de sempre. Mandar a chave
      // de outra pessoa seria pior que não mandar chave nenhuma.
      const pixKey = motorista.pixKey || null;
      const pixKeyType = pixKey ? PIX_TYPE_LABELS[motorista.pixKeyType] || '' : '';
      const adminName = motorista.name || '';
      const companyName = motorista.companyName || 'Alô Buzinou!';

      const html = buildEmailHtml({
        milestone: milestone.key,
        parentName: parent.name || '',
        childName: child?.name || p.childName || 'sua criança',
        amount: p.amount,
        dueDate,
        monthLabel,
        appUrl: APP_URL,
        pixKey,
        pixKeyType,
        adminName,
        companyName,
      });
      const text = buildEmailText({
        milestone: milestone.key,
        parentName: parent.name || '',
        childName: child?.name || p.childName || 'sua criança',
        amount: p.amount,
        dueDate,
        monthLabel,
        appUrl: APP_URL,
        pixKey,
        adminName,
      });
      const subject = subjectFor(
        milestone.key,
        child?.name || p.childName,
        monthLabel
      );

      await sendEmail({
        apiKey,
        from: FROM_EMAIL,
        to: parent.email,
        subject,
        html,
        text,
      });

      // Marca como enviado pra não duplicar (idempotência).
      // Usa merge pra preservar outros milestones já enviados.
      await paymentDoc.ref.set(
        {
          emailSentMilestones: {
            [milestone.key]: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      sent += 1;
      logger.info(
        `Email enviado: payment=${paymentDoc.id} milestone=${milestone.key} to=${parent.email}`
      );
    } catch (err) {
      errors.push({ paymentId: paymentDoc.id, error: err?.message || String(err) });
      logger.error(`Falha ao processar payment ${paymentDoc.id}:`, err);
    }
  }

  // ⚠️ FALHA TOTAL NÃO É FALHA PONTUAL, E CONCLUIR COM SUCESSO ESCONDIA A
  // PIOR DAS DUAS.
  //
  // Cada erro por pagamento virava uma linha em `errors` e a função concluía
  // bem. Com a chave do Resend errada — e o `docs/deploy.md` chega a
  // recomendar subir `PLACEHOLDER-substitua-…` no primeiro deploy — TODO
  // e-mail falha, o `logger.info` do fim grava um objeto de sucesso, e nada
  // no mundo avisa que ninguém foi cobrado este mês.
  //
  // Erro pontual continua sendo tolerado (um e-mail recusado não pode
  // impedir os outros 40). Erro em TUDO é problema de configuração, e tem
  // que estourar: em function agendada, `throw` é o que produz retentativa e
  // dispara alerta de log.
  if (errors.length > 0 && errors.length === evaluated) {
    const primeiro = errors[0]?.error || 'sem detalhe';
    throw new Error(
      `Nenhum lembrete saiu: ${errors.length} de ${evaluated} falharam. ` +
      `Primeiro erro: ${primeiro}. Confira o segredo RESEND_API_KEY.`
    );
  }

  return { evaluated, sent, skipped, errors };
}

// ===== Cloud Function agendada =====

exports.sendPaymentReminders = onSchedule(
  {
    schedule: '0 9 * * *', // todo dia às 9h
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [RESEND_API_KEY],
    retryCount: 2,
    maxInstances: LIMITES.AGENDADO,
    // Envio em série contra o teto de 60 s — ver limites.js.
    timeoutSeconds: LIMITES.TEMPO_AGENDADO,
    memory: LIMITES.MEMORIA_AGENDADO,
  },
  async () => {
    const apiKey = RESEND_API_KEY.value();
    const result = await processReminders(apiKey);
    logger.info('sendPaymentReminders concluído', result);
  }
);

// ===== Trigger manual (admin-only) pra testar/forçar envio =====

exports.runPaymentRemindersNow = onCall(
  {
    region: 'southamerica-east1',
    secrets: [RESEND_API_KEY],
    maxInstances: LIMITES.AUTENTICADO,
  },
  async (request) => {
    // O ESCOPO SAI DO CHAMADOR. Ver o cabeçalho de `processReminders`: sem
    // ele, o botão de um parceiro disparava e-mail de cobrança para as
    // famílias de todos os outros.
    const uid = await exigirMotorista(db, request);
    const apiKey = RESEND_API_KEY.value();
    return await processReminders(apiKey, new Date(), uid);
  }
);

// ===== Convites e lista de espera (ver functions/lib/invites.js) =====
//
// O resgate de convite saiu do cliente por segurança: as rules precisavam
// liberar leitura de toda criança pendente pra o app achar o código, e a
// landing autentica anonimamente — então qualquer visitante conseguia
// listar as crianças com endereço e telefone dos responsáveis.

exports.lookupInvite = makeLookupInvite(db);
exports.redeemInvite = makeRedeemInvite(db);
exports.getShowcase = makeGetShowcase(db);

// ===== Rota abandonada (ver functions/lib/routes.js) =====
//
// Fecha routeActive quando o motorista some sem encerrar. Sem isto o painel
// do pai mostrava a perua parada no mapa como se fosse a posição atual.

exports.closeStaleRoutes = makeCloseStaleRoutes(db);

// ===== Push (ver functions/lib/push.js) =====
//
// Amarrado na criação de notifications/{id}: todo aviso do app ganha push
// sem que cada caminho precise lembrar de enviar.

exports.sendPushOnNotification = makeSendPushOnNotification(db);

// ===== Confirmação de véspera (ver functions/lib/confirmarAusencias.js) =====
//
// Às 19h pergunta ao responsável se a ausência marcada pra amanhã continua
// valendo. O app já pergunta isso na tela — mas quem esquece de desmarcar é,
// por definição, quem não está abrindo o app.

exports.confirmarAusencias = makeConfirmarAusencias(db);

// ===== Faturamento (ver functions/lib/billing.js) =====
//
// Saiu do cliente: rodava no hook useAutoBilling quando o tio abria o
// app, com trava em localStorage. Mes em que ele nao abrisse, ninguem
// era cobrado — e a limpeza de historico era exclusao em massa disparada
// sem confirmacao no carregamento da tela.

exports.generateMonthlyPayments = makeGenerateMonthlyPayments(db);
exports.runBillingNow = makeRunBillingNow(db);

// ===== Previa do convite (ver functions/lib/invitePreview.js) =====
//
// Chamavel SEM autenticacao: o pai abre o link e ja ve o que o app tem,
// antes de criar conta. Abrir NAO consome o convite — importante porque o
// WhatsApp busca a URL pra montar o cartao de previa.

exports.getInvitePreview = makeGetInvitePreview(db);

/* ══ O LINK DO DIA ═══════════════════════════════════════════════════════
 * Quem vai pegar a criança hoje acompanha a entrega sem ter conta. As duas
 * pontas e o porquê de cada decisão estão em `lib/acompanhamento.js`; a régua
 * pura (o que pode ser visto, e se o link ainda vale) está em
 * `lib/reguaDoAcompanhamento.js`, que não requer nada de propósito. */
exports.gerarAcessoDoDia = makeGerarAcessoDoDia(db);
exports.verAcompanhamento = makeVerAcompanhamento(db);

// ===== Comprovante reusado (ver functions/lib/receiptGuard.js) =====
//
// Nao verifica se o pagamento existiu — so a conciliacao com o extrato do
// banco faz isso. Detecta DUPLICATA: o mesmo arquivo em dois meses. E o
// resultado e um aviso pro tio, nao um bloqueio.

exports.flagDuplicateReceipts = makeFlagDuplicateReceipts(db);

// ===== Backfill de privacidade (ver functions/lib/privacyBackfill.js) =====
//
// O commit e005363 fechou a ESCRITA de nome completo e foto sem consentimento
// no documento publico de depoimento. Isto recolhe o que ja estava gravado —
// fechar a porta nao traz de volta o que ficou do lado de fora.
//
// Padrao e dry-run. Pra aplicar: { apply: true }.

exports.backfillTestimonialPrivacy = makeBackfillTestimonialPrivacy(db);

// ===== Webhook do gateway de cobrança (ver functions/lib/asaasWebhook.js) =====
//
// A única porta por onde o dinheiro entra no app, e a mais exposta: webhook
// não tem sessão, então a URL sozinha não pode valer nada. O token vem no
// cabeçalho `asaas-access-token`, é gerado no painel do gateway e vive em
// `functions:secrets` — sem ele, 401 antes de o corpo ser lido.
//
// Qual evento libera, qual reabre e qual é ruído NÃO se decide aqui: está em
// `lib/eventoDeCobranca.js`, regra pura com 30 casos (`npm run testar:cobranca`).

const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');

exports.asaasWebhook = makeAsaasWebhook(db, ASAAS_WEBHOOK_TOKEN);

// ===== Gerar a cobrança (ver functions/lib/asaasCobranca.js) =====
//
// A OUTRA METADE DO WEBHOOK. Ele encontra a fatura por `asaasPaymentId`, e
// esse campo não nascia em lugar nenhum — todo evento respondia `no-match`.
// Aqui é onde o vínculo é criado.
//
// Quem chama é o DONO, nunca o motorista: cobrança criada pelo cobrado é
// cláusula editada pelo devedor. E ela só sabe ler `faturasParceiro` — a
// mensalidade da família não passa pelo gateway, que é o item 7 dos Termos.
//
// O AMBIENTE PADRÃO É O SANDBOX de propósito. Chave de sandbox em produção
// devolve 401, que é falha barulhenta; apontar para produção sem querer cobra
// gente de verdade. Para virar a chave, `ASAAS_AMBIENTE=producao` no
// `.env.alobuzinou-be81f` das functions.

const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY');
const ASAAS_AMBIENTE = defineString('ASAAS_AMBIENTE', { default: 'sandbox' });

exports.criarCobrancaDaFatura = makeCriarCobrancaDaFatura(
  db,
  ASAAS_API_KEY,
  ASAAS_AMBIENTE
);

// ===== Contratação (ver functions/lib/contratacao.js) =====
//
// O motorista escolhe a faixa e o SERVIDOR escreve a cláusula: `planoId` e
// `limiteCriancas` no mesmo write, mais o desconto de antecipação se ele ainda
// estiver dentro do teste.
//
// É function porque os dois campos estão na lista que o cliente nunca escreve:
// um é o que a fatura cobra, o outro é o que as rules cobram a cada criança
// cadastrada. Autoatendimento sem isto seria abrir a cláusula ao devedor.

exports.contratarPlano = makeContratarPlano(db);

/**
 * O FECHAMENTO DO MÊS DA ASSOCIAÇÃO — agendado, e à mão.
 *
 * ⚠️ ATÉ 10/09/2026 A FATURA DA PLATAFORMA SÓ NASCIA POR CLIQUE, e isso custava
 * conversão: o degrau da escada decai no relógio do servidor mesmo quando
 * ninguém fecha nada, então o motorista perdia 30% de desconto sem nunca ter
 * recebido um preço. As três faturas isentas do teste são a peça que ensina o
 * valor antes de ele importar — e dependiam de disciplina humana repetida.
 *
 * A callable continua existindo de propósito: agendada que falha em silêncio é
 * pior que clique, e o dono precisa poder fechar o mês que não rodou.
 */
exports.fecharMesDosParceiros = makeFecharMesDosParceiros(db);
exports.fecharMesAgora = makeFecharMesAgora(db);

/**
 * A LIMPEZA DA COORDENADA — manutenção de UMA vez, e ela tem prazo.
 *
 * `checkpointFrom` gravava a posição do VEÍCULO do motorista em
 * `children.lastStatusCheckpoint` e em `rides/{dia}.checkpoints`, sem nenhum
 * leitor. O código parou em 10/09/2026; o que já está gravado sai por aqui.
 *
 * ⚠️ É function e não script porque a alternativa era uma CHAVE DE SERVIÇO
 * baixada do console — que abre o projeto inteiro sem rules, e é um risco
 * novo maior que o campo que ela vem apagar. As rules recusam esta escrita a
 * todo mundo, dono incluído, então o privilégio precisa vir de um lugar que
 * já o tem.
 *
 * ⚠️ **SEM `{ apagar: true }` ELA SÓ CONTA.**
 *
 * ⚠️ **ELA SAI DAQUI** quando o relatório vier zerado em produção, junto do
 * script, da régua, do teste e do bloco do painel.
 */
exports.limparCoordenadaDoCheckpoint = makeLimparCoordenadaDoCheckpoint(db);

/**
 * A RETENÇÃO DAS VIAGENS — 60 dias, todo dia às 4h30.
 *
 * Um documento por criança por dia letivo, para sempre, é arquivo que cresce
 * sozinho e que **nada lê depois do dia**: a única tela que abre uma viagem
 * pede a de HOJE. O prazo foi decidido pelo dono, e a Política de Privacidade
 * promete exatamente ele — mudar um exige mudar o outro na mesma alteração.
 *
 * ⚠️ Não toca no calendário de faltas: ele lê `absenceDeclarations`, que é
 * outra coleção e não tem prazo.
 */
exports.apagarViagensAntigas = makeApagarViagensAntigas(db);

/**
 * OS AVISOS COMERCIAIS — o único canal que alcança quem parou de abrir o app.
 *
 * Todo dia às 10h — uma hora DEPOIS do operacional, de propósito. A régua está em
 * `lib/avisosComerciais.js` e é pura: janela de silêncio, um assunto por
 * semana, nada para quem já contratou, e nenhum número que não venha da tabela.
 */
exports.enviarAvisosComerciais = makeEnviarAvisosComerciais(db);

// O GATILHO QUE TIRA O INDICADOR DE QUATRO MESES DE SILÊNCIO.
//
// `ESTADO.CADASTRADO` existia no domínio, era renderizado nas duas telas, e
// nada o gravava — ver o cabeçalho de `casarNoCadastro.js`. Ele NÃO ativa
// desconto nenhum: a carência continua sendo o primeiro mês pago.
exports.casarIndicacaoNoCadastro = makeCasarNoCadastro(db);

/* ══ OS AVISOS DE TEMPO ═══════════════════════════════════════════════════
 * Mensalidade vencendo, convite parado, fatura da plataforma e alvará. Todos
 * nascem de uma DATA chegando, e por isso precisam de alguém varrendo — não
 * há gesto que os dispare. A régua é pura (`reguaDosAvisos.js`) e testada sem
 * Firebase; este é só o relógio. */
exports.enviarAvisosDoDia = makeEnviarAvisosDoDia(db);

/* ⚠️ ESTA É A ÚNICA COM CADÊNCIA CURTA — de 20 em 20 minutos, e só nas duas
 * janelas de rota, em dia útil. "A rota atrasou" é o único aviso que precisa
 * existir quando o motorista NÃO está usando o app: quem dorme demais tem o
 * app fechado, então detectar pelo aparelho dele falha exatamente quando
 * importa. Ver o cabeçalho de `varrerAtrasos`. */
exports.varrerAtrasos = makeVarrerAtrasos(db);

/* ⚠️ O SEGUNDO TOQUE DA OFERTA DA PRIMEIRA ROTA. De 10 em 10 minutos, das 6h
 * às 20h, todos os dias — a primeira rota pode ser num sábado, e ela acontece
 * uma vez na vida de cada motorista. A consulta é por campo único e na maior
 * parte dos dias volta vazia. */
exports.varrerOfertas = makeVarrerOfertas(db);
