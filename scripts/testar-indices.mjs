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
 * Desde 05/10/2026 a mesma régua lê também a Selic meta e o dólar PTAX do
 * Banco Central (SGS), para a "Economia do mês" do motorista — recortes
 * reais sondados nesse dia, mais o que a sondagem mostrou: data dd/mm/aaaa,
 * a Selic META com datas no FUTURO e o dólar só em dia útil.
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
  lerSerieDoIpca,
  indiceMudou,
  SERIES_DO_BC,
  diaEmBrasilia,
  urlDaSerieDoBc,
  lerSerieDoBc,
  serieMudou,
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
checar('a URL pede a tabela 1737, variável 2265, Brasil, últimos períodos', true,
  URL_DO_IPCA_12M.includes('/t/1737/') && URL_DO_IPCA_12M.includes('/v/2265/')
  && URL_DO_IPCA_12M.includes('/n1/all/') && URL_DO_IPCA_12M.includes('/p/last%20'));
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

// ───────────────────── o IPCA de um ano antes (a seta) ──────────────────────

bloco('O IPCA de 12 meses antes (Economia do mês, 05/10/2026)');
{
  /** GET …/p/last%2013 — 05/10/2026: 13 meses, de 202508 a 202608. */
  const valores = {
    202508: '5.13', 202509: '5.17', 202510: '4.68', 202511: '4.46', 202512: '4.26',
    202601: '4.44', 202602: '3.81', 202603: '4.14', 202604: '4.39', 202605: '4.72',
    202606: '4.64', 202607: '4.44', 202608: '4.22',
  };
  const treze = resp(...Object.entries(valores).map(([m, v]) => linha({ D3C: m, V: v })));
  checar('a URL pede os 13 últimos meses', true, URL_DO_IPCA_12M.endsWith('/p/last%2013'));
  checar('13 meses reais → o atual e o mesmo mês um ano antes',
    { mes: '2026-08', ipca12m: 4.22, mesAntes: '2025-08', ipca12mAntes: 5.13 },
    lerSerieDoIpca(copia(treze)));
  checar('lerIpcaDoSidra continua devolvendo só o mais recente',
    { mes: '2026-08', ipca12m: 4.22 }, lerIpcaDoSidra(copia(treze)));
  checar('só um mês → sem o de um ano antes (sem seta)',
    { mes: '2026-08', ipca12m: 4.22, mesAntes: null, ipca12mAntes: null },
    lerSerieDoIpca(copia(AMOSTRA_REAL)));
  checar('faltando o mês de um ano antes, NÃO usa o mais antigo (seriam 11 meses)',
    { mes: '2026-08', ipca12m: 4.22, mesAntes: null, ipca12mAntes: null },
    lerSerieDoIpca(resp(linha({ D3C: '202509', V: '5.17' }), linha({ D3C: '202608', V: '4.22' }))));
  checar('formato quebrado → null', null, lerSerieDoIpca([CAB]));
  const comAntes = { mes: '2026-08', ipca12m: 4.22, mesAntes: '2025-08', ipca12mAntes: 5.13 };
  checar('documento antigo sem o par de um ano antes → grava (ganha a seta)', true,
    indiceMudou({ mes: '2026-08', ipca12m: 4.22 }, comAntes));
  checar('documento com o par igual → não grava', false, indiceMudou({ ...comAntes }, comAntes));
}

// ─────────────────────── as séries do Banco Central ─────────────────────────

/**
 * Recortes REAIS do SGS, sondados em 05/10/2026 (a consulta inteira tem 401
 * pontos da Selic e 275 do dólar; aqui ficam os dias em volta de hoje e de
 * um ano antes, que são os que a régua lê).
 */
