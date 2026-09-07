/**
 * OS CHAMADOS DE SUPORTE — a caixa que recebia e ninguém lia.
 *
 * POR QUE ESTE TESTE
 * O defeito que ele previne não é de cálculo: é de ORDEM. Uma caixa de suporte
 * ordenada como caixa de e-mail — mais recente no topo — enterra exatamente
 * quem espera há mais tempo, que é quem some sem avisar. E o sintoma nunca
 * aparece: a tela funciona, os chamados estão todos lá, e um deles vai
 * envelhecendo no fim da lista.
 *
 * O outro é a diferença entre zero e ausência, de novo: "ninguém esperando" e
 * "chegou hoje e ainda não respondi" são situações opostas, e as duas dariam 0.
 *
 * COMO RODAR
 *   node scripts/testar-chamados.mjs      (ou: npm run testar:chamados)
 */

import {
  ABERTO,
  FECHADO,
  RESPONDIDO,
  aguardando,
  diasEsperando,
  mensagemDeResposta,
  ordenarChamados,
  resumirChamados,
} from '../src/dominio/suporte/chamados.js';

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

const antigo = { id: 'a', status: ABERTO, role: 'admin', createdAt: dia('2026-09-12') };
const recente = { id: 'b', status: ABERTO, role: 'parent', createdAt: dia('2026-09-15') };
const meio = { id: 'c', status: ABERTO, role: 'parent', createdAt: dia('2026-09-14') };
const respondido = { id: 'd', status: RESPONDIDO, role: 'admin', createdAt: dia('2026-09-01') };
const fechado = { id: 'e', status: FECHADO, role: 'parent', createdAt: dia('2026-09-10') };

// ───────────────────────────── quem espera ─────────────────────────────────

bloco('1. Quem está esperando');

checar('aberto espera', true, aguardando(antigo));
checar('respondido não', false, aguardando(respondido));
checar('fechado não', false, aguardando(fechado));

// ⚠️ CHAMADO SEM STATUS É ABERTO, NUNCA O CONTRÁRIO. Documento antigo, ou
// gravado por uma versão que não tinha o campo, tem que APARECER na fila —
// sumir é o defeito que este arquivo inteiro existe para evitar.
checar('sem status, conta como aberto', true, aguardando({ id: 'x' }));
checar('status desconhecido não some da fila', false, aguardando({ status: 'sei_la' }));

bloco('2. Há quantos dias espera');

checar('três dias', 3, diasEsperando(antigo, HOJE));
// Zero é "chegou hoje", e é diferente de `null`, que é "não está esperando".
checar('chegou hoje é zero, não nulo', 0, diasEsperando(recente, HOJE));
checar('já respondido não conta dias', null, diasEsperando(respondido, HOJE));
checar('sem data não inventa', null, diasEsperando({ status: ABERTO }, HOJE));

// ───────────────────────────── a ordem ─────────────────────────────────────

bloco('3. A ordem é a ESPERA, não a data');

// ⚠️ O DEFEITO QUE ESTE BLOCO PREVINE: ordenar como caixa de e-mail — mais
// recente no topo — enterra quem espera há mais tempo no fim da lista. E o
// sintoma nunca aparece: a tela funciona, os chamados estão todos lá.
const ordenada = ordenarChamados([fechado, recente, respondido, antigo, meio]);
checar(
  'esperando primeiro, do mais antigo ao mais novo',
  ['a', 'c', 'b'],
  ordenada.slice(0, 3).map((c) => c.id)
);
// Entre os já tratados a pergunta é outra — "o que aconteceu por último" —,
// então ali a ordem se inverte.
checar(
  'tratados depois, do mais recente ao mais velho',
  ['e', 'd'],
  ordenada.slice(3).map((c) => c.id)
);
checar('lista vazia não quebra', [], ordenarChamados([]));
checar('lista ausente também não', [], ordenarChamados(undefined));

// ───────────────────────────── o resumo ────────────────────────────────────

bloco('4. O resumo que a fila do dia consome');

const resumo = resumirChamados([fechado, recente, respondido, antigo, meio], HOJE);
checar('cinco no total', 5, resumo.total);
checar('três esperando', 3, resumo.esperando);
// Chamado de responsável NÃO é chamado de motorista: ele é cliente do
// motorista, e responder direto passa por cima de quem presta o serviço.
checar('um de motorista', 1, resumo.deMotorista);
checar('dois de responsável', 2, resumo.deResponsavel);

// ⚠️ A CONTAGEM SOZINHA NÃO DISTINGUE um chamado de três dias de dez que
// chegaram hoje — e as duas situações pedem coisas diferentes.
checar('o que mais espera, em dias', 3, resumo.esperandoHaMais);

bloco('5. Zero e ausência, de novo');

const soHoje = resumirChamados([recente], HOJE);
checar('um chegou hoje: espera zero dias', 0, soHoje.esperandoHaMais);
const semNinguem = resumirChamados([respondido, fechado], HOJE);
// "Ninguém esperando" e "chegou hoje" dariam 0 os dois. São opostos.
checar('ninguém esperando: não medido', null, semNinguem.esperandoHaMais);
checar('e zero na contagem', 0, semNinguem.esperando);
checar('caixa vazia não quebra', 0, resumirChamados().total);

// ───────────────────────────── a resposta ──────────────────────────────────

bloco('6. A resposta carrega o que a pessoa escreveu');

const texto = mensagemDeResposta(
  { nome: 'Ana Maria Souza', description: 'O mapa não mostra a perua desde ontem.' },
  'Mapa não mostra a perua'
);
checar('só o primeiro nome', true, texto.startsWith('Oi Ana!'));
// ENTRE ABRIR O CHAMADO E RECEBER A RESPOSTA PASSARAM DIAS, e ela já não lembra
// qual dos problemas dela é este. "Sobre o que você me escreveu" obriga a
// pessoa a adivinhar.
checar('repete o que ela escreveu', true, texto.includes('não mostra a perua desde ontem'));
checar('e diz a categoria', true, texto.includes('mapa não mostra a perua'));
checar('sem nome não quebra', true, mensagemDeResposta({}).startsWith('Oi!'));

// Descrição longa é cortada — a resposta é o começo de uma conversa, não a
// devolução do texto inteiro.
const longo = mensagemDeResposta({ description: 'x'.repeat(400) });
checar('descrição longa é cortada com reticências', true, longo.includes('…'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
