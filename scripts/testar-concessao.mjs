/**
 * A CONCESSÃO — a exceção que o dono abre, com prazo e motivo.
 *
 * POR QUE ESTE TESTE
 * A concessão é a porta pela qual o modelo negociado pode voltar. O que a
 * mantém fechada não é disciplina, é a validação — e uma validação que só mora
 * no formulário some na segunda tela que gravar concessão.
 *
 * Os dois jeitos de errar aqui custam dinheiro e são silenciosos:
 *
 *   PRAZO: concessão sem data é preço. A fatura sai menor para sempre, e
 *   ninguém revisa uma coisa que não vence.
 *
 *   SOMA: duas concessões empilhadas fazem a ficha dizer 30% enquanto a fatura
 *   cobra 60% — e as duas telas estão "certas".
 *
 * COMO RODAR
 *   node scripts/testar-concessao.mjs      (ou: npm run testar:concessao)
 */

import {
  FRACAO_MINIMA,
  MOTIVO_MINIMO,
  PRAZO_MAXIMO,
  TIPO,
  concessaoVigente,
  condicoesVigentes,
  contarFundadores,
  descontoDaConcessao,
  mesDaqui,
  montarConcessao,
  resumirConcessoes,
  validarConcessao,
} from '../src/dominio/associacao/concessao.js';
import { PLANOS, precoDoMes } from '../src/dominio/associacao/planos.js';

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
  console.log('');
  console.log(t);
}

const AGORA = new Date('2026-09-15T12:00:00');
const MOTIVO = 'perdeu duas escolas em agosto';

const vale = (extra) =>
  validarConcessao({ tipo: TIPO.DESCONTO, fracao: 0.3, meses: 6, motivo: MOTIVO, ...extra });

// ───────────────────────── prazo e motivo ──────────────────────────────────

bloco('1. Prazo e motivo são obrigatórios');

checar('uma concessão completa passa', true, vale().ok);

// ⚠️ CONCESSÃO SEM PRAZO É PREÇO. A fatura sai menor para sempre, e ninguém
// revisa uma coisa que não vence.
checar('sem prazo, não', false, vale({ meses: 0 }).ok);
checar('e o erro diz por quê', true, vale({ meses: 0 }).erro.includes('vira preço'));

// ⚠️ SEM MOTIVO, DAQUI A SEIS MESES NEM QUEM CONCEDEU SABE EXPLICAR.
checar('sem motivo, não', false, vale({ motivo: '' }).ok);
checar('motivo de uma palavra também não', false, vale({ motivo: 'ok' }).ok);

// Acima de um ano deixa de ser exceção: é a tabela daquele associado.
checar('treze meses é tabela nova', false, vale({ meses: 13 }).ok);
checar('doze meses ainda é concessão', true, vale({ meses: 12 }).ok);

bloco('2. O tamanho do desconto');

checar('abaixo do piso não segura ninguém', false, vale({ fracao: 0.02 }).ok);
checar('o piso passa', true, vale({ fracao: FRACAO_MINIMA }).ok);

// ⚠️ ISENÇÃO NÃO É DESCONTO DE 100%. Uma diz que o mês não tem fatura, a outra
// produz fatura de R$ 0 — os dois chegam a zero e contam histórias diferentes
// na hora de conferir o que foi concedido.
checar('100% de desconto é recusado', false, vale({ fracao: 1 }).ok);
checar('e manda usar isenção', true, vale({ fracao: 1 }).erro.includes('sem fatura'));
checar('isenção não precisa de fração', true,
  validarConcessao({ tipo: TIPO.ISENCAO, meses: 2, motivo: MOTIVO }).ok);
checar('tipo inventado é recusado', false, vale({ tipo: 'brinde' }).ok);

// ───────────────────────── a data de fim ───────────────────────────────────

bloco('3. Até quando ela vale');

// Um mês é SÓ ESTE mês, inclusive — a mesma contagem de `mesDaqui` na
// contratação e no prêmio.
checar('um mês é este mês', '2026-09', mesDaqui(1, AGORA));
checar('seis meses', '2027-02', mesDaqui(6, AGORA));
// ⚠️ `setMonth` ESTOURA: 31 de março mais um mês vira 1º de maio, e a concessão
// ganharia um mês de graça. Por isso o dia vai para 1 antes de andar.
checar('31 de março não pula abril', '2026-04', mesDaqui(2, new Date('2026-03-31T12:00:00')));

