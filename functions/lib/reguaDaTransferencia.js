/**
 * PASSAR A FAMÍLIA PARA OUTRO TIO — a régua pura (fase 2 da rede, 05/10/2026,
 * plano aprovado pelo dono). Sem require de SDK: `npm run testar:imports`
 * guarda isso, e `npm run testar:transferencia` compara o espelho do app
 * (`src/dominio/identidade/transferencia.js`) caso a caso.
 *
 * O caminho tem três toques, um de cada pessoa:
 *   1. o tio de agora pede, na ficha da criança, escolhendo um PARCEIRO
 *      (quem ele indicou ou quem o indicou — nunca uma lista de tios);
 *   2. o parceiro aceita (ou recusa) vendo só o primeiro nome e a escola;
 *   3. a FAMÍLIA aceita, e só então qualquer dado dela vai para o parceiro.
 *
 * ── ⚠️ CRIANÇA NOVA, NUNCA O DONO DA ANTIGA TROCADO (decisão da QA)
 * O `adminUid` de `children` é imutável nas rules, e é ele que escopa
 * mensalidade, contrato, viagens e faltas. Trocar o dono levaria ao tio novo
 * cinco anos de pagamentos que não são dele, e tiraria do antigo o que ele
 * precisa guardar. O aceite cria um documento NOVO, a partir de uma LISTA
 * FECHADA de campos (`CAMPOS_QUE_VAO`), e a criança antiga fica inativa com
 * a data — mas continua sendo dele, e da família para ler o que já foi.
 *
 * ── ⚠️ O QUE NUNCA VAI (`CAMPOS_QUE_NUNCA_VAO`, o teste confere um por um)
 * Saúde e o consentimento dela (a autorização foi dada ao tio de antes),
 * foto (idem), o "sim" da foto da turma, mensalidade, vencimento, vigência,
 * contrato, horários, status da rota e o histórico. Nada da relação antiga
 * vai junto: atraso ou nota de família vista por outro tio é cadastro de mau
 * pagador (decisão 14). O tio novo combina tudo de novo, num contrato novo.
 *
 * ── ⚠️ SÓ PARA QUEM PAGA, E FORA DO AR COM A COBRANÇA DESLIGADA (dono)
 * Conta grátis recebendo turma é o "teste infinito": passar a turma para uma
 * conta nova no fim do teste e nunca pagar. "Pagante" é o critério grosso da
 * indicação — tem plano e não está suspenso (atraso não derruba).
 * Quem ainda não paga pode RECEBER, mas fecha a assinatura antes
 * (`precisaAssinar`): a família que chega por um colega é o melhor canal que
 * existe, e o tio novo não pode perdê-la por ainda estar no teste.
 *
 * ── O DINHEIRO
 * A mensalidade em aberto fica com o tio de antes (é dele, no documento
 * dele). A criança nova só é cobrada a partir do MÊS SEGUINTE
 * (`primeiroMesCobrado`, que o billing respeita): sem isso, a família pagaria
 * o mesmo mês duas vezes, uma a cada tio. A taxa da plataforma é de quem tem
 * a criança no fechamento do dia 1, sem rateio.
 */

const DIAS_PARA_RESPONDER = 7;
const DIA_MS = 86400000;

const ESTADO = Object.freeze({
  PEDIDO: 'pedido',
  PARCEIRO_ACEITOU: 'parceiro_aceitou',
  CONCLUIDA: 'concluida',
  RECUSADA_PARCEIRO: 'recusada_parceiro',
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
});

const ABERTOS = [ESTADO.PEDIDO, ESTADO.PARCEIRO_ACEITOU];

/**
 * O que vai para a criança nova: quem ela é, onde mora, com quem falar e
 * onde estuda. É o que o tio novo precisaria pedir de novo à família — e é
 * só isso.
 */
