/**
 * A FAIXA DA PERUA E O ARREDONDAMENTO DO MAPA.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Duas contas que trocaram de lado em 11/09/2026, e as duas têm um jeito
 * silencioso de errar.
 *
 * 1. O AVISO DE CHEGADA mudou do celular da MÃE para o do MOTORISTA. Antes
 *    ele dependia da coordenada publicada — então desligar o mapa mataria o
 *    aviso junto, para uma coisa que não tem relação nenhuma com a outra.
 *    Agora o que viaja é uma PALAVRA (`longe`/`perto`/`chegou`), nunca a
 *    distância: três casas com distância conhecida dão o ponto exato por
 *    triangulação, então publicar "1,2 km" seria republicar a posição.
 *
 * 2. O MAPA VIROU REFERÊNCIA. A posição é encaixada numa grade de 150 m antes
 *    de sair do aparelho — e o tamanho não é gosto: é o teto que os 400 m do
 *    "chegou" permitem. Arredondar mais grosso faz o aviso virar sorteio.
 *
 * ⚠️ O ERRO QUE ESTE ARQUIVO MAIS PRECISA PEGAR é trocar o encaixe por RUÍDO
 * ALEATÓRIO. Parece equivalente e é o oposto: quem guardar trinta envios e
 * tirar a média recupera o ponto verdadeiro MAIS RÁPIDO com ruído do que sem
 * ele. Encaixado, o valor publicado é o mesmo enquanto ele estiver na mesma
 * célula, e média nenhuma passa disso.
 *
 * COMO RODAR
 *   node scripts/testar-proximidade.mjs   (ou: npm run testar:proximidade)
 */

import { readFileSync } from 'node:fs';
import {
  ARRIVED_KM,
  NEAR_KM,
  PRECISAO_DO_MAPA_M,
  ZONA,
  arredondarParaReferencia,
  zonaDaPerua,
  zonasQueMudaram,
} from '../src/dominio/rota/proximidade.js';
import { haversineDistance } from '../src/compartilhado/haversine.js';
import { deveGravarPosicao, PULSO_DE_VIDA_MS } from '../src/dominio/rota/escritasDaRota.js';
import { PRESENCE, describeRoutePresence } from '../src/dominio/rota/routePresence.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const a = JSON.stringify(esperado);
  const b = JSON.stringify(obtido);
  if (a === b) {
    ok += 1;
    console.log('  ok  ' + nome);
  } else {
    bad += 1;
    falhas.push(`${nome} — esperado ${a}, veio ${b}`);
    console.log(` FALHA ${nome}`);
  }
}
function bloco(t) {
  console.log(`\n${t}`);
}

bloco('1. As faixas, e as bordas delas');

checar('longe', ZONA.LONGE, zonaDaPerua(5));
checar('na borda de "chegando" ainda é longe', ZONA.LONGE, zonaDaPerua(NEAR_KM + 0.001));
checar('exatamente 2 km já é chegando', ZONA.PERTO, zonaDaPerua(NEAR_KM));
checar('perto', ZONA.PERTO, zonaDaPerua(1));
checar('exatamente 400 m já é chegou', ZONA.CHEGOU, zonaDaPerua(ARRIVED_KM));
checar('na porta', ZONA.CHEGOU, zonaDaPerua(0.05));
// ⚠️ ZERO É DISTÂNCIA VÁLIDA. Um `if (!distanceKm)` devolveria null bem no
// caso em que ele está na porta — o aviso mais importante dos três.
checar('zero é chegou, não "sem dado"', ZONA.CHEGOU, zonaDaPerua(0));

// Sem medida não se inventa faixa: silêncio é melhor que avisar errado.
checar('sem distância não há faixa', null, zonaDaPerua(null));
checar('indefinida não há faixa', null, zonaDaPerua(undefined));
checar('NaN não há faixa', null, zonaDaPerua(Number.NaN));

bloco('2. Só a mudança vira escrita');

