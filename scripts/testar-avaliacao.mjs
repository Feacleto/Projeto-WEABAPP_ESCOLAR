/**
 * A AVALIAÇÃO RÁPIDA — cinco rostos no Início e no link (03/10/2026).
 *
 * POR QUE ESTE TESTE
 * O pedido de avaliação anterior não coletava nada e ninguém percebeu: ele
 * dependia de uma janela que nascia fechada, e prometia publicar numa home
 * que não existia mais. Nada quebrava — o cartão só não aparecia.
 *
 * Este teste trava as quatro coisas que fazem o cartão novo valer:
 *   1. NUNCA com a rota rodando — o motorista está dirigindo com criança.
 *   2. O momento de cada papel e a cadência (5º dia, 60 e 14 dias).
 *   3. O espelho do servidor (quem avalia pelo link) igual ao domínio.
 *   4. Nada promete "home": a avaliação não é publicada em lugar nenhum.
 *
 * COMO RODAR
 *   node scripts/testar-avaliacao.mjs      (ou: npm run testar:avaliacao)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  COMENTARIO_MAX,
  DIAS_DEPOIS_DE_DISPENSAR,
  DIAS_DEPOIS_DE_RESPONDER,
  DIAS_MINIMOS,
  MOMENTOS_DO_CLIENTE,
  PAPEL_DA_AVALIACAO,
  ROSTOS,
  aconteceuHoje,
  avaliacaoLigada,
  comentarioLimpo,
  deveMostrarAvaliacao,
  notaValida,
  notasBaixasDeMotorista,
  perguntaDaAvaliacao,
  registrarDia,
} from '../src/dominio/suporte/avaliacaoRapida.js';
import { montarFila } from '../src/dominio/associacao/fila.js';

const require = createRequire(import.meta.url);
const servidor = require('../functions/lib/reguaDaAvaliacao.js');

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

const ler = (p) => readFileSync(p, 'utf8');
const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-10-03T15:00:00');
const atras = (dias) => new Date(AGORA.getTime() - dias * DIA);

/** Tudo certo para aparecer — cada caso tira uma coisa. */
const PODE = {
  ligada: true,
  rotaRodando: false,
  momentoHoje: true,
  diasComMomento: DIAS_MINIMOS,
  ultimaResposta: null,
  dispensadaEm: null,
  agora: AGORA,
};

// ─────────────────────────────── 1. quando ─────────────────────────────────
bloco('1. QUANDO APARECE');
checar('tudo certo → aparece', true, deveMostrarAvaliacao(PODE));
checar('⚠️ rota rodando → nunca', false, deveMostrarAvaliacao({ ...PODE, rotaRodando: true }));
checar(
  '⚠️ rota rodando vence até o resto todo certo e sem histórico',
  false,
  deveMostrarAvaliacao({ ...PODE, rotaRodando: true, diasComMomento: 99 })
);
checar('dono desligou → não', false, deveMostrarAvaliacao({ ...PODE, ligada: false }));
checar('o momento não aconteceu hoje → não', false, deveMostrarAvaliacao({ ...PODE, momentoHoje: false }));
checar(`dia ${DIAS_MINIMOS - 1} → ainda não`, false, deveMostrarAvaliacao({ ...PODE, diasComMomento: DIAS_MINIMOS - 1 }));
checar('o 5º dia é o mínimo', 5, DIAS_MINIMOS);
checar(
  `respondeu há ${DIAS_DEPOIS_DE_RESPONDER - 1} dias → não`,
  false,
  deveMostrarAvaliacao({ ...PODE, ultimaResposta: atras(DIAS_DEPOIS_DE_RESPONDER - 1) })
);
checar(
  `respondeu há ${DIAS_DEPOIS_DE_RESPONDER + 1} dias → volta`,
  true,
  deveMostrarAvaliacao({ ...PODE, ultimaResposta: atras(DIAS_DEPOIS_DE_RESPONDER + 1) })
);
checar(
  `"Agora não" há ${DIAS_DEPOIS_DE_DISPENSAR - 1} dias → não`,
  false,
  deveMostrarAvaliacao({ ...PODE, dispensadaEm: atras(DIAS_DEPOIS_DE_DISPENSAR - 1) })
);
checar(
  `"Agora não" há ${DIAS_DEPOIS_DE_DISPENSAR + 1} dias → volta`,
  true,
  deveMostrarAvaliacao({ ...PODE, dispensadaEm: atras(DIAS_DEPOIS_DE_DISPENSAR + 1) })
);
checar('60 e 14 dias', [60, 14], [DIAS_DEPOIS_DE_RESPONDER, DIAS_DEPOIS_DE_DISPENSAR]);
checar(
  'a resposta como milissegundos (o que o aparelho guarda) também conta',
  false,
  deveMostrarAvaliacao({ ...PODE, ultimaResposta: atras(3).getTime() })
);

