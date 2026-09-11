/**
 * O FECHAMENTO DO MÊS — a fatura da associação, emitida pelo servidor.
 *
 * ── POR QUE ISTO SAIU DO CLIENTE
 * `fecharFatura` morava em `src/services/taxaService.js` e só rodava quando o
 * dono abria a aba Mês e clicava "fechar todas". Enquanto ele não clicava, o
 * motorista não recebia fatura nenhuma — e o degrau da escada de fechamento
 * decaía no relógio do SERVIDOR do mesmo jeito.
 *
 * O efeito somado é o pior possível para a conversão: ele perdia o desconto de
 * 30% sem nunca ter visto um preço. A peça central do desenho comercial — três
 * faturas isentas, com o valor à vista, antes de ele importar — dependia de
 * disciplina humana repetida todo mês, para toda a base.
 *
 * ── O QUE ESTE ARQUIVO É, E O QUE ELE NÃO É
 * Ele ESCREVE. A conta é pura e mora em `reguaDoServidor.js`, espelhada do app
 * e comparada caso a caso por `npm run testar:gateway` — mais de mil
 * combinações de tamanho, plano, fundador, indicação e desconto.
 *
 * Este módulo faz o que a régua não pode: ler `users`, gravar
 * `faturasParceiro`, e estender `assinaturaAte` quando é o caso. Ele requer o
 * SDK, então nenhum script da bateria pode importá-lo — `testar:imports`
 * guarda isso.
 *
 * ── O BOTÃO DO DONO CONTINUA EXISTINDO
 * A agendada é o padrão, não o único caminho. Agendada que falha em silêncio é
 * pior que clique: o dono precisa poder fechar à mão quando algo não rodou, e
 * é por isso que `fecharFaturaDe` é exportada separada do gatilho.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirDono } = require('./papeis');
// ⚠️ `assinaturaAteDoMes` VEM DAQUI, e não de uma cópia local.
//
// Ela já existia em `eventoDeCobranca.js` (onde o webhook a usa para estender
// a assinatura na baixa) e em `contaAtiva.js`, no app — duas cópias que
// `npm run testar:gateway` compara mês a mês. Escrever uma TERCEIRA aqui, num
// arquivo que também estende assinatura, seria criar a divergência exatamente
// no ponto em que ela não apareceria: as duas antigas continuariam iguais, e a
// nova erraria sozinha na virada de dezembro.
const { assinaturaAteDoMes } = require('./eventoDeCobranca');
const { ESTADO, reconciliarIndicacoes } = require('./indicacao');
const { pararDeFaturar } = require('./reguaDoEncerramento');
const {
  PLANO,
  TAXA,
  planoValido,
  precoDoMes,
  isentoEm,
  mesDeTesteDe,
  dataDeVencimento,
  limitarDiaVencimento,
  DIAS_DE_TRIAL,
  condicoesLegadas,
} = require('./reguaDoServidor');

const REGION = 'southamerica-east1';

/** O mês de referência de uma data, 'AAAA-MM'. */
function mesDe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/** O mês ANTERIOR ao de `agora`. É esse que a agendada fecha no dia 1. */
function mesAnterior(agora) {
  const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 12, 0, 0);
  return mesDe(d);
}

/**
 * FATURA ZERADA ESTENDE A ASSINATURA — menos quando o zero é do TESTE.
 *
 * Espelha `faturaZeradaEstendeAssinatura`. Fundador vitalício e isenção
 * concedida produzem `total: 0` e nascem `quitada`, e `quitada` nunca passa
 * por baixa nem por webhook: sem estender aqui, o primeiro motorista da
 * plataforma seria bloqueado no dia 90 com a fatura marcada como paga.
 *
 * ⚠️ O MÊS DE TESTE É A EXCEÇÃO, e ela custou o paywall inteiro uma vez.
 * `estadoDaConta` devolve `ativa` assim que vê `assinaturaAte` no futuro,
 * ANTES de olhar o trial — estender aqui daria acesso além do dia 90, calaria
 * os três avisos e entregaria a frase do atraso por uma fatura que nunca
 * existiu. Com a agendada emitindo três faturas isentas por motorista, este
 * caminho deixou de ser raro e passou a ser o normal.
 */
function faturaZeradaEstendeAssinatura({ total, isencaoDeTeste = false } = {}) {
  if (Number(total) !== 0) return false;
  return !isencaoDeTeste;
}

