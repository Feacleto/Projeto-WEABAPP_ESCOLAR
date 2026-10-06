const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { chaveDoDia } = require('./reguaDoRetrato');
const {
  precisaAlertar,
  resumoDaHora,
  textoDoAlerta,
  totaisDoDia,
} = require('./reguaDaSeguranca');

const REGION = 'southamerica-east1';
const FUSO = 'America/Sao_Paulo';
const HORA_MS = 60 * 60 * 1000;
const MOTIVOS_DE_FRAUDE = ['fraude', 'documento_falso'];

/**
 * A VIGIA DA SEGURANÇA (05/10/2026) — de hora em hora, olha o que o app
 * registra de ataque e grava UM documento por dia em `segurancaDoApp/{dia}`.
 *
 * ── A JANELA É A HORA, SEM SOBREPOSIÇÃO
 * Roda no minuto 55. Cada leitura pega um pedaço que a hora seguinte não
 * repete, para o total do dia não contar o mesmo bloqueio duas vezes:
 *  - `limitesDeTentativa`: as janelas ABERTAS agora (`expiraEm` no futuro). As
 *    de uma hora fecham em 5 minutos; as de um dia aparecem em toda hora, e a
 *    régua trata isso (`totaisDoDia` usa o maior valor);
 *  - `senhasDoFinanceiro`: `bloqueadoAte` dentro da última hora — o bloqueio
 *    dura 60 s, então cada um cai em exatamente uma leitura;
 *  - `alertasDeComprovante` e `registroDoDono`: `em` dentro da última hora.
 * ⚠️ As fraudes são contadas na hora (não em 24 h): contar 24 h a cada hora
 * repetiria o mesmo registro vinte e quatro vezes e o alerta tocaria o dia
 * todo. O filtro por motivo é em memória, para não pedir índice composto.
 *
 * ── O ALERTA
 * Um doc em `notifications` por dono, por escopo, por hora: o id é
 * determinístico e `create()` ignora o que já existe, então o retry não
 * duplica sino. Só números no texto.
 *
 * ⚠️ Falhar em contar a senha vira `null`, nunca zero: zero diria "em paz".
 */
async function vigiarSeguranca(db, agora = new Date()) {
  const agoraMs = agora.getTime();
  const desde = Timestamp.fromMillis(agoraMs - HORA_MS);
  const dia = chaveDoDia(agora);
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    hour12: false,
  })
    .format(agora)
    .slice(0, 2);

  const limites = (
    await db
      .collection('limitesDeTentativa')
      .where('expiraEm', '>', Timestamp.fromMillis(agoraMs))
      .limit(5000)
      .get()
  ).docs.map((d) => ({ id: d.id, escopo: d.data().escopo, contagem: d.data().contagem }));

  let senhasBloqueadas = null;
  try {
    senhasBloqueadas =
      (await db.collection('senhasDoFinanceiro').where('bloqueadoAte', '>', desde).count().get()).data()
        .count || 0;
  } catch (err) {
    logger.warn('[vigia] não deu para contar os bloqueios da senha', { err: err?.message });
  }

  const comprovantes = (
    await db.collection('alertasDeComprovante').where('em', '>', desde).count().get()
  ).data().count;

  const registros = await db.collection('registroDoDono').where('em', '>', desde).limit(500).get();
  const fraudes = registros.docs.filter((d) => MOTIVOS_DE_FRAUDE.includes(d.data().motivo)).length;

  const resumo = resumoDaHora({
    limites,
    senhasBloqueadas,
    comprovantes,
    fraudes,
    appCheckLigado: LIMITES.APP_CHECK.enforceAppCheck === true,
  });

  const ref = db.collection('segurancaDoApp').doc(dia);
  const atual = (await ref.get()).data() || {};
  const horas = { ...(atual.horas || {}), [hora]: resumo };
  await ref.set(
    {
      dia,
      horas: { [hora]: resumo },
      totais: totaisDoDia(horas),
      appCheckLigado: resumo.appCheckLigado,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const alertas = precisaAlertar(resumo);
  if (alertas.length) {
    const donos = await db.collection('users').where('role', '==', 'owner').get();
    for (const alerta of alertas) {
      const { title, body } = textoDoAlerta(alerta);
      for (const dono of donos.docs) {
        try {
          await db
            .collection('notifications')
            .doc(`seguranca_${alerta.chave}_${dia}-${hora}_${dono.id}`)
            .create({
              userId: dono.id,
              type: 'alerta_de_seguranca',
              title,
              body,
              destino: '/admin',
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });
        } catch (err) {
          // 6 = ALREADY_EXISTS: o alerta desta hora já saiu (retry).
          if (err?.code !== 6) throw err;
        }
      }
    }
  }
  return { resumo, alertas };
}

function makeVigiarSeguranca(db) {
  return onSchedule(
    {
      schedule: '55 * * * *',
      timeZone: FUSO,
      region: REGION,
      retryCount: 1,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const { resumo, alertas } = await vigiarSeguranca(db);
      logger.info('[vigia] segurança', { alertas: alertas.map((a) => a.chave), resumo });
      return null;
    }
  );
}

module.exports = { makeVigiarSeguranca, vigiarSeguranca };
