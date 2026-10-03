/**
 * O KM DAS ROTAS — o que a perua rodou, somado no celular (03/10/2026).
 *
 * A régua (`src/dominio/rota/kmDaRota.js`) alimenta o consumo da perua no
 * Financeiro. Ela erra para dois lados, e os dois custam: somar ruído do GPS
 * parado (o consumo sai melhor do que é) e somar salto (sai pior). Este
 * script mede os dois com trajetos sintéticos de distância conhecida, e
 * confere por leitura de arquivo que nenhuma coordenada é gravada.
 *
 * Rode: npm run testar:km-da-rota
 */
import { readFileSync } from 'node:fs';
import {
  novoAcumulador,
  somarPosicao,
  horaDeGravar,
  zerarKm,
  KM_PARA_GRAVAR,
  PRECISAO_MAXIMA_M,
  PASSO_MINIMO_M,
  VELOCIDADE_MAXIMA_KMH,
} from '../src/dominio/rota/kmDaRota.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const perto = (a, b, tol) => Math.abs(a - b) <= tol;

// Um grau de latitude ≈ 111,19 km com o raio da haversine (6371 km).
const KM_POR_GRAU = (6371 * Math.PI) / 180;
const LAT0 = -23.65;
const LNG0 = -46.70;
const T0 = Date.parse('2026-10-05T06:30:00-03:00');

/** Anda para o norte `metros` a cada `seg` segundos, `n` vezes. */
function trajeto({ n, metros, seg, accuracy = 8, inicio = 0 }) {
  return Array.from({ length: n }, (_, i) => ({
    lat: LAT0 + ((inicio + i) * metros) / 1000 / KM_POR_GRAU,
    lng: LNG0,
    accuracy,
    timestamp: T0 + (inicio + i) * seg * 1000,
  }));
}
const somarTodas = (pos, ac = novoAcumulador()) => pos.reduce(somarPosicao, ac);

bloco('1 · AS CONSTANTES');
checar('precisão máxima 50 m', 50, PRECISAO_MAXIMA_M);
checar('passo mínimo 15 m', 15, PASSO_MINIMO_M);
checar('velocidade máxima 130 km/h', 130, VELOCIDADE_MAXIMA_KMH);
checar('grava a cada 5 km', 5, KM_PARA_GRAVAR);

bloco('2 · TRAJETO LIMPO SOMA O QUE RODOU');
{
  // 101 pontos, 50 m a cada 5 s (36 km/h): 5,0 km.
  const ac = somarTodas(trajeto({ n: 101, metros: 50, seg: 5 }));
  checar('5 km a 36 km/h: soma 5,0 km (±1 m)', true, perto(ac.km, 5, 0.001));
  checar('o primeiro ponto só ancora', 0, somarPosicao(novoAcumulador(), trajeto({ n: 1, metros: 0, seg: 1 })[0]).km);
  // 10 km a 108 km/h (30 m/s, ponto a cada 1 s): abaixo do teto, soma.
  const rapido = somarTodas(trajeto({ n: 334, metros: 30, seg: 1 }));
  checar('estrada a 108 km/h soma (abaixo de 130)', true, perto(rapido.km, 9.99, 0.001));
}

bloco('3 · PERUA PARADA NÃO SOMA');
{
  // 10 minutos parado, o GPS oscilando ±6 m a cada segundo.
  const pos = Array.from({ length: 600 }, (_, i) => ({
    lat: LAT0 + ((i % 2 ? 6 : -6) / 1000) / KM_POR_GRAU,
    lng: LNG0,
    accuracy: 10,
    timestamp: T0 + i * 1000,
  }));
  checar('600 oscilações de 12 m: zero km', 0, somarTodas(pos).km);
}

bloco('4 · DEVAGAR SOMA (o ponto de partida não anda com o passo pequeno)');
{
  // 2 m a cada segundo (7,2 km/h, trânsito parado-anda) por 1000 s: 2 km.
  const ac = somarTodas(trajeto({ n: 1001, metros: 2, seg: 1 }));
  checar('1000 passos de 2 m somam ~2 km (perde no máximo o último trecho)', true,
    ac.km > 1.98 && ac.km <= 2.0001);
}

bloco('5 · PRECISÃO RUIM É IGNORADA');
{
  const limpo = trajeto({ n: 21, metros: 50, seg: 5 });
  const comRuins = limpo.map((p, i) => (i % 3 === 1 ? { ...p, accuracy: 120, lat: p.lat + 0.01 } : p));
  const ac = somarTodas(comRuins);
  checar('pontos de 120 m de erro não entram (e não desviam a soma)', true, perto(ac.km, 1.0, 0.001));
  checar('precisão exatamente 50 m entra', true,
    somarTodas(trajeto({ n: 3, metros: 50, seg: 5, accuracy: 50 })).km > 0);
  checar('precisão 50,1 m não entra', 0, somarTodas(trajeto({ n: 3, metros: 50, seg: 5, accuracy: 50.1 })).km);
  checar('sem precisão não entra', 0,
    somarTodas(trajeto({ n: 3, metros: 50, seg: 5 }).map(({ accuracy, ...p }) => p)).km);
}

