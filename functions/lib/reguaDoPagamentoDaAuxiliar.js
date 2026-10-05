/**
 * O PAGAMENTO DA AUXILIAR — régua PURA (05/10/2026, fase 4 da conta da
 * auxiliar, desenho aprovado pelo dono).
 *
 * O motorista anota "paguei R$ 900 à Maria em outubro"; a anotação vira a
 * despesa "Auxiliar" do mês dele e aparece no app DELA, que confirma com
 * "Recebi". É um RECIBO DOS DOIS LADOS, não um pagamento: o app não move
 * dinheiro, só registra o que ele diz que pagou e o que ela diz que recebeu.
 *
 * ── UM POR MÊS, E O ID DIZ QUAL
 * `pagamentosDaAuxiliar/{motoristaUid}_{auxiliarUid}_{AAAA-MM}`. O id
 * determinístico é o que torna a anotação idempotente: o toque duplo, ou a
 * rede que caiu depois de gravar, encontram o documento do mês e param — sem
 * isso nasceriam duas despesas de R$ 900 no caixa dele.
 *
 * ── QUEM CONFIRMA
 * Só a própria auxiliar, e MESMO DEPOIS de o motorista desativá-la: o
 * pagamento é dela, e "recebi" é a palavra dela sobre o que já aconteceu.
 * Confirmar duas vezes não é erro — a segunda vê o recibo e devolve ok, sem
 * mudar a data nem avisar o motorista de novo.
 *
 * ⚠️ SEM `require` — é régua, e `npm run testar:imports` reprova régua que
 * alcança o SDK. Quem escreve é `pagamentosDaAuxiliar.js`.
 */

'use strict';

/** Teto por anotação. Acima disso é dedo escorregando num zero a mais. */
const VALOR_MAXIMO = 20000;

/** Até quantos meses para trás ele pode anotar (o pagamento esquecido). */
const MESES_PARA_TRAS = 12;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** 'AAAA-MM' do instante, no fuso de Brasília (o servidor roda em UTC). */
function chaveDoMes(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(ms)).slice(0, 7);
}

function formatoDoMes(mes) {
  return typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

/** Quantos meses de `a` até `b` ('AAAA-MM'); positivo quando b é depois. */
function mesesEntre(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * O mês pode ser anotado agora? Nunca no futuro (pagamento adiantado é
 * pagamento do mês em que aconteceu), e no máximo 12 meses para trás.
 */
function mesPodeSerAnotado(mes, agoraMs) {
  if (!formatoDoMes(mes)) return false;
  const distancia = mesesEntre(mes, chaveDoMes(agoraMs));
  return distancia >= 0 && distancia <= MESES_PARA_TRAS;
}

/** O valor em reais, arredondado ao centavo, ou `null` se não vale. */
function valorValido(bruto) {
  const n = typeof bruto === 'number' ? bruto : Number(bruto);
  if (!Number.isFinite(n) || n <= 0) return null;
  const centavos = Math.round(n * 100) / 100;
  if (centavos <= 0 || centavos > VALOR_MAXIMO) return null;
  return centavos;
}

/** O id do documento do mês — um por motorista, auxiliar e mês. */
function idDoPagamento(motoristaUid, auxiliarUid, mes) {
  return `${motoristaUid}_${auxiliarUid}_${mes}`;
}

/** "outubro de 2026" */
function nomeDoMes(mes) {
  if (!formatoDoMes(mes)) return '';
  const [ano, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

/** A descrição da despesa que nasce junto: o nome dela e o mês. */
function descricaoDaDespesa(nome, mes) {
  const quem = String(nome || '').trim().slice(0, 60) || 'auxiliar';
  return `Pagamento de ${quem} · ${nomeDoMes(mes)}`.slice(0, 200);
}

/**
 * A data da despesa. No mês corrente é agora; num mês passado é o último dia
 * dele, ao meio-dia de Brasília — senão o pagamento de setembro anotado em 2
 * de outubro cairia no extrato de outubro, e o saldo dos dois meses mentiria.
 */
function dataDaDespesa(mes, agoraMs) {
  if (chaveDoMes(agoraMs) === mes) return agoraMs;
  const [ano, m] = mes.split('-').map(Number);
  // Dia 0 do mês seguinte = último dia deste; 15h UTC = 12h em Brasília.
  return Date.UTC(ano, m, 0, 15, 0, 0);
}

/**
 * Ela pode confirmar este recibo? `{ pode, jaConfirmado }`.
 * Só quem recebeu confirma; o vínculo ativo NÃO é exigido (ver o cabeçalho).
 */
function podeConfirmar(pagamento, uid) {
  if (!pagamento || !uid || pagamento.auxiliarUid !== uid) return { pode: false, jaConfirmado: false };
  return { pode: true, jaConfirmado: !!pagamento.recebidoEm };
}

/** O aviso ao motorista quando ela confirma. */
function avisoDaConfirmacao({ nome, mes }) {
  const quem = String(nome || '').split(' ')[0] || 'A auxiliar';
  return {
    type: 'auxiliar_confirmou_pagamento',
    title: `${quem} confirmou o pagamento`,
    body: `Ela marcou que recebeu o pagamento de ${nomeDoMes(mes)}.`,
  };
}

module.exports = {
  VALOR_MAXIMO,
  MESES_PARA_TRAS,
  chaveDoMes,
  mesPodeSerAnotado,
  valorValido,
  idDoPagamento,
  nomeDoMes,
  descricaoDaDespesa,
  dataDaDespesa,
  podeConfirmar,
  avisoDaConfirmacao,
};
