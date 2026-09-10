/**
 * O FECHAMENTO DO MÊS, CONTRA O EMULADOR — o teste que faltava.
 *
 * ── ⚠️ POR QUE ESTE ARQUIVO EXISTE
 * Todo o resto da bateria prova RÉGUA: funções puras, sem banco, comparadas
 * entre o app e o servidor. É a aposta central do projeto e ela é boa — mas
 * ela não alcança a única coisa que `fechamento.js` faz de verdade, que é
 * **escrever**.
 *
 * E `fecharMes` é a peça de maior raio de dano do sistema inteiro:
 *
 *   - ela emite a fatura de TODO motorista, uma vez por mês;
 *   - desde 10/09/2026 ela reconcilia `indicacoesAtivas` ANTES de cobrar, o
 *     que significa que um erro ali cobra a base inteira errado, em silêncio;
 *   - e ela nasceu nesta mesma série de mudanças. Até este arquivo existir,
 *     a primeira execução dela seria em produção, no dia 1, às 5 da manhã.
 *
 * "Nunca rodou" não é um risco abstrato neste projeto: a bateria já esteve
 * partida no meio do CI sem ninguém ver, e o `testar:imports` nasceu disso.
 *
 * ── O QUE ELE MEDE, E O QUE NÃO MEDE
 * Ele roda `fecharMes` de verdade contra o Firestore do emulador, com o mesmo
 * Admin SDK que roda em produção, e depois LÊ os documentos para conferir o
 * que ficou gravado. Não mede push, não mede Asaas, não mede as rules — o
 * Admin SDK as ignora de propósito, e quem cobre rules é `testar-regras.mjs`.
 *
 * ── COMO RODAR
 *   firebase emulators:exec --only firestore "node scripts/testar-fechamento.mjs"
 *
 * ⚠️ FORA DA BATERIA PADRÃO, como `testar-regras` e `testar-storage`: precisa
 * do emulador, e importa o Admin SDK de `functions/node_modules` — que é
 * exatamente o que `testar:imports` proíbe nos scripts encadeados.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// ⚠️ CAMINHO EXPLÍCITO. `firebase-admin` só existe em `functions/node_modules`,
// que não é alcançado pela resolução normal a partir de `scripts/`. É a mesma
// separação que faz o CI rodar um `npm ci` só na raiz — e o motivo de este
// arquivo não poder entrar na bateria encadeada.
const admin = require('../functions/node_modules/firebase-admin/lib/index.js');
const { fecharMes } = require('../functions/lib/fechamento.js');

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

/** Apaga tudo o que os cenários criam, para cada bloco começar limpo. */
async function limpar() {
  for (const col of ['users', 'faturasParceiro', 'indicacoes', 'taxaConfig']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

const DIAS = (n) => new Date(Date.now() + n * 86400000);

async function semear(uid, dados) {
  await db.doc(`users/${uid}`).set({ role: 'admin', ...dados });
}

async function fatura(uid, mes) {
  const s = await db.doc(`faturasParceiro/${uid}_${mes}`).get();
  return s.exists ? s.data() : null;
}

const MES = '2026-08';
const AGORA = new Date(2026, 8, 1, 5, 0, 0); // 1 de setembro, 5h

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  bloco('1. A fatura de quem contratou sai com a conta certa');
  await limpar();

  // 20 crianças, mensal, 30% travado. Teste terminado há muito.
  await semear('tio_pagante', {
    plano: 'mensal',
    criancasAtivas: 20,
    trialInicio: DIAS(-400),
    descontos: [{ origem: 'fechamento', fracao: 0.3, ate: null }],
  });

  const r1 = await fecharMes(db, { mes: MES, agora: AGORA });
  checar('fechou uma', 1, r1.fechadas);

  const f = await fatura('tio_pagante', MES);
  checar('a fatura existe', true, f !== null);
  checar('e o total é o preço com desconto', 82.6, f.total);
  checar('o preço de tabela vai junto, para a linha se explicar', 118, f.precoTabela);
  checar('o desconto de fechamento está registrado', 0.3, f.descontoFechamento);
  checar('e ela nasce aberta', 'aberta', f.status);
  checar('com o número de crianças congelado', 20, f.criancas);
  // ⚠️ A CONTA ABERTA VIAJA NA FATURA, e é ela que a tela imprime linha a
  // linha: guardar só o total transformaria cada fatura numa pergunta.
  checar('e a taxa por criança daquele mês também', 5.9, f.taxaPorCrianca);

  // ⚠️ IDEMPOTÊNCIA. O dono pode disparar `fecharMesAgora` no mesmo dia em que
  // a agendada rodou. Refechar reescreveria `total` sobre uma fatura que
  // talvez já tenha sido paga, e `status` voltaria a 'aberta' num mês quitado.
  // ⚠️ O CAMPO QUE FALTAVA, E O TESTE QUE NÃO O PEGOU.
  //
  // `TioTaxa` monta o BR Code a partir de `pixKey`/`pixKeyType`/
  // `nomePlataforma`/`cidadePlataforma` DA FATURA. A cópia do cliente sempre
  // os gravou; esta, que nasceu quando o fechamento virou agendada, não —
  // então toda fatura do caminho normal chegava sem como pagar, e a tela
  // dizia "a plataforma ainda não cadastrou a chave PIX".
  //
  // A primeira versão deste teste conferia seis campos escolhidos a dedo e
  // passou verde por cima do buraco. **Conferir a LISTA de campos, e não
  // valores escolhidos, é o que pega o próximo campo esquecido.**
  const ESPERADOS = [
    'tioUid', 'mes', 'plano', 'planoRotulo', 'criancas', 'taxaPorCrianca',
    'precoTabela', 'planoContratado', 'descontoTotal', 'descontoFundador',
    'descontoFechamento', 'descontoIndicacao', 'descontoConcessao',
    'pisoAplicado', 'descontoAbsorvido', 'isento', 'motivoIsencao',
    'mesDeTeste', 'testeAte', 'total', 'vencimento', 'diaVencimento',
    'pixKey', 'pixKeyType', 'nomePlataforma', 'cidadePlataforma',
    'status', 'lancadaPor', 'lancadaEm',
  ].sort();
  checar('a fatura tem exatamente os campos que as telas leem',
    ESPERADOS, Object.keys(f).sort());

  bloco('2. Rodar duas vezes não refaz a fatura');
  await db.doc(`faturasParceiro/tio_pagante_${MES}`).update({ status: 'quitada' });
  const r2 = await fecharMes(db, { mes: MES, agora: AGORA });
  checar('a segunda passada pula', 1, r2.puladas);
  checar('e nada foi fechado de novo', 0, r2.fechadas);
  checar('a fatura quitada continua quitada', 'quitada',
    (await fatura('tio_pagante', MES)).status);

  bloco('3. Quem está no teste recebe fatura ISENTA, não deixa de receber');
  await limpar();
  // A fatura do teste existe para ele aprender a conta antes de ela custar.
  await semear('tio_testando', { criancasAtivas: 12, trialInicio: DIAS(-30) });

  await fecharMes(db, { mes: MES, agora: AGORA });
  const fi = await fatura('tio_testando', MES);
  checar('a fatura do teste existe', true, fi !== null);
  checar('e ela é isenta', true, fi.isento);
  checar('com total zero', 0, fi.total);
  // ⚠️ O preço CHEIO fica visível: é o que ele aprende a conferir.
  checar('mas o preço de tabela mostra quanto custaria', 70.8, fi.precoTabela);
  checar('e ela diz que o plano não foi escolhido', false, fi.planoContratado);

  bloco('4. Suspenso não é cobrado');
  await limpar();
  await semear('tio_suspenso', {
    plano: 'mensal', criancasAtivas: 10, suspenso: true, trialInicio: DIAS(-400),
  });
  const r4 = await fecharMes(db, { mes: MES, agora: AGORA });
  checar('nada foi fechado', 0, r4.fechadas);
  checar('e ele foi pulado', 1, r4.puladas);
  checar('não há fatura dele', null, await fatura('tio_suspenso', MES));

  bloco('5. Um parceiro que falha não derruba a varredura');
  await limpar();
  // Fora do teste e SEM plano: `fecharFaturaDe` lança. Quem vier depois dele
  // na varredura não pode ficar sem fatura por causa disso.
  await semear('aaa_quebrado', { criancasAtivas: 5, trialInicio: DIAS(-400) });
  await semear('zzz_ok', { plano: 'mensal', criancasAtivas: 10, trialInicio: DIAS(-400) });

  const r5 = await fecharMes(db, { mes: MES, agora: AGORA });
  checar('um deu erro', 1, r5.erros);
  checar('e o seguinte fechou assim mesmo', 1, r5.fechadas);
  checar('a fatura de quem estava em ordem existe', 59, (await fatura('zzz_ok', MES)).total);

  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ O BLOCO QUE JUSTIFICA O ARQUIVO INTEIRO.
  //
  // A reconciliação das indicações roda ANTES de emitir as faturas, porque
  // `fecharFaturaDe` lê `indicacoesAtivas` — reconciliar depois gravaria o
  // número velho num documento já entregue. Nada disso é visível numa régua
  // pura: é ordem de escrita, e só um teste que escreve consegue vê-la.
  bloco('6. A reconciliação corre ANTES da cobrança, e a fatura usa o número novo');
  await limpar();

  await semear('indicador', {
    plano: 'mensal',
    criancasAtivas: 20,
    trialInicio: DIAS(-400),
    indicacoesAtivas: 3, // o número VELHO, que a reconciliação deve derrubar
  });
  // Dois indicados: um ainda pagante, outro que saiu (sem plano).
  await semear('indicado_paga', { plano: 'mensal', criancasAtivas: 8, trialInicio: DIAS(-400) });
  await semear('indicado_saiu', { criancasAtivas: 8, trialInicio: DIAS(-400) });

  await db.doc('indicacoes/i1').set({
    indicadorUid: 'indicador', indicadoUid: 'indicado_paga', estado: 'ativa', chave: '11900000001',
  });
  await db.doc('indicacoes/i2').set({
    indicadorUid: 'indicador', indicadoUid: 'indicado_saiu', estado: 'ativa', chave: '11900000002',
  });

  await fecharMes(db, { mes: MES, agora: AGORA });

  const dep = (await db.doc('users/indicador').get()).data();
  checar('o contador foi recontado para o número real', 1, dep.indicacoesAtivas);
  checar('a indicação de quem saiu foi encerrada', 'encerrada',
    (await db.doc('indicacoes/i2').get()).data().estado);
  checar('e a de quem paga continua ativa', 'ativa',
    (await db.doc('indicacoes/i1').get()).data().estado);

  // ⚠️ E A FATURA DO MÊS JÁ USA O NÚMERO NOVO. Com o contador velho (3) o
  // desconto seria 15% e o total R$ 100,30. Com o novo (1), 5% e R$ 112,10.
  // Esta linha é a que prova a ORDEM.
  checar('a fatura cobrou com a contagem reconciliada', 112.1,
    (await fatura('indicador', MES)).total);
  checar('e a linha da indicação registra os 5%', 0.05,
    (await fatura('indicador', MES)).descontoIndicacao);

  bloco('7. Quem perdeu a última indicação é zerado, não esquecido');
  await limpar();
  // Sem uma entrada explícita para o zero, o gravador nunca aprenderia a
  // zerar ninguém e o contador ficaria parado no valor antigo — o mesmo bug
  // que a reconciliação veio fechar, voltando pela porta da escrita.
  await semear('so_tinha_uma', {
    plano: 'mensal', criancasAtivas: 20, trialInicio: DIAS(-400), indicacoesAtivas: 1,
  });
  await semear('o_que_saiu', { criancasAtivas: 8, trialInicio: DIAS(-400) });
  await db.doc('indicacoes/i3').set({
    indicadorUid: 'so_tinha_uma', indicadoUid: 'o_que_saiu', estado: 'ativa', chave: '11900000003',
  });

  await fecharMes(db, { mes: MES, agora: AGORA });
  checar('o contador foi a zero', 0,
    (await db.doc('users/so_tinha_uma').get()).data().indicacoesAtivas);
  checar('e a fatura veio sem desconto de indicação', 118,
    (await fatura('so_tinha_uma', MES)).total);

  bloco('8. A indicação volta a valer se o colega voltar a pagar');
  // Reversível de propósito: o desconto acompanha o valor que existe hoje,
  // não a idade do ato.
  await db.doc('users/o_que_saiu').update({ plano: 'mensal' });
  await db.doc(`faturasParceiro/so_tinha_uma_${MES}`).delete();
  await fecharMes(db, { mes: MES, agora: AGORA });
  checar('a encerrada foi reaberta', 'ativa',
    (await db.doc('indicacoes/i3').get()).data().estado);
  checar('e o contador subiu de volta', 1,
    (await db.doc('users/so_tinha_uma').get()).data().indicacoesAtivas);

  bloco('9. Atraso não derruba a indicação — sair derruba');
  await limpar();
  // O critério é grosso de propósito: tem plano e não está suspenso. Com o
  // estado fino da conta, o desconto piscaria de mês em mês por uma fatura
  // atrasada, e desconto que oscila é tão ruim de explicar quanto um que não
  // cai.
  await semear('ind2', {
    plano: 'mensal', criancasAtivas: 20, trialInicio: DIAS(-400), indicacoesAtivas: 1,
  });
  await semear('atrasado', {
    plano: 'mensal', criancasAtivas: 8, trialInicio: DIAS(-400),
    assinaturaAte: DIAS(-60), // vencido há dois meses, mas NÃO suspenso
  });
  await db.doc('indicacoes/i4').set({
    indicadorUid: 'ind2', indicadoUid: 'atrasado', estado: 'ativa', chave: '11900000004',
  });

  await fecharMes(db, { mes: MES, agora: AGORA });
  checar('a indicação do atrasado continua ativa', 'ativa',
    (await db.doc('indicacoes/i4').get()).data().estado);
  checar('e o contador se mantém', 1,
    (await db.doc('users/ind2').get()).data().indicacoesAtivas);

  // Já o suspenso deixa de contar: quem suspendeu foi a plataforma.
  await db.doc('users/atrasado').update({ suspenso: true });
  await db.doc(`faturasParceiro/ind2_${MES}`).delete();
  await fecharMes(db, { mes: MES, agora: AGORA });
  checar('mas o suspenso derruba', 'encerrada',
    (await db.doc('indicacoes/i4').get()).data().estado);

  bloco('10. O contador não é reescrito quando não mudou');
  await limpar();
  // Sem a comparação, toda virada de mês tocaria o documento de todo
  // motorista da base para regravar o mesmo número.
  await semear('parado', {
    plano: 'mensal', criancasAtivas: 20, trialInicio: DIAS(-400), indicacoesAtivas: 0,
  });
  const antes = (await db.doc('users/parado').get()).updateTime.toMillis();
  await fecharMes(db, { mes: MES, agora: AGORA });
  const depois = (await db.doc('users/parado').get()).updateTime.toMillis();
  checar('o documento de quem não mudou fica intacto', antes, depois);

  // ─────────────────────────────── resumo ─────────────────────────────────
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
