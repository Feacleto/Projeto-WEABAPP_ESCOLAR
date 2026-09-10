/**
 * OS DOIS AGENDADOS QUE ESCREVEM NA CAIXA DAS PESSOAS, CONTRA O EMULADOR.
 *
 * ── ⚠️ POR QUE ESTE ARQUIVO EXISTE
 * `testar-avisos.mjs` e `testar-avisos-do-dia.mjs` provam as RÉGUAS: dada uma
 * pessoa e uma data, qual peça cabe. São bons e cobrem muito.
 *
 * O que nenhum dos dois alcança é o que acontece quando os DOIS rodam na
 * mesma base, na mesma manhã — que é a situação real, e era exatamente onde
 * estava o defeito:
 *
 *   - até 10/09/2026 os dois rodavam às 9h e nenhum sabia do outro. O mesmo
 *     motorista recebia "sua fatura vence em 3 dias" e "traga um colega" no
 *     mesmo minuto, e nada acusava, porque cada régua estava certa sozinha;
 *   - o conserto foi o operacional carimbar `ultimoAvisoOperacional` e a
 *     oferta ceder — o que **só funciona se os carimbos forem escritos e
 *     lidos de verdade**, na ordem certa, no banco.
 *
 * Isso é integração pura: nenhuma função sozinha erra. Só a dupla erra, e só
 * escrevendo dá para ver.
 *
 * ── E O GUARDA SEMANAL TAMBÉM SÓ EXISTE NO BANCO
 * `avisoParaEnviar` lê `users.ultimoAvisoComercial`, e quem grava esse campo é
 * `enviarAvisos` depois de escrever a notificação. Rodar duas vezes seguidas
 * tem que produzir UMA peça — e essa é uma afirmação sobre o efeito colateral,
 * não sobre a régua.
 *
 * ── COMO RODAR
 *   firebase emulators:exec --only firestore "node scripts/testar-envio.mjs"
 *
 * ⚠️ Fora da bateria padrão, como `testar-fechamento`: precisa do emulador e
 * importa o Admin SDK de `functions/node_modules`.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const { enviarAvisos } = require('../functions/lib/enviarAvisos.js');
const { enviarAvisosDoDia } = require('../functions/lib/enviarAvisosDoDia.js');

const PID = 'alobuzinou-be81f';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
}
admin.initializeApp({ projectId: PID });
const db = admin.firestore();

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

function bloco(t) {
  console.log('');
  console.log(`\x1b[1m${t}\x1b[0m`);
}

async function limpar() {
  for (const col of ['users', 'notifications', 'faturasParceiro', 'children', 'payments']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

/**
 * ⚠️ DATAS FIXAS, NÃO RELATIVAS AO RELÓGIO DE QUEM RODA.
 *
 * A primeira versão usava `Date.now() - 86400000` para "ontem" e o teste
 * falhava ou passava conforme a HORA em que era executado: rodando às 18h,
 * "ontem às 18h" contra "hoje às 10h" dá 16 horas, e `diasDesde` devolve 0 —
 * o motorista não estava no dia 1 do teste e a régua calava, corretamente.
 *
 * Teste que depende da hora do dia é teste que vai falhar sozinho numa
 * madrugada e ninguém vai saber por quê.
 */
const AGORA = new Date(2026, 8, 15, 10, 0, 0); // 15/set, 10h — fora do silêncio
const AS_NOVE = new Date(2026, 8, 15, 9, 0, 0);
const AS_SETE = new Date(2026, 8, 15, 7, 0, 0); // dentro do silêncio da manhã

/** `n` dias a partir de AGORA, ao meio-dia — longe de qualquer virada. */
const DIAS = (n) => new Date(2026, 8, 15 + n, 12, 0, 0);

/** O instante que põe o motorista no DIA 1 do teste às 10h de AGORA. */
const INICIO_DIA_1 = new Date(2026, 8, 14, 5, 0, 0);

/** As notificações que chegaram para alguém, por tipo. */
async function tiposDe(uid) {
  const snap = await db.collection('notifications').where('userId', '==', uid).get();
  return snap.docs.map((d) => d.data().type).sort();
}

