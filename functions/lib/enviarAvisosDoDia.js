/**
 * A VARREDURA DIÁRIA DOS AVISOS DE TEMPO — quem lê o banco e escreve.
 *
 * A decisão de QUAL aviso cabe hoje é pura e mora em `reguaDosAvisos.js`,
 * testada sem Firebase por `npm run testar:avisos-do-dia`. Este arquivo faz o
 * que ela não pode: consultar as coleções, gravar em `notifications` e marcar
 * que já falou.
 *
 * ── QUATRO AVISOS, QUATRO VARREDURAS
 *   mensalidade vencendo/atrasada  → para a FAMÍLIA
 *   convite parado há 4 dias       → para o MOTORISTA (a família não tem conta)
 *   fatura da plataforma em 3 dias → para o MOTORISTA
 *   alvará vencendo em 30 dias     → para o MOTORISTA
 *
 * ── ⚠️ A MARCA DE JÁ TER FALADO É O QUE IMPEDE O DIÁRIO
 * A varredura roda todo dia. "Vence em 3 dias" é verdade num dia só e se
 * resolve sozinho — mas "está 7 dias atrasada" continua verdade no oitavo, no
 * nono e no décimo. Sem `avisos.{tipo}` gravado no documento alvo, o aviso de
 * atraso viraria uma cobrança diária, que é como se ensina alguém a desligar
 * a notificação do app.
 *
 * ── ⚠️ ESCRITO COM ADMIN SDK, e é isso que torna possível
 * As rules de `notifications` dizem quem pode escrever pra quem: o motorista
 * avisa as famílias DELE, e vice-versa. A plataforma falando com qualquer um
 * dos dois não cabe em nenhum desses ramos — e não deveria mesmo, porque abrir
 * a rule pra isso abriria a caixa de todo mundo pra qualquer signed-in.
 *
 * ── ⚠️ UMA FALHA NÃO PODE DERRUBAR A VARREDURA
 * São quatro consultas independentes sobre a base inteira. Um documento
 * estranho numa delas não pode impedir as outras três de rodar — nem impedir
 * as famílias seguintes da mesma. Cada item é envolvido no próprio try.
 */

'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const {
  avisoDaMensalidade,
  avisoDoConvite,
  avisoDaFatura,
  avisoDoAlvara,
  jaAvisado,
} = require('./reguaDosAvisos');

const REGION = 'southamerica-east1';

/**
 * Teto por varredura. Não é medo de escala — é que uma varredura sem teto,
 * num dia em que algo esteja errado, escreve milhares de notificações antes de
 * alguém perceber.
 */
const TETO = 500;

/**
 * Grava a notificação e MARCA o documento na mesma passagem.
 *
 * ⚠️ A MARCA VEM DEPOIS DA NOTIFICAÇÃO, e a ordem importa: se a marca fosse
 * primeiro e a notificação falhasse, a pessoa nunca mais receberia aquele
 * aviso — e ninguém saberia. Assim, o pior caso é o aviso repetir uma vez.
 * Repetir é chato; sumir em silêncio é o defeito que não se acha.
 */
