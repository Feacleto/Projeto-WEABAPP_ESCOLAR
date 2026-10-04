/**
 * O CAIXA, DEPOIS DA REVISÃO DE 04/10/2026 (itens 13 e 14) — as decisões de
 * tela do Financeiro que são regra, e por isso moram fora do JSX.
 *
 * A regra de fundo é do dono: quem usa tem 40 anos ou mais, está cansado e
 * toca no que mais chama a atenção. Cada tela tem UM protagonista em verde
 * cheio; o resto é branco ou contorno. Uma lista com quinze "Dar baixa"
 * verdes não tem protagonista nenhum.
 *
 * Puro de propósito (sem React, sem Firebase): `npm run testar:extrato` mede.
 */

/**
 * EM QUE ABA O CAIXA ABRE. Com mensalidade em aberto no mês, a pergunta dele
 * é "quem falta pagar?", e a resposta mora em Mensalidades — abrir no Extrato
 * obrigava a um toque a mais justamente no mês com trabalho. Sem nada em
 * aberto, o mês é consulta, e o Extrato (entrou e saiu, por dia) é o caixa.
 */
export function abaInicialDoCaixa({ quantasFaltam = 0 } = {}) {
  return quantasFaltam > 0 ? 'mensalidades' : 'extrato';
}

/**
 * OS DOIS BOTÕES DE UMA LINHA DE MENSALIDADE, por estado.
 *
 *   atrasada  → "Cobrar no WhatsApp" CHEIO, "Dar baixa" de contorno: o
 *               trabalho dessa linha é cobrar
 *   pendente  → "Lembrar no WhatsApp" suave, "Dar baixa" de contorno: ainda
 *               não venceu, nada ali é urgente
 *   avisou    → só "Dar baixa", CHEIO: a família disse que pagou e a bola
 *               está com ele — é a única linha em que dar baixa é a tarefa
 *   paga      → nenhum dos dois (o "Desfazer" é outra conversa)
 *
 * ⚠️ A cobrança continua sendo UMA família por vez, pelo WhatsApp de cada
 * linha. Nunca em massa.
 */
export function botoesDaMensalidade(estado) {
  switch (estado) {
    case 'overdue':
      return { cobrar: 'cheio', darBaixa: 'contorno' };
    case 'pending':
      return { cobrar: 'suave', darBaixa: 'contorno' };
    case 'claimed':
      return { cobrar: null, darBaixa: 'cheio' };
    default:
      return { cobrar: null, darBaixa: null };
  }
}

/**
 * O botão do cartão âmbar. Ele LEVA à lista filtrada das atrasadas — não
 * cobra ninguém sozinho.
 */
export function rotuloDeCobrarAtrasados(quantas) {
  const n = Number(quantas) || 0;
  if (n <= 0) return null;
  return n === 1 ? 'Cobrar o atrasado' : `Cobrar os ${n} atrasados`;
}
