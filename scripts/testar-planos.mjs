/**
 * A RÉGUA DOS PLANOS — a faixa, a escada de fechamento, o piso e o zero.
 *
 * POR QUE ESTE TESTE É O MAIS IMPORTANTE DA PASTA DE ASSOCIAÇÃO
 * Aqui sai o número que vira fatura. O vizinho `taxa.js` já custou caro duas
 * vezes pelo mesmo tipo de erro — o contrato de associação saiu com valor ZERO
 * em duas ocasiões, assinado com hash, por um campo mal lido. A diferença é
 * que lá o erro precisava de um humano para acontecer; aqui o desconto é somado
 * por código, e soma sem trava vira crédito.
 *
 * ⚠️ E ELE JÁ DEIXOU UM VAZAMENTO PASSAR, o que explica o bloco 6.
 * O comentário de `precoDoMes` afirmava que quem não é fundador nunca zera. Não
 * era verdade: `antecipacao` (50%) somava com indicação (50%) e a fatura ia a
 * R$ 0,00. O teste que "provava" o invariante passava cinco indicações SEM a
 * antecipação — o caso que vazava não era coberto. O bloco 6 agora cobre a
 * SOMA, que é o que pega o próximo desconto que alguém esquecer de considerar.
 *
 * COMO RODAR
 *   node scripts/testar-planos.mjs      (ou: npm run testar:planos)
 */

import {
  PLANOS,
  FUNDADOR,
  ACIMA_DA_TABELA,
  PISO_DA_FATURA,
  DESCONTO_POR_INDICACAO,
  planoPara,
  planoPorId,
  excedentes,
  descontoDoFundador,
  descontoDeIndicacoes,
  descontoDoFechamento,
  precoDoMes,
  descontosVigentes,
  ESCADA_DE_FECHAMENTO,
  RETORNO,
  RENOVACAO,
  MESES_DE_CONTRATO,
  FUNDADORES_VITALICIO,
  FUNDADORES_METADE,
  FUNDADOR_E_FECHAMENTO_SOMAM,
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
// O valor de METADE continua sendo LIDO mesmo tendo sido aposentado: quem já
// tem a concessão não pode ver a fatura subir por um deploy.
checar('metade continua valendo para quem já tem', 0.5, descontoDoFundador(FUNDADOR.METADE));
checar('quem não é fundador não ganha nada por isso', 0, descontoDoFundador(null));
checar('condição inventada também não vale', 0, descontoDoFundador('amigo-do-dono'));

checar('nenhuma indicação, nenhum desconto', 0, descontoDeIndicacoes(0));
checar('uma indicação vale 10%', 0.1, descontoDeIndicacoes(1));
checar('cinco indicações valem metade da conta', 0.5, descontoDeIndicacoes(5));
// ⚠️ O TETO DE 50% SAIU. Ele não protegia nada (a fatura ia a zero com teto e
// tudo, porque o fechamento somava por cima) e criava um efeito perverso: no
// limite, a indicação seguinte valia ZERO — o programa parava de recompensar
// quem mais indica. Quem protege a margem agora é o PISO, e ele é em reais.
checar('a sexta CONTINUA valendo — não há mais teto percentual', 0.6, descontoDeIndicacoes(6));
checar('dez indicações valem 100% nominais', 1, descontoDeIndicacoes(10));
checar('e vinte passam de 100% no nominal', 2, descontoDeIndicacoes(20));
checar('número negativo não vira crédito', 0, descontoDeIndicacoes(-3));
checar('meia indicação não existe', 0.1, descontoDeIndicacoes(1.9));

bloco('4. A escada de fechamento — o degrau é o mês da decisão');

checar('fechou no mês 1: metade', 0.5, descontoDoFechamento(1));
checar('no mês 2: 30%', 0.3, descontoDoFechamento(2));
checar('no mês 3: 15%', 0.15, descontoDoFechamento(3));
// ⚠️ Fora dos 90 dias o desconto é ZERO, e a conta fica inativa até ele
// fechar. Um quarto degrau seria a escada premiando quem esperou — exatamente
// a lição que ela existe para não ensinar.
checar('depois do 90º dia não há degrau', 0, descontoDoFechamento(4));
checar('degrau zero não existe', 0, descontoDoFechamento(0));
checar('quem volta em 30 dias tem o retorno', 0.1, descontoDoFechamento(RETORNO.degrau));
checar('lixo não inventa degrau', 0, descontoDoFechamento('metade-por-favor'));
checar('nem ausência', 0, descontoDoFechamento(undefined));

// A escada DESCE. Se algum dia um degrau posterior valer mais que o anterior,
// o incentivo inteiro se inverte — e é um erro de digitação de distância.
checar(
  'a escada desce, degrau por degrau',
  true,
  ESCADA_DE_FECHAMENTO.every((e, i) => i === 0 || e.fracao < ESCADA_DE_FECHAMENTO[i - 1].fracao)
);
checar('são três degraus, um por mês de teste', 3, ESCADA_DE_FECHAMENTO.length);
checar('e o retorno é menor que o último degrau', true, RETORNO.fracao < ESCADA_DE_FECHAMENTO[2].fracao);

// ───────────────────────────── a conta do mês ──────────────────────────────

bloco('5. O valor que vira fatura');

checar('sem desconto nenhum, o preço de tabela', 149, liq({ plano: planoPorId('ate25') }));
checar('a faixa pequena', 69, liq({ plano: planoPorId('ate10') }));
checar('a faixa grande', 229, liq({ plano: planoPorId('ate40') }));

checar(
  'duas indicações tiram 20%',
  119.2,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 2 })
);

