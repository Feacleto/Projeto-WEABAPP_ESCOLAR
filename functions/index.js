/**
 * Cloud Functions do Alô Buzinou — o índice. Cada function mora num arquivo
 * de `lib/`, e o mapa delas está no CLAUDE.md ("Cloud Functions").
 *
 * E-mail (Resend): só a cobrança da PLATAFORMA ao motorista, desde
 * 03/10/2026 (`lib/emailDoAviso.js`). Configuração, uma vez:
 *   firebase functions:secrets:set RESEND_API_KEY
 *   e o parâmetro EMAIL_REMETENTE, num domínio verificado no Resend.
 */

const { makeAsaasWebhook } = require('./lib/asaasWebhook');
const { makeCriarCobrancaDaFatura } = require('./lib/asaasCobranca');
const { makeContratarPlano } = require('./lib/contratacao');
const {
  makeFecharMesDosParceiros,
  makeFecharMesAgora,
} = require('./lib/fechamento');
const {
  makeCalcularNiveis,
  makeRecalcularMeuNivel,
} = require('./lib/niveis');
const { makeEnviarAvisosComerciais } = require('./lib/enviarAvisos');
const { makeCasarNoCadastro } = require('./lib/casarNoCadastro');
const { makeVincularIrmao, makeRecusarIrmao } = require('./lib/vincularIrmao');
const { makeDesvincularResponsavel } = require('./lib/desvincularResponsavel');
const { makeAceitarContrato } = require('./lib/aceitarContrato');
const { makeInformarTelefoneDaEscola } = require('./lib/telefoneDaEscola');
const { makeMeuCodigoDeIndicacao } = require('./lib/codigoDeIndicacao');
const {
  makeConvidarAuxiliar,
  makeCancelarConviteDeAuxiliar,
  makeVerConviteDeAuxiliar,
  makeAceitarConviteDeAuxiliar,
  makeDesativarAuxiliar,
  makeMarcarParadaPelaAuxiliar,
} = require('./lib/auxiliares');
const { makeEspelharCriancaParaAuxiliar, makeEspelharFaltaParaAuxiliar } = require('./lib/turmaDaAuxiliar');
const {
  makeGerarAcessoDeSubstituta,
  makeEncerrarAcessoDeSubstituta,
  makeVerRotaDaSubstituta,
} = require('./lib/substitutaDeUmDia');
const { makeAnotarPagamentoDaAuxiliar, makeConfirmarRecebimentoDaAuxiliar } = require('./lib/pagamentosDaAuxiliar');
const {
  makeRecomendarAuxiliar,
  makeRetirarRecomendacao,
  makeResponderRecomendacao,
  makeRemoverRecomendacaoAbusiva,
  makeAvaliarTio,
  makeMinhaNotaDasAuxiliares,
  makeLimparAvaliacoesDaContaApagada,
} = require('./lib/avaliacoesDaAuxiliar');
const { makeRegistrarInteresseInvestidor } = require('./lib/interesseInvestidor');
const {
  makePedirAcessoPeloTelefone,
  makeResponderPedidoDeAcesso,
} = require('./lib/pedidosDeAcesso');
const {
  makeLimparCoordenadaDoCheckpoint,
} = require('./lib/limpezaDoCheckpoint');
const { makeApagarViagensAntigas } = require('./lib/retencaoDasViagens');
const {
  makeCriarSenhaDoFinanceiro,
  makeConferirSenhaDoFinanceiro,
} = require('./lib/senhaDoFinanceiro');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

