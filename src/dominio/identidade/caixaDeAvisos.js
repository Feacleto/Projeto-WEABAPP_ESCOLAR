/**
 * A CAIXA DE AVISOS DO SINO — o que é novo, o que falta ler e em quantos
 * lotes se marca (03/10/2026).
 *
 * Puro de propósito: as três decisões abaixo moravam espalhadas entre o hook,
 * o service e a tela, atrás de um `import` do Firestore onde o Node não as
 * alcançava. Aqui `npm run testar:notificacoes` mede cada uma.
 */

/**
 * ⚠️ QUANTOS DOCUMENTOS POR LOTE AO MARCAR COMO LIDO.
 *
 * O Firestore recusa lote acima de 500 escritas. "Marcar todas como lidas"
 * baixava TODO o histórico da pessoa e mandava um lote só: com mais de 500
 * não lidas o lote estourava e nada era marcado — e cada toque relia a caixa
 * inteira, para sempre crescente. 450 deixa folga.
 */
export const LOTE_DE_LEITURA = 450;

/**
 * ⚠️ A FOLGA DO RELÓGIO para decidir se um aviso é NOVO.
 *
 * O sino passou a ouvir UMA vez por sessão (`NotificacoesProvider`), e o
 * "aviso novo" é o que não estava na lista anterior. Só que a lista é uma
 * JANELA (as 100 mais recentes): quando um aviso sai dela — apagado pela
 * limpeza dos 90 dias, ou pela própria pessoa —, o 101º, mais velho, ENTRA.
 * Pelo id ele é "novo", e ganharia cartão e som horas ou meses depois de ter
 * chegado. Então também se exige que ele tenha nascido depois de a escuta
 * começar, com dez minutos de folga para o relógio do aparelho atrasado.
 */
export const FOLGA_DO_RELOGIO_MS = 10 * 60 * 1000;

function millisDe(createdAt) {
  if (!createdAt) return null;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === 'number') return createdAt;
  return null;
}

/**
 * Os avisos que CHEGARAM agora: não estavam em `vistos` (os ids da lista
 * anterior) e nasceram depois de `inicioMs` (menos a folga).
 *
 * `vistos` nulo é a primeira carga — nada é novo nela, tudo é histórico.
 * `createdAt` ausente é escrita local ainda sem hora do servidor: acabou de
 * acontecer, então conta como novo.
 */
export function avisosQueChegaram(lista, vistos, inicioMs) {
  if (!vistos) return [];
  const piso = Number(inicioMs || 0) - FOLGA_DO_RELOGIO_MS;
  return (lista || []).filter((n) => {
    if (!n?.id || vistos.has(n.id)) return false;
    const ms = millisDe(n.createdAt);
    return ms == null || ms >= piso;
  });
}

/** Os ids que falta marcar como lidos — só os NÃO lidos, sem repetição. */
export function idsNaoLidos(lista) {
  const ids = (lista || [])
    .filter((n) => n?.id && !n.isRead && !n.readAt)
    .map((n) => n.id);
  return [...new Set(ids)];
}