const fecha1 = { origem: ORIGEM.FECHAMENTO, fracao: 0.5, ate: '2027-09', degrau: 1 };
const fecha2 = { origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: '2027-09', degrau: 2 };

checar(
  'fechou no mês 1 e paga metade — e o centavo fecha',
  74.5,
  liq({ plano: planoPorId('ate25'), descontos: [fecha1], mes: '2026-10' })
);
checar(
  'fechou no mês 2',
  104.3,
  liq({ plano: planoPorId('ate25'), descontos: [fecha2], mes: '2026-10' })
);

// ─────────────────────────────────── o piso ────────────────────────────────

bloco('6. O PISO — a trava de margem, e o vazamento que ela fecha');

// ⚠️ ESTE É O CASO QUE VAZAVA, e o teste antigo não o cobria.
//
// Não-fundador + fechamento (50%) + 5 indicações pagas (50%) = 100% nominais.
// Antes disto, a fatura saía R$ 0,00 — o comentário do arquivo jurava que "só
// fundador chega a zero", e não era verdade para NINGUÉM que somasse os dois.
const vazamento = precoDoMes({
  plano: planoPorId('ate25'),
  indicacoesAtivas: 5,
  descontos: [fecha1],
  mes: '2026-10',
});
checar('o desconto nominal chega a 100%', 1, vazamento.desconto);
checar('mas a fatura NÃO é zero — para no piso', PISO_DA_FATURA, vazamento.liquido);
checar('e a tela sabe que o piso mordeu', true, vazamento.pisoAplicado);
checar('e quanto ele comeu, em reais', 34, vazamento.descontoAbsorvido);

// A DERIVAÇÃO DO PISO: ele é metade da menor faixa, e é isso que faz o "50% no
// primeiro mês" ser verdade em TODA faixa. Um piso maior transformaria a oferta
// em mentira para o motorista pequeno, que é a maior parte do mercado.
checar('metade da menor faixa fica ACIMA do piso, por 50 centavos', 34.5, liq({
  plano: planoPorId('ate10'),
  descontos: [fecha1],
  mes: '2026-10',
}));
checar('logo o piso não desmente a oferta de 50%', true, PLANOS[0].preco / 2 >= PISO_DA_FATURA);

// O motorista pequeno que indica: o piso absorve quase tudo no ano 1, e é
// exatamente por isso que `pisoAplicado` existe — a tela precisa DIZER.
const pequenoQueIndica = precoDoMes({
  plano: planoPorId('ate10'),
  indicacoesAtivas: 1,
  descontos: [fecha1],
  mes: '2026-10',
});
checar('ele paga o piso', 34, pequenoQueIndica.liquido);
checar('a indicação valeu 50 centavos no ano 1', 0.5, 34.5 - pequenoQueIndica.liquido);
checar('e o piso absorveu R$ 6,40', 6.4, pequenoQueIndica.descontoAbsorvido);

