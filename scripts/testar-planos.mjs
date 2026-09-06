/**
 * A RÉGUA DOS PLANOS — a faixa, os descontos, e o zero que só o fundador
 * alcança.
 *
 * POR QUE ESTE TESTE É O MAIS IMPORTANTE DA PASTA DE ASSOCIAÇÃO
 * Aqui sai o número que vira fatura. O vizinho `taxa.js` já custou caro duas
 * vezes pelo mesmo tipo de erro — o contrato de associação saiu com valor ZERO
 * em duas ocasiões, assinado com hash, por um campo mal lido. A diferença é
 * que lá o erro precisava de um humano para acontecer; aqui o desconto é somado
 * por código, e soma sem teto vira crédito.
 *
 * COMO RODAR
 *   node scripts/testar-planos.mjs      (ou: npm run testar:planos)
 */

import {
  PLANOS,
  FUNDADOR,
  ACIMA_DA_TABELA,
  TETO_DE_INDICACAO,
  planoPara,
  planoPorId,
  excedentes,
  descontoDoFundador,
  descontoDeIndicacoes,
  precoDoMes,
  descontosVigentes,
  ANTECIPACAO,
  PREMIOS_DA_ROLETA,
  MESES_DE_CONTRATO,
  FUNDADOR_E_ANTECIPACAO_SOMAM,
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

const id = (p) => (p ? p.id : null);
const liq = (args) => precoDoMes(args).liquido;

// ───────────────────────────────── a faixa ─────────────────────────────────

bloco('1. Em que faixa a operação cai');

checar('três crianças cabem na primeira', 'ate10', id(planoPara(3)));
checar('a borda de cima da primeira é inclusiva', 'ate10', id(planoPara(10)));
checar('onze já é a segunda', 'ate25', id(planoPara(11)));
checar('vinte e cinco ainda é a segunda', 'ate25', id(planoPara(25)));
checar('vinte e seis é a terceira', 'ate40', id(planoPara(26)));
checar('quarenta é o fim da tabela', 'ate40', id(planoPara(40)));

// Devolver o maior plano como consolo cobraria R$ 229 de quem tem 60 crianças
// — menos do que qualquer conversa produziria. Fora da tabela é `null`, e quem
// consome precisa tratar.
checar('quarenta e um sai da tabela', null, id(planoPara(41)));
checar('conta zerada cabe na primeira', 'ate10', id(planoPara(0)));
checar('lixo não inventa faixa', 'ate10', id(planoPara(undefined)));

checar('o id salvo volta a ser plano', 'ate25', id(planoPorId('ate25')));
checar('id que saiu da régua devolve null', null, id(planoPorId('ate99')));

// ─────────────────────────── o plano menor que o uso ───────────────────────

bloco('2. Ele pode escolher um plano menor — e quantas ficam de fora');

checar('cabe: nenhuma sobra', 0, excedentes(planoPorId('ate25'), 14));
checar('exatamente no teto: nenhuma sobra', 0, excedentes(planoPorId('ate10'), 10));
// O número existe pra tela pedir que ELE aponte quais saem. Corte automático
// apagaria clientes que ele não escolheu perder.
checar('quatorze crianças no plano de dez: sobram 4', 4, excedentes(planoPorId('ate10'), 14));
checar('sem plano não há excedente a calcular', 0, excedentes(null, 30));

// ──────────────────────────────── os descontos ─────────────────────────────

bloco('3. Os descontos, separados');

checar('o primeiro motorista não paga, e não é por tempo', 1, descontoDoFundador(FUNDADOR.VITALICIO));
checar('os doze seguintes pagam metade', 0.5, descontoDoFundador(FUNDADOR.METADE));
checar('quem não é fundador não ganha nada por isso', 0, descontoDoFundador(null));
checar('condição inventada também não vale', 0, descontoDoFundador('amigo-do-dono'));

checar('nenhuma indicação, nenhum desconto', 0, descontoDeIndicacoes(0));
checar('uma indicação vale 10%', 0.1, descontoDeIndicacoes(1));
checar('cinco indicações zeram metade da conta', 0.5, descontoDeIndicacoes(5));
// O teto é o que impede a indicação sozinha de zerar a fatura de qualquer um.
checar('e a sexta não vale nada — o teto é o teto', TETO_DE_INDICACAO, descontoDeIndicacoes(6));
checar('vinte indicações também param no teto', 0.5, descontoDeIndicacoes(20));
checar('número negativo não vira crédito', 0, descontoDeIndicacoes(-3));
checar('meia indicação não existe', 0.1, descontoDeIndicacoes(1.9));

// ───────────────────────────── a conta do mês ──────────────────────────────

bloco('4. O valor que vira fatura');

checar('sem desconto nenhum, o preço de tabela', 149, liq({ plano: planoPorId('ate25') }));
checar('a faixa pequena', 69, liq({ plano: planoPorId('ate10') }));
checar('a faixa grande', 229, liq({ plano: planoPorId('ate40') }));

checar(
  'fundador de metade paga metade — e o centavo fecha',
  74.5,
  liq({ plano: planoPorId('ate25'), fundador: FUNDADOR.METADE })
);
checar(
  'duas indicações tiram 20%',
  119.2,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 2 })
);

