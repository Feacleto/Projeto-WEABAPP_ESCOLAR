const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { ACAO, PAPEL, avisoAoTio, bloqueioVencido, tiosParaAvisar } = require('./reguaDoRegistro');
const { aplicarNaContaDaFamilia } = require('./registroDoDono');

const REGION = 'southamerica-east1';
const LOTE = 200;

/**
 * REABRE A FAMÍLIA CUJA SUSPENSÃO PASSOU DO PRAZO (05/10/2026).
 *
 * Só SUSPENSÃO com data vencida (`bloqueioVencido`): ⚠️ ENCERRAMENTO NUNCA SE
 * REATIVA SOZINHO, nem suspensão sem data — essas esperam o dono. Cada
 * reabertura deixa uma linha no `registroDoDono` em nome do servidor (motivo
 * `prazo_cumprido`), avisa o tio de cada criança dela que os avisos voltaram,
 * e só então reabre a conta no Firebase Auth.
 *
 * A consulta é por `bloqueio.grau == 'suspensao'` (campo único, índice
 * automático); a decisão de "venceu" é da régua, no fuso de Brasília.
 */
async function reabrirSuspensoesVencidas(db, agora = new Date()) {
  const snap = await db.collection('users').where('bloqueio.grau', '==', 'suspensao').limit(LOTE).get();
  let reabertas = 0;
  for (const doc of snap.docs) {
    if (!bloqueioVencido(doc.get('bloqueio'), agora)) continue;
    try {
      const criancas = await db.runTransaction(async (tx) => {
        const atual = await tx.get(doc.ref);
        // Alguém mexeu entre a consulta e agora (o dono reativou ou encerrou).
        if (!atual.exists || !bloqueioVencido(atual.get('bloqueio'), agora)) return null;
        const filhos = (await tx.get(db.collection('children').where('parentUid', '==', doc.id))).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        tx.set(doc.ref, { bloqueio: FieldValue.delete() }, { merge: true });
        tx.set(db.collection('registroDoDono').doc(), {
          acao: ACAO.REATIVAR,
          donoUid: 'servidor',
          donoNome: 'Prazo da suspensão',
          alvoUid: doc.id,
          alvoPapel: PAPEL.FAMILIA,
          alvoNome: atual.get('name') || null,
          motivo: 'prazo_cumprido',
          motivoRotulo: 'O prazo da suspensão acabou',
          grau: null,
          ate: null,
          urgente: false,
          mensagem: null,
          evidencia: null,
          respostaAte: null,
          em: FieldValue.serverTimestamp(),
        });
        for (const { tioUid, nomes } of tiosParaAvisar(filhos)) {
          const texto = avisoAoTio({ acao: ACAO.REATIVAR, nomes });
          tx.set(db.collection('notifications').doc(), {
            userId: tioUid,
            type: texto.type,
            title: texto.title,
            body: texto.body,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return filhos;
      });
      if (!criancas) continue;
      await aplicarNaContaDaFamilia(db, { alvoUid: doc.id, pedido: { acao: ACAO.REATIVAR }, criancas });
      reabertas += 1;
    } catch (err) {
      logger.error('[reabertura] não deu para reabrir a família', { uid: doc.id, err: err?.message });
    }
  }
  return { lidas: snap.size, reabertas };
}

function makeReabrirSuspensoesVencidas(db) {
  return onSchedule(
    {
      // 0h20 — o dia de Brasília acabou de virar, e o "até ontem" já venceu.
      schedule: '20 0 * * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      retryCount: 2,
      concurrency: 1,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      const r = await reabrirSuspensoesVencidas(db);
      logger.info('[reabertura] suspensões vencidas reabertas', r);
      return null;
    }
  );
}

module.exports = { makeReabrirSuspensoesVencidas, reabrirSuspensoesVencidas };
