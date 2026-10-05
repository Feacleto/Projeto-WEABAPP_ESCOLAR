/**
 * A RÉGUA DO IPCA — lê a resposta da API SIDRA do IBGE (03/10/2026).
 *
 * POR QUE ESTE ARQUIVO NÃO FAZ `require` NENHUM
 * Ele é régua, e régua de `functions/lib/` não alcança `firebase-admin` nem
 * `firebase-functions` (ver CLAUDE.md, "A BATERIA JÁ RODOU PELA METADE").
 * Quem busca a API e grava é `indicesEconomicos.js`; aqui só se decide se o
 * que chegou é um número em que dá para confiar.
 *
 * O QUE SE PEDE AO IBGE
 * Tabela 1737 (IPCA), variável 2265 (variação acumulada em 12 meses), nível
 * Brasil, último período. O número serve de REFERÊNCIA na tela do motorista
 * ("a inflação dos últimos 12 meses foi X%") — informar, nunca sugerir
 * reajuste.
 *
 * O FORMATO REAL (sondado em 03/10/2026)
 * Um array em que a PRIMEIRA linha é o cabeçalho — as mesmas chaves, com o
 * rótulo de cada coluna como valor — e as seguintes são os dados:
 *
 *   [{ "V": "Valor", "D2C": "Variável (Código)", "D3C": "Mês (Código)", … },
 *    { "V": "4.22",  "D2C": "2265",              "D3C": "202608", … }]
 *
 * ⚠️ O MÊS ESTÁ EM `D3C`, NÃO EM `D2C`. A posição das dimensões depende da
 * ordem da consulta (`D2` aqui é a variável), então a régua acha a coluna
 * pelo RÓTULO do cabeçalho ("Mês (Código)") e só cai para `D3C` se o rótulo
 * não estiver lá. Fixar a chave seria gravar o código da variável (2265)
 * como se fosse um mês, sem erro nenhum.
 *
 * ⚠️ O VALOR É STRING, e o SIDRA usa símbolos no lugar do número quando não
 * há dado: "..." (não disponível), "-" (zero absoluto), "X" (sigilo).
 * `Number('-')` é NaN, mas `Number('')` é 0 — por isso a conferência é por
 * expressão regular, não por `isNaN`. Gravar 0% de inflação porque o campo
 * veio vazio é a régua mentindo com cara de dado.
 */

// Os 13 últimos meses (05/10/2026): o mais recente é o número da tela, e o
// de 12 meses antes dá a seta "Subiu/Desceu em 12 meses" da Economia do mês.
const URL_DO_IPCA_12M =
  'https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2265/p/last%2013';

const VARIAVEL_IPCA_12M = '2265';

/** Faixa de sanidade: fora dela, o mais provável é coluna trocada. */
const IPCA_MINIMO = -20;
const IPCA_MAXIMO = 100;

const NUMERO = /^-?\d+(\.\d+)?$/;
const MES_AAAAMM = /^(\d{4})(\d{2})$/;

/** A chave da coluna cujo rótulo no cabeçalho é `rotulo`, ou `padrao`. */
function colunaPeloRotulo(cabecalho, rotulo, padrao) {
  const achada = Object.keys(cabecalho).find(
    (k) => String(cabecalho[k]).trim() === rotulo
  );
  return achada || padrao;
}

