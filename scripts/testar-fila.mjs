/**
 * A FILA DO DIA — o que precisa de você hoje.
 *
 * POR QUE ESTE TESTE
 * Uma fila errada não dá erro: ela dá uma manhã perdida. E os dois jeitos de
 * errar aqui são opostos —
 *
 *   ENCHER: quatro sinais do mesmo motorista viram quatro linhas, o contador
 *   diz "7" onde o dia tem três conversas, e o dono aprende a rolar por cima
 *   da tela. Fila que nunca esvazia deixa de ser lida.
 *
 *   ESVAZIAR DEMAIS: a linha que importava não aparece, e ninguém percebe —
 *   porque uma fila curta parece um dia tranquilo.
 *
 * COMO RODAR
 *   node scripts/testar-fila.mjs      (ou: npm run testar:fila)
 */

import {
  DIAS_SEM_COMECAR,
  TESTE_ACABANDO,
  montarFila,
  pendenciaDoMotorista,
  resumirFila,
} from '../src/dominio/associacao/fila.js';

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

/** Há N dias, a partir de hoje. */
const atras = (n) => new Date(HOJE.getTime() - n * 24 * 60 * 60 * 1000);

const pendencia = (motorista, extra = {}) =>
  pendenciaDoMotorista({ motorista, agora: HOJE, ...extra });

// ───────────────────────── quem NÃO entra ──────────────────────────────────

bloco('1. Quem não entra na fila');

// ⚠️ QUEM SUSPENDEU FOI O DONO. Pôr isso na fila é a tela cobrando dele uma
// decisão que ele já tomou.
checar('suspenso não é pendência', null,
  pendencia({ uid: 'a', name: 'Suspenso', suspenso: true, ultimaRota: atras(90) }));

// Contratado, pagando, rodando: não há o que fazer com ele hoje.
checar('quem está bem não entra', null,
  pendencia({
    uid: 'b', name: 'Em Dia', planoId: 'p1',
    trialInicio: atras(200), assinaturaAte: dia('2026-12-01'),
    ultimaRota: atras(1),
  }));

// Cadastrou HOJE e não rodou: ainda não é um problema, é uma pessoa nova.
checar('cadastrou ontem e não rodou ainda não entra', null,
  pendencia({ uid: 'c', name: 'Novo', createdAt: atras(1) }));

// ───────────────────────── uma linha por pessoa ────────────────────────────

bloco('2. Uma linha por motorista, a mais urgente');

// ⚠️ ESTE É O CASO CENTRAL. Quatro sinais ao mesmo tempo — parou de rodar, a
// fatura venceu, encolheu, as famílias reclamam — e sai UMA linha. Quatro
// fariam o contador dizer que o dia tem quatro conversas quando tem uma.
const tudoDeRuim = pendencia(
  {
    uid: 'd', name: 'Carlos Souza', planoId: 'p1',
    trialInicio: atras(200), assinaturaAte: dia('2026-12-01'),
    ultimaRota: atras(30),
  },
  {
    faturas: [
      { mes: '2026-07', criancasAtivas: 20, status: 'quitada' },
      { mes: '2026-08', criancasAtivas: 12, status: 'aberta', vencimento: atras(20) },
    ],
    nota: { media: 2.4, n: 8 },
  }
);
checar('quatro sinais viram uma linha', true, tudoDeRuim !== null);
checar('e o nível é alto', 'alto', tudoDeRuim.nivel);
// O primeiro sinal é o título; os outros viram detalhe, não linha.
checar('o título é o motivo mais forte', true, tudoDeRuim.titulo.includes('não roda há 30 dias'));
checar('e os outros três estão no detalhe', 3, tudoDeRuim.detalhe.split(' · ').length);
checar('a linha abre a ficha dele', { aba: 'motoristas', uid: 'd' }, tudoDeRuim.destino);

// ───────────────────────── a ordem de urgência ─────────────────────────────

bloco('3. O que ganha de quê');

// A conta bloqueada vem antes de tudo: ele não consegue trabalhar AGORA.
const bloqueado = pendencia({
  uid: 'e', name: 'Bloqueado', trialInicio: atras(120), ultimaRota: atras(60),
});
checar('bloqueio ganha do termômetro', true, bloqueado.titulo.includes('terminou o teste'));
checar('e é alto', 'alto', bloqueado.nivel);

// ⚠️ O TESTE ACABANDO GANHA DO RISCO, E O MOTIVO É A DATA: a conversa do risco
// pode ser amanhã, esta não pode.
const acabando = pendencia({
  uid: 'f', name: 'Nino', trialInicio: atras(86), ultimaRota: atras(20),
});
checar('teste acabando ganha do risco', true, acabando.titulo.includes('acaba em 4 dias'));
checar('quatro dias é médio', 'medio', acabando.nivel);

const ultimoDia = pendencia({
  uid: 'g', name: 'Ultimo', trialInicio: atras(89), ultimaRota: atras(1),
});
checar('um dia é alto', 'alto', ultimoDia.nivel);

// Faixa: 8 dias ainda não é conversa de fim de teste.
checar('oito dias de teste ainda não entra por isso', null,
  pendencia({ uid: 'h', name: 'Tranquilo', trialInicio: atras(82), ultimaRota: atras(1) }));

bloco('4. Quem cadastrou e não começou');

const naoComecou = pendencia({ uid: 'i', name: 'Parado', createdAt: atras(9) });
checar('entra depois de três dias', true, naoComecou !== null);
// ⚠️ É O NÍVEL MAIS BAIXO DE PROPÓSITO: ele não está saindo, ele não conseguiu
// entrar — e é o mais barato de resolver.
checar('e é o nível mais baixo', 'baixo', naoComecou.nivel);
checar('com os dias dentro', true, naoComecou.titulo.includes('9 dias'));
checar('sem data de cadastro, não inventa', null,
  pendencia({ uid: 'j', name: 'Sem Data' }));

