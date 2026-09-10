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

/**
 * Cada degrau da escada de fechamento é um mês de teste: 90 / 3.
 *
 * A ESCADA É DE TEMPO, E O TEMPO MORA AQUI. A FRAÇÃO de cada degrau mora em
 * `planos.js` (`descontoDoFechamento`), e a separação é a mesma dos dois
 * arquivos: este sabe QUANDO, aquele sabe QUANTO. Juntar faria `planos.js`
 * precisar de um relógio, e ele é a régua de preço — a coisa que mais precisa
 * ser testável sem data.
 */
export const DIAS_POR_DEGRAU = 30;

/** Janela para voltar depois de o teste vencer. Ver `RETORNO` em planos.js. */
export const DIAS_DE_RETORNO = 30;

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
 * EM QUE DEGRAU DA ESCADA DE FECHAMENTO ELE ESTÁ — 1, 2, 3, 'retorno' ou null.
 *
 * ⚠️ ESTA FUNÇÃO É A CÓPIA DE LEITURA, NÃO A AUTORIDADE. Quem decide o degrau
 * que vale dinheiro é `degrauDaDecisao` em `functions/lib/contratacao.js`, com
 * o relógio do SERVIDOR — aqui o "agora" é o relógio do aparelho, e ele é a
 * coisa mais fácil de mudar num telefone. Esta serve para a TELA dizer em que
 * degrau ele está e até quando; se as duas discordarem, vale a do servidor, e
 * o motorista vê um número e recebe outro.
 *
 * É por isso que `npm run testar:gateway` compara as duas degrau por degrau.
 * Duas cópias de aritmética de dinheiro divergindo em silêncio é o problema
 * que este projeto já teve.
 *
 * ⚠️ SEM `inicio` O DEGRAU É 1, e não zero: quem nunca rodou uma rota não
 * gastou um dia do teste, e é o mais antecipado de todos.
 */
export function degrauDaDecisao({ inicio, agora } = {}) {
  const d = paraData(inicio);
  if (!d) return 1;
  const hoje = paraData(agora);
  if (!hoje) return null;

  // O piso de zero é explícito: relógio atrasado produziria dia NEGATIVO, e
  // `floor(-1 / 30) + 1` daria degrau 0 — nenhum desconto para quem acabou de
  // começar, que é o oposto do desenho.
  const passados = Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / MS_POR_DIA));
  if (passados < DIAS_DE_TRIAL) return Math.floor(passados / DIAS_POR_DEGRAU) + 1;
  if (passados < DIAS_DE_TRIAL + DIAS_DE_RETORNO) return 'retorno';
  return null;
}

/**
 * A data em que o degrau atual VIRA o próximo.
 *
 * ⚠️ ESTA DATA NÃO É A QUE A TELA MOSTRA — use `ultimoDiaDoDegrau`.
 *
 * Ela é o limite EXCLUSIVO: no dia que ela devolve, `degrauDaDecisao` já
 * responde o degrau seguinte. Contratar em 10/10, quando o primeiro degrau
 * vira em 10/10, grava 20% e não 30%.
 *
 * O texto "contratando até 10/10 você garante 30%" saiu daqui e prometia um
 * desconto que o servidor não ia gravar — a mesma classe de erro que a régua
 * espelhada existe para impedir, só que entre a tela e a régua em vez de entre
 * dois arquivos. Ela continua exportada porque é a fronteira de verdade; o que
 * mudou é quem pode imprimi-la.
 *
 * `null` para quem está no retorno ou fora da escada, porque ali não há
 * próximo degrau melhor.
 */
export function fimDoDegrau(inicio, degrau) {
  const d = paraData(inicio);
  const n = Math.trunc(Number(degrau));
  if (!d || !(n >= 1 && n <= DIAS_DE_TRIAL / DIAS_POR_DEGRAU)) return null;
  return new Date(d.getTime() + n * DIAS_POR_DEGRAU * MS_POR_DIA);
}
/**
 * O ÚLTIMO DIA EM QUE O DEGRAU AINDA VALE — a data que a tela mostra.
 *
 * Um dia antes de `fimDoDegrau`, e essa diferença de 24 horas é a distância
 * entre uma promessa cumprida e um motorista lendo 30% na tela e recebendo uma
 * fatura de 20%.
 *
 * Sem uma data a oferta é "decida logo", e "logo" não é prazo: urgência sem
 * data não é urgência, é pressão. Com a data errada é pior — é urgência que
 * mente.
 */
export function ultimoDiaDoDegrau(inicio, degrau) {
  const vira = fimDoDegrau(inicio, degrau);
  if (!vira) return null;
  return new Date(vira.getTime() - MS_POR_DIA);
}


