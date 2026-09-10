/**
 * A RÉGUA DOS PLANOS — a taxa por criança, a escada vitalícia, o mínimo e o piso.
 *
 * POR QUE ESTE TESTE É O MAIS IMPORTANTE DA PASTA DE ASSOCIAÇÃO
 * Aqui sai o número que vira fatura. O contrato de associação já saiu com valor
 * ZERO em duas ocasiões, assinado com hash, por um campo mal lido. A diferença
 * é que lá o erro precisava de um humano; aqui o desconto é somado por código,
 * e soma sem trava vira crédito.
 *
 * ⚠️ ELE JÁ DEIXOU UM VAZAMENTO PASSAR, o que explica o bloco 6.
 * O comentário de `precoDoMes` afirmava que quem não é fundador nunca zera. Não
 * era verdade: o fechamento somava com indicação e a fatura ia a R$ 0,00. O
 * teste que "provava" o invariante passava cinco indicações SEM o fechamento —
 * o caso que vazava não era coberto. O bloco 6 cobre a SOMA, que é o que pega o
 * próximo desconto que alguém esquecer de considerar.
 *
 * ⚠️ E O BLOCO 2 EXISTE POR CAUSA DE UM DEGRAU QUE NÃO PODE VOLTAR.
 * O preço era por faixa até 10/09/2026, e na fronteira uma criança custava o
 * preço de sete. A taxa marginal acima da 40ª é a única descontinuidade que
 * sobrou na régua, e ela é marginal justamente para não virar degrau: o bloco 2
 * varre 1 a 60 crianças e exige que o preço NUNCA desça quando o número sobe.
 *
 * COMO RODAR
 *   node scripts/testar-planos.mjs      (ou: npm run testar:planos)
 */

import {
  PLANO,
  PLANOS_DISPONIVEIS,
  TAXA,
  TAXA_ACIMA_DE_40,
  CRIANCAS_NA_TAXA_CHEIA,
  MINIMO,
  FUNDADOR,
  PISO_DA_FATURA,
  DESCONTO_POR_INDICACAO,
  valorDaIndicacao,
  planoValido,
  precoDaTabela,
  custoDaProximaCrianca,
  descontoDoFundador,
  descontoDeIndicacoes,
  descontoDoFechamento,
  precoDoMes,
  descontosVigentes,
  ESCADA_DE_FECHAMENTO,
  RETORNO,
  MESES_DE_CONTRATO,
  FUNDADORES_VITALICIO,
  FUNDADORES_METADE,
  ORIGEM,
} from '../src/dominio/associacao/planos.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const tabela = (criancas, plano = PLANO.MENSAL) => precoDaTabela({ criancas, plano });
const liq = (args) => precoDoMes(args).liquido;

// ────────────────────────── 1. o preço de tabela ───────────────────────────

bloco('1. A taxa por criança');

checar('vinte crianças no mensal', 118, tabela(20));
checar('vinte crianças no anual', 58, tabela(20, PLANO.ANUAL));
// ⚠️ O ANUAL É MENOS QUE METADE, e a frase de venda tem que dizer isso e não
// "exatamente metade": metade de R$ 5,90 seria R$ 2,95, e a taxa é R$ 2,90.
// A primeira versão deste teste afirmava "exatamente metade" e falhou aqui —
// o número é generoso e o texto é que estava errado.
checar('o anual custa MENOS que metade do mensal', true, TAXA[PLANO.ANUAL] * 2 < TAXA[PLANO.MENSAL]);
checar('e a diferença é de cinco centavos por criança', 0.05, Math.round((TAXA[PLANO.MENSAL] / 2 - TAXA[PLANO.ANUAL]) * 100) / 100);
checar('quinze no mensal', 88.5, tabela(15));
checar('dezesseis no mensal', 94.4, tabela(16));

