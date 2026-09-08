/**
 * A CARTEIRA DE ASSOCIADOS — o painel que o dono usa para decidir.
 *
 * POR QUE ESTE TESTE
 * Painel errado não dá erro: ele dá um número, e alguém age sobre ele. Os dois
 * jeitos de mentir aqui são silenciosos e opostos —
 *
 *   contar como "contratado" quem parou de pagar, inflando o MRR com dinheiro
 *   que não entra mais;
 *
 *   mostrar 0% de conversão quando ninguém terminou o teste ainda, que parece
 *   fracasso onde não houve nem tentativa.
 *
 * COMO RODAR
 *   node scripts/testar-carteira.mjs      (ou: npm run testar:carteira)
 */

import { degrauDo, mensalidadeDe, notasPorMotorista, resumirCarteira } from '../src/dominio/associacao/carteira.js';
import { FUNDADOR, ORIGEM } from '../src/dominio/associacao/planos.js';

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

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-09-15');
const MES = '2026-09';

// Trial de 90 dias: começando em 01/09 sobram 76 dias; em 20/06, acabou.
const NOVATO = { uid: 'a' };
const EM_TESTE = { uid: 'b', trialInicio: dia('2026-09-01') };
const ACABANDO = { uid: 'c', trialInicio: dia('2026-06-22') };
const CONTRATADO = { uid: 'd', trialInicio: dia('2026-01-01'), planoId: 'ate25', assinaturaAte: dia('2026-10-31') };
const BLOQUEADO = { uid: 'e', trialInicio: dia('2026-01-01') };
const DESISTENTE = { uid: 'f', trialInicio: dia('2026-01-01'), planoId: 'ate25', assinaturaAte: dia('2026-05-31') };

// ───────────────────────────── os degraus ──────────────────────────────────

bloco('1. Em que degrau cada motorista está');

checar('criou conta e não rodou rota', 'nao_comecou', degrauDo(NOVATO, HOJE));
checar('rodou a primeira rota', 'em_teste', degrauDo(EM_TESTE, HOJE));
checar('contratou e está em dia', 'contratado', degrauDo(CONTRATADO, HOJE));
checar('teste acabou sem contrato', 'bloqueado', degrauDo(BLOQUEADO, HOJE));

// ⚠️ O CASO QUE INFLA MRR. Quem contratou e parou de pagar continua com
// `planoId`. Contá-lo como "contratado" somaria ao MRR dinheiro que não entra
// mais — e é o jeito mais comum de um painel mentir para o próprio dono.
checar('contratou e parou de pagar é BLOQUEADO, não contratado', 'bloqueado', degrauDo(DESISTENTE, HOJE));
checar('suspenso pelo dono também', 'bloqueado', degrauDo({ ...CONTRATADO, suspenso: true }, HOJE));

// ───────────────────────────── a mensalidade ───────────────────────────────

bloco('2. Quanto cada um paga');

checar('sem faixa não é zero, é ausência', null, mensalidadeDe(NOVATO, MES));
checar('faixa média, sem desconto', 149, mensalidadeDe(CONTRATADO, MES).liquido);
checar(
  'fundador de metade paga metade',
  74.5,
  mensalidadeDe({ ...CONTRATADO, condicaoFundador: FUNDADOR.METADE }, MES).liquido
);
checar(
  'o vitalício não paga',
  0,
  mensalidadeDe({ ...CONTRATADO, condicaoFundador: FUNDADOR.VITALICIO }, MES).liquido
);
// DESCONTO COM PRAZO SOME SOZINHO. Sem o mês na conta, um desconto vencido
// continuaria sendo descontado do MRR para sempre.
const comFechamento = {
  ...CONTRATADO,
  descontos: [{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: '2026-09', degrau: 2 }],
};
checar('desconto vigente entra', 104.3, mensalidadeDe(comFechamento, '2026-09').liquido);
checar('e no mês seguinte já não entra', 149, mensalidadeDe(comFechamento, '2026-10').liquido);

// ───────────────────────────── a carteira ──────────────────────────────────

bloco('3. A carteira inteira');

const carteira = resumirCarteira({
  parceiros: [NOVATO, EM_TESTE, ACABANDO, CONTRATADO, BLOQUEADO, DESISTENTE],
  agora: HOJE,
  mes: MES,
});

checar('seis associados', 6, carteira.total);
checar('um ainda não começou', 1, carteira.naoComecou);
checar('dois em teste', 2, carteira.emTeste);
// O aviso que o dono precisa ver: quem está a uma semana de decidir.
checar('e um deles está a 7 dias do fim', 1, carteira.acabandoEm7);
checar('um contratado', 1, carteira.contratados);
checar('dois bloqueados', 2, carteira.bloqueados);

bloco('4. O MRR — o número que olha pra frente');

// `receitaPropria` do painel antigo era soma de fatura QUITADA: olha pra trás.
// Isto é quanto entra por mês enquanto ninguém sair.
checar('o MRR é a soma de quem paga', 149, carteira.mrr);
checar('e o de tabela, sem desconto nenhum', 149, carteira.mrrDeTabela);
checar('sem desconto, a fração é zero', 0, carteira.descontoMedio);
checar('o ticket por associado pagante', 149, carteira.ticketPorAssociado);

