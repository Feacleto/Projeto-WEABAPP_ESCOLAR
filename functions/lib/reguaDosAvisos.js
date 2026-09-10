/**
 * A RÉGUA DOS AVISOS DE TEMPO — pura, sem nenhum `require`.
 *
 * São os avisos que ninguém dispara com um gesto: eles nascem de uma DATA
 * chegando. Vencimento de mensalidade, convite que ninguém resgatou, fatura da
 * plataforma, alvará expirando. Alguém tem que varrer e perguntar "cabe hoje?",
 * e quem responde é este arquivo.
 *
 * ── ⚠️ POR QUE ELE NÃO REQUER NADA
 * A regra do CLAUDE.md, aprendida com a bateria partida no meio: módulo de
 * `functions/lib/` que é RÉGUA não requer `firebase-admin` nem
 * `firebase-functions`. Esses pacotes vivem em `functions/node_modules`, que o
 * git não rastreia, e o CI roda um `npm ci` na raiz. Quem precisa do SDK é o
 * `onSchedule`, e ele mora em `enviarAvisosDoDia.js`.
 *
 * ── ⚠️ O LEMBRETE DE MENSALIDADE MUDOU DE CASA, E NÃO GANHOU UM ESPELHO
 * Ele existia em `deriveParentReminders` (cliente), que NÃO GRAVA NADA: os
 * cinco lembretes eram calculados na hora só pra desenhar a lista do sino. Sem
 * documento não há push — ou seja, o lembrete só existia se ela abrisse o app,
 * que é exatamente o que um lembrete existe pra evitar.
 *
 * Os limiares vieram pra cá e a derivação no cliente FOI EMBORA. Se as duas
 * ficassem de pé, o sino mostraria cada lembrete duas vezes (`useNotifications`
 * concatena `stored` com `derived`) — e o projeto ganharia um terceiro espelho
 * pra manter em dia. Some um, não nasce outro.
 *
 * ── ⚠️ NADA AQUI DECIDE SOZINHO SE JÁ FALOU
 * A régua responde "cabe hoje?". Quem lembra que já falou é a marca gravada no
 * documento alvo (`avisos.{tipo}`), e é ela que faz a varredura diária não
 * repetir o mesmo aviso. `jaAvisado` está aqui só pra ler essa marca do mesmo
 * jeito em todo lugar.
 */

'use strict';

const FUSO = 'America/Sao_Paulo';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Os tipos. Os cinco de mensalidade REUSAM os nomes que o cliente já
 * desenhava — `NotificationsBody` tem ícone e cor pra cada um, e trocar o
 * nome apagaria isso sem ninguém notar.
 */
const TIPO = {
  VENCE_5: 'payment_due_5d',
  VENCE_3: 'payment_due_3d',
  VENCE_HOJE: 'payment_due_0d',
  ATRASO_3: 'payment_overdue_3d',
  ATRASO_7: 'payment_overdue_7d',
  CONVITE_PARADO: 'convite_parado',
  FATURA_VENCE: 'fatura_vence',
  ALVARA_VENCE: 'alvara_vence',
};

/** Quantos dias depois do convite mandado a gente lembra. Uma vez só. */
const DIAS_DO_CONVITE = 4;
/** Antecedência do aviso da fatura da plataforma. */
const DIAS_DA_FATURA = 3;
/** Antecedência do alvará — a mesma que a fila do dono já usa. */
const DIAS_DO_ALVARA = 30;

// ── utilitários de data, todos no fuso de Brasília ─────────────────────────

