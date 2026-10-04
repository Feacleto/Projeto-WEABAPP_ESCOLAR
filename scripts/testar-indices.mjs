/**
 * O IPCA DO IBGE — a régua que lê a resposta do SIDRA.
 *
 * POR QUE ESTE TESTE
 * A agendada `atualizarIndicesEconomicos` grava um número que o motorista lê
 * como "a inflação oficial". O defeito caro não é a API cair — aí nada é
 * gravado e a tela cala —, é a resposta chegar num formato um pouco
 * diferente e a régua ler a coluna ERRADA sem erro: o código da variável
 * (2265) no lugar do mês, a variação mensal no lugar da acumulada, ou o
 * "..." de dado indisponível virando 0%.
 *
 * A amostra abaixo é a resposta REAL da API, sondada em 03/10/2026. Ela
 * mostrou que o mês mora em `D3C`, não em `D2C` — o que a SPEC supunha.
 *
 * COMO RODAR
 *   node scripts/testar-indices.mjs      (ou: npm run testar:indices)
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  URL_DO_IPCA_12M,
  lerIpcaDoSidra,
  indiceMudou,
} = require('../functions/lib/reguaDosIndices.js');

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
  console.log('');
  console.log(t);
}

/** GET https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2265/p/last%201 — 03/10/2026 */
const AMOSTRA_REAL = [
  {
    NC: 'Nível Territorial (Código)',
    NN: 'Nível Territorial',
    MC: 'Unidade de Medida (Código)',
    MN: 'Unidade de Medida',
    V: 'Valor',
    D1C: 'Brasil (Código)',
    D1N: 'Brasil',
    D2C: 'Variável (Código)',
    D2N: 'Variável',
    D3C: 'Mês (Código)',
    D3N: 'Mês',
  },
  {
    NC: '1',
    NN: 'Brasil',
    MC: '2',
    MN: '%',
    V: '4.22',
    D1C: '1',
    D1N: 'Brasil',
    D2C: '2265',
    D2N: 'IPCA - Variação acumulada em 12 meses',
    D3C: '202608',
    D3N: 'agosto 2026',
  },
];

const CAB = AMOSTRA_REAL[0];
const linha = (over) => ({ ...AMOSTRA_REAL[1], ...over });
const resp = (...linhas) => [CAB, ...linhas];
const copia = (x) => JSON.parse(JSON.stringify(x));

// ─────────────────────────────── a amostra real ─────────────────────────────

bloco('A resposta real do SIDRA');
checar('lê mês e valor da amostra real', { mes: '2026-08', ipca12m: 4.22 }, lerIpcaDoSidra(copia(AMOSTRA_REAL)));
checar('a URL pede a tabela 1737, variável 2265, Brasil, último período', true,
  URL_DO_IPCA_12M.includes('/t/1737/') && URL_DO_IPCA_12M.includes('/v/2265/')
  && URL_DO_IPCA_12M.includes('/n1/all/') && URL_DO_IPCA_12M.includes('/p/last%201'));
checar('o mês NÃO é lido de D2C (seria "2265")', false,
  lerIpcaDoSidra(copia(AMOSTRA_REAL)).mes.startsWith('2265'));

bloco('Mais de um mês: vale o mais recente');
checar('dois meses fora de ordem → o mais recente',
  { mes: '2026-08', ipca12m: 4.22 },
  lerIpcaDoSidra(resp(linha({ D3C: '202608', V: '4.22' }), linha({ D3C: '202607', V: '4.5' }))));
checar('virada de ano', { mes: '2027-01', ipca12m: 3.9 },
  lerIpcaDoSidra(resp(linha({ D3C: '202612', V: '4.1' }), linha({ D3C: '202701', V: '3.9' }))));
checar('valor negativo é IPCA de verdade (deflação)', { mes: '2026-08', ipca12m: -0.35 },
  lerIpcaDoSidra(resp(linha({ V: '-0.35' }))));
