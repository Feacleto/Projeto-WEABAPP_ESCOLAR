/**
 * A AVALIAÇÃO RÁPIDA — cinco rostos e um comentário, no Início (03/10/2026).
 *
 * ── O QUE ELA SUBSTITUIU
 * O pedido de avaliação era uma FOLHA longa (estrelas, depoimento, foto,
 * autorização, "Enviar para a home") e só aparecia quando o dono abria um
 * período de avaliação no painel. Na prática não coletava nada — e prometia
 * publicar na home, que deixou de existir em 06/09/2026.
 *
 * Agora é um cartão no próprio Início, como o dos bancos: um toque num rosto,
 * comentário opcional, enviar. Nada é publicado; só o dono lê.
 *
 * ── ⚠️ ELA APARECE DEPOIS DE ALGO DAR CERTO, NUNCA NO MEIO
 *   - MOTORISTA: depois de encerrar a rota do dia. NUNCA com a rota rodando:
 *     ele está dirigindo com criança dentro. É a primeira condição de
 *     `deveMostrarAvaliacao`, antes de qualquer outra.
 *   - RESPONSÁVEL: quando o filho foi entregue em casa.
 *   - ACOMPANHANTE e SEGUNDO RESPONSÁVEL (sem conta, pelo link): depois da
 *     entrega, na própria página do link — uma vez por link.
 *
 * ── ⚠️ E SÓ A PARTIR DO 5º DIA EM QUE O MOMENTO ACONTECEU
 * Antes disso a pessoa tem primeira impressão, não opinião. Quem tem conta
 * conta os dias no próprio aparelho; o link vive no máximo 24 horas e não
 * tem o que contar.
 *
 * ── A FREQUÊNCIA
 * Respondeu → 60 dias de silêncio. "Agora não" → 14 dias. Ignorou → o
 * cartão fica só até o fim do dia e volta no próximo momento.
 *
 * ── A PERGUNTA É SOBRE O APP, NÃO SOBRE O MOTORISTA
 * O responsável não está dando nota ao tio dele. O dono continua vendo o sinal
 * por motorista (`notasPorMotorista`), e o motorista não vê nota de família.
 *
 * PURO: sem Firebase, sem React. `npm run testar:avaliacao`. O servidor tem o
 * espelho do que ele precisa em `functions/lib/reguaDaAvaliacao.js`, e o
 * teste compara os dois.
 */

/** Quem avalia. `admin` e `parent` são os papéis de `users`; os outros dois não têm conta. */
export const PAPEL_DA_AVALIACAO = Object.freeze({
  MOTORISTA: 'admin',
  RESPONSAVEL: 'parent',
  ACOMPANHANTE: 'acompanhante',
  SEGUNDO_RESPONSAVEL: 'segundo_responsavel',
});

/** Onde a avaliação foi feita — o painel do dono separa por isso. */
export const MOMENTO = Object.freeze({
  FIM_DA_ROTA: 'fim_da_rota',
  DIA_ENTREGUE: 'dia_entregue',
  ACOMPANHAMENTO: 'acompanhamento',
  PERFIL: 'perfil',
});

/** Os momentos que o CLIENTE pode gravar. O do link só o servidor grava. */
export const MOMENTOS_DO_CLIENTE = Object.freeze([
  MOMENTO.FIM_DA_ROTA,
  MOMENTO.DIA_ENTREGUE,
  MOMENTO.PERFIL,
]);

/**
 * Os cinco rostos. O ícone é o NOME no lucide-react (sem emoji — decisão do
 * dono); `IconePorNome` desenha. A ordem é a da nota, do pior ao melhor.
 */
export const ROSTOS = Object.freeze([
  { nota: 1, rotulo: 'Muito ruim', icone: 'Angry' },
  { nota: 2, rotulo: 'Ruim', icone: 'Frown' },
  { nota: 3, rotulo: 'Regular', icone: 'Meh' },
  { nota: 4, rotulo: 'Boa', icone: 'Smile' },
  { nota: 5, rotulo: 'Muito boa', icone: 'Laugh' },
]);

export const COMENTARIO_MAX = 140;
export const DIAS_MINIMOS = 5;
export const DIAS_DEPOIS_DE_RESPONDER = 60;
export const DIAS_DEPOIS_DE_DISPENSAR = 14;

/** Nota baixa: o que vira conversa na fila do dono. */
export const NOTA_BAIXA = 2;