// ⚠️ E A INDICAÇÃO NÃO SE PERDE — FICA DORMENTE. No mês 13 o fechamento expira
// (o `ate` passou), o piso deixa de morder, e ela aparece inteira. É o desenho
// do mês 13: o único desconto permanente é o que ele renova trazendo gente.
const mes13 = precoDoMes({
  plano: planoPorId('ate10'),
  indicacoesAtivas: 1,
  descontos: [fecha1],
  mes: '2027-10',
});
checar('no mês 13 o fechamento expirou', 0, mes13.descontoFechamento);
checar('e a indicação aparece inteira', 62.1, mes13.liquido);
checar('sem piso mordendo', false, mes13.pisoAplicado);

// O piso nunca cobra MAIS que a tabela. Hoje nenhuma faixa é mais barata que
// ele; uma faixa de entrada futura seria, e piso acima do bruto é a plataforma
// cobrando a mais por causa de uma trava de margem.
const faixaBarata = { id: 'ate3', ate: 3, preco: 19, rotulo: 'até 3' };
checar('faixa mais barata que o piso não é inflada', 19, liq({ plano: faixaBarata }));
checar(
  'e com desconto ela para no próprio preço, não no piso',
  19,
  liq({ plano: faixaBarata, descontos: [fecha1], mes: '2026-10' })
);

bloco('7. O zero — quem alcança, e quem nunca alcança');

// ⚠️ SÓ O VITALÍCIO. Ele escapa do piso porque é 100% sem prazo, contratado
// quando o produto não tinha nenhum caso de uso — cobrar R$ 34 dele agora
// desfaria um acordo assinado por causa de uma regra que nasceu depois.
checar(
  'fundador vitalício não paga, com ou sem indicação',
  0,
  liq({ plano: planoPorId('ate40'), fundador: FUNDADOR.VITALICIO })
);
checar(
  'e o piso não o alcança',
  0,
  liq({ plano: planoPorId('ate40'), fundador: FUNDADOR.VITALICIO, indicacoesAtivas: 5 })
);
// Todo o resto para no piso. Não existe mais "chega a zero por acumular".
checar(
  'nem dez indicações zeram quem não é vitalício',
  PISO_DA_FATURA,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 10 })
);
checar(
  'nem vinte',
  PISO_DA_FATURA,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 20 })
);
checar(
  'nem o fundador de metade com cinco indicações',
  PISO_DA_FATURA,
  liq({ plano: planoPorId('ate25'), fundador: FUNDADOR.METADE, indicacoesAtivas: 5 })
);

bloco('8. O que nunca pode acontecer');

// Sem o limite de 100%, vinte indicações dariam 200% e a fatura viraria
// CRÉDITO — dinheiro saindo da plataforma para quem devia estar pagando. O
// piso já impediria o negativo, mas o teto é a trava que existe ANTES dele.
checar(
  'desconto somado passa de 100% e é cortado em 100%',
  1,
  precoDoMes({ plano: planoPorId('ate25'), indicacoesAtivas: 20 }).desconto
);
checar(
  'e a fatura nunca fica negativa',
  true,
  liq({ plano: planoPorId('ate25'), indicacoesAtivas: 20 }) >= 0
);
checar(
  'nem para o vitalício, que escapa do piso',
  0,
  liq({ plano: planoPorId('ate25'), fundador: FUNDADOR.VITALICIO, indicacoesAtivas: 20 })
);

// Aplicar 50% sobre um preço inexistente produz R$ 0, que na tela é
// indistinguível de "não paga" — e é exatamente o caso que precisa de conversa.
const foraDaTabela = precoDoMes({ plano: planoPara(60), indicacoesAtivas: 5 });
checar('acima da tabela não tem preço', null, foraDaTabela.liquido);
checar('e o motivo diz o que fazer', ACIMA_DA_TABELA, foraDaTabela.motivo);
checar('e o piso não inventa fatura onde não há preço', false, foraDaTabela.pisoAplicado);
checar('sem plano nenhum, mesma resposta', null, precoDoMes({}).liquido);

bloco('9. A régua está inteira');

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

bloco('10. Desconto com PRAZO — e o legado que não pode sumir');

// PRAZO É O PONTO. Desconto de conversão que não expira vira preço — e "para
// sempre" numa planilha de receita é a diferença entre fechar a conta e não.
checar('dentro do prazo, vale', 0.5, descontosVigentes([fecha1], '2027-09').fechamento);
checar('no mês seguinte ao fim, não vale mais', 0, descontosVigentes([fecha1], '2027-10').fechamento);
checar('antes do fim, vale', 0.5, descontosVigentes([fecha1], '2026-10').fechamento);
checar('desconto sem data não vale nada', 0,
  descontosVigentes([{ origem: ORIGEM.FECHAMENTO, fracao: 0.5 }], '2026-10').fechamento);
