/**
 * O NÍVEL DA FAMÍLIA — Bronze, Prata e Ouro (decisão do dono, 04/10/2026).
 *
 * O nível do motorista mede o USO do app. O da família mede outra coisa: se o
 * COMBINADO com o tio anda certinho — mensalidade em dia e falta avisada com
 * antecedência. O app da família tem pouco para usar todo dia, então missão
 * contínua não faria sentido; o que oscila aqui é o combinado.
 *
 *   Bronze — entrou e está ligada: avisos do app ativados. Sai no 1º dia.
 *   Prata  — Bronze + segundo responsável cadastrado + a última mensalidade
 *            avisada por ela no "Já paguei". Pede engajamento.
 *   Ouro   — Prata + as 2 últimas mensalidades até o vencimento + no máximo
 *            1 ponto de falta nos últimos 30 dias. É o que OSCILA: um mês
 *            atrasado tira, um mês em dia devolve. Prazo curto de propósito —
 *            selo que não muda é esquecido.
 *
 * ── AS QUATRO REGRAS QUE NÃO SE NEGOCIAM
 *
 *   1. SÓ ELA VÊ. O motorista não vê o nível da família, e a família não vê o
 *      do motorista (decisão do dono, 04/10/2026). Nada disto é gravado: a
 *      conta roda no celular dela, com os pagamentos e as faltas que ela já
 *      lê. Nota de pagamento guardada e mostrada a terceiros viraria cadastro
 *      de consumidor (CDC art. 43) — aqui não há o que guardar.
 *   2. VALE O "JÁ PAGUEI" DELA, não a baixa do tio. Se ele esquecer de dar
 *      baixa, quem pagou em dia não perde o Ouro por isso. Sem o aviso dela
 *      (pagou em dinheiro e ele deu baixa), vale a data da baixa.
 *   3. FEBRE ÀS 6H ACONTECE. Um aviso em cima da hora a cada 30 dias é
 *      tolerado; o que tira o Ouro é o HÁBITO. E a janela anda sozinha: em um
 *      mês a falta sai da conta, ninguém fica marcado.
 *   4. CONSENTIMENTO NUNCA VIRA MISSÃO. Aceitar contrato, autorizar dado de
 *      saúde: consentimento dado para ganhar selo deixa de ser livre.
 *
 * ── OS PONTOS DE FALTA
 *   Avisou até 1 hora antes da hora combinada (ou na véspera) → 0.
 *   Avisou com menos de 1 hora, ou depois da hora                → 1.
 *   O TIO marcou a falta na hora, sem aviso dela                 → 2.
 *   Falta que o tio registrou com antecedência (ela avisou por fora) não conta,
 *   nem o "não tem aula" que ele manda para a escola inteira.
 *
 * Puro: nada de React, Firebase ou relógio — a hora entra por parâmetro, e
 * `npm run testar:nivel-da-familia` mede cada caso. Não adicione import aqui.
 */

export const NIVEIS_DA_FAMILIA = ['sem_nivel', 'bronze', 'prata', 'ouro'];