/**
 * EM QUE MÊS DE TESTE CAI A FATURA DE `mes` — 1, 2, 3… ou `null`.
 *
 * ── POR QUE ESTA FUNÇÃO EXISTE
 * O teste passou a EMITIR FATURA todo mês, isenta, com o preço cheio visível.
 * O hábito que faltava não era pagar R$ 149 — era receber e reconhecer uma
 * fatura —, e noventa dias de silêncio sobre dinheiro faziam o dia 91 ser uma
 * decisão de compra em vez de uma continuação. Ver docs/descontos.md, peça 1.
 *
 * ── ⚠️ ELE PODE PASSAR DE 3, E O RÓTULO NÃO DIZ "DE 3"
 * A fatura é por MÊS DE CALENDÁRIO e o teste tem 90 DIAS CORRIDOS: começando
 * em 20/09, ele acaba em 19/12 e ENCOSTA em quatro meses — setembro, outubro,
 * novembro e dezembro. Um rótulo "mês 4 de 3" num documento de cobrança é o
 * tipo de contradição que este projeto testa para não ter.
 *
 * Então o número é o ÍNDICE do mês (1º, 2º, 3º, 4º) e quem diz o fim é a DATA,
 * que vai congelada na fatura. Contar meses de calendário como se fossem os
 * três meses do teste seria mais bonito e mentiria em um mês a cada quatro
 * inícios.
 *
 * ── O CRITÉRIO É O PRIMEIRO DIA DO MÊS
 * A fatura de dezembro é isenta se o teste ainda estava correndo em 01/12,
 * mesmo acabando no dia 19. Cobrar meio mês exigiria pró-rata, e a régua
 * inteira deste projeto é mensal — do `dueDay` da criança ao vencimento da
 * casa. A escolha é generosa de propósito: errar para o lado de cobrar meio mês
 * que o motorista considerava de teste é a briga que custa mais do que vale.
 *
 * ── ⚠️ SEM `inicio`, TODA FATURA É O MÊS 1
 * Quem nunca rodou uma rota tem o relógio parado, e isso significa isenção sem
 * fim. É o custo conhecido do gatilho ser a primeira rota (ver o cabeçalho
 * deste arquivo) — e agora ele fica VISÍVEL, porque o dono passa a ver uma
 * fatura isenta por mês em vez de nenhuma fatura.
 */
/**
 * O ANO E O MÊS DE UM INSTANTE, EM BRASÍLIA — espelho de `partesEmBrasilia`
 * em `functions/lib/reguaDoServidor.js`. Ver lá o porquê e os três valores
 * errados que ele consertou.
 *
 * `mes` volta 1-12, não 0-11.
 */
function partesEmBrasilia(data) {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(data)
    .split('-')
    .map(Number);
  return { ano, mes, dia };
}

export function mesDeTesteDe(inicio, mes) {
  const m = String(mes || '');
  if (!/^\d{4}-\d{2}$/.test(m)) return null;

  const d = paraData(inicio);
  if (!d) return 1;

  const [ano, mm] = m.split('-').map(Number);
  // Meio-dia, como em `dataDeVencimento`: à meia-noite qualquer conversão de
  // fuso joga a data para o dia anterior, e aqui isso trocaria o mês inteiro.
  const primeiroDia = new Date(ano, mm - 1, 1, 12, 0, 0, 0);

  const fim = fimDoTrial(inicio);
  if (!fim || primeiroDia > fim) return null;

  // ⚠️ O MÊS DO INÍCIO SAI DE BRASÍLIA, NÃO DO FUSO DE QUEM LÊ.
  //
  // `getMonth()` num instante das 22h do dia 31 devolve o mês SEGUINTE
  // quando lido em UTC — e é assim que as Cloud Functions rodam. O espelho
  // desta função em `reguaDoServidor.js` devolvia `null` para a primeira
  // fatura do teste, que então saía COBRADA.
  //
  // Aqui, no cliente, o aparelho quase sempre está em Brasília e o erro não
  // aparecia. Mas as duas cópias são comparadas por `testar:gateway`, e a
  // comparação só é honesta se as duas responderem a mesma pergunta: "que
  // mês era este instante NO BRASIL". Deixar o cliente no fuso do aparelho
  // faria o teste passar aqui e falhar no CI — ou, pior, passar nos dois e
  // divergir no telefone de alguém em viagem.
  const inicioBR = partesEmBrasilia(d);
  const indice = (ano - inicioBR.ano) * 12 + (mm - inicioBR.mes) + 1;
  // Fatura de um mês ANTERIOR ao início do teste não é mês de teste nenhum —
  // ela é de antes de existir relógio.
  return indice >= 1 ? indice : null;
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
