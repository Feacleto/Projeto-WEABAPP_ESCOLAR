/**
 * APAGA A COORDENADA DO MOTORISTA DOS CHECKPOINTS JÁ GRAVADOS.
 *
 * ── O QUE ISTO ESTÁ CONSERTANDO
 * `checkpointFrom` ([src/services/routeStatusService.js]) gravava `lat` e
 * `lng` do VEÍCULO do motorista em dois lugares, um registro por criança por
 * dia:
 *
 *   children/{id}.lastStatusCheckpoint      { lat, lng, at, distanceKm? }
 *   children/{id}/rides/{dia}.checkpoints   { delivered: {...}, atSchool: {...} }
 *
 * Nenhuma tela lia esses dois campos. O que a conferência usa é a DISTÂNCIA
 * até a casa ou a escola, que responde *"ele estava longe quando marcou
 * entregue?"* sem dizer onde ele estava. O código parou de escrever em
 * 10/09/2026; **o que já foi gravado continua lá**, e é isso que este script
 * remove.
 *
 * ⚠️ O CUSTO É TODO DO OUTRO LADO: `children` é lido pela RESPONSÁVEL. A
 * coordenada ali torna o trajeto do carro de um autônomo reconstruível por
 * terceiros — exatamente o que a página `/acompanhar` recusa fazer, com a
 * frase "ele não decidiu compartilhá-la com terceiros". Não é dado sobre a
 * criança: é dado sobre o trabalho DELE, e ele nunca escolheu compartilhar.
 *
 * ── POR QUE ELE PRECISA DO ADMIN SDK, E NÃO DO LOGIN DO DONO
 * `varrer-descontos.cjs` fala REST com o token do dono, e é o padrão desta
 * pasta. Aqui não dá, e a razão é boa: **as rules proíbem esta escrita a
 * todo mundo, inclusive ao dono** — ele lê `children` inteiro para contar a
 * base, mas "ler não é operar, escrita segue proibida pra ele", e `rides` ele
 * nem lê (só o motorista daquela criança e a responsável dela). Uma limpeza
 * que atravessa a base inteira não tem dono possível dentro das rules; ela é
 * privilegiada por definição.
 *
 * ── ELE NÃO APAGA NADA POR PADRÃO
 * Sem `--apagar` ele só CONTA e mostra uma amostra. O relatório é a decisão;
 * a escrita é um segundo comando, deliberado. Script destrutivo que age no
 * primeiro `node` é o que transforma "vou dar uma olhada" em incidente.
 *
 * ── AS DUAS REGRAS DE REMOÇÃO, e a segunda não é óbvia
 *   1. Checkpoint COM `distanceKm`  → apaga só `lat` e `lng`. A distância é a
 *      conferência, e ela fica.
 *   2. Checkpoint SEM `distanceKm`  → apaga o checkpoint INTEIRO. Ele nasceu
 *      quando não havia destino esperado (`onboard`), então não carrega nada
 *      além da posição: tirar `lat`/`lng` deixaria `{ at }` sozinho, um objeto
 *      que não responde a pergunta nenhuma e que a próxima pessoa teria que
 *      decifrar. Em `rides`, a hora já está em `marcos[status]` — o `at` órfão
 *      seria a segunda cópia dela.
 *
 * ── COMO USAR
 *   # conferir (não escreve nada)
 *   GOOGLE_APPLICATION_CREDENTIALS=chave.json node scripts/limpar-coordenada-do-checkpoint.cjs
 *
 *   # apagar de verdade
 *   GOOGLE_APPLICATION_CREDENTIALS=chave.json node scripts/limpar-coordenada-do-checkpoint.cjs --apagar
 *
 * A chave de serviço sai do console (Configurações → Contas de serviço →
 * Gerar nova chave). **Apague o arquivo depois de rodar** — ele abre o
 * projeto inteiro, sem rules.
 *
 * EMULADOR (é assim que ele é testado, e não precisa de chave):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node scripts/limpar-coordenada-do-checkpoint.cjs
 */

const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..');
const admin = require(path.join(
  RAIZ,
  'functions/node_modules/firebase-admin/lib/index.js'
));

const APAGAR = process.argv.includes('--apagar');
/** O Firestore recusa lotes acima de 500. 400 deixa folga pro que cresce. */
const LOTE = 400;

function projeto() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  const env = path.join(RAIZ, '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/VITE_FIREBASE_PROJECT_ID=(.+)/);
    if (m) return m[1].trim();
  }
  throw new Error('Não achei o projeto: defina GCLOUD_PROJECT ou VITE_FIREBASE_PROJECT_ID no .env');
}

/**
 * O que fazer com UM checkpoint. Pura de propósito — é a regra, e o teste
 * exercita ela direto, sem emulador.
 *
 * @returns 'nada' | 'tirar-coordenada' | 'apagar-inteiro'
 */
function decidir(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return 'nada';
  const temCoordenada =
    checkpoint.lat !== undefined || checkpoint.lng !== undefined;
  if (!temCoordenada) return 'nada';
  return checkpoint.distanceKm === undefined
    ? 'apagar-inteiro'
    : 'tirar-coordenada';
}

