import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { playSound } from './soundService';

// ============================================================================
// Geocoding (Nominatim / OSM) — usado no cadastro de criança
// ============================================================================

/**
 * Geocoding via Nominatim, gratuito e sem chave.
 *
 * Limites: 1 req/segundo por IP. Como aqui é uma chamada pontual no
 * cadastro, está OK. Não chamar em loop / autocomplete.
 *
 * Retorna { lat, lng, displayName }.
 */
export async function searchAddress(address) {
  const q = (address || '').trim();
  if (!q) throw new Error('Digite um endereço.');

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'pt-BR' },
  });

  if (!res.ok) {
    throw new Error('Falha na busca. Tente novamente em alguns segundos.');
  }
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Endereço não encontrado. Tente ser mais específico.');
  }
  const result = data[0];
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    displayName: result.display_name,
  };
}

// ============================================================================
// GPS Tracking (Tio)
// ============================================================================

/**
 * A POSIÇÃO AO VIVO É POR MOTORISTA. Era um documento só pra plataforma toda.
 *
 * `liveLocation/current` guardava `driverUid` DENTRO do doc, mas o caminho era
 * fixo — e ninguém lia esse campo. Com dois motoristas em rota, cada um
 * sobrescrevia o outro a cada 30 segundos.
 *
 * Sondado em produção com duas contas reais: os dois escreveram HTTP 200 e o
 * documento terminou sendo do segundo. O pai do primeiro abriria o mapa e
 * veria a perua de um estranho — e, pior que ver errado, `PaiMap` calcula
 * `isNearby`/`hasArrived` em cima disso e dispara "a perua está chegando"
 * pela van de outro motorista. A mãe desce com a criança pra rua.
 *
 * `liveLocation/{uid}` resolve no caminho. O leitor do pai chega no uid certo
 * por `child.adminUid`, que a criança já carrega.
 */
function uidDaSessao() {
  return auth.currentUser?.uid || '_sem_sessao';
}

function docDoMotorista(uid) {
  return doc(db, 'liveLocation', uid);
}
const THROTTLE_MS = 30000;

// Estado em nível de módulo — sobrevive à troca de páginas no app.
// Permite que o motorista navegue pra TioChildren / TioFinance durante a rota
// sem perder o tracking. Não sobrevive a refresh / fechamento da aba.
let activeWatchId = null;
let lastWrite = 0;
const positionListeners = new Set();

function emitPosition(payload) {
  positionListeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (e) {
      console.error('positionListener error:', e);
    }
  });
}

export function isTracking() {
  return activeWatchId != null;
}

/**
 * Inscreve um callback pra receber updates do GPS no formato
 * `{ position, error }` (apenas um vai estar populado por chamada).
 *
 * É chamado a cada tick do GPS — SEM throttle, pra UI mostrar feedback
 * imediato (accuracy, speed, etc). O throttle só vale pra escrita no
 * Firestore.
 *
 * Retorna função de unsubscribe.
 */
export function subscribePosition(cb) {
  positionListeners.add(cb);
  return () => positionListeners.delete(cb);
}

/**
 * Inicia rastreamento GPS. Idempotente — chamadas extras com tracking ativo
 * são no-op. Lança erro se o navegador não suportar geolocation.
 *
 * Escrita no Firestore: throttle de 30s. O GPS pode entregar 1 fix/seg, mas
 * só persistimos no máximo a cada 30 segundos.
 */
export function startTracking(driverUid) {
  if (activeWatchId != null) return;
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocalização não é suportada neste dispositivo.');
  }
  lastWrite = 0;
  // Som de motor ligando — Tio começou a rota
  playSound('start_engine');

  activeWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      // Notifica UI a cada tick (sem throttle)
      emitPosition({ position, error: null });

      const now = Date.now();
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;

      try {
        await setDoc(docDoMotorista(uidDaSessao()), {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? null,
          heading: position.coords.heading ?? null,
          updatedAt: serverTimestamp(),
          routeActive: true,
          driverUid,
        });
      } catch (err) {
        console.error('liveLocation write error:', err);
      }
    },
    (error) => {
      emitPosition({ position: null, error });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

/**
 * Encerra rastreamento. Limpa o watch e marca routeActive: false.
 * Usa merge: true pra preservar lat/lng — assim a "última posição conhecida"
 * fica disponível pro Pai ver após o encerramento.
 */
export async function stopTracking() {
  if (activeWatchId != null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
  emitPosition({ position: null, error: null });
  // Som de encerramento — Tio finalizou o turno
  playSound('end_route');
  await setDoc(
    docDoMotorista(uidDaSessao()),
    { routeActive: false, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