// ⚠️ O MOTIVO DE TODA A MUDANÇA DE 10/09/2026.
// Em faixas, a 16ª criança custava R$ 40 — o preço de 6,8 crianças. Este
// número é o argumento inteiro do modelo linear, e se ele voltar a subir
// alguém reintroduziu um degrau.
checar('a 16ª criança custa uma criança, não sete', 5.9, custoDaProximaCrianca({ criancas: 15 }));

checar('dez no mensal', 59, tabela(10));
checar('quarenta no mensal', 236, tabela(40));
checar('quarenta no anual', 116, tabela(40, PLANO.ANUAL));

checar('plano desconhecido não tem preço', null, tabela(20, 'trimestral'));
checar('e nem cai no mensal como consolo', false, tabela(20, 'trimestral') === 118);
checar('mensal é plano válido', true, planoValido(PLANO.MENSAL));
checar('anual é plano válido', true, planoValido(PLANO.ANUAL));
checar('e "gratis" não é', false, planoValido('gratis'));
checar('há dois planos, e só dois', 2, PLANOS_DISPONIVEIS.length);

// ─────────────────── 2. o mínimo e a taxa marginal ─────────────────────────

bloco('2. O mínimo da tabela e a taxa acima da 40ª');

checar('cinco crianças pagam o mínimo, não R$ 29,50', 49, tabela(5));
checar('uma criança também paga o mínimo', 49, tabela(1));
checar('zero criança paga o mínimo', 49, tabela(0));
checar('oito crianças ainda estão no mínimo', 49, tabela(8));
checar('nove já passam do mínimo', 53.1, tabela(9));
checar('no anual o mínimo é 29', 29, tabela(5, PLANO.ANUAL));
checar('e dez no anual empatam com ele', 29, tabela(10, PLANO.ANUAL));

// ⚠️ O MÍNIMO É SOBRE O TOTAL, NUNCA POR CRIANÇA. Aplicado por criança, a
// operação de três pagaria três mínimos.
checar('o mínimo não multiplica por criança', 49, tabela(3));

checar('a 41ª criança usa a taxa marginal', 240.9, tabela(41));
checar('e as 40 primeiras seguem na taxa cheia', 236, tabela(40));
checar('a 41ª custa R$ 4,90, não R$ 5,90', 4.9, custoDaProximaCrianca({ criancas: 40 }));
checar('a taxa cheia vale até a 40ª', 40, CRIANCAS_NA_TAXA_CHEIA);

// ⚠️ A INVARIANTE QUE IMPEDE A TAXA MARGINAL DE VIRAR DEGRAU.
// Sem marginalidade — aplicando R$ 4,90 a TODAS as crianças de quem passa de
// 40 — `preco(41)` seria R$ 200,90, MENOR que os R$ 236 de quem tem 40, e
// crescer daria desconto. Varremos 1 a 60 nos dois planos.
let monotonico = true;
let quebra = null;
for (const plano of PLANOS_DISPONIVEIS) {
  for (let n = 1; n <= 60; n += 1) {
    if (tabela(n, plano) < tabela(n - 1, plano)) {
      monotonico = false;
      quebra = `${plano} em ${n}`;
      break;
    }
  }
}
checar('o preço nunca desce quando o número de crianças sobe', true, monotonico);
checar('e não há ponto de quebra', null, quebra);

checar('a próxima criança custa a taxa cheia no meio da tabela', 5.9, custoDaProximaCrianca({ criancas: 20 }));
checar('custa a marginal acima de 40', 4.9, custoDaProximaCrianca({ criancas: 41 }));
// Quem está abaixo do mínimo pode crescer de graça, e a tela deve poder dizer.
checar('e custa zero para quem ainda está no mínimo', 0, custoDaProximaCrianca({ criancas: 3 }));

// ──────────────────────── 3. a escada de fechamento ────────────────────────

bloco('3. A escada de fechamento');