const {
  makeLookupInvite,
  makeRedeemInvite,
  makeGetShowcase,
} = require('./lib/invites');
const { makeCloseStaleRoutes } = require('./lib/routes');
const { makeSendPushOnNotification } = require('./lib/push');
const { makeAvisarAproximacao, makeAvisarBuzina } = require('./lib/avisosDaRota');
const { makeLimparAvisosAntigos } = require('./lib/limpezaDosAvisos');
const { makeFotografarBase } = require('./lib/fotoDaBase');
const { makeSuspenderConta } = require('./lib/registroDoDono');
const { makeAtualizarIndicesEconomicos } = require('./lib/indicesEconomicos');
const { makeContarCriancasAtivas } = require('./lib/contadorDaTurma');
const { makeLigarRelogioNaRota } = require('./lib/relogioNaRota');
const { makeRestaurarRelogio } = require('./lib/relogioDoTeste');
const { makeConfirmarAusencias } = require('./lib/confirmarAusencias');
const {
  makeGenerateMonthlyPayments,
  makeRunBillingNow,
} = require('./lib/billing');
const { makeGetInvitePreview } = require('./lib/invitePreview');
const { makeCartaoDoLink } = require('./lib/cartaoDoLink');
const { makeImagemDoCartao } = require('./lib/imagemDoCartao');
const {
  makeGerarAcessoDoDia,
  makeVerAcompanhamento,
  makeGerarAcessoTemporario,
  makeEncerrarAcessoTemporario,
  makeInscreverAvisosDoAcesso,
  makeAvaliarAcompanhamento,
} = require('./lib/acompanhamento');
const {
  makeEnviarAvisosDoDia,
  makeVarrerAtrasos,
  makeVarrerOfertas,
} = require('./lib/enviarAvisosDoDia');
const { makeFlagDuplicateReceipts } = require('./lib/receiptGuard');
const {
  makeBackfillTestimonialPrivacy,
} = require('./lib/privacyBackfill');

admin.initializeApp();
const db = admin.firestore();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Configuração — ajustar se trocar de domínio.
//
// EMAIL_REMETENTE (03/10/2026): era uma constante com o sandbox
//   `onboarding@resend.dev`, que SÓ ENTREGA ao e-mail do dono da conta do
//   Resend — ou seja, nenhum e-mail chegava a ninguém. Virou parâmetro: depois
//   de verificar o domínio no Resend, o deploy pergunta o valor (ou ele vem
//   do `functions/.env`), sem mexer em código. Ver docs/deploy.md.
const EMAIL_REMETENTE = defineString('EMAIL_REMETENTE', {
  default: 'Alô Buzinou <onboarding@resend.dev>',
  description: 'Remetente dos e-mails, num domínio verificado no Resend. Ex.: Alô Buzinou <avisos@alobuzinou.com.br>',
});

// ⚠️ O E-MAIL DE MENSALIDADE DA FAMÍLIA SAIU (decisão do dono, 03/10/2026).
// Aqui moravam `sendPaymentReminders` (agendado, 9h) e `runPaymentRemindersNow`
// (o disparo manual do motorista), que mandavam o lembrete por e-mail em 3
// dias antes e 3 de atraso. O e-mail ficou só para a cobrança da PLATAFORMA ao
// motorista (`lib/emailDoAviso.js`); a mensalidade é lembrada por push, em
// 5 dias antes, no dia e 7 de atraso (`lib/canalDaCobranca.js`). Com o
// vencimento padrão no dia 10, eram ~3.000 e-mails de uma vez no dia 7 —
// acima do plano grátis do Resend e do tempo da função.

// ===== Convites e lista de espera (ver functions/lib/invites.js) =====
//
// O resgate de convite saiu do cliente por segurança: as rules precisavam
// liberar leitura de toda criança pendente pra o app achar o código, e a
// landing autentica anonimamente — então qualquer visitante conseguia
// listar as crianças com endereço e telefone dos responsáveis.

exports.lookupInvite = makeLookupInvite(db);
exports.redeemInvite = makeRedeemInvite(db);
exports.getShowcase = makeGetShowcase(db);

// ===== Rota abandonada (ver functions/lib/routes.js) =====
//
// Fecha routeActive quando o motorista some sem encerrar. Sem isto o painel
// do pai mostrava a perua parada no mapa como se fosse a posição atual.

exports.closeStaleRoutes = makeCloseStaleRoutes(db);

// ===== Push (ver functions/lib/push.js) =====
//
// Amarrado na criação de notifications/{id}: todo aviso do app ganha push
// sem que cada caminho precise lembrar de enviar.