const c = montarConcessao({ tipo: TIPO.DESCONTO, fracao: 0.3, meses: 6, motivo: MOTIVO, por: 'dono1', agora: AGORA });
checar('a concessão guarda a data pronta', '2027-02', c.ate);
checar('e quem concedeu', 'dono1', c.por);
checar('e o motivo, limpo', MOTIVO, c.motivo);
checar('vale em fevereiro', true, concessaoVigente(c, '2027-02'));
checar('e não vale em março', false, concessaoVigente(c, '2027-03'));
// Sem mês de referência nada vale — ausência de referência é ausência de
// resposta, nunca "vale tudo".
checar('sem mês, não vale', false, concessaoVigente(c, null));

// Inválida não vira registro: quem burlar o formulário esbarra aqui.
let barrou = false;
try {
  montarConcessao({ tipo: TIPO.DESCONTO, fracao: 0.3, meses: 0, motivo: MOTIVO });
} catch {
  barrou = true;
}
checar('montar sem prazo levanta erro', true, barrou);

// ───────────────────────── o efeito na fatura ──────────────────────────────

bloco('4. O registro é uma coisa, o efeito é outra');

// ⚠️ ESTA É A AMARRA. O registro (`users.concessoes`) e o efeito
// (`users.descontos`) vão no MESMO lote — separados, existiria a concessão
// registrada que nunca chega na conta, ou o desconto que ninguém explica.
const efeito = descontoDaConcessao(c);
checar('o desconto sai da concessão', { origem: 'concessao', fracao: 0.3, ate: '2027-02' }, efeito);
checar('isenção não vira desconto', null,
  descontoDaConcessao({ tipo: TIPO.ISENCAO, ate: '2026-10' }));

const plano = PLANOS[1]; // R$ 149
const comConcessao = precoDoMes({ plano, descontos: [efeito], mes: '2026-10' });
checar('a fatura cai', 0.3, comConcessao.descontoConcessao);
checar('e o líquido também', 104.3, comConcessao.liquido);

// ⚠️ A CONCESSÃO SOMA COM A RÉGUA, não compete com ela: fundador de metade com
// 20% de concessão fica com 70%.
const fundadorComConcessao = precoDoMes({
  plano,
  fundador: 'metade',
  descontos: [{ origem: 'concessao', fracao: 0.2, ate: '2027-02' }],
  mes: '2026-10',
});
checar('fundador mais concessão soma', 0.7, fundadorComConcessao.desconto);

// E o teto de 100% continua sendo o que impede fatura negativa.
checar('nunca passa de 100%', 1, precoDoMes({
  plano,
  fundador: 'metade',
  indicacoesAtivas: 5,
  descontos: [{ origem: 'concessao', fracao: 0.5, ate: '2027-02' }],
  mes: '2026-10',
}).desconto);

// Vencida, a concessão para de descontar sozinha. É a prova do prazo.
checar('vencida não desconta mais', 0,
  precoDoMes({ plano, descontos: [efeito], mes: '2027-03' }).descontoConcessao);

// ───────────────────────── régua contra exceção ────────────────────────────

bloco('5. A tabela separa régua de exceção');

const motorista = {
  condicaoFundador: 'metade',
  indicacoesAtivas: 2,
  descontos: [
    { origem: 'antecipacao', fracao: 0.5, ate: '2027-06' },
    { origem: 'concessao', fracao: 0.3, ate: '2027-02' },
  ],
  concessoes: [c],
};
const linhas = condicoesVigentes(motorista, '2026-10');
checar('quatro condições vigentes', 4, linhas.length);
// ⚠️ SEM A COLUNA DE ESPÉCIE, "50%" de fundador e "50%" de concessão parecem a
// mesma coisa — e são opostas: uma é política, a outra é dinheiro que o dono
// abriu mão para uma pessoa.
checar('e três delas são régua', 3, linhas.filter((l) => l.especie === 'regua').length);
checar('a exceção é uma', 1, linhas.filter((l) => l.especie === 'excecao').length);
// A entrada crua de `descontos` com origem concessao NÃO vira linha: ela é o
// efeito, e a linha completa (com motivo e autor) vem de `concessoes`.
checar('a exceção carrega o motivo', MOTIVO, linhas.find((l) => l.especie === 'excecao').motivo);
checar('e o fundador não expira', null, linhas.find((l) => l.id === 'fundador').ate);