// Publicar a faixa de 20 crianças a cada 30s seriam 40 escritas por minuto
// dizendo 20 vezes a mesma coisa. Na mudança são 2 por criança por viagem.
checar('nada mudou, nada a escrever', [],
  zonasQueMudaram({ a: ZONA.LONGE }, { a: ZONA.LONGE }));
checar('mudou uma', [{ childId: 'a', zona: ZONA.PERTO }],
  zonasQueMudaram({ a: ZONA.LONGE }, { a: ZONA.PERTO }));
checar('a primeira medição conta como mudança',
  [{ childId: 'a', zona: ZONA.LONGE }], zonasQueMudaram({}, { a: ZONA.LONGE }));
checar('criança sem faixa não entra', [], zonasQueMudaram({}, { a: null }));
// A criança que sai da lista não gera escrita: apagar faixa de quem não está
// mais na rota seria escrever para dizer nada.
checar('sumir da lista não vira escrita', [],
  zonasQueMudaram({ a: ZONA.CHEGOU }, {}));

bloco('3. O mapa é referência — e o encaixe não é ruído');

const SP = { lat: -23.65432, lng: -46.71234 };
const encaixado = arredondarParaReferencia(SP);

// ⚠️ O CASO QUE PAGA O ARQUIVO: o MESMO ponto sempre dá o MESMO resultado.
// Com ruído aleatório, trinta envios do mesmo lugar dariam trinta valores
// diferentes — e a média deles é o ponto exato.
checar('o mesmo ponto dá sempre o mesmo resultado', encaixado,
  arredondarParaReferencia(SP));

// Dois pontos a poucos metros caem na mesma célula — é isso que impede a
// reconstrução do trajeto fino.
const vizinho = { lat: SP.lat + 0.0002, lng: SP.lng + 0.0002 };
checar('vizinho a ~25 m cai na mesma célula', encaixado,
  arredondarParaReferencia(vizinho));

// E o erro introduzido tem que caber na grade: se ele passar de 150 m, o
// aviso de "chegou" (400 m) começa a disparar na hora errada.
const erroM = haversineDistance(SP.lat, SP.lng, encaixado.lat, encaixado.lng) * 1000;
checar('o desvio cabe na grade', true, erroM <= PRECISAO_DO_MAPA_M);

// ⚠️ E A GRADE TEM QUE CABER DENTRO DO "CHEGOU". Este caso é o que impede
// alguém de "melhorar a privacidade" subindo a precisão para 500 m ou 2 km e
// quebrar o aviso sem perceber.
checar('a grade é menor que a faixa de chegada', true,
  PRECISAO_DO_MAPA_M / 1000 < ARRIVED_KM);

// Pontos realmente distantes continuam distintos — senão o mapa não serviria.
const longe = arredondarParaReferencia({ lat: -23.6, lng: -46.6 });
checar('pontos distantes continuam distintos', false,
  longe.lat === encaixado.lat && longe.lng === encaixado.lng);

checar('sem posição não inventa ponto', null, arredondarParaReferencia(null));
checar('coordenada inválida não vira ponto', null,
  arredondarParaReferencia({ lat: 'x', lng: 1 }));

bloco('4. Mapa desligado NÃO é sem sinal');

const agora = Date.now();
const semMapa = describeRoutePresence({
  liveLocation: { routeActive: true, semMapa: true, updatedAt: agora },
  now: agora,
});
checar('tem estado próprio', PRESENCE.SEM_MAPA, semMapa.kind);
// ⚠️ A FRASE NÃO PODE SUGERIR DEFEITO. "Sem sinal" faz a mãe ligar pro
// motorista pra avisar que o app quebrou — sobre uma escolha dele.
checar('não fala em sinal', false, /sinal/i.test(semMapa.title + semMapa.detail));
checar('e diz que o aviso continua', true, /chegando/i.test(semMapa.detail));
checar('não é tratado como posição velha', false, semMapa.isStale);
checar('e não inventa distância', null, semMapa.distanceKm);