async function entregar(db, { paraUid, aviso, ref }) {
  if (!paraUid || !aviso) return false;

  // `title` e `createdAt` são exigidos pelas rules, e `push.js` desiste sem
  // `title`: um aviso sem eles seria gravado e nunca entregue.
  await db.collection('notifications').add({
    userId: paraUid,
    type: aviso.tipo,
    title: aviso.titulo,
    body: aviso.corpo,
    destino: aviso.destino || null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (ref) {
    await ref.update({ [`avisos.${aviso.tipo}`]: true });
  }
  return true;
}

/** A mensalidade da família — o único destes que fala com o responsável. */
async function varrerMensalidades(db, agora) {
  let n = 0;
  const snap = await db
    .collection('payments')
    .where('status', 'in', ['pending', 'claimed'])
    .limit(TETO)
    .get();

  for (const doc of snap.docs) {
    try {
      const p = doc.data();
      const aviso = avisoDaMensalidade({ pagamento: p, agora });
      if (!aviso || jaAvisado(p, aviso.tipo)) continue;
      if (await entregar(db, { paraUid: p.parentUid, aviso, ref: doc.ref })) n += 1;
    } catch (err) {
      logger.warn(`aviso de mensalidade falhou em ${doc.id}`, err);
    }
  }
  return n;
}

/**
 * O convite parado. Vai pro MOTORISTA porque a família ainda não tem conta —
 * não existe caixa onde entregar, e quem tem o telefone dela é ele.
 */
async function varrerConvites(db, agora) {
  let n = 0;
  const snap = await db
    .collection('children')
    .where('inviteStatus', '==', 'pending')
    .limit(TETO)
    .get();

  for (const doc of snap.docs) {
    try {
      const c = doc.data();
      const aviso = avisoDoConvite({ crianca: c, agora });
      if (!aviso || jaAvisado(c, aviso.tipo)) continue;
      if (await entregar(db, { paraUid: c.adminUid, aviso, ref: doc.ref })) n += 1;
    } catch (err) {
      logger.warn(`aviso de convite falhou em ${doc.id}`, err);
    }
  }
  return n;
}

/** A fatura da plataforma — dinheiro que ele deve, e que a tela só conta se ele abrir. */
async function varrerFaturas(db, agora) {
  let n = 0;
  const snap = await db
    .collection('faturasParceiro')
    .where('status', '==', 'aberta')
    .limit(TETO)
    .get();

  for (const doc of snap.docs) {
    try {
      const f = doc.data();
      const aviso = avisoDaFatura({ fatura: f, agora });
      if (!aviso || jaAvisado(f, aviso.tipo)) continue;
      // ⚠️ O DONO DA FATURA É O PREFIXO DO ID, NÃO UM CAMPO. O documento
      // nasce como `faturasParceiro/{uid}_{AAAA-MM}` (ver `FATURA()` em
      // `taxaService`) e o payload não repete o uid em lugar nenhum. Procurar
      // por campo aqui devolveria `undefined` em toda fatura, e a varredura
      // sairia dizendo "0 avisos" sem nenhum erro.
      const alvo = String(doc.id).split('_')[0] || null;
      if (await entregar(db, { paraUid: alvo, aviso, ref: doc.ref })) n += 1;
    } catch (err) {
      logger.warn(`aviso de fatura falhou em ${doc.id}`, err);
    }
  }
  return n;
}

/** O alvará vencendo — sem aviso, o selo some da tela das famílias dele. */
async function varrerAlvaras(db, agora) {
  let n = 0;
  const snap = await db
    .collection('users')
    .where('verificacao', '==', 'aprovada')
    .limit(TETO)
    .get();

  for (const doc of snap.docs) {
    try {
      const m = doc.data();
      const aviso = avisoDoAlvara({ motorista: m, agora });
      if (!aviso || jaAvisado(m, aviso.tipo)) continue;
      if (await entregar(db, { paraUid: doc.id, aviso, ref: doc.ref })) n += 1;
    } catch (err) {
      logger.warn(`aviso de alvará falhou em ${doc.id}`, err);
    }
  }
  return n;
}

async function enviarAvisosDoDia(db, { agora = new Date() } = {}) {
  const resultado = {
    mensalidades: await varrerMensalidades(db, agora),
    convites: await varrerConvites(db, agora),
    faturas: await varrerFaturas(db, agora),
    alvaras: await varrerAlvaras(db, agora),
  };
  logger.info('enviarAvisosDoDia concluído', resultado);
  return resultado;
}

/**
 * Às 9h de Brasília.
 *
 * ⚠️ NÃO ÀS 6H. Entre 6h e 8h30 o motorista está dirigindo com criança dentro,
 * e a família está na porta — nenhum dos dois vai parar pra ler uma cobrança.
 * É o mesmo horário que `enviarAvisosComerciais` escolheu, pela mesma razão.
 */
function makeEnviarAvisosDoDia(db) {
  return onSchedule(
    {
      schedule: '0 9 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      await enviarAvisosDoDia(db, { agora: new Date() });
    }
  );
}

module.exports = { makeEnviarAvisosDoDia, enviarAvisosDoDia };
