/**
 * O TELEFONE DIGITADO DEPOIS — o servidor PERGUNTA à mãe, nunca vincula
 * sozinho (14/11/2026). Régua PURA: só requer outra régua pura
 * (`reguaDoIrmao.js`), nunca o SDK — `testar:imports` derruba a bateria se um
 * script alcançar `firebase-admin`/`firebase-functions`. Quem escreve é
 * `perguntaDoIrmao.js`. Teste: `npm run testar:pergunta-do-irmao`.
 *
 * ── O BURACO
 * O irmão automático (`vincularIrmao.js`) só roda na CRIAÇÃO da criança. A
 * Lista da turma deixa o telefone opcional e o tio o digita depois — então a
 * criança irmã nunca entrava na conta da mãe que já usa o app, e quem pediu
 * acesso pelo número nunca tinha o pedido aberto.
 *
 * ── ⚠️ POR QUE NA TROCA O SERVIDOR PERGUNTA, E NO CADASTRO NÃO
 * No cadastro o número é digitado UMA vez, para uma criança nova. Na troca,
 * o motorista pode digitar o número de qualquer família dele, uma depois da
 * outra, e anexar uma criança dele à conta de cada uma — a família alheia
 * passaria a ver nome, endereço e escola. É a decisão 28 pelo outro lado: o
 * número digitado pelo motorista PROVA de quem é a criança que ele cadastrou,
 * mas não prova que a dona do número a quer na conta. Quem confirma é ela,
 * com um "Sim, é meu filho".
 *
 * ── AS TRAVAS DA PERGUNTA
 *   - só WhatsApp, nunca nome; ambíguo não pergunta; só família DESTE
 *     motorista (tudo isso é `responsavelDoIrmao`, a régua do cadastro);
 *   - "Não é meu filho" vale PARA SEMPRE para o par (criança, conta): trocar
 *     o número e voltar não pergunta de novo;
 *   - uma pergunta por troca de chave, e no máximo `TETO_DE_PERGUNTAS` por
 *     criança — senão o tio trocando o número vira spam no celular de alguém;
 *   - a pergunta só leva o PRIMEIRO nome da criança: endereço, escola e nome
 *     completo só depois de ela dizer sim.
 */

'use strict';

const { chaveDoTelefone, responsavelDoIrmao, ehFamiliaDe } = require('./reguaDoIrmao');

const TETO_DE_PERGUNTAS = 3;

const ACAO = Object.freeze({
  NADA: 'nada',
  // A criança está sem responsável: procurar a quem perguntar (ou quem espera).
  PROCURAR: 'procurar',
  // A criança já tem responsável que entrou pelo link sem número: o número
  // agora existe e pode virar a `phoneChave` dela.
  CHAVE_DA_FAMILIA: 'chave_da_familia',
});

const MOTIVO = Object.freeze({
  PERGUNTAR: 'perguntar',
  NINGUEM: 'ninguem',
  JA_RECUSOU: 'ja_recusou',
  JA_PERGUNTADO: 'ja_perguntado',
  TETO: 'teto',
});

const RESPOSTA = Object.freeze({ SIM: 'sim', NAO: 'nao' });

const PERGUNTA_VENCIDA = 'Esta pergunta não vale mais. Se for seu filho, peça o link ao motorista.';

/**
 * O que a mudança de `children/{id}` pede. Só a chave do WhatsApp muda o
 * jogo: qualquer outra escrita na criança (inclusive as do próprio gatilho e
 * do vínculo) devolve NADA — é isso que impede o laço.
 *
 *   antes, depois — os dados da criança antes e depois da escrita
 */
function oQueFazerComATroca({ antes, depois } = {}) {
  if (!depois || typeof depois !== 'object') return { acao: ACAO.NADA };
  const chave = chaveDoTelefone(depois.parentPhone);
  if (!chave) return { acao: ACAO.NADA };
  if (chaveDoTelefone(antes && antes.parentPhone) === chave) return { acao: ACAO.NADA };
  if (depois.active === false) return { acao: ACAO.NADA };
  if (depois.transferidaPara) return { acao: ACAO.NADA };
  if (typeof depois.parentUid === 'string' && depois.parentUid) {
    return { acao: ACAO.CHAVE_DA_FAMILIA, chave, parentUid: depois.parentUid };
  }
  if (depois.parentUid) return { acao: ACAO.NADA };
  if (typeof depois.adminUid !== 'string' || !depois.adminUid) return { acao: ACAO.NADA };
  return { acao: ACAO.PROCURAR, chave };
}

/**
 * A quem perguntar, ou por que não.
 *
 *   crianca  — os dados da criança (sem responsável)
 *   contas   — candidatos de `users` com a `phoneChave` (ver reguaDoIrmao)
 *   criancas — crianças do mesmo motorista (o caminho das contas antigas)
 *   registro — `perguntasDeIrmao/{childId}` ou null:
 *              { perguntas, recusadoPor: [uid], aberta: { parentUid, chave } }
 *
 * Devolve `{ motivo, parentUid }` — `parentUid` só com MOTIVO.PERGUNTAR.
 */