const CAMPOS_QUE_VAO = Object.freeze([
  'name',
  'gender',
  'birthDate',
  'turma',
  'professora',
  'parentName',
  'parentEmail',
  'parentPhone',
  'parentPhoneChave',
  'parent2Name',
  'parent2Phone',
  'address',
  'cep',
  'lat',
  'lng',
  'geoPending',
  'numeroPendente',
  'enderecoPartes',
  'school',
  'schoolAddress',
  'schoolPhone',
  'schoolLat',
  'schoolLng',
]);

/** Os que o teste procura dentro da criança nova, um por um. */
const CAMPOS_QUE_NUNCA_VAO = Object.freeze([
  'saudeNotas',
  'saudeConsentidaEm',
  'photoURL',
  'fotoDaTurmaConsentida',
  'fotoDaTurmaEm',
  'monthlyFee',
  'dueDay',
  'vigenciaInicio',
  'vigenciaFim',
  'contratoVigente',
  'contratoAguardando',
  'contractVersion',
  'contractAcceptedAt',
  'contractAcceptedByUid',
  'contractAcceptedName',
  'contractHash',
  'contratoAnteriorURL',
  'horaPega',
  'horaEntrega',
  'period',
  'pickupPeriod',
  'dropoffPeriod',
  'status',
  'statusUpdatedAt',
  'lastStatusCheckpoint',
  'altResponsibles',
  'notes',
  'inviteCode',
  'schoolId',
  'autorizacaoDeclarada',
]);

/** Tem plano e não está suspenso — o critério grosso da indicação. */
function ehPagante(motorista) {
  return !!motorista
    && (motorista.plano === 'mensal' || motorista.plano === 'anual')
    && motorista.suspenso !== true;
}

function emMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return null;
}

function expiraEmMs(agoraMs) {
  return agoraMs + DIAS_PARA_RESPONDER * DIA_MS;
}

/** O estado que vale agora: pedido aberto e vencido é EXPIRADA. */
function estadoEfetivo(t, agoraMs = Date.now()) {
  if (!t) return null;
  if (ABERTOS.includes(t.estado)) {
    const expira = emMs(t.expiraEm);
    if (expira != null && expira <= agoraMs) return ESTADO.EXPIRADA;
  }
  return t.estado;
}

function estaAberta(t, agoraMs = Date.now()) {
  return ABERTOS.includes(estadoEfetivo(t, agoraMs));
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'A criança';
}

/** Tudo o que o parceiro vê ANTES de a família aceitar. */
function previaDoParceiro(crianca) {
  return {
    primeiroNome: primeiroNome(crianca?.name),
    escola: String(crianca?.school || '').trim().slice(0, 80) || null,
  };
}

/**
 * O tio de agora pode pedir? Devolve `{ ok, erro }`.
 * `ehParceiro` e `temAberta` vêm do servidor (consultas); o resto é do
 * documento.
 */
function podePedir({ cobrancaLigada, uid, tio, crianca, parceiroUid, parceiro, ehParceiro, temAberta }) {
  if (cobrancaLigada !== true) return { ok: false, erro: 'Passar a família para outro tio ainda não está disponível.' };
  if (!crianca || crianca.adminUid !== uid) return { ok: false, erro: 'Criança não encontrada.' };
  if (crianca.active === false) return { ok: false, erro: 'Esta criança já saiu da sua turma.' };
  if (!crianca.parentUid) return { ok: false, erro: 'A família ainda não entrou no app. Ela precisa aceitar a passagem pelo celular dela.' };
  if (!ehPagante(tio)) return { ok: false, erro: 'Passar família para outro tio é para quem tem plano.' };
  if (!parceiroUid || parceiroUid === uid || !ehParceiro) return { ok: false, erro: 'Escolha um dos seus tios parceiros.' };
  if (!parceiro || parceiro.role !== 'admin' || parceiro.suspenso === true) return { ok: false, erro: 'Este tio não pode receber famílias agora.' };
  if (temAberta) return { ok: false, erro: 'Já existe um pedido aberto para esta criança.' };
  return { ok: true, erro: null };
}

/**
 * O parceiro pode aceitar? Quem ainda não paga recebe `precisaAssinar`: a
 * tela o leva aos planos e ele volta para aceitar.
 */
