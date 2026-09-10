const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirDono } = require('./papeis');
const { decidir, planoDaViagem, TIRAR_COORDENADA } = require('./reguaDaLimpeza');

const REGION = 'southamerica-east1';
/** O Firestore recusa lotes acima de 500. 400 deixa folga. */
const LOTE = 400;

/**
 * APAGA A COORDENADA DO MOTORISTA QUE FICOU GRAVADA NOS CHECKPOINTS.
 *
 * ── POR QUE ISTO É CLOUD FUNCTION, E NÃO SÓ O SCRIPT
 * A limpeza existe como script (`scripts/limpar-coordenada-do-checkpoint.cjs`)
 * e ele funciona — mas exige uma **chave de serviço** baixada do console, que
 * abre o projeto inteiro sem nenhuma rule. Pedir isso a quem só queria
 * apagar um campo é caro e é um risco novo maior que o problema.
 *
 * Aqui o privilégio já existe: a function roda com Admin SDK, e quem autoriza
 * é o login do dono que ele já tem. Nenhuma chave sai do console.
 *
 * ⚠️ **AS RULES PROÍBEM ESTA ESCRITA A TODO MUNDO, INCLUSIVE AO DONO** — ele
 * lê `children` inteiro para contar a base ("ler não é operar, escrita segue
 * proibida pra ele") e `rides` ele nem lê. Não é buraco: uma limpeza que
 * atravessa a base é privilegiada por definição, e o lugar dela é aqui.
 *
 * ── ELA NÃO APAGA NADA POR PADRÃO
 * Sem `{ apagar: true }` ela só CONTA e devolve o relatório. O botão do
 * painel faz as duas chamadas em ordem, e a segunda só depois de a pessoa ler
 * a primeira. Ação destrutiva que acontece no primeiro clique é o que
 * transforma "vou dar uma olhada" em incidente.
 *
 * ── ⚠️ ELA TEM PRAZO DE VALIDADE
 * Isto é manutenção de UMA vez: quando o relatório vier zerado em produção,
 * esta function, `reguaDaLimpeza.js`, o script, o teste e o bloco do painel
 * saem juntos. Function de manutenção que fica é código morto se passando por
 * vivo — e esta escreve na base inteira.
 *
 * ── O QUE SE CURA SOZINHO, E O QUE NÃO
 * `children.lastStatusCheckpoint` é SUBSTITUÍDO inteiro pelo `advanceChild`,
 * então a turma que continua rodando se limpa sozinha na próxima entrega. O
 * que não se cura é `rides`: o id do documento é o DIA, e o de ontem nunca é
 * escrito de novo. Mais as crianças que pararam de rodar, que não têm próxima
 * entrega. É por essas duas que esta varredura existe.
 */
function makeLimparCoordenadaDoCheckpoint(db) {
  return onCall(
    { region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirDono(db, request);
      const apagar = request.data?.apagar === true;

      const conta = {
        apagou: apagar,
        criancas: 0,
        criancasComCoordenada: 0,
        viagens: 0,
        viagensComCoordenada: 0,
        coordenadasTiradas: 0,
        checkpointsInteiros: 0,
      };

      let lote = db.batch();
      let noLote = 0;
      const gravar = async (ref, patch) => {
        if (!apagar) return;
        lote.update(ref, patch);
        noLote += 1;
        if (noLote >= LOTE) {
          await lote.commit();
          lote = db.batch();
          noLote = 0;
        }
      };
      /** Os caminhos da régua viram `delete()` só aqui — ela não conhece SDK. */
      const apagarCaminhos = (caminhos) =>
        Object.fromEntries(caminhos.map((c) => [c, FieldValue.delete()]));

      // ── children.lastStatusCheckpoint ───────────────────────────────
      const criancas = await db.collection('children').get();
      conta.criancas = criancas.size;
      for (const doc of criancas.docs) {
        const decisao = decidir(doc.get('lastStatusCheckpoint'));
        if (decisao === 'nada') continue;

        conta.criancasComCoordenada += 1;
        if (decisao === TIRAR_COORDENADA) {
          conta.coordenadasTiradas += 1;
          await gravar(doc.ref, {
            'lastStatusCheckpoint.lat': FieldValue.delete(),
            'lastStatusCheckpoint.lng': FieldValue.delete(),
          });
        } else {
          conta.checkpointsInteiros += 1;
          await gravar(doc.ref, { lastStatusCheckpoint: FieldValue.delete() });
        }
      }

      // ── rides/{dia}.checkpoints ─────────────────────────────────────
      //
      // `collectionGroup` porque `rides` é subcoleção de cada criança:
      // varrer criança por criança seria uma consulta por documento, e a
      // viagem existe por DIA — a conta cresce com o calendário.
      const viagens = await db.collectionGroup('rides').get();
      conta.viagens = viagens.size;
      for (const doc of viagens.docs) {
        const plano = planoDaViagem(doc.get('checkpoints'));
        if (!plano.mexeu) continue;

        conta.viagensComCoordenada += 1;
        conta.coordenadasTiradas += plano.tiradas;
        conta.checkpointsInteiros += plano.inteiros;
        await gravar(
          doc.ref,
          plano.apagarMapa
            ? { checkpoints: FieldValue.delete() }
            : apagarCaminhos(plano.caminhos)
        );
      }

      if (apagar && noLote > 0) await lote.commit();

      conta.total = conta.coordenadasTiradas + conta.checkpointsInteiros;
      logger.info('[limpeza] coordenada do checkpoint', { uid, ...conta });
      return conta;
    }
  );
}

module.exports = { makeLimparCoordenadaDoCheckpoint };
