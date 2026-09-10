/**
 * A LIMPEZA DA COORDENADA, MEDIDA CONTRA O FIRESTORE DE VERDADE.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `limpar-coordenada-do-checkpoint.cjs` **apaga dado de produção**, e é o
 * único script de manutenção do projeto que escreve. `varrer-descontos.cjs`,
 * o outro, é só leitura e não tem nem flag para escrever — o cabeçalho dele
 * diz por quê: um script que "conserta sozinho" o dado de alguém é a mesma
 * classe de erro que ele veio evitar.
 *
 * Este aqui precisa escrever, então a troca é outra: ele roda inteiro contra o
 * emulador antes de encostar em produção, com as três formas de checkpoint
 * semeadas à mão.
 *
 * O QUE ELE PROVA, e cada linha é um jeito de errar:
 *   1. Checkpoint COM distância perde só `lat`/`lng` — a conferência fica.
 *   2. Checkpoint SEM distância some inteiro — senão sobra `{ at }`, um objeto
 *      que não responde nada e que a próxima pessoa teria que decifrar.
 *   3. `rides` é subcoleção e tem um checkpoint POR STATUS: o de `delivered`
 *      pode ficar e o de `onboard` sumir, no mesmo documento.
 *   4. Mapa que fica vazio some — mapa vazio é o mesmo enigma, um nível acima.
 *   5. ⚠️ O MODO DE CONFERÊNCIA NÃO ESCREVE. Sem este caso, "vou dar uma
 *      olhada" e "apagar a base" são o mesmo comando, e ninguém descobre a
 *      diferença antes da hora.
 *   6. Rodar duas vezes não quebra nem conta de novo — a limpeza pode ser
 *      interrompida pela rede no meio da varredura.
 *
 * COMO RODAR (precisa do emulador, e por isso fica fora da bateria)
 *   firebase emulators:exec --only firestore "node scripts/testar-limpeza-checkpoint.mjs"
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PID = 'demo-limpeza';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
}
process.env.GCLOUD_PROJECT = PID;

const admin = require(
  path.join(RAIZ, 'functions/node_modules/firebase-admin/lib/index.js')
);
const { decidir } = require(
  path.join(RAIZ, 'scripts/limpar-coordenada-do-checkpoint.cjs')
);

admin.initializeApp({ projectId: PID });
const db = admin.firestore();

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

/** Roda o script de limpeza como PROCESSO, que é como ele será usado. */
function rodar(...args) {
  return execFileSync(
    process.execPath,
    [path.join(RAIZ, 'scripts/limpar-coordenada-do-checkpoint.cjs'), ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, GCLOUD_PROJECT: PID },
    }
  );
}

async function limparBase() {
  for (const doc of (await db.collection('children').get()).docs) {
    for (const r of (await doc.ref.collection('rides').get()).docs) {
      await r.ref.delete();
    }
    await doc.ref.delete();
  }
}

async function semear() {
  await limparBase();

  // (a) com distância: a coordenada sai, a conferência fica.
  await db.doc('children/com-distancia').set({
    name: 'Lucas',
    lastStatusCheckpoint: {
      lat: -23.65,
      lng: -46.71,
      at: '2026-09-09T12:00:00.000Z',
      distanceKm: 0.042,
    },
  });

  // (b) sem distância: era `onboard`, não havia destino esperado. Só posição.
  await db.doc('children/sem-distancia').set({
    name: 'Ana',
    lastStatusCheckpoint: {
      lat: -23.61,
      lng: -46.7,
      at: '2026-09-09T07:10:00.000Z',
    },
  });

  // (c) já limpo: o script não pode inventar escrita onde não há coordenada.
  await db.doc('children/ja-limpo').set({
    name: 'Bia',
    lastStatusCheckpoint: { at: '2026-09-09T12:00:00.000Z', distanceKm: 0.1 },
  });

  // (d) sem checkpoint nenhum.
  await db.doc('children/sem-nada').set({ name: 'Caio' });

  // (e) a viagem, com DOIS status de sortes diferentes no mesmo documento.
  await db.doc('children/com-distancia/rides/2026-09-09').set({
    dateKey: '2026-09-09',
    marcos: { onboard: 'x', delivered: 'y' },
    checkpoints: {
      onboard: { lat: -23.6, lng: -46.7, at: 'a' },
      delivered: { lat: -23.65, lng: -46.71, at: 'b', distanceKm: 0.03 },
    },
  });

  // (f) a viagem em que NADA sobrevive — o mapa inteiro tem que sumir.
  await db.doc('children/sem-distancia/rides/2026-09-09').set({
    dateKey: '2026-09-09',
    marcos: { onboard: 'x' },
    checkpoints: { onboard: { lat: -23.6, lng: -46.7, at: 'a' } },
  });
}

