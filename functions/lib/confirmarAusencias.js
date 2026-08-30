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

const ROTULO = {
  full: 'não vai',
  'no-pickup': 'você leva',
  'no-dropoff': 'você busca',
  'picked-up': 'você pega na escola',
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

      let enviados = 0;
      let pulados = 0;
      const lote = db.batch();

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
        const rotulo = ROTULO[a.type] || 'ausência';

        const ref = db.doc(`notifications/confirm_${amanha}_${a.childId}`);
        lote.set(ref, {
          userId: a.parentUid,
          type: 'absence_confirm',
          title: `Amanhã: ${nome} ${rotulo}`,
          body: `Você avisou ${haQuantoTempo(criado)}. Se mudou, toque aqui e desmarque — o motorista é avisado na hora.`,
          childId: a.childId,
          dateKey: amanha,
          url: '/pai',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        enviados += 1;
      }

      if (enviados > 0) await lote.commit();
      logger.info('confirmarAusencias concluído', { amanha, enviados, pulados });
    }
  );
}

function haQuantoTempo(data) {
  if (!data) return 'antes';
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
  if (dias <= 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
}

module.exports = { makeConfirmarAusencias };