/** '202608' → '2026-08' | null */
function mesDoCodigo(codigo) {
  const m = MES_AAAAMM.exec(String(codigo ?? '').trim());
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** '4.22' → 4.22 | null (recusa '...', '-', 'X', '' e afins) */
function valorDoTexto(texto) {
  const t = String(texto ?? '').trim();
  if (!NUMERO.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < IPCA_MINIMO || n > IPCA_MAXIMO) return null;
  return n;
}

/**
 * As linhas válidas da resposta do SIDRA, `[{ mes, ipca12m }]` em ordem de
 * mês, ou `null` se o formato não for o esperado.
 */
function linhasDoSidra(resposta) {
  if (!Array.isArray(resposta) || resposta.length < 2) return null;
  const cabecalho = resposta[0];
  if (!cabecalho || typeof cabecalho !== 'object') return null;

  const colValor = colunaPeloRotulo(cabecalho, 'Valor', 'V');
  const colMes = colunaPeloRotulo(cabecalho, 'Mês (Código)', 'D3C');
  const colVariavel = colunaPeloRotulo(cabecalho, 'Variável (Código)', 'D2C');

  // O cabeçalho precisa declarar as colunas que a régua vai ler: sem isso,
  // não há como saber se `D3C` é mesmo o mês.
  if (cabecalho[colValor] !== 'Valor' || cabecalho[colMes] !== 'Mês (Código)') {
    return null;
  }

  const porMes = new Map();
  for (const linha of resposta.slice(1)) {
    if (!linha || typeof linha !== 'object') continue;
    // Se a coluna da variável existe, ela tem que ser a do acumulado em 12
    // meses — a variação MENSAL (63) cabe na mesma faixa e passaria calada.
    if (colVariavel in linha && String(linha[colVariavel]).trim() !== VARIAVEL_IPCA_12M) {
      continue;
    }
    const mes = mesDoCodigo(linha[colMes]);
    const ipca12m = valorDoTexto(linha[colValor]);
    if (!mes || ipca12m === null) continue;
    porMes.set(mes, ipca12m);
  }
  return [...porMes.keys()].sort().map((mes) => ({ mes, ipca12m: porMes.get(mes) }));
}

/** '2026-08' → '2025-08' */
function mesUmAnoAntes(mes) {
  const [a, m] = mes.split('-');
  return `${Number(a) - 1}-${m}`;
}

/**
 * Lê a resposta (já em JSON) do SIDRA e devolve o mês mais recente:
 * `{ mes: 'AAAA-MM', ipca12m: number }`, ou `null` se o formato não for o
 * esperado. Linha de dado quebrada no meio de linhas boas é ignorada; se
 * nenhuma sobrar, é `null`.
 */
function lerIpcaDoSidra(resposta) {
  const linhas = linhasDoSidra(resposta);
  if (!linhas || linhas.length === 0) return null;
  return linhas[linhas.length - 1];
}

/**
 * O mais recente E o do mesmo mês um ano antes (05/10/2026, Economia do
 * mês): `{ mes, ipca12m, mesAntes, ipca12mAntes }`. Sem o mês de um ano
 * antes na resposta, `mesAntes` e `ipca12mAntes` são `null` — a tela mostra o
 * número sem a seta. ⚠️ Só o MESMO mês do ano anterior vale: o mais antigo
 * da resposta, se faltar um mês no meio, compararia 11 meses e diria 12.
 */
function lerSerieDoIpca(resposta) {
  const linhas = linhasDoSidra(resposta);
  if (!linhas || linhas.length === 0) return null;
  const atual = linhas[linhas.length - 1];
  const alvo = mesUmAnoAntes(atual.mes);
  const antes = linhas.find((l) => l.mes === alvo) || null;
  return {
    mes: atual.mes,
    ipca12m: atual.ipca12m,
    mesAntes: antes ? antes.mes : null,
    ipca12mAntes: antes ? antes.ipca12m : null,
  };
}

/**
 * Precisa gravar? Só quando o mês OU o número mudaram — o IBGE publica uma
 * vez por mês e a agendada roda todo dia; regravar o mesmo valor 30 vezes
 * acordaria 30 vezes cada tela que escuta o documento. O par de um ano antes
 * entra na conta: sem isso, o documento gravado antes de ele existir nunca
 * ganharia a seta até o IBGE publicar o mês seguinte.
 */
function indiceMudou(gravado, novo) {
  if (!novo) return false;
  if (!gravado) return true;
  return gravado.mes !== novo.mes
    || gravado.ipca12m !== novo.ipca12m
    || (gravado.mesAntes ?? null) !== (novo.mesAntes ?? null)
    || (gravado.ipca12mAntes ?? null) !== (novo.ipca12mAntes ?? null);
}

/* ═══════════════════════ AS SÉRIES DO BANCO CENTRAL ═══════════════════════
 *
 * SELIC META E DÓLAR PTAX (05/10/2026, tela "Economia do mês" do motorista).
 * As duas vêm do SGS do Banco Central, sem chave, no MESMO formato — por
 * isso uma régua só:
 *
 *   GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
 *       ?formato=json&dataInicial=dd/mm/aaaa&dataFinal=dd/mm/aaaa
 *   → [{ "data": "02/10/2026", "valor": "5.2238" }, …]
 *
 * Série 432 é a Selic META (% ao ano), 1 é o dólar PTAX de VENDA (R$). O
 * dólar foi lido no SGS e não na Olinda porque o formato é o mesmo da Selic:
 * uma régua, um teste, um jeito de falhar.
 *
 * ⚠️ O QUE A SONDAGEM MOSTROU (05/10/2026), e cada um virou caso de teste:
 *   - A DATA É dd/mm/aaaa. Ler como texto ordenável daria 30/09 > 02/10.
 *   - O VALOR É STRING COM PONTO ("13.75"). Vírgula não é o formato da API:
 *     se aparecer, o formato mudou, e "1.234,56" não tem leitura única —
 *     recusar é não gravar, que é o seguro.
 *   - A SELIC META VEM COM DATAS NO FUTURO: `ultimos/3` devolveu 02/11 a
 *     04/11 num 05/10 — a série é preenchida até a próxima reunião do Copom.
 *     Por isso a consulta é por PERÍODO terminando hoje, e a régua ignora
 *     qualquer data depois de hoje.
 *   - O DÓLAR SÓ TEM DIA ÚTIL, e período sem nenhum ponto responde HTTP 404
 *     ("Value(s) not found"). Quem chama trata o 404 como falha comum.
 *
 * "HOJE" É EM BRASÍLIA. As functions rodam em UTC; às 6h de Brasília já é o
 * mesmo dia nos dois, mas a régua não depende da coincidência do cron.
 */

const SERIES_DO_BC = {
  selic: { codigo: 432, minimo: 0, maximo: 100 },
  dolar: { codigo: 1, minimo: 1, maximo: 20 },
};

/** Dias consultados para trás: 12 meses mais folga para o feriado. */
const DIAS_DA_CONSULTA = 400;

/** Distância máxima entre "um ano antes" e o ponto achado para ele. */
const FOLGA_DO_ANO_ANTES_DIAS = 10;

const DATA_DO_BC = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 24 * 60 * 60 * 1000;

/** O dia de `agora` no fuso de Brasília, 'AAAA-MM-DD'. */
function diaEmBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const p = (tipo) => partes.find((x) => x.type === tipo)?.value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}

