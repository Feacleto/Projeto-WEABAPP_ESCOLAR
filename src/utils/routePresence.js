/**
 * Descreve, com honestidade, o que o app sabe sobre a perua agora.
 *
 * POR QUE ISTO EXISTE
 * Antes o painel do pai tinha só dois mundos: rota ativa (mostra distância)
 * ou não-ativa (mostra "em casa"). O problema é que "em casa" era usado pra
 * dois fatos diferentes — a criança realmente chegou, OU o tio nem começou a
 * rota. E se o tio fechasse a aba no meio do caminho, `routeActive` ficava
 * `true` pra sempre e o mapa desenhava a perua parada como se fosse verdade.
 *
 * A regra de produto aqui: na dúvida entre parecer INCOMPLETO e parecer
 * ERRADO, escolher incompleto. O pai perdoa "ainda não saiu"; não perdoa
 * "chegou" quando não chegou.
 */

// Sem escrita nova por este tempo, a posição deixa de ser confiável.
// O tracking grava a cada 30 s, então 5 min são ~10 gravações perdidas.
const STALE_MS = 5 * 60 * 1000;

export const PRESENCE = {
  NO_ROUTE: 'no-route',
  STALE: 'stale',
  MOVING: 'moving',
};

/** Timestamp do Firestore, Date ou número → ms. */
function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "agora", "há 40 segundos", "há 3 minutos", "há 2 horas". */
export function formatFreshness(ms) {
  if (ms == null) return null;
  const secs = Math.max(0, Math.round(ms / 1000));
  if (secs < 15) return 'agora';
  if (secs < 60) return `há ${secs} segundos`;
  const mins = Math.round(secs / 60);
  if (mins === 1) return 'há 1 minuto';
  if (mins < 60) return `há ${mins} minutos`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
}

/**
 * A DISTÂNCIA, QUE É MEDIDA — no lugar do minuto, que era palpite.
 *
 * Aqui existia `estimateMinutes`: distância em LINHA RETA dividida por uma
 * velocidade urbana fixa de 18 km/h. Ela estampava "Chega em uns 7 minutos"
 * no bloco de maior confiança da tela do responsável.
 *
 * É exatamente a conta que foi ARRANCADA do `HorarioDoDia`, e o cabeçalho de
 * lá diz por quê: "um número que o app inventava". Ela sobreviveu aqui
 * porque ninguém olhou duas vezes pro mesmo erro em dois arquivos.
 *
 * O que ela ignora não é detalhe: quarteirão, sentido de mão, semáforo, e as
 * OUTRAS CRIANÇAS. A perua a 2 km de linha reta pode ter quatro paradas pela
 * frente. A mãe lê sete minutos, desce com a criança, e espera vinte na
 * calçada — e quem errou, pra ela, foi o motorista.
 *
 * Distância é fato: sai do GPS dele e do endereço dela, sem inferência no
 * meio. Ela não responde "quando", mas não mente — e quem responde "quando" é
 * o aviso de proximidade, que dispara por faixa e não por conta.
 */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * Estado honesto da perua.
 *
 * Retorna:
 *   kind        — 'no-route' | 'stale' | 'moving'
 *   title       — frase principal, pronta pra tela
 *   detail      — linha de apoio (pode ser null)
 *   freshness   — "atualizado há 40 segundos" (null quando não se aplica)
 *   isStale     — true quando a posição está velha demais pra confiar
 *   distanceKm, etaMinutes — null quando indisponíveis
 */
export function describeRoutePresence({
  liveLocation,
  distanceKm = null,
  now = Date.now(),
}) {
  const routeActive = !!liveLocation?.routeActive;
  const updatedMs = toMillis(liveLocation?.updatedAt);
  const ageMs = updatedMs != null ? now - updatedMs : null;

  // Rota não iniciada — o fato mais comum, e o que antes se disfarçava de
  // "em casa".
  if (!routeActive) {
    return {
      kind: PRESENCE.NO_ROUTE,
      title: 'A rota de hoje ainda não começou',
      detail:
        'Quando o motorista iniciar, você acompanha aqui em tempo real.',
      freshness: null,
      isStale: false,
      distanceKm: null,
      etaMinutes: null,
    };
  }

  // Rota marcada como ativa mas sem posição nova: pode ser o celular do
  // motorista sem sinal, ou a aba fechada sem encerrar a rota.
  if (ageMs == null || ageMs > STALE_MS) {
    return {
      kind: PRESENCE.STALE,
      title:
        ageMs == null
          ? 'Sem posição do motorista'
          : `Sem posição há ${formatFreshness(ageMs)?.replace('há ', '') || 'um tempo'}`,
      detail:
        'Pode ser só o celular dele sem sinal. Se precisar, fale direto com o motorista.',
      freshness: ageMs != null ? `atualizado ${formatFreshness(ageMs)}` : null,
      isStale: true,
      distanceKm,
      etaMinutes: null,
    };
  }

  const distancia = formatDistance(distanceKm);

  return {
    kind: PRESENCE.MOVING,
    title: distancia ? `A perua está a ${distancia} daqui` : 'Perua em rota',
    // A frase que devolve o "quando" sem inventá-lo: o app avisa, ela não
    // precisa ficar calculando na cabeça a partir da distância.
    detail: distancia ? 'Avisamos quando estiver perto.' : null,
    freshness: `atualizado ${formatFreshness(ageMs)}`,
    isStale: false,
    distanceKm,
    etaMinutes: null,
  };
}