const comDescontos = resumirCarteira({
  parceiros: [
    { ...CONTRATADO, uid: 'x', condicaoFundador: FUNDADOR.METADE },
    { ...CONTRATADO, uid: 'y' },
  ],
  agora: HOJE,
  mes: MES,
});
checar('dois contratados, um com metade', 223.5, comDescontos.mrr);
checar('a tabela some os dois cheios', 298, comDescontos.mrrDeTabela);
// A DIFERENÇA ENTRE OS DOIS É O QUE A PLATAFORMA ABRE MÃO, e este número não
// existia em lugar nenhum antes.
checar('e a fração abdicada é 25%', 0.25, comDescontos.descontoMedio);

bloco('5. Zero e "não medimos" são coisas opostas');

// No primeiro mês de operação, 0% de conversão pareceria fracasso onde não
// houve nem tentativa: ninguém terminou o teste ainda.
const soEmTeste = resumirCarteira({ parceiros: [EM_TESTE, NOVATO], agora: HOJE, mes: MES });
checar('ninguém saiu do teste: conversão não medida', null, soEmTeste.conversao);
checar('sem pagante, o ticket não é zero', null, soEmTeste.ticketPorAssociado);
checar('nem o desconto médio', null, soEmTeste.descontoMedio);
// Mas o MRR é zero de verdade: ninguém paga, e isso é um fato, não uma
// ausência de medição.
checar('o MRR, esse, é zero mesmo', 0, soEmTeste.mrr);

checar('um contratado e um bloqueado dá 50%', 0.5, resumirCarteira({
  parceiros: [CONTRATADO, BLOQUEADO],
  agora: HOJE,
  mes: MES,
}).conversao);

bloco('6. Quem contratou antes do fim do teste');

checar('nenhum, por padrão', 0, carteira.antecipados);
checar('e um, com o desconto de antecipação', 1, resumirCarteira({
  parceiros: [
    { ...CONTRATADO, descontos: [{ origem: ORIGEM.ANTECIPACAO, fracao: 0.5, ate: '2027-09' }] },
  ],
  agora: HOJE,
  mes: MES,
}).antecipados);

bloco('7. Carteira vazia não quebra');

const vazia = resumirCarteira({ parceiros: [], agora: HOJE, mes: MES });
checar('total zero', 0, vazia.total);
checar('MRR zero', 0, vazia.mrr);
checar('conversão não medida', null, vazia.conversao);
checar('lista ausente também não quebra', 0, resumirCarteira().total);

bloco('8. A nota que as famílias deram a cada motorista');

// A JUNÇÃO EXISTE PORQUE `feedbacks` NÃO GUARDA `adminUid`. Quem sabe a que
// motorista uma família pertence é o documento do responsável.
const usuarios = [
  { uid: 'p1', role: 'parent', adminUid: 'd' },
  { uid: 'p2', role: 'parent', adminUid: 'd' },
  { uid: 'p3', role: 'parent', adminUid: 'x' },
  { uid: 'd', role: 'admin' },
];
const feedbacks = [
  { uid: 'p1', role: 'parent', answers: { rating: 5 } },
  { uid: 'p2', role: 'parent', answers: { rating: 4 } },
  { uid: 'p3', role: 'parent', answers: { rating: 2 } },
  // Feedback de MOTORISTA é ele avaliando o APP, não o transporte dele.
  // Contá-lo faria a nota subir porque ele gostou do aplicativo.
  { uid: 'd', role: 'admin', answers: { rating: 5 } },
];

const notas = notasPorMotorista(feedbacks, usuarios);
checar('a média das famílias dele', { media: 4.5, n: 2 }, notas.d);
checar('e a do vizinho não se mistura', { media: 2, n: 1 }, notas.x);
checar('a autoavaliação do motorista não entra', undefined, notas.d2);

// Ruído: "4.833333" faz a tela parecer precisa sobre nove opiniões.
checar('arredonda a uma casa', 4.7, notasPorMotorista(
  [
    { uid: 'p1', role: 'parent', answers: { rating: 5 } },
    { uid: 'p2', role: 'parent', answers: { rating: 5 } },
    { uid: 'p3', role: 'parent', answers: { rating: 4 } },
  ],
  [
    { uid: 'p1', role: 'parent', adminUid: 'd' },
    { uid: 'p2', role: 'parent', adminUid: 'd' },
    { uid: 'p3', role: 'parent', adminUid: 'd' },
  ]
).d.media);

checar('nota fora da faixa é ignorada', undefined, notasPorMotorista(
  [{ uid: 'p1', role: 'parent', answers: { rating: 0 } }],
  [{ uid: 'p1', role: 'parent', adminUid: 'd' }]
).d);
checar('responsável sem motorista não quebra', {}, notasPorMotorista(
  [{ uid: 'p9', role: 'parent', answers: { rating: 5 } }], []
));
checar('listas vazias não quebram', {}, notasPorMotorista());

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
