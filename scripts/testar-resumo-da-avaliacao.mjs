/**
 * O RESUMO DA AVALIAÇÃO DO APP — a conta da aba do dono.
 *
 * POR QUE ESTE TESTE
 * Painel que mente não dá erro: dá decisão errada. Os três jeitos de mentir
 * aqui são: mostrar 0,0 onde ninguém respondeu, deixar o nome de uma família
 * sair para a tela do dono, e somar nota sem validade na média.
 *
 * COMO RODAR
 *   node scripts/testar-resumo-da-avaliacao.mjs
 */

import {
  filtrarComentarios,
  grupoDoPapel,
  noPeriodo,
  perguntaLigada,
  resumirAvaliacao,
} from '../src/dominio/suporte/resumoDaAvaliacao.js';

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

const AGORA = new Date('2026-10-05T12:00:00');
const atras = (n) => new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);

let seq = 0;
const fb = (role, nota, extra = {}) => ({
  id: `f${(seq += 1)}`,
  role,
  answers: { rating: nota },
  createdAt: atras(1),
  ...extra,
});

// ───────────────────────── 1. sem dado ─────────────────────────────────────

bloco('1. Onde não há resposta o número não existe');

const vazio = resumirAvaliacao([], { agora: AGORA });
checar('total zero', 0, vazio.total);
checar('média geral é null, não 0', null, vazio.media);
checar('média de motoristas é null', null, vazio.motoristas.media);
checar('média de famílias é null', null, vazio.familias.media);
checar('média do link é null', null, vazio.link.media);
checar('percentual das barras é null', [null, null, null, null, null], vazio.distribuicao.map((d) => d.pct));
checar('sem momento nenhum', [], vazio.porMomento);
checar('sem comentário', [], vazio.comentarios);
checar('entrada que não é lista não quebra', 0, resumirAvaliacao(undefined, { agora: AGORA }).total);

// ───────────────────────── 2. médias e grupos ──────────────────────────────

bloco('2. Médias e grupos');

const base = [
  fb('admin', 5),
  fb('admin', 3),
  fb('parent', 4),
  fb('parent', 2),
  fb('parent', 1),
  fb('acompanhante', 5),
  fb('segundo_responsavel', 4),
];
const r = resumirAvaliacao(base, { agora: AGORA });
checar('total', 7, r.total);
checar('média geral', 24 / 7, r.media);
checar('motoristas: n e média', { n: 2, media: 4 }, r.motoristas);
checar('famílias: n e média', { n: 3, media: 7 / 3 }, r.familias);
checar('link soma acompanhante e 2º responsável', { n: 2, media: 4.5 }, r.link);
checar('notas 1 e 2', 2, r.notasBaixas);
checar('papel admin é motorista', 'motorista', grupoDoPapel('admin'));
checar('papel parent é família', 'familia', grupoDoPapel('parent'));
checar('papel desconhecido é família', 'familia', grupoDoPapel('qualquer'));

bloco('3. A distribuição das cinco notas');

checar('contagem de 5 a 1', [2, 2, 1, 1, 1], r.distribuicao.map((d) => d.n));
checar('ordem é de 5 para 1', [5, 4, 3, 2, 1], r.distribuicao.map((d) => d.nota));
checar('percentuais', [29, 29, 14, 14, 14], r.distribuicao.map((d) => d.pct));

// ───────────────────────── 4. nota inválida ────────────────────────────────

bloco('4. Nota sem validade não entra na conta');

const sujo = resumirAvaliacao(
  [
    fb('admin', 4),
    fb('admin', 0),
    fb('admin', 6),
    fb('admin', 3.5),
    fb('admin', null),
    { id: 'x', role: 'admin', createdAt: atras(1) },
  ],
  { agora: AGORA }
);
checar('só a nota 4 conta', 1, sujo.total);
checar('média só da nota válida', 4, sujo.media);

// ───────────────────────── 5. período ──────────────────────────────────────

bloco('5. Período');

const lista = [
  fb('admin', 5, { createdAt: atras(5) }),
  fb('admin', 3, { createdAt: atras(45) }),
  fb('parent', 1, { createdAt: atras(200) }),
  fb('parent', 4, { createdAt: undefined }),
];
checar('30 dias', 1, resumirAvaliacao(lista, { dias: 30, agora: AGORA }).total);
checar('90 dias', 2, resumirAvaliacao(lista, { dias: 90, agora: AGORA }).total);
checar('desde o começo inclui o sem data', 4, resumirAvaliacao(lista, { agora: AGORA }).total);
checar('sem data nunca é recente', 2, noPeriodo(lista, { dias: 90, agora: AGORA }).length);
checar('Timestamp do Firestore é entendido', 1, noPeriodo(
  [fb('admin', 5, { createdAt: { toDate: () => atras(2) } })],
  { dias: 30, agora: AGORA }
).length);
checar('período sem resposta devolve média null', null,
  resumirAvaliacao([fb('admin', 5, { createdAt: atras(100) })], { dias: 30, agora: AGORA }).media);

