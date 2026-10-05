const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { chaveDoDia, fotoDoDia, mesDoDia, retratoDaBase } = require('./reguaDoRetrato');

const REGION = 'southamerica-east1';

/**
 * A FOTO DIÁRIA DA BASE — `fotosDaBase/{AAAA-MM-DD}` (05/10/2026, painel do
 * dono, lote 2).
 *
 * ── POR QUE EXISTE
 * O painel só sabia o AGORA: a última rota de cada motorista, as crianças de
 * hoje. Sem guardar o passado não há gráfico de evolução, meta com ritmo,
 * relatório do mês nem "antes e depois" de uma decisão. Uma escrita por dia
 * resolve todos.
 *
 * ── O QUE ELA LÊ E O QUE ELA GRAVA
 * Lê os motoristas (`users` com `role: 'admin'`, a mesma lista que o painel lê)
 * e faz três `count()` — nenhum documento de criança ou de pagamento é baixado.
 * Grava UM documento, com a LISTA FECHADA de `fotoDoDia`: só números, nenhum
 * uid, nenhum nome. A conta é a do Hoje do painel (`reguaDoRetrato.js`,
 * espelho testado em `testar:retrato`).
 *
 * ── ⚠️ O ID É O DIA DE BRASÍLIA
 * Roda às 23h50 de Brasília, que em UTC já é o dia seguinte. O id sai de
 * `chaveDoDia`, no fuso certo — e é idempotente: rodar de novo no mesmo dia
 * (retry) SOBRESCREVE a foto do dia, não cria uma segunda.
 *
 * As rules: só o dono lê, ninguém escreve pelo cliente.
 */
async function fotografarBase(db, agora = new Date()) {
  const children = db.collection('children');
  const contar = async (q) => {
    try {
      return (await q.count().get()).data().count || 0;
    } catch (err) {
      logger.error('[foto] uma contagem falhou', { err: err?.message });
      return null;
    }
  };

  const mes = mesDoDia(agora);
  const [motoristas, criancasAtivas, criancasComFamilia, baixasNoMes] = await Promise.all([
    db
      .collection('users')
      .where('role', '==', 'admin')
      .get()
      .then((s) => s.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    contar(children.where('active', '==', true)),
    contar(children.where('active', '==', true).where('inviteStatus', '==', 'used')),
    contar(
      db.collection('payments').where('status', '==', 'paid').where('month', '==', mes)
    ),
  ]);

  const retrato = retratoDaBase({
    parceiros: motoristas,
    agora,
    mes,
    criancasAtivas,
    criancasComFamilia,
    baixasNoMes,
  });
  const foto = fotoDoDia(retrato, agora);
  await db
    .collection('fotosDaBase')
    .doc(chaveDoDia(agora))
    .set({ ...foto, gravadaEm: agora });
  return foto;
}

function makeFotografarBase(db) {
  return onSchedule(
    {
      // 23h50 — o dia de rota já acabou e o dia seguinte ainda não começou.
      schedule: '50 23 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      // Idempotente (o id é o dia), então tentar de novo não duplica nada.
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const foto = await fotografarBase(db);
      logger.info('[foto] base fotografada', foto);
      return null;
    }
  );
}

module.exports = { makeFotografarBase, fotografarBase };
