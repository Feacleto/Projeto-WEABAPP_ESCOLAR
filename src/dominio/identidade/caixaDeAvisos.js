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