checar('quem fecha no primeiro mês leva 30%', 0.3, descontoDoFechamento(1));
checar('no segundo, 20%', 0.2, descontoDoFechamento(2));
checar('no terceiro, 10%', 0.1, descontoDoFechamento(3));
checar('não existe quarto degrau', 0, descontoDoFechamento(4));
checar('quem volta em 30 dias leva 10%', 0.1, descontoDoFechamento(RETORNO.degrau));
checar('degrau zero não dá nada', 0, descontoDoFechamento(0));
checar('e nem um degrau inventado', 0, descontoDoFechamento('sempre'));
checar('a escada tem três degraus', 3, ESCADA_DE_FECHAMENTO.length);

// ⚠️ A ESCADA ENCOLHEU PORQUE CONVIVE COM O PLANO ANUAL.
// A 50% (o valor antigo), o mensal com desconto máximo custaria R$ 59 numa
// operação de 20 crianças e o anual custa R$ 58 — o anual perderia a razão de
// existir. Este teste é o que impede alguém de "melhorar" a oferta e apagar um
// dos dois planos sem perceber.
const mensalNoMelhorDegrau = liq({
  criancas: 20,
  plano: PLANO.MENSAL,
  descontos: [{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: null }],
  mes: '2026-09',
});
checar('o mensal no melhor degrau custa R$ 82,60', 82.6, mensalNoMelhorDegrau);
checar('e o anual continua sendo mais barato que ele', true, tabela(20, PLANO.ANUAL) < mensalNoMelhorDegrau);

// ───────────────── 4. o desconto vitalício e o prazo ───────────────────────

bloco('4. Vitalício é `ate: null`, e ausente NÃO é');

const vitalicio = [{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: null }];

checar('vale no mês em que foi concedido', 0.3, descontosVigentes(vitalicio, '2026-09').fechamento);
checar('vale um ano depois', 0.3, descontosVigentes(vitalicio, '2027-09').fechamento);
checar('vale dez anos depois', 0.3, descontosVigentes(vitalicio, '2036-12').fechamento);

// ⚠️ A LINHA MAIS PERIGOSA DA RÉGUA.
// `undefined` (chave ausente) NÃO é vitalício. Sem este caso, um documento
// legado ou malformado viraria desconto eterno em silêncio — e a comparação
// `'2026-09' > 'undefined'` é FALSA (dígito ordena antes de letra), então o
// acidente passaria despercebido justamente por parecer intencional.
checar('desconto sem a chave `ate` é descartado', 0, descontosVigentes([{ origem: ORIGEM.FECHAMENTO, fracao: 0.3 }], '2026-09').fechamento);
checar('e `ate` vazio também', 0, descontosVigentes([{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: '' }], '2026-09').fechamento);
checar('e `ate` numérico também', 0, descontosVigentes([{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: 202609 }], '2026-09').fechamento);

const comPrazo = [{ origem: ORIGEM.CONCESSAO, fracao: 0.2, ate: '2026-12' }];
checar('concessão vale dentro do prazo', 0.2, descontosVigentes(comPrazo, '2026-11').concessao);
checar('vale no último mês, inclusive', 0.2, descontosVigentes(comPrazo, '2026-12').concessao);
checar('e para de valer no mês seguinte', 0, descontosVigentes(comPrazo, '2027-01').concessao);

// SEM MÊS DE REFERÊNCIA, NENHUM DESCONTO VALE — nem o vitalício. Ausência de
// referência é ausência de resposta, e não "vale tudo".
checar('sem mês de referência nada vale', 0, descontosVigentes(vitalicio, null).fechamento);
checar('nem mesmo o vitalício', 0, descontosVigentes(vitalicio, '').fechamento);

