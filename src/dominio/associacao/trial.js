/**
 * OS TRÊS MESES GRÁTIS — quando começam, quando acabam, e quando avisar.
 *
 * POR QUE ISTO É REGRA PURA E NÃO UM CAMPO CALCULADO NO BANCO
 * O fim do trial é o gatilho de dinheiro: é a data em que o app decide se
 * cobra, avisa ou bloqueia. Guardar a data calculada no documento significa
 * que mudar `DIAS_DE_TRIAL` deixa de valer para quem já está dentro — e pior,
 * que dois lugares do código podem discordar sobre quando a conta vence.
 *
 * Aqui só existe o INÍCIO, gravado uma vez. Todo o resto é conta, feita na
 * hora, a partir dele. Uma fonte, uma resposta.
 *
 * O RELÓGIO COMEÇA NA PRIMEIRA ROTA, E NÃO NO CADASTRO
 * Motorista escolar tem calendário: ele conhece o app em dezembro, entra em
 * férias, e só volta a operar em fevereiro. Contando do cadastro, ele chega
 * em fevereiro com três semanas de teste — e a primeira experiência real dele
 * com o produto é a tela de cobrança.
 *
 * A primeira rota é o momento em que o produto começa a entregar: antes dela
 * não há posição no mapa, não há aviso de chegada, não há nada para provar.
 * O custo dessa escolha é conhecido: quem cadastra crianças e cobra
 * mensalidade sem nunca iniciar rota usa de graça. É pouco — sem rota o app
 * é meia agenda —, e o contrário (cobrar de quem não recebeu nada) é pior.
 *
 * O INÍCIO É ESCRITO UMA VEZ E NUNCA MUDA, e isso mora nas rules, não aqui.
 * `firestore.rules` só aceita `trialInicio` quando o campo AINDA NÃO EXISTE.
 * Sem essa trava o motorista reinicia o próprio teste para sempre — a mesma
 * armadilha de `limiteCriancas`, que ele também não pode escrever.
 *
 * TRÊS AVISOS, E ELES SÃO FAIXAS, NÃO DATAS EXATAS
 * A tentação era disparar nos dias 20, 15, 7, 5 e 3. Duas coisas contra isso:
 *
 *   1. Cinco avisos em vinte dias é um a cada quatro dias, e o projeto já
 *      aprendeu essa lição em `dominio/rota/avisoDoMomento.js`: atraso comum
 *      NÃO gera tarja, porque "tarja semanal ensina a pular tarja". O quinto
 *      aviso — o mais importante — seria o que ele menos leria.
 *
 *   2. Data exata só acerta quem abre o app naquele dia. Faixa acerta todo
 *      mundo: quem não abriu no dia 7 vê o aviso âmbar no dia 5, e ele já
 *      está no tom certo.
 *
 * A urgência é comunicada pela FORMA (linha → cartão → tela cheia), não pela
 * repetição. Quem desenha a tela decide a forma; aqui só sai o nível.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA, de propósito — é o que o mantém testável sem
 * Firebase (`npm run testar:trial`). O "agora" entra por parâmetro pelo mesmo
 * motivo: teste de data que depende do relógio da máquina passa em setembro e
 * falha em março.
 */

/** Três meses. Ver "A conta dos três meses grátis" em docs/negocio.md. */
export const DIAS_DE_TRIAL = 90;

/** O aviso discreto começa a 30 dias do fim. */
export const FAIXA_DISCRETO = 30;
/** O aviso âmbar, a 7. */
export const FAIXA_ATENCAO = 7;
/** A tela cheia, no último dia. */
export const FAIXA_ULTIMO = 1;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Normaliza o que vier: Date, número de ms, ou Timestamp do Firestore.
 *
 * O Timestamp entra aqui como objeto com `toDate()` — e este módulo não pode
 * importar o SDK do Firebase para reconhecê-lo por tipo. Reconhece pelo
 * formato, que é o que sobra quando não se pode importar.
 */
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

/** A data em que o teste acaba. `null` entra, `null` sai. */
export function fimDoTrial(inicio, dias = DIAS_DE_TRIAL) {
  const d = paraData(inicio);
  if (!d) return null;
  return new Date(d.getTime() + dias * MS_POR_DIA);
}

/**
 * Quantos dias INTEIROS faltam.
 *
 * Arredonda para CIMA de propósito: faltando 6h e meia, ainda é "1 dia", não
 * "0". Dizer que restam zero dias para quem ainda tem a tarde inteira é
 * mentir para o lado que assusta — e assustar sem motivo é o jeito mais
 * rápido de a pessoa parar de acreditar no aviso seguinte.
 *
 * Depois do fim devolve negativo, e o sinal é a informação: −3 é "venceu há
 * três dias".
 */
export function diasRestantes(inicio, agora, dias = DIAS_DE_TRIAL) {
  const fim = fimDoTrial(inicio, dias);
  const hoje = paraData(agora);
  if (!fim || !hoje) return null;
  return Math.ceil((fim.getTime() - hoje.getTime()) / MS_POR_DIA);
}

/**
 * Em que pé está o teste.
 *
 *   'nao_iniciado'  cadastrou e ainda não rodou rota. O relógio está parado.
 *   'rodando'       dentro dos 90 dias.
 *   'expirado'      acabou, e não há contrato.
 *
 * `temContrato` vem de fora porque contrato é outro documento
 * (`contratosAssociacao`), e este módulo não busca nada. Quem tem contrato
 * NUNCA está em trial: a conta dele é a do contrato, e o relógio deixa de
 * significar qualquer coisa — inclusive para quem assinou antes do prazo.
 */
export function estadoDoTrial({ inicio, agora, temContrato = false } = {}) {
  if (temContrato) return 'contratado';
  if (!paraData(inicio)) return 'nao_iniciado';
  const dias = diasRestantes(inicio, agora);
  if (dias === null) return 'nao_iniciado';
  return dias > 0 ? 'rodando' : 'expirado';
}

/**
 * O aviso do momento — ou `null`, que é a resposta mais comum e a mais
 * importante. Nos primeiros 60 dias o app fica CALADO sobre dinheiro.
 *
 * Devolve o NÍVEL, não a tela. Três níveis, e cada um tem uma forma própria
 * lá em cima:
 *
 *   'discreto'  linha no rodapé.  A partir de 30 dias do fim.
 *   'atencao'   cartão âmbar.     A partir de 7.
 *   'ultimo'    tela cheia.       No último dia.
 *   'expirado'  a conta inativa.  Depois do fim.
 *
 * Quem já tem contrato não recebe aviso nenhum, e é por isso que
 * `temContrato` chega até aqui: o motorista que assina no dia 60 não pode
 * continuar vendo contagem regressiva por mais um mês.
 */
export function avisoDoTrial({ inicio, agora, temContrato = false } = {}) {
  const estado = estadoDoTrial({ inicio, agora, temContrato });
  if (estado === 'contratado' || estado === 'nao_iniciado') return null;

  const dias = diasRestantes(inicio, agora);
  if (estado === 'expirado') return { nivel: 'expirado', dias };
  if (dias <= FAIXA_ULTIMO) return { nivel: 'ultimo', dias };
  if (dias <= FAIXA_ATENCAO) return { nivel: 'atencao', dias };
  if (dias <= FAIXA_DISCRETO) return { nivel: 'discreto', dias };
  return null;
}
