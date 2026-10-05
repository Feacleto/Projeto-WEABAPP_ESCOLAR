/**
 * A JORNADA DA AUXILIAR, PONTA A PONTA, CONTRA O EMULADOR.
 *
 * ── ⚠️ POR QUE ESTE ARQUIVO EXISTE
 * Cada peça da conta da auxiliar tem a sua régua pura testada (`testar:auxiliar`,
 * `testar:pagamento-da-auxiliar`, `testar:substitutas`, `testar:comunidade`...),
 * e régua não escreve. O que ninguém media era o ENCADEAMENTO: o convite que
 * vira vínculo, o vínculo que liga a cópia da turma, a cópia que a página da
 * substituta lê, o desativar que apaga a cópia e a recontratação que a refaz
 * no MESMO documento. Este script chama as functions de verdade (`.run` de
 * cada callable v2, com a `request` montada à mão) contra Auth, Firestore e
 * Storage do emulador, e depois LÊ o que ficou gravado.
 *
 * Cobre só o que é NOVO desde a v1.2: conta da auxiliar, dois tios, cópia da
 * turma, marcar parada, pagamento, substituta de um dia, foto pela auxiliar
 * (F1.5), recomendação/estrelas, desativar e recontratar.
 *
 * ── O QUE NÃO MEDE
 * Rules (o Admin SDK as ignora; quem cobre é `testar-regras.mjs`), push e a
 * interface. Os gatilhos do Firestore são chamados por `.run(event)` com
 * snapshots montados à mão: o emulador roda sem o Eventarc.
 *
 * ── COMO RODAR
 *   npm run testar:jornada-auxiliar
 *
 * ⚠️ FORA DA BATERIA ENCADEADA, como `testar-fechamento`: precisa dos
 * emuladores auth+firestore+storage e importa o Admin SDK de
 * `functions/node_modules` — o que `testar:imports` proíbe lá.
 */

import { createRequire } from 'node:module';

const PID = 'alobuzinou-be81f';
// ⚠️ Tudo isto ANTES do `require('../functions/index.js')`: o SDK lê o
// ambiente no momento em que o módulo sobe.
process.env.GCLOUD_PROJECT = PID;
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PID, storageBucket: `${PID}.appspot.com` });

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const { Timestamp } = require('../functions/node_modules/firebase-admin/lib/firestore/index.js');
const idx = require('../functions/index.js');
const RA = require('../functions/lib/reguaDoAuxiliar.js');

const db = admin.firestore();
const DIA = 86400000;

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok  ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}
const verdade = (nome, valor) => checar(nome, true, !!valor);
function bloco(t) {
  console.log('');
  console.log(`\x1b[1m${t}\x1b[0m`);
}

const req = (uid, data) => ({
  auth: uid ? { uid, token: { email: `${uid}@teste.com` } } : undefined,
  data,
  rawRequest: { ip: '127.0.0.1', headers: {} },
});
/** Chama a callable e devolve o resultado (lança se a function lançar). */
const chamar = (fn, uid, data) => fn.run(req(uid, data));
/** Chama esperando recusa: devolve `{ code, message }` ou `{ code: 'NAO_RECUSOU' }`. */
async function recusa(fn, uid, data) {
  try {
    const r = await fn.run(req(uid, data));
    return { code: 'NAO_RECUSOU', resultado: r };
  } catch (e) {
    return { code: e.code || 'erro-sem-code', message: e.message };
  }
}

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const mes = hoje.slice(0, 7);

const snapDe = (dados) => ({ exists: dados != null, data: () => dados });
const lerDoc = async (caminho) => {
  const s = await db.doc(caminho).get();
  return s.exists ? s.data() : null;
};
const avisosDe = async (uid, tipo) => {
  const s = await db.collection('notifications').where('userId', '==', uid).get();
  return s.docs.map((d) => d.data()).filter((n) => !tipo || n.type === tipo);
};

// ── Semente ──────────────────────────────────────────────────────────────
const TIO_A = 'tioA';
const TIO_B = 'tioB';
const AUX1 = 'aux1';
const AUX2 = 'aux2';
const AUX3 = 'aux3';
const AUX4 = 'aux4';
const MAE = 'mae1';