async function main() {
  const PID = projeto();
  const emulando = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (!emulando && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '\nFalta a credencial. Ou aponte o emulador (FIRESTORE_EMULATOR_HOST),\n' +
        'ou dê uma chave de serviço em GOOGLE_APPLICATION_CREDENTIALS.\n'
    );
    process.exit(1);
  }

  admin.initializeApp({ projectId: PID });
  const db = admin.firestore();
  const APAGA_CAMPO = admin.firestore.FieldValue.delete();

  console.log(`\nAlvo: ${emulando ? 'EMULADOR' : 'PRODUÇÃO'} (${PID})`);
  console.log(APAGAR ? 'Modo: APAGAR\n' : 'Modo: conferência — nada será escrito\n');

  const conta = {
    criancas: 0,
    criancasComCoordenada: 0,
    viagens: 0,
    viagensComCoordenada: 0,
    checkpointsInteiros: 0,
    coordenadasTiradas: 0,
  };
  const amostra = [];
  let lote = db.batch();
  let noLote = 0;

  const gravar = async (ref, patch) => {
    if (!APAGAR) return;
    lote.update(ref, patch);
    noLote += 1;
    if (noLote >= LOTE) {
      await lote.commit();
      lote = db.batch();
      noLote = 0;
    }
  };

  // ── children.lastStatusCheckpoint ─────────────────────────────────────
  const criancas = await db.collection('children').get();
  conta.criancas = criancas.size;
  for (const doc of criancas.docs) {
    const cp = doc.get('lastStatusCheckpoint');
    const decisao = decidir(cp);
    if (decisao === 'nada') continue;

    conta.criancasComCoordenada += 1;
    if (amostra.length < 5) {
      amostra.push(`children/${doc.id}.lastStatusCheckpoint → ${decisao}`);
    }

    if (decisao === 'apagar-inteiro') {
      conta.checkpointsInteiros += 1;
      await gravar(doc.ref, { lastStatusCheckpoint: APAGA_CAMPO });
    } else {
      conta.coordenadasTiradas += 1;
      await gravar(doc.ref, {
        'lastStatusCheckpoint.lat': APAGA_CAMPO,
        'lastStatusCheckpoint.lng': APAGA_CAMPO,
      });
    }
  }

  // ── rides/{dia}.checkpoints ───────────────────────────────────────────
  //
  // `collectionGroup` porque `rides` é subcoleção de cada criança: varrer
  // criança por criança seria uma consulta por documento, e a viagem existe
  // por DIA — a conta cresce com o calendário, não com a turma.
  const viagens = await db.collectionGroup('rides').get();
  conta.viagens = viagens.size;
  for (const doc of viagens.docs) {
    const mapa = doc.get('checkpoints');
    if (!mapa || typeof mapa !== 'object') continue;

    const patch = {};
    let sobrevive = 0;
    let mexeu = false;

    for (const [status, cp] of Object.entries(mapa)) {
      const decisao = decidir(cp);
      if (decisao === 'nada') {
        sobrevive += 1;
        continue;
      }
      mexeu = true;
      if (decisao === 'apagar-inteiro') {
        conta.checkpointsInteiros += 1;
        patch[`checkpoints.${status}`] = APAGA_CAMPO;
      } else {
        conta.coordenadasTiradas += 1;
        sobrevive += 1;
        patch[`checkpoints.${status}.lat`] = APAGA_CAMPO;
        patch[`checkpoints.${status}.lng`] = APAGA_CAMPO;
      }
    }

    if (!mexeu) continue;
    conta.viagensComCoordenada += 1;
    if (amostra.length < 10) {
      amostra.push(`${doc.ref.path}.checkpoints → ${Object.keys(patch).join(', ')}`);
    }

    // Nenhum status sobrou: some com o mapa em vez de deixar `{}`. Mapa
    // vazio é o mesmo enigma do `{ at }` solto, um nível acima.
    await gravar(doc.ref, sobrevive === 0 ? { checkpoints: APAGA_CAMPO } : patch);
  }

  if (APAGAR && noLote > 0) await lote.commit();

  console.log(`crianças varridas ............. ${conta.criancas}`);
  console.log(`  com coordenada gravada ...... ${conta.criancasComCoordenada}`);
  console.log(`viagens varridas .............. ${conta.viagens}`);
  console.log(`  com coordenada gravada ...... ${conta.viagensComCoordenada}`);
  console.log('');
  console.log(`coordenadas tiradas (distância fica) .. ${conta.coordenadasTiradas}`);
  console.log(`checkpoints apagados inteiros ......... ${conta.checkpointsInteiros}`);

  if (amostra.length) {
    console.log('\namostra:');
    amostra.forEach((l) => console.log(`   ${l}`));
  }

  const total = conta.coordenadasTiradas + conta.checkpointsInteiros;
  if (total === 0) {
    console.log('\nNada a apagar. A base não tem coordenada gravada.\n');
  } else if (!APAGAR) {
    console.log(`\n${total} registros seriam mexidos. Rode de novo com --apagar.\n`);
  } else {
    console.log(`\n${total} registros mexidos.\n`);
  }
}

module.exports = { decidir };

if (require.main === module) {
  main().catch((e) => {
    console.error('\n' + e.message + '\n');
    process.exit(1);
  });
}