checar('em março só sobra a régua sem prazo', ['fundador', 'indicacao', 'antecipacao'],
  condicoesVigentes(motorista, '2027-03').map((l) => l.id));
checar('sem condição nenhuma, lista vazia', [], condicoesVigentes({}, '2026-10'));

// ⚠️ A FICHA NÃO APLICA TETO NA INDICAÇÃO, E ESTE É O CASO QUE FALTAVA.
//
// Havia um `Math.min(indicacoes * 10, 50)` no rótulo. O teto de 50% saiu de
// `descontoDeIndicacoes` em 07/09/2026 (porcentagem não protege margem; quem
// protege é `PISO_DA_FATURA`), e a ficha ficou atrás.
//
// Os casos existentes usavam 5 e 2 indicações — com 5, `Math.min(50, 50)`
// coincide com o valor certo e o teto NUNCA morde. Por isso são 8 aqui: é o
// primeiro valor em que a ficha e a fatura discordavam.
//
// A ficha é onde o dono confere o que concedeu. Dizer 50% enquanto a fatura
// desconta 80% é o "indiquei e não recebi" pelo lado de quem responde.
const muitasIndicacoes = condicoesVigentes({ indicacoesAtivas: 8 }, '2026-10');
checar('8 indicações mostram 80%, não 50%', '80%',
  muitasIndicacoes.find((l) => l.id === 'indicacao').valor);
checar('e o rótulo bate com o que a fatura desconta', 0.8,
  precoDoMes({ plano, indicacoesAtivas: 8, mes: '2026-10' }).descontoIndicacao);
// Uma só continua no singular e sem teto por baixo.
checar('1 indicação mostra 10%', '10%',
  condicoesVigentes({ indicacoesAtivas: 1 }, '2026-10')
    .find((l) => l.id === 'indicacao').valor);

// ⚠️ O DESCONTO ÓRFÃO — o efeito existe e o registro não.
//
// Acontece se alguém gravar `users.descontos` sem passar por `conceder`, ou se
// o par registro+efeito se separar por qualquer motivo. A primeira versão
// desta função IGNORAVA a entrada de origem `concessao` em `descontos`
// (confiando que a linha completa viria de `concessoes`): o desconto continuava
// saindo da fatura e sumia da tabela que existe justamente para que nenhum
// desconto seja invisível.
const orfao = condicoesVigentes(
  { descontos: [{ origem: 'concessao', fracao: 0.4, ate: '2027-02' }] },
  '2026-10'
);
checar('o desconto sem registro APARECE', 1, orfao.length);
checar('como exceção', 'excecao', orfao[0].especie);
checar('com o valor certo', '40%', orfao[0].valor);
checar('e dizendo que está órfão', true, orfao[0].motivo.includes('sem registro'));

// Com registro, ele NÃO duplica: a linha completa vem de `concessoes`.
const comRegistro = condicoesVigentes(
  {
    descontos: [{ origem: 'concessao', fracao: 0.3, ate: '2027-02' }],
    concessoes: [c],
  },
  '2026-10'
);
checar('com registro, uma linha só', 1, comRegistro.length);
checar('e ela traz o motivo', MOTIVO, comRegistro[0].motivo);

// ───────────────────────── o contador de fundadores ────────────────────────

bloco('6. O contador de fundadores, que não existia');

