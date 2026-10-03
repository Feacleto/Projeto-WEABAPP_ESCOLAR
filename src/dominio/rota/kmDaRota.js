import { haversineDistance } from '../../compartilhado/haversine.js';

/**
 * O KM DAS ROTAS, SOMADO NO CELULAR DO MOTORISTA (03/10/2026).
 *
 * O Financeiro mostra o consumo da perua (km por litro) entre dois
 * abastecimentos, e para isso precisa saber quanto ela rodou. O motorista
 * pode digitar o hodômetro; quando não digita, vale o que as rotas somaram.
 *
 * ⚠️ NENHUMA COORDENADA SAI DAQUI. A régua recebe as posições cruas do GPS
 * em memória e devolve só um número de km; quem grava é
 * `configFinanceiroService.somarKmDasRotas`, e grava o TOTAL. O trajeto do
 * motorista não é guardado em lugar nenhum — a mesma promessa da grade de
 * 150 m do mapa (`proximidade.js`), por outro caminho.
 *
 * O que é ignorado, e por quê:
 *   - precisão pior que 50 m: um ponto com 300 m de erro, somado, vira km
 *     que a perua não rodou (no portão da escola o GPS "passeia");
 *   - passo menor que 15 m: parada, o GPS oscila alguns metros a cada
 *     segundo, e dez minutos de oscilação viram centenas de metros. O ponto
 *     de partida NÃO anda nesses casos — senão quem dirige devagar nunca
 *     somaria nada, porque cada passo seria pequeno;
 *   - velocidade implícita acima de 130 km/h: é salto do GPS, não perua.
 *     Um ponto de partida ruim se corrige sozinho: o tempo passa, e a
 *     velocidade implícita até o ponto seguinte cai abaixo do teto.
 *
 * A distância é em LINHA RETA entre pontos próximos (alguns segundos), o
 * que acompanha a rua de perto. Não é o hodômetro, e a tela não deve dizer
 * que é.
 *
 * Puro de propósito: sem Firebase, sem React, sem relógio — o tempo vem do
 * `timestamp` de cada posição (`npm run testar:km-da-rota`).
 */

export const PRECISAO_MAXIMA_M = 50;
export const PASSO_MINIMO_M = 15;
export const VELOCIDADE_MAXIMA_KMH = 130;
/** A cada quantos km o celular grava o parcial (e no fim da rota). */
export const KM_PARA_GRAVAR = 5;

/** O acumulador vazio do início da rota. */
export function novoAcumulador() {
  return { km: 0, ultima: null };
}

function posicaoValida(p) {
  return (
    p != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    Number.isFinite(p.timestamp) &&
    Number.isFinite(p.accuracy) &&
    p.accuracy >= 0 &&
    p.accuracy <= PRECISAO_MAXIMA_M
  );
}

/**
 * Soma uma posição crua `{ lat, lng, accuracy, timestamp }` (timestamp em
 * ms). Devolve um acumulador NOVO; o recebido não é alterado.
 */
export function somarPosicao(acumulador, posicao) {
  const atual = acumulador || novoAcumulador();
  if (!posicaoValida(posicao)) return atual;
  const p = {
    lat: posicao.lat,
    lng: posicao.lng,
    timestamp: posicao.timestamp,
  };
  if (!atual.ultima) return { km: atual.km, ultima: p };

  const km = haversineDistance(atual.ultima.lat, atual.ultima.lng, p.lat, p.lng);
  if (km * 1000 < PASSO_MINIMO_M) return atual;

  const horas = (p.timestamp - atual.ultima.timestamp) / 3600000;
  // Posição fora de ordem (ou repetida com outro ponto) não ensina nada.
  if (!(horas > 0)) return atual;
  if (km / horas > VELOCIDADE_MAXIMA_KMH) return atual;

  return { km: atual.km + km, ultima: p };
}

/** Já rodou o bastante para gravar o parcial? */
export function horaDeGravar(acumulador) {
  return (acumulador?.km || 0) >= KM_PARA_GRAVAR;
}

/**
 * Depois de gravar: zera o km e MANTÉM o último ponto — o trecho seguinte
 * começa de onde a perua está, não do nada.
 */
export function zerarKm(acumulador) {
  return { km: 0, ultima: acumulador?.ultima || null };
}