const DIA_MS = 24 * 60 * 60 * 1000;

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return valor;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (typeof valor === 'string') {
    const t = new Date(valor).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** 'AAAA-MM-DD' no relógio LOCAL do aparelho — é o dia que a pessoa vive. */
export function chaveDoDiaLocal(agora = new Date()) {
  const d = agora instanceof Date ? agora : new Date(agora);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * A data aconteceu HOJE, no relógio do aparelho? É como o Início do motorista
 * sabe que ele rodou hoje: `users.ultimaRota` é gravado ao INICIAR a rota, e
 * com a rota já fechada isso quer dizer "rodou e encerrou".
 */
export function aconteceuHoje(valor, agora = new Date()) {
  const ms = emMs(valor);
  if (ms == null) return false;
  return chaveDoDiaLocal(new Date(ms)) === chaveDoDiaLocal(agora);
}

/**
 * O interruptor do dono. ⚠️ AUSENTE É LIGADA — só o `false` explícito
 * desliga. Era o contrário (a janela nascia fechada) e por isso o pedido
 * quase nunca aparecia.
 */
export function avaliacaoLigada(config) {
  return config?.avaliacaoRapida !== false;
}

export function notaValida(nota) {
  return Number.isInteger(nota) && nota >= 1 && nota <= 5;
}

/** Corta no teto e tira espaço das pontas. Nunca devolve `undefined`. */
export function comentarioLimpo(texto) {
  return String(texto ?? '').trim().slice(0, COMENTARIO_MAX);
}

/**
 * Acrescenta o dia de hoje à lista de dias em que o momento aconteceu.
 * Sem repetir, e guarda só os últimos dez — o que importa é ter chegado a 5.
 */
export function registrarDia(dias, chave) {
  const lista = Array.isArray(dias) ? dias.filter((d) => typeof d === 'string') : [];
  if (!chave || lista.includes(chave)) return lista.slice(-10);
  return [...lista, chave].slice(-10);
}

/**
 * O cartão aparece agora? A ORDEM DAS PERGUNTAS É A REGRA.
 *
 * `momentoHoje` diz se o momento aconteceu HOJE (rota encerrada, filho
 * entregue). `diasComMomento` é a contagem do aparelho, já incluindo hoje.
 */
export function deveMostrarAvaliacao({
  ligada = true,
  rotaRodando = false,
  momentoHoje = false,
  diasComMomento = 0,
  ultimaResposta = null,
  dispensadaEm = null,
  agora = new Date(),
} = {}) {
  // 1. Dirigindo, nunca — vem antes até do interruptor do dono.
  if (rotaRodando) return false;
  if (!ligada) return false;
  if (!momentoHoje) return false;
  if (diasComMomento < DIAS_MINIMOS) return false;

  const t = emMs(agora) ?? Date.now();
  const respondeu = emMs(ultimaResposta);
  if (respondeu != null && t - respondeu < DIAS_DEPOIS_DE_RESPONDER * DIA_MS) return false;
  const dispensou = emMs(dispensadaEm);
  if (dispensou != null && t - dispensou < DIAS_DEPOIS_DE_DISPENSAR * DIA_MS) return false;
  return true;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

/** A pergunta de cada papel. Sempre sobre o APP — ver o cabeçalho. */
export function perguntaDaAvaliacao({ papel, crianca } = {}) {
  const nome = primeiroNome(crianca);
  switch (papel) {
    case PAPEL_DA_AVALIACAO.MOTORISTA:
      return 'Como o app te ajudou na rota de hoje?';
    case PAPEL_DA_AVALIACAO.RESPONSAVEL:
      return nome
        ? `Como foi acompanhar o dia de ${nome} pelo app?`
        : 'Como foi acompanhar o dia pelo app?';
    case PAPEL_DA_AVALIACAO.ACOMPANHANTE:
    case PAPEL_DA_AVALIACAO.SEGUNDO_RESPONSAVEL:
      return nome ? `Foi fácil acompanhar ${nome} hoje?` : 'Foi fácil acompanhar hoje?';
    default:
      return 'O que você está achando do app?';
  }
}

/** Como o painel do dono escreve cada papel. */
export function rotuloDoPapel(papel) {
  switch (papel) {
    case PAPEL_DA_AVALIACAO.MOTORISTA:
      return 'motorista';
    case PAPEL_DA_AVALIACAO.ACOMPANHANTE:
      return 'acompanhante';
    case PAPEL_DA_AVALIACAO.SEGUNDO_RESPONSAVEL:
      return '2º responsável';
    default:
      return 'responsável';
  }
}

/**
 * As notas baixas de MOTORISTA nos últimos `dias` — uma por motorista, a mais
 * recente. É o que a fila do dono transforma em conversa.
 */
export function notasBaixasDeMotorista(avaliacoes = [], { agora = new Date(), dias = 7 } = {}) {
  const t = emMs(agora) ?? Date.now();
  const porUid = new Map();
  (Array.isArray(avaliacoes) ? avaliacoes : []).forEach((a) => {
    if (a?.role !== PAPEL_DA_AVALIACAO.MOTORISTA || !a?.uid) return;
    const nota = Number(a?.answers?.rating);
    if (!notaValida(nota) || nota > NOTA_BAIXA) return;
    const em = emMs(a.createdAt);
    if (em == null || t - em > dias * DIA_MS) return;
    const atual = porUid.get(a.uid);
    if (!atual || atual.em < em) porUid.set(a.uid, { nota, em, comentario: a.comment || '' });
  });
  return Object.fromEntries(porUid);
}
