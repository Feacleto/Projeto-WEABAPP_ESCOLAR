import { doc, setDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { haversineDistance } from '../compartilhado/haversine';
import {
  PRECISAO_DO_MAPA_M,
  arredondarParaReferencia,
  zonaDaPerua,
  zonasQueMudaram,
} from '../dominio/rota/proximidade';
import { publicarProximidade } from './ridesService';
import { getDateKey } from '../dominio/rota/horarios';
import { auth, db } from '../firebase/config';
import { playSound } from './soundService';
// A consulta do geocodificador é REGRA PURA, e por isso não mora aqui: este
// arquivo importa `firebase/firestore`, e o Node não consegue carregá-lo — era
// exatamente assim que a máquina de estado da criança e o teto de vagas
// ficaram anos sem teste. Ela está em `compartilhado/`, onde `testar:endereco`
// alcança.
import { consultaDoEndereco } from '../compartilhado/formatters';
import { lugarDoEndereco } from '../dominio/identidade/cadastroDoMotorista.js';
import { podeBuscarRua, sugestoesDeRua } from '../compartilhado/ruas';
import { criarFilaComIntervalo } from '../compartilhado/filaComIntervalo';
import { deveGravarPosicao } from '../dominio/rota/escritasDaRota';
import { novoAcumulador, somarPosicao, horaDeGravar, zerarKm } from '../dominio/rota/kmDaRota';
import { somarKmDasRotas } from './configFinanceiroService';

/**
 * ⚠️ TODA CHAMADA AO NOMINATIM PASSA POR ESTA FILA (03/10/2026). A política
 * de uso dele é 1 requisição por segundo POR APLICAÇÃO, e o app chamava o
 * `fetch` direto de quatro telas. A fila espaça as saídas em 1 s, junta o
 * mesmo pedido em voo numa chamada só e guarda as últimas respostas boas.
 * Ver `compartilhado/filaComIntervalo.js`.
 */
const filaDoNominatim = criarFilaComIntervalo({ intervaloMs: 1000 });

/** GET no Nominatim pela fila: devolve o JSON, ou lança em resposta não-ok. */
function pedirAoNominatim(caminho, params) {
  const url = `https://nominatim.openstreetmap.org/${caminho}?${params.toString()}`;
  return filaDoNominatim(url, async () => {
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    return res.json();
  });
}

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
 * Limites: 1 req/segundo por aplicação — garantido por `filaDoNominatim`.
 * Mesmo assim, não chamar em loop / autocomplete: a política proíbe.
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

  let data;
  try {
    data = await pedirAoNominatim('search', params);
  } catch {
    throw new Error('Falha na busca. Tente novamente em alguns segundos.');
  }
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

/**
 * AS RUAS COM ESTE NOME, NESTA CIDADE — a busca ao contrário do ViaCEP
 * (02/10/2026). O motorista digita o nome da rua e escolhe na lista, e o CEP
 * vem junto. Quem lê a resposta é `compartilhado/ruas.js`, puro.
 *
 * Erro de rede é AVISO, como na consulta por CEP: o campo livre continua
 * sendo um caminho completo.
 */
export async function buscarRuas({ uf, cidade, rua }) {
  if (!podeBuscarRua({ uf, cidade, rua })) return [];
  const url =
    `https://viacep.com.br/ws/${encodeURIComponent(uf.toUpperCase())}/` +
    `${encodeURIComponent(cidade.trim())}/${encodeURIComponent(rua.trim())}/json/`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Não foi possível consultar as ruas agora.');
  }
  if (!res.ok) return [];
  return sugestoesDeRua(await res.json());
}

/**
 * CIDADE E BAIRRO DE ONDE ELE ESTÁ — o último passo do primeiro acesso.
 *
 * O card não pergunta cidade nem bairro (decisão do dono, 02/10/2026): ele
 * pede a permissão de localização, e é ela que responde. Uma leitura só,
 * sem `watchPosition`, e ⚠️ A COORDENADA NUNCA SAI DESTA FUNÇÃO — ela vai ao
 * endereço reverso e morre aqui. O que volta são os dois NOMES, que é o que
 * o contrato e o painel do dono leem.
 *
 * Erros saem com `code`:
 *   - 'negado'      — ele recusou a permissão (o navegador não pergunta de
 *                     novo; quem chama oferece digitar a cidade)
 *   - 'sem-posicao' — sem sinal, tempo esgotado, ou navegador sem GPS
 *   - 'sem-cidade'  — a posição veio e o endereço reverso não achou cidade
 */