/** 'AAAA-MM-DD' → milissegundos UTC à meia-noite | null */
function msDoDia(iso) {
  const m = DATA_ISO.exec(String(iso ?? ''));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // 31/02 vira 03/03 no Date.UTC; a volta confere que o dia existia.
  if (d.getUTCDate() !== Number(m[3]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return ms;
}

/** milissegundos UTC → 'AAAA-MM-DD' */
function isoDoMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** '02/10/2026' → '2026-10-02' | null */
function dataDoBc(texto) {
  const m = DATA_DO_BC.exec(String(texto ?? '').trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return msDoDia(iso) === null ? null : iso;
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa', o formato que o SGS pede na URL. */
function dataParaOBc(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** A URL da série `codigo`, do dia `hoje` (Brasília) 400 dias para trás. */
function urlDaSerieDoBc(codigo, hoje) {
  const fim = msDoDia(hoje);
  if (fim === null) return null;
  const inicio = isoDoMs(fim - DIAS_DA_CONSULTA * DIA_MS);
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json`
    + `&dataInicial=${dataParaOBc(inicio)}&dataFinal=${dataParaOBc(hoje)}`;
}

/** O mesmo dia, um ano antes (29/02 vira 28/02). */
function umAnoAntes(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(a - 1, m, 0)).getUTCDate();
  return isoDoMs(Date.UTC(a - 1, m - 1, Math.min(d, ultimoDia)));
}

/**
 * Lê a série do SGS e devolve, para a tela:
 *   { data, valor, desde, dataAntes, valorAntes }
 * - `data`/`valor`: o ponto mais recente ATÉ HOJE (o futuro é ignorado);
 * - `desde`: o primeiro dia em que o valor atual passou a valer, quando a
 *   resposta mostra a mudança (a Selic "desde 17/09"); `null` se o valor é
 *   o mesmo desde o começo da consulta — afirmar uma data de início que a
 *   resposta não mostra seria inventar;
 * - `dataAntes`/`valorAntes`: o ponto mais recente até um ano antes de
 *   `data`, se estiver a até 10 dias disso; senão `null` (sem seta).
 * `null` inteiro quando o formato não é o esperado ou nenhum ponto sobra.
 */
function lerSerieDoBc(resposta, { minimo, maximo, hoje } = {}) {
  if (!Array.isArray(resposta)) return null;
  const limite = hoje ? msDoDia(hoje) : null;
  const pontos = new Map();
  for (const linha of resposta) {
    if (!linha || typeof linha !== 'object') continue;
    const data = dataDoBc(linha.data);
    const texto = String(linha.valor ?? '').trim();
    if (!data || !NUMERO.test(texto)) continue;
    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor < minimo || valor > maximo) continue;
    if (limite !== null && msDoDia(data) > limite) continue;
    pontos.set(data, valor);
  }
  const serie = [...pontos.keys()].sort().map((data) => ({ data, valor: pontos.get(data) }));
  if (serie.length === 0) return null;

  const atual = serie[serie.length - 1];

  let desde = null;
  for (let i = serie.length - 2; i >= 0; i -= 1) {
    if (serie[i].valor !== atual.valor) {
      desde = serie[i + 1].data;
      break;
    }
  }

  const alvo = umAnoAntes(atual.data);
  const msAlvo = msDoDia(alvo);
  let antes = null;
  for (const p of serie) {
    if (p.data <= alvo) antes = p;
    else break;
  }
  if (antes && msAlvo - msDoDia(antes.data) > FOLGA_DO_ANO_ANTES_DIAS * DIA_MS) antes = null;

  return {
    data: atual.data,
    valor: atual.valor,
    desde,
    dataAntes: antes ? antes.data : null,
    valorAntes: antes ? antes.valor : null,
  };
}

/**
 * Precisa gravar a série? A Selic é preenchida TODO DIA com o mesmo número,
 * então comparar a `data` regravaria o documento diariamente sem nada novo
 * para mostrar: para ela vale o valor, o `desde` e o valor de um ano antes
 * (`comData: false`). O dólar muda todo dia útil — ali a data é parte do dado.
 */
function serieMudou(gravado, novo, { comData = true } = {}) {
  if (!novo) return false;
  if (!gravado) return true;
  const campos = ['valor', 'desde', 'valorAntes'];
  if (comData) campos.push('data', 'dataAntes');
  return campos.some((c) => (gravado[c] ?? null) !== (novo[c] ?? null));
}

module.exports = {
  URL_DO_IPCA_12M,
  VARIAVEL_IPCA_12M,
  lerIpcaDoSidra,
  lerSerieDoIpca,
  indiceMudou,
  SERIES_DO_BC,
  diaEmBrasilia,
  urlDaSerieDoBc,
  lerSerieDoBc,
  serieMudou,
};