// O legado `antecipacao` cai no mesmo balde: é o mesmo instrumento com o nome
// antigo, e ignorá-lo faria a fatura de quem o tem subir em silêncio.
checar('o legado `antecipacao` soma no fechamento', 0.5, descontosVigentes([{ origem: ORIGEM.ANTECIPACAO, fracao: 0.5, ate: '2027-08' }], '2026-09').fechamento);
checar('e `roleta` não é reconhecida', 0, descontosVigentes([{ origem: 'roleta', fracao: 0.5, ate: null }], '2026-09').fechamento);

// ───────────────────── 5. o mínimo ANTES do desconto ───────────────────────

bloco('5. O mínimo vem antes do desconto, e o piso depois');

// ⚠️ A ORDEM É A COISA MAIS IMPORTANTE DESTE ARQUIVO DEPOIS DO PISO.
// Dez crianças custam R$ 59 de tabela (acima do mínimo de R$ 49). Com 30%
// travado, a conta é 59 × 0,7 = R$ 41,30. Se o mínimo fosse aplicado DEPOIS,
// ele cobraria R$ 49 e o desconto prometido sumiria sem nenhuma linha
// explicando — que é exatamente a queixa que o programa de indicação foi
// escrito para evitar.
checar(
  'dez crianças com 30% pagam R$ 41,30, não o mínimo de R$ 49',
  41.3,
  liq({ criancas: 10, descontos: vitalicio, mes: '2026-09' })
);

// E quem está NO mínimo tem desconto sobre o mínimo, não sobre a soma crua.
checar(
  'cinco crianças com 30% pagam 30% menos que o mínimo',
  34.3,
  liq({ criancas: 5, descontos: vitalicio, mes: '2026-09' })
);

const conta = precoDoMes({ criancas: 10, descontos: vitalicio, mes: '2026-09' });
checar('o bruto informado é o de tabela', 59, conta.bruto);
checar('o desconto informado é o nominal', 0.3, conta.desconto);
checar('e o piso não mordeu', false, conta.pisoAplicado);

// ─────────────────────── 6. o piso e o zero ────────────────────────────────

bloco('6. O piso, e as duas únicas portas para o zero');

checar('o piso é R$ 19', 19, PISO_DA_FATURA);
checar('cada indicação vale 5%', 0.05, DESCONTO_POR_INDICACAO);
checar('cinco indicações valem 25%', 0.25, descontoDeIndicacoes(5));
checar('vinte indicações valem 100% nominais', 1, descontoDeIndicacoes(20));
checar('e não há teto percentual na indicação', 1.5, descontoDeIndicacoes(30));

// ⚠️ ONDE O PISO MORDE, e este número é publicado na tela de indicar.
//
// A 10% ele mordia na 4ª indicação de quem tem 8 crianças, e essa era a maior
// objeção contra a régua: o motorista pequeno trazia cinco clientes e recebia
// por três. A 5% ele morde na 7ª. O caso existe para que baixar a taxa de
// novo, ou mexer no piso, mostre o efeito aqui em vez de na fatura de alguém.
const pequeno = (n) =>
  precoDoMes({ criancas: 8, descontos: vitalicio, indicacoesAtivas: n, mes: '2026-09' });
checar('com 8 crianças, a 6ª indicação ainda desconta inteira', false, pequeno(6).pisoAplicado);
checar('e a 7ª é a primeira que o piso corta', true, pequeno(7).pisoAplicado);

// ⚠️ E É POR ISSO QUE A TELA NÃO PODE DIZER "cada colega vale 5% da sua conta".
//
// `valorDaIndicacao` responde a pergunta que o convite faz — quanto a PRÓXIMA
// tira, em reais — e ela não é `bruto × 5%` perto do piso. Para quem tem 8
// crianças, a 7ª vale sessenta centavos e a 8ª vale zero. Prometer R$ 2,45 a
// essa pessoa é prometer quatro vezes o que ela vai receber, e a queixa que
// nasce disso é a que a coleção `indicacoes` inteira existe para evitar.
const vale = (criancas, numero, plano = PLANO.MENSAL) =>
  valorDaIndicacao({ criancas, plano, descontos: vitalicio, mes: '2026-09', numero });

