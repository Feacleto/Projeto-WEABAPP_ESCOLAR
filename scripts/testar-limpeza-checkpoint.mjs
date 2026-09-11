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
 *   1. Qualquer marcação vai embora — coordenada, distância ou a hora órfã.
 *      A regra tinha dois caminhos e encolheu para um em 11/09/2026, quando o
 *      dono decidiu que o registro é "entregou, e a que horas", e nada sobre
 *      onde.
 *   2. `rides` é subcoleção e tem um checkpoint POR STATUS — o documento
 *      inteiro precisa ficar limpo, não um status só.
 *   3. Mapa que fica vazio some — mapa vazio é enigma, não registro.
 *   4. ⚠️ O MODO DE CONFERÊNCIA NÃO ESCREVE. Sem este caso, "vou dar uma
 *      olhada" e "apagar a base" são o mesmo comando, e ninguém descobre a
 *      diferença antes da hora.
 *   5. Rodar duas vezes não quebra nem conta de novo — a limpeza pode ser
 *      interrompida pela rede no meio da varredura.
 *   6. Os MARCOS não são tocados: a hora da entrega é o registro que fica.
 *
 * ⚠️ E SÃO DOIS CONSUMIDORES DA MESMA RÉGUA: o script (terminal, precisa de
 * chave de serviço) e a callable `limparCoordenadaDoCheckpoint` (botão do
 * painel, não precisa de chave nenhuma). O que este arquivo roda de ponta a
 * ponta é o SCRIPT — a callable é a mesma varredura com o mesmo
 * `planoDaViagem`, e o bloco final confere que ela não recriou a regra por
 * conta própria.
 *
 * COMO RODAR (precisa do emulador, e por isso fica fora da bateria)
 *   firebase emulators:exec --only firestore "node scripts/testar-limpeza-checkpoint.mjs"
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
// ⚠️ A RÉGUA É UMA SÓ, e é ela que este teste mede. O script de manutenção
// e a callable do dono consomem exatamente esta função — não há espelho a
// comparar, que é o ponto: entre os dois não existe fronteira de deploy.
const { decidir, planoDaViagem } = require(
  path.join(RAIZ, 'functions/lib/reguaDaLimpeza.js')
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

  // (c) já limpo: o script não pode inventar escrita onde não há marcação.
  await db.doc('children/ja-limpo').set({ name: 'Bia', lastStatusCheckpoint: {} });

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

// ⚠️ UM CAMINHO SÓ: existe marcação, ela vai embora. Antes a distância
// sobrevivia (era a conferência de "ele estava longe quando marcou?"), e o
// dono decidiu que ela sai junto — o registro é a hora, e nada de lugar.
checar('coordenada sai', 'apagar-inteiro', decidir({ lat: 1, lng: 2, at: 'x' }));
checar('distância sai junto', 'apagar-inteiro',
  decidir({ at: 'x', distanceKm: 0.5 }));
checar('e a hora órfã também', 'apagar-inteiro', decidir({ at: 'x' }));
// ⚠️ `distanceKm: 0` É VALOR VÁLIDO, e um `if (!cp.distanceKm)` o trataria
// como ausente — o caso perfeito (marcou na porta) escaparia da limpeza.
checar('distância zero também é registro', 'apagar-inteiro',
  decidir({ lat: 1, lng: 2, distanceKm: 0 }));

// Nada a apagar: sem objeto, ou objeto sem campo nenhum.
checar('ausente não vira escrita', 'nada', decidir(undefined));
checar('nulo não vira escrita', 'nada', decidir(null));
checar('vazio não vira escrita', 'nada', decidir({}));

bloco('O plano de uma viagem inteira');

// A viagem tem um checkpoint POR STATUS, e eles podem ter sortes diferentes
// no mesmo documento — é o caso que uma regra "por documento" erraria.
const misto = planoDaViagem({
  onboard: { lat: 1, lng: 2, at: 'a' },
  delivered: { lat: 3, lng: 4, at: 'b', distanceKm: 0.03 },
});
checar('os dois status saem', 2, misto.caminhos.length);
checar('e nenhum sobra pela metade', true,
  misto.caminhos.every((c) => !c.endsWith('.lat') && !c.endsWith('.lng')));
checar('o mapa inteiro some, porque nada sobreviveu', true, misto.apagarMapa);
checar('e a conta é toda de inteiros', '0/2', `${misto.tiradas}/${misto.inteiros}`);

const soPosicao = planoDaViagem({ onboard: { lat: 1, lng: 2, at: 'a' } });
checar('um status só também leva o mapa', true, soPosicao.apagarMapa);

const jaLimpoMapa = planoDaViagem({ delivered: {} });
checar('mapa sem registro não vira escrita', false, jaLimpoMapa.mexeu);
checar('mapa ausente não vira escrita', false, planoDaViagem(undefined).mexeu);

bloco('A regra tem uma cópia só');

// ⚠️ ESTE É O CASO QUE IMPEDE O QUARTO ESPELHO DO PROJETO. Script e callable
// varrem a mesma base com o mesmo privilégio; se um deles reescrever a regra
// por conta própria, as duas metades divergem em silêncio e a limpeza do
// painel passa a apagar coisa diferente da do terminal.
const fonteDaCallable = readFileSync(
  new URL('../functions/lib/limpezaDoCheckpoint.js', import.meta.url), 'utf8');
const fonteDoScript = readFileSync(
  new URL('../scripts/limpar-coordenada-do-checkpoint.cjs', import.meta.url), 'utf8');

for (const [nome, fonte] of [
  ['a callable', fonteDaCallable],
  ['o script', fonteDoScript],
]) {
  checar(`${nome} importa a régua`, true, fonte.includes('reguaDaLimpeza'));
  // `Object.keys(checkpoint).length` é a linha da decisão. Se ela reaparecer
  // aqui, alguém copiou a regra em vez de chamá-la.
  checar(`${nome} não reescreve a decisão`, false,
    fonte.includes('Object.keys(checkpoint).length'));
}
// Sonda positiva: o detector precisa reconhecer a linha quando ela existe —
// senão ele aprova qualquer coisa, inclusive uma régua vazia.
checar('o detector reconhece a decisão copiada (sonda positiva)', true,
  readFileSync(new URL('../functions/lib/reguaDaLimpeza.js', import.meta.url), 'utf8')
    .includes('Object.keys(checkpoint).length'));

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
checar('a marcação com distância some inteira', undefined, comDistancia);

const semDistancia = (await db.doc('children/sem-distancia').get()).get('lastStatusCheckpoint');
checar('a que só tinha posição também', undefined, semDistancia);

// ⚠️ E O RESTO DO DOCUMENTO FICA. A limpeza mira um campo, não a criança.
checar('a criança continua lá', 'Lucas',
  (await db.doc('children/com-distancia').get()).get('name'));

const jaLimpo = (await db.doc('children/ja-limpo').get()).get('lastStatusCheckpoint');
checar('o que não tinha registro não vira nada', undefined, jaLimpo?.distanceKm);

bloco('A viagem, que tem um checkpoint por status');

const viagem = (await db.doc('children/com-distancia/rides/2026-09-09').get()).data();
checar('o mapa de checkpoints some inteiro', undefined, viagem.checkpoints);
// ⚠️ Os MARCOS não são tocados: a hora da entrega é o registro que FICA — é
// o que o pai lê ("entregue às 12h40") e o que responde numa discussão.
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
