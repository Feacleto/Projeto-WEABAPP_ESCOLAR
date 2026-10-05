/**
 * O RETRATO DA BASE NO SERVIDOR — espelho de `src/dominio/associacao/retratoDaBase.js`.
 *
 * ── POR QUE UM ESPELHO
 * A foto diária da base (`fotosDaBase/{AAAA-MM-DD}`) é gravada por uma
 * AGENDADA, e o deploy das functions não alcança `src/`. A conta é a mesma que
 * o painel do dono mostra ao vivo no Hoje: se as duas divergirem, o gráfico de
 * evolução contradiz o número de hoje logo acima dele. Duplicar aritmética só é
 * aceitável com teste que compara os dois caso a caso — `testar:retrato`.
 *
 * ── RÉGUA PURA
 * Sem `firebase-admin` nem `firebase-functions` (ver `testar:imports`): o
 * preço vem de `reguaDoServidor.js`, que também é régua pura.
 *
 * ⚠️ "PAGARIA" CONTINUA SENDO POTENCIAL, NUNCA RECEITA — o mesmo cabeçalho do
 * lado do app vale aqui.
 */

const {
  FUNDADOR,
  PLANO,
  centavos,
  paraData,
  planoValido,
  precoDaTabela,
  precoDoMes,
} = require('./reguaDoServidor');

const DIAS_DE_USO = 7;
const DIA_MS = 24 * 60 * 60 * 1000;
const FUSO = 'America/Sao_Paulo';

function jaRodou(parceiro) {
  return !!(paraData(parceiro?.ultimaRota) || parceiro?.trialInicio);
}

function rodouNosUltimos(parceiro, agora, dias = DIAS_DE_USO) {
  const ultima = paraData(parceiro?.ultimaRota);
  const hoje = paraData(agora);
  if (!ultima || !hoje) return false;
  const passou = hoje.getTime() - ultima.getTime();
  return passou >= 0 && passou < dias * DIA_MS;
}

function planoDoAssinante(parceiro) {
  if (parceiro?.condicaoFundador === FUNDADOR.VITALICIO) return 'vitalicio';
  if (planoValido(parceiro?.plano)) return parceiro.plano;
  return 'teste';
}

function pagariaPorMes(parceiro, mes) {
  if (!jaRodou(parceiro)) return null;
  if (parceiro?.condicaoFundador === FUNDADOR.VITALICIO) return 0;
  if (planoValido(parceiro?.plano)) {
    const conta = precoDoMes({
      criancas: Number(parceiro?.criancasAtivas) || 0,
      plano: parceiro.plano,
      fundador: parceiro?.condicaoFundador || null,
      indicacoesAtivas: Number(parceiro?.indicacoesAtivas) || 0,
      descontos: parceiro?.descontos,
      mes,
    });
    return conta && conta.liquido !== null ? conta.liquido : null;
  }
  return precoDaTabela(Number(parceiro?.criancasAtivas) || 0, PLANO.MENSAL);
}

function retratoDaBase({
  parceiros = [],
  agora = new Date(),
  mes = null,
  criancasAtivas = null,
  criancasComFamilia = null,
  baixasNoMes = null,
} = {}) {
  const lista = Array.isArray(parceiros) ? parceiros : [];

  let rodaram = 0;
  let rodaramNaSemana = 0;
  let pagaria = 0;
  const planos = { vitalicio: 0, mensal: 0, anual: 0, teste: 0 };

  lista.forEach((p) => {
    if (jaRodou(p)) rodaram += 1;
    if (rodouNosUltimos(p, agora)) rodaramNaSemana += 1;
    planos[planoDoAssinante(p)] += 1;
    if (p.suspenso !== true) {
      const v = pagariaPorMes(p, mes);
      if (v !== null) pagaria += v;
    }
  });

  return {
    motoristas: lista.length,
    rodaram,
    rodaramNaSemana,
    nuncaRodaram: lista.length - rodaram,
    assinantes: planos.vitalicio + planos.mensal + planos.anual,
    planos,
    criancasAtivas,
    criancasComFamilia,
    fracaoComFamilia:
      criancasAtivas > 0 && criancasComFamilia !== null
        ? Math.min(1, criancasComFamilia / criancasAtivas)
        : null,
    baixasNoMes,
    pagariaPorMes: lista.length ? centavos(pagaria) : null,
  };
}

/**
 * O ID DA FOTO É O DIA DE BRASÍLIA, 'AAAA-MM-DD'. A agendada roda às 23h50 de
 * Brasília, que em UTC já é o dia seguinte — ler a data em UTC gravaria a
 * foto de segunda com o nome de terça.
 */
function chaveDoDia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** 'AAAA-MM' de Brasília: o mês das baixas e dos descontos com prazo. */
function mesDoDia(agora = new Date()) {
  return chaveDoDia(agora).slice(0, 7);
}

/**
 * O documento da foto: LISTA FECHADA de campos, só números. Nenhum uid, nome
 * ou dado de criança entra — a foto é da base, não de ninguém.
 */
function fotoDoDia(retrato, agora = new Date()) {
  const r = retrato || {};
  return {
    dia: chaveDoDia(agora),
    motoristas: r.motoristas ?? 0,
    rodaram: r.rodaram ?? 0,
    rodaramNaSemana: r.rodaramNaSemana ?? 0,
    assinantes: r.assinantes ?? 0,
    planos: {
      vitalicio: r.planos?.vitalicio ?? 0,
      mensal: r.planos?.mensal ?? 0,
      anual: r.planos?.anual ?? 0,
      teste: r.planos?.teste ?? 0,
    },
    criancasAtivas: r.criancasAtivas ?? null,
    criancasComFamilia: r.criancasComFamilia ?? null,
    baixasNoMes: r.baixasNoMes ?? null,
    pagariaPorMes: r.pagariaPorMes ?? null,
  };
}

module.exports = {
  DIAS_DE_USO,
  jaRodou,
  rodouNosUltimos,
  planoDoAssinante,
  pagariaPorMes,
  retratoDaBase,
  chaveDoDia,
  mesDoDia,
  fotoDoDia,
};
