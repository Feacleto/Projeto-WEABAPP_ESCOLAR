const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { exigirDono, ehMotorista } = require('./papeis');
const {
  podeCobrar,
  dadosDaCobranca,
  dadosDoCliente,
  documentoValido,
} = require('./cobrancaDaTaxa');
const asaas = require('./asaasApi');

const REGION = 'southamerica-east1';

/**
 * GERAR A COBRANÇA DA TAXA NO GATEWAY — a outra metade do webhook.
 *
 * O `asaasWebhook` já sabe dar baixa quando um pagamento é confirmado, mas ele
 * encontra a fatura por `asaasPaymentId` — e esse campo não nascia em lugar
 * nenhum. Enquanto isso, todo evento que chegava respondia `no-match`. Esta
 * função é quem cria o vínculo.
 *
 * ── QUEM CHAMA É O DONO, NUNCA O MOTORISTA
 * Cobrança criada pelo cobrado é cláusula editada pelo devedor. É a mesma
 * forma de `limiteCriancas` e de `assinaturaAte`: quem escreve é quem cobra.
 * `exigirDono` vem antes de qualquer leitura, e o `tioUid` chega no payload
 * porque o dono age sobre a base dos outros por definição — o oposto de
 * `runPaymentRemindersNow`, onde o escopo TEM que sair do chamador.
 *
 * ── O DOCUMENTO É O BLOQUEIO REAL DESTA ETAPA
 * O gateway não cria cliente sem CPF/CNPJ, e o app NÃO COLETA ESSE CAMPO em
 * lugar nenhum: nem o cadastro do motorista, nem o contrato de associação
 * (`montarContrato` grava nome, cidade, e-mail e telefone do associado — e só).
 *
 * Então ele entra pela mão do dono, na primeira cobrança, e fica guardado em
 * `taxaParceiros/{uid}` — que é a coleção que só o dono lê, nem o próprio
 * motorista. CPF é dado pessoal: ele não vai para `users`, que o motorista lê,
 * nem para a fatura, que ele também lê.
 *
 * Quando o cadastro passar a pedir o documento, esta função continua igual —
 * ela já prefere o que estiver guardado.
 *
 * ── COBRAR DUAS VEZES É O PIOR DESFECHO, E TEM DUAS GUARDAS
 * A primeira é `podeCobrar()`, que recusa fatura já ligada a uma cobrança. A
 * segunda pergunta ao PRÓPRIO GATEWAY se o `externalReference` desta fatura já
 * existe lá — porque entre criar a cobrança e gravar o id há uma janela, e uma
 * queda dentro dela deixa cobrança órfã no gateway e nenhum vestígio aqui.
 * Nesse caso a cobrança existente é ADOTADA, não recriada.
 *
 * ── ELA SÓ SABE LER `faturasParceiro`
 * A mensalidade da família não passa por aqui e não pode passar: item 7 dos
 * Termos, e promessa publicada. Ver o cabeçalho de `cobrancaDaTaxa.js`.
 */
