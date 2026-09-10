/**
 * A PERGUNTA DA VÉSPERA — "amanhã continua valendo?"
 *
 * POR QUE ISTO RODA NO SERVIDOR
 * O app já pergunta isso quando o responsável abre a tela. Só que quem esquece
 * de desmarcar é, por definição, quem NÃO está abrindo o app — se ele abrisse,
 * veria o aviso na home e lembraria. A pergunta precisa ir atrás dele.
 *
 * O QUE ELA EVITA
 * O pai avisa que dia 28 a criança não vai, o plano muda, ninguém desmarca. No
 * dia 28 o motorista lê "falta hoje", não passa na porta, e a criança fica
 * esperando. Um lado espera e o outro acha que não deveria ter esperado — e o
 * app, tecnicamente correto, fica do lado errado da história.
 *
 * ÀS 19H, E NÃO DE MANHÃ
 * De manhã já é tarde: a rota sai cedo e o motorista monta a viagem com a
 * criança fora. Às 19h a família está junta, ainda dá pra mudar de ideia, e o
 * aviso não compete com o corre do café da manhã.
 *
 * NÃO PERGUNTA SOBRE AVISO DE HOJE
 * Quem acabou de marcar não esqueceu. Perguntar "ainda vale?" três horas depois
 * de ele ter dito é o tipo de aviso que ensina a ignorar aviso — e o que
 * precisamos é justamente que este seja lido.
 *
 * IDEMPOTENTE PELO ID
 * O documento é `confirm_{dia}_{criança}`. Se a função rodar duas vezes (retry
 * do agendador), a segunda escrita é um update, não um create — e o push só
 * dispara em create. Sem isso, uma instabilidade do agendador viraria dois
 * pushes iguais na mesma noite.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const admin = require('firebase-admin');

const REGION = 'southamerica-east1';
const FUSO = 'America/Sao_Paulo';

// ⚠️ CADA RÓTULO COMPLETA A FRASE "Amanhã {nome} ___", e é por isso que o
// sujeito deles é a CRIANÇA, não o responsável. Eram 'você leva' e 'você
// busca', que funcionavam depois de dois-pontos ("Amanhã: Lucas você leva")
// porque ali o título era um rótulo, não uma frase. Sem os dois-pontos vira
// "Amanhã Lucas você leva". O padrão de aviso do app é frase, então quem
// mudou foi o rótulo.
const ROTULO = {
  full: 'não vai',
  'no-pickup': 'vai com você',
  'no-dropoff': 'volta com você',
  'picked-up': 'sai da escola com você',
};

/**
 * 'YYYY-MM-DD' no fuso de São Paulo, com deslocamento em dias.
 *
 * A função roda num ambiente em UTC. Somar dias a um `Date` cru daria o dia
 * errado nas horas em que UTC e Brasília estão em datas diferentes — que é
 * justamente a faixa da noite em que ela é agendada.
 */
function chaveDoDia(deslocamentoEmDias = 0) {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora); // en-CA já devolve YYYY-MM-DD

  const [y, m, d] = partes.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + deslocamentoEmDias);
  return base.toISOString().slice(0, 10);
}