// O e-mail da cobrança da plataforma sai no MESMO gatilho (enviarEmailDoAviso.js).
// Avisos com mais de 90 dias saem todo dia às 4h (limpezaDosAvisos.js).
exports.limparAvisosAntigos = makeLimparAvisosAntigos(db);
// O IPCA de 12 meses (IBGE) para o "Preciso aumentar?", todo dia às 6h
// (indicesEconomicos.js). Só grava quando o número muda.
exports.atualizarIndicesEconomicos = makeAtualizarIndicesEconomicos(db);
// A foto diária da base para o painel do dono, às 23h50 de Brasília
// (fotoDaBase.js): só números, um documento por dia, só o dono lê.
exports.fotografarBase = makeFotografarBase(db);
// Suspender, avisar ou reativar um motorista, com a linha no registro de
// ações na mesma transação (registroDoDono.js). Só o dono chama.
exports.suspenderConta = makeSuspenderConta(db);
// O contador de crianças e o relógio do teste são do SERVIDOR (03/10/2026):
// o cliente não grava mais nenhum dos dois (rules).
exports.contarCriancasAtivas = makeContarCriancasAtivas(db);
exports.ligarRelogioNaRota = makeLigarRelogioNaRota(db);
exports.restaurarRelogio = makeRestaurarRelogio(db);
exports.sendPushOnNotification = makeSendPushOnNotification(db, {
  chave: RESEND_API_KEY,
  remetente: EMAIL_REMETENTE,
});
// "Está chegando" e a buzina com o app fechado (avisosDaRota.js).
exports.avisarAproximacao = makeAvisarAproximacao(db);
exports.avisarBuzina = makeAvisarBuzina(db);

// ===== Confirmação de véspera (ver functions/lib/confirmarAusencias.js) =====
//
// Às 19h pergunta ao responsável se a ausência marcada pra amanhã continua
// valendo. O app já pergunta isso na tela — mas quem esquece de desmarcar é,
// por definição, quem não está abrindo o app.

exports.confirmarAusencias = makeConfirmarAusencias(db);

// ===== Faturamento (ver functions/lib/billing.js) =====
//
// Saiu do cliente: rodava no hook useAutoBilling quando o tio abria o
// app, com trava em localStorage. Mes em que ele nao abrisse, ninguem
// era cobrado — e a limpeza de historico era exclusao em massa disparada
// sem confirmacao no carregamento da tela.

exports.generateMonthlyPayments = makeGenerateMonthlyPayments(db);
exports.runBillingNow = makeRunBillingNow(db);

// ===== Previa do convite (ver functions/lib/invitePreview.js) =====
//
// Chamavel SEM autenticacao: o pai abre o link e ja ve o que o app tem,
// antes de criar conta. Abrir NAO consome o convite — importante porque o
// WhatsApp busca a URL pra montar o cartao de previa.

exports.getInvitePreview = makeGetInvitePreview(db);

// O CARTÃO DO LINK NO WHATSAPP (04/10/2026): /convite/** e /quero-fazer-parte
// passam por aqui (rewrite em firebase.json), e o robô do WhatsApp lê a
// marca do tio certo no lugar do cartão único do app. Ver lib/cartaoDoLink.js.
exports.cartaoDoLink = makeCartaoDoLink(db);
// A IMAGEM GRANDE DO CARTÃO (1200x630, cor + logo + nome do tio), em
// /cartao/tio/<uid>.png e /cartao/app/<uid>.png. Ver lib/imagemDoCartao.js.
exports.imagemDoCartao = makeImagemDoCartao(db);

