/**
 * DE ONDE VÊM OS TILES — e por que isto é teste e não lembrete.
 *
 * ── O QUE ELE GUARDA
 * Os dois mapas do app pediam os quadradinhos direto ao servidor do **próprio
 * OpenStreetMap**, e a *Tile Usage Policy* deles destina aquela infraestrutura
 * doada a uso leve e não comercial. Rastreamento ao vivo — uma responsável
 * acompanhando a perua por vinte minutos — é exatamente o padrão que a
 * política exclui.
 *
 * ⚠️ E A FALHA É SILENCIOSA E COLETIVA: bloqueados, os tiles param de vir e o
 * mapa fica CINZA para todas as famílias ao mesmo tempo. Nada no app acusa —
 * `avisoDoMomento` avisa quando o app mente sobre a rota, não quando o mapa
 * não carrega. A descoberta viria por reclamação, dias depois.
 *
 * Este arquivo existe porque a URL do OSM é a coisa mais fácil do mundo de
 * voltar a escrever: ela é curta, não pede chave, e funciona na máquina de
 * quem testa. O bloco 2 recusa qualquer mapa que a escreva à mão.
 *
 * ── A ARMADILHA DO CAMINHO DE DESENVOLVIMENTO
 * Sem chave, `config/mapa.js` volta para o OSM de propósito: quem clona o
 * repositório vê mapa sem criar conta em nada. Isso é bom para desenvolver e
 * **é a própria violação** em produção — então o teste prova que os dois
 * caminhos existem E que a decisão está escrita, sem poder exigir a chave (que
 * não está no git).
 *
 * COMO RODAR
 *   node scripts/testar-mapa.mjs      (ou: npm run testar:mapa)
 */

import { readFileSync } from 'node:fs';
import { tilesPara, MAPA } from '../src/config/mapa.js';

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
function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/** Código sem os comentários que explicam a decisão. */
const semProsa = (txt) =>
  txt
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('#');
    })
    .join('\n');

const live = ler('src/components/map/LiveMap.jsx');
const picker = ler('src/components/map/MapPicker.jsx');
const exemplo = ler('.env.example');
const hosting = JSON.parse(ler('firebase.json'));

// ─────────────────────────────────────────────────────────────────────────
bloco('1. Os dois caminhos, e qual e o de producao');

const comChave = tilesPara('CHAVE_DE_TESTE');
const semChave = tilesPara('');

checar('com chave, o provedor e o MapTiler', 'maptiler', comChave.provedor);
checar('e a URL aponta pra api.maptiler.com', true,
  comChave.url.startsWith('https://api.maptiler.com/maps/'));
checar('carregando a chave do ambiente', true, comChave.url.endsWith('key=CHAVE_DE_TESTE'));

checar('sem chave, cai no OSM (o caminho de desenvolvimento)', 'osm', semChave.provedor);
// O sharding por subdominio foi aposentado pelo OSM: eles pedem o dominio
// direto. Estava no codigo porque veio de um trecho de exemplo antigo.
checar('e sem o {s} aposentado', false, semChave.url.includes('{s}'));

// Espaco em branco nao e chave. Um `.env` com `VITE_MAPTILER_KEY= ` produziria
// uma URL com `key=` vazio, que o MapTiler recusa — e ai o mapa fica cinza
// sem ninguem entender por que, que e pior que o fallback declarado.
checar('chave em branco conta como ausente', 'osm', tilesPara('   ').provedor);
checar('chave nula tambem', 'osm', tilesPara(null).provedor);
checar('e undefined tambem', 'osm', tilesPara(undefined).provedor);

// No Node `import.meta.env` nao existe. Se o `?.` sair, este arquivo deixa de
// ser importavel e o modulo de configuracao fica sem teste nenhum.
checar('o modulo e importavel fora do navegador', true, Boolean(MAPA && MAPA.url));

// ─────────────────────────────────────────────────────────────────────────
bloco('2. Nenhum mapa escreve o provedor a mao');

for (const [nome, fonte] of [['LiveMap', live], ['MapPicker', picker]]) {
  const codigo = semProsa(fonte);
  checar(`${nome} le o provedor de config/mapa`, true,
    codigo.includes("from '../../config/mapa'") && codigo.includes('MAPA.url'));
  checar(`${nome} usa a atribuicao de la`, true, codigo.includes('MAPA.attribution'));
  // ⚠️ ESTE E O CASO QUE MAIS VAI PEGAR ALGUEM: a URL do OSM e curta, nao pede
  // chave e funciona na maquina de quem testa. Voltar a escreve-la e a coisa
  // mais facil do mundo, e nada mais no sistema acusaria.
  checar(`${nome} NAO escreve tile.openstreetmap a mao`, false,
    codigo.includes('tile.openstreetmap.org'));
  checar(`${nome} nem api.maptiler a mao`, false, codigo.includes('api.maptiler.com'));
}

// A sonda positiva do descomentador: os dois arquivos CITAM o config em
// comentario, e o `LiveMap` cita a política em prosa.
checar('o descomentador descomenta', false,
  semProsa(live).includes('política de uso'));

// ─────────────────────────────────────────────────────────────────────────
bloco('3. A atribuicao e exigencia, nao cortesia');

// Camada gratuita do MapTiler exige o credito deles; o dado e do OSM nos dois
// casos, entao ele fica junto. Sem isso o uso e irregular mesmo pagando.
checar('o credito do MapTiler esta na atribuicao', true,
  comChave.attribution.includes('maptiler.com/copyright'));
checar('e o do OSM tambem', true,
  comChave.attribution.includes('openstreetmap.org/copyright'));
checar('no caminho do OSM, o credito dele esta la', true,
  semChave.attribution.includes('openstreetmap.org/copyright'));

// ─────────────────────────────────────────────────────────────────────────
bloco('4. O ambiente sabe da chave, e a CSP deixa o tile passar');

checar('.env.example declara VITE_MAPTILER_KEY', true,
  exemplo.includes('VITE_MAPTILER_KEY='));
// Chave de tile aparece no bundle em QUALQUER provedor — quem protege e a
// restricao por dominio no painel. O `.env.example` diz isso para ninguem
// "consertar" escondendo a chave num lugar que nao existe num app de
// navegador.
checar('e explica que ela e restrita por dominio, nao secreta', true,
  exemplo.toLowerCase().includes('restrinja a chave'));

const alvoApp = hosting.hosting.find((h) => h.target === 'app');
const csp = (alvoApp?.headers || [])
  .flatMap((r) => r.headers || [])
  .map((h) => h.value)
  .find((v) => v && v.includes('img-src')) || '';
const imgSrc = csp.split(';').map((x) => x.trim()).find((x) => x.startsWith('img-src')) || '';

console.log(`       ${imgSrc.slice(0, 96)}…`);
checar('a CSP libera api.maptiler.com', true, imgSrc.includes('https://api.maptiler.com'));
// O caminho de desenvolvimento tambem precisa passar, senao quem clona o
// repositorio ve mapa cinza e vai procurar o defeito no lugar errado.
checar('e o do OSM continua liberado (o fallback)', true,
  imgSrc.includes('tile.openstreetmap.org'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