checar('a 1ª indicação de quem tem 20 crianças vale R$ 5,90', 5.9, vale(20, 1));
checar('e a 6ª também — longe do piso, todas valem igual', 5.9, vale(20, 6));
checar('com 8 crianças a 6ª vale R$ 2,45', 2.45, vale(8, 6));
checar('a 7ª vale só o que sobra até o piso', 0.6, vale(8, 7));
checar('e a 8ª não vale nada', 0, vale(8, 8));
checar('no anual vale metade', 2.9, vale(20, 1, PLANO.ANUAL));
// "não sei" e "não vale nada" são respostas diferentes na tela.
checar('plano desconhecido devolve null, não zero', null,
  valorDaIndicacao({ criancas: 20, plano: 'trimestral', numero: 1 }));

// ⚠️ E QUEM ESTÁ NO TESTE TAMBÉM: sem plano contratado, `precoDoMes` assume o
// mensal como VITRINE, e sem um guarda explícito esta função responderia
// "R$ 5,90" para uma fatura isenta — que não desconta nada. Foi exatamente o
// que ela fez na primeira versão.
checar('sem plano nenhum também é null, não o mensal presumido', null,
  valorDaIndicacao({ criancas: 20, numero: 1 }));
checar('nem com plano vazio', null,
  valorDaIndicacao({ criancas: 20, plano: '', numero: 1 }));

// ⚠️ O CASO QUE VAZAVA, agora coberto: fechamento SOMADO com indicação.
// Sem o piso, 30% + 70% davam 100% e a fatura ia a R$ 0,00 para um associado
// que não é fundador. O teste antigo passava indicações SEM o fechamento.
const empilhado = precoDoMes({
  criancas: 20,
  descontos: vitalicio,
  indicacoesAtivas: 14,
  mes: '2026-09',
});
checar('30% travados mais catorze indicações somam 100%', 1, empilhado.desconto);
checar('mas a fatura para no piso', 19, empilhado.liquido);
checar('e a tela sabe que o piso mordeu', true, empilhado.pisoAplicado);
checar('e quanto ele comeu', 19, empilhado.descontoAbsorvido);

// O desconto nunca passa de 100%: fatura negativa é crédito saindo da
// plataforma para quem devia estar pagando.
const exagerado = precoDoMes({ criancas: 20, indicacoesAtivas: 30, mes: '2026-09' });
checar('o desconto é cortado em 100%', 1, exagerado.desconto);
checar('e a fatura nunca fica negativa', 19, exagerado.liquido);

// ⚠️ O PISO NÃO SOBE ACIMA DO BRUTO. Uma taxa de entrada futura mais barata
// que R$ 19 não pode ser encarecida por uma trava de margem.
checar('o piso nunca cobra mais que a tabela', true, liq({ criancas: 20, plano: PLANO.ANUAL, indicacoesAtivas: 30, mes: '2026-09' }) <= tabela(20, PLANO.ANUAL));

// ─────────────────────────── 7. o fundador ─────────────────────────────────

bloco('7. O fundador');

checar('o vitalício não paga', 1, descontoDoFundador(FUNDADOR.VITALICIO));
checar('a metade histórica continua sendo lida', 0.5, descontoDoFundador(FUNDADOR.METADE));
checar('quem não é fundador não ganha nada', 0, descontoDoFundador(null));

// O vitalício é a ÚNICA via para o zero que passa por aqui — a outra é a
// isenção, que não passa por `precoDoMes`.
checar('o vitalício zera a fatura', 0, liq({ criancas: 20, fundador: FUNDADOR.VITALICIO, mes: '2026-09' }));
checar('e ele escapa do piso', 0, liq({ criancas: 20, fundador: FUNDADOR.VITALICIO, indicacoesAtivas: 3, mes: '2026-09' }));

