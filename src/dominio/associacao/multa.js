/**
 * A MULTA DE SAÍDA — e ela existe em UM plano só.
 *
 * ── O QUE ESTE ARQUIVO DECIDE
 * Quanto custa sair antes do fim do compromisso, e quando não custa nada.
 * Nenhuma linha aqui cobra: quem cobra é o gateway, e quem mostra é a tela de
 * cancelamento. Isto é a conta pura, testada por `npm run testar:multa`.
 *
 * ── ⚠️ O MENSAL NÃO TEM MULTA. NUNCA.
 * "Cancelou, cancelou" é a promessa do plano mensal, e ela é o argumento
 * central contra o concorrente que cobra 30% do saldo para sair do anual dele.
 * Uma exceção aqui — "só neste caso", "só no primeiro mês" — apaga a frase
 * inteira, porque uma saída livre com asterisco não é uma saída livre.
 *
 * ── POR QUE 20% DO SALDO, E NÃO UMA TABELA DECRESCENTE
 * A intenção era que a multa caísse com o tempo de casa. Sobre o SALDO
 * RESTANTE ela já cai sozinha: cada mês pago encolhe o saldo, e 20% de um
 * saldo menor é uma multa menor. Um número só, e ele já é proporcional —
 * escrever uma segunda tabela decrescente seria duas réguas dizendo a mesma
 * coisa, e é assim que elas divergem.
 *
 * E a proporcionalidade não é gentileza: o **art. 413 do Código Civil** obriga
 * o juiz a reduzir a cláusula penal quando a obrigação foi cumprida em parte.
 * Uma multa sobre saldo já nasce reduzida — escrever assim é melhor que ter
 * isso reduzido depois, por alguém que não leu o resto do contrato.
 *
 * ── ELA DISSUADE, ELA NÃO RECUPERA
 * Saindo no mês 6, o associado pagou seis meses de anual em vez de seis de
 * mensal — a diferença é grande, e 20% do saldo devolve uma fração dela. Isso
 * é deliberado: a fórmula que recuperaria de verdade ("devolva o desconto que
 * recebeu") CRESCE com o tempo de casa, e puniria mais quem ficou mais. O que
 * protege a receita é a maioria não sair; a multa ajuda pelo efeito
 * psicológico, não pelo valor.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA além da régua de planos, e é o que o mantém
 * testável sem Firebase.
 */

import { PLANO, MESES_DE_CONTRATO, centavos } from './planos.js';

/** A fração do saldo restante. Metade dos 30% que a concorrência cobra. */
export const FRACAO_DA_MULTA = 0.2;

/**
 * O TETO, em mensalidades — e ele morde exatamente uma vez.
 *
 * A 20%, o pior caso é sair no mês 1: onze meses de saldo dão 2,2
 * mensalidades. O teto corta isso em duas, e o efeito prático é pequeno — mas
 * ele transforma a cláusula numa frase que cabe na tela: *"a multa nunca passa
 * de dois meses do seu plano"*. Um limite que a pessoa consegue repetir vale
 * mais que os R$ 12 que ele economiza.
 */
export const TETO_EM_MENSALIDADES = 2;

/**
 * ⚠️ OS PRIMEIROS 30 DIAS NÃO TÊM MULTA NENHUMA.
 *
 * É arrependimento livre, e ele cobre com folga o direito de sete dias do
 * **CDC art. 49**, que se aplica a contrato fechado dentro do app — fora de
 * estabelecimento comercial. Oferecer 30 em vez de 7 custa quase nada (quem
 * desiste nesse prazo desistiria de qualquer jeito) e vira argumento de venda:
 * o compromisso de doze meses começa com um mês para mudar de ideia.
 */
export const DIAS_SEM_MULTA = 30;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Quantos meses inteiros já foram cumpridos do compromisso.
 *
 * Conta por MÊS DE CALENDÁRIO decorrido, e não por blocos de 30 dias: o
 * compromisso é de doze meses e a cobrança é mensal, então o que o associado
 * conta na cabeça dele é "já paguei seis". Contar por 30 dias faria a multa
 * mudar num dia que não é o de nenhuma fatura.
 */
