/**
 * QUAL ABA DO RODAPÉ ESTÁ ATIVA — a conta que três telas compartilham.
 *
 * POR QUE ESTE TESTE
 * O rodapé usa esta resposta para pôr a pastilha, e os dois layouts usam a
 * MESMA resposta para decidir de que lado a tela entra. Se ela errar, os dois
 * erram juntos e em direções que não combinam: a pastilha vai para um lado e a
 * tela entra pelo outro.
 *
 * E o caso que mais importa é o `-1`. A maior parte das telas do app NÃO é
 * aba — `/tio/children`, `/tio/route`, `/tio/agenda` —, e uma pastilha parada
 * numa das duas colunas ali diria que a pessoa está numa aba em que ela não
 * está. Errar isso é o app mentindo sobre onde a pessoa se encontra.
 *
 * COMO RODAR
 *   node scripts/testar-abas.mjs      (ou: npm run testar:abas)
 */

import { indiceDaAba } from '../src/compartilhado/abaAtiva.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = esperado === obtido;
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${esperado}, veio ${obtido}`);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

/** Os itens reais dos dois layouts. */
const TIO = [
  { to: '/tio', end: true },
  { to: '/tio/finance' },
];
const PAI = [
  { to: '/pai', end: true },
  { to: '/pai/finance' },
];

bloco('1. As duas abas do motorista');

checar('o Início é o índice 0', 0, indiceDaAba('/tio', TIO));
checar('o Financeiro é o 1', 1, indiceDaAba('/tio/finance', TIO));

// ⚠️ `end: true` NO INÍCIO, e é ele que impede a aba de ficar acesa na app
// inteira: sem isso `/tio` casaria com todo caminho que começa com `/tio`, e a
// pastilha nunca sairia da esquerda.
checar('o Início NÃO pega as telas de dentro', -1, indiceDaAba('/tio/children', TIO));
checar('nem a rota', -1, indiceDaAba('/tio/route', TIO));
checar('nem a agenda', -1, indiceDaAba('/tio/agenda', TIO));

// O Financeiro não tem `end`: ele PRECISA continuar aceso nas telas de dentro
// dele, senão a pastilha some no meio de uma navegação que não saiu da aba.
checar('o Financeiro pega o relatório', 1, indiceDaAba('/tio/finance/report', TIO));
checar('e as despesas', 1, indiceDaAba('/tio/finance/expenses', TIO));

bloco('2. O caminho que PARECE do Financeiro e não é');

// ⚠️ A COMPARAÇÃO PRECISA DA BARRA. Com `startsWith('/tio/finance')` puro, um
// caminho como `/tio/financeiro-antigo` acenderia a aba errada — e o erro
// aparece só no dia em que alguém criar essa rota.
checar('prefixo parecido não acende', -1, indiceDaAba('/tio/financeiro', TIO));
checar('nem com sufixo', -1, indiceDaAba('/tio/finance-x', TIO));

bloco('3. As duas abas do responsável');

checar('o Início do pai', 0, indiceDaAba('/pai', PAI));
checar('o Financeiro do pai', 1, indiceDaAba('/pai/finance', PAI));
checar('as faltas não são aba', -1, indiceDaAba('/pai/faltas', PAI));
// As duas listas não se cruzam: um caminho do tio não acende nada no pai.
checar('caminho do tio não acende no pai', -1, indiceDaAba('/tio/finance', PAI));

bloco('4. Entrada torta não derruba a tela');

checar('sem caminho', -1, indiceDaAba(undefined, TIO));
checar('sem itens', -1, indiceDaAba('/tio', undefined));
checar('lista vazia', -1, indiceDaAba('/tio', []));
checar('item sem `to`', -1, indiceDaAba('/tio', [{}]));

bloco('5. A posição da pastilha sai do índice');

// ((i * 2 + 1) / (N * 2)) * 100  →  o centro da coluna, em %.
const centro = (i, n) => ((i * 2 + 1) / (n * 2)) * 100;
checar('duas abas: a primeira em 25%', 25, centro(0, 2));
checar('duas abas: a segunda em 75%', 75, centro(1, 2));
// A fórmula é geral de propósito: uma terceira aba não pede conta nova.
checar('três abas: a do meio em 50%', 50, centro(1, 3));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