const carteira = [
  { uid: 'a', condicaoFundador: 'vitalicio' },
  { uid: 'b', condicaoFundador: 'metade' },
  { uid: 'c', condicaoFundador: 'metade' },
  { uid: 'd' },
];
const f = contarFundadores(carteira);
checar('um vitalício', 1, f.vitalicio);
checar('dois pela metade', 2, f.metade);
checar('três de treze', 3, f.total);
// ⚠️ O LIMITE CAIU DE TREZE PARA UM em 07/09/2026, e não foi por economia.
//
// As doze vagas de "metade" eram o único desconto que ninguém pode reproduzir
// — ninguém pode chegar antes —, e por isso não sobreviviam à conversa no
// portão da escola. A condição virou TÍTULO (certificado, nome na página,
// prioridade), e o desconto de 50% ficou disponível a qualquer um pela escada
// de fechamento: quem fecha no primeiro mês leva o mesmo.
//
// O contador NÃO foi apagado junto, e é o ponto: zerar a régua sem manter o
// contador deixaria a porta aberta para "só essa vez".
checar('o limite agora é um', 1, f.limite);
// ⚠️ NEGATIVO DE PROPÓSITO, e agora os dois campos usam isso. Os dois `metade`
// desta carteira são históricos e continuam valendo (`descontoDoFundador`
// ainda os lê); o −2 é o contador dizendo que não há mais vaga, não um erro.
checar('as duas metades históricas aparecem como -2', -2, f.restamMetade);
checar('e nenhum vitalício restante', 0, f.restamVitalicio);

// Carteira sem nenhum fundador: uma vaga de vitalício, nenhuma de metade.
const semFundador = contarFundadores([{ uid: 'x' }, { uid: 'y' }]);
checar('sem fundador, resta o vitalício', 1, semFundador.restamVitalicio);
checar('e nenhuma metade a conceder', 0, semFundador.restamMetade);

// ⚠️ `restamMetade < 0` NÃO É ESTOURO — e o painel acusava o dono por isso.
//
// Com `FUNDADORES_METADE = 0`, todo fundador de metade histórico deixa o
// contador negativo. Ele foi concedido sob a régua que valia; ler só o sinal
// fazia a tela dizer "passou do combinado" por causa de uma mudança de
// política. O estouro real é o do VITALÍCIO, que sempre foi um e não expira.
checar('duas metades históricas NÃO são estouro', false, f.estourou);
checar('mas aparecem como histórico', true, f.metadeHistorica);
checar('carteira limpa não tem histórico a mostrar', false, semFundador.metadeHistorica);
checar('e não estourou', false, semFundador.estourou);

const doisVitalicios = contarFundadores([
  { condicaoFundador: 'vitalicio' },
  { condicaoFundador: 'vitalicio' },
]);
checar('DOIS vitalícios são estouro de verdade', true, doisVitalicios.estourou);

// ⚠️ NEGATIVO DE PROPÓSITO. Zerar em zero esconderia exatamente o caso que o
// contador existe para pegar — e o vitalício NÃO EXPIRA.
const demais = contarFundadores([
  { condicaoFundador: 'vitalicio' },
  { condicaoFundador: 'vitalicio' },
]);
checar('o segundo vitalício aparece como -1', -1, demais.restamVitalicio);
checar('carteira vazia conta zero', 0, contarFundadores().total);

// ───────────────────────── o retrato da carteira ───────────────────────────

bloco('7. Se metade da carteira tiver concessão, a tabela é que está errada');

const base = [
  { uid: 'a', concessoes: [c] },
  { uid: 'b', concessoes: [{ tipo: TIPO.ISENCAO, ate: '2026-09' }] },
  { uid: 'c' },
  { uid: 'd', concessoes: [] },
];
checar('duas de quatro em outubro', 1, resumirConcessoes(base, '2026-10').comConcessao);
checar('em setembro são duas', 2, resumirConcessoes(base, '2026-09').comConcessao);
checar('e a fração aparece inteira', 0.5, resumirConcessoes(base, '2026-09').fracao);
// `null` e não zero: "não há ninguém" não é "zero por cento têm".
checar('carteira vazia devolve null', null, resumirConcessoes([], '2026-09').fracao);

bloco('8. As réguas estão onde foram combinadas');

checar('motivo tem piso de dez', 10, MOTIVO_MINIMO);
checar('prazo tem teto de doze', 12, PRAZO_MAXIMO);
checar('fração tem piso de 5%', 0.05, FRACAO_MINIMA);
checar('entrada vazia não passa', false, validarConcessao().ok);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f2) => console.log('  ✗ ' + f2));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