// ───────────────────────── 6. momento ──────────────────────────────────────

bloco('6. Por momento');

const m = resumirAvaliacao(
  [
    fb('admin', 5, { momento: 'fim_da_rota' }),
    fb('admin', 3, { momento: 'fim_da_rota' }),
    fb('parent', 4, { momento: 'dia_entregue' }),
    fb('acompanhante', 2, { momento: 'acompanhamento' }),
    fb('parent', 1, { momento: 'perfil' }),
    fb('parent', 1),
    fb('parent', 1),
    fb('parent', 1),
    fb('parent', 5, { momento: 'inventado' }),
  ],
  { agora: AGORA }
);
checar(
  'ordem: mais respostas primeiro, sem momento por último',
  ['fim_da_rota', 'acompanhamento', 'dia_entregue', 'perfil', 'sem_momento'].sort().join(),
  m.porMomento.map((x) => x.momento).sort().join()
);
checar('o sem momento fica por último', 'sem_momento', m.porMomento[m.porMomento.length - 1].momento);
checar('o com mais respostas vem primeiro', 'fim_da_rota', m.porMomento[0].momento);
checar('média do fim da rota', 4, m.porMomento[0].media);
checar('momento inventado cai em sem momento (3 + 1)', 4,
  m.porMomento.find((x) => x.momento === 'sem_momento').n);
checar('rótulo legível', 'Fim da rota', m.porMomento[0].rotulo);

// ───────────────────────── 7. comentários ──────────────────────────────────

bloco('7. O que escreveram');

const c = resumirAvaliacao(
  [
    fb('admin', 5, { comment: 'Ajuda muito', authorName: 'João da Silva', momento: 'fim_da_rota', createdAt: atras(3) }),
    fb('parent', 1, { comment: '  Trava no mapa  ', authorName: 'Maria Souza', momento: 'dia_entregue', createdAt: atras(1) }),
    fb('acompanhante', 4, { comment: 'Fácil', authorName: 'Tia Rita', momento: 'acompanhamento', createdAt: atras(2) }),
    fb('parent', 5, { comment: '   ', createdAt: atras(1) }),
    fb('parent', 2, { comment: 'Lento', createdAt: atras(10) }),
  ],
  { agora: AGORA }
);
checar('só quem escreveu entra', 4, c.comentarios.length);
checar('mais novo primeiro', ['Trava no mapa', 'Fácil', 'Ajuda muito', 'Lento'], c.comentarios.map((x) => x.texto));
checar('texto sai sem espaço nas pontas', 'Trava no mapa', c.comentarios[0].texto);
checar('motorista: primeiro nome', 'João', c.comentarios.find((x) => x.grupo === 'motorista').nome);
checar('família: nunca o nome', null, c.comentarios.find((x) => x.grupo === 'familia').nome);
checar('link: nunca o nome', null, c.comentarios.find((x) => x.grupo === 'link').nome);
checar('nome da família não aparece em lugar nenhum do JSON', false,
  /Maria|Souza|Rita/.test(JSON.stringify(c)));
checar('família leva papel e momento', ['Família', 'Filho entregue'],
  [c.comentarios[0].rotuloDoGrupo, c.comentarios[0].rotuloDoMomento]);

checar('filtro todos', 4, filtrarComentarios(c.comentarios, 'todos').length);
checar('filtro notas 1 e 2', ['Trava no mapa', 'Lento'],
  filtrarComentarios(c.comentarios, 'baixas').map((x) => x.texto));
checar('filtro motoristas', ['Ajuda muito'],
  filtrarComentarios(c.comentarios, 'motorista').map((x) => x.texto));
checar('filtro famílias exclui o link', ['Trava no mapa', 'Lento'],
  filtrarComentarios(c.comentarios, 'familia').map((x) => x.texto));
checar('filtro desconhecido vale todos', 4, filtrarComentarios(c.comentarios, 'xis').length);
checar('lista inválida não quebra', [], filtrarComentarios(null, 'baixas'));

const muitos = Array.from({ length: 80 }, (_, i) =>
  fb('parent', 4, { comment: `c${i}`, createdAt: atras(i % 20) }));
checar('a lista de comentários tem teto', 60, resumirAvaliacao(muitos, { agora: AGORA }).comentarios.length);

// ───────────────────────── 8. interruptor ──────────────────────────────────

bloco('8. A pergunta está ligada?');

checar('ausente é ligada', true, perguntaLigada({}));
checar('sem config é ligada', true, perguntaLigada(undefined));
checar('false explícito desliga', false, perguntaLigada({ avaliacaoRapida: false }));
checar('true liga', true, perguntaLigada({ avaliacaoRapida: true }));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