// ───────────────────────── a fila montada ──────────────────────────────────

bloco('5. A fila inteira, na ordem');

const parceiros = [
  // baixo
  { uid: 'i', name: 'Parado', createdAt: atras(9) },
  // médio (teste acabando em 4)
  { uid: 'f', name: 'Nino', trialInicio: atras(86), ultimaRota: atras(1) },
  // alto (bloqueado)
  { uid: 'e', name: 'Bloqueado', trialInicio: atras(120), ultimaRota: atras(60) },
  // nada
  {
    uid: 'b', name: 'Em Dia', planoId: 'p1',
    trialInicio: atras(200), assinaturaAte: dia('2026-12-01'), ultimaRota: atras(1),
  },
];

const fila = montarFila({ parceiros, agora: HOJE });
checar('só entra quem tem pendência', 3, fila.length);
checar('e a ORDEM é a urgência', ['alto', 'medio', 'baixo'], fila.map((i) => i.nivel));

// ⚠️ A COR NÃO É O ÚNICO SINAL. Quem não distingue âmbar de vermelho lê de
// cima para baixo e recebe a mesma prioridade — por isso a ordem carrega o
// mesmo dado que a cor.
checar('o resumo conta tudo', { total: 3, alto: 1, medio: 1, baixo: 1 }, resumirFila(fila));
checar('fila vazia resume em zero', { total: 0, alto: 0, medio: 0, baixo: 0 },
  resumirFila(montarFila({ parceiros: [], agora: HOJE })));

bloco('6. Dentro do nível, quem espera há mais tempo');

const doisAltos = montarFila({
  parceiros: [
    { uid: 'k', name: 'Recente', trialInicio: atras(95), ultimaRota: atras(9) },
    { uid: 'l', name: 'Antigo', trialInicio: atras(95), ultimaRota: atras(9) },
  ],
  agora: HOJE,
});
// Empate real de espera: o desempate é o TÍTULO, que é estável. Sem isso a
// fila se reordena a cada render e a linha foge do dedo de quem ia tocá-la.
checar('empate se resolve pelo título', ['Antigo terminou o teste e não contratou',
  'Recente terminou o teste e não contratou'], doisAltos.map((i) => i.titulo));

// ───────────────────────── chamados ────────────────────────────────────────

bloco('7. Os chamados são linha por chamado');

// E aqui a exceção à regra de uma linha por pessoa: cada chamado é uma
// resposta diferente, mesmo vindo da mesma pessoa.
const comChamados = montarFila({
  parceiros: [],
  chamados: [
    { id: 'c1', status: 'open', role: 'admin', createdAt: atras(4) },
    { id: 'c2', status: 'open', role: 'parent', createdAt: HOJE },
    { id: 'c3', status: 'fechado', role: 'admin', createdAt: atras(30) },
  ],
  agora: HOJE,
});
checar('chamado fechado não entra', 2, comChamados.length);
checar('dois dias esperando já é alto', 'alto', comChamados[0].nivel);
checar('e diz de quem é', 'de um motorista', comChamados[0].detalhe);
checar('chegou hoje ainda é médio', 'medio', comChamados[1].nivel);
checar('a linha abre a caixa', { aba: 'chamados' }, comChamados[0].destino);

// ───────────────────────── o fechamento do mês ─────────────────────────────

bloco('8. O fechamento do mês é UMA linha');

// ⚠️ VINTE FATURAS POR FECHAR SÃO UM GESTO NA ABA MÊS, não vinte pendências.
// Uma linha por fatura enterraria as conversas do dia debaixo de trabalho que
// se resolve num clique.
const comContrato = (uid, name) => ({
  uid, name, planoId: 'p1',
  trialInicio: atras(200), assinaturaAte: dia('2026-12-01'), ultimaRota: atras(1),
});
const fechamento = montarFila({
  parceiros: [comContrato('m', 'Um'), comContrato('n', 'Dois'), comContrato('o', 'Tres')],
  mes: '2026-09',
  agora: HOJE,
});
checar('três faturas por fechar, uma linha', 1, fechamento.length);
checar('e ela diz quantas', true, fechamento[0].titulo.startsWith('3 faturas de 2026-09'));
checar('leva para a aba Mês', { aba: 'mes' }, fechamento[0].destino);

// Fechadas: a linha some. É a prova de que a fila ESVAZIA.
const jaFechadas = montarFila({
  parceiros: [comContrato('m', 'Um'), comContrato('n', 'Dois')],
  faturas: { m: [{ mes: '2026-09', status: 'aberta', vencimento: dia('2026-09-30') }],
    n: [{ mes: '2026-09', status: 'quitada' }] },
  mes: '2026-09',
  agora: HOJE,
});
checar('fechadas, a linha some', 0, jaFechadas.length);

// ⚠️ QUEM ESTÁ EM TESTE NÃO TEM FATURA A FECHAR. Contá-lo aqui seria a tela
// ajudando a cobrar quem ainda não contratou.
checar('quem não tem faixa não conta', 1, montarFila({
  parceiros: [{ uid: 'p', name: 'Testando', trialInicio: atras(10), ultimaRota: atras(1) },
    comContrato('q', 'Pagante')],
  mes: '2026-09',
  agora: HOJE,
}).length);

bloco('9. As réguas estão onde foram combinadas');

checar('uma semana de teste acende', 7, TESTE_ACABANDO);
checar('três dias sem começar acende', 3, DIAS_SEM_COMECAR);
checar('entrada vazia não quebra', [], montarFila());
checar('motorista sem uid não vira linha', null, pendenciaDoMotorista({ motorista: {} }));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
