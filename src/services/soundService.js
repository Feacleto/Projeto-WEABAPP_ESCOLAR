/**
 * Sons do app — feedback auditivo das ações principais.
 *
 * Arquivos vivem em /public/sounds/. Cada chave do SOUNDS mapeia pro
 * nome real do arquivo (mantemos o nome original que o usuário enviou
 * pra evitar renomear). O `playSound(key)` faz:
 *
 *   1. Verifica preferência do usuário (localStorage tn_sounds_enabled).
 *      Default: ativado.
 *   2. Pega o Audio do pool (lazy-init na primeira chamada).
 *   3. Reseta posição pra 0 e dispara play().
 *   4. Engole erros (autoplay bloqueado, arquivo não encontrado etc).
 *
 * Pool: reutilizamos a mesma instância Audio por som — barato e funciona
 * pra toques esparsos. Pra toques sobrepostos teria que clonar, mas no
 * MVP os eventos não se atropelam.
 */

const SOUND_PATH = '/sounds/';

// Mapeamento chave → nome do arquivo em /public/sounds/.
// Nomes curtos e descritivos pra facilitar manutenção e troca de áudio.
const SOUNDS = {
  click: 'click.mp3',
  end_route: 'end-route.mp3',
  start_engine: 'start-engine.mp3',
  horn_long: 'horn-long.mp3',
  horn_short: 'horn-short.mp3',
  cash_in: 'cash-in.mp3',
  notify: 'notify.mp3',
  pay: 'pay.mp3',
  status_change: 'status-change.mp3',
  // Sons festivos — tocam quando o pai/tio clica na bolinha do mês
  birthday: 'birthday.mp3',
  halloween: 'halloween.mp3',
  easter: 'pascoa.mp3',
  christmas: 'natal.mp3',
  // Som de virada de folha — caderno animado da agenda (pai)
  page_turn: 'folhaagenda.mp3',
};

// Volumes padrão por som — calibrados pra idosos (não muito alto)
const DEFAULT_VOLUMES = {
  click: 0.4,
  end_route: 0.55,
  start_engine: 0.6,
  horn_long: 0.7,
  horn_short: 0.55,
  cash_in: 0.6,
  notify: 0.5,
  pay: 0.6,
  status_change: 0.45,
  birthday: 0.6,
  halloween: 0.55,
  easter: 0.5,
  christmas: 0.55,
  page_turn: 0.55,
};

/**
 * Sons que precisam de controle de play/pause manual (não-disparo único).
 * Pra toggle de som festivo (clica toca, clica para) usamos getSound/stopSound
 * em vez do playSound padrão.
 */
export function getSound(key) {
  if (!areSoundsEnabled()) return null;
  const file = SOUNDS[key];
  if (!file) return null;
  let audio = pool.get(key);
  if (!audio) {
    try {
      audio = new Audio(SOUND_PATH + file);
      audio.preload = 'auto';
      pool.set(key, audio);
    } catch {
      return null;
    }
  }
  audio.volume = DEFAULT_VOLUMES[key] ?? 0.6;
  return audio;
}

export function stopSound(key) {
  const audio = pool.get(key);
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

const STORAGE_KEY = 'tn_sounds_enabled';
const pool = new Map();

/**
 * Lê a preferência do usuário. Default: true (ligado).
 * Aceita 'false' / false / 0 como desligado.
 */
export function areSoundsEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw !== 'false' && raw !== '0';
  } catch {
    return true;
  }
}

export function setSoundsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // silent
  }
}

/**
 * Toca um som por chave. Engole qualquer erro (não quebra a UI):
 *   - Arquivo não existe ainda em public/sounds/
 *   - Preferência desligada
 *   - Autoplay bloqueado pelo browser (1º load sem interação)
 *
 * Opções:
 *   - volume: 0..1 (sobrescreve o default da chave)
 */
export function playSound(key, options = {}) {
  if (!areSoundsEnabled()) return;
  const file = SOUNDS[key];
  if (!file) return;

  try {
    let audio = pool.get(key);
    if (!audio) {
      audio = new Audio(SOUND_PATH + file);
      audio.preload = 'auto';
      pool.set(key, audio);
    }
    audio.volume = options.volume ?? DEFAULT_VOLUMES[key] ?? 0.6;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        // Autoplay bloqueado ou outro erro — não fazer nada
      });
    }
  } catch {
    // Silent fail — som é "nice to have", nunca pode quebrar
  }
}

/**
 * Pré-carrega todos os arquivos no pool. Chamar uma vez após a 1ª interação
 * do usuário (no Layout, depois de um click qualquer) pra evitar atraso na
 * primeira reprodução.
 */
export function preloadSounds() {
  for (const key of Object.keys(SOUNDS)) {
    if (!pool.has(key)) {
      try {
        const audio = new Audio(SOUND_PATH + SOUNDS[key]);
        audio.preload = 'auto';
        pool.set(key, audio);
      } catch {
        // ignore
      }
    }
  }
}
