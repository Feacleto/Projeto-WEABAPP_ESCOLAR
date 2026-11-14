/**
 * O TEXTO DO "DIA FECHADO" (RC2, 14/11/2026) — a conta está em
 * `dominio/rota/diaFechado.js`; quem a mostra é a faixa "Viagem concluída" da
 * rota (`OperacaoDaRota`) e o cartão do Início (`TioDashboard`). Puro, sem
 * React (`npm run testar:dia-fechado`).
 *
 * ── A REGRA, IGUAL À DE `valorDoConvite.js`
 * A frase carrega `sustenta` (de onde a verdade vem HOJE) e `condicao` (de que
 * ela depende). O teste mantém a lista fechada das duas.
 *
 * ── O QUE A FRASE DIZ, E O QUE NÃO DIZ
 * Diz "marcadas": o app mede TOQUE, não serviço — o "TODOS OS N" marca várias
 * crianças de uma vez. Nunca "tudo certo", "sucesso", "sem problemas", "parabéns":
 * ver o teste. Sem festa, sem exclamação, sem comparar com outro dia, sem
 * número além dos dois da conta.
 */
import { todasMarcadas } from '../dominio/rota/diaFechado.js';

export const SUSTENTA = 'status-da-crianca-no-dia';
export const CONDICAO = 'paradas-que-precisavam-da-perua';

/**
 * "Hoje: 14 de 14 paradas marcadas." — ou `null` quando não houve parada que
 * precisasse da perua (sem viagem, nada aparece).
 *
 * @param {{ marcadas: number, total: number }} resumo  o que devolve `resumoDoDia`
 */
export function linhaDoDia(resumo) {
  const total = Number(resumo?.total) || 0;
  if (total <= 0) return null;
  const marcadas = Math.min(Math.max(Number(resumo?.marcadas) || 0, 0), total);
  return `Hoje: ${marcadas} de ${total} ${total === 1 ? 'parada marcada' : 'paradas marcadas'}.`;
}

/** O título do cartão do Início quando está tudo marcado. */
export const TUDO_ENTREGUE = 'Tudo entregue hoje.';

/**
 * O cartão do Início no fim do dia: `{ rotulo, titulo, linha }`.
 *
 *   - tudo marcado: "Hoje / Tudo entregue hoje." e, embaixo, a linha da conta;
 *   - faltou marcar: SÓ a linha ("Fim do dia / Hoje: 13 de 14 paradas
 *     marcadas."), sem o título. "Tudo entregue" ao lado de "13 de 14" seria o
 *     app se contradizendo, e ele só levanta a voz quando está mentindo.
 *
 * @param {{ marcadas: number, total: number }} resumo  o que devolve `resumoDoDia`
 */
export function cartaoDoFimDoDia(resumo) {
  const linha = linhaDoDia(resumo);
  if (!linha || todasMarcadas(resumo)) return { rotulo: 'Hoje', titulo: TUDO_ENTREGUE, linha };
  return { rotulo: 'Fim do dia', titulo: linha, linha: null };
}

/** As formas do texto que o teste varre, com a origem de cada uma. */
export function todasAsAfirmacoes() {
  return [
    { id: 'completo', texto: linhaDoDia({ marcadas: 14, total: 14 }), sustenta: SUSTENTA, condicao: CONDICAO },
    { id: 'faltou', texto: linhaDoDia({ marcadas: 13, total: 14 }), sustenta: SUSTENTA, condicao: CONDICAO },
    { id: 'uma', texto: linhaDoDia({ marcadas: 1, total: 1 }), sustenta: SUSTENTA, condicao: CONDICAO },
    { id: 'nenhuma', texto: linhaDoDia({ marcadas: 0, total: 3 }), sustenta: SUSTENTA, condicao: CONDICAO },
    { id: 'cartaoIncompleto', texto: cartaoDoFimDoDia({ marcadas: 13, total: 14 }).titulo, sustenta: SUSTENTA, condicao: CONDICAO },
  ];
}