export async function lugarDaPosicaoAtual() {
  const erro = (code, message) => Object.assign(new Error(message), { code });
  if (!('geolocation' in navigator)) {
    throw erro('sem-posicao', 'Este navegador não informa a localização.');
  }

  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 600000,
    });
  }).catch((e) => {
    throw e?.code === 1
      ? erro('negado', 'Localização não permitida.')
      : erro('sem-posicao', 'Não deu pra achar sua localização.');
  });

  // zoom 14 é o nível de bairro: mais perto devolve a rua (que não se grava),
  // mais longe perde o bairro.
  const params = new URLSearchParams({
    format: 'json',
    lat: String(pos.coords.latitude),
    lon: String(pos.coords.longitude),
    zoom: '14',
    addressdetails: '1',
  });
  let lugar = { city: '', regiao: '' };
  try {
    lugar = lugarDoEndereco((await pedirAoNominatim('reverse', params))?.address);
  } catch {
    // rede caiu: cai no mesmo caminho de "não achou cidade"
  }
  if (!lugar.city) throw erro('sem-cidade', 'Não deu pra descobrir sua cidade.');
  return lugar;
}

/**
 * "VOCÊ ESTÁ NO POSTO AGORA?" — a posição lida UMA vez, no abastecer
 * (04/10/2026, pedido do dono). Devolve `{ lat, lng, endereco }`: o ponto
 * serve para achar um posto que ele já usou, e o endereço (rua, número e
 * bairro) é o que a tela mostra e o que se guarda junto do nome do posto.
 *
 * ⚠️ NADA AQUI GRAVA. Quem decide guardar é o "Abasteci"/"Guardar só o preço",
 * e o que vai é o ponto DO POSTO, na lista de postos dele (só ele lê). Sem
 * endereço (rede caiu), o ponto ainda serve para reconhecer o posto.
 *
 * Precisão alta e posição fresca: aqui a resposta é "qual posto", e a
 * diferença entre dois postos da mesma avenida é de cem metros.
 */
export async function posicaoNoPosto() {
  const erro = (code, message) => Object.assign(new Error(message), { code });
  if (!('geolocation' in navigator)) {
    throw erro('sem-posicao', 'Este navegador não informa a localização.');
  }
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  }).catch((e) => {
    throw e?.code === 1
      ? erro('negado', 'Localização não permitida.')
      : erro('sem-posicao', 'Não deu pra achar sua localização.');
  });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  // zoom 18 é o nível do prédio: traz a rua e, quando há, o número.
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
  });
  let endereco = '';
  try {
    const a = (await pedirAoNominatim('reverse', params))?.address || {};
    const rua = [a.road || a.pedestrian || '', a.house_number || ''].filter(Boolean).join(', ');
    const bairro = a.suburb || a.neighbourhood || a.city_district || '';
    endereco = [rua, bairro].filter(Boolean).join(' · ');
  } catch {
    // sem rede: o ponto ainda reconhece o posto; o endereço fica em branco
  }
  return { lat, lng, endereco };
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

/**
 * As crianças desta rota e onde elas moram — entregue no `startTracking`.
 *
 * Fica no módulo, e não na tela, porque a medição precisa acontecer enquanto
 * a rota roda, independente de qual tela está montada. O motorista troca de
 * tela o tempo todo; a perua não para.
 */
let alvosDaRota = [];
/** A última faixa publicada por criança — só a MUDANÇA vira escrita. */
let zonasPublicadas = {};
/** Ele quer que as famílias vejam a perua no mapa hoje? */
let compartilhaPosicao = true;

// Estado em nível de módulo — sobrevive à troca de páginas no app.
// Permite que o motorista navegue pra TioChildren / TioFinance durante a rota
// sem perder o tracking. Não sobrevive a refresh / fechamento da aba.
let activeWatchId = null;
let lastWrite = 0;
const positionListeners = new Set();