export function mesesCumpridos(inicio, agora = new Date()) {
  const d = paraData(inicio);
  const hoje = paraData(agora);
  if (!d || !hoje) return null;

  let meses = (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth());
  // O mês só conta como cumprido quando passa o DIA da assinatura.
  if (hoje.getDate() < d.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/**
 * A MULTA DE HOJE. Devolve sempre um objeto — nunca `null`.
 *
 * `plano` é 'mensal' ou 'anual'. `valorMensal` é o que ele paga hoje (já com
 * descontos), e é ele que forma o saldo: cobrar sobre o preço de tabela seria
 * multar sobre um valor que ele nunca pagou.
 *
 * ⚠️ O SALDO USA O VALOR ATUAL, e isso é uma escolha a favor dele. Com preço
 * por criança o valor muda todo mês, então não existe "o saldo" exato — existe
 * a melhor estimativa. Projetar crescimento futuro para inflar a multa seria
 * cobrar por crianças que ele ainda não tem.
 */
export function multaDeSaida({
  plano = PLANO.MENSAL,
  valorMensal = 0,
  inicio = null,
  agora = new Date(),
  mesesDeContrato = MESES_DE_CONTRATO,
} = {}) {
  const vazia = {
    devida: false,
    valor: 0,
    saldo: 0,
    mesesRestantes: 0,
    mesesCumpridos: 0,
    tetoAplicado: false,
    motivo: null,
  };

  // ⚠️ O MENSAL SAI LIMPO, SEMPRE. Ver o cabeçalho: é a promessa inteira do
  // plano, e uma exceção aqui a apaga.
  if (plano !== PLANO.ANUAL) {
    return { ...vazia, motivo: 'mensal-nao-tem-multa' };
  }

  const d = paraData(inicio);
  const hoje = paraData(agora);
  if (!d || !hoje) return { ...vazia, motivo: 'sem-data-de-inicio' };

  // ⚠️ `<=`, E NÃO `<` — O TRIGÉSIMO DIA ESTÁ DENTRO DA JANELA.
  //
  // "Você tem 30 dias" é lido por qualquer pessoa como podendo agir NO trigésimo
  // dia, e num contrato de adesão a ambiguidade se resolve a favor de quem
  // aderiu (**CDC art. 47**). O `<` cobrava R$ 116 de alguém que cancelou no
  // dia exato que a tela prometeu livre — e essa é a cobrança que vira print.
  const dias = Math.floor((hoje.getTime() - d.getTime()) / MS_POR_DIA);
  if (dias <= DIAS_SEM_MULTA) {
    return { ...vazia, motivo: 'arrependimento' };
  }

  const cumpridos = mesesCumpridos(d, hoje);
  const restantes = Math.max(0, mesesDeContrato - cumpridos);
  if (restantes === 0) {
    // Cumpriu o compromisso inteiro: não há saldo, e não há multa. Sair no
    // mês 13 do anual é tão livre quanto sair do mensal.
    return { ...vazia, mesesCumpridos: cumpridos, motivo: 'compromisso-cumprido' };
  }

  const mensal = Math.max(0, Number(valorMensal) || 0);
  const saldo = centavos(mensal * restantes);
  const bruta = centavos(saldo * FRACAO_DA_MULTA);
  const teto = centavos(mensal * TETO_EM_MENSALIDADES);
  const valor = Math.min(bruta, teto);

  return {
    devida: valor > 0,
    valor,
    saldo,
    mesesRestantes: restantes,
    mesesCumpridos: cumpridos,
    /** O teto mordeu? A tela precisa poder dizer que ele existe e agiu. */
    tetoAplicado: valor < bruta,
    motivo: null,
  };
}

/**
 * Quanto a multa CAI se ele esperar até o mês seguinte.
 *
 * A tela de cancelamento mostra isto, e não é para segurá-lo: é informação que
 * só a plataforma tem e que muda a decisão de quem está indo embora por causa
 * do valor. Esconder um número que joga a favor dele seria usar a assimetria
 * de informação contra o cliente — que é o oposto do que a marca promete.
 */
export function quedaNoProximoMes({
  plano = PLANO.MENSAL,
  valorMensal = 0,
  inicio = null,
  agora = new Date(),
  mesesDeContrato = MESES_DE_CONTRATO,
} = {}) {
  const hoje = multaDeSaida({ plano, valorMensal, inicio, agora, mesesDeContrato });
  if (!hoje.devida) return 0;

  const d = paraData(agora);
  const proximo = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate(), 12, 0, 0);
  const depois = multaDeSaida({
    plano,
    valorMensal,
    inicio,
    agora: proximo,
    mesesDeContrato,
  });
  return centavos(Math.max(0, hoje.valor - depois.valor));
}