// PERUA QUEBRADA (03/10/2026): estado próprio, e vence a posição e o mapa.
const quebrada = describeRoutePresence({
  liveLocation: {
    routeActive: true, semMapa: true, updatedAt: agora - 30 * 60 * 1000,
    ocorrencia: { tipo: 'perua_quebrou' },
  },
  now: agora,
});
checar('perua quebrada tem estado próprio', PRESENCE.OCORRENCIA, quebrada.kind);
checar('e não vira "sem sinal" nem distância', null, quebrada.distanceKm);
checar('rota encerrada não mostra ocorrência velha', PRESENCE.NO_ROUTE,
  describeRoutePresence({ liveLocation: { routeActive: false, ocorrencia: { tipo: 'perua_quebrou' } } }).kind);

// O outro lado: rota ativa, sem bandeira, posição velha = sem sinal mesmo.
const velho = describeRoutePresence({
  liveLocation: { routeActive: true, updatedAt: agora - 30 * 60 * 1000 },
  now: agora,
});
checar('posição velha continua sendo sem sinal', PRESENCE.STALE, velho.kind);
checar('e essa sim é marcada como velha', true, velho.isStale);

// Rota não começou vence tudo: sem rota não há mapa a desligar.
const parado = describeRoutePresence({
  liveLocation: { routeActive: false, semMapa: true, updatedAt: agora },
  now: agora,
});
checar('sem rota, o estado é "não começou"', PRESENCE.NO_ROUTE, parado.kind);

bloco('5. A posição exata não sai do aparelho');

// ⚠️ ARREDONDAR NA TELA NÃO ARREDONDA NADA: o documento continuaria com o
// número cru, e qualquer pessoa com o console do navegador o leria. O
// encaixe tem que acontecer ANTES da escrita — "segurança mora nas rules,
// não na interface", e aqui, na origem.
const fonteDoService = readFileSync(
  new URL('../src/services/locationService.js', import.meta.url), 'utf8');
const semProsa = fonteDoService
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

checar('o service encaixa antes de gravar', true,
  semProsa.includes('arredondarParaReferencia(exata)'));
// A crueza tem que sumir do PAYLOAD, não do arquivo: a variável local `exata`
// continua lendo `position.coords` — é dela que sai a medição do aviso, que
// roda no aparelho dele e não vai para lugar nenhum.
const payload = (semProsa.match(
  /await setDoc\(docDoMotorista\(uidDaSessao\(\)\), \{[\s\S]*?\n {4,8}\}(, \{ merge: true \})?\);/ // indentação varia: a gravação mora em `gravarPosicao` desde 03/10/2026
) || [''])[0];
checar('o teste achou o que é gravado', true, payload.length > 0);
// ⚠️ O MAPA DESLIGADO GRAVA `deleteField()`, e o SDK só aceita isso num `set`
// COM `merge` — sem ele, toda gravação da rota sem mapa era recusada (achado
// em 03/10/2026, sondado no emulador). O fim do `setDoc` precisa do merge.
const fimDoSetDoc = (semProsa.match(
  /await setDoc\(docDoMotorista\(uidDaSessao\(\)\), \{[\s\S]*?\n {4,8}\}(, \{ merge: true \})?\);/
) || [''])[0];
checar('a gravação da posição usa merge (o mapa desligado depende disso)',
  true, /\}, \{ merge: true \}\);$/.test(fimDoSetDoc));
checar('e o gravado não tem coordenada crua', false, /position\.coords/.test(payload));
// A precisão publicada é a da GRADE: dizer "5 m" ao lado de um ponto
// encaixado em 150 m é a interface mentindo com número.
checar('publica a precisão da grade', true,
  semProsa.includes('accuracy: PRECISAO_DO_MAPA_M'));
// Velocidade e direção saíram: ninguém lia, e velocidade instantânea de um
// trabalhador é vigilância do trabalho dele.
checar('não grava velocidade', false, /speed:/.test(semProsa));
checar('nem direção', false, /heading:/.test(semProsa));
// E a última posição é APAGADA ao encerrar — antes ficava a noite inteira.
checar('encerrar apaga a última posição', true,
  semProsa.includes('lat: deleteField()'));

