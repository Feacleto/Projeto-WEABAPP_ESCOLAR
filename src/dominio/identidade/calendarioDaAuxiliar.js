import { nomeDaSubstituta, resumoDoMes, valorDoDia } from './faltaDaAuxiliar.js';

/**
 * O CALENDÁRIO DAS FALTAS DA AUXILIAR E DOS DIAS DA SUBSTITUTA — régua pura
 * (05/10/2026, pedido do dono: "temos o calendário das faltas das crianças
 * dentro da ficha de cada criança; também quero ter o calendário das faltas
 * das auxiliares e o calendário dos dias que usei auxiliar substituta").
 *
 * Um mês, duas leituras da MESMA lista de faltas (`faltasDaAuxiliar`):
 *   - pela AUXILIAR: os dias em que ela faltou, e quem cobriu cada um;
 *   - pela SUBSTITUTA: os dias em que ela cobriu, e no lugar de quem.
 *
 * ⚠️ OS TOTAIS SAEM DE `resumoDoMes`, NUNCA DE UMA CONTA NOVA. O "Controle de
 * {mês}" da mesma tela soma com ela; o calendário filtra as faltas (desta
 * auxiliar, ou desta substituta) e entrega o recorte à mesma função. Assim a
 * soma dos calendários de todas as auxiliares é, por construção, o número do
 * Controle — duas contas do mesmo mês que pudessem divergir seriam a tela
 * discutindo consigo mesma.
 *
 * ⚠️ ESCOPO DO TIO. Uma auxiliar pode trabalhar para dois motoristas; cada
 * um só vê a falta da perua DELE. A escuta já é presa a `motoristaUid` (e a
 * rule também), mas a régua filtra de novo: quem a chamar com uma lista
 * misturada não pode mostrar ao tio A a falta registrada pelo tio B.
 *
 * ⚠️ O DIA É A CHAVE GRAVADA, NUNCA UMA DATA RECONVERTIDA. A falta nasce com
 * `getDateKey()` (o dia local do aparelho dele, em Brasília). Converter
 * '2026-10-31' em `Date` e voltar faria o dia escorregar para 30 ou 1º em
 * outro fuso; aqui o mês é texto, e o dia da semana é contado em UTC, onde
 * meia-noite não muda de dia.
 *
 * Nada aqui desconta do pagamento dela: o calendário mostra o que foi
 * registrado, e o que fazer com isso é conversa entre os dois.
 */

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** '2026-10' → { ano, mes } ou `null`. */
function partesDoMes(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano, mes };
}

/** Quantos dias o mês tem, contado em UTC. */
function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** 0 = domingo. Em UTC: o dia da semana de uma DATA não depende do fuso. */
function diaDaSemana(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

const doTio = (motoristaUid) => (f) => !!f && !!motoristaUid && f.motoristaUid === motoristaUid;

/** O primeiro nome, para caber na linha do dia. */
function primeiroNome(nome, padrao) {
  return String(nome || '').trim().split(/\s+/)[0] || padrao;
}

/**
 * As semanas do mês, de domingo a sábado, com `null` nas pontas. Cada dia
 * marcado leva a sua `falta` e a `linha` pronta da tela.
 */
function montarSemanas(monthKey, porDia) {
  const p = partesDoMes(monthKey);
  if (!p) return [];
  const total = diasNoMes(p.ano, p.mes);
  const celulas = Array(diaDaSemana(p.ano, p.mes, 1)).fill(null);
  for (let dia = 1; dia <= total; dia++) {
    const dateKey = `${monthKey}-${String(dia).padStart(2, '0')}`;
    celulas.push({ dia, dateKey, marcado: porDia.has(dateKey), ...(porDia.get(dateKey) || {}) });
  }
  while (celulas.length % 7) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** '2026-10-12' → 'segunda, 12/10'. Contado em UTC, pelo mesmo motivo. */
export function quandoDoDia(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return '';
  return `${DIAS_DA_SEMANA[diaDaSemana(Number(m[1]), Number(m[2]), Number(m[3]))]}, ${m[3]}/${m[2]}`;
}

/**
 * O calendário de UMA auxiliar, num mês, na perua de UM tio.
 *
 * Devolve `{ monthKey, semanas, dias, totais }`:
 *   - `dias`: os dias marcados, em ordem, com `linha` ("Faltou · Substituta:
 *     Joana" ou "Faltou · sem substituta") e `valor` (ou `null`);
 *   - `totais`: `faltas`, `comSubstituta` e `gasto`, todos de `resumoDoMes`.
 */
export function calendarioDaAuxiliar(faltas, { motoristaUid, auxiliarUid, monthKey } = {}) {
  const delas = (Array.isArray(faltas) ? faltas : [])
    .filter(doTio(motoristaUid))
    .filter((f) => f.auxiliarUid === auxiliarUid);
  const r = resumoDoMes(delas, monthKey);
  const porDia = new Map();
  for (const f of delas) {
    if (!String(f.dateKey || '').startsWith(`${monthKey}-`) || porDia.has(f.dateKey)) continue;
    const sub = nomeDaSubstituta(f.substituta?.nome);
    porDia.set(f.dateKey, {
      linha: sub ? `Faltou · Substituta: ${primeiroNome(sub, 'substituta')}` : 'Faltou · sem substituta',
      valor: sub ? valorDoDia(f.substituta?.valor) : null,
    });
  }
  return montar(monthKey, porDia, {
    faltas: r.totalDeFaltas,
    comSubstituta: r.substituicoes.length,
    gasto: r.total,
  });
}

/**
 * O calendário de UMA substituta, num mês, na perua de UM tio: os dias em
 * que ela cobriu, com "Cobriu a falta de Cida" e o valor daquele dia.
 * `totais`: `dias` e `gasto`, de `resumoDoMes` sobre as faltas que ela cobriu.
 */
export function calendarioDaSubstituta(faltas, { motoristaUid, substitutaId, monthKey } = {}) {
  const cobertas = (Array.isArray(faltas) ? faltas : [])
    .filter(doTio(motoristaUid))
    .filter((f) => !!substitutaId && f.substituta?.id === substitutaId);
  const r = resumoDoMes(cobertas, monthKey);
  const porDia = new Map();
  for (const f of cobertas) {
    if (!String(f.dateKey || '').startsWith(`${monthKey}-`)) continue;
    const de = primeiroNome(f.nomeDaAuxiliar, 'auxiliar');
    const antes = porDia.get(f.dateKey);
    // Duas auxiliares faltando no mesmo dia e ela cobrindo uma: um dia, uma
    // linha. Cobrir as duas no mesmo dia vira "Cida e Rose".
    porDia.set(f.dateKey, {
      linha: antes ? `${antes.linha} e ${de}` : `Cobriu a falta de ${de}`,
      valor: Math.round(((antes?.valor || 0) + (valorDoDia(f.substituta?.valor) || 0)) * 100) / 100 || null,
    });
  }
  return montar(monthKey, porDia, {
    dias: porDia.size,
    gasto: r.total,
  });
}

function montar(monthKey, porDia, totais) {
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, x]) => ({ dateKey, quando: quandoDoDia(dateKey), ...x }));
  return { monthKey, semanas: montarSemanas(monthKey, porDia), dias, totais };
}