// A COMUNIDADE (05/10/2026, etapa 1): a foto da turma na época festiva, só
// com o "sim" de cada família, e os tios parceiros pela indicação. A foto
// some em 30 dias. Ver lib/comunidade.js e lib/reguaDaComunidade.js.
const {
  makePublicarFotoDaTurma,
  makeApagarFotoDaTurma,
  makeMinhasFotosDaTurma,
  makeMeusParceiros,
  makeLimparFotosVencidas,
  makeMinhaNotaDasFamilias,
  makeAvisarParceiroIndicado,
  makeFotosDaComunidade,
} = require('./lib/comunidade');
exports.publicarFotoDaTurma = makePublicarFotoDaTurma(db);
exports.apagarFotoDaTurma = makeApagarFotoDaTurma(db);
// F1.5: a auxiliar também posta (para as famílias, em nome do tio), e esta
// devolve a ela as fotos que postou e ainda estão no ar.
exports.minhasFotosDaTurma = makeMinhasFotosDaTurma(db);
exports.meusParceiros = makeMeusParceiros(db);
exports.limparFotosVencidas = makeLimparFotosVencidas(db);
// Etapa 2: a nota que as famílias dão ao tio (só ele vê, só a média fechada).
exports.minhaNotaDasFamilias = makeMinhaNotaDasFamilias(db);
// Fase 2 da rede: passar a família para um tio parceiro. Só para quem paga e
// fora do ar com a cobrança desligada; a criança NOVA nasce no aceite da
// família. Ver lib/transferencias.js e lib/reguaDaTransferencia.js.
const {
  makePedirTransferencia,
  makeResponderTransferencia,
  makeCancelarTransferencia,
  makeAceitarTransferencia,
} = require('./lib/transferencias');
exports.pedirTransferencia = makePedirTransferencia(db);
exports.responderTransferencia = makeResponderTransferencia(db);
exports.cancelarTransferencia = makeCancelarTransferencia(db);
exports.aceitarTransferencia = makeAceitarTransferencia(db);
// Fase 1 da rede: o parceiro fica sabendo que foi indicado a uma família
// (sem dado nenhum dela). A foto da turma avisa as famílias dentro de
// `publicarFotoDaTurma`, e as escolas do parceiro vêm em `meusParceiros`.
exports.avisarParceiroIndicado = makeAvisarParceiroIndicado(db);
// A foto da comunidade (05/10/2026): os tios parceiros e as famílias deles
// veem pela callable, com link de 15 minutos e o "sim" conferido na leitura.
exports.fotosDaComunidade = makeFotosDaComunidade(db);

/* ══ O LINK DO DIA ═══════════════════════════════════════════════════════
 * Quem vai pegar a criança hoje acompanha a entrega sem ter conta. As duas
 * pontas e o porquê de cada decisão estão em `lib/acompanhamento.js`; a régua
 * pura (o que pode ser visto, e se o link ainda vale) está em
 * `lib/reguaDoAcompanhamento.js`, que não requer nada de propósito. */
exports.gerarAcessoDoDia = makeGerarAcessoDoDia(db);
exports.verAcompanhamento = makeVerAcompanhamento(db);
// O acesso de 24 horas do segundo responsável (reguaDoAcessoTemporario.js).
exports.gerarAcessoTemporario = makeGerarAcessoTemporario(db);
exports.encerrarAcessoTemporario = makeEncerrarAcessoTemporario(db);
exports.inscreverAvisosDoAcesso = makeInscreverAvisosDoAcesso(db);
// A avaliação rápida de quem abriu o link (reguaDaAvaliacao.js).
exports.avaliarAcompanhamento = makeAvaliarAcompanhamento(db);

// ===== Comprovante reusado (ver functions/lib/receiptGuard.js) =====
//
// Nao verifica se o pagamento existiu — so a conciliacao com o extrato do
// banco faz isso. Detecta DUPLICATA: o mesmo arquivo em dois meses. E o
// resultado e um aviso pro tio, nao um bloqueio.

exports.flagDuplicateReceipts = makeFlagDuplicateReceipts(db);

// ===== Backfill de privacidade (ver functions/lib/privacyBackfill.js) =====
//
// O commit e005363 fechou a ESCRITA de nome completo e foto sem consentimento
// no documento publico de depoimento. Isto recolhe o que ja estava gravado —
// fechar a porta nao traz de volta o que ficou do lado de fora.
//
// Padrao e dry-run. Pra aplicar: { apply: true }.

exports.backfillTestimonialPrivacy = makeBackfillTestimonialPrivacy(db);

// ===== Webhook do gateway de cobrança (ver functions/lib/asaasWebhook.js) =====
//
// A única porta por onde o dinheiro entra no app, e a mais exposta: webhook
// não tem sessão, então a URL sozinha não pode valer nada. O token vem no
// cabeçalho `asaas-access-token`, é gerado no painel do gateway e vive em
// `functions:secrets` — sem ele, 401 antes de o corpo ser lido.
//
// Qual evento libera, qual reabre e qual é ruído NÃO se decide aqui: está em
// `lib/eventoDeCobranca.js`, regra pura com 30 casos (`npm run testar:cobranca`).

const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');

exports.asaasWebhook = makeAsaasWebhook(db, ASAAS_WEBHOOK_TOKEN);