/**
 * Fecha a fatura de UM parceiro num mês. Idempotente pelo id `{uid}_{mes}`.
 *
 * `motorista` é o doc de `users` com `uid` junto. `config` é `taxaConfig`.
 * Devolve `{ id, total, isento }` ou lança com o motivo — quem chama decide se
 * o motivo é erro (chamada manual) ou linha de log (varredura).
 */
async function fecharFaturaDe(db, { motorista, mes, config, ownerUid = null }) {
  const tioUid = motorista?.uid;
  if (!tioUid || !mes) throw new Error('Sem motorista ou mês.');

  // ── O PLANO: CONTRATADO, OU O MENSAL COMO VITRINE ──────────────────────
  //
  // Durante o teste ele não tem plano, e a fatura mostra o que ele PAGARIA no
  // mensal. É o ponto inteiro da fatura isenta: ele vê o preço três vezes
  // antes de ele importar.
  //
  // ⚠️ A VITRINE É O MENSAL, e não o anual, mesmo o anual sendo mais barato.
  // Mostrar o menor dos dois faria a primeira fatura de verdade parecer um
  // aumento para quem escolhesse o mensal.
  const plano = planoValido(motorista.plano) ? motorista.plano : null;
  const planoDaConta = plano || PLANO.MENSAL;
  const criancas = Number(motorista.criancasAtivas) || 0;

  const mesDeTeste = plano ? null : mesDeTesteDe(motorista.trialInicio, mes);
  const isentoPorConcessao = isentoEm(motorista.isencaoAte, mes);
  const isento = isentoPorConcessao || mesDeTeste !== null;

  const conta = precoDoMes({
    criancas,
    plano: planoDaConta,
    fundador: motorista.condicaoFundador || null,
    indicacoesAtivas: Number(motorista.indicacoesAtivas) || 0,
    descontos: motorista.descontos,
    mes,
  });

  // ⚠️ NÃO SE COBRA UM PLANO QUE ELE NUNCA ESCOLHEU. Fora do teste e sem
  // plano, a conta acima é a VITRINE — boa para mostrar e péssima para cobrar.
  if (!isento && !plano) {
    throw new Error('ainda não escolheu um plano');
  }
  if (!isento && conta.liquido === null) {
    throw new Error('plano desconhecido');
  }

  const total = isento ? 0 : conta.liquido;
  const dia = limitarDiaVencimento(config?.diaVencimento ?? 10);
  const venc = dataDeVencimento(mes, dia);

  const fimDoTeste =
    mesDeTeste !== null && motorista.trialInicio
      ? new Date(
          (motorista.trialInicio.toDate
            ? motorista.trialInicio.toDate()
            : new Date(motorista.trialInicio)
          ).getTime() +
            DIAS_DE_TRIAL * 24 * 60 * 60 * 1000
        )
      : null;

  const id = `${tioUid}_${mes}`;

  // ⚠️ AS DUAS ESCRITAS VÃO NO MESMO LOTE, E ISSO NÃO É ZELO.
  //
  // Eram dois `await` separados: a fatura, e depois `users.assinaturaAte`
  // quando a fatura zerada estende a assinatura. Entre um e outro cabe uma
  // falha de rede — e o desfecho é o pior possível, exatamente o que o
  // cabeçalho deste arquivo descreve como já tendo custado o paywall:
  //
  //   a fatura existe e está marcada `quitada`;
  //   `assinaturaAte` não andou;
  //   o mês seguinte bate em `jaTem.exists` e PULA o parceiro para sempre;
  //   `estadoDaConta` vê a assinatura vencida e as rules bloqueiam.
  //
  // O motorista abre o app, lê que está em atraso, e vê na mesma tela a
  // fatura do mês marcada como paga. E o log da varredura diz "parceiro não
  // fechou" — quando ele fechou pela metade.
  //
  // `marcarFaturaPaga`, em `taxaService.js`, já fazia o par oposto num lote
  // só, com a razão escrita: *"separados, uma falha de rede entre eles deixa
  // a fatura paga e a conta bloqueada — o pior desfecho possível"*. É a
  // mesma frase, e faltava aqui.
  const lote = db.batch();
  lote.set(
    db.doc(`faturasParceiro/${id}`),
    {
      tioUid,
      mes,

      // o plano e a conta, como eram neste mês
      plano: planoDaConta,
      planoRotulo: planoDaConta === PLANO.ANUAL ? 'Anual' : 'Mensal',
      // ⚠️ A CONTA ABERTA VIAJA NA FATURA, e é ela que a tela imprime linha a
      // linha. Guardar só o total transformaria cada fatura numa pergunta.
      criancas,
      taxaPorCrianca: TAXA[planoDaConta],
      precoTabela: conta.bruto,
      planoContratado: Boolean(plano),

      descontoTotal: conta.desconto,
      descontoFundador: conta.descontoFundador,
      descontoFechamento: conta.descontoFechamento,
      descontoIndicacao: conta.descontoIndicacao,
      descontoConcessao: conta.descontoConcessao,
      pisoAplicado: conta.pisoAplicado,
      descontoAbsorvido: conta.descontoAbsorvido,

      isento,
      motivoIsencao: isentoPorConcessao
        ? 'concessao'
        : mesDeTeste !== null
          ? 'teste'
          : null,
      mesDeTeste,
      testeAte: fimDoTeste ? Timestamp.fromDate(fimDoTeste) : null,

      total,
      vencimento: venc ? Timestamp.fromDate(venc) : null,
      diaVencimento: dia,

      // ⚠️ PARA ONDE PAGAR — COPIADO, NÃO REFERENCIADO, E ESTAVA FALTANDO.
      //
      // `TioTaxa` monta o BR Code a partir DESTES campos da fatura, não de
      // `taxaConfig`. A cópia do cliente (`taxaService.fecharFatura`) sempre
      // os gravou; esta, que nasceu quando o fechamento virou agendada, não.
      //
      // O efeito era o pior possível e completamente silencioso: TODA fatura
      // emitida pelo caminho normal — a agendada do dia 1 — chegava sem chave
      // PIX. O motorista abria `/tio/taxa`, via o valor, e lia "a plataforma
      // ainda não cadastrou a chave PIX". Ele não tinha como pagar, e nada em
      // lugar nenhum registrava erro.
      //
      // ⚠️ E É POR ISSO QUE ELES SÃO COPIADOS PARA DENTRO DA FATURA: o dado
      // de para onde pagar é do MOMENTO da cobrança. Referenciar `taxaConfig`
      // faria a chave de hoje reescrever a de uma fatura de seis meses atrás,
      // e o comprovante dela deixaria de bater com o documento.
      pixKey: config?.pixKey || '',
      pixKeyType: config?.pixKeyType || 'random',
      nomePlataforma: config?.nomePlataforma || '',
      cidadePlataforma: config?.cidadePlataforma || '',

      status: total === 0 ? 'quitada' : 'aberta',
      lancadaPor: ownerUid,
      lancadaEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (faturaZeradaEstendeAssinatura({ total, isencaoDeTeste: mesDeTeste !== null })) {
    const ate = assinaturaAteDoMes(mes);
    if (ate) {
      lote.set(
        db.doc(`users/${tioUid}`),
        { assinaturaAte: Timestamp.fromDate(ate) },
        { merge: true }
      );
    }
  }

  await lote.commit();

  return { id, total, isento };
}


/**
 * A RECONCILIAÇÃO DAS INDICAÇÕES — roda ANTES de fechar as faturas do mês.
 *
 * ── ⚠️ POR QUE AQUI, E NÃO NUMA AGENDADA PRÓPRIA
 * Esta varredura precisa de duas coisas que o fechamento já tem em mãos: a
 * lista de todo motorista e o instante certo. Uma agendada separada leria
 * `users` inteiro de novo, e — pior — poderia rodar DEPOIS do fechamento, o
 * que faria a fatura do mês sair com a contagem velha.
 *
 * ── ⚠️ A ORDEM É O PONTO INTEIRO
 * `fecharFaturaDe` lê `motorista.indicacoesAtivas` para calcular o desconto.
 * Reconciliar depois de fechar corrigiria o contador e deixaria a fatura
 * daquele mês cobrando o número antigo — o erro ficaria gravado num documento
 * que o motorista já recebeu. Por isso a contagem nova é INJETADA no objeto
 * do motorista antes de fechar.
 *
 * ── QUEM CONTA COMO PAGANTE, E POR QUE O CRITÉRIO É GROSSO
 * Tem plano contratado e não está suspenso. Deliberadamente NÃO usa o estado
 * fino da conta: com ele, uma fatura em atraso derrubaria a indicação e a
 * quitação a devolveria, e o indicador veria o desconto piscar de mês em mês.
 * Dez dias de atraso não deixam de ser cliente — **atraso não derruba, sair
 * derruba.**
 *
 * ── RECONTA, NUNCA DECREMENTA
 * `reconciliarIndicacoes` devolve a contagem inteira de cada indicador,
 * inclusive os zeros. Rodar duas vezes no mesmo dia — a agendada e o botão do
 * dono — chega no mesmo número.
 */
async function reconciliarAsIndicacoes(db, snapDeMotoristas) {
  const pagantes = [];
  for (const doc of snapDeMotoristas.docs) {
    const m = doc.data() || {};
    if (m.suspenso === true) continue;
    if (!planoValido(m.plano)) continue;
    pagantes.push(doc.id);
  }

  const snap = await db.collection('indicacoes').get();
  const indicacoes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const { encerrar, reabrir, ativasPorIndicador } = reconciliarIndicacoes({
    indicacoes,
    indicadosPagantes: pagantes,
  });

  // ⚠️ SÓ ESCREVE O QUE MUDOU. Sem esta comparação, toda virada de mês tocaria
  // o documento de todo motorista da base para regravar o mesmo número.
  const contagemAtual = new Map();
  for (const doc of snapDeMotoristas.docs) {
    contagemAtual.set(doc.id, Number((doc.data() || {}).indicacoesAtivas) || 0);
  }

  const escritas = [];
  encerrar.forEach((id) =>
    escritas.push([db.doc(`indicacoes/${id}`), { estado: ESTADO.ENCERRADA, encerradaEm: FieldValue.serverTimestamp() }])
  );
  reabrir.forEach((id) =>
    escritas.push([db.doc(`indicacoes/${id}`), { estado: ESTADO.ATIVA, reabertaEm: FieldValue.serverTimestamp() }])
  );
  Object.entries(ativasPorIndicador).forEach(([uid, n]) => {
    if (contagemAtual.get(uid) === n) return;
    escritas.push([db.doc(`users/${uid}`), { indicacoesAtivas: n }]);
  });

  // Lotes de 400, o mesmo tamanho de `confirmarAusencias` e `billing`.
  const TAMANHO_DO_LOTE = 400;
  for (let i = 0; i < escritas.length; i += TAMANHO_DO_LOTE) {
    const lote = db.batch();
    escritas.slice(i, i + TAMANHO_DO_LOTE).forEach(([ref, dados]) => lote.set(ref, dados, { merge: true }));
    await lote.commit();
  }

  logger.info('[indicacao] reconciliadas', {
    encerradas: encerrar.length,
    reabertas: reabrir.length,
    contadoresEscritos: escritas.length - encerrar.length - reabrir.length,
  });

  return ativasPorIndicador;
}

/**
 * Varre a base e fecha o mês de todo motorista que ainda não tem fatura dele.
 *
 * ⚠️ QUEM JÁ TEM FATURA NÃO É REFECHADO. O `setDoc` é idempotente pelo id, mas
 * refechar reescreveria `total` sobre uma fatura que talvez já tenha sido paga
 * — e `status` voltaria a 'aberta' num mês que o motorista quitou. A checagem
 * de existência é a guarda, e ela é barata: um `get` por parceiro.
 *
 * SUSPENSO FICA DE FORA. Cobrar quem a plataforma bloqueou é somar dívida a
 * uma relação que alguém já decidiu interromper.
 */
async function fecharMes(db, { mes, agora = new Date() }) {
  const alvo = mes || mesAnterior(agora);
  const config = (await db.doc('taxaConfig/geral').get()).data() || {};

  const snap = await db.collection('users').where('role', '==', 'admin').get();

  // ⚠️ ANTES DE FECHAR QUALQUER FATURA — ver `reconciliarAsIndicacoes`. Uma
  // indicação cujo indicado saiu precisa ter parado de descontar ANTES de o
  // mês ser cobrado, senão o erro entra num documento que já foi entregue.
  const ativasPorIndicador = await reconciliarAsIndicacoes(db, snap);

  // ⚠️ O RELATÓRIO DE LEGADO SAI TODO MÊS, E NÃO CUSTA UMA LEITURA A MAIS.
  //
  // Quatro instrumentos de desconto descrevem casos que não existem mais, e a
  // pendência de conferi-los na base estava escrita no CLAUDE.md desde
  // 07/09/2026 sem nunca ter sido conferida — porque dependia de alguém
  // lembrar de rodar um script. Pendência que depende de memória humana não é
  // pendência, é aposta.
  //
  // Esta varredura já tem todo motorista em mãos. Ou o log está limpo, ou ele
  // nomeia os uids — uma vez por mês, sem ninguém precisar decidir olhar.
  //
  // ⚠️ ELE RELATA, NÃO CONSERTA. As duas falhas de mexer sozinho são caras:
  // quem tem `antecipacao` veria a fatura subir sem explicação, e quem tem
  // `roleta` JÁ parou de receber o desconto sem ter sido avisado.
  const legado = [];
  for (const doc of snap.docs) {
    const marcas = condicoesLegadas(doc.data());
    if (marcas.length) legado.push({ uid: doc.id, marcas });
  }
  if (legado.length) {
    logger.warn('[legado] condições que a régua não concede mais', {
      quantos: legado.length,
      casos: legado.slice(0, 50),
    });
  }

  const resultado = { mes: alvo, fechadas: 0, puladas: 0, erros: 0 };

  for (const doc of snap.docs) {
    const motorista = { uid: doc.id, ...doc.data() };
    // O snapshot foi lido antes da reconciliação, então o objeto em memória
    // carrega a contagem velha. Quem fecha a fatura precisa da nova.
    if (ativasPorIndicador[doc.id] !== undefined) {
      motorista.indicacoesAtivas = ativasPorIndicador[doc.id];
    }
    if (motorista.suspenso === true) {
      resultado.puladas += 1;
      continue;
    }

    /* ⚠️ QUEM PEDIU PARA ENCERRAR NÃO RECEBE FATURA NOVA.
     *
     * É a cláusula 6 sendo cumprida, com as palavras dela: *"não há nova
     * cobrança a partir do encerramento, e ele opera até o fim do período já
     * pago"*. O acesso não é cortado aqui nem em lugar nenhum — `assinaturaAte`
     * expira sozinho, e as rules já negam quem está sem assinatura válida.
     *
     * ⚠️ O ANUAL QUE ESCOLHEU CUMPRIR O PRAZO CONTINUA SENDO FATURADO, e a
     * régua sabe disso: parar aqui daria meia dúzia de mensalidades de graça a
     * quem só avisou que não vai renovar.
     *
     * ⚠️ E ATRASO NÃO ENTRA NESTE RAMO. Quem deve continua sendo faturado e
     * continua devendo — encerrar é sobre o futuro. A régua é pura e espelha o
     * app (`npm run testar:encerramento`). */
    if (pararDeFaturar(motorista)) {
      resultado.puladas += 1;
      continue;
    }

    const jaTem = await db.doc(`faturasParceiro/${motorista.uid}_${alvo}`).get();
    if (jaTem.exists) {
      resultado.puladas += 1;
      continue;
    }

    try {
      await fecharFaturaDe(db, { motorista, mes: alvo, config, ownerUid: null });
      resultado.fechadas += 1;
    } catch (err) {
      // ⚠️ UM PARCEIRO QUE NÃO FECHA NÃO PODE DERRUBAR A VARREDURA. "Ainda não
      // escolheu um plano" é o caso comum de quem deixou o teste vencer, e
      // parar aqui deixaria todo mundo depois dele sem fatura naquele mês.
      resultado.erros += 1;
      logger.warn('[fechamento] parceiro não fechou', {
        uid: motorista.uid,
        mes: alvo,
        motivo: err?.message,
      });
    }
  }

  logger.info('[fechamento] mês fechado', resultado);
  return resultado;
}

/**
 * A AGENDADA — todo dia 1, às 5h de Brasília.
 *
 * Dia 1 e não dia 10 (o vencimento): a fatura precisa existir ANTES de vencer,
 * senão ela nasce vencida e o motorista recebe cobrança e atraso no mesmo
 * gesto. `cobrancaDaTaxa.js` já trata vencimento no passado como caso comum,
 * mas tratar não é o mesmo que provocar.
 */
function makeFecharMesDosParceiros(db) {
  return onSchedule(
    {
      schedule: '0 5 1 * *',
      timeZone: 'America/Sao_Paulo',
      region: REGION,
      maxInstances: LIMITES.AGENDADO,
      timeoutSeconds: LIMITES.TEMPO_AGENDADO,
      memory: LIMITES.MEMORIA_AGENDADO,
    },
    async () => {
      await fecharMes(db, { agora: new Date() });
    }
  );
}

/** O mesmo, à mão — o dono precisa poder fechar quando algo não rodou. */
function makeFecharMesAgora(db) {
  return onCall(
    { region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      await exigirDono(db, request);
      const mes = String(request.data?.mes || '').trim() || null;
      return await fecharMes(db, { mes, agora: new Date() });
    }
  );
}

module.exports = {
  makeFecharMesDosParceiros,
  makeFecharMesAgora,
  fecharFaturaDe,
  fecharMes,
  mesAnterior,
  assinaturaAteDoMes,
  faturaZeradaEstendeAssinatura,
};
