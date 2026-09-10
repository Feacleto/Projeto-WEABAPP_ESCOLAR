import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { playSound } from './soundService';
// A consulta do geocodificador é REGRA PURA, e por isso não mora aqui: este
// arquivo importa `firebase/firestore`, e o Node não consegue carregá-lo — era
// exatamente assim que a máquina de estado da criança e o teto de vagas
// ficaram anos sem teste. Ela está em `compartilhado/`, onde `testar:endereco`
// alcança.
import { consultaDoEndereco } from '../compartilhado/formatters';

// ============================================================================
// Endereço: CEP (ViaCEP) + coordenada (Nominatim / OSM)
// ============================================================================

/**
 * CEP → rua, bairro, cidade e UF, pelo ViaCEP. Grátis, sem chave, sem cota.
 *
 * ── POR QUE O CEP ENTROU NA FRENTE DO ENDEREÇO
 * O campo era um texto livre só ("Rua, número, bairro, cidade"), e o defeito
 * dele não é digitação: é o NÚMERO. Num campo livre, preenchido com uma mão no
 * portão da escola, o número é justamente o que se esquece — e aí o Nominatim
 * acha a RUA, centraliza no meio dela, e a tela escreve "Local confirmado!" em
 * cima de uma coordenada na quadra errada. O app não falhava, ele AFIRMAVA, e
 * é o pior dos dois.
 *
 * Com o CEP preenchendo a rua sozinho, o número sobra num campo próprio — e
 * campo próprio pode ser exigido. O conserto é esse; o ViaCEP é só o meio.
 *
 * ── A ARMADILHA: CEP INEXISTENTE RESPONDE HTTP 200
 * `viacep.com.br/ws/99999999/json/` devolve **200** com `{"erro": "true"}` no
 * corpo. Quem confere só `res.ok` conclui que deu certo, espalha `undefined`
 * pelos campos e grava endereço VAZIO em cima do que a pessoa tinha digitado.
 * Então o corpo é obrigatório na checagem — e o `erro` vem como string
 * `"true"` numa versão do ViaCEP e booleano `true` noutra, daí o teste de
 * verdade simples, que cobre as duas sem depender de qual está no ar.
 *
 * CEP malformado é o outro caminho, e esse sim responde HTTP 400.
 *
 * ── FALHAR AQUI NÃO PODE TRAVAR CADASTRO
 * O ViaCEP é serviço de terceiro sem contrato: um dia ele cai. Por isso o erro
 * é de rede, tratado como AVISO pelas telas, e o campo livre continua sendo um
 * caminho completo — o CEP acelera, não é requisito. É a mesma escolha que o
 * `capabilities.js` faz com o Storage.
 *
 * Retorna { cep, logradouro, bairro, localidade, uf }.
 */
export async function buscarCep(cepBruto) {
  const cep = String(cepBruto || '').replace(/\D/g, '');
  if (cep.length !== 8) throw new Error('CEP precisa ter 8 dígitos.');

  let res;
  try {
    res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch {
    throw new Error('Não conseguimos consultar o CEP agora.');
  }
  if (!res.ok) throw new Error('CEP não encontrado.');

  const data = await res.json();
  if (!data || data.erro) throw new Error('CEP não encontrado.');

  return {
    cep: data.cep || '',
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    localidade: data.localidade || '',
    uf: data.uf || '',
  };
}

/**
 * Endereço → coordenada, via Nominatim. Gratuito e sem chave.
 *
 * Limites: 1 req/segundo por IP. Como aqui é uma chamada pontual no
 * cadastro, está OK. Não chamar em loop / autocomplete.
 *
 * Recebe o texto livre OU, quando o CEP foi consultado, as `partes` — e nesse
 * caso a consulta é montada por `consultaDoEndereco`, com o número na frente e
 * sem o complemento.
 *
 * ── `countrycodes=br` NÃO É DETALHE
 * Sem ele, "Rua Augusta, 100" volta de LISBOA — sondado no Nominatim em
 * 10/09/2026, e "Avenida da Liberdade, 100" também. As duas são ruas
 * brasileiras banais (a Augusta é de São Paulo), então não é caso exótico: é o
 * mesmo modo de falhar do número esquecido, resposta confiante em cima de
 * coordenada errada, e a tela diz "Local confirmado!" apontando pra outro
 * continente.
 *
 * O parâmetro troca uma CLASSIFICAÇÃO por uma GARANTIA. Sem ele o resultado é
 * brasileiro quando o Nominatim decide que é — "Rua das Flores, 100" já vem do
 * Brasil sozinha, e é por isso que a falta dele passou meses aqui sem aparecer.
 *
 * Retorna { lat, lng, displayName }.
 */
export async function searchAddress(address, partes = null) {
  const q = partes ? consultaDoEndereco(partes) : String(address || '').trim();
  if (!q) throw new Error('Digite um endereço.');

  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: 'br',
    q,
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { 'Accept-Language': 'pt-BR' } }
  );

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