// ===== Gerar a cobrança (ver functions/lib/asaasCobranca.js) =====
//
// A OUTRA METADE DO WEBHOOK. Ele encontra a fatura por `asaasPaymentId`, e
// esse campo não nascia em lugar nenhum — todo evento respondia `no-match`.
// Aqui é onde o vínculo é criado.
//
// Quem chama é o DONO, nunca o motorista: cobrança criada pelo cobrado é
// cláusula editada pelo devedor. E ela só sabe ler `faturasParceiro` — a
// mensalidade da família não passa pelo gateway, que é o item 7 dos Termos.
//
// O AMBIENTE PADRÃO É O SANDBOX de propósito. Chave de sandbox em produção
// devolve 401, que é falha barulhenta; apontar para produção sem querer cobra
// gente de verdade. Para virar a chave, `ASAAS_AMBIENTE=producao` no
// `.env.alobuzinou-be81f` das functions.

const ASAAS_API_KEY = defineSecret('ASAAS_API_KEY');
const ASAAS_AMBIENTE = defineString('ASAAS_AMBIENTE', { default: 'sandbox' });

exports.criarCobrancaDaFatura = makeCriarCobrancaDaFatura(
  db,
  ASAAS_API_KEY,
  ASAAS_AMBIENTE
);

// ===== Contratação (ver functions/lib/contratacao.js) =====
//
// O motorista escolhe a faixa e o SERVIDOR escreve a cláusula: `planoId` e
// `limiteCriancas` no mesmo write, mais o desconto de antecipação se ele ainda
// estiver dentro do teste.
//
// É function porque os dois campos estão na lista que o cliente nunca escreve:
// um é o que a fatura cobra, o outro é o que as rules cobram a cada criança
// cadastrada. Autoatendimento sem isto seria abrir a cláusula ao devedor.

exports.contratarPlano = makeContratarPlano(db);

/**
 * O FECHAMENTO DO MÊS DA ASSOCIAÇÃO — agendado, e à mão.
 *
 * ⚠️ ATÉ 10/09/2026 A FATURA DA PLATAFORMA SÓ NASCIA POR CLIQUE, e isso custava
 * conversão: o degrau da escada decai no relógio do servidor mesmo quando
 * ninguém fecha nada, então o motorista perdia 30% de desconto sem nunca ter
 * recebido um preço. As três faturas isentas do teste são a peça que ensina o
 * valor antes de ele importar — e dependiam de disciplina humana repetida.
 *
 * A callable continua existindo de propósito: agendada que falha em silêncio é
 * pior que clique, e o dono precisa poder fechar o mês que não rodou.
 */
exports.fecharMesDosParceiros = makeFecharMesDosParceiros(db);
exports.fecharMesAgora = makeFecharMesAgora(db);

// OS NÍVEIS DO MOTORISTA (docs/niveis.md). A agendada (5h30) faz a Platina
// cair quando um prazo vence; a callable faz o selo subir na hora — o
// motorista a chama ao abrir "Meu nível". Grava só o rótulo em `niveis/{uid}`,
// que as famílias dele também leem.
exports.calcularNiveis = makeCalcularNiveis(db);
exports.recalcularMeuNivel = makeRecalcularMeuNivel(db);

/**
 * A LIMPEZA DA COORDENADA — manutenção de UMA vez, e ela tem prazo.
 *
 * `checkpointFrom` gravava a posição do VEÍCULO do motorista em
 * `children.lastStatusCheckpoint` e em `rides/{dia}.checkpoints`, sem nenhum
 * leitor. O código parou em 10/09/2026; o que já está gravado sai por aqui.
 *
 * ⚠️ É function e não script porque a alternativa era uma CHAVE DE SERVIÇO
 * baixada do console — que abre o projeto inteiro sem rules, e é um risco
 * novo maior que o campo que ela vem apagar. As rules recusam esta escrita a
 * todo mundo, dono incluído, então o privilégio precisa vir de um lugar que
 * já o tem.
 *
 * ⚠️ **SEM `{ apagar: true }` ELA SÓ CONTA.**
 *
 * ⚠️ **ELA SAI DAQUI** quando o relatório vier zerado em produção, junto do
 * script, da régua, do teste e do bloco do painel.
 */
exports.limparCoordenadaDoCheckpoint = makeLimparCoordenadaDoCheckpoint(db);