/**
 * ⚠️ A ROTA QUE SE ENCERRAVA SOZINHA (03/10/2026). O servidor fecha a rota que
 * passa tempo demais sem gravar posição (`closeStaleRoutes`), e o celular
 * deixava de gravar em dois casos comuns no dia de um motorista:
 *
 *   - PERUA PARADA. `watchPosition` só entrega posição NOVA; parado no portão
 *     da escola esperando a saída, ele quase não entrega nada, e nada era
 *     gravado. O PULSO regrava a última posição a cada minuto.
 *   - TELA APAGADA. Num app de navegador, o celular para o GPS quando a tela
 *     apaga. A TELA ACESA (Wake Lock) é o que os apps de navegação fazem
 *     durante o trajeto — e o motorista dirige com o celular no suporte.
 *
 * O terceiro caso é o app RECARREGAR no meio da rota (atualização, memória):
 * quem religa é `ControleDeRota`, com `retomando: true`.
 */
const PULSO_MS = 60000;
let pulso = null;
let ultimaExata = null;
/**
 * O que foi GRAVADO da última vez: { lat, lng, semMapa, em }. ⚠️ A referência
 * é encaixada em 150 m, então a perua parada (ou devagar no mesmo quadrado)
 * produzia o MESMO ponto a cada 30 s — e cada um era uma escrita que nenhuma
 * família via mudar. `deveGravarPosicao` decide: ponto novo, mapa ligado ou
 * desligado, ou 2 minutos sem escrever (o pulso de vida que `closeStaleRoutes`
 * lê — ele só fecha a rota depois de 90 minutos sem `updatedAt`).
 */
let ultimaGravada = null;
let motoristaDaRota = null;
let telaAcesa = null;

/**
 * O KM DA ROTA (03/10/2026), para o consumo da perua no Financeiro. Cada
 * posição CRUA do GPS alimenta o acumulador em memória — antes do throttle e
 * antes do encaixe na grade de 150 m, porque a grade somaria saltos de
 * quadrado, não a rua. ⚠️ Só o TOTAL é gravado (`configFinanceiro.kmDasRotas`),
 * a cada 5 km e ao encerrar; nenhuma coordenada sai daqui por este caminho.
 * O que o app recarregar no meio perde só o trecho desde a última gravação.
 * A régua (o que é ruído, o que é salto) é `dominio/rota/kmDaRota.js`.
 */
let kmDaRota = novoAcumulador();

function gravarKmParcial() {
  const km = kmDaRota.km;
  if (!(km > 0) || !motoristaDaRota) return;
  kmDaRota = zerarKm(kmDaRota);
  // Sem `await`: o km é do Financeiro, e a rota não espera por ele.
  somarKmDasRotas(motoristaDaRota, km).catch((err) => {
    console.error('kmDasRotas write error:', err);
  });
}

function acumularKm(position) {
  kmDaRota = somarPosicao(kmDaRota, {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  });
  if (horaDeGravar(kmDaRota)) gravarKmParcial();
}

async function manterTelaAcesa() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (telaAcesa && !telaAcesa.released) return;
    telaAcesa = await navigator.wakeLock.request('screen');
  } catch {
    // Bateria fraca, navegador sem suporte: a rota segue sem a tela acesa.
  }
}

// O navegador SOLTA a trava quando a tela some (troca de app); ao voltar,
// pede de novo — senão ela valeria só até o primeiro WhatsApp.
function aoVoltarParaATela() {
  if (activeWatchId != null && document.visibilityState === 'visible') manterTelaAcesa();
}

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
 * Grava a posição de REFERÊNCIA (nunca a exata) — chamada pelo GPS e pelo
 * pulso de um minuto.
 */