bloco('5. O zero — quem alcança, e quem nunca alcança');

// O desenho inteiro do programa está nestas quatro linhas.
checar(
  'fundador vitalício não paga, com ou sem indicação',
  0,
  liq({ plano: planoPorId('ate40'), fundador: FUNDADOR.VITALICIO })
);
checar(
  'fundador de metade com cinco indicações chega exatamente a zero',
  0,
  liq({ plano: planoPorId('ate25'), fundador: FUNDADOR.METADE, indicacoesAtivas: 5 })
);
checar(
  'quem NÃO é fundador nunca zera: para em 50%',
  74.5,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 5 })
);
checar(
  'nem com vinte indicações',
  74.5,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 20 })
);

bloco('6. O que nunca pode acontecer');

// Sem o limite de 100%, seis indicações sobre um fundador de metade dariam
// 110% e a fatura viraria CRÉDITO — dinheiro saindo da plataforma para quem
// devia estar pagando.
checar(
  'desconto somado passa de 100% e é cortado em 100%',
  1,
  precoDoMes({ plano: planoPorId('ate25'), fundador: FUNDADOR.METADE, indicacoesAtivas: 6 }).desconto
);
checar(
  'e a fatura nunca fica negativa',
  0,
  liq({ plano: planoPorId('ate25'), fundador: FUNDADOR.METADE, indicacoesAtivas: 20 })
);

// Aplicar 50% sobre um preço inexistente produz R$ 0, que na tela é
// indistinguível de "não paga" — e é exatamente o caso que precisa de conversa.
const foraDaTabela = precoDoMes({ plano: planoPara(60), fundador: FUNDADOR.METADE });
checar('acima da tabela não tem preço', null, foraDaTabela.liquido);
checar('e o motivo diz o que fazer', ACIMA_DA_TABELA, foraDaTabela.motivo);
checar('sem plano nenhum, mesma resposta', null, precoDoMes({}).liquido);

bloco('7. A régua está inteira');

checar('são três faixas', 3, PLANOS.length);
checar('e elas sobem', true, PLANOS.every((p, i) => i === 0 || p.ate > PLANOS[i - 1].ate));
checar('o preço também sobe', true, PLANOS.every((p, i) => i === 0 || p.preco > PLANOS[i - 1].preco));
// O efetivo por criança CAI conforme a operação cresce — é a progressão que
// não pune o pequeno, e o negocio.md a lista como uma das três âncoras.
checar(
  'o efetivo no teto de cada faixa cai',
  true,
  PLANOS.every((p, i) => i === 0 || p.preco / p.ate < PLANOS[i - 1].preco / PLANOS[i - 1].ate)
);

bloco('7. Desconto com PRAZO — o que a antecipação e a roleta criaram');

const medio = planoPorId('ate25');
const anteci = { origem: ORIGEM.ANTECIPACAO, fracao: 0.5, ate: '2027-09' };
const roleta30 = { origem: ORIGEM.ROLETA, fracao: 0.3, ate: '2027-09' };