function makeCriarCobrancaDaFatura(db, apiKeySecret, ambienteParam) {
  return onCall(
    {
      region: REGION,
      secrets: [apiKeySecret],
      maxInstances: LIMITES.AUTENTICADO,
    },
    async (request) => {
      await exigirDono(db, request);

      const tioUid = String(request.data?.tioUid || '').trim();
      const mes = String(request.data?.mes || '').trim();
      if (!tioUid || !/^[0-9]{4}-[0-9]{2}$/.test(mes)) {
        throw new HttpsError('invalid-argument', 'Informe o motorista e o mês (AAAA-MM).');
      }

      const cfg = { ambiente: ambienteParam.value(), apiKey: apiKeySecret.value() };

      // ── a fatura ───────────────────────────────────────────────────────
      const faturaId = `${tioUid}_${mes}`;
      const faturaRef = db.doc(`faturasParceiro/${faturaId}`);
      const faturaSnap = await faturaRef.get();
      const fatura = faturaSnap.exists ? faturaSnap.data() : null;

      const { pode, motivo } = podeCobrar(fatura);
      if (!pode) throw new HttpsError('failed-precondition', motivo);

      // ── o motorista ────────────────────────────────────────────────────
      const tioSnap = await db.doc(`users/${tioUid}`).get();
      if (!tioSnap.exists || !ehMotorista(tioSnap.data())) {
        throw new HttpsError('failed-precondition', 'Este uid não é de um motorista associado.');
      }
      const motorista = tioSnap.data();

      // ── o cliente no gateway ───────────────────────────────────────────
      const parceiroRef = db.doc(`taxaParceiros/${tioUid}`);
      const parceiro = (await parceiroRef.get()).data() || {};

      // Guardado vence digitado: quem já tem cadastro no gateway não deve
      // ganhar um segundo por causa de um documento redigitado com erro.
      const documento = documentoValido(parceiro.cpfCnpj || request.data?.cpfCnpj);
      if (!documento) {
        throw new HttpsError(
          'failed-precondition',
          'Informe o CPF ou CNPJ do motorista — o gateway não cria cobrança sem ele.'
        );
      }

      let clienteId = parceiro.asaasCustomerId || null;
      try {
        if (!clienteId) {
          // Procurar antes de criar: o motorista pode já existir lá de uma
          // tentativa anterior que não chegou a gravar aqui.
          const achado = await asaas.acharClientePorDocumento(cfg, documento);
          clienteId = achado?.id || null;
        }
        if (!clienteId) {
          const novo = await asaas.criarCliente(
            cfg,
            dadosDoCliente({ motorista, cpfCnpj: documento, tioUid })
          );
          clienteId = novo?.id || null;
        }
        if (!clienteId) {
          throw new HttpsError('internal', 'O gateway não devolveu o cliente.');
        }

        // Gravado ANTES da cobrança: se a criação falhar, o cadastro do
        // cliente não se perde e a próxima tentativa não cria um duplicado.
        await parceiroRef.set(
          { asaasCustomerId: clienteId, cpfCnpj: documento },
          { merge: true }
        );

        // ── a cobrança ───────────────────────────────────────────────────
        // A segunda guarda: ver o cabeçalho.
        let cobranca = await asaas.acharCobrancaPorReferencia(cfg, faturaId);
        const reaproveitada = Boolean(cobranca);

        if (!cobranca) {
          cobranca = await asaas.criarCobranca(
            cfg,
            dadosDaCobranca({ fatura, faturaId, clienteId })
          );
        }
        if (!cobranca?.id) {
          throw new HttpsError('internal', 'O gateway não devolveu a cobrança.');
        }

        await faturaRef.set(
          {
            asaasPaymentId: cobranca.id,
            // O link que o motorista abre para pagar. Ele lê a própria fatura
            // — é por aqui que a tela `/tio/taxa` vai oferecer o PIX.
            asaasUrl: cobranca.invoiceUrl || null,
            asaasCriadaEm: new Date(),
          },
          { merge: true }
        );

        logger.info('[asaas] cobrança ligada à fatura', {
          fatura: faturaId,
          cobranca: cobranca.id,
          reaproveitada,
        });

        return {
          faturaId,
          paymentId: cobranca.id,
          url: cobranca.invoiceUrl || null,
          valor: cobranca.value ?? fatura.total,
          vencimento: cobranca.dueDate || null,
          reaproveitada,
        };
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        if (err instanceof asaas.ErroDoGateway) {
          // 0 e 5xx = pode ter sido o caminho, não o pedido: repetir tem
          // chance. 4xx é recusa do conteúdo, e repetir só repete o erro.
          const codigo = err.status === 0 || err.status >= 500 ? 'unavailable' : 'failed-precondition';
          logger.error('[asaas] recusa do gateway', {
            fatura: faturaId,
            status: err.status,
            codigo: err.codigo,
          });
          throw new HttpsError(codigo, err.descricao || 'O gateway recusou a cobrança.');
        }
        logger.error('[asaas] falha ao criar cobrança', { fatura: faturaId, err });
        throw new HttpsError('internal', 'Não deu para criar a cobrança agora.');
      }
    }
  );
}

module.exports = { makeCriarCobrancaDaFatura };