async function gravarPosicao(exata, driverUid, { forcar = false } = {}) {
  try {
    // ⚠️ A POSIÇÃO EXATA NUNCA SAI DAQUI, e é isso que faz a promessa
    // valer. Arredondar no MAPA não arredonda nada: o documento continua
    // com o número cru e qualquer pessoa com o console do navegador lê.
    // "Segurança mora nas rules, não na interface" — aqui, na origem.
    //
    // `speed` e `heading` saíram junto (11/09/2026): ninguém lia, e
    // velocidade instantânea de um trabalhador é vigilância do trabalho
    // dele, não informação sobre a criança.
    const referencia = compartilhaPosicao
      ? arredondarParaReferencia(exata)
      : null;
    const atual = {
      lat: referencia?.lat ?? null,
      lng: referencia?.lng ?? null,
      semMapa: !compartilhaPosicao,
    };
    if (!forcar && !deveGravarPosicao({ ultima: ultimaGravada, atual, agora: Date.now() })) {
      return;
    }

    await setDoc(docDoMotorista(uidDaSessao()), {
      ...(referencia
        ? {
            lat: referencia.lat,
            lng: referencia.lng,
            // A precisão publicada é a da GRADE, não a do GPS. Dizer "5 m"
            // ao lado de um ponto encaixado em 150 m é a interface
            // mentindo com número.
            accuracy: PRECISAO_DO_MAPA_M,
          }
        : { lat: deleteField(), lng: deleteField(), accuracy: deleteField() }),
      // ⚠️ ELE DESLIGOU O MAPA, NÃO A ROTA. Sem esta bandeira, a tela da
      // família não distingue "ele escolheu não mostrar" de "o celular
      // dele está sem sinal" — e a segunda faz ela ligar pra ele.
      semMapa: !compartilhaPosicao,
      updatedAt: serverTimestamp(),
      routeActive: true,
      driverUid,
      // ⚠️ `merge: true` NÃO É DETALHE (03/10/2026). Sem ele o SDK RECUSA o
      // `deleteField()` do mapa desligado ("cannot be used with set() unless
      // you pass {merge:true}") — com o mapa desligado NENHUMA posição era
      // gravada: a família via "sem posição, pode ser o celular dele sem
      // sinal" em vez de "ele prefere não mostrar a perua", e o servidor
      // fechava a rota como abandonada. E com merge, a OCORRÊNCIA (perua
      // quebrada) não some no pulso seguinte.
    }, { merge: true });
    ultimaGravada = { ...atual, em: Date.now() };
  } catch (err) {
    console.error('liveLocation write error:', err);
  }
}

/**
 * Inicia rastreamento GPS. Idempotente — chamadas extras com tracking ativo
 * são no-op. Lança erro se o navegador não suportar geolocation.
 *
 * Escrita no Firestore: throttle de 30s. O GPS pode entregar 1 fix/seg, mas
 * só persistimos no máximo a cada 30 segundos — e só se o ponto de
 * referência mudou ou o pulso de vida venceu (`deveGravarPosicao`).
 */