/** Antecedência mínima do aviso de falta, em minutos. */
export const ANTECEDENCIA_DA_FALTA_MIN = 60;
/** A janela em que os pontos de falta contam, em dias. */
export const JANELA_DAS_FALTAS_DIAS = 30;
/** Pontos tolerados na janela para continuar no Ouro. */
export const PONTOS_TOLERADOS = 1;
/** Quantos meses seguidos em dia o Ouro pede. */
export const MESES_DO_OURO = 2;
/** Atraso, em dias, que derruba até o Bronze enquanto não for pago. */
export const ATRASO_LONGO_DIAS = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Timestamp do Firestore, Date, número ou texto → milissegundos (ou null). */
function ms(valor) {
  if (valor == null) return null;
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** 'AAAA-MM-DD' no fuso do aparelho. */
function chaveDoDia(milis) {
  const d = new Date(milis);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Fim do dia do vencimento: pagar no próprio dia do vencimento é em dia. */
function fimDoDia(milis) {
  const d = new Date(milis);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** O instante 'AAAA-MM-DD' + 'HH:MM' no fuso do aparelho. */
function instante(dateKey, hhmm) {
  const [a, m, d] = String(dateKey).split('-').map(Number);
  const [h, min] = String(hhmm || '00:00').split(':').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d, h || 0, min || 0, 0, 0).getTime();
}

/**
 * Quando a mensalidade contou como paga para o nível: o "Já paguei" dela; sem
 * ele, a baixa do tio. Ainda aberta → null.
 */
export function dataQueConta(pagamento) {
  if (!pagamento) return null;
  if (pagamento.status !== 'paid' && pagamento.status !== 'claimed') return null;
  return ms(pagamento.claimedAt) ?? ms(pagamento.paidAt);
}

/**
 * Os pontos de UMA falta.
 * @param falta   a declaração ({ dateKey, type, declaredBy, createdAt, broadcastId })
 * @param horas   { pega, entrega } — a hora combinada da criança ('HH:MM')
 */
export function pontosDaFalta(falta, horas = {}) {
  if (!falta || falta.broadcastId) return 0;
  const criada = ms(falta.createdAt);
  if (criada == null) return 0;
  // A falta que muda só a volta é medida contra a hora da volta.
  const daVolta = falta.type === 'no-dropoff' || falta.type === 'picked-up';
  const hora = daVolta ? horas.entrega : horas.pega;
  const limite = instante(falta.dateKey, hora || '00:00');
  if (limite == null) return 0;
  const emCimaDaHora = criada > limite - ANTECEDENCIA_DA_FALTA_MIN * 60 * 1000;
  if (!emCimaDaHora) return 0;
  return falta.declaredBy === 'parent' ? 1 : 2;
}

/** Soma dos pontos das faltas dos últimos 30 dias (pelo dia da falta). */
export function pontosNaJanela(faltas = [], horas = {}, agora = Date.now()) {
  const inicio = chaveDoDia(agora - JANELA_DAS_FALTAS_DIAS * DIA_MS);
  const hoje = chaveDoDia(agora);
  return faltas
    .filter((f) => f?.dateKey && f.dateKey > inicio && f.dateKey <= hoje)
    .reduce((soma, f) => soma + pontosDaFalta(f, horas), 0);
}

/**
 * Os meses já DECIDIDOS, do mais novo ao mais velho: mês cujo vencimento
 * passou, ou que ela já pagou. Irmãos com o mesmo tio somam como uma família
 * só — o mês é em dia quando TODAS as mensalidades dele foram em dia.
 * → [{ mes, emDia, pago, avisouNoApp, vencimento }]
 */
export function mesesDecididos(pagamentos = [], agora = Date.now()) {
  const porMes = new Map();
  for (const p of pagamentos) {
    if (!p?.month) continue;
    const vence = ms(p.dueDate);
    const quando = dataQueConta(p);
    const decidido = quando != null || (vence != null && fimDoDia(vence) < agora);
    if (!decidido) continue;
    const emDia = quando != null && vence != null && quando <= fimDoDia(vence);
    const atual = porMes.get(p.month) || { mes: p.month, emDia: true, pago: true, avisouNoApp: true, vencimento: vence };
    atual.emDia = atual.emDia && emDia;
    atual.pago = atual.pago && quando != null;
    atual.avisouNoApp = atual.avisouNoApp && ms(p.claimedAt) != null;
    porMes.set(p.month, atual);
  }
  return [...porMes.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

/** A mensalidade em aberto mais atrasada, em dias (0 se nenhuma). */
export function maiorAtrasoEmAberto(pagamentos = [], agora = Date.now()) {
  let maior = 0;
  for (const p of pagamentos) {
    if (dataQueConta(p) != null) continue;
    const vence = ms(p?.dueDate);
    if (vence == null || fimDoDia(vence) >= agora) continue;
    const dias = Math.floor((agora - fimDoDia(vence)) / DIA_MS) + 1;
    if (dias > maior) maior = dias;
  }
  return maior;
}

/** O próximo vencimento ainda aberto (ms), para "pague até o dia X". */
export function proximoVencimento(pagamentos = [], agora = Date.now()) {
  let menor = null;
  for (const p of pagamentos) {
    if (dataQueConta(p) != null) continue;
    const vence = ms(p?.dueDate);
    if (vence == null || fimDoDia(vence) < agora) continue;
    if (menor == null || vence < menor) menor = vence;
  }
  return menor;
}

/**
 * A conta inteira.
 *
 * @param p.avisosLigados       notificações ativadas neste aparelho
 * @param p.segundoResponsavel  há segundo responsável cadastrado
 * @param p.pagamentos          as mensalidades dela COM ESTE motorista
 * @param p.faltas              as faltas declaradas da criança
 * @param p.horas               { pega, entrega } da criança
 * @param p.agora               relógio (ms)
 *
 * → { nivel, itens, pontos, mesesEmDia, temMensalidades, atrasoLongo,
 *     proximoVencimento, faltaSaiDaJanelaEm }
 */
export function calcularNivelDaFamilia({
  avisosLigados = false,
  segundoResponsavel = false,
  pagamentos = [],
  faltas = [],
  horas = {},
  agora = Date.now(),
} = {}) {
  const meses = mesesDecididos(pagamentos, agora);
  const temMensalidades = pagamentos.length > 0;
  const atraso = maiorAtrasoEmAberto(pagamentos, agora);
  const atrasoLongo = atraso > ATRASO_LONGO_DIAS;
  const pontos = pontosNaJanela(faltas, horas, agora);

  let mesesEmDia = 0;
  for (const m of meses) {
    if (!m.emDia) break;
    mesesEmDia += 1;
  }

  // O motorista que não lança mensalidade no app não pode deixar a família
  // presa: sem mensalidade, o item de pagamento da Prata não é exigido — e o
  // Ouro não existe, em vez de ser prometido e impossível.
  // E o item olha a última mensalidade PAGA: a que venceu ontem e está aberta
  // tira o Ouro (mês fora do prazo), não a Prata.
  const ultimaPaga = meses.find((m) => m.pago);
  const ultimaAvisadaNoApp = temMensalidades ? !!ultimaPaga?.avisouNoApp : true;

  const itens = {
    avisosLigados: !!avisosLigados,
    segundoResponsavel: !!segundoResponsavel,
    ultimaAvisadaNoApp,
    mesesEmDia: temMensalidades && mesesEmDia >= MESES_DO_OURO,
    faltasAvisadas: pontos <= PONTOS_TOLERADOS,
  };

  let nivel = 'sem_nivel';
  if (itens.avisosLigados) nivel = 'bronze';
  if (nivel === 'bronze' && !atrasoLongo && itens.segundoResponsavel && itens.ultimaAvisadaNoApp) {
    nivel = 'prata';
  }
  if (nivel === 'prata' && itens.mesesEmDia && itens.faltasAvisadas) nivel = 'ouro';

  // Quando a falta mais antiga que pesa sai da janela — "o Ouro volta em…".
  let faltaSaiDaJanelaEm = null;
  if (!itens.faltasAvisadas) {
    const pesadas = faltas
      .filter((f) => pontosDaFalta(f, horas) > 0)
      .map((f) => f.dateKey)
      .filter((k) => k > chaveDoDia(agora - JANELA_DAS_FALTAS_DIAS * DIA_MS))
      .sort();
    if (pesadas.length) {
      const primeira = instante(pesadas[0], '12:00');
      faltaSaiDaJanelaEm = chaveDoDia(primeira + JANELA_DAS_FALTAS_DIAS * DIA_MS);
    }
  }

  return {
    nivel,
    itens,
    pontos,
    mesesEmDia,
    temMensalidades,
    atrasoLongo,
    proximoVencimento: proximoVencimento(pagamentos, agora),
    faltaSaiDaJanelaEm,
  };
}

/**
 * A frase do selo, quando ela toca nele. Fala do COMBINADO, nunca de "bom
 * pagador": a regra só é dita a quem perguntou.
 */
export function fraseDoNivel(resultado, { diaDoVencimento = null } = {}) {
  const nivel = resultado?.nivel || 'sem_nivel';
  if (nivel === 'ouro') {
    return 'O combinado com o tio anda certinho: mensalidade em dia e falta avisada com antecedência.';
  }
  if (nivel === 'prata' && resultado.temMensalidades) {
    if (!resultado.itens.faltasAvisadas) {
      return 'Avise a falta até 1 hora antes, e o Ouro volta.';
    }
    const dia = diaDoVencimento ? ` até o dia ${diaDoVencimento}` : ' até o vencimento';
    return `Pague a próxima mensalidade${dia} e o Ouro chega.`;
  }
  if (nivel === 'prata') return 'O combinado com o tio anda bem.';
  if (nivel === 'bronze') return 'Os avisos do app estão ligados. Faltam poucos passos para a Prata.';
  return 'Ative os avisos do app para receber o seu primeiro selo.';
}
