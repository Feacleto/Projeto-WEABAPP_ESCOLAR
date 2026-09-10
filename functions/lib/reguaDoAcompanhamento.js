/**
 * A RÉGUA DO ACOMPANHAMENTO DO DIA — pura, sem nenhum `require`.
 *
 * Ela decide duas coisas, e as duas são de segurança:
 *   1. se um link de acompanhamento ainda vale HOJE;
 *   2. exatamente quais campos a pessoa do outro lado pode ver.
 *
 * ── ⚠️ POR QUE ESTE ARQUIVO NÃO REQUER NADA
 * É a regra que o CLAUDE.md aprendeu a duras penas: módulo de `functions/lib/`
 * que é RÉGUA não pode requerer `firebase-admin` nem `firebase-functions`.
 * Esses pacotes só existem em `functions/node_modules`, que o git não
 * rastreia, e o CI roda um `npm ci` na raiz — um `require` aqui mataria o
 * teste num checkout limpo e levaria a bateria inteira junto pelo `&&`.
 * Quem precisa do SDK é o `onCall`, e ele mora em `acompanhamento.js`.
 *
 * ── ⚠️ E POR QUE A LISTA DE CAMPOS É EXPLÍCITA, NUNCA UM SPREAD
 * O documento da criança tem endereço, coordenada de casa, telefone dos dois
 * responsáveis, escola, mensalidade e código de convite. Um `...child` aqui
 * entrega tudo isso a quem tem um link de WhatsApp. A lista abaixo é a única
 * coisa entre esses campos e um terceiro, e é ela que o teste bate campo a
 * campo — não a intenção de quem escreveu.
 */

'use strict';

/** O fuso do produto. As functions rodam em UTC; a família, não. */
const FUSO = 'America/Sao_Paulo';

/**
 * 'AAAA-MM-DD' no fuso de São Paulo.
 *
 * ⚠️ NÃO É `new Date().toISOString().slice(0,10)`. Entre 21h e 0h de Brasília
 * o UTC já virou o dia, e o link da tarde morreria três horas antes da
 * meia-noite — exatamente quando a mãe ainda está esperando a criança voltar.
 * `en-CA` é o truque: é o locale que formata data como AAAA-MM-DD.
 */
function chaveDoDia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** 'HH:MM' no fuso de São Paulo, ou null. Aceita Timestamp, Date ou número. */
function horaLocal(valor) {
  if (!valor) return null;
  let d = null;
  if (typeof valor.toDate === 'function') d = valor.toDate();
  else if (valor instanceof Date) d = valor;
  else if (typeof valor === 'number') d = new Date(valor);
  else if (typeof valor.seconds === 'number') d = new Date(valor.seconds * 1000);
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Só o primeiro nome. Quem vai pegar não precisa do nome completo de ninguém. */
function primeiroNome(completo) {
  return String(completo || '').trim().split(/\s+/)[0] || '';
}

/**
 * O ACESSO AINDA VALE?
 *
 * Três perguntas, e a terceira é a que faz a revogação existir sem código
 * novo: quem manda é o documento de `altPickups` do dia. O pai tocou em
 * "Trocar" ou tirou a pessoa? O documento sumiu, e o link para de responder
 * no mesmo instante — sem precisar apagar token nenhum.
 *
 * Devolve { ok } ou { ok: false, motivo }, e o motivo NUNCA vai para a
 * pessoa: ele existe pro log. Dizer "esse link era de ontem" a quem está
 * sondando confirma que o token existiu.
 */
function acessoValido({ acesso, altPickup, agora = new Date() } = {}) {
  if (!acesso) return { ok: false, motivo: 'inexistente' };
  if (acesso.dateKey !== chaveDoDia(agora)) return { ok: false, motivo: 'vencido' };
  // O link morre com a indicação: é a revogação do pai, e ela já é um toque
  // ("Trocar" / `clearDailyAltPickup`).
  if (!altPickup) return { ok: false, motivo: 'revogado' };
  if (altPickup.childId && acesso.childId && altPickup.childId !== acesso.childId) {
    return { ok: false, motivo: 'trocado' };
  }
  return { ok: true };
}

/**
 * ESTADO DO DIA A PARTIR DOS MARCOS DA VIAGEM — não de `child.status`.
 *
 * ⚠️ E A DIFERENÇA IMPORTA. `child.status` é um campo que atravessa a
 * meia-noite: a criança entregue ontem continua `delivered` hoje de manhã até
 * alguém mexer, e é por isso que o app tem `getEffectiveStatus`. O documento
 * de `rides/{dia}` já é do DIA — ler dele é ficar imune ao problema em vez de
 * reimplementar a correção aqui, onde ninguém lembraria de mantê-la.
 */
function estadoDoDia(ride) {
  const m = (ride && ride.marcos) || {};
  if (m.delivered) return 'entregue';
  if (m.atSchool) return 'na_escola';
  if (m.onboard) return 'na_perua';
  return 'esperando';
}

/**
 * O PAYLOAD PÚBLICO — a lista fechada do que sai daqui.
 *
 * Cada campo tem uma razão de estar, e é a mesma: responder "a que horas eu
 * preciso estar lá" e "já chegou?". O que não responde a essas duas, não sai.
 *
 * ⚠️ FORA DE PROPÓSITO, e cada um por um motivo:
 *   - endereço e coordenada de casa — é onde a criança mora;
 *   - posição AO VIVO da perua — é o veículo de um autônomo, na rua dele,
 *     agora, e ele não decidiu compartilhar isso com terceiros;
 *   - telefone dos responsáveis, mensalidade, código do convite — nada disso
 *     tem a ver com pegar uma criança na escola;
 *   - as outras crianças da perua — a fila é a posição DESTA.
 */
function montarAcompanhamento({ child, ride, motorista } = {}) {
  const c = child || {};
  const r = ride || {};
  const m = r.marcos || {};
  const d = motorista || {};

  return {
    crianca: primeiroNome(c.name),
    estado: estadoDoDia(r),
    marcos: {
      naPerua: horaLocal(m.onboard),
      naEscola: horaLocal(m.atSchool),
      entregue: horaLocal(m.delivered),
    },
    // A marca é como as famílias o chamam ("Tio Nino"); sem ela, o primeiro
    // nome. O nome civil não entra.
    motorista: String(d.marcaNome || '').trim() || primeiroNome(d.name),
    // A fila responde "a que horas eu preciso estar lá" sem entregar onde a
    // perua está. É a troca que este link inteiro faz.
    paradasNaVolta: typeof r.ordemVolta === 'number' ? r.ordemVolta : null,
    combinado: {
      ida: (r.combinado && r.combinado.ida) || null,
      volta: (r.combinado && r.combinado.volta) || null,
    },
  };
}

/** Os campos que o payload pode ter. O teste bate contra esta lista. */
const CAMPOS_DO_PAYLOAD = [
  'crianca',
  'estado',
  'marcos',
  'motorista',
  'paradasNaVolta',
  'combinado',
];

module.exports = {
  FUSO,
  chaveDoDia,
  horaLocal,
  primeiroNome,
  acessoValido,
  estadoDoDia,
  montarAcompanhamento,
  CAMPOS_DO_PAYLOAD,
};
