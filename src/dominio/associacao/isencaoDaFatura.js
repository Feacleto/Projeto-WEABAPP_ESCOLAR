/**
 * POR QUE ESTA FATURA NÃO COBRA NADA — e as três respostas são diferentes.
 *
 * ── O BUG QUE ISTO FECHA
 * `TioTaxa` decidia com uma linha só:
 *
 *     const isento = fatura.isento || Number(fatura.total) === 0;
 *
 * e, sendo verdadeira, imprimia **"Nada a pagar: você está no período de
 * teste."** — para qualquer fatura zerada. Então a ISENÇÃO CONCEDIDA, que é
 * uma decisão de uma pessoa com motivo e prazo registrados, aparecia para o
 * motorista como régua da casa. Ele agradece o teste, e ninguém sabe que
 * houve uma exceção: a concessão vira invisível exatamente para quem ela foi
 * feita, e some da conversa de retenção que a justificou.
 *
 * ── E A FATURA JÁ SABIA A RESPOSTA
 * `motivoIsencao`, `mesDeTeste` e `testeAte` são gravados desde sempre, pelos
 * dois caminhos de fechamento — e o comentário do gravador chega a dizer que
 * `testeAte` "é ela que a fatura usa para dizer até quando a isenção vale".
 * **Nenhuma tela lia nenhum dos três.** Era um campo escrito para um leitor
 * que não existia; a promessa estava no comentário, não no código.
 *
 * ── AS TRÊS RESPOSTAS
 *   'teste'      — régua, todo mundo tem, tem data de fim. O valor mostrado é
 *                  PROJEÇÃO: ele ainda não escolheu plano.
 *   'concessao'  — exceção. O valor mostrado é a conta REAL, dispensada. Dizer
 *                  "teste" aqui é a mentira que este módulo existe pra evitar.
 *   sem motivo   — fatura antiga (fechada antes do campo) ou desconto que
 *                  zerou o total. Não afirma nenhum dos dois: silêncio honesto
 *                  é melhor que o palpite mais comum.
 *
 * ⚠️ A DATA NÃO É FORMATADA AQUI de propósito: sai como `Date`, e quem
 * escreve "até 12/11" é a tela. Assim o teste compara texto estável e não a
 * localidade de quem roda.
 */

export const MOTIVO = {
  TESTE: 'teste',
  CONCESSAO: 'concessao',
};

/** Timestamp do Firestore, Date ou número → Date. */
function paraData(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A fatura não cobra nada? Devolve `null` quando cobra.
 *
 * ⚠️ `total === 0` CONTINUA CONTANDO COMO ISENTA, e não é redundância: o
 * fundador vitalício chega a zero por desconto, sem `isento`. O que mudou é
 * que zero deixou de ESCOLHER a explicação — ele só abre a pergunta.
 */
export function explicarIsencao(fatura) {
  if (!fatura) return null;
  const total = Number(fatura.total);
  const zerada = Number.isFinite(total) && total === 0;
  if (!fatura.isento && !zerada) return null;

  const motivo = fatura.motivoIsencao ?? null;

  if (motivo === MOTIVO.CONCESSAO) {
    return {
      motivo,
      titulo: 'Nada a pagar: a plataforma isentou este mês.',
      // ⚠️ Nada de "no teste" e nada de "custaria": aqui o número ACIMA é a
      // conta de verdade, e ela foi dispensada. Chamar de projeção esconderia
      // o tamanho do que foi concedido.
      corpo: 'O valor acima é o que sua associação custa hoje — ele foi dispensado neste mês.',
      ate: null,
      mesDeTeste: null,
    };
  }

  if (motivo === MOTIVO.TESTE) {
    return {
      motivo,
      titulo: 'Nada a pagar: você está no período de teste.',
      corpo:
        'O valor acima é o que sua associação custaria hoje, para você já saber como a conta é feita.',
      // A data pronta, congelada no fechamento. É ela que diz até quando, em
      // vez de um contador de meses — o teste tem 90 dias corridos e encosta
      // em até QUATRO meses de calendário, então "mês 4 de 3" apareceria.
      ate: paraData(fatura.testeAte),
      mesDeTeste: Number.isFinite(Number(fatura.mesDeTeste))
        ? Number(fatura.mesDeTeste)
        : null,
    };
  }

  return {
    motivo: null,
    titulo: 'Nada a pagar neste mês.',
    corpo: null,
    ate: null,
    mesDeTeste: null,
  };
}