function podeAceitarParceiro({ cobrancaLigada, uid, t, parceiro, agoraMs = Date.now() }) {
  if (!t || t.paraUid !== uid) return { ok: false, erro: 'Pedido não encontrado.' };
  if (estadoEfetivo(t, agoraMs) !== ESTADO.PEDIDO) return { ok: false, erro: 'Este pedido não está mais aberto.' };
  if (cobrancaLigada !== true) return { ok: false, erro: 'Passar a família para outro tio ainda não está disponível.' };
  if (!ehPagante(parceiro)) {
    return { ok: false, erro: 'Para receber uma família, assine um plano antes.', precisaAssinar: true };
  }
  return { ok: true, erro: null };
}

/** A família pode aceitar? Confere de novo o que pode ter mudado em 7 dias. */
function podeAceitarFamilia({ cobrancaLigada, uid, t, crianca, parceiro, agoraMs = Date.now() }) {
  if (!t || t.familiaUid !== uid) return { ok: false, erro: 'Pedido não encontrado.' };
  if (estadoEfetivo(t, agoraMs) !== ESTADO.PARCEIRO_ACEITOU) return { ok: false, erro: 'Este pedido não está mais aberto.' };
  if (cobrancaLigada !== true) return { ok: false, erro: 'Passar a família para outro tio ainda não está disponível.' };
  if (!crianca || crianca.adminUid !== t.deUid || crianca.active === false || crianca.parentUid !== uid) {
    return { ok: false, erro: 'Este pedido não vale mais.' };
  }
  if (!ehPagante(parceiro)) return { ok: false, erro: 'Este tio não pode receber famílias agora. Fale com ele.' };
  return { ok: true, erro: null };
}

/** 'AAAA-MM' do mês seguinte, no fuso de Brasília. */
function mesSeguinte(agoraMs = Date.now()) {
  const d = new Date(agoraMs - 3 * 3600000);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 2; // getUTCMonth é 0–11; +1 é este mês, +2 o seguinte
  return mes > 12 ? `${ano + 1}-01` : `${ano}-${String(mes).padStart(2, '0')}`;
}

/** O billing pergunta: este mês já é cobrado da criança? */
function mesCobravel(mesAAAAMM, primeiroMesCobrado) {
  if (!primeiroMesCobrado) return true;
  return String(mesAAAAMM) >= String(primeiroMesCobrado);
}

function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** A escola do parceiro com o mesmo nome (sem acento e sem caixa), ou null. */
function escolaDoParceiro(nomeDaEscola, escolas = []) {
  const alvo = normalizarNome(nomeDaEscola);
  if (!alvo) return null;
  const achada = escolas.find((e) => e && e.id && normalizarNome(e.nome) === alvo);
  return achada ? achada.id : null;
}

/**
 * O documento da criança nova. Só os campos da lista; o resto é o que um
 * cadastro novo teria, já ligado à família. Valores `undefined` não entram
 * (o Firestore os recusa).
 */
function criancaNova({ antiga, paraUid, transferenciaId, schoolId = null, agoraMs = Date.now() }) {
  const nova = {};
  for (const campo of CAMPOS_QUE_VAO) {
    if (antiga && antiga[campo] !== undefined) nova[campo] = antiga[campo];
  }
  return {
    ...nova,
    adminUid: paraUid,
    parentUid: antiga.parentUid,
    active: true,
    status: 'home',
    inviteStatus: 'used',
    vinculadoPor: 'transferencia',
    schoolId,
    // De onde veio: o id antigo (lido só pelo servidor e pelo tio novo, que
    // não consegue abrir aquele documento) e o pedido que a trouxe.
    transferidaDe: { childId: antiga.id || null, transferenciaId: transferenciaId || null },
    primeiroMesCobrado: mesSeguinte(agoraMs),
  };
}