// ──────────────────────────── 2. contagem de dias ──────────────────────────
bloco('2. A CONTAGEM DOS DIAS');
checar('dia novo entra', ['2026-10-01', '2026-10-02'], registrarDia(['2026-10-01'], '2026-10-02'));
checar('o mesmo dia não conta duas vezes', ['2026-10-01'], registrarDia(['2026-10-01'], '2026-10-01'));
checar('lixo sai', ['2026-10-01', '2026-10-02'], registrarDia([null, 3, '2026-10-01'], '2026-10-02'));
checar('guarda só os últimos dez', 10, registrarDia(Array.from({ length: 12 }, (_, i) => `d${i}`), 'novo').length);
checar('sem lista anterior', ['2026-10-03'], registrarDia(undefined, '2026-10-03'));
checar('rodou hoje cedo → aconteceu hoje', true, aconteceuHoje(new Date('2026-10-03T06:40:00'), AGORA));
checar('rodou ontem → não', false, aconteceuHoje(new Date('2026-10-02T17:00:00'), AGORA));
checar('nunca rodou → não', false, aconteceuHoje(null, AGORA));
checar('Timestamp do Firestore', true, aconteceuHoje({ toMillis: () => new Date('2026-10-03T07:00:00').getTime() }, AGORA));

// ──────────────────────────────── 3. pergunta ──────────────────────────────
bloco('3. A PERGUNTA DE CADA PAPEL — sempre sobre o APP');
checar('motorista', 'Como o app te ajudou na rota de hoje?', perguntaDaAvaliacao({ papel: 'admin' }));
checar(
  'responsável, com o primeiro nome',
  'Como foi acompanhar o dia de Lucas pelo app?',
  perguntaDaAvaliacao({ papel: 'parent', crianca: 'Lucas Andrade' })
);
checar('acompanhante', 'Foi fácil acompanhar Lucas hoje?', perguntaDaAvaliacao({ papel: 'acompanhante', crianca: 'Lucas' }));
checar(
  'segundo responsável',
  'Foi fácil acompanhar Lucas hoje?',
  perguntaDaAvaliacao({ papel: 'segundo_responsavel', crianca: 'Lucas' })
);
for (const papel of Object.values(PAPEL_DA_AVALIACAO)) {
  const p = perguntaDaAvaliacao({ papel, crianca: 'Lucas' }).toLowerCase();
  checar(`${papel}: a pergunta não avalia o motorista`, false, /motorista|\btio\b/.test(p) && papel !== 'admin');
}
checar('cinco rostos, do pior ao melhor', [1, 2, 3, 4, 5], ROSTOS.map((r) => r.nota));
checar(
  'rótulos do Itaú',
  ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Muito boa'],
  ROSTOS.map((r) => r.rotulo)
);
checar('comentário de até 140', 140, COMENTARIO_MAX);

// ───────────────────────────── 4. o espelho ────────────────────────────────
bloco('4. O ESPELHO DO SERVIDOR');
checar('mesmo teto de comentário', COMENTARIO_MAX, servidor.COMENTARIO_MAX);
for (const n of [-1, 0, 1, 2, 3, 4, 5, 6, 2.5, '3', null, undefined, NaN]) {
  checar(`nota ${String(n)}`, notaValida(n), servidor.notaValida(n));
}
for (const t of ['', '  oi  ', 'x'.repeat(200), null, undefined, 123]) {
  checar(`comentário ${JSON.stringify(t)?.slice(0, 20)}`, comentarioLimpo(t), servidor.comentarioLimpo(t));
}
for (const c of [null, undefined, {}, { avaliacaoRapida: true }, { avaliacaoRapida: false }, { reviewOpen: false }]) {
  checar(`interruptor ${JSON.stringify(c)}`, avaliacaoLigada(c), servidor.avaliacaoLigada(c));
}
checar('⚠️ ausente é LIGADA', true, avaliacaoLigada({}));
checar('o reviewOpen antigo não desliga nada', true, avaliacaoLigada({ reviewOpen: false }));
checar('papéis sem conta iguais', [PAPEL_DA_AVALIACAO.ACOMPANHANTE, PAPEL_DA_AVALIACAO.SEGUNDO_RESPONSAVEL], [
  servidor.PAPEL.ACOMPANHANTE,
  servidor.PAPEL.SEGUNDO_RESPONSAVEL,
]);

bloco('5. O LINK PEDE A AVALIAÇÃO?');
checar('entregue, nunca avaliou → pede', true, servidor.pedirAvaliacaoNoLink({ estado: 'entregue', avaliadoEm: null, config: null }));
checar('na perua → não', false, servidor.pedirAvaliacaoNoLink({ estado: 'na_perua', avaliadoEm: null, config: null }));
checar('já avaliou por este link → não', false, servidor.pedirAvaliacaoNoLink({ estado: 'entregue', avaliadoEm: 1, config: null }));
checar(
  'dono desligou → não',
  false,
  servidor.pedirAvaliacaoNoLink({ estado: 'entregue', avaliadoEm: null, config: { avaliacaoRapida: false } })
);
const doc = servidor.documentoDaAvaliacao({
  papel: 'acompanhante',
  nota: 4,
  comentario: ' tudo certo ',
  childId: 'c1',
  adminUid: 'm1',
});
checar(
  'o documento tem a lista fechada',
  ['adminUid', 'allowPhoto', 'allowTestimonial', 'answers', 'childId', 'comment', 'hiddenByOwner', 'momento', 'role', 'uid'],
  Object.keys(doc).sort()
);
checar('nunca público', [false, true], [doc.allowTestimonial, doc.hiddenByOwner]);
checar('momento do link', 'acompanhamento', doc.momento);
checar('o momento do link NÃO é do cliente', false, MOMENTOS_DO_CLIENTE.includes('acompanhamento'));
checar('comentário limpo', 'tudo certo', doc.comment);

