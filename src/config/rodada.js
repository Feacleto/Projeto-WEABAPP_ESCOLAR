/**
 * A rodada de entrada — quantas vagas de associado estão abertas e até quando.
 *
 * POR QUE ISSO É UM MÓDULO E NÃO TEXTO NA TELA
 * A escassez é o argumento mais forte da home ("últimas vagas de agosto"), e
 * é também o mais fácil de virar mentira: basta o mês virar. Texto fixo em
 * JSX envelhece calado — em setembro a página continua dizendo agosto, e o
 * motorista que voltar percebe. Aqui o mês vem do relógio do visitante, então
 * a frase se corrige sozinha todo dia 1º, sem ninguém lembrar de nada.
 *
 * A ESCASSEZ AQUI É REAL — E TEM QUE CONTINUAR SENDO
 * Cada associado custa administração (banco, backup, suporte, conferência de
 * pagamento), então o número de vagas por mês é de verdade. O que NÃO pode
 * acontecer é `VAGAS_NA_RODADA` ficar parado em 2 pra sempre: aí vira o
 * contador falso que reinicia sozinho, que é propaganda enganosa (CDC art.
 * 37) e que qualquer motorista reconhece de longe. Quando um associado
 * entrar, baixe o número aqui — é um dígito, num arquivo, e a home inteira
 * acompanha.
 *
 * O DIA DO FECHAMENTO NÃO É ESCOLHIDO, É O ÚLTIMO DO MÊS
 * "Fecha dia 31" em agosto, "dia 30" em setembro. Sem data inventada e sem
 * calendário pra manter: o mês é o prazo.
 */

/** Vagas ainda abertas na rodada do mês. Baixe quando um associado entrar. */
export const VAGAS_NA_RODADA = 2;

/**
 * Mês atual em português, minúsculo ("agosto").
 *
 * Recebe a data por parâmetro (com o hoje como padrão) pra ser testável sem
 * mexer no relógio da máquina.
 */
export function mesDaRodada(hoje = new Date()) {
  return hoje.toLocaleDateString('pt-BR', { month: 'long' }).toLowerCase();
}

/** Último dia do mês atual — 31 em agosto, 30 em setembro, 28/29 em fevereiro. */
export function ultimoDiaDoMes(hoje = new Date()) {
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
}

/**
 * As frases prontas, num lugar só.
 *
 * Vêm daqui em vez de serem montadas em cada tela porque a mesma escassez
 * aparece em três lugares diferentes da home (barra flutuante, hero e bloco
 * final) e ela precisa dizer exatamente a mesma coisa nos três — dois textos
 * parecidos mas diferentes é o que faz o visitante desconfiar do número.
 */
export function frasesDaRodada(hoje = new Date()) {
  const mes = mesDaRodada(hoje);
  const dia = ultimoDiaDoMes(hoje);
  return {
    mes,
    dia,
    vagas: VAGAS_NA_RODADA,
    /** Barra flutuante e hero — a linha miúda embaixo do botão. */
    curta: `últimas vagas de ${mes}`,
    /** Hero — a mesma coisa, com o prazo, porque ali há espaço pra ele. */
    comPrazo: `últimas vagas de ${mes} · fecha dia ${dia}`,
    /** Bloco final — o fechamento pode ser específico: o número aparece. */
    contada: `últimas ${VAGAS_NA_RODADA} vagas de ${mes}`,
    /** A roleta do primeiro acesso, amarrada à rodada. */
    brinde: `roleta de 1 a 3 meses sem taxa · só quem entra em ${mes}`,
  };
}