/**
 * O vínculo da família depois do aceite. O tio de antes SAI de `adminUids`
 * só quando ela não tem mais criança ativa com ele E nada em aberto com ele
 * — enquanto deve uma mensalidade, ela precisa ler o PIX dele.
 *
 * ⚠️ O `adminUid` SINGULAR vira o parceiro sempre que ela não tem outra
 * criança ATIVA com o tio de antes, mesmo com mensalidade em aberto: o
 * singular é o motorista "principal" das telas dela, e quem a atende agora
 * é o parceiro. A dívida antiga se paga pela lista (`adminUids`).
 */
function vinculoDaFamilia({ familia = {}, antigaId, novaId, deUid, paraUid, outrasAtivasComDe = 0, emAbertoComDe = 0 }) {
  const ids = Array.isArray(familia.childIds) ? familia.childIds : [];
  const childIds = [...ids.filter((id) => id !== antigaId), novaId].filter((v, i, a) => a.indexOf(v) === i);
  const atuais = Array.isArray(familia.adminUids) ? familia.adminUids : [];
  const deFica = outrasAtivasComDe > 0 || emAbertoComDe > 0;
  const adminUids = [...atuais.filter((u) => deFica || u !== deUid), paraUid].filter((v, i, a) => a.indexOf(v) === i);
  const adminUid = familia.adminUid && (familia.adminUid !== deUid || outrasAtivasComDe > 0) ? familia.adminUid : paraUid;
  const childId = familia.childId && familia.childId !== antigaId ? familia.childId : novaId;
  return { childIds, adminUids, adminUid, childId };
}

/* ── Os avisos. Nenhum leva dado de saúde, dinheiro ou endereço. ─────── */

function marcaOu(marca, padrao) {
  return String(marca || '').trim() || padrao;
}

function avisoAoParceiro({ marcaDe, previa }) {
  return {
    type: 'transferencia_pedida',
    title: `${marcaOu(marcaDe, 'Um tio parceiro')} quer passar uma família para você`,
    body: `${previa.primeiroNome}${previa.escola ? `, da ${previa.escola}` : ''}. Responda em até ${DIAS_PARA_RESPONDER} dias.`,
  };
}

function avisoAFamilia({ marcaDe, marcaPara, nome }) {
  return {
    type: 'transferencia_para_aceitar',
    title: `${marcaOu(marcaDe, 'Seu tio')} vai passar o transporte de ${primeiroNome(nome)} para ${marcaOu(marcaPara, 'outro tio')}`,
    body: 'Abra o app para aceitar ou falar com ele.',
  };
}

function avisoDeResposta({ marcaPara, nome, aceito }) {
  return aceito
    ? { type: 'transferencia_respondida', title: `${marcaOu(marcaPara, 'O parceiro')} aceitou receber ${primeiroNome(nome)}`, body: 'Agora falta a família aceitar.' }
    : { type: 'transferencia_respondida', title: `${marcaOu(marcaPara, 'O parceiro')} não pode receber ${primeiroNome(nome)}`, body: 'A criança continua na sua turma.' };
}

function avisosDaConclusao({ marcaPara, nome }) {
  const n = primeiroNome(nome);
  return {
    aoTioDeAntes: { type: 'transferencia_concluida', title: `A família aceitou: ${n} agora está com ${marcaOu(marcaPara, 'o parceiro')}`, body: 'As mensalidades em aberto continuam com você.' },
    aoTioNovo: { type: 'transferencia_concluida', title: `${n} entrou na sua turma`, body: 'Combine a mensalidade e os horários com a família.' },
  };
}

module.exports = {
  DIAS_PARA_RESPONDER,
  ESTADO,
  ABERTOS,
  CAMPOS_QUE_VAO,
  CAMPOS_QUE_NUNCA_VAO,
  ehPagante,
  emMs,
  expiraEmMs,
  estadoEfetivo,
  estaAberta,
  primeiroNome,
  previaDoParceiro,
  podePedir,
  podeAceitarParceiro,
  podeAceitarFamilia,
  mesSeguinte,
  mesCobravel,
  normalizarNome,
  escolaDoParceiro,
  criancaNova,
  vinculoDaFamilia,
  avisoAoParceiro,
  avisoAFamilia,
  avisoDeResposta,
  avisosDaConclusao,
};