// Fundador e fechamento NÃO somam: vale o maior. Somando, o vitalício receberia
// mais 30% e a fatura viraria crédito.
// ⚠️ A BANDEIRA SAIU, E O COMPORTAMENTO FICOU TRAVADO AQUI.
//
// Havia `FUNDADOR_E_FECHAMENTO_SOMAM`, e este caso lia a constante — o que
// provava a configuração, não o efeito. Uma constante afirmando o próprio
// valor passa mesmo quando `precoDoMes` a ignora.
//
// Ela era demonstravelmente inerte (120 combinações de fundador × escada ×
// indicações × concessão, zero divergências entre somar e pegar o maior) e
// foi apagada. O que sobrou é o que importa: o vitalício continua dominando
// a escada, e a fatura dele não vira crédito.
const vitalicioComEscada = precoDoMes({
  criancas: 20,
  fundador: FUNDADOR.VITALICIO,
  descontos: vitalicio,
  mes: '2026-09',
});
checar('o vitalício com escada por cima continua em 100%', 1, vitalicioComEscada.desconto);
checar('e a fatura dele é zero, nunca negativa', 0, vitalicioComEscada.liquido);
checar(
  'e quem tem os dois leva o maior',
  0.5,
  precoDoMes({ criancas: 20, fundador: FUNDADOR.METADE, descontos: vitalicio, mes: '2026-09' }).desconto
);

checar('não há mais vaga de fundador pela metade', 0, FUNDADORES_METADE);
checar('e o vitalício é um só', 1, FUNDADORES_VITALICIO);

// ─────────────────────── 8. as constantes da régua ─────────────────────────

bloco('8. As constantes');

checar('a taxa mensal é R$ 5,90 por criança', 5.9, TAXA[PLANO.MENSAL]);
checar('a anual é R$ 2,90', 2.9, TAXA[PLANO.ANUAL]);
checar('a marginal mensal é R$ 4,90', 4.9, TAXA_ACIMA_DE_40[PLANO.MENSAL]);
checar('a marginal anual é R$ 2,40', 2.4, TAXA_ACIMA_DE_40[PLANO.ANUAL]);
checar('o mínimo mensal é R$ 49', 49, MINIMO[PLANO.MENSAL]);
checar('o mínimo anual é R$ 29', 29, MINIMO[PLANO.ANUAL]);
checar('o contrato é de doze meses', 12, MESES_DE_CONTRATO);
checar('o retorno tem prazo de 30 dias', 30, RETORNO.prazoDias);

// ⚠️ A ÂNCORA DO PROJETO, EM FORMA DE TESTE — E ELA TEM UM LIMITE.
//
// A frase é *"a conta inteira do app custa menos que UMA mensalidade"*, e o
// motorista cobra de R$ 200 a R$ 400 por criança. A primeira versão deste
// teste afirmava que ela vale até 60 crianças, e é FALSO: a R$ 5,90 a conta
// passa de R$ 200 na 34ª criança.
//
// O que é verdade, e está travado abaixo: contra a mensalidade mais BARATA da
// faixa (R$ 200) a âncora vale até 33 crianças; contra uma de R$ 250 — que é o
// que uma operação desse tamanho cobra — vale até 42. É para esticar esse
// limite que existe a taxa marginal; ela não o elimina.
//
// Acima disso a frase continua verdadeira na prática, mas a conversa passa a
// ancorar na mensalidade REAL dele, não no piso da faixa. Se alguém mexer na
// taxa, este teste diz na hora quanto a âncora encolheu.
function ancoraAte(mensalidade) {
  let n = 0;
  while (tabela(n + 1) < mensalidade) n += 1;
  return n;
}
checar('contra uma mensalidade de R$ 200, a âncora vale até 33 crianças', 33, ancoraAte(200));
checar('contra uma de R$ 250, até 42', 42, ancoraAte(250));
checar('e a taxa marginal é o que estica esse limite', true, ancoraAte(250) > 40);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