function makeConfirmarAusencias(db) {
  return onSchedule(
    {
      schedule: '0 19 * * *',
      timeZone: FUSO,
      region: REGION,
      retryCount: 2,
      maxInstances: LIMITES.AGENDADO,
      // Varre a véspera inteira da plataforma — ver limites.js.
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const amanha = chaveDoDia(1);
      const hoje = chaveDoDia(0);

      const snap = await db
        .collection('absenceDeclarations')
        .where('dateKey', '==', amanha)
        .get();

      if (snap.empty) {
        logger.info('confirmarAusencias: nada pra amanhã', { amanha });
        return;
      }

      // ⚠️ EM LOTES DE 400 — UM BATCH SÓ QUEBRA NA VÉSPERA DE FERIADO.
      //
      // A consulta acima pega TODA declaração de ausência de amanhã na
      // plataforma. Isto era um `db.batch()` único, e o Firestore recusa batch
      // com mais de 500 escritas — recusa o lote INTEIRO.
      //
      // O efeito: passando de 500 avisos, NENHUM responsável recebe a
      // pergunta da véspera, que é a única defesa contra "a criança ficou na
      // calçada". E o dia em que mais gente marca ausência é exatamente a
      // véspera de feriado — ou seja, ele quebraria primeiro no dia em que
      // mais importa.
      //
      // 400 é o mesmo tamanho que `billing.js` e `privacyBackfill.js` usam,
      // pelo mesmo motivo. Aqui não há teto de `get()` a respeitar (Admin SDK
      // não passa por rules), então não precisa dos 15 do cliente.
      const TAMANHO_DO_LOTE = 400;

      let enviados = 0;
      let pulados = 0;
      let lote = db.batch();
      let noLote = 0;
      const commits = [];

      for (const doc of snap.docs) {
        const a = doc.data();
        if (!a.parentUid) {
          pulados += 1;
          continue;
        }

        // Aviso feito hoje: ele não esqueceu, acabou de dizer.
        const criado = a.createdAt?.toDate?.();
        if (criado) {
          const diaDaCriacao = new Intl.DateTimeFormat('en-CA', {
            timeZone: FUSO,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(criado);
          if (diaDaCriacao === hoje) {
            pulados += 1;
            continue;
          }
        }

        const nome = (a.childName || '').split(' ')[0] || 'a criança';
        // O padrão também precisa fechar a frase: 'ausência' produziria
        // "Amanhã Lucas ausência".
        const rotulo = ROTULO[a.type] || 'não usa a perua';

        const ref = db.doc(`notifications/confirm_${amanha}_${a.childId}`);
        lote.set(ref, {
          userId: a.parentUid,
          type: 'absence_confirm',
          // O título era um RÓTULO com dois-pontos ("Amanhã: Lucas não
          // vai"). Vira frase. E o corpo perde a explicação de mecanismo
          // ("o motorista é avisado na hora"): ela não precisa saber como
          // funciona, precisa saber o que fazer se mudou de ideia.
          title: `Amanhã ${nome} ${rotulo}`,
          body: `Você avisou ${haQuantoTempo(criado)}. Se mudou de plano, toque para desmarcar.`,
          childId: a.childId,
          dateKey: amanha,
          url: '/pai',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        enviados += 1;
        noLote += 1;

        if (noLote >= TAMANHO_DO_LOTE) {
          commits.push(lote.commit());
          lote = db.batch();
          noLote = 0;
        }
      }

      if (noLote > 0) commits.push(lote.commit());
      // `allSettled` e não `all`: um lote que falhe não pode impedir os
      // outros de chegar. A véspera é hoje, e não há segunda chance amanhã.
      const fim = await Promise.allSettled(commits);
      const falhos = fim.filter((r) => r.status === 'rejected');
      if (falhos.length) {
        logger.error('confirmarAusencias: lote(s) falharam', {
          amanha,
          lotes: commits.length,
          falhos: falhos.length,
          primeiro: falhos[0]?.reason?.message || null,
        });
      }

      logger.info('confirmarAusencias concluído', {
        amanha,
        enviados,
        pulados,
        lotes: commits.length,
        lotesFalhos: falhos.length,
      });
    }
  );
}

/**
 * ⚠️ DIAS DE CALENDÁRIO EM BRASÍLIA, não períodos de 24 horas.
 *
 * Era `Math.floor((Date.now() - data) / 86400000)`, e este arquivo é o que
 * mais sofre com isso: o agendado roda às 19h. Um aviso feito ANTEONTEM às
 * 20h chega a 47 horas — um período — e o push dizia **"você avisou
 * ontem"**. A mãe confere a data errada e não desmarca.
 *
 * O arquivo já usa `Intl` com o fuso para o `dateKey`; era só o rótulo
 * humano que tinha ficado para trás. `chaveDoDia` faz a mesma conta do lado
 * do cliente em `formatters.diasDeCalendario` — as duas zeram o dia antes de
 * subtrair, que é a régua certa.
 */
function diaEmBrasilia(data) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

function haQuantoTempo(data, agora = new Date()) {
  if (!data) return 'antes';
  // Meio-dia dos dois lados: a data a 00:00 volta um dia em qualquer
  // conversão, e é justamente a virada do dia que se quer medir.
  const aoMeioDia = (iso) => new Date(`${iso}T12:00:00Z`);
  const dias = Math.round(
    (aoMeioDia(diaEmBrasilia(agora)) - aoMeioDia(diaEmBrasilia(data))) / 86400000
  );
  if (dias <= 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
}

module.exports = { makeConfirmarAusencias };