const SELIC_REAL = [{"data":"30/09/2025","valor":"15.00"},{"data":"01/10/2025","valor":"15.00"},{"data":"02/10/2025","valor":"15.00"},{"data":"03/10/2025","valor":"15.00"},{"data":"04/10/2025","valor":"15.00"},{"data":"05/10/2025","valor":"15.00"},{"data":"06/10/2025","valor":"15.00"},{"data":"07/10/2025","valor":"15.00"},{"data":"08/10/2025","valor":"15.00"},{"data":"14/09/2026","valor":"14.00"},{"data":"15/09/2026","valor":"14.00"},{"data":"16/09/2026","valor":"14.00"},{"data":"17/09/2026","valor":"13.75"},{"data":"18/09/2026","valor":"13.75"},{"data":"19/09/2026","valor":"13.75"},{"data":"20/09/2026","valor":"13.75"},{"data":"21/09/2026","valor":"13.75"},{"data":"22/09/2026","valor":"13.75"},{"data":"23/09/2026","valor":"13.75"},{"data":"24/09/2026","valor":"13.75"},{"data":"25/09/2026","valor":"13.75"},{"data":"26/09/2026","valor":"13.75"},{"data":"27/09/2026","valor":"13.75"},{"data":"28/09/2026","valor":"13.75"},{"data":"29/09/2026","valor":"13.75"},{"data":"30/09/2026","valor":"13.75"},{"data":"01/10/2026","valor":"13.75"},{"data":"02/10/2026","valor":"13.75"},{"data":"03/10/2026","valor":"13.75"},{"data":"04/10/2026","valor":"13.75"},{"data":"05/10/2026","valor":"13.75"}];
const DOLAR_REAL = [{"data":"29/09/2025","valor":"5.3229"},{"data":"30/09/2025","valor":"5.3186"},{"data":"01/10/2025","valor":"5.3208"},{"data":"02/10/2025","valor":"5.3449"},{"data":"03/10/2025","valor":"5.3498"},{"data":"06/10/2025","valor":"5.3226"},{"data":"07/10/2025","valor":"5.3363"},{"data":"28/09/2026","valor":"5.2132"},{"data":"29/09/2026","valor":"5.2204"},{"data":"30/09/2026","valor":"5.1809"},{"data":"01/10/2026","valor":"5.2079"},{"data":"02/10/2026","valor":"5.2238"}];
/** `ultimos/3` da série 432 num 05/10/2026: a Selic META vem com o futuro. */
const SELIC_FUTURO_REAL = [{"data":"02/11/2026","valor":"13.75"},{"data":"03/11/2026","valor":"13.75"},{"data":"04/11/2026","valor":"13.75"}];

const SELIC = { ...SERIES_DO_BC.selic, hoje: '2026-10-05' };
const DOLAR = { ...SERIES_DO_BC.dolar, hoje: '2026-10-05' };

bloco('Banco Central: as URLs');
checar('Selic é a série 432 e dólar PTAX venda a 1', [432, 1],
  [SERIES_DO_BC.selic.codigo, SERIES_DO_BC.dolar.codigo]);
checar('a URL pede o período em dd/mm/aaaa, terminando hoje',
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=31/08/2025&dataFinal=05/10/2026',
  urlDaSerieDoBc(432, '2026-10-05'));
checar('data inválida → sem URL', null, urlDaSerieDoBc(432, '2026-02-31'));
checar('"hoje" é em Brasília: 02h UTC de 05/10 ainda é 04/10', '2026-10-04',
  diaEmBrasilia(new Date('2026-10-05T02:00:00Z')));
checar('às 9h UTC já é o mesmo dia', '2026-10-05', diaEmBrasilia(new Date('2026-10-05T09:00:00Z')));

bloco('Banco Central: as respostas reais');
checar('Selic real: 13,75 desde 17/09, 15,00 um ano antes',
  { data: '2026-10-05', valor: 13.75, desde: '2026-09-17', dataAntes: '2025-10-05', valorAntes: 15 },
  lerSerieDoBc(copia(SELIC_REAL), SELIC));
checar('dólar real: o último dia útil (02/10) e o de um ano antes',
  { data: '2026-10-02', valor: 5.2238, desde: '2026-10-02', dataAntes: '2025-10-02', valorAntes: 5.3449 },
  lerSerieDoBc(copia(DOLAR_REAL), DOLAR));
checar('a Selic do FUTURO é ignorada (resposta real de `ultimos/3`)', null,
  lerSerieDoBc(copia(SELIC_FUTURO_REAL), SELIC));
checar('futuro misturado com o passado → vale o de hoje', '2026-10-05',
  lerSerieDoBc([...copia(SELIC_REAL), ...copia(SELIC_FUTURO_REAL)], SELIC).data);
