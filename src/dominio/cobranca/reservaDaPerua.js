/**
 * A RESERVA DA PERUA — juntar para trocar de perua e para a manutenção
 * (03/10/2026).
 *
 * Quem vive da perua costuma descobrir que ela precisa ser trocada no dia em
 * que ela quebra de vez. A conta que falta é simples: quanto custa a perua
 * nova hoje, quanto a atual vai valer na troca, em quantos anos — e quanto
 * isso dá por mês. Esta régua faz essa conta e a da manutenção média.
 *
 * ⚠️ O APP NÃO GUARDA DINHEIRO, e as palavras daqui não podem sugerir que
 * guarda. O dinheiro está na conta DELE, no banco DELE; o app só ANOTA o
 * quanto ele diz que já separou (`configFinanceiro.guardado`). Por isso o
 * vocabulário é "anotou", "guardado", "atualizar" — nunca "saldo",
 * "depositar", "sacar", "transferir" ou "rendimento". Essas palavras fariam
 * a tela parecer uma conta que rende, e um motorista que acredita que o app
 * guarda o dinheiro dele é um motorista que vai procurar esse dinheiro aqui
 * no dia em que precisar. `npm run testar:perua` varre a tela atrás delas.
 *
 * ⚠️ A META NÃO CORRIGE INFLAÇÃO. O valor da perua nova é o de hoje, e ele
 * vai subir; a tela pede para ele atualizar o plano de tempos em tempos, em
 * vez de o app chutar um índice sobre um bem que ele mesmo vai pesquisar.
 *
 * ⚠️ A MÉDIA DA MANUTENÇÃO DIVIDE PELO TEMPO DE USO, NÃO POR 12. Quem começou
 * a lançar despesas há três meses e trocou uma embreagem de R$ 1.800 não tem
 * manutenção de R$ 150 por mês — tem de R$ 600. O divisor é o número de
 * meses desde o primeiro lançamento de QUALQUER categoria na janela (até 12):
 * é desde quando o app sabe da vida da perua, e um mês sem manutenção nesse
 * intervalo é um mês de manutenção zero, não um mês esquecido.
 *
 * Puro de propósito: sem Firebase, sem React (`npm run testar:perua`).
 */

import { mesDaDespesa, paraData } from './historicoDeDespesas.js';
import { janelaDe12Meses } from './combustivel.js';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const numero = (n) => typeof n === 'number' && Number.isFinite(n);

/** Valor de hoje > 0, de 1 a 20 anos inteiros, valor final ≥ 0 e menor. */
export function planoValido(plano) {
  if (!plano || typeof plano !== 'object') return false;
  const { valorHoje, anos, valorFinal } = plano;
  return (
    numero(valorHoje) &&
    valorHoje > 0 &&
    Number.isInteger(anos) &&
    anos >= 1 &&
    anos <= 20 &&
    numero(valorFinal) &&
    valorFinal >= 0 &&
    valorFinal < valorHoje
  );
}

/** Quanto falta juntar: a perua nova menos o que a atual vai valer. */
export function metaDaTroca(plano) {
  if (!planoValido(plano)) return null;
  return plano.valorHoje - plano.valorFinal;
}

/** A meta dividida pelos meses do plano, em reais inteiros. */
export function porMesParaTroca(plano) {
  const meta = metaDaTroca(plano);
  if (meta === null) return null;
  return Math.round(meta / (plano.anos * 12));
}

/** Quando o plano termina: a data em que foi feito mais os anos. */
export function fimDoPlano(plano) {
  if (!planoValido(plano)) return null;
  const inicio = paraData(plano.criadoEm);
  if (!inicio) return null;
  const fim = new Date(inicio);
  fim.setFullYear(fim.getFullYear() + plano.anos);
  // Plano feito em 29/02: no ano do fim não há 29/02, e o Date pula para
  // 1º de março — a tela diria "março" para um plano de fevereiro.
  if (fim.getMonth() !== inicio.getMonth()) fim.setDate(0);
  return fim;
}

/** 'janeiro de 2031', ou ''. */
export function rotuloDoFim(plano) {
  const fim = fimDoPlano(plano);
  if (!fim) return '';
  return `${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
}

/** Quantos meses de calendário de 'AAAA-MM' até 'AAAA-MM', contando os dois. */
export function mesesEntre(primeiro, ultimo) {
  const [a1, m1] = String(primeiro).split('-').map(Number);
  const [a2, m2] = String(ultimo).split('-').map(Number);
  if (!a1 || !m1 || !a2 || !m2) return null;
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

/** As despesas dentro da janela de 12 meses (por `monthKey` ou data). */
export function despesasNaJanela(despesas, hoje = new Date()) {
  const { primeiro, ultimo } = janelaDe12Meses(hoje);
  return (despesas || []).filter((d) => {
    const mes = mesDaDespesa(d);
    return mes && mes >= primeiro && mes <= ultimo;
  });
}

/**
 * A manutenção média por mês nos últimos 12 meses. `meses` é o tempo de uso
 * do app dentro da janela (1..12); sem nenhuma manutenção, null.
 */
export function mediaDeManutencao(despesas, hoje = new Date()) {
  const naJanela = despesasNaJanela(despesas, hoje);
  const manutencoes = naJanela.filter((d) => d?.category === 'maintenance');
  if (manutencoes.length === 0) return null;
  const total = Math.round(
    manutencoes.reduce((s, d) => s + (Number(d.amount) || 0), 0) * 100,
  ) / 100;
  const primeiroMes = naJanela.map(mesDaDespesa).sort()[0];
  const { ultimo } = janelaDe12Meses(hoje);
  const meses = Math.min(12, Math.max(1, mesesEntre(primeiroMes, ultimo) || 1));
  return { porMes: Math.round(total / meses), total, meses };
}

/**
 * Quanto do caminho já foi anotado: 0..1. Aceita o número ou o registro
 * `{ valor, em }` de `configFinanceiro.guardado`. Sem meta, null.
 */
export function progresso(guardado, meta) {
  if (!numero(meta) || meta <= 0) return null;
  const valor = numero(guardado) ? guardado : Number(guardado?.valor) || 0;
  return Math.min(1, Math.max(0, valor / meta));
}