async function semear() {
  for (const uid of [TIO_A, TIO_B, AUX1, AUX2, AUX3, AUX4, MAE]) {
    await admin.auth().createUser({ uid, email: `${uid}@teste.com`, password: 'senha123' });
  }
  await db.doc(`users/${TIO_A}`).set({ role: 'admin', name: 'Antonio Nino Silva', marcaNome: 'Tio Nino', phone: '11911110000' });
  await db.doc(`users/${TIO_B}`).set({ role: 'admin', name: 'Bruno Costa', marcaNome: 'Tio Bruno', phone: '11922220000' });
  await db.doc(`users/${MAE}`).set({ role: 'parent', name: 'Maria Pereira', email: 'mae1@teste.com' });
  const base = {
    adminUid: TIO_A, active: true, parentUid: MAE, parentName: 'Maria Pereira', parentPhone: '11955554444',
    school: 'Escola Sol', horaPega: '06:40', horaEntrega: '12:30', period: 'manha', status: 'home',
    // Os campos que a auxiliar NUNCA pode receber:
    address: 'Rua das Acácias 123', monthlyFee: 777.77, saudeNotas: 'Alergia a amendoim',
    birthDate: '2016-05-05', contractAcceptedAt: Timestamp.now(),
  };
  await db.doc('children/c1').set({ ...base, name: 'Lucas Pereira', fotoDaTurmaConsentida: true });
  await db.doc('children/c2').set({ ...base, name: 'Ana Pereira', horaPega: '07:00' }); // sem o "sim" da foto
  await db.doc('children/c4').set({
    ...base, name: 'Davi Pereira', status: 'delivered', statusUpdatedAt: Timestamp.now(),
  });
  await db.doc('substitutasDoTio/sub1').set({ motoristaUid: TIO_A, nome: 'Joana Souza Lima', telefone: '11987654321' });
}