export function startTracking(driverUid, opcoes = {}) {
  if (activeWatchId != null) return;
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocalização não é suportada neste dispositivo.');
  }
  lastWrite = 0;
  ultimaExata = null;
  ultimaGravada = null;
  motoristaDaRota = driverUid;
  kmDaRota = novoAcumulador();
  alvosDaRota = Array.isArray(opcoes.alvos) ? opcoes.alvos : [];
  zonasPublicadas = {};
  // ⚠️ AUSENTE SIGNIFICA LIGADO. Quem nunca viu a chave não pode ter o mapa
  // apagado das famílias dele sem ter escolhido nada — e ele nem saberia que
  // existe um botão para religar.
  compartilhaPosicao = opcoes.compartilha !== false;
  // Som de motor ligando — Tio começou a rota. Retomar (o app recarregou no
  // meio da rota) não é começar: sem som.
  if (!opcoes.retomando) playSound('start_engine');
  manterTelaAcesa();
  document.addEventListener('visibilitychange', aoVoltarParaATela);
  // O pulso só PERGUNTA a cada minuto: quem decide se grava é
  // `deveGravarPosicao` — parado no mesmo quadrado, o `updatedAt` é renovado
  // a cada 2 minutos, e não a cada um.
  pulso = setInterval(() => {
    if (!ultimaExata) return;
    gravarPosicao(ultimaExata, motoristaDaRota);
  }, PULSO_MS);

  activeWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      // Notifica UI a cada tick (sem throttle)
      emitPosition({ position, error: null });
      // O km soma TODO ponto, não só os que passam pelo throttle de escrita.
      acumularKm(position);

      const now = Date.now();
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;

      const exata = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      ultimaExata = exata;
      await gravarPosicao(exata, driverUid);

      // ── O AVISO DE CHEGADA, MEDIDO AQUI ───────────────────────────────
      //
      // ⚠️ RODA MESMO COM O MAPA DESLIGADO, de propósito: o que ele desligou
      // foi o compartilhamento da posição, não o aviso às famílias. O GPS
      // continua ligado no aparelho dele — e o rótulo da chave diz isso, para
      // ele não descobrir depois e se sentir enganado.
      //
      // Falhar aqui não pode derrubar a rota: é aviso de terceiro, e a perua
      // não espera por ele.
      try {
        const agora = {};
        for (const alvo of alvosDaRota) {
          if (!alvo?.childId || !Number.isFinite(alvo.lat) || !Number.isFinite(alvo.lng)) {
            continue;
          }
          agora[alvo.childId] = zonaDaPerua(
            haversineDistance(alvo.lat, alvo.lng, exata.lat, exata.lng)
          );
        }
        const mudaram = zonasQueMudaram(zonasPublicadas, agora);
        for (const { childId, zona } of mudaram) {
          const alvo = alvosDaRota.find((a) => a.childId === childId);
          await publicarProximidade({
            childId,
            // O dia é recalculado a cada tick, não congelado no início: a
            // rota da tarde pode atravessar a meia-noite num atraso, e o
            // marco tem que cair no documento do dia em que aconteceu.
            dateKey: getDateKey(),
            zona,
            adminUid: driverUid,
            parentUid: alvo?.parentUid || null,
          });
          zonasPublicadas[childId] = zona;
        }
      } catch (err) {
        console.error('proximidade write error:', err);
      }
    },
    (error) => {
      emitPosition({ position: null, error });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

/**
 * LIGAR OU DESLIGAR O MAPA NO MEIO DA ROTA (03/10/2026, pedido do dono).
 *
 * A chave só existia antes de iniciar, e desligar no caminho exigia encerrar
 * a rota — o que apaga a perua de todas as famílias e para os avisos. Agora a
 * escolha vale na hora: a posição é regravada JÁ, com ou sem coordenada, em
 * vez de esperar o próximo ponto do GPS (que, com a perua parada no portão,
 * pode demorar o pulso inteiro). Sem rota rodando, só guarda para a próxima.
 */
export function definirCompartilhamentoDaRota(compartilha) {
  compartilhaPosicao = compartilha !== false;
  if (activeWatchId == null || !ultimaExata || !motoristaDaRota) return;
  lastWrite = Date.now();
  gravarPosicao(ultimaExata, motoristaDaRota, { forcar: true });
}

/**
 * PROBLEMA NA ROTA (03/10/2026): `'perua_quebrou'` marca, `null` limpa. Mora no
 * documento da posição porque é ele que a família lê para saber como a rota
 * está — e com `merge` o pulso seguinte não o apaga.
 */
export async function marcarOcorrencia(tipo) {
  await setDoc(
    docDoMotorista(uidDaSessao()),
    {
      ocorrencia: tipo ? { tipo, em: serverTimestamp() } : deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Encerra rastreamento. Limpa o watch, o pulso e a tela acesa, marca
 * `routeActive: false` e APAGA a última posição (ver o comentário abaixo).
 */
export async function stopTracking() {
  if (activeWatchId != null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
  if (pulso) clearInterval(pulso);
  pulso = null;
  // O que sobrou do km desta rota vai antes de o acumulador zerar.
  gravarKmParcial();
  kmDaRota = novoAcumulador();
  ultimaExata = null;
  ultimaGravada = null;
  document.removeEventListener('visibilitychange', aoVoltarParaATela);
  telaAcesa?.release?.().catch(() => {});
  telaAcesa = null;
  emitPosition({ position: null, error: null });
  alvosDaRota = [];
  zonasPublicadas = {};
  // Som de encerramento — Tio finalizou o turno
  playSound('end_route');
  await setDoc(
    docDoMotorista(uidDaSessao()),
    {
      routeActive: false,
      // ⚠️ A ÚLTIMA POSIÇÃO É APAGADA, E ANTES ERA GUARDADA DE PROPÓSITO.
      //
      // O comentário aqui dizia: "usa merge pra preservar lat/lng, assim a
      // última posição conhecida fica disponível pro Pai ver". Só que a rota
      // termina ONDE ELE PARA — a última casa, ou a dele. Esse ponto ficava
      // legível pelas famílias a noite inteira, até a rota seguinte.
      //
      // A Política de Privacidade abençoava isso ("mantém-se apenas o último
      // ponto registrado para fins de auditoria limitada") e **essa auditoria
      // não existe em tela nenhuma**. Dado de localização guardado sem leitor
      // é só passivo. A cláusula 8 foi reescrita na mesma alteração.
      lat: deleteField(),
      lng: deleteField(),
      accuracy: deleteField(),
      // A ocorrência é desta rota: encerrou, ela sai junto.
      ocorrencia: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