// ──────────────────────────────── 6. a fila ────────────────────────────────
bloco('6. NOTA BAIXA DE MOTORISTA VIRA CONVERSA NA FILA');
const av = (uid, nota, dias, role = 'admin', comment = '') => ({
  uid,
  role,
  answers: { rating: nota },
  comment,
  createdAt: atras(dias),
});
const baixas = notasBaixasDeMotorista(
  [av('a', 1, 1), av('a', 2, 3), av('b', 3, 1), av('c', 2, 9), av('d', 1, 1, 'parent')],
  { agora: AGORA }
);
checar('só motorista, nota 1–2, últimos 7 dias, a mais recente', { a: 1 }, Object.fromEntries(Object.entries(baixas).map(([k, v]) => [k, v.nota])));
const parceiroOk = { uid: 'a', name: 'Zé Silva', plano: 'mensal', ultimaRota: atras(0), criancasAtivas: 10 };
const fila = montarFila({ parceiros: [parceiroOk], avaliacoes: [av('a', 1, 1, 'admin', 'travou')], agora: AGORA });
const linha = fila.find((i) => i.id === 'motorista:a');
checar('vira uma linha do motorista', 'Zé deu nota "Muito ruim" ao app', linha?.titulo);
checar('o comentário vai de detalhe', '"travou"', linha?.detalhe);
checar('uma linha por motorista', 1, fila.filter((i) => i.id === 'motorista:a').length);
checar('sem nota baixa, nenhuma linha', 0, montarFila({ parceiros: [parceiroOk], avaliacoes: [], agora: AGORA }).length);
checar(
  'suspenso fica fora',
  0,
  montarFila({ parceiros: [{ ...parceiroOk, suspenso: true }], avaliacoes: [av('a', 1, 1)], agora: AGORA }).length
);

// ─────────────────────────── 7. a fiação na tela ───────────────────────────
bloco('7. A FIAÇÃO — leitura de arquivo');
const tio = ler('src/pages/tio/TioDashboard.jsx');
checar('o Início do motorista passa a rota rodando ao cartão', true, /<AvaliacaoNoInicio[\s\S]*?rotaRodando=\{rotaAtiva\}/.test(tio));
checar('o momento do motorista é o fim da rota', true, /<AvaliacaoNoInicio[\s\S]*?MOMENTO\.FIM_DA_ROTA/.test(tio));
const pai = ler('src/pages/pai/PaiDashboard.jsx');
checar('o do responsável é o filho entregue', true, /<AvaliacaoNoInicio[\s\S]*?momentoHoje=\{status === 'delivered'\}/.test(pai));
const inicio = ler('src/components/feedback/AvaliacaoNoInicio.jsx');
checar('o cartão some na hora em que a rota liga', true, /\|\|\s*rotaRodando\)\s*return null/.test(inicio));
const acompanhar = ler('src/pages/Acompanhar.jsx');
checar('a página do link só pede quando o servidor diz', true, acompanhar.includes('dados.avaliacao?.pedir'));
const rules = ler('firestore.rules');
const momentosDasRules = (rules.match(/momento in \[([^\]]*)\]/) || [])[1];
checar(
  'as rules aceitam exatamente os momentos do cliente',
  [...MOMENTOS_DO_CLIENTE].sort(),
  (momentosDasRules || '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean).sort()
);
checar('a callable está exportada', true, ler('functions/index.js').includes('exports.avaliarAcompanhamento'));

// A promessa que motivou tudo: nenhuma tela diz que a avaliação vai pra home.
function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.jsx?$/.test(n) ? [p] : [];
  });
}
// Só telas e componentes: os comentários do domínio CONTAM a história da
// promessa antiga, e é por isso que eles citam a frase.
const prometem = [...arquivos('src/pages'), ...arquivos('src/components')].filter((p) => {
  const t = ler(p);
  return /Enviar para a home|vai pra home|vitrine do app|na home do Alô Buzinou/i.test(t);
});
checar('nenhuma tela promete publicar a avaliação na home', [], prometem);
// Sonda positiva: o detector pega a frase quando ela existe.
checar('sonda: o detector reconhece a frase', true, /Enviar para a home/i.test('<b>Enviar para a home</b>'));

// ──────────────────────────────── resumo ───────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