// Um motorista no dia 1 do teste recebe a peça "seu teste começou".
const NO_DIA_1 = (extra = {}) => ({
  role: 'admin',
  criancasAtivas: 20,
  trialInicio: INICIO_DIA_1,
  ...extra,
});

async function main() {
  bloco('1. A peça comercial é escrita, e com o que o push precisa');
  await limpar();
  await db.doc('users/tio1').set(NO_DIA_1());

  const r1 = await enviarAvisos(db, { agora: AGORA });
  checar('um aviso saiu', 1, r1.enviados);

  const snap = await db.collection('notifications').where('userId', '==', 'tio1').get();
  checar('e virou exatamente um documento', 1, snap.size);
  const n = snap.docs[0].data();
  checar('do tipo do teste que começou', 'comercial_teste_comecou', n.type);
  // ⚠️ `title` é obrigatório pelas rules E `push.js` desiste sem ele: um
  // aviso sem título seria gravado e nunca entregue.
  checar('com título', true, Boolean(n.title));
  checar('com corpo', true, Boolean(n.body));
  // O texto longo fica no sino, para quem toca no push.
  checar('com o texto longo', true, String(n.texto || '').length > 100);
  checar('e com destino, senão o push abre o app na home', '/tio/planos', n.destino);
  checar('nasce não lida', false, n.read);

  bloco('2. O guarda semanal só existe porque o carimbo é gravado');
  // `avisoParaEnviar` lê `users.ultimoAvisoComercial`, e quem o grava é o
  // próprio `enviarAvisos`, depois de escrever. Rodar de novo no mesmo dia
  // tem que produzir NADA.
  const marca = (await db.doc('users/tio1').get()).data().ultimoAvisoComercial;
  checar('o carimbo foi gravado', true, Boolean(marca));

  const r2 = await enviarAvisos(db, { agora: AGORA });
  checar('a segunda passada cala', 0, r2.enviados);
  checar('e ele conta como calado', 1, r2.calados);
  checar('nenhum documento novo', 1,
    (await db.collection('notifications').where('userId', '==', 'tio1').get()).size);

  bloco('3. A janela de silêncio vale no banco, não só no cron');
  await limpar();
  await db.doc('users/tio2').set(NO_DIA_1());
  const r3 = await enviarAvisos(db, { agora: AS_SETE });
  checar('nada sai às 7h — ele está dirigindo com criança dentro', 0, r3.enviados);
  checar('e nada foi escrito', 0, (await db.collection('notifications').get()).size);

  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ O BLOCO QUE JUSTIFICA O ARQUIVO.
  //
  // Nenhuma das duas réguas erra sozinha. A colisão só existe quando as duas
  // escrevem na mesma base, e só o carimbo — escrito por uma, lido pela
  // outra — a resolve.
  bloco('4. A oferta cede ao operacional no mesmo dia');
  await limpar();

  // Um motorista que tem as DUAS coisas hoje: uma fatura vencendo em 3 dias
  // (operacional) e o dia 1 do teste (oferta).
  await db.doc('users/tio3').set(NO_DIA_1());
  await db.doc('faturasParceiro/tio3_2026-08').set({
    status: 'aberta',
    total: 82.6,
    mes: '2026-08',
    vencimento: DIAS(3),
  });

  // O operacional roda às 9h e carimba.
  await enviarAvisosDoDia(db, { agora: AS_NOVE });

  const depoisDoOperacional = await tiposDe('tio3');
  checar('o operacional escreveu o aviso da fatura', ['fatura_vence'], depoisDoOperacional);
  checar('e carimbou o motorista', true,
    Boolean((await db.doc('users/tio3').get()).data().ultimoAvisoOperacional));

  // O comercial roda às 10h e encontra o carimbo de hoje.
  const r4 = await enviarAvisos(db, { agora: AGORA });
  checar('a oferta cala no mesmo dia', 0, r4.enviados);
  checar('e a caixa dele tem só o aviso obrigatório', ['fatura_vence'], await tiposDe('tio3'));

  bloco('5. Sem operacional no dia, a oferta sai normalmente');
  await limpar();
  // A prova de que o bloco acima não passou por a oferta estar sempre calada.
  await db.doc('users/tio4').set(NO_DIA_1());
  await enviarAvisosDoDia(db, { agora: AS_NOVE });
  checar('o operacional não teve o que dizer', [], await tiposDe('tio4'));

  const r5 = await enviarAvisos(db, { agora: AGORA });
  checar('e aí a oferta sai', 1, r5.enviados);
  checar('a caixa tem a peça comercial', ['comercial_teste_comecou'], await tiposDe('tio4'));

  bloco('6. O carimbo de ONTEM não cala a oferta de hoje');
  await limpar();
  // ⚠️ O CASO QUE PEGOU O BUG. Com o carimbo em timestamp e a comparação em
  // `diasDesde(...) === 0`, "ontem ao meio-dia" contra "hoje às 10h" dá 22
  // horas — zero dias — e a oferta era calada num dia em que o operacional
  // não falou nada. O carimbo virou 'AAAA-MM-DD' e a comparação virou de
  // data, que é o que a frase "cede no mesmo dia" sempre quis dizer.
  await db.doc('users/tio5').set(NO_DIA_1({ ultimoAvisoOperacional: '2026-09-14' }));
  const r6 = await enviarAvisos(db, { agora: AGORA });
  checar('a oferta sai', 1, r6.enviados);

  bloco('7. A mensalidade da família NÃO carimba o motorista');
  await limpar();
  // Ela passa pela mesma função de entrega e não pode calar a oferta dele:
  // é um aviso que foi para OUTRA pessoa.
  await db.doc('users/tio6').set(NO_DIA_1());
  await db.doc('users/mae').set({ role: 'parent', adminUid: 'tio6' });
  await db.doc('payments/p1').set({
    status: 'pending',
    parentUid: 'mae',
    adminUid: 'tio6',
    childName: 'Lucas Silva',
    amount: 250,
    month: '2026-09',
    dueDate: DIAS(5),
  });

  await enviarAvisosDoDia(db, { agora: AS_NOVE });
  checar('a mãe recebeu o lembrete', ['payment_due_5d'], await tiposDe('mae'));
  checar('o motorista NÃO foi carimbado', undefined,
    (await db.doc('users/tio6').get()).data().ultimoAvisoOperacional);

  const r7 = await enviarAvisos(db, { agora: AGORA });
  checar('e a oferta dele sai normalmente', 1, r7.enviados);

  bloco('8. Um marco de e-mail não vira push');
  await limpar();
  // 3 dias antes é do e-mail — ver `canalDaCobranca.js`. Aqui é o efeito no
  // banco: a família não recebe documento nenhum naquele dia.
  await db.doc('users/mae2').set({ role: 'parent', adminUid: 'tio7' });
  await db.doc('payments/p2').set({
    status: 'pending',
    parentUid: 'mae2',
    adminUid: 'tio7',
    childName: 'Ana Souza',
    amount: 250,
    month: '2026-09',
    dueDate: DIAS(3),
  });
  await enviarAvisosDoDia(db, { agora: AS_NOVE });
  checar('nenhum push a 3 dias do vencimento', [], await tiposDe('mae2'));

  // Sonda positiva: no dia do vencimento, que é do push, ele sai.
  await db.doc('payments/p2').update({ dueDate: DIAS(0) });
  await enviarAvisosDoDia(db, { agora: AS_NOVE });
  checar('mas no dia do vencimento sai', ['payment_due_0d'], await tiposDe('mae2'));

  bloco('9. Um documento malformado não derruba a varredura');
  await limpar();
  // Sem o try por parceiro, um documento quebrado no meio da base deixaria
  // todo mundo depois dele sem aviso — e o sintoma seria "a campanha não
  // saiu", sem dizer para quem.
  await db.doc('users/aaa_quebrado').set({ role: 'admin', trialInicio: 'não é data' });
  await db.doc('users/zzz_ok').set(NO_DIA_1());
  const r9 = await enviarAvisos(db, { agora: AGORA });
  checar('quem estava em ordem recebeu', 1, r9.enviados);
  checar('e a caixa dele tem a peça', ['comercial_teste_comecou'], await tiposDe('zzz_ok'));

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${ok} passaram, ${bad} falharam`);
  if (falhas.length) {
    console.log('─'.repeat(64));
    falhas.forEach((f) => console.log('  ✗ ' + f));
  }
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\n' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