checar('em ordem trocada, a data é lida como data (30/09 < 02/10)', '2026-10-02',
  lerSerieDoBc(copia(DOLAR_REAL).reverse(), DOLAR).data);

bloco('Banco Central: o ano antes e o "desde"');
checar('ano antes no fim de semana → o dia útil anterior, se perto',
  { dataAntes: '2025-10-03', valorAntes: 5.3498 },
  (({ dataAntes, valorAntes }) => ({ dataAntes, valorAntes }))(
    lerSerieDoBc([{ data: '03/10/2025', valor: '5.3498' }, { data: '05/10/2026', valor: '5.2' }], DOLAR)));
checar('ano antes longe demais (mais de 10 dias) → sem seta', null,
  lerSerieDoBc([{ data: '01/09/2025', valor: '5.4' }, { data: '05/10/2026', valor: '5.2' }], DOLAR).valorAntes);
checar('sem nada de um ano antes → sem seta', null,
  lerSerieDoBc(copia(SELIC_REAL).slice(-5), SELIC).valorAntes);
checar('valor igual o período inteiro → "desde" null (não inventa início)', null,
  lerSerieDoBc(copia(SELIC_REAL).slice(-5), SELIC).desde);
checar('29/02 um ano antes vira 28/02', '2027-02-28',
  lerSerieDoBc([{ data: '28/02/2027', valor: '13' }, { data: '29/02/2028', valor: '12' }],
    { ...SERIES_DO_BC.selic, hoje: '2028-03-01' }).dataAntes);

bloco('Banco Central: o que se recusa');
checar('corpo de erro 404 real ({ erro }) → null', null,
  lerSerieDoBc({ erro: { statusCode: 404, detail: 'Value(s) not found' } }, DOLAR));
checar('array vazio → null', null, lerSerieDoBc([], DOLAR));
checar('vírgula decimal não é o formato da API', null,
  lerSerieDoBc([{ data: '02/10/2026', valor: '5,2238' }], DOLAR));
checar('valor vazio NÃO vira zero', null, lerSerieDoBc([{ data: '02/10/2026', valor: '' }], SELIC));
checar('data em AAAA-MM-DD (outro formato) → recusa', null,
  lerSerieDoBc([{ data: '2026-10-02', valor: '5.2' }], DOLAR));
checar('data impossível (31/02) → recusa', null, lerSerieDoBc([{ data: '31/02/2026', valor: '5.2' }], DOLAR));
checar('dólar fora da faixa (coluna trocada) → recusa', null,
  lerSerieDoBc([{ data: '02/10/2026', valor: '432' }], DOLAR));
checar('Selic negativa → recusa', null, lerSerieDoBc([{ data: '02/10/2026', valor: '-1' }], SELIC));
checar('linha ruim no meio de boas é pulada', 5.2079,
  lerSerieDoBc([{ data: '01/10/2026', valor: '5.2079' }, { data: '02/10/2026', valor: 'x' }], DOLAR).valor);

bloco('Banco Central: só grava se mudou');
const selicHoje = lerSerieDoBc(copia(SELIC_REAL), SELIC);
const selicOntem = lerSerieDoBc(copia(SELIC_REAL).slice(0, -1), { ...SELIC, hoje: '2026-10-04' });
checar('Selic: só a data andou → NÃO grava (seria todo dia)', false,
  serieMudou(selicOntem, selicHoje, { comData: false }));
checar('Selic: valor novo → grava', true,
  serieMudou(selicOntem, { ...selicHoje, valor: 13.5, desde: '2026-10-05' }, { comData: false }));
checar('dólar: dia novo → grava', true,
  serieMudou({ ...lerSerieDoBc(copia(DOLAR_REAL), DOLAR), data: '2026-10-01' }, lerSerieDoBc(copia(DOLAR_REAL), DOLAR)));
checar('dólar: igual → não grava', false,
  serieMudou(lerSerieDoBc(copia(DOLAR_REAL), DOLAR), lerSerieDoBc(copia(DOLAR_REAL), DOLAR)));
checar('sem documento → grava', true, serieMudou(null, selicHoje));
checar('leitura recusada → nunca grava', false, serieMudou(selicHoje, null));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