async function main() {
  await semear();

  // ── 1. CONVITE ─────────────────────────────────────────────────────────
  bloco('1. Convite: o tio A chama, ela vê a marca, aceita e vira auxiliar');
  const c1 = await chamar(idx.convidarAuxiliar, TIO_A, { nome: 'Cida Alves', telefone: '(11) 98888-1111', valorMensal: 900 });
  verdade('o tio recebe um código de convite', typeof c1.codigo === 'string' && RA.codigoValido(c1.codigo));
  const convite = await lerDoc(`convitesDeAuxiliar/${c1.codigo}`);
  checar('o convite guarda o telefone só com números', '11988881111', convite.telefone);

  const previa = await chamar(idx.verConviteDeAuxiliar, null, { codigo: c1.codigo });
  checar('a prévia pública devolve só vale, marca e primeiro nome', ['marca', 'primeiroNome', 'vale'], Object.keys(previa).sort());
  checar('a prévia mostra a marca do tio', 'Tio Nino', previa.marca);
  checar('a prévia mostra só o primeiro nome', 'Cida', previa.primeiroNome);
  verdade('a prévia não vaza telefone, valor nem uid', !/11988881111|900|tioA/.test(JSON.stringify(previa)));
  checar('código com formato errado não vale', false, (await chamar(idx.verConviteDeAuxiliar, null, { codigo: 'xx' })).vale);

  // Uma família (role parent) não aceita convite — e o convite NÃO é gasto.
  const mae = await recusa(idx.aceitarConviteDeAuxiliar, MAE, { codigo: c1.codigo });
  checar('a conta de família não aceita convite de auxiliar', 'failed-precondition', mae.code);
  checar('o convite continua livre depois da recusa', null, (await lerDoc(`convitesDeAuxiliar/${c1.codigo}`)).usadoPor);
  checar('o aceite sem sessão é recusado', 'unauthenticated', (await recusa(idx.aceitarConviteDeAuxiliar, null, { codigo: c1.codigo })).code);

  const ac = await chamar(idx.aceitarConviteDeAuxiliar, AUX1, { codigo: c1.codigo, acceptedLegalVersion: '1.4' });
  checar('o aceite devolve ok e não era jaEra', { ok: true, jaEra: false }, ac);
  const u1 = await lerDoc(`users/${AUX1}`);
  checar('a conta dela nasce com role auxiliar', 'auxiliar', u1.role);
  checar('motoristaUids tem só o tio A', [TIO_A], u1.motoristaUids);
  checar('o nome vem do convite', 'Cida Alves', u1.name);
  const v1 = await lerDoc(`auxiliares/${TIO_A}_${AUX1}`);
  checar('o vínculo do par nasce ativo', true, v1.ativa);
  checar('o vínculo tem os dois uids', [TIO_A, AUX1], [v1.motoristaUid, v1.auxiliarUid]);
  checar('o vínculo guarda o período aberto', [1, null], [v1.periodos.length, v1.periodos[0].ate]);
  checar('o vínculo guarda a marca do tio', 'Tio Nino', v1.marcaDoMotorista);
  checar('o vínculo guarda o valor do convite', 900, v1.valorMensal);
  verdade('o aceite liga a cópia da turma do tio', (await lerDoc(`turmaDaAuxiliar/${TIO_A}`))?.ativa === true);

  checar('o mesmo convite de novo, por outra conta, é recusado', 'not-found', (await recusa(idx.aceitarConviteDeAuxiliar, AUX3, { codigo: c1.codigo })).code);
  checar('quem já aceitou, aceitando de novo, só confirma', true, (await chamar(idx.aceitarConviteDeAuxiliar, AUX1, { codigo: c1.codigo })).jaEra);
  checar('o link usado, aberto por um estranho, dá a frase única', false, (await chamar(idx.verConviteDeAuxiliar, null, { codigo: c1.codigo })).vale);
  checar('o link usado, aberto por ela mesma, avisa que já é dela', true, (await chamar(idx.verConviteDeAuxiliar, AUX1, { codigo: c1.codigo })).jaEhSeu);

  const c2 = await chamar(idx.convidarAuxiliar, TIO_A, { nome: 'Dona Rita', telefone: '11977776666' });
  await chamar(idx.aceitarConviteDeAuxiliar, AUX2, { codigo: c2.codigo });
  checar('a segunda auxiliar do tio A entra', true, (await lerDoc(`auxiliares/${TIO_A}_${AUX2}`)).ativa);
  const terceira = await recusa(idx.convidarAuxiliar, TIO_A, { nome: 'Terceira', telefone: '11966665555' });
  checar('a terceira auxiliar do tio A é recusada (até 2)', 'failed-precondition', terceira.code);
  checar('a conta de auxiliar não convida', 'permission-denied', (await recusa(idx.convidarAuxiliar, AUX1, { nome: 'X', telefone: '11966665555' })).code);

  // ── 2. SEGUNDO TIO ─────────────────────────────────────────────────────
  bloco('2. Segundo tio: a mesma auxiliar trabalha para dois');
  const cb = await chamar(idx.convidarAuxiliar, TIO_B, { nome: 'Cida Alves', telefone: '11988881111' });
  await chamar(idx.aceitarConviteDeAuxiliar, AUX1, { codigo: cb.codigo });
  const u1b = await lerDoc(`users/${AUX1}`);
  checar('motoristaUids passa a ter os dois tios', [TIO_A, TIO_B], [...u1b.motoristaUids].sort());
  const vB = await lerDoc(`auxiliares/${TIO_B}_${AUX1}`);
  checar('o tio B tem o documento dele, próprio', [TIO_B, AUX1, true], [vB.motoristaUid, vB.auxiliarUid, vB.ativa]);
  checar('o documento do tio A não foi tocado', 1, (await lerDoc(`auxiliares/${TIO_A}_${AUX1}`)).periodos.length);
  checar('o tio B ganha a cópia da turma (raiz)', true, (await lerDoc(`turmaDaAuxiliar/${TIO_B}`))?.ativa === true);

  // ── 3. CÓPIA DA TURMA ──────────────────────────────────────────────────
  bloco('3. Cópia da turma: só a lista fechada de campos');
  const copiaC1 = await lerDoc(`turmaDaAuxiliar/${TIO_A}/criancas/c1`);
  verdade('a criança foi copiada no aceite', copiaC1);
  const fora = Object.keys(copiaC1 || {}).filter((k) => !RA.CAMPOS_DA_TURMA_DA_AUXILIAR.includes(k));
  checar('a cópia não tem nenhum campo fora da lista fechada', [], fora);
  verdade('a cópia não leva endereço, mensalidade, saúde nem aniversário',
    !/Acácias|777|amendoim|2016-05-05|monthlyFee|address|saudeNotas|birthDate/.test(JSON.stringify(copiaC1)));
  checar('a cópia leva o nome e a escola', ['Lucas Pereira', 'Escola Sol'], [copiaC1?.name, copiaC1?.school]);

  const c3 = { ...(await lerDoc('children/c1')), name: 'Bia Pereira', fotoDaTurmaConsentida: false, monthlyFee: 555.55 };
  await db.doc('children/c3').set(c3);
  await idx.espelharCriancaParaAuxiliar.run({ params: { childId: 'c3' }, data: { before: snapDe(null), after: snapDe(c3) } });
  const copiaC3 = await lerDoc(`turmaDaAuxiliar/${TIO_A}/criancas/c3`);
  verdade('o gatilho copia a criança nova', copiaC3?.name === 'Bia Pereira');
  verdade('o gatilho também não copia mensalidade', copiaC3 && !('monthlyFee' in copiaC3));
  const c3Inativa = { ...c3, active: false };
  await idx.espelharCriancaParaAuxiliar.run({ params: { childId: 'c3' }, data: { before: snapDe(c3), after: snapDe(c3Inativa) } });
  checar('criança inativa some da cópia', null, await lerDoc(`turmaDaAuxiliar/${TIO_A}/criancas/c3`));

  const falta = { adminUid: TIO_A, childId: 'c2', dateKey: hoje, type: 'full', recado: 'Está com febre', parentUid: MAE };
  await db.doc('absenceDeclarations/f1').set(falta);
  await idx.espelharFaltaParaAuxiliar.run({ params: { id: 'f1' }, data: { before: snapDe(null), after: snapDe(falta) } });
  const copiaFalta = await lerDoc(`turmaDaAuxiliar/${TIO_A}/faltas/f1`);
  checar('a falta vira cópia só com dia, criança e tipo', ['childId', 'dateKey', 'type'], Object.keys(copiaFalta || {}).sort());
  verdade('a cópia da falta não leva o recado', !/febre/.test(JSON.stringify(copiaFalta)));

  // ── 4. MARCAR PARADA ───────────────────────────────────────────────────
  bloco('4. Marcar parada pela auxiliar');
  const m1 = await chamar(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'onboard', motoristaUid: TIO_A });
  checar('embarcar na perua devolve ok', true, m1.ok);
  checar('o status da criança avançou', 'onboard', (await lerDoc('children/c1')).status);
  const ride = await lerDoc(`children/c1/rides/${hoje}`);
  checar('rides do dia grava marcadoPelaAuxiliar', true, ride?.marcadoPelaAuxiliar);
  verdade('rides do dia grava o marco de embarque', ride?.marcos?.onboard && ride?.marcos?.embarqueEmCasa);
  checar('rides leva o tio e o responsável', [TIO_A, MAE], [ride?.adminUid, ride?.parentUid]);

  checar('repetir o mesmo passo é recusado', 'failed-precondition', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'onboard', motoristaUid: TIO_A })).code);
  checar('pular direto de casa para a escola é recusado', 'failed-precondition', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c2', proximo: 'atSchool', motoristaUid: TIO_A })).code);
  checar('criança já entregue não volta para a perua', 'failed-precondition', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c4', proximo: 'onboard', motoristaUid: TIO_A })).code);
  checar('a criança do tio A não é marcada pela perua do tio B', 'permission-denied', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'atSchool', motoristaUid: TIO_B })).code);
  checar('quem não tem vínculo não marca', 'permission-denied', (await recusa(idx.marcarParadaPelaAuxiliar, AUX4, { childId: 'c1', proximo: 'atSchool', motoristaUid: TIO_A })).code);

  const m2 = await chamar(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'atSchool', motoristaUid: TIO_A });
  checar('chegar na escola avisa a família', true, m2.avisou);
  const avisoEscola = await avisosDe(MAE, 'child_arrived_school');
  checar('o aviso "chegou na escola" existe para a mãe', 1, avisoEscola.length);
  verdade('o aviso diz o primeiro nome da criança', /Lucas/.test(avisoEscola[0]?.title || ''));
  await chamar(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'onboard', motoristaUid: TIO_A });
  const m4 = await chamar(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'delivered', motoristaUid: TIO_A });
  checar('entregar em casa avisa a família', [true, 1], [m4.avisou, (await avisosDe(MAE, 'child_arrived_home')).length]);
  checar('depois de entregue, voltar é recusado', 'failed-precondition', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c1', proximo: 'onboard', motoristaUid: TIO_A })).code);

  await db.doc(`users/${TIO_A}`).update({ suspenso: true });
  checar('com a conta do tio suspensa, a auxiliar não marca', 'failed-precondition', (await recusa(idx.marcarParadaPelaAuxiliar, AUX1, { childId: 'c2', proximo: 'onboard', motoristaUid: TIO_A })).code);
  checar('o status de quem ela tentou marcar não mudou', 'home', (await lerDoc('children/c2')).status);
  await db.doc(`users/${TIO_A}`).update({ suspenso: false });

  // ── 5. PAGAMENTO ───────────────────────────────────────────────────────
  bloco('5. Pagamento: recibo dos dois e despesa no caixa');
  const p1 = await chamar(idx.anotarPagamentoDaAuxiliar, TIO_A, { auxiliarUid: AUX1, mes, valor: 900 });
  const idRecibo = `${TIO_A}_${AUX1}_${mes}`;
  checar('o recibo tem o id do par e do mês', idRecibo, p1.id);
  const recibo = await lerDoc(`pagamentosDaAuxiliar/${idRecibo}`);
  checar('o recibo nasce sem recebimento', [900, null], [recibo.valor, recibo.recebidoEm]);
  const despesa = await lerDoc(`expenses/${recibo.despesaId}`);
  checar('a despesa nasce na categoria monitor, com o valor', ['monitor', 900, TIO_A], [despesa.category, despesa.amount, despesa.adminUid]);
  checar('a despesa aponta o recibo', idRecibo, despesa.pagamentoDaAuxiliar);
  checar('o segundo pagamento do mês é recusado', 'already-exists', (await recusa(idx.anotarPagamentoDaAuxiliar, TIO_A, { auxiliarUid: AUX1, mes, valor: 900 })).code);
  checar('não nasceu segunda despesa', 1, (await db.collection('expenses').where('adminUid', '==', TIO_A).get()).size);
  checar('o tio B não anota o pagamento da auxiliar do tio A', 'permission-denied', (await recusa(idx.anotarPagamentoDaAuxiliar, TIO_B, { auxiliarUid: AUX2, mes, valor: 100 })).code);
  checar('valor zero é recusado', 'invalid-argument', (await recusa(idx.anotarPagamentoDaAuxiliar, TIO_A, { auxiliarUid: AUX2, mes, valor: 0 })).code);

  checar('outra auxiliar não confirma o recibo', 'permission-denied', (await recusa(idx.confirmarRecebimentoDaAuxiliar, AUX2, { id: idRecibo })).code);
  checar('ela confirma o recebimento', { ok: true, jaEra: false }, await chamar(idx.confirmarRecebimentoDaAuxiliar, AUX1, { id: idRecibo }));
  verdade('o recibo ganha a data do recebimento', (await lerDoc(`pagamentosDaAuxiliar/${idRecibo}`)).recebidoEm);
  checar('o tio recebe o aviso da confirmação', 1, (await avisosDe(TIO_A, 'auxiliar_confirmou_pagamento')).length);
  checar('confirmar de novo não avisa duas vezes', [true, 1],
    [(await chamar(idx.confirmarRecebimentoDaAuxiliar, AUX1, { id: idRecibo })).jaEra, (await avisosDe(TIO_A, 'auxiliar_confirmou_pagamento')).length]);

  // O emulador não dispara gatilhos sozinho: o espelho da criança que a
  // auxiliar acabou de marcar roda aqui, como rodaria em produção.
  const c1Depois = await lerDoc('children/c1');
  await idx.espelharCriancaParaAuxiliar.run({ params: { childId: 'c1' }, data: { before: snapDe({ ...c1Depois, status: 'home' }), after: snapDe(c1Depois) } });
  checar('o gatilho leva o status novo para a cópia da turma', 'delivered', (await lerDoc(`turmaDaAuxiliar/${TIO_A}/criancas/c1`)).status);

  // ── 6. SUBSTITUTA DE UM DIA ────────────────────────────────────────────
  bloco('6. Substituta de um dia: o link só mostra o mínimo');
  const g = await chamar(idx.gerarAcessoDeSubstituta, TIO_A, { substitutaId: 'sub1' });
  verdade('o tio recebe o id e o token', g.id && g.token?.includes('.'));
  const acessoDoc = await lerDoc(`acessosDeSubstituta/${g.id}`);
  verdade('o banco guarda só o hash do segredo', acessoDoc.segredoHash && !g.token.includes(acessoDoc.segredoHash) && !('segredo' in acessoDoc));
  checar('o tio B não gera para a substituta do tio A', 'permission-denied', (await recusa(idx.gerarAcessoDeSubstituta, TIO_B, { substitutaId: 'sub1' })).code);

  const rota = await chamar(idx.verRotaDaSubstituta, null, { token: g.token });
  checar('a página mostra a marca e o primeiro nome dela', ['Tio Nino', 'Joana'], [rota.marca.nome, rota.substituta]);
  verdade('a rota traz as crianças do dia', rota.paradas.length >= 2);
  const jr = JSON.stringify(rota);
  verdade('nenhum telefone na resposta', !/11987654321|11955554444|11911110000/.test(jr));
  verdade('nenhum endereço na resposta', !/Acácias|address/.test(jr));
  verdade('nenhum sobrenome na resposta', !/Pereira|Souza|Lima|Silva|Costa/.test(jr));
  verdade('nenhum valor na resposta', !/777|555|monthlyFee/.test(jr));
  verdade('a parada leva só primeiro nome, escola, horas e etapa',
    rota.paradas.every((p) => Object.keys(p).sort().join() === ['chave', 'dropoffPeriod', 'escola', 'falta', 'horaEntrega', 'horaPega', 'nome', 'period', 'pickupPeriod', 'status'].sort().join()));
  checar('a parada do Lucas mostra a etapa de hoje', 'delivered', rota.paradas.find((p) => p.nome === 'Lucas')?.status);
  checar('a parada da Ana mostra a falta', 'full', rota.paradas.find((p) => p.nome === 'Ana')?.falta);

  const ponto = g.token.indexOf('.');
  const idLink = g.token.slice(0, ponto);
  const segredo = g.token.slice(ponto + 1);
  const errado = await recusa(idx.verRotaDaSubstituta, null, { token: `${idLink}.${segredo.slice(0, -2)}xx` });
  checar('segredo errado leva a frase única', ['not-found', 'Este link não vale mais.'], [errado.code, errado.message]);
  checar('token mal formado leva a mesma frase', 'Este link não vale mais.', (await recusa(idx.verRotaDaSubstituta, null, { token: 'qualquer-coisa' })).message);

  await chamar(idx.encerrarAcessoDeSubstituta, TIO_A, { id: g.id });
  checar('encerrado, o link morre', 'Este link não vale mais.', (await recusa(idx.verRotaDaSubstituta, null, { token: g.token })).message);
  checar('o tio é avisado do encerramento', 1,
    (await db.collection('notifications').where('userId', '==', TIO_A).get()).docs.filter((d) => /substituta|link|acesso/i.test(d.data().type || '')).length);

  const g2 = await chamar(idx.gerarAcessoDeSubstituta, TIO_A, { substitutaId: 'sub1' });
  checar('um link novo abre', 'NAO_RECUSOU', (await recusa(idx.verRotaDaSubstituta, null, { token: g2.token })).code);
  await db.doc(`users/${TIO_A}`).update({ suspenso: true });
  checar('com a conta do tio suspensa, o link morre', 'Este link não vale mais.', (await recusa(idx.verRotaDaSubstituta, null, { token: g2.token })).message);
  checar('conta suspensa não gera link novo', 'failed-precondition', (await recusa(idx.gerarAcessoDeSubstituta, TIO_A, { substitutaId: 'sub1' })).code);
  await db.doc(`users/${TIO_A}`).update({ suspenso: false });

  // ── 7. FOTO PELA AUXILIAR (F1.5) ───────────────────────────────────────
  bloco('7. Foto da turma postada pela auxiliar');
  const bucket = admin.storage().bucket();
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const origem = `fotosDaTurma/${AUX1}/fotoabc123.jpg`;
  await bucket.file(origem).save(jpeg, { contentType: 'image/jpeg' });
  const pub = await chamar(idx.publicarFotoDaTurma, AUX1, {
    tioUid: TIO_A, publico: 'familias', criancas: ['c1'], epoca: 'Natal', legenda: 'Festa na escola', caminho: origem, todasMarcadas: true,
  });
  verdade('a foto é publicada e devolve o id', pub.id);
  const foto = await lerDoc(`fotosDaTurma/${pub.id}`);
  checar('a foto é do tio A', TIO_A, foto.adminUid);
  checar('o documento da família leva só o primeiro nome dela', 'Cida', foto.postadaPorNome);
  checar('o documento da família NÃO tem o campo postadaPor', false, 'postadaPor' in foto);
  verdade('o uid dela não aparece em lugar nenhum do documento', !JSON.stringify(foto).includes(AUX1));
  const autoria = await lerDoc(`autoriaDaFotoDaTurma/${pub.id}`);
  checar('a autoria guarda o uid dela e o tio', [AUX1, TIO_A], [autoria?.postadaPor, autoria?.adminUid]);
  checar('o arquivo foi para a pasta do tio', `fotosDaTurma/${TIO_A}/fotoabc123.jpg`, foto.caminho);
  checar('o arquivo existe na pasta do tio', true, (await bucket.file(foto.caminho).exists())[0]);
  checar('o original saiu da pasta dela', false, (await bucket.file(origem).exists())[0]);
  checar('a mãe recebeu o aviso da foto', 1, (await avisosDe(MAE)).filter((n) => /foto/i.test(n.type || '')).length);

  checar('ela vê a foto que postou', [pub.id], (await chamar(idx.minhasFotosDaTurma, AUX1, {})).fotos.map((f) => f.id));
  checar('a outra auxiliar não vê a foto dela', [], (await chamar(idx.minhasFotosDaTurma, AUX2, {})).fotos);
  checar('a outra auxiliar não apaga a foto', 'not-found', (await recusa(idx.apagarFotoDaTurma, AUX2, { id: pub.id })).code);
  verdade('a foto continua no ar', await lerDoc(`fotosDaTurma/${pub.id}`));

  const origem2 = `fotosDaTurma/${AUX1}/fotoabc456.jpg`;
  await bucket.file(origem2).save(jpeg, { contentType: 'image/jpeg' });
  checar('criança sem o "sim" da família recusa a foto', 'failed-precondition',
    (await recusa(idx.publicarFotoDaTurma, AUX1, { tioUid: TIO_A, publico: 'familias', criancas: ['c2'], epoca: 'Natal', caminho: origem2, todasMarcadas: true })).code);
  checar('para os tios parceiros a auxiliar não posta', 'permission-denied',
    (await recusa(idx.publicarFotoDaTurma, AUX1, { tioUid: TIO_A, publico: 'parceiros', criancas: [], epoca: 'Natal', caminho: origem2, semCrianca: true })).code);
  checar('quem não tem vínculo ativo com o tio não posta', 'permission-denied',
    (await recusa(idx.publicarFotoDaTurma, AUX4, { tioUid: TIO_A, publico: 'familias', criancas: [], epoca: 'Natal', caminho: `fotosDaTurma/${AUX4}/fotoabc789.jpg`, semCrianca: true })).code);

  await chamar(idx.apagarFotoDaTurma, AUX1, { id: pub.id });
  checar('ela apaga a dela: o documento some', null, await lerDoc(`fotosDaTurma/${pub.id}`));
  checar('ela apaga a dela: a autoria some', null, await lerDoc(`autoriaDaFotoDaTurma/${pub.id}`));
  checar('ela apaga a dela: o arquivo some', false, (await bucket.file(foto.caminho).exists())[0]);

  // ── 8. AVALIAÇÕES ──────────────────────────────────────────────────────
  bloco('8. Recomendação do tio e estrelas dela');
  const pontos = ['pontual', 'gentil'];
  checar('com menos de 30 dias de vínculo, não recomenda', 'failed-precondition', (await recusa(idx.recomendarAuxiliar, TIO_A, { auxiliarUid: AUX1, pontos, frase: 'Ótima' })).code);
  await db.doc(`auxiliares/${TIO_A}_${AUX1}`).update({ periodos: [{ de: Timestamp.fromMillis(Date.now() - 40 * DIA), ate: null }] });
  for (const [rotulo, frase] of [
    ['telefone', 'Me liga no 11 98765-4321'],
    ['link', 'Veja www.exemplo.com.br'],
    ['e-mail', 'fale cida@exemplo.com'],
    ['nome de criança da turma', 'Cuida muito bem do Lucas'],
    ['promessa de segurança', 'Perua segura e garantida'],
  ]) {
    checar(`frase com ${rotulo} é recusada`, 'invalid-argument', (await recusa(idx.recomendarAuxiliar, TIO_A, { auxiliarUid: AUX1, pontos, frase })).code);
  }
  checar('mais de 3 pontos fortes é recusado', 'invalid-argument', (await recusa(idx.recomendarAuxiliar, TIO_A, { auxiliarUid: AUX1, pontos: ['pontual', 'gentil', 'paciente', 'organizada'], frase: '' })).code);
  checar('sem vínculo no par, não recomenda', 'permission-denied', (await recusa(idx.recomendarAuxiliar, TIO_B, { auxiliarUid: AUX2, pontos, frase: '' })).code);
  checar('o tio B, com o vínculo novo (menos de 30 dias), também não', 'failed-precondition', (await recusa(idx.recomendarAuxiliar, TIO_B, { auxiliarUid: AUX1, pontos, frase: '' })).code);

  await chamar(idx.recomendarAuxiliar, TIO_A, { auxiliarUid: AUX1, pontos, frase: 'Sempre chega no horário' });
  const rec = await lerDoc(`recomendacoesDeAuxiliar/${TIO_A}_${AUX1}`);
  checar('a recomendação nasce pendente', 'pendente', rec.estado);
  verdade('a recomendação é assinada com a marca do tio', /Tio Nino/.test(JSON.stringify(rec)));
  checar('ela é avisada da recomendação', 1, (await avisosDe(AUX1, 'recomendacao_recebida')).length);
  checar('o tio não responde pela auxiliar', 'permission-denied', (await recusa(idx.responderRecomendacao, TIO_A, { motoristaUid: TIO_A, acao: 'aprovar' })).code);
  checar('ação desconhecida é recusada', 'invalid-argument', (await recusa(idx.responderRecomendacao, AUX1, { motoristaUid: TIO_A, acao: 'publicar' })).code);
  await chamar(idx.responderRecomendacao, AUX1, { motoristaUid: TIO_A, acao: 'aprovar' });
  const rec2 = await lerDoc(`recomendacoesDeAuxiliar/${TIO_A}_${AUX1}`);
  checar('ela aprova: mostrar', 'aprovada', rec2.estado);
  verdade('aprovar grava a data de aprovação', rec2.aprovadaEm);
  await chamar(idx.recomendarAuxiliar, TIO_A, { auxiliarUid: AUX1, pontos, frase: 'Sempre chega no horário!' });
  checar('editar a recomendação volta a pendente', 'pendente', (await lerDoc(`recomendacoesDeAuxiliar/${TIO_A}_${AUX1}`)).estado);

  checar('estrelas fora de 1 a 5 são recusadas', 'invalid-argument', (await recusa(idx.avaliarTio, AUX1, { motoristaUid: TIO_A, estrelas: 6 })).code);
  checar('quem nunca trabalhou com o tio não o avalia', 'permission-denied', (await recusa(idx.avaliarTio, AUX4, { motoristaUid: TIO_A, estrelas: 5 })).code);
  checar('o tio não dá estrelas (só a auxiliar)', 'permission-denied', (await recusa(idx.avaliarTio, TIO_B, { motoristaUid: TIO_A, estrelas: 5 })).code);
  await chamar(idx.avaliarTio, AUX1, { motoristaUid: TIO_A, estrelas: 5 });
  checar('com 1 auxiliar, o tio não vê média', { respostas: 1, media: null }, await chamar(idx.minhaNotaDasAuxiliares, TIO_A, {}));
  await chamar(idx.avaliarTio, AUX2, { motoristaUid: TIO_A, estrelas: 4 });
  checar('com 2 auxiliares, ainda sem média', { respostas: 2, media: null }, await chamar(idx.minhaNotaDasAuxiliares, TIO_A, {}));
  // A terceira trabalhou com ele e já saiu: vínculo semeado, inativo.
  await db.doc(`users/${AUX3}`).set({ role: 'auxiliar', name: 'Eva', motoristaUids: [] });
  await db.doc(`auxiliares/${TIO_A}_${AUX3}`).set({
    motoristaUid: TIO_A, auxiliarUid: AUX3, nome: 'Eva', ativa: false,
    periodos: [{ de: Timestamp.fromMillis(Date.now() - 90 * DIA), ate: Timestamp.fromMillis(Date.now() - 60 * DIA) }],
  });
  await chamar(idx.avaliarTio, AUX3, { motoristaUid: TIO_A, estrelas: 3 });
  checar('com 3 auxiliares diferentes, a média aparece', { respostas: 3, media: 4 }, await chamar(idx.minhaNotaDasAuxiliares, TIO_A, {}));
  await chamar(idx.avaliarTio, AUX3, { motoristaUid: TIO_A, estrelas: 3 });
  checar('avaliar duas vezes não conta duas auxiliares', 3, (await chamar(idx.minhaNotaDasAuxiliares, TIO_A, {})).respostas);

  // ── 9. DESATIVAR E RECONTRATAR ─────────────────────────────────────────
  bloco('9. Desativar e recontratar');
  checar('o tio B não desativa a auxiliar do tio A', 'permission-denied', (await recusa(idx.desativarAuxiliar, TIO_B, { auxiliarUid: AUX2 })).code);
  await chamar(idx.desativarAuxiliar, TIO_A, { auxiliarUid: AUX2 });
  verdade('desativada, a Rita sai do tio A', !(await lerDoc(`users/${AUX2}`)).motoristaUids.includes(TIO_A));
  verdade('com uma ativa sobrando, a cópia da turma fica', (await lerDoc(`turmaDaAuxiliar/${TIO_A}`))?.ativa === true);
  checar('a auxiliar desativada não marca parada', 'permission-denied', (await recusa(idx.marcarParadaPelaAuxiliar, AUX2, { childId: 'c2', proximo: 'onboard', motoristaUid: TIO_A })).code);

  const antes = await lerDoc(`auxiliares/${TIO_A}_${AUX1}`);
  await chamar(idx.desativarAuxiliar, TIO_A, { auxiliarUid: AUX1 });
  const dep = await lerDoc(`auxiliares/${TIO_A}_${AUX1}`);
  checar('o vínculo fica, inativo, com a data do encerramento', [false, true], [dep.ativa, !!dep.encerradoEm]);
  verdade('o período é fechado, não apagado', dep.periodos.length === 1 && dep.periodos[0].ate != null);
  checar('o tio A sai de motoristaUids; o B continua', [TIO_B], (await lerDoc(`users/${AUX1}`)).motoristaUids);
  checar('o vínculo do tio B segue ativo', true, (await lerDoc(`auxiliares/${TIO_B}_${AUX1}`)).ativa);
  checar('sem auxiliar ativa, a cópia da turma some (raiz)', null, await lerDoc(`turmaDaAuxiliar/${TIO_A}`));
  checar('sem auxiliar ativa, a cópia da turma some (crianças)', 0, (await db.collection(`turmaDaAuxiliar/${TIO_A}/criancas`).get()).size);
  checar('sem auxiliar ativa, a cópia da turma some (faltas)', 0, (await db.collection(`turmaDaAuxiliar/${TIO_A}/faltas`).get()).size);
  checar('a conta dela continua existindo e é auxiliar', 'auxiliar', (await lerDoc(`users/${AUX1}`)).role);
  verdade('o recibo do pagamento dela continua', await lerDoc(`pagamentosDaAuxiliar/${idRecibo}`));
  checar('desativar de novo não quebra', { ok: true }, await chamar(idx.desativarAuxiliar, TIO_A, { auxiliarUid: AUX1 }));
  verdade('a recomendação sobrevive à desativação', await lerDoc(`recomendacoesDeAuxiliar/${TIO_A}_${AUX1}`));

  const cNovo = await chamar(idx.convidarAuxiliar, TIO_A, { nome: 'Cida Alves', telefone: '11988881111', valorMensal: 1000 });
  await chamar(idx.aceitarConviteDeAuxiliar, AUX1, { codigo: cNovo.codigo });
  const re = await lerDoc(`auxiliares/${TIO_A}_${AUX1}`);
  checar('recontratar reabre o MESMO documento', true, re.ativa);
  checar('o histórico fica: dois períodos', 2, re.periodos.length);
  checar('o período antigo continua fechado, o novo aberto', [true, true], [re.periodos[0].ate != null, re.periodos[1].ate == null]);
  checar('o primeiro aceite não é reescrito', antes.aceitoEm.toMillis(), re.aceitoEm.toMillis());
  checar('os termos novos valem (valor do novo convite)', 1000, re.valorMensal);
  checar('o tio A volta a motoristaUids', [TIO_A, TIO_B], [...(await lerDoc(`users/${AUX1}`)).motoristaUids].sort());
  checar('a cópia da turma volta com as crianças', 'Lucas Pereira', (await lerDoc(`turmaDaAuxiliar/${TIO_A}/criancas/c1`))?.name);
}

try {
  await main();
} catch (e) {
  bad += 1;
  falhas.push(`A JORNADA PAROU NO MEIO: ${e.stack || e}`);
  console.log(` FALHA a jornada parou no meio: ${e.stack || e}`);
}

console.log('');
console.log(`${ok} passaram, ${bad} falharam`);
if (bad) {
  console.log('');
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
process.exit(0);
