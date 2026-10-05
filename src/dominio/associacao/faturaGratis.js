import { precoDaTabela, PLANO } from './planos.js';

/**
 * A FATURA DE R$ 0,00 DO MÊS — régua pura (05/10/2026, decisão do dono).
 *
 * Enquanto o app é grátis, o motorista vê todo mês a fatura que pagaria, com o
 * valor de hoje RISCADO e "Você paga R$ 0,00". O motivo: ele se acostuma com
 * o valor do que usa antes de qualquer cobrança existir, e o grátis deixa de
 * ser invisível.
 *
 * ⚠️ É DEMONSTRATIVO, NÃO DOCUMENTO. Nada é gravado em `faturasParceiro`: a
 * cobrança da plataforma está desligada, e uma fatura de verdade com valor
 * cheio seria a primeira coisa a contradizer a decisão de não cobrar. O valor
 * riscado é o da tabela de HOJE (`precoDaTabela`) — o dono vai ajustar o preço
 * depois, e a tela acompanha sozinha.
 *
 * ⚠️ NENHUMA DATA DE FIM E NENHUM "MÊS 2 DE 6": contar o teste deixa o
 * motorista ansioso para sair antes (decisão do dono, 04/10/2026).
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const MOTIVO_DO_GRATIS = {
  PERIODO: 'Período grátis',
};

/**
 * @param criancas  quantas crianças ativas ele tem hoje
 * @param plano     'mensal' (padrão) ou 'anual'
 * @param agora     Date — só para o nome do mês
 * @returns null sem criança (não há o que mostrar), ou
 *   { mes, criancas, valorDeHoje, vocePaga: 0, motivo }
 */
export function faturaGratisDoMes({ criancas = 0, plano = PLANO.MENSAL, agora = new Date(), motivo = MOTIVO_DO_GRATIS.PERIODO } = {}) {
  const n = Math.max(0, Math.floor(Number(criancas) || 0));
  if (n === 0) return null;
  const valorDeHoje = precoDaTabela({ criancas: n, plano });
  if (valorDeHoje === null) return null;
  return {
    mes: MESES[agora.getMonth()],
    criancas: n,
    valorDeHoje,
    vocePaga: 0,
    motivo,
  };
}
