/**
 * QUANDO A ROTA ESCREVE NO BANCO, E QUANDO SE CALA (03/10/2026).
 *
 * Três escritas da rota cresciam com a turma sem que nada mudasse para quem
 * lê, e as três decidem aqui, puras, se vale gravar:
 *
 *   ⚠️ A PREVISÃO DE CHEGADA ERA O(n²). A cada embarque ou entrega,
 *   `previsoesDaViagem` devolve uma linha para CADA criança que ainda espera, e
 *   `publicarPrevisoes` gravava todas — inclusive o `deleteField()` de quem
 *   nunca teve previsão. Numa perua de 20, a primeira entrega gravava 19
 *   documentos, a segunda 18… e o lote ia INTEIRO num batch só: com 19 crianças
 *   ou mais, a regra de `rides` estoura o teto de 20 `get()` e o Firestore
 *   recusa o lote todo (ver `publicarOrdemDoDia`). Agora só grava quem MUDOU
 *   mais de 2 minutos (decisão do dono) ou quem tinha previsão e voltou ao
 *   horário — e em fatias de 15.
 *
 *   ⚠️ A POSIÇÃO AO VIVO REGRAVAVA O MESMO PONTO. A referência é encaixada numa
 *   grade de 150 m, então a perua parada no portão — ou andando devagar dentro
 *   do mesmo quadrado — produzia o MESMO `lat/lng` a cada 30 s do GPS e a cada
 *   minuto do pulso. Agora ponto igual não é escrita; o que sobra é o pulso de
 *   vida (`updatedAt`) a cada 2 minutos, folgado contra os 90 minutos em que
 *   `closeStaleRoutes` dá a rota por abandonada.
 *
 * Puro, sem Firebase: `npm run testar:viagem` e `npm run testar:proximidade`.
 */

import { emMinutos } from './horarios.js';

/** Mudou até 2 minutos? A família não ganha nada com a escrita. */
export const LIMIAR_DA_PREVISAO_MIN = 2;

/**
 * O teto de documentos de crianças DIFERENTES num lote — o mesmo 15 de
 * `publicarOrdemDoDia`, pelo mesmo motivo: a regra de `rides` faz um `get()`
 * na criança, e o Firestore corta em 20 acessos por requisição.
 */
export const LOTE_MAXIMO = 15;

/** A chave da memória: uma previsão por criança, por dia, por direção. */
export function chaveDaPrevisao(dateKey, p) {
  return `${dateKey}|${p.childId}|${p.campo}`;
}

/**
 * Das previsões calculadas, quais VALEM uma escrita.
 *
 * `publicadas` é a memória do que este aparelho já gravou: um objeto
 * `{ 'dia|criança|campo': 'HH:MM' }`. Ele NÃO é alterado — volta uma cópia
 * nova em `publicadas`, para quem chama guardar só depois de gravar.
 *
 *   - valor novo sem nada antes          → grava
 *   - valor novo a MAIS de 2 min do antigo → grava
 *   - valor novo a até 2 min do antigo   → cala (o antigo continua bom)
 *   - null com valor antes               → grava o apagar (voltou ao horário)
 *   - null sem nada antes                → cala: nunca houve o que apagar
 *
 * ⚠️ A memória morre se o app recarregar no meio da rota. O custo é uma
 * previsão antiga ficar na tela até a próxima mudança de verdade — e a tela da
 * família já a esconde quando o marco daquela direção chega.
 */
export function previsoesParaGravar(previsoes, publicadas = {}, dateKey = '') {
  const memoria = { ...publicadas };
  const escrever = [];
  for (const p of previsoes || []) {
    if (!p?.childId || !p.campo) continue;
    const chave = chaveDaPrevisao(dateKey, p);
    const antes = memoria[chave] ?? null;
    const agora = p.previsao ?? null;
    if (agora == null) {
      if (antes == null) continue;
      escrever.push({ ...p, previsao: null });
      delete memoria[chave];
      continue;
    }
    if (antes != null) {
      const a = emMinutos(antes);
      const b = emMinutos(agora);
      if (a != null && b != null && Math.abs(b - a) <= LIMIAR_DA_PREVISAO_MIN) continue;
    }
    escrever.push(p);
    memoria[chave] = agora;
  }
  return { escrever, publicadas: memoria };
}

/** Parte uma lista em fatias de no máximo `tamanho` (lotes de escrita). */
export function emLotes(lista, tamanho = LOTE_MAXIMO) {
  const t = Math.max(1, Math.floor(tamanho) || 1);
  const lotes = [];
  for (let i = 0; i < (lista || []).length; i += t) lotes.push(lista.slice(i, i + t));
  return lotes;
}

/**
 * O pulso de vida da rota: sem mudança no ponto, `updatedAt` é renovado no
 * máximo a cada 2 minutos. `closeStaleRoutes` (functions/lib/routes.js) só fecha
 * depois de 90 minutos sem `updatedAt` — a folga é de 45 pulsos perdidos.
 */
export const PULSO_DE_VIDA_MS = 120000;

/**
 * Esta posição de REFERÊNCIA vale uma escrita em `liveLocation`?
 *
 *   - `ultima` é o que foi gravado da última vez: { lat, lng, semMapa, em }
 *     (lat/lng null quando o mapa estava desligado), ou null se nada foi.
 *   - `atual` é o que se gravaria agora: { lat, lng, semMapa }.
 *
 * Grava quando o ponto mudou de quadrado, quando o mapa ligou ou desligou, ou
 * quando o último registro já tem 2 minutos — o pulso que mantém a rota viva.
 */
export function deveGravarPosicao({ ultima, atual, agora }) {
  if (!ultima) return true;
  if (!!ultima.semMapa !== !!atual?.semMapa) return true;
  if ((ultima.lat ?? null) !== (atual?.lat ?? null)) return true;
  if ((ultima.lng ?? null) !== (atual?.lng ?? null)) return true;
  return agora - (ultima.em || 0) >= PULSO_DE_VIDA_MS;
}