/**
 * A RETENÇÃO DAS VIAGENS — 60 dias, todo dia às 4h30.
 *
 * Um documento por criança por dia letivo, para sempre, é arquivo que cresce
 * sozinho e que **nada lê depois do dia**: a única tela que abre uma viagem
 * pede a de HOJE. O prazo foi decidido pelo dono, e a Política de Privacidade
 * promete exatamente ele — mudar um exige mudar o outro na mesma alteração.
 *
 * ⚠️ Não toca no calendário de faltas: ele lê `absenceDeclarations`, que é
 * outra coleção e não tem prazo.
 */
exports.apagarViagensAntigas = makeApagarViagensAntigas(db);

/**
 * OS AVISOS COMERCIAIS — o único canal que alcança quem parou de abrir o app.
 *
 * Todo dia às 10h — uma hora DEPOIS do operacional, de propósito. A régua está em
 * `lib/avisosComerciais.js` e é pura: janela de silêncio, um assunto por
 * semana, nada para quem já contratou, e nenhum número que não venha da tabela.
 */
exports.enviarAvisosComerciais = makeEnviarAvisosComerciais(db);

// O GATILHO QUE TIRA O INDICADOR DE QUATRO MESES DE SILÊNCIO.
//
// `ESTADO.CADASTRADO` existia no domínio, era renderizado nas duas telas, e
// nada o gravava — ver o cabeçalho de `casarNoCadastro.js`. Ele NÃO ativa
// desconto nenhum: a carência continua sendo o primeiro mês pago.
exports.casarIndicacaoNoCadastro = makeCasarNoCadastro(db);

// O IRMÃO APARECE SOZINHO NO APP DO RESPONSÁVEL (02/10/2026). Criança nova
// cadastrada com o WhatsApp de um responsável que já usa o app entra na conta
// dele sem convite; ele recebe o aviso e pode desfazer ("Não é meu filho").
// Ver o cabeçalho de `vincularIrmao.js` e a régua em `reguaDoIrmao.js`.
exports.vincularIrmaoNoCadastro = makeVincularIrmao(db);
exports.recusarIrmao = makeRecusarIrmao(db);
// Tirar UMA criança da conta da família sem apagar a conta — ver o arquivo.
exports.desvincularResponsavel = makeDesvincularResponsavel(db);
exports.aceitarContrato = makeAceitarContrato(db);
exports.informarTelefoneDaEscola = makeInformarTelefoneDaEscola(db);
// O CUPOM DO "CARTÃO DO APP" (04/10/2026): o código de indicação do tio nasce
// no servidor, único, e é proibido ao cliente — ver o arquivo.
exports.meuCodigoDeIndicacao = makeMeuCodigoDeIndicacao(db);
// A CONTA DA AUXILIAR (05/10/2026): o quinto papel, sempre ligado a um
// motorista. Nasce só pelo convite dele, e ele desativa — ver o arquivo.
exports.convidarAuxiliar = makeConvidarAuxiliar(db);
exports.cancelarConviteDeAuxiliar = makeCancelarConviteDeAuxiliar(db);
exports.verConviteDeAuxiliar = makeVerConviteDeAuxiliar(db);
exports.aceitarConviteDeAuxiliar = makeAceitarConviteDeAuxiliar(db);
exports.desativarAuxiliar = makeDesativarAuxiliar(db);
// A AUXILIAR MARCA NA ROTA (fase 3): pelo servidor, porque ela não escreve em children.
exports.marcarParadaPelaAuxiliar = makeMarcarParadaPelaAuxiliar(db);
// A TURMA DA AUXILIAR (fase 2): a cópia sem valor que ela lê.
exports.espelharCriancaParaAuxiliar = makeEspelharCriancaParaAuxiliar(db);
exports.espelharFaltaParaAuxiliar = makeEspelharFaltaParaAuxiliar(db);
// O PAGAMENTO DA AUXILIAR (fase 4): ele anota que pagou (vira despesa do mês),
// ela confirma "Recebi". Só o servidor escreve o recibo dos dois.
exports.anotarPagamentoDaAuxiliar = makeAnotarPagamentoDaAuxiliar(db);
exports.confirmarRecebimentoDaAuxiliar = makeConfirmarRecebimentoDaAuxiliar(db);
// AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR: a recomendação dele (ela aprova) e
// a nota dela ao tio (só a equipe vê; ele, só a média com 3). Ver o arquivo.
exports.recomendarAuxiliar = makeRecomendarAuxiliar(db);
exports.retirarRecomendacao = makeRetirarRecomendacao(db);
exports.responderRecomendacao = makeResponderRecomendacao(db);
exports.removerRecomendacaoAbusiva = makeRemoverRecomendacaoAbusiva(db);
exports.avaliarTio = makeAvaliarTio(db);
exports.minhaNotaDasAuxiliares = makeMinhaNotaDasAuxiliares(db);
exports.limparAvaliacoesDaContaApagada = makeLimparAvaliacoesDaContaApagada(db);
// A SUBSTITUTA DE UM DIA (F3): o tio manda um link que vale só hoje a quem
// cobre a auxiliar; ela vê a ordem da rota, sem conta. Ver o arquivo.
exports.gerarAcessoDeSubstituta = makeGerarAcessoDeSubstituta(db);
exports.encerrarAcessoDeSubstituta = makeEncerrarAcessoDeSubstituta(db);
exports.verRotaDaSubstituta = makeVerRotaDaSubstituta(db);

