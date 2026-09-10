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
  avisoDeAtraso,
  jaAvisado,
  jaAvisadoHoje,
  chaveDoDia,
  SELO_VALE_EM,
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
async function entregar(db, { paraUid, aviso, ref, operacional = false, agora }) {
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

  // ⚠️ O CARIMBO QUE FAZ A OFERTA CALAR NO MESMO DIA.
  //
  // Três agendados rodavam às 9h — este, os avisos comerciais e o e-mail de
  // mensalidade — e nenhum sabia dos outros. O mesmo motorista podia receber
  // "sua fatura vence em 3 dias" e "traga um colega" na mesma manhã, e nada
  // acusava, porque o guarda semanal do comercial lia um campo que só ele
  // escrevia.
  //
  // Quem cede é a OFERTA, nunca a obrigação: `avisoParaEnviar` lê este campo
  // e desiste quando ele é de hoje. O comercial passou a rodar às 10h para
  // que o carimbo já exista quando ele olhar — com os dois às 9h, a ordem
  // seria do Cloud Scheduler e o silêncio seria sorteado a cada manhã.
  //
  // ⚠️ SÓ PARA AVISO DO MOTORISTA. A mensalidade da família passa pela mesma
  // função e NÃO carimba: ela não concorre com oferta nenhuma, e carimbar ali
  // calaria o comercial do motorista por causa de um aviso que foi para outra
  // pessoa.
  // ⚠️ 'AAAA-MM-DD', NÃO UM TIMESTAMP. A régua compara com o DIA de hoje em
  // Brasília; com timestamp ela comparava horas decorridas, e um carimbo de
  // ontem ao meio-dia calava a oferta de hoje de manhã — 22 horas contam
  // como "zero dias". É o mesmo formato que `jaAvisadoHoje` já usa neste
  // arquivo, pelo mesmo motivo.
  if (operacional) {
    await db.doc(`users/${paraUid}`).set(
      // `chaveDoDia` já existe neste projeto e já é do fuso certo — escrever
      // uma segunda seria a divergência de sempre.
      { ultimoAvisoOperacional: chaveDoDia(agora) },
      { merge: true }
    );
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
      if (await entregar(db, { paraUid: c.adminUid, aviso, ref: doc.ref, operacional: true, agora })) n += 1;
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
      if (await entregar(db, { paraUid: alvo, aviso, ref: doc.ref, operacional: true, agora })) n += 1;
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
    // ⚠️ `SELO_VALE_EM`, NUNCA UM LITERAL. Era `'aprovada'`, valor que nada
    // no projeto grava — a consulta voltava zero todo dia, sem erro.
    .where('verificacao', '==', SELO_VALE_EM)
    .limit(TETO)
    .get();

  for (const doc of snap.docs) {
    try {
      const m = doc.data();
      const aviso = avisoDoAlvara({ motorista: m, agora });
      if (!aviso || jaAvisado(m, aviso.tipo)) continue;
      if (await entregar(db, { paraUid: doc.id, aviso, ref: doc.ref, operacional: true, agora })) n += 1;
    } catch (err) {
      logger.warn(`aviso de alvará falhou em ${doc.id}`, err);
    }
  }
  return n;
}

/**
 * A ROTA ATRASOU — a varredura que roda DENTRO das duas janelas.
 *
 * ── ⚠️ POR QUE ESTA NÃO PODE SER DIÁRIA NEM DO CLIENTE
 * Ela é o único aviso do conjunto que precisa existir quando o motorista NÃO
 * está usando o app. A primeira ideia foi calcular no celular dele, que está
 * aberto durante a rota com tudo carregado — e ela falha exatamente no caso
 * que importa: quem dorme demais tem o app fechado. O GPS nunca ligou, a tela
 * nunca abriu, e ninguém avaliaria nada.
 *
 * ── AS TRÊS LEITURAS, E O QUE FICOU DE FORA
 * Uma consulta das faltas do dia (a plataforma inteira, de uma vez), uma das
 * crianças ativas, e um `liveLocation` por motorista distinto.
 *
 * ⚠️ AS VIAGENS (`rides`) NÃO SÃO LIDAS, de propósito. No original elas só
 * mudam o TÍTULO do caso grave ("o app não recebe atualização" em vez de
 * "passou da hora"), e custariam uma leitura por criança a cada vinte minutos.
 * Uma variação de título não paga isso; a decisão de avisar não depende delas.
 */
async function varrerAtrasos(db, agora) {
  let n = 0;
  const hoje = chaveDoDia(agora);

  // As faltas do dia, de uma vez: criança avisada não gera aviso de atraso, e
  // uma consulta por criança seria a leitura mais cara desta varredura.
  const faltas = new Set();
  try {
    const fs = await db
      .collection('absenceDeclarations')
      .where('dateKey', '==', hoje)
      .limit(TETO * 2)
      .get();
    fs.docs.forEach((d) => {
      const id = d.data().childId;
      if (id) faltas.add(id);
    });
  } catch (err) {
    logger.warn('não deu pra ler as faltas do dia', err);
  }

  const snap = await db.collection('children').limit(TETO).get();

  // `liveLocation` é UM por motorista, e vinte crianças dele fariam vinte
  // leituras do mesmo documento.
  const rotaPorMotorista = new Map();
  async function rotaAtivaDe(adminUid) {
    if (!adminUid) return false;
    if (rotaPorMotorista.has(adminUid)) return rotaPorMotorista.get(adminUid);
    let ativa;
    try {
      const d = await db.doc(`liveLocation/${adminUid}`).get();
      ativa = d.exists && d.data().routeActive === true;
    } catch {
      // ⚠️ NA DÚVIDA, "A ROTA ESTÁ ATIVA" — ou seja, o silêncio. Falhar a
      // leitura e concluir "a rota não começou" mandaria um aviso de atraso
      // pra base inteira por causa de um soluço de rede. É o pior erro que
      // esta varredura pode cometer, e o `true` é o que o impede.
      ativa = true;
    }
    rotaPorMotorista.set(adminUid, ativa);
    return ativa;
  }

  for (const doc of snap.docs) {
    try {
      const c = doc.data();
      if (c.active === false || !c.parentUid) continue;
      if (jaAvisadoHoje(c, 'rota_atrasada', hoje)) continue;

      const aviso = avisoDeAtraso({
        crianca: c,
        rotaAtiva: await rotaAtivaDe(c.adminUid),
        temFalta: faltas.has(doc.id),
        agora,
      });
      if (!aviso) continue;

      await db.collection('notifications').add({
        userId: c.parentUid,
        type: aviso.tipo,
        title: aviso.titulo,
        body: aviso.corpo,
        destino: aviso.destino || null,
        childId: doc.id,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      // Marca com a DATA, não booleano: atraso volta a acontecer amanhã.
      await doc.ref.update({ 'avisos.rota_atrasada': hoje });
      n += 1;
    } catch (err) {
      logger.warn(`aviso de atraso falhou em ${doc.id}`, err);
    }
  }
  return n;
}

/**
 * De vinte em vinte minutos, nas duas janelas, de segunda a sexta.
 *
 * ⚠️ SÓ EM DIA ÚTIL, e o cron cuida disso: transporte escolar não roda no fim
 * de semana, e uma varredura de sábado só encontraria rota "não iniciada" em
 * toda a base.
 */
function makeVarrerAtrasos(db) {
  return onSchedule(
    {
      schedule: '*/20 6-8,16-18 * * 1-5',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const n = await varrerAtrasos(db, new Date());
      logger.info('varrerAtrasos concluído', { avisos: n });
    }
  );
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

module.exports = {
  makeEnviarAvisosDoDia,
  enviarAvisosDoDia,
  makeVarrerAtrasos,
  varrerAtrasos,
};
