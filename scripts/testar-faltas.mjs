/**
 * Testes da conta de faltas — Node puro, sem runner, como o resto de scripts/.
 * Rodar: node scripts/testar-faltas.mjs
 */
import {
  dataDaChave, chaveDoMes, somaMeses, rotuloDoMes, faltasDoMes, resumoDeFaltas,
} from '../src/utils/faltas.js';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

console.log('\n\x1b[1m1. A chave vira data no fuso LOCAL\x1b[0m');
// `new Date('2026-08-29')` é parseado como UTC e vira dia 28 no Brasil.
eq('dia 29 continua 29', dataDaChave('2026-08-29').getDate(), 29);
eq('mês é 0-based por dentro', dataDaChave('2026-08-29').getMonth(), 7);
eq('formato errado devolve null', dataDaChave('29/08/2026'), null);
eq('vazio devolve null', dataDaChave(''), null);

console.log('\n\x1b[1m2. Aritmética de mês atravessa o ano\x1b[0m');
eq('mês anterior', somaMeses('2026-01', -1), '2025-12');
eq('mês seguinte', somaMeses('2026-12', 1), '2027-01');
eq('doze pra trás', somaMeses('2026-08', -12), '2025-08');
eq('rótulo por extenso', rotuloDoMes('2026-08'), 'agosto de 2026');

console.log('\n\x1b[1m3. Faltas do mês saem ordenadas e sem vizinho\x1b[0m');
const hist = [
  { dateKey: '2026-08-05' }, { dateKey: '2026-08-20' },
  { dateKey: '2026-07-31' }, { dateKey: '2026-09-01' },
];
eq('só as de agosto', faltasDoMes(hist, '2026-08').map(a => a.dateKey),
   ['2026-08-20', '2026-08-05']);
eq('mês vazio devolve lista vazia', faltasDoMes(hist, '2026-06'), []);
eq('histórico ausente não quebra', faltasDoMes(null, '2026-08'), []);

console.log('\n\x1b[1m4. O resumo NÃO conta o que ainda não aconteceu\x1b[0m');
const hoje = new Date(2026, 7, 29); // 29/08/2026
const r = resumoDeFaltas([
  { dateKey: '2026-08-05' },  // passou, mês corrente
  { dateKey: '2026-08-29' },  // hoje conta
  { dateKey: '2026-09-02' },  // futura: combinado, não falta
  { dateKey: '2026-07-10' },  // mês anterior
], hoje);
eq('no mês corrente', r.noMes, 2);
eq('total já ocorrido', r.total, 3);
eq('futuras contadas à parte', r.futuras, 1);

console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${falhou} falharam\x1b[0m`);
process.exit(falhou ? 1 : 0);
