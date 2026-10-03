/**
 * A BUZINA DIGITAL — quando ela ainda vale e o que ela diz (03/10/2026).
 *
 * ── ⚠️ A CHAMADA NÃO EXPIRAVA
 * `pendingCalls` só saía de `ringing`/`acknowledged` por um toque — do
 * motorista ("encerrar") ou da família. Quem não tocava em nada deixava a
 * chamada aberta para sempre, e ela voltava a tocar em tela cheia na próxima
 * vez que a mãe abrisse o app: à noite, ou no dia seguinte, sobre uma perua
 * que já tinha ido embora. Buzina é coisa de porta, e porta dura minutos.
 *
 * ── O MOMENTO DIZ QUEM TEM QUE DESCER
 * O texto dizia sempre "chegou pra entregar". De manhã a perua chega para
 * BUSCAR — quem desce é a criança, e "entregar" a uma mãe que está
 * terminando de vestir o filho é a frase errada no pior minuto.
 *
 * Puro: sem Firebase, sem React. `npm run testar:buzina`.
 */

export const VALIDADE_DA_BUZINA_MIN = 15;

export const MOMENTO_DA_BUZINA = {
  BUSCAR: 'buscar',
  ENTREGAR: 'entregar',
};

function emMs(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  return null;
}

/**
 * A chamada ainda deve aparecer? Aberta E com menos de 15 minutos. Sem
 * `createdAt` (o carimbo do servidor ainda não voltou), vale: é a chamada
 * que acabou de nascer.
 */
export function buzinaValendo(chamada, agora = Date.now()) {
  if (!chamada) return false;
  if (chamada.status !== 'ringing' && chamada.status !== 'acknowledged') return false;
  const criada = emMs(chamada.createdAt);
  if (criada == null) return true;
  return agora - criada < VALIDADE_DA_BUZINA_MIN * 60 * 1000;
}

/** Do status da criança na hora da buzina: em casa → buscar; senão → entregar. */
export function momentoDaBuzina(statusDaCrianca) {
  return statusDaCrianca === 'home' || !statusDaCrianca
    ? MOMENTO_DA_BUZINA.BUSCAR
    : MOMENTO_DA_BUZINA.ENTREGAR;
}

/** A frase do celular da família, nos dois momentos. */
export function fraseDaBuzina({ momento, nomeDaCrianca }) {
  const nome = String(nomeDaCrianca || '').trim().split(/\s+/)[0] || 'a criança';
  return momento === MOMENTO_DA_BUZINA.ENTREGAR
    ? `O motorista está na porta para entregar ${nome}. Pode descer?`
    : `O motorista está na porta para buscar ${nome}. Pode descer?`;
}
