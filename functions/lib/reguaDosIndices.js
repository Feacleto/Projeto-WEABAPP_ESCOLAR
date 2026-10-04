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

const URL_DO_IPCA_12M =
  'https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2265/p/last%201';

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
 * Lê a resposta (já em JSON) do SIDRA e devolve o mês mais recente:
 * `{ mes: 'AAAA-MM', ipca12m: number }`, ou `null` se o formato não for o
 * esperado. Linha de dado quebrada no meio de linhas boas é ignorada; se
 * nenhuma sobrar, é `null`.
 */
function lerIpcaDoSidra(resposta) {
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

  let melhor = null;
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
    if (!melhor || mes > melhor.mes) melhor = { mes, ipca12m };
  }
  return melhor;
}

/**
 * Precisa gravar? Só quando o mês OU o número mudaram — o IBGE publica uma
 * vez por mês e a agendada roda todo dia; regravar o mesmo valor 30 vezes
 * acordaria 30 vezes cada tela que escuta o documento.
 */
function indiceMudou(gravado, novo) {
  if (!novo) return false;
  if (!gravado) return true;
  return gravado.mes !== novo.mes || gravado.ipca12m !== novo.ipca12m;
}

module.exports = {
  URL_DO_IPCA_12M,
  VARIAVEL_IPCA_12M,
  lerIpcaDoSidra,
  indiceMudou,
};