function aQuemPerguntar({ crianca, contas = [], criancas = [], registro = null } = {}) {
  if (!crianca) return { motivo: MOTIVO.NINGUEM, parentUid: null };
  const chave = chaveDoTelefone(crianca.parentPhone);
  const uid = responsavelDoIrmao({
    telefone: crianca.parentPhone,
    motorista: crianca.adminUid || null,
    contas,
    criancas,
  });
  if (!uid || !chave) return { motivo: MOTIVO.NINGUEM, parentUid: null };
  const r = registro || {};
  const recusas = Array.isArray(r.recusadoPor) ? r.recusadoPor : [];
  if (recusas.includes(uid)) return { motivo: MOTIVO.JA_RECUSOU, parentUid: null };
  // A mesma pergunta, ainda sem resposta: a entrega repetida do evento (ou o
  // tio voltando ao mesmo número) não pergunta de novo nem gasta o teto.
  if (r.aberta && r.aberta.parentUid === uid && r.aberta.chave === chave) {
    return { motivo: MOTIVO.JA_PERGUNTADO, parentUid: null };
  }
  if ((Number(r.perguntas) || 0) >= TETO_DE_PERGUNTAS) return { motivo: MOTIVO.TETO, parentUid: null };
  return { motivo: MOTIVO.PERGUNTAR, parentUid: uid };
}

/**
 * A resposta dela. O escopo é o uid AUTENTICADO contra a pergunta aberta que
 * só o servidor grava — nunca `request.data`.
 *
 *   uid      — quem chamou
 *   resposta — 'sim' | 'nao'
 *   registro — `perguntasDeIrmao/{childId}`
 *   crianca  — a criança como está AGORA
 *   conta    — `users/{uid}`
 *
 * Devolve `{ ok: true, vincular }` ou `{ ok: false, codigo, erro }`.
 * "Não" sempre se guarda (recusar nunca expõe nada); "Sim" exige que nada
 * tenha mudado desde a pergunta — outro número, outro responsável, criança
 * desativada ou transferida, e a pergunta vence.
 */
function respostaDaPergunta({ uid, resposta, registro, crianca, conta } = {}) {
  if (resposta !== RESPOSTA.SIM && resposta !== RESPOSTA.NAO) {
    return { ok: false, codigo: 'invalid-argument', erro: 'Responda sim ou não.' };
  }
  const aberta = registro && registro.aberta;
  if (!uid || !aberta || aberta.parentUid !== uid) {
    return { ok: false, codigo: 'failed-precondition', erro: PERGUNTA_VENCIDA };
  }
  if (!conta || conta.role !== 'parent') {
    return { ok: false, codigo: 'failed-precondition', erro: PERGUNTA_VENCIDA };
  }
  if (resposta === RESPOSTA.NAO) return { ok: true, vincular: false };

  const vale =
    crianca &&
    !crianca.parentUid &&
    crianca.active !== false &&
    !crianca.transferidaPara &&
    chaveDoTelefone(crianca.parentPhone) === aberta.chave &&
    (!aberta.adminUid || aberta.adminUid === crianca.adminUid) &&
    ehFamiliaDe(conta, crianca.adminUid);
  if (!vale) return { ok: false, codigo: 'failed-precondition', erro: PERGUNTA_VENCIDA };
  return { ok: true, vincular: true };
}

/**
 * A família que entrou pelo link SEM número ganha a `phoneChave` quando o
 * motorista o digita depois — é o que reabilita o irmão automático para ela.
 * Só o servidor grava, e só do número que o MOTORISTA digitou.
 *
 *   conta        — `users/{parentUid}` (com `uid`)
 *   childId      — a criança cuja ficha ganhou o número
 *   motorista    — `adminUid` da criança
 *   chave        — a chave do número novo
 *   outrasContas — uids de `users` que já têm essa `phoneChave`
 *
 * ⚠️ O `parentUid` da criança o motorista pode escrever; a lista `childIds`
 * e `adminUids` da conta, não. Por isso a conta precisa TER esta criança na
 * lista e ser família deste motorista — senão ele daria o número que quisesse
 * à conta de qualquer mãe da base.
 */
function podeGravarChaveDaFamilia({ conta, childId, motorista, chave, outrasContas = [] } = {}) {
  if (!conta || conta.role !== 'parent') return false;
  if (!chave || typeof childId !== 'string' || !childId) return false;
  if (conta.phoneChave) return false;
  const lista = Array.isArray(conta.childIds) ? conta.childIds : [];
  if (!lista.includes(childId) && conta.childId !== childId) return false;
  if (!ehFamiliaDe(conta, motorista)) return false;
  // A chave que casa com OUTRA conta não é gravada: duas contas com a mesma
  // chave tornariam o irmão ambíguo para as duas.
  if (outrasContas.some((u) => u && u !== conta.uid)) return false;
  return true;
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

/**
 * O aviso da pergunta. Só o primeiro nome da criança e o nome com que o
 * motorista se apresenta (a marca, se houver).
 */
function avisoDaPergunta({ nomeDaCrianca, motorista } = {}) {
  const nome = primeiroNome(nomeDaCrianca) || 'uma criança';
  const quem =
    String((motorista && motorista.marcaNome) || '').trim() ||
    primeiroNome(motorista && motorista.name) ||
    'O motorista';
  return {
    title: `${quem} cadastrou ${nome} com o seu número`,
    body: 'É seu filho? Toque para responder.',
    primeiroNome: nome,
  };
}

/** Id determinístico do aviso: a entrega repetida não duplica. */
function idDoAvisoDaPergunta(childId, n) {
  return `irmao_pergunta_${childId}_${n}`;
}

module.exports = {
  TETO_DE_PERGUNTAS,
  ACAO,
  MOTIVO,
  RESPOSTA,
  PERGUNTA_VENCIDA,
  oQueFazerComATroca,
  aQuemPerguntar,
  respostaDaPergunta,
  podeGravarChaveDaFamilia,
  avisoDaPergunta,
  idDoAvisoDaPergunta,
};