// Sonda positiva: o detector reconheceria a escrita crua se ela voltasse.
checar('o detector reconhece a escrita crua (sonda positiva)', true,
  /lat:\s*position\.coords\.latitude/.test('  lat: position.coords.latitude,'));

bloco('6. O mapa diz que é referência');

// ⚠️ ALFINETE SOZINHO SOBRE DADO APROXIMADO É A INTERFACE MENTINDO: quem olha
// lê "ele está exatamente aqui", e é a leitura errada que faz a mãe descer
// com a criança na hora errada. O círculo desenha o tamanho da imprecisão; a
// frase diz o nome dela.
const fonteDoMapa = readFileSync(
  new URL('../src/components/map/LiveMap.jsx', import.meta.url), 'utf8');
const fonteDaTela = readFileSync(
  new URL('../src/pages/pai/PaiMap.jsx', import.meta.url), 'utf8');

checar('o mapa desenha o círculo', true, fonteDoMapa.includes('<Circle'));
// O raio vem da RÉGUA: número escrito à mão viraria um círculo que não
// corresponde ao arredondamento de verdade.
checar('e o raio vem da régua', true,
  fonteDoMapa.includes('radius={PRECISAO_DO_MAPA_M}'));
checar('sem raio escrito à mão', false, /radius=\{\d/.test(fonteDoMapa));
checar('a tela avisa que é referência', true,
  /aproximada, por referência/.test(fonteDaTela));
checar('e nega o ponto exato', true, /não indica o ponto exato/i.test(fonteDaTela));

bloco('7. E os termos dizem o mesmo que o código faz');

// A Política declara a base legal da geolocalização como CONSENTIMENTO, e a
// LGPD exige que consentimento seja revogável "por procedimento gratuito e
// facilitado" (art. 8º, §5º). A chave é essa revogação — até 11/09/2026 o
// documento prometia uma escolha que o app não oferecia.
const fonteLegal = readFileSync(
  new URL('../src/pages/legal/legalContent.js', import.meta.url), 'utf8');
checar('os termos falam da revogação', true,
  /revogável a qualquer momento/i.test(fonteLegal));
checar('e dizem que a posição é aproximada', true, /APROXIMADA/.test(fonteLegal));
checar('e que a última posição é apagada', true,
  /última posição é APAGADA/.test(fonteLegal));
checar('e que o app não pega a localização dos pais', true,
  /não coleta a localização do dispositivo dos responsáveis/i.test(fonteLegal));
// ⚠️ MUDAR A CLÁUSULA OBRIGA A SUBIR A VERSÃO — senão ninguém reaceita, e o
// aceite guardado aponta para um texto que não existe mais.
checar('a versão subiu junto', true, /LEGAL_VERSION = '1\.2'/.test(fonteLegal));

bloco('8. O mesmo ponto não é escrita de novo');

// ⚠️ A referência é encaixada em 150 m, então a perua parada (ou devagar no
// mesmo quadrado) gravava o MESMO ponto a cada 30 s do GPS e a cada minuto do
// pulso. Agora só o ponto novo, o mapa ligando/desligando e o pulso de vida
// de 2 minutos — que `closeStaleRoutes` precisa (90 min sem `updatedAt`).
{
  const T = 1_000_000;
  const ultima = { lat: -23.5, lng: -46.6, semMapa: false, em: T };
  const mesmo = { lat: -23.5, lng: -46.6, semMapa: false };
  checar('nada gravado ainda: grava', true,
    deveGravarPosicao({ ultima: null, atual: mesmo, agora: T }));
  checar('mesmo ponto 30 s depois: NÃO grava', false,
    deveGravarPosicao({ ultima, atual: mesmo, agora: T + 30000 }));
  checar('mesmo ponto 60 s depois (o pulso de 1 min): NÃO grava', false,
    deveGravarPosicao({ ultima, atual: mesmo, agora: T + 60000 }));
  checar('mesmo ponto 119 s depois: NÃO grava', false,
    deveGravarPosicao({ ultima, atual: mesmo, agora: T + 119999 }));
  checar('mesmo ponto 120 s depois: grava (pulso de vida)', true,
    deveGravarPosicao({ ultima, atual: mesmo, agora: T + PULSO_DE_VIDA_MS }));
  checar('o pulso de vida é 2 minutos', 120000, PULSO_DE_VIDA_MS);
  checar('e cabe com folga nos 90 minutos do closeStaleRoutes', true,
    PULSO_DE_VIDA_MS * 10 < 90 * 60 * 1000);
  checar('mudou de quadrado: grava na hora', true,
    deveGravarPosicao({ ultima, atual: { ...mesmo, lat: -23.5013 }, agora: T + 1000 }));
  checar('desligou o mapa: grava na hora', true,
    deveGravarPosicao({ ultima, atual: { lat: null, lng: null, semMapa: true }, agora: T + 1000 }));
  const semMapa = { lat: null, lng: null, semMapa: true, em: T };
  checar('mapa desligado e continua desligado: NÃO grava antes do pulso', false,
    deveGravarPosicao({ ultima: semMapa, atual: { lat: null, lng: null, semMapa: true }, agora: T + 60000 }));
  // Duas leituras do GPS a 20 m uma da outra caem no mesmo quadrado — é esse o
  // ganho real, e ele depende de a comparação ser feita DEPOIS do encaixe.
  const a = arredondarParaReferencia({ lat: -23.55052, lng: -46.63331 });
  const b = arredondarParaReferencia({ lat: -23.55060, lng: -46.63340 });
  checar('dois pontos a ~12 m caem na mesma referência', true, a.lat === b.lat && a.lng === b.lng);

  const prosa = (f) => f.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  const loc = prosa(fonteDoService);
  checar('o service pergunta antes de gravar a posição', true,
    loc.includes('deveGravarPosicao({ ultima: ultimaGravada, atual, agora: Date.now() })'));
  checar('a memória do gravado só anda depois do setDoc', true,
    loc.indexOf('ultimaGravada = { ...atual, em: Date.now() }') > loc.indexOf('await setDoc(docDoMotorista(uidDaSessao()), {'));
  checar('trocar o mapa no meio da rota grava na hora (forcar)', true,
    loc.includes('gravarPosicao(ultimaExata, motoristaDaRota, { forcar: true })'));
  checar('começar e encerrar a rota zeram a memória', 2,
    (loc.match(/^\s+ultimaGravada = null;/gm) || []).length);
}

bloco('9. A faixa mora em documento próprio, fora do dia');

// ⚠️ Em `rides/{dia}`, o gatilho do "está chegando" acordava a cada marco e a
// cada previsão só para sair na primeira linha.
{
  const rides = readFileSync(new URL('../src/services/ridesService.js', import.meta.url), 'utf8');
  const corpo = rides.slice(rides.indexOf('export async function publicarProximidade'));
  const fn = corpo.slice(0, corpo.indexOf('\n}') + 2);
  checar('a faixa vai para children/{id}/proximidade/atual', true,
    fn.includes("doc(db, 'children', childId, 'proximidade', 'atual')"));
  checar('e não toca mais no documento do dia', false, fn.includes('refDaViagem('));
  checar('leva o dia junto (é ele que separa ontem de hoje)', true, /\bdateKey,/.test(fn));
  checar('uma palavra, nunca distância', false, /km|distancia|distância/i.test(fn.replace(/\/\*[\s\S]*?\*\//g, '')));
  const gatilho = readFileSync(new URL('../functions/lib/avisosDaRota.js', import.meta.url), 'utf8');
  checar('o gatilho escuta o documento novo', true,
    gatilho.includes("document: 'children/{childId}/proximidade/{doc}'"));
  checar('e não escuta mais rides', false,
    gatilho.includes("document: 'children/{childId}/rides/{dia}'"));
  // Ninguém mais lê a faixa no documento do dia.
  checar('nenhuma tela lê ride.proximidade', false,
    /ride\??\.proximidade/.test(readFileSync(new URL('../src/pages/pai/PaiDashboard.jsx', import.meta.url), 'utf8')));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