checar('lista vazia não quebra', 0, descontosVigentes(null, '2026-10').fechamento);
checar('sem mês de referência, nada vale', 0, descontosVigentes([fecha1], null).fechamento);

// ⚠️ O LEGADO `antecipacao` CAI NO BALDE DO FECHAMENTO. É o mesmo instrumento
// com o nome antigo (era 50% fixo em qualquer dia do teste): ignorá-lo faria a
// fatura de quem já o tem subir em silêncio, e um deploy não pode aumentar a
// conta de ninguém.
const legado = { origem: ORIGEM.ANTECIPACAO, fracao: 0.5, ate: '2027-09' };
checar('antecipação antiga continua valendo', 0.5, descontosVigentes([legado], '2026-10').fechamento);
checar(
  'e produz a mesma fatura que o degrau 1',
  74.5,
  liq({ plano: planoPorId('ate25'), descontos: [legado], mes: '2026-10' })
);

// ⚠️ A ROLETA SAIU. Origem desconhecida não é somada — se houver documento em
// produção com ela, o desconto para de valer. Foi decisão, não descuido: o
// critério era sorte, e sorte não sobrevive à conversa no portão da escola.
const roletaMorta = { origem: 'roleta', fracao: 0.3, ate: '2027-09' };
checar('roleta não entra em balde nenhum', 0, descontosVigentes([roletaMorta], '2026-10').fechamento);
checar('nem no da concessão', 0, descontosVigentes([roletaMorta], '2026-10').concessao);
checar(
  'e não desconta nada da fatura',
  149,
  liq({ plano: planoPorId('ate25'), descontos: [roletaMorta], mes: '2026-10' })
);

// A concessão é RÉGUA à parte: ela SOMA, porque é exceção sobre a política, não
// outra política. Ver `concessao.js`.
const concessao = { origem: ORIGEM.CONCESSAO, fracao: 0.2, ate: '2027-03' };
checar('as origens não se misturam', 0.2, descontosVigentes([fecha1, concessao], '2026-10').concessao);
checar(
  'e a concessão soma sobre o fechamento',
  0.7,
  precoDoMes({ plano: planoPorId('ate25'), descontos: [fecha1, concessao], mes: '2026-10' }).desconto
);

bloco('11. As decisões de negócio, registradas como constante');

// ⚠️ ESTE BLOCO GUARDA DECISÕES, e é para elas aparecerem se alguém as mudar.
checar('fundador e fechamento não somam', false, FUNDADOR_E_FECHAMENTO_SOMAM);
checar(
  'fundador de metade + fechamento = 50%, não 100%',
  0.5,
  precoDoMes({
    plano: planoPorId('ate25'),
    fundador: FUNDADOR.METADE,
    descontos: [fecha1],
    mes: '2026-10',
  }).desconto
);
// O vitalício não é rebaixado pelo maior-dos-dois: max(1, 0.5) segue 1.
checar(
  'o vitalício não é rebaixado',
  1,
  precoDoMes({
    plano: planoPorId('ate25'),
    fundador: FUNDADOR.VITALICIO,
    descontos: [fecha1],
    mes: '2026-10',
  }).desconto
);

// ⚠️ AS VAGAS DE FUNDADOR PELA METADE ESTÃO FECHADAS — era o único desconto que
// ninguém podia reproduzir, e por isso não sobrevivia ao portão. O contador
// continua existindo para `contarFundadores` recusar a concessão: zerar a régua
// sem zerar o contador deixaria a porta aberta para "só essa vez".
checar('não há mais vaga de fundador pela metade', 0, FUNDADORES_METADE);
checar('e o vitalício é um só', 1, FUNDADORES_VITALICIO);

checar('o contrato é de doze meses', 12, MESES_DE_CONTRATO);
checar('a renovação dura o contrato inteiro', 12, RENOVACAO.meses);
checar('e ela é pequena de propósito', 0.1, RENOVACAO.fracao);
checar('o retorno tem prazo de 30 dias', 30, RETORNO.prazoDias);
checar('cada indicação vale 10%', 0.1, DESCONTO_POR_INDICACAO);
checar('o piso é metade da menor faixa, arredondado para baixo', 34, PISO_DA_FATURA);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