/** Parte a lista em lotes de no máximo `tamanho`. */
export function emLotes(lista, tamanho = LOTE_DE_LEITURA) {
  const n = Math.max(1, Math.floor(Number(tamanho) || LOTE_DE_LEITURA));
  const lotes = [];
  for (let i = 0; i < (lista || []).length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

/* ───────────── O SINO EM GRUPOS (04/10/2026, modelo D aprovado pelo dono) ─────────────
 *
 * Em cima, os NOVOS (o que chegou desde a última vez que ela abriu); embaixo,
 * os JÁ VISTOS em Hoje, Ontem, Esta semana e Este mês; e o que passou de um
 * mês fica fechado em "Outros", o ÚNICO grupo que se pode limpar. Do mês para
 * cá nada se apaga: é a conversa recente, e "apaguei sem querer" ali custa a
 * prova de um aviso sobre dinheiro. Depois de 90 dias o servidor apaga sozinho
 * (limpezaDosAvisos.js), então "Outros" junta só os de 31 a 90 dias.
 */

/** Passou disto, o aviso vai para "Outros". */
export const DIAS_ATE_OUTROS = 30;

export const ASSUNTO = { ROTA: 'rota', DINHEIRO: 'dinheiro', OUTRO: 'outro' };

const TIPOS_DA_ROTA = new Set([
  'rota_iniciada', 'proxima_parada', 'perua_chegando', 'perua_chegou', 'buzina',
  'child_onboard', 'child_arrived_school', 'child_arrived_home', 'nao_embarcou',
  'rota_atrasada', 'absence_confirm', 'absence_declared', 'alt_pickup',
  'school_no_class', 'schedule_changed', 'acesso_temporario',
]);
const TIPOS_DO_DINHEIRO = new Set([
  'payment_claimed', 'payment_confirmed', 'payment_due_5d', 'payment_due_3d',
  'payment_due_0d', 'payment_overdue_3d', 'payment_overdue_7d', 'fatura_vence',
  'contrato_pronto', 'contract_accepted',
]);

/** O filtro do sino: Rota, Dinheiro, ou só em "Tudo". */
export function assuntoDoAviso(tipo) {
  if (TIPOS_DA_ROTA.has(tipo)) return ASSUNTO.ROTA;
  if (TIPOS_DO_DINHEIRO.has(tipo)) return ASSUNTO.DINHEIRO;
  return ASSUNTO.OUTRO;
}

/**
 * ⚠️ NOVO É "NÃO LIDO QUANDO ELA ABRIU", NÃO "NÃO LIDO AGORA".
 * O sino marca como lido 1,5 s depois de abrir. Se "novo" fosse só o não lido,
 * os cartões verdes pulariam para "Já vistos" debaixo do dedo dela. Então o
 * aviso lido DEPOIS de a folha abrir (`abertoEmMs`) continua novo até fechar.
 */
export function ehNovo(aviso, abertoEmMs) {
  const lido = millisDe(aviso?.readAt);
  if (lido == null) return !aviso?.isRead;
  return lido >= Number(abertoEmMs || 0);
}

function inicioDoDia(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Quantos dias de calendário entre o aviso e hoje (no relógio do aparelho). */
export function diasAtras(createdAt, agoraMs) {
  const ms = millisDe(createdAt);
  if (ms == null) return 0; // escrita local sem hora do servidor: é de agora
  return Math.max(0, Math.round((inicioDoDia(agoraMs) - inicioDoDia(ms)) / 86400000));
}

/** Em que grupo dos já vistos o aviso cai. */
export function grupoDoAviso(createdAt, agoraMs) {
  const dias = diasAtras(createdAt, agoraMs);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return 'semana';
  if (dias <= DIAS_ATE_OUTROS) return 'mes';
  return 'outros';
}

export const GRUPOS_DO_SINO = [
  { chave: 'hoje', titulo: 'Hoje' },
  { chave: 'ontem', titulo: 'Ontem' },
  { chave: 'semana', titulo: 'Esta semana' },
  { chave: 'mes', titulo: 'Este mês' },
];

/**
 * A caixa inteira, já partida: `{ novos, hoje, ontem, semana, mes, outros }`,
 * cada um na ordem em que chegou (mais novo primeiro). `assunto` filtra antes
 * de partir; nulo é "Tudo".
 */
export function partirOSino(lista, { abertoEmMs, agoraMs, assunto = null } = {}) {
  const caixa = { novos: [], hoje: [], ontem: [], semana: [], mes: [], outros: [] };
  for (const n of lista || []) {
    if (!n?.id) continue;
    if (assunto && assuntoDoAviso(n.type) !== assunto) continue;
    if (ehNovo(n, abertoEmMs)) caixa.novos.push(n);
    else caixa[grupoDoAviso(n.createdAt, agoraMs)].push(n);
  }
  return caixa;
}

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const doisDigitos = (n) => String(n).padStart(2, '0');

/** O "quando" da linha: 07:12 hoje e ontem, "Seg" na semana, 02/10 depois. */
export function quandoDoAviso(createdAt, agoraMs) {
  const ms = millisDe(createdAt);
  if (ms == null) return 'Agora';
  const d = new Date(ms);
  const dias = diasAtras(createdAt, agoraMs);
  if (dias <= 1) return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
  if (dias < 7) return DIAS_DA_SEMANA[d.getDay()];
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;
}
