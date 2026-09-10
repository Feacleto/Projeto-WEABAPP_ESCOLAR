const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const {
  ESTADO,
  chaveDoTelefone,
  contarAtivas,
  escolherParaAtivar,
} = require('./indicacao');

/**
 * CASAR E ATIVAR A INDICAÇÃO quando o indicado paga — do lado do SERVIDOR.
 *
 * ── POR QUE ISTO PRECISOU EXISTIR (09/09/2026)
 * `casarEAtivar` vivia só no cliente (`src/services/indicacaoService.js`),
 * chamada depois da baixa MANUAL da fatura, na aba Mês. A regra do produto é
 * que a indicação vale quando o indicado PAGA — e "pagar" passou a ter dois
 * caminhos: a baixa manual e o webhook do gateway.
 *
 * Sem esta cópia, ligar o gateway apagaria o gatilho da indicação para 100%
 * dos indicadores, **em silêncio**. Ninguém receberia erro; o desconto
 * simplesmente não apareceria na fatura seguinte.
 *
 * E a queixa que isso produz — *"indiquei e não recebi"* — é, numa rede de
 * indicação, a que viaja mais rápido que a própria indicação.
 *
 * ── POR QUE O CASAMENTO É AQUI E NÃO NO CADASTRO DO INDICADO
 * Casar no cadastro exigiria `allow list` de `indicacoes` para qualquer
 * motorista — e uma consulta por `chave` não é escopada por dono, então isso
 * entregaria os telefones que a base inteira indicou. O momento é o certo de
 * qualquer forma: a indicação vale quando o indicado paga.
 *
 * ── ELE RECONTA, NÃO INCREMENTA
 * `indicacoesAtivas` é gravado com a contagem RECONTADA, não com `+1`. O
 * webhook e a baixa manual podem quitar a mesma fatura, e um incremento
 * duplicado ficaria errado para sempre — enquanto uma recontagem chega ao
 * mesmo número quantas vezes rodar.
 *
 * ── NUNCA LANÇA
 * Isto roda DEPOIS de a fatura já estar quitada. A baixa não pode falhar por
 * causa do desconto de um terceiro, e o webhook não pode devolver 500 (o que
 * faria o gateway reentregar um evento já aplicado). Mesma decisão do gêmeo do
 * cliente, pelo mesmo motivo.
 *
 * @returns 1 se ativou agora, 0 se não havia o que ativar
 */
async function casarEAtivarIndicacao(db, tioUid) {
  try {
    if (!tioUid) return 0;

    const tioSnap = await db.doc(`users/${tioUid}`).get();
    if (!tioSnap.exists) return 0;

    const chave = chaveDoTelefone(tioSnap.get('phone'));
    if (!chave) return 0;

    // A coleção inteira, como no cliente: a consulta por `chave` acharia as
    // pendentes, mas não as já casadas por uid — e a regra de escolha precisa
    // das duas para decidir. Admin SDK não passa por rules, então não há
    // escopo a provar aqui; a coleção é pequena por natureza (uma linha por
    // indicação feita na plataforma).
    const snap = await db.collection('indicacoes').get();
    const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const escolhida = escolherParaAtivar({
      indicacoes: todas,
      indicadoUid: tioUid,
      chave,
    });
    if (!escolhida) return 0;

    // RECONTA as do indicador, incluindo a que está sendo ativada agora.
    const dele = todas.filter((i) => i.indicadorUid === escolhida.indicadorUid);
    const jaAtivas = contarAtivas(dele);

    const agora = admin.firestore.FieldValue.serverTimestamp();
    const lote = db.batch();
    lote.update(db.doc(`indicacoes/${escolhida.id}`), {
      estado: ESTADO.ATIVA,
      indicadoUid: tioUid,
      cadastradoEm: escolhida.cadastradoEm || agora,
      ativaEm: agora,
    });
    lote.set(
      db.doc(`users/${escolhida.indicadorUid}`),
      { indicacoesAtivas: jaAtivas + 1 },
      { merge: true }
    );
    await lote.commit();

    /* ⚠️ O AVISO TAMBÉM PRECISA EXISTIR NOS DOIS CAMINHOS DE BAIXA.
     *
     * É a mesma lição que fez este arquivo nascer: o casamento vivia só no
     * cliente, e ligar o gateway teria apagado o gatilho da indicação para
     * 100% dos indicadores, em silêncio. Se o aviso ficasse só do lado de lá,
     * quem fosse casado pelo webhook ganharia o desconto e não saberia — que é
     * exatamente o *"indiquei e não recebi"* que ele existe pra matar.
     *
     * Fora do lote e depois do commit: o aviso de um terceiro não pode fazer a
     * baixa da fatura falhar. */
    try {
      const n = jaAtivas + 1;
      await db.collection('notifications').add({
        userId: escolhida.indicadorUid,
        type: 'indicacao_ativou',
        title: 'Sua indicação valeu',
        // ⚠️ ESTAS DUAS FRASES SÃO AS MESMAS DE `notifyIndicacaoAtivou`, no
        // cliente, e é de propósito: o mesmo fato chega pelos dois caminhos
        // de baixa (o webhook do gateway e a baixa manual do dono), e duas
        // redações fariam o indicador achar que são dois eventos.
        //
        // O que o servidor NÃO tem é o valor em reais: ele depende da faixa e
        // dos outros descontos do indicador, e buscá-los aqui poria uma
        // leitura a mais dentro do caminho da baixa. Por isso ele fica na
        // versão sem valor — a mesma que o cliente usa quando não recebe o
        // número.
        body:
          n > 1
            ? `São ${n} indicações ativas na sua próxima fatura.`
            : 'Uma indicação sua começou a pagar, e já entra na sua próxima fatura.',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.warn('[indicacao] não deu pra avisar o indicador', err);
    }

    logger.info('[indicacao] ativada pela baixa do gateway', {
      indicacao: escolhida.id,
      indicador: escolhida.indicadorUid,
      indicado: tioUid,
      ativasAgora: jaAtivas + 1,
    });
    return 1;
  } catch (err) {
    // ENGOLE, e é decidido — ver o cabeçalho.
    logger.error('[indicacao] não deu para casar/ativar na baixa do gateway', {
      tioUid,
      erro: err?.message || String(err),
    });
    return 0;
  }
}

module.exports = { casarEAtivarIndicacao };