// ── a regra, sem banco nenhum ───────────────────────────────────────────────
bloco('A decisão sobre um checkpoint');

checar('com distância, tira só a coordenada', 'tirar-coordenada',
  decidir({ lat: 1, lng: 2, at: 'x', distanceKm: 0.5 }));
checar('sem distância, apaga inteiro', 'apagar-inteiro',
  decidir({ lat: 1, lng: 2, at: 'x' }));
checar('já limpo não vira escrita', 'nada',
  decidir({ at: 'x', distanceKm: 0.5 }));
checar('ausente não vira escrita', 'nada', decidir(undefined));
checar('nulo não vira escrita', 'nada', decidir(null));
// ⚠️ `distanceKm: 0` É DISTÂNCIA VÁLIDA — ele marcou entregue na porta. Um
// `if (!checkpoint.distanceKm)` apagaria justamente o checkpoint do caso
// perfeito, que é o mais comum de todos.
checar('distância zero é distância', 'tirar-coordenada',
  decidir({ lat: 1, lng: 2, distanceKm: 0 }));
// Só `lng` (gravação parcial): ainda é coordenada, ainda sai.
checar('coordenada pela metade também sai', 'apagar-inteiro',
  decidir({ lng: 2, at: 'x' }));

// ── contra o emulador ───────────────────────────────────────────────────────
bloco('O modo de conferência não escreve');

await semear();
const relatorio = rodar();
checar('ele conta as duas crianças com coordenada', true,
  /com coordenada gravada \.+ 2/.test(relatorio));
checar('e diz que nada foi escrito', true, /Rode de novo com --apagar/.test(relatorio));

const intacto = (await db.doc('children/com-distancia').get()).get('lastStatusCheckpoint');
checar('a coordenada continua lá depois da conferência', -23.65, intacto.lat);

bloco('O modo --apagar');

// Cinco: a criança com distância (coordenada sai), a criança sem distância
// (checkpoint some), os dois status da viagem (b) e o único da viagem (f).
const saida = rodar('--apagar');
checar('ele diz quantos mexeu', true, /5 registros mexidos/.test(saida));

const comDistancia = (await db.doc('children/com-distancia').get()).get('lastStatusCheckpoint');
checar('a coordenada sai', undefined, comDistancia.lat);
checar('e a longitude também', undefined, comDistancia.lng);
checar('a distância FICA — é a conferência', 0.042, comDistancia.distanceKm);
checar('e a hora fica junto dela', '2026-09-09T12:00:00.000Z', comDistancia.at);

const semDistancia = (await db.doc('children/sem-distancia').get()).get('lastStatusCheckpoint');
checar('checkpoint que só tinha posição some inteiro', undefined, semDistancia);

const jaLimpo = (await db.doc('children/ja-limpo').get()).get('lastStatusCheckpoint');
checar('o que já estava limpo não é tocado', 0.1, jaLimpo.distanceKm);

bloco('A viagem, que tem um checkpoint por status');

const viagem = (await db.doc('children/com-distancia/rides/2026-09-09').get()).data();
checar('o status sem distância some', undefined, viagem.checkpoints.onboard);
checar('o status com distância fica', 0.03, viagem.checkpoints.delivered.distanceKm);
checar('sem a coordenada dele', undefined, viagem.checkpoints.delivered.lat);
// ⚠️ Os MARCOS não são tocados: a hora da entrega é o registro que vale como
// prova, e ela nunca foi o problema.
checar('os marcos continuam inteiros', { onboard: 'x', delivered: 'y' }, viagem.marcos);

const viagemVazia = (await db.doc('children/sem-distancia/rides/2026-09-09').get()).data();
checar('mapa que ficaria vazio some', undefined, viagemVazia.checkpoints);
checar('mas a viagem continua existindo', '2026-09-09', viagemVazia.dateKey);

bloco('Rodar de novo é seguro');

// A varredura pode cair no meio (rede, cota, Ctrl+C). Se a segunda passada
// contasse de novo, ninguém saberia dizer se a primeira terminou.
const segunda = rodar();
checar('a segunda passada não acha mais nada', true,
  /Nada a apagar/.test(segunda));

await limparBase();

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
