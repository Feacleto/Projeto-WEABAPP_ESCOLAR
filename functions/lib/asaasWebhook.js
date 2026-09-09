const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { QUITADA, efeitoDoEvento, assinaturaAteDoMes } = require('./eventoDeCobranca');
const { casarEAtivarIndicacao } = require('./casarIndicacao');
const LIMITES = require('./limites');

const REGION = 'southamerica-east1';

/**
 * O WEBHOOK DO GATEWAY — a única porta por onde o dinheiro entra no app.
 *
 * ⚠️ ELA É PÚBLICA POR CONSTRUÇÃO, e é isso que define o desenho inteiro.
 * Um webhook não tem como exigir login: quem chama é um servidor de fora, sem
 * sessão. Então a URL sozinha não pode valer nada — sem o token no cabeçalho,
 * qualquer pessoa que descobrir o endereço manda um POST dizendo "a fatura X
 * foi paga" e o sistema dá baixa. Seria uso de graça sem deixar rastro de
 * invasão, porque não houve invasão: a porta estava destrancada.
 *
 * O token é gerado no painel do gateway, guardado em `functions:secrets` e
 * comparado aqui. Sem ele, 401 antes de qualquer leitura do corpo.
 *
 * POR QUE ELA RESPONDE 200 EM CASOS QUE NÃO PROCESSOU
 * O gateway REPETE a entrega enquanto não receber 2xx. Isso é bom para falha
 * de rede e péssimo para evento que nunca vai dar certo: uma cobrança que não
 * é nossa ficaria voltando para sempre, e com "fila sequencial" ligada ela
 * trava tudo o que vem depois.
 *
 * Então a regra é: 200 para "recebi e resolvi" E para "recebi e não é
 * comigo". O 5xx fica só para erro NOSSO — banco fora do ar, exceção
 * inesperada —, que é exatamente o caso em que repetir resolve.
 *
 * O QUE ELA NÃO FAZ, E É DE PROPÓSITO
 * Não decide nada. Qual evento libera, qual reabre e qual é ruído está em
 * `eventoDeCobranca.js`, que é regra pura com 30 casos de teste
 * (`npm run testar:cobranca`). Aqui só há transporte: valida, encontra a
 * fatura, aplica o que a regra disse.
 *
 * O ESTORNO NÃO APAGA `assinaturaAte`, E ISSO É DE PROPÓSITO
 * Uma cobrança estornada reabre a fatura, e quem bloqueia a partir daí é o
 * caminho do ATRASO — que `estadoDaConta` avalia ANTES da assinatura, e que dá
 * dez dias. Zerar o campo na hora bloquearia na mesma tarde alguém que talvez
 * esteja contestando uma cobrança indevida. A ordem das checagens já resolve.
 *
 * ENQUANTO NENHUMA COBRANÇA FOR CRIADA PELA API, nenhuma fatura tem
 * `asaasPaymentId` — e este endpoint vai receber eventos que não casam com
 * nada. Isso é esperado nesta etapa: ele registra no log e devolve 200. O
 * vínculo aparece quando a criação de cobrança existir.
 */