function paraData(valor) {
  if (!valor) return null;
  let d = null;
  if (typeof valor.toDate === 'function') d = valor.toDate();
  else if (valor instanceof Date) d = valor;
  else if (typeof valor === 'number') d = new Date(valor);
  else if (typeof valor.seconds === 'number') d = new Date(valor.seconds * 1000);
  else if (typeof valor === 'string') d = new Date(valor);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

/** 'AAAA-MM-DD' em São Paulo. As functions rodam em UTC; a família, não. */
function chaveDoDia(quando) {
  const d = paraData(quando) || new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Dias inteiros entre dois instantes, contados por DIA DE CALENDÁRIO.
 *
 * ⚠️ E não por 24h corridas. "Vence em 3 dias" é uma frase sobre o calendário
 * dela: um vencimento às 23h e um às 01h do mesmo dia são o mesmo dia, e uma
 * conta em milissegundos os separaria — fazendo o aviso de 3 dias cair no de
 * 2 pra metade da base, sem nenhum erro aparecer.
 */
function diasAte(alvo, agora) {
  const a = chaveDoDia(agora);
  const b = chaveDoDia(alvo);
  if (!a || !b) return null;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ua = Date.UTC(ay, am - 1, ad);
  const ub = Date.UTC(by, bm - 1, bd);
  return Math.round((ub - ua) / MS_POR_DIA);
}

function dataCurta(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

function reais(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function primeiroNome(completo) {
  return String(completo || '').trim().split(/\s+/)[0] || '';
}

/** Já falamos deste aviso neste documento? */
function jaAvisado(doc, tipo) {
  return !!(doc && doc.avisos && doc.avisos[tipo]);
}

// ── os quatro avisos ───────────────────────────────────────────────────────

/**
 * A MENSALIDADE DA FAMÍLIA — cinco degraus, e o nome da criança na frente.
 *
 * O nome vai junto porque um responsável pode ter dois filhos: "sua
 * mensalidade venceu" sem dizer de quem não diz nada.
 */
function avisoDaMensalidade({ pagamento, agora = new Date() } = {}) {
  const p = pagamento || {};
  if (p.status === 'paid') return null;

  const venc = paraData(p.dueDate);
  if (!venc) return null;

  const faltam = diasAte(venc, agora);
  if (faltam === null) return null;

  const quem = p.childName ? `${primeiroNome(p.childName)}: ` : '';
  const valor = reais(p.amount);
  const mes = p.month ? ` (${p.month})` : '';

  const monta = (tipo, titulo, corpo) => ({ tipo, titulo, corpo, destino: '/pai/finance' });

  if (faltam === 5) {
    return monta(TIPO.VENCE_5, 'Vencimento em 5 dias',
      `${quem}a mensalidade de ${valor}${mes} vence em 5 dias.`);
  }
  if (faltam === 3) {
    return monta(TIPO.VENCE_3, 'Vencimento em 3 dias',
      `${quem}a mensalidade de ${valor}${mes} vence em 3 dias.`);
  }
  if (faltam === 0) {
    return monta(TIPO.VENCE_HOJE, 'Vence hoje',
      `${quem}a mensalidade de ${valor}${mes} vence hoje.`);
  }
  if (faltam === -3) {
    return monta(TIPO.ATRASO_3, 'Pagamento atrasado',
      `${quem}a mensalidade de ${valor}${mes} está 3 dias atrasada.`);
  }
  if (faltam === -7) {
    return monta(TIPO.ATRASO_7, 'Atrasada há uma semana',
      `${quem}a mensalidade de ${valor}${mes} está 7 dias atrasada.`);
  }
  return null;
}

/**
 * O CONVITE QUE NINGUÉM RESGATOU.
 *
 * ⚠️ VAI PRO MOTORISTA, NÃO PRA FAMÍLIA — e é a única leitura possível: a
 * família não tem conta ainda, então não há caixa onde entregar. Quem pode
 * agir é ele, que tem o telefone dela e a vê toda manhã.
 *
 * ⚠️ E UMA VEZ SÓ. Convite parado não piora com o tempo, e cobrar de novo toda
 * semana transforma o sino dele numa lista de pendências que ele não controla.
 */
function avisoDoConvite({ crianca, agora = new Date() } = {}) {
  const c = crianca || {};
  if (c.active === false) return null;
  if (c.inviteStatus !== 'pending') return null;
  if (c.parentUid) return null;

  const nascido = paraData(c.createdAt);
  if (!nascido) return null;

  const dias = -diasAte(nascido, agora);
  if (dias !== DIAS_DO_CONVITE) return null;

  const nome = primeiroNome(c.name) || 'a criança';
  return {
    tipo: TIPO.CONVITE_PARADO,
    titulo: 'Convite ainda não usado',
    corpo: `A família de ${nome} recebeu o convite há ${DIAS_DO_CONVITE} dias e ainda não entrou. Reenvie o link.`,
    destino: '/tio/children',
  };
}

/**
 * A FATURA DA PLATAFORMA — dinheiro que o motorista deve, e que hoje só
 * aparece se ele abrir o app. A suspensão chega sem nada tocar no celular.
 */
function avisoDaFatura({ fatura, agora = new Date() } = {}) {
  const f = fatura || {};
  if (f.status !== 'aberta') return null;

  const venc = paraData(f.vencimento);
  if (!venc) return null;

  const faltam = diasAte(venc, agora);
  if (faltam !== DIAS_DA_FATURA) return null;

  return {
    tipo: TIPO.FATURA_VENCE,
    titulo: `Sua fatura vence em ${DIAS_DA_FATURA} dias`,
    corpo: `${reais(f.total)} até ${dataCurta(venc)}.`,
    destino: '/tio/taxa',
  };
}

/**
 * O ALVARÁ VENCENDO.
 *
 * ⚠️ ELE PERDE O SELO SOZINHO, e é isso que torna o aviso necessário:
 * `alvaraValidade` é quem decide se o selo vale, não o campo de estado. Sem
 * aviso, o selo some da tela das famílias dele sem ninguém ter dito nada.
 *
 * A antecedência é a mesma que a fila do dono já usa — dois números
 * diferentes fariam o dono e o motorista falarem de prazos distintos.
 */
function avisoDoAlvara({ motorista, agora = new Date() } = {}) {
  const m = motorista || {};
  if (m.verificacao !== 'aprovada') return null;

  const validade = paraData(m.alvaraValidade);
  if (!validade) return null;

  const faltam = diasAte(validade, agora);
  if (faltam !== DIAS_DO_ALVARA) return null;

  return {
    tipo: TIPO.ALVARA_VENCE,
    titulo: 'Seu alvará vence em 30 dias',
    corpo: `Vale até ${dataCurta(validade)}. Envie o novo pra não perder o selo.`,
    destino: '/tio/selo',
  };
}

module.exports = {
  FUSO,
  TIPO,
  DIAS_DO_CONVITE,
  DIAS_DA_FATURA,
  DIAS_DO_ALVARA,
  chaveDoDia,
  diasAte,
  dataCurta,
  reais,
  primeiroNome,
  jaAvisado,
  avisoDaMensalidade,
  avisoDoConvite,
  avisoDaFatura,
  avisoDoAlvara,
};