bloco('6 · SALTO DO GPS É IGNORADO');
{
  const pos = trajeto({ n: 21, metros: 50, seg: 5 });
  // O 10º ponto pula 3 km para o lado e volta: velocidade implícita ~2000 km/h.
  pos[10] = { ...pos[10], lng: LNG0 + 3 / KM_POR_GRAU };
  const ac = somarTodas(pos);
  // Perde-se só o trecho em volta do salto (os 50 m do ponto trocado não
  // chegam a existir), nada de 6 km a mais.
  checar('um salto de 3 km no meio não entra na soma', true, ac.km > 0.9 && ac.km <= 1.0001);
  const tunel = [
    ...trajeto({ n: 2, metros: 50, seg: 5 }),
    // túnel: 5 minutos sem sinal, reaparece 4 km adiante (48 km/h): vale.
    { lat: LAT0 + 4.05 / KM_POR_GRAU, lng: LNG0, accuracy: 10, timestamp: T0 + 5000 + 300000 },
  ];
  checar('sumiu 5 min e reapareceu 4 km adiante: soma (é plausível)', true,
    perto(somarTodas(tunel).km, 4.05, 0.001));
  const foraDeOrdem = [
    ...trajeto({ n: 3, metros: 50, seg: 5 }),
    { lat: LAT0 + 0.5 / KM_POR_GRAU, lng: LNG0, accuracy: 10, timestamp: T0 - 1000 },
  ];
  checar('posição com hora anterior não soma', true, perto(somarTodas(foraDeOrdem).km, 0.1, 0.0001));
}

bloco('7 · ENTRADA SUJA NÃO QUEBRA');
{
  const base = somarTodas(trajeto({ n: 3, metros: 50, seg: 5 }));
  for (const p of [null, undefined, {}, { lat: NaN, lng: 0, accuracy: 5, timestamp: T0 },
    { lat: 95, lng: 0, accuracy: 5, timestamp: T0 + 99999 }, { lat: 0, lng: 0, accuracy: -1, timestamp: T0 + 99999 },
    { lat: '1', lng: 0, accuracy: 5, timestamp: T0 + 99999 }]) {
    checar(`${JSON.stringify(p)} é ignorada`, base, somarPosicao(base, p));
  }
  checar('acumulador ausente começa do zero', 0, somarPosicao(undefined, trajeto({ n: 1, metros: 0, seg: 1 })[0]).km);
  const antes = novoAcumulador();
  somarPosicao(antes, trajeto({ n: 1, metros: 0, seg: 1 })[0]);
  checar('não altera o acumulador recebido', novoAcumulador(), antes);
}

bloco('8 · GRAVAR A CADA 5 KM, SEM PERDER O PONTO');
{
  const ac = somarTodas(trajeto({ n: 102, metros: 50, seg: 5 }));
  checar('5,05 km: hora de gravar', true, horaDeGravar(ac));
  checar('4,9 km: ainda não', false, horaDeGravar({ km: 4.9, ultima: null }));
  const z = zerarKm(ac);
  checar('zerar mantém o último ponto', ac.ultima, z.ultima);
  checar('zerar zera o km', 0, z.km);
  // O trecho depois de zerar começa de onde a perua está.
  const seguinte = somarTodas(trajeto({ n: 20, metros: 50, seg: 5, inicio: 102 }), z);
  checar('o trecho seguinte soma 1,0 km a partir do último ponto', true, perto(seguinte.km, 1.0, 0.001));
}

bloco('9 · NENHUMA COORDENADA É GRAVADA (leitura de arquivo)');
{
  const servico = ler('src/services/locationService.js');
  const config = ler('src/services/configFinanceiroService.js');
  const regua = ler('src/dominio/rota/kmDaRota.js');
  checar('a régua não importa Firebase', false, /firebase/.test(regua.replace(/\/\*[\s\S]*?\*\//g, '')));
  checar('somarKmDasRotas grava só kmDasRotas', true,
    /setDoc\(doc\(db, 'configFinanceiro', uid\), \{ kmDasRotas: increment\(valor\) \}/.test(config));
  checar('o serviço chama somarKmDasRotas com (uid, km), nunca com a posição', true,
    /somarKmDasRotas\(motoristaDaRota, km\)/.test(servico));
  checar('o km é somado ANTES do throttle de escrita', true,
    servico.indexOf('acumularKm(position);') > -1
      && servico.indexOf('acumularKm(position);') < servico.indexOf('if (now - lastWrite < THROTTLE_MS) return;'));
  checar('ao encerrar, o parcial é gravado', true,
    /export async function stopTracking\(\)[\s\S]*?gravarKmParcial\(\);/.test(servico));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
