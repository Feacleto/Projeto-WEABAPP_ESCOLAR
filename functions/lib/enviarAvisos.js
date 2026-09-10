/**
 * O DISPARO DOS AVISOS COMERCIAIS — quem varre a base e escreve.
 *
 * A decisão de QUAL aviso cabe hoje é pura e mora em `avisosComerciais.js`,
 * testada por `npm run testar:avisos` sem Firebase. Este arquivo faz o que ela
 * não pode: ler `users`, escrever em `notifications` e marcar quando falou.
 *
 * ── POR QUE `notifications`, E NÃO E-MAIL
 * O canal já existia inteiro e ninguém o usava para dinheiro. Um documento em
 * `notifications` com `userId`, `type`, `title` e `createdAt` dispara
 * `sendPushOnNotification`, que manda o push e leva o motorista para a rota
 * certa pelo `URL_BY_TYPE`. Construir e-mail para a primeira versão seria
 * refazer um caminho que já entrega.
 *
 * ⚠️ ESCRITO COM ADMIN SDK, e é isso que torna possível. As rules de
 * `notifications` restringem quem pode escrever para quem — o motorista só
 * notifica as famílias dele, e vice-versa. A plataforma falando com o motorista
 * não passa por nenhum desses ramos, e não deveria mesmo: abrir a rule para
 * isso seria abrir a caixa dele para qualquer signed-in.
 *
 * ── ÀS 10H, E O HORÁRIO É PARTE DA REGRA — DUAS VEZES
 * Entre 6h e 8h30 e entre 16h30 e 19h ele está dirigindo com criança dentro.
 * `avisoDoDia` recusa nessas faixas por conta própria: o cron é a primeira
 * defesa, e a régua é a segunda.
 *
 * ⚠️ E ELE SAIU DAS 9H PARA AS 10H DE PROPÓSITO. Três agendados rodavam às
 * 9h — este, o `enviarAvisosDoDia` (fatura, convite parado, alvará vencendo)
 * e o e-mail de mensalidade —, e o mesmo motorista podia receber "sua fatura
 * vence em 3 dias" e "traga um colega" na mesma manhã.
 *
 * `avisoParaEnviar` agora cala a oferta quando o operacional já falou hoje,
 * lendo `users.ultimoAvisoOperacional`. **Isso exige ordem**: com os dois às
 * 9h, quem roda primeiro é decisão do Cloud Scheduler, e o carimbo poderia
 * ainda não existir quando a régua o lesse. Uma hora depois, existe.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { avisoParaEnviar } = require('./avisosComerciais');

const REGION = 'southamerica-east1';

/**
 * Varre os motoristas e escreve o aviso de quem tem um hoje.
 *
 * ⚠️ UM MOTORISTA QUE FALHA NÃO DERRUBA A VARREDURA. Sem o try por parceiro, um
 * documento malformado no meio da base deixaria todo mundo depois dele sem
 * aviso — e o sintoma seria "a campanha não saiu", sem dizer para quem.
 */
async function enviarAvisos(db, { agora = new Date() } = {}) {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  const resultado = { enviados: 0, calados: 0, erros: 0 };

  for (const doc of snap.docs) {
    const motorista = { uid: doc.id, ...doc.data() };
    let aviso;
    try {
      aviso = avisoParaEnviar({ motorista, agora });
    } catch (err) {
      resultado.erros += 1;
      logger.warn('[avisos] régua falhou', { uid: motorista.uid, motivo: err?.message });
      continue;
    }

    if (!aviso) {
      resultado.calados += 1;
      continue;
    }

    try {
      // ⚠️ `title` E `createdAt` SÃO OBRIGATÓRIOS pelas rules de
      // `notifications`, e `push.js` desiste sem `title`. Um aviso sem eles
      // seria gravado e nunca entregue — falha silenciosa das caras.
      await db.collection('notifications').add({
        userId: motorista.uid,
        type: aviso.tipo,
        title: aviso.titulo,
        body: aviso.corpo,
        // O texto longo fica no sino, para quem toca no push. O push dá o
        // fato; o sino dá o porquê.
        texto: aviso.texto,
        destino: aviso.destino,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      // ⚠️ A MARCA DE QUANDO FALOU É O QUE FAZ O GUARDA SEMANAL EXISTIR.
      // Sem ela, `avisoParaEnviar` não tem como saber que já falou — e a
      // mesma peça sairia todo dia enquanto a condição valesse.
      await db
        .doc(`users/${motorista.uid}`)
        .set({ ultimoAvisoComercial: FieldValue.serverTimestamp() }, { merge: true });

      resultado.enviados += 1;
    } catch (err) {
      resultado.erros += 1;
      logger.warn('[avisos] não enviou', { uid: motorista.uid, motivo: err?.message });
    }
  }

  logger.info('[avisos] varredura', resultado);
  return resultado;
}

/** Todo dia às 9h de Brasília — entre um turno e outro. */
function makeEnviarAvisosComerciais(db) {
  return onSchedule(
    {
      schedule: '0 10 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      await enviarAvisos(db, { agora: new Date() });
    }
  );
}

module.exports = { makeEnviarAvisosComerciais, enviarAvisos };