function makeAsaasWebhook(db, tokenSecret) {
  return onRequest(
    {
      region: REGION,
      // Teto de PÚBLICO: é o endpoint mais exposto do projeto, e o critério
      // do limites.js vale inteiro aqui — não é capacidade de pico, é quanto
      // de dano cabe numa madrugada.
      maxInstances: LIMITES.PUBLICO,
      secrets: [tokenSecret],
      cors: false,
    },
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // A VALIDAÇÃO VEM ANTES DE LER O CORPO. Assim um POST sem token nem
      // chega a custar processamento, e o log não guarda dado de quem não
      // provou ser o gateway.
      const esperado = tokenSecret.value();
      const recebido = req.get('asaas-access-token');
      if (!esperado || recebido !== esperado) {
        logger.warn('[asaas] chamada sem token válido', { ip: req.ip });
        res.status(401).send('unauthorized');
        return;
      }

      const evento = req.body?.event;
      const pagamento = req.body?.payment;
      const idPagamento = pagamento?.id;

      if (!evento || !idPagamento) {
        // Corpo que não parece evento de cobrança. 200 porque repetir não
        // muda nada — ver o cabeçalho.
        logger.info('[asaas] corpo sem event/payment; ignorado');
        res.status(200).send('ignored');
        return;
      }

      try {
        const busca = await db
          .collection('faturasParceiro')
          .where('asaasPaymentId', '==', idPagamento)
          .limit(1)
          .get();

        if (busca.empty) {
          // Cobrança que não é nossa, ou criada antes de existir o vínculo.
          // Registrar é o que permite descobrir isso sem adivinhação.
          logger.info('[asaas] evento sem fatura correspondente', {
            evento,
            idPagamento,
          });
          res.status(200).send('no-match');
          return;
        }

        const doc = busca.docs[0];
        // `quitadaPor` só existe quando a baixa foi MANUAL, na aba Mês
        // (`marcarFaturaPaga` o grava; o webhook não). É esse sinal que
        // distingue "o gateway confirmou" de "o dono conferiu o extrato" — e
        // a distinção importa para o `PAYMENT_DELETED`, que sobre uma fatura
        // baixada à mão não pode reabrir nada. Ver `efeitoDoEvento`.
        const quitadaPorPessoa = Boolean(doc.get('quitadaPor'));
        const { status: novo, motivo } = efeitoDoEvento(
          evento,
          doc.get('status'),
          quitadaPorPessoa
        );

        if (!novo) {
          logger.info('[asaas] evento sem efeito', { evento, fatura: doc.id, motivo });
          res.status(200).send('no-op');
          return;
        }

        // DOIS DOCUMENTOS, UM LOTE — e o segundo é o que destrava a conta.
        //
        // Este webhook marcava a fatura como quitada e parava aí. Só que quem
        // decide se o app abre é `users.assinaturaAte`, e só a baixa manual do
        // painel escrevia esse campo. O efeito era o pior desfecho que existe
        // em cobrança: o motorista pagava o PIX do gateway, a fatura virava
        // quitada, e o app continuava dizendo que a conta estava inativa — com
        // o comprovante na mão dele.
        //
        // Passou despercebido porque as duas metades foram escritas em
        // momentos diferentes e cada uma estava certa sozinha.
        //
        // O LOTE não é zelo: separados, uma falha entre as duas escritas
        // recria exatamente o mesmo defeito, só que raro — e raro em cobrança
        // é o que ninguém consegue reproduzir depois.
        const tioUid = doc.get('tioUid');
        const ate = novo === QUITADA ? assinaturaAteDoMes(doc.get('mes')) : null;

        // ⚠️ `assinaturaAte` NUNCA ANDA PARA TRÁS.
        //
        // A escrita era `set({ assinaturaAte: ate }, { merge: true })` sem
        // comparar com o que já estava lá. Como o próprio cabeçalho deste
        // arquivo diz que evento do gateway CHEGA FORA DE ORDEM, e como uma
        // fatura antiga em atraso pode ser quitada depois de uma nova, a data
        // podia RECUAR — e `isAdmin()` nas rules bloqueia a conta de quem está
        // em dia, às seis da manhã, com o comprovante na mão.
        //
        // `contratacao.js` faz exatamente esta comparação, com um comentário
        // explicando ("nunca REDUZ… `Math.max` de datas não existe, então a
        // comparação é explícita"). A metade do webhook ficou sem ela.
        //
        // A leitura vem ANTES do lote de propósito: o `set` com merge não sabe
        // o valor anterior, e uma transação aqui custaria a idempotência
        // simples que este handler tem hoje.
        let ateFinal = ate;
        if (ate && tioUid) {
          const tioSnap = await db.doc(`users/${tioUid}`).get();
          const atual = tioSnap.exists ? tioSnap.get('assinaturaAte') : null;
          const atualData = atual?.toDate?.() || (atual ? new Date(atual) : null);
          if (atualData && atualData >= ate) ateFinal = null;
        }

        // FATURA SEM `tioUid` É FALHA NOSSA, E CALAR RECRIA O DEFEITO.
        //
        // O `if (ate && tioUid)` antigo pulava a escrita em silêncio e o
        // `logger.info` do fim registrava `assinaturaAte: null` como se fosse
        // normal — ou seja, fatura quitada, app dizendo que a conta está
        // inativa, e nenhum sinal em lugar nenhum. Devolver 500 faz o gateway
        // reenviar, o que é o certo quando o defeito é do nosso lado.
        if (ate && !tioUid) {
          logger.error('[asaas] fatura quitada SEM tioUid — conta não destravada', {
            fatura: doc.id,
            evento,
          });
          res.status(500).send('fatura-sem-tioUid');
          return;
        }

        const lote = db.batch();
        lote.update(doc.ref, {
          status: novo,
          // A trilha de POR QUE mudou. Sem ela, uma fatura que reabriu sozinha
          // vira mistério — e mistério em cobrança vira desconfiança.
          asaasUltimoEvento: evento,
          asaasUltimoMotivo: motivo,
          atualizadoEm: new Date(),
          // QUEM DEU BAIXA E QUANDO — e a baixa manual já gravava isto.
          //
          // Sem estes dois campos, a ficha do parceiro mostrava `quitada` sem
          // data nem autor quando a baixa vinha do gateway, e não havia como
          // distinguir "o Asaas confirmou" de "o dono conferiu o extrato".
          //
          // `quitadaPor` fica com a marca do gateway, NÃO com um uid: é ela
          // que `efeitoDoEvento` usa para saber que a baixa foi de pessoa, e
          // uma baixa automática não pode se passar por manual.
          ...(novo === QUITADA
            ? { quitadaEm: new Date(), quitadaPeloGateway: true }
            : {}),
        });
        if (ateFinal && tioUid) {
          lote.set(db.doc(`users/${tioUid}`), { assinaturaAte: ateFinal }, { merge: true });
        }
        await lote.commit();

        // ⚠️ A INDICAÇÃO É CASADA AQUI, DEPOIS DO COMMIT.
        //
        // A regra do produto é que a indicação vale quando o indicado PAGA — e
        // até 09/09/2026 isso só acontecia na baixa MANUAL, porque
        // `casarEAtivar` existia apenas no cliente. Ligar o gateway apagaria o
        // gatilho para 100% dos indicadores, em silêncio.
        //
        // FORA DO LOTE de propósito: o lote é da fatura, e o desconto de um
        // terceiro não pode fazer a baixa falhar. `casarEAtivarIndicacao`
        // nunca lança, pelo mesmo motivo — e RECONTA em vez de incrementar,
        // porque o webhook e a baixa manual podem quitar a mesma fatura.
        if (novo === QUITADA && tioUid) {
          await casarEAtivarIndicacao(db, tioUid);
        }

        logger.info('[asaas] fatura atualizada', {
          fatura: doc.id,
          evento,
          novo,
          motivo,
          assinaturaAte: ateFinal ? ateFinal.toISOString().slice(0, 10) : null,
          // Distingue "não havia data a escrever" de "a data de lá já era
          // maior ou igual" — sem isto, os dois casos logam o mesmo `null`.
          assinaturaAteMantida: Boolean(ate && !ateFinal),
        });
        res.status(200).send('ok');
      } catch (err) {
        // 5xx SÓ AQUI: é o único caso em que repetir tem chance de dar certo.
        logger.error('[asaas] falha ao processar', { evento, idPagamento, err });
        res.status(500).send('internal');
      }
    }
  );
}

module.exports = { makeAsaasWebhook };