// A SENHA DO FINANCEIRO (03/10/2026). A auxiliar usa o celular do motorista e
// não deve ver valores: o Financeiro abre com 4 números num teclado de banco.
// Desde a fase 4 (05/10/2026) a AUXILIAR usa as mesmas duas callables para a
// senha dos pagamentos DELA, no documento do próprio uid.
// O hash mora em `senhasDoFinanceiro/{uid}`, que nenhum cliente alcança; a
// conferência recebe os PARES tocados, nunca a senha. Ver o cabeçalho de
// `senhaDoFinanceiro.js` e a régua em `reguaDaSenhaDoFinanceiro.js`.
exports.criarSenhaDoFinanceiro = makeCriarSenhaDoFinanceiro(db);
exports.conferirSenhaDoFinanceiro = makeConferirSenhaDoFinanceiro(db);

// O RESPONSÁVEL SEM LINK PEDE ACESSO PELO WHATSAPP, E O MOTORISTA APROVA
// (02/10/2026). O número sozinho não vincula nada — só cria o pedido. Ver o
// cabeçalho de `pedidosDeAcesso.js`.
exports.pedirAcessoPeloTelefone = makePedirAcessoPeloTelefone(db);
exports.responderPedidoDeAcesso = makeResponderPedidoDeAcesso(db);

// O FORMULÁRIO DE INVESTIDOR DO SITE (02/10/2026). A landing chama
// /api/interesse-investidor e o hosting repassa para cá (firebase.json). Grava
// em `leadsInvestidor` e avisa o dono. Ver o cabeçalho de interesseInvestidor.js.
exports.registrarInteresseInvestidor = makeRegistrarInteresseInvestidor(db);

/* ══ OS AVISOS DE TEMPO ═══════════════════════════════════════════════════
 * Mensalidade vencendo, convite parado, fatura da plataforma e alvará. Todos
 * nascem de uma DATA chegando, e por isso precisam de alguém varrendo — não
 * há gesto que os dispare. A régua é pura (`reguaDosAvisos.js`) e testada sem
 * Firebase; este é só o relógio. */
exports.enviarAvisosDoDia = makeEnviarAvisosDoDia(db);

/* ⚠️ ESTA É A ÚNICA COM CADÊNCIA CURTA — de 20 em 20 minutos, e só nas duas
 * janelas de rota, em dia útil. "A rota atrasou" é o único aviso que precisa
 * existir quando o motorista NÃO está usando o app: quem dorme demais tem o
 * app fechado, então detectar pelo aparelho dele falha exatamente quando
 * importa. Ver o cabeçalho de `varrerAtrasos`. */
exports.varrerAtrasos = makeVarrerAtrasos(db);

/* ⚠️ O SEGUNDO TOQUE DA OFERTA DA PRIMEIRA ROTA. De 10 em 10 minutos, das 6h
 * às 20h, todos os dias — a primeira rota pode ser num sábado, e ela acontece
 * uma vez na vida de cada motorista. A consulta é por campo único e na maior
 * parte dos dias volta vazia. */
exports.varrerOfertas = makeVarrerOfertas(db);