checar('valor inteiro', { mes: '2026-08', ipca12m: 5 },
  lerIpcaDoSidra(resp(linha({ V: '5' }))));

bloco('A coluna se acha pelo RÓTULO do cabeçalho');
{
  // Mesma resposta com as dimensões em outra ordem: o mês em D2C.
  const cab = { ...CAB, D2C: 'Mês (Código)', D2N: 'Mês', D3C: 'Variável (Código)', D3N: 'Variável' };
  const l = linha({ D2C: '202605', D3C: '2265' });
  checar('dimensões trocadas → ainda lê o mês certo', { mes: '2026-05', ipca12m: 4.22 },
    lerIpcaDoSidra([cab, l]));
}

// ─────────────────────────────── o que se recusa ────────────────────────────

bloco('Recusa formato quebrado');
checar('array vazio', null, lerIpcaDoSidra([]));
checar('só o cabeçalho', null, lerIpcaDoSidra([CAB]));
checar('null', null, lerIpcaDoSidra(null));
checar('objeto em vez de array', null, lerIpcaDoSidra({ V: '4.22' }));
checar('string (corpo de erro em texto)', null, lerIpcaDoSidra('Tabela inexistente'));
checar('cabeçalho sem rótulo de Valor', null,
  lerIpcaDoSidra([{ ...CAB, V: 'Outra coisa' }, linha({})]));
checar('cabeçalho sem rótulo de Mês', null,
  lerIpcaDoSidra([{ ...CAB, D3C: 'Trimestre (Código)' }, linha({})]));
checar('cabeçalho que não é objeto', null, lerIpcaDoSidra([null, linha({})]));

bloco('Recusa valor que não é número');
checar('"..." (não disponível)', null, lerIpcaDoSidra(resp(linha({ V: '...' }))));
checar('"-" (zero absoluto do SIDRA)', null, lerIpcaDoSidra(resp(linha({ V: '-' }))));
checar('"X" (sigilo)', null, lerIpcaDoSidra(resp(linha({ V: 'X' }))));
checar('vazio NÃO vira 0%', null, lerIpcaDoSidra(resp(linha({ V: '' }))));
checar('vírgula decimal não é o formato da API', null, lerIpcaDoSidra(resp(linha({ V: '4,22' }))));
checar('valor ausente', null, lerIpcaDoSidra(resp(linha({ V: undefined }))));
checar('absurdo (coluna trocada) → recusa', null, lerIpcaDoSidra(resp(linha({ V: '2265' }))));

bloco('Recusa mês inválido e variável errada');
checar('mês 13', null, lerIpcaDoSidra(resp(linha({ D3C: '202613' }))));
checar('mês sem formato AAAAMM', null, lerIpcaDoSidra(resp(linha({ D3C: '2026-08' }))));
checar('variação MENSAL (63) não passa por acumulada', null,
  lerIpcaDoSidra(resp(linha({ D2C: '63', V: '0.4' }))));
checar('linha ruim no meio de boas é pulada', { mes: '2026-07', ipca12m: 4.5 },
  lerIpcaDoSidra(resp(linha({ D3C: '202608', V: '...' }), linha({ D3C: '202607', V: '4.5' }))));

// ─────────────────────────────── só grava se mudou ──────────────────────────

bloco('Só grava se mudou');
const novo = { mes: '2026-08', ipca12m: 4.22 };
checar('sem documento → grava', true, indiceMudou(null, novo));
checar('igual → não grava', false, indiceMudou({ ...novo, fonte: 'IBGE' }, novo));
checar('mês novo → grava', true, indiceMudou({ mes: '2026-07', ipca12m: 4.22 }, novo));
checar('mesmo mês, número revisto → grava', true, indiceMudou({ mes: '2026-08', ipca12m: 4.2 }, novo));
checar('leitura recusada (null) → nunca grava', false, indiceMudou({ mes: '2026-07', ipca12m: 4 }, null));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
