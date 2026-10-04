/**
 * O BOLETIM E O BUZI — `src/dominio/cobranca/boletim.js`.
 *
 * As três regras do dono viram teste: um assunto por pergunta, nenhuma
 * comparação com outro mês, e nada de conversa de amigo. Mais as contas:
 * o "entrou" pela data da baixa, separado por dentro; o atrasado que não é o
 * avisado; o Boletim fechado que é a foto do último instante do mês; e o olho
 * que esconde os valores.
 */
import { readFileSync } from 'node:fs';
import {
  TEMA,
  PERGUNTA,
  quemEstaAtrasado,
  quemAvisouQuePagou,
  quantoEntrou,
  responder,
  boletimDoMes,
  boletimParaAnunciar,
  estadoEm,
} from '../src/dominio/cobranca/boletim.js';
import { formatBRL } from '../src/compartilhado/formatters.js';

let ok = 0;
let bad = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function checar(nome, esperado, obtido) {
  if (igual(esperado, obtido)) {
    ok += 1;
    console.log(`  ok  ${nome}`);
  } else {
    bad += 1;
    console.log(`  \x1b[31mFALHA\x1b[0m  ${nome}\n        esperado ${JSON.stringify(esperado)}\n        obtido   ${JSON.stringify(obtido)}`);
  }
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const D = (a, m, d, h = 12) => new Date(a, m - 1, d, h, 0);
const AGORA = D(2026, 10, 15).getTime();
const R = (v) => formatBRL(v);

let seq = 0;
function mensal(mes, nome, valor, { status = 'pending', pago = null, aviso = null, comprovante = false } = {}) {
  const [a, m] = mes.split('-').map(Number);
  seq += 1;
  return {
    id: `p${seq}`, month: mes, childName: nome, amount: valor,
    dueDate: D(a, m, 10, 0), status, paidAt: pago, claimedAt: aviso,
    receiptURL: comprovante ? 'https://x/r.jpg' : null,
  };
}

// Outubro, dia 15. Ana pagou em dia; Pedro está atrasado; Júlia avisou;
// Bia pagou setembro (atrasado) agora em outubro; Caio adiantou novembro;
// Lia ainda deve setembro.
const P = [
  mensal('2026-10', 'Ana Souza', 230, { status: 'paid', pago: D(2026, 10, 8), aviso: D(2026, 10, 7) }),
  mensal('2026-10', 'Pedro Lima', 230),
  mensal('2026-10', 'Júlia Reis', 200, { status: 'claimed', aviso: D(2026, 10, 12), comprovante: true }),
  mensal('2026-09', 'Bia Costa', 220, { status: 'paid', pago: D(2026, 10, 3) }),
  mensal('2026-11', 'Caio Melo', 250, { status: 'paid', pago: D(2026, 10, 14) }),
  mensal('2026-09', 'Lia Nunes', 180),
  // paga em setembro: não entra no "entrou" de outubro
  mensal('2026-09', 'Ana Souza', 230, { status: 'paid', pago: D(2026, 9, 9) }),
];

bloco('1 · QUEM ESTÁ ATRASADO — só os atrasados');
const atr = quemEstaAtrasado(P, { agora: AGORA });
checar('dois atrasados, o mais antigo primeiro', ['Lia', 'Pedro'], atr.linhas.map((l) => l.nome));
checar('o total', 410, atr.total);
checar('a frase', ['2 mensalidades estão atrasadas.', `Total: ${R(410)}.`], atr.frases);
checar('quem avisou NÃO é atrasado', false, atr.linhas.some((l) => l.nome === 'Júlia'));
checar('o detalhe diz quando venceu', 'venceu em 10/09', atr.linhas[0].detalhe);
checar('ninguém atrasado: diz, não mostra lista vazia', ['Nenhuma mensalidade atrasada.'],
  quemEstaAtrasado([P[0]], { agora: AGORA }).frases);
checar('vence HOJE não é atrasado', 'no_prazo', estadoEm(mensal('2026-10', 'X', 1), D(2026, 10, 10, 18).getTime(), D(2026, 10, 10, 18).getTime()));
checar('venceu ontem é atrasado', 'atrasada', estadoEm(mensal('2026-10', 'X', 1), D(2026, 10, 11).getTime(), D(2026, 10, 11).getTime()));

bloco('2 · QUEM AVISOU QUE PAGOU — só quem espera conferência');
const avi = quemAvisouQuePagou(P, { agora: AGORA });
checar('só a Júlia', ['Júlia'], avi.linhas.map((l) => l.nome));
checar('com comprovante', 'com comprovante', avi.linhas[0].detalhe);
checar('a frase', ['1 mensalidade foi avisada como paga e espera você conferir.', `Total: ${R(200)}.`], avi.frases);
checar('ninguém avisou', ['Nenhuma família está esperando você conferir um pagamento.'],
  quemAvisouQuePagou([P[0]], { agora: AGORA }).frases);

bloco('3 · QUANTO ENTROU — pela baixa, separado por dentro');
const ent = quantoEntrou(P, { agora: AGORA });
checar('o total de outubro', 700, ent.total);
checar('as partes', { doMes: 230, antigos: 220, adiantados: 250 }, ent.partes);
checar('as frases', [
  `Até hoje, dia 15 de outubro, entraram ${R(700)}.`,
  `${R(230)} são mensalidades de outubro.`,
  `${R(220)} são atrasados de meses anteriores, pagos agora.`,
  `${R(250)} são mensalidades adiantadas.`,
  'Conta só o que você já conferiu e deu baixa.',
], ent.frases);
checar('o aviso da Júlia não é dinheiro que entrou', false, ent.total >= 900);
checar('mês sem baixa nenhuma', `Até hoje, dia 15 de outubro, nenhuma mensalidade teve baixa.`,
  quantoEntrou([P[1]], { agora: AGORA }).frases[0]);
checar('mês fechado não diz "até hoje"', `Em setembro, entraram ${R(230)}.`,
  quantoEntrou(P, { mes: '2026-09', agora: AGORA }).frases[0]);
checar('é parcial no mês corrente', true, ent.parcial);

bloco('4 · AS TRÊS REGRAS DO DONO');
const todas = [TEMA.ATRASADOS, TEMA.AVISARAM, TEMA.ENTROU].map((t) => responder(t, P, { agora: AGORA }));
const texto = (r) => r.frases.join(' ').toLowerCase();
const COMPARA = ['mês passado', 'mes passado', 'que em setembro', 'a mais que', 'a menos que', 'aumentou', 'caiu', 'cresceu', 'melhor que', 'pior que'];
const AMIGO = ['oi', 'olá', 'que bom', 'parabéns', 'infelizmente', '!'];
const PROIBIDAS = ['lucro', 'prejuízo', ' ia ', 'inteligen', 'devedor', 'caloteiro', 'inadimpl'];
for (const r of todas) {
  checar(`${r.tema}: não compara com outro mês`, [], COMPARA.filter((p) => texto(r).includes(p)));
  checar(`${r.tema}: não puxa conversa`, [], AMIGO.filter((p) => p === '!' ? texto(r).includes('!') : new RegExp(`\\b${p}\\b`).test(texto(r))));
  checar(`${r.tema}: sem palavra proibida`, [], PROIBIDAS.filter((p) => ` ${texto(r)} `.includes(p)));
}
checar('o atrasado não fala de quem avisou', false, /avis|confer/.test(texto(todas[0])));
checar('quem avisou não fala de atraso', false, /atras/.test(texto(todas[1])));
checar('o entrou não fala de quem avisou', false, /avisou|avisad/.test(texto(todas[2])));
checar('sonda: a checagem de comparação pega uma', ['mês passado', 'a mais que'],
  COMPARA.filter((p) => 'r$ 310 a mais que o mês passado'.includes(p)));
checar('as três perguntas', ['Quem está atrasado?', 'Quem avisou que pagou?', 'Quanto entrou este mês?'],
  Object.values(PERGUNTA));

bloco('5 · O OLHO ESCONDE OS VALORES');
for (const t of Object.values(TEMA)) {
  const r = responder(t, P, { agora: AGORA, mostrar: false });
  checar(`${t}: nenhum R$ com número`, false, /R\$\s?\d/.test(r.frases.join(' ')));
}

bloco('6 · O BOLETIM');
const parcial = boletimDoMes(P, { agora: AGORA });
checar('outubro é parcial, até o dia 15', { fechado: false, ate: 15 }, { fechado: parcial.fechado, ate: parcial.ate });
const set = boletimDoMes(P, { mes: '2026-09', agora: AGORA });
checar('setembro é fechado', true, set.fechado);
checar('no fim de setembro, Bia e Lia estavam atrasadas (Bia só pagou em outubro)', ['Lia', 'Bia'].sort(),
  set.atrasados.linhas.map((l) => l.nome).sort());
checar('no fim de setembro, o "entrou" é o de setembro', 230, set.entrou.total);
checar('o fechado é a foto: pagar depois não muda o passado', set.atrasados.total,
  boletimDoMes(P.map((p) => (p.childName === 'Lia Nunes' ? { ...p, status: 'paid', paidAt: D(2026, 10, 15) } : p)),
    { mes: '2026-09', agora: AGORA }).atrasados.total);

bloco('7 · O SELO "BOLETIM PRONTO"');
checar('dia 1: anuncia setembro', '2026-09', boletimParaAnunciar(D(2026, 10, 1).getTime()));
checar('dia 7: ainda anuncia', '2026-09', boletimParaAnunciar(D(2026, 10, 7).getTime()));
checar('dia 8: não anuncia', null, boletimParaAnunciar(D(2026, 10, 8).getTime()));
checar('já abriu: não anuncia', null, boletimParaAnunciar(D(2026, 10, 2).getTime(), '2026-09'));
checar('janeiro anuncia dezembro', '2026-12', boletimParaAnunciar(D(2027, 1, 3).getTime()));

bloco('8 · A RÉGUA É PURA');
const fonte = readFileSync(new URL('../src/dominio/cobranca/boletim.js', import.meta.url), 'utf8');
const imports = [...fonte.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
checar('só importa compartilhado/', true, imports.every((i) => i.includes('compartilhado/')));

console.log(`\n${ok} ok, ${bad} falha(s)`);
process.exit(bad ? 1 : 0);
