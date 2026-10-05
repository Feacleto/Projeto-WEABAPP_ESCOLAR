/**
 * O REGISTRO DA ROTA NA TELA DO TIO — "O que a Cida marcou" (05/10/2026).
 *
 * Quem GRAVA é o servidor (`functions/lib/reguaDoRegistroDaRota.js`, dentro
 * de `marcarParadaPelaAuxiliar` e de `marcarFaltaPelaAuxiliar`); aqui só se lê e se escreve a frase. Não há
 * espelho porque não há conta dos dois lados: o servidor monta o evento, a
 * tela só o desenha.
 *
 * Os 6 mais recentes, o mais novo em cima — é o que ele lê parado no portão,
 * de relance. A lista inteira do dia continua no documento.
 *
 * Pura, sem import: roda no Node (`npm run testar:rota-ao-vivo`).
 */

export const EVENTOS_A_MOSTRAR = 6;

function emMs(em) {
  if (!em) return 0;
  if (typeof em.toMillis === 'function') return em.toMillis();
  if (typeof em.seconds === 'number') return em.seconds * 1000;
  if (em instanceof Date) return em.getTime();
  return Number(em) || 0;
}

/** A frase de um evento, sem a hora: "Ana entrou na perua". */
export function fraseDoEvento(evento) {
  const nome = evento?.criancaNome || 'Criança';
  const escola = evento?.escola ? ` na ${evento.escola}` : ' na escola';
  if (evento?.passo === 'onboard') {
    return evento.viagem === 'volta' ? `${nome} entrou na perua${escola}` : `${nome} entrou na perua`;
  }
  if (evento?.passo === 'atSchool') return `${nome} foi entregue${escola}`;
  if (evento?.passo === 'delivered') return `${nome} foi entregue em casa`;
  // A falta que a auxiliar marcou antes do embarque (05/10/2026).
  if (evento?.passo === 'faltou') return `${nome} faltou`;
  return `${nome} foi marcada`;
}

/** 'HH:MM' de Brasília — o mesmo relógio do dia da marcação. */
export function horaDoEvento(evento) {
  const ms = emMs(evento?.em);
  if (!ms) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** Os mais recentes primeiro, até `n`. */
export function ultimosEventos(eventos, n = EVENTOS_A_MOSTRAR) {
  return (Array.isArray(eventos) ? eventos : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => emMs(b.em) - emMs(a.em))
    .slice(0, n);
}

/**
 * O título: "O que a Cida marcou". Com duas auxiliares ativas, "O que as
 * auxiliares marcaram" — e cada linha diz quem foi (`comNome`).
 */
export function tituloDoRegistro(nomes) {
  const lista = (Array.isArray(nomes) ? nomes : []).filter(Boolean);
  if (lista.length === 1) return { titulo: `O que a ${lista[0]} marcou`, comNome: false };
  return { titulo: 'O que as auxiliares marcaram', comNome: true };
}