// PRAZO É O PONTO. Desconto de conversão que não expira vira preço — e "para
// sempre" numa planilha de receita é a diferença entre fechar a conta e não.
checar('dentro do prazo, vale', 0.5, descontosVigentes([anteci], '2027-09').antecipacao);
checar('no mês seguinte ao fim, não vale mais', 0, descontosVigentes([anteci], '2027-10').antecipacao);
checar('antes do fim, vale', 0.5, descontosVigentes([anteci], '2026-10').antecipacao);
checar('desconto sem data não vale nada', 0,
  descontosVigentes([{ origem: ORIGEM.ANTECIPACAO, fracao: 0.5 }], '2026-10').antecipacao);
checar('lista vazia não quebra', 0, descontosVigentes(null, '2026-10').roleta);
checar('as origens não se misturam', 0.3, descontosVigentes([anteci, roleta30], '2026-10').roleta);

bloco('8. A regra que protege o programa de indicação');

// ⚠️ ESTE É O BLOCO QUE GUARDA UMA DECISÃO DE NEGÓCIO.
//
// Somando fundador (50%) com antecipação (50%), os treze primeiros associados
// chegariam a 100% e, a partir dali, roleta e indicação valeriam ZERO — para
// exatamente as pessoas que mais indicam. O programa de aquisição deixaria de
// recompensar quem ele precisa recompensar.
checar('a decisão está registrada como constante', false, FUNDADOR_E_ANTECIPACAO_SOMAM);
checar(
  'fundador metade + antecipação = 50%, não 100%',
  0.5,
  precoDoMes({ plano: medio, fundador: FUNDADOR.METADE, descontos: [anteci], mes: '2026-10' }).desconto
);
checar(
  'e ele continua ganhando com a roleta por cima',
  0.8,
  precoDoMes({
    plano: medio,
    fundador: FUNDADOR.METADE,
    descontos: [anteci, roleta30],
    mes: '2026-10',
  }).desconto
);
checar(
  'quem NÃO é fundador ganha os 50% da antecipação inteiros',
  0.5,
  precoDoMes({ plano: medio, descontos: [anteci], mes: '2026-10' }).desconto
);
checar(
  'e o valor sai certo',
  74.5,
  precoDoMes({ plano: medio, descontos: [anteci], mes: '2026-10' }).liquido
);
// O vitalício continua sendo o único que zera sozinho, e a antecipação não
// tira nada dele: max(1, 0.5) segue 1.
checar(
  'o vitalício não é rebaixado pelo maior-dos-dois',
  1,
  precoDoMes({ plano: medio, fundador: FUNDADOR.VITALICIO, descontos: [anteci], mes: '2026-10' }).desconto
);

bloco('9. O teto de 100% continua valendo com quatro fontes');

// Quatro descontos ao mesmo tempo somam mais de 1 — e fatura negativa é
// dinheiro saindo da plataforma para quem devia estar pagando.
const tudo = precoDoMes({
  plano: medio,
  fundador: FUNDADOR.METADE,
  indicacoesAtivas: 5,
  descontos: [anteci, roleta30],
  mes: '2026-10',
});
checar('desconto para em 1', 1, tudo.desconto);
checar('e o líquido para em zero, nunca negativo', 0, tudo.liquido);

bloco('10. O contrato e a roleta da conversão');

checar('o contrato é de doze meses', 12, MESES_DE_CONTRATO);
checar('a antecipação dura o contrato inteiro', 12, ANTECIPACAO.meses);
checar('a antecipação é metade', 0.5, ANTECIPACAO.fracao);
checar('a roleta tem quatro divisões', 4, PREMIOS_DA_ROLETA.length);
// Duas dão mês sem taxa, duas dão desconto — e nenhum prêmio dá as duas
// coisas, senão o mesmo giro entraria em dois caminhos de cobrança.
checar('duas dão mês sem taxa', 2, PREMIOS_DA_ROLETA.filter((p) => p.meses && !p.fracao).length);
checar('duas dão desconto', 2, PREMIOS_DA_ROLETA.filter((p) => p.fracao).length);
checar(
  'todo desconto da roleta dura o contrato inteiro',
  true,
  PREMIOS_DA_ROLETA.filter((p) => p.fracao).every((p) => p.meses === MESES_DE_CONTRATO)
);
checar('nenhum prêmio zera a conta sozinho', true, PREMIOS_DA_ROLETA.every((p) => (p.fracao || 0) < 1));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
