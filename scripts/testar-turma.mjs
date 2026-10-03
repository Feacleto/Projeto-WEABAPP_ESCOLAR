/**
 * Quem entrou e quem saiu da turma — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:turma
 *
 * POR QUE ISTO EXISTE
 * "Turma e contratos" diz, mês a mês, quem entrou e quem saiu. A saída só tem
 * data desde outubro de 2026 (`children.inativadoEm`); antes disso a tela não
 * pode afirmar "0 saíram" — ela não sabe. O teste trava as duas metades:
 * a conta do mês e a honestidade sobre o mês sem dado.
 */
import {
  INICIO_DAS_SAIDAS,
  frasesDoMovimento,
  mesDe,
  mesesAte,
  movimentoDaTurma,
  resumoDaTurma,
} from '../src/dominio/identidade/movimentoDaTurma.js';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}

const ts = (a, m, d) => ({ toDate: () => new Date(a, m - 1, d, 12) });

console.log('\n1. os meses');
igual('seis para trás', mesesAte('2026-10', 6), ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
igual('vira o ano', mesesAte('2026-02', 3), ['2026-02', '2026-01', '2025-12']);
igual('mês de Timestamp', mesDe(ts(2026, 10, 3)), '2026-10');
igual('mês de nada', mesDe(null), null);
igual('saídas contadas desde', INICIO_DAS_SAIDAS, '2026-10');

console.log('2. entradas e saídas');
const criancas = [
  { name: 'Lucas', active: true, createdAt: ts(2026, 10, 2) },
  { name: 'Helena', active: true, createdAt: ts(2026, 10, 1) },
  { name: 'Bruno', active: false, createdAt: ts(2026, 3, 1), inativadoEm: ts(2026, 10, 2) },
  { name: 'Júlia', active: true, createdAt: ts(2026, 9, 15) },
  { name: 'Rafael', active: false, createdAt: ts(2026, 2, 1) },
  { name: '', active: true, createdAt: ts(2026, 8, 5) },
  { name: 'Ana', active: true },
];
const mov = movimentoDaTurma({ criancas, mesAtual: '2026-10', meses: 4 });
igual('outubro', mov[0], { mes: '2026-10', entraram: ['Helena', 'Lucas'], sairam: ['Bruno'], saidasContadas: true });
igual('setembro: sem dado de saída', mov[1], { mes: '2026-09', entraram: ['Júlia'], sairam: [], saidasContadas: false });
igual('sem nome não some', mov[2].entraram, ['Sem nome']);
igual('mês vazio', mov[3], { mes: '2026-07', entraram: [], sairam: [], saidasContadas: false });
igual('saiu sem data não aparece em mês nenhum', mov.some((m) => m.sairam.includes('Rafael')), false);

console.log('3. o resumo da porta');
igual('outubro', resumoDaTurma({ criancas, mes: '2026-10' }), { ativas: 5, entraram: 2, sairam: 1 });
igual('mês sem dado de saída: null, nunca 0', resumoDaTurma({ criancas, mes: '2026-09' }), { ativas: 5, entraram: 1, sairam: null });
igual('turma vazia', resumoDaTurma({ criancas: [], mes: '2026-10' }), { ativas: 0, entraram: 0, sairam: 0 });

console.log('4. as frases');
igual('singular', frasesDoMovimento({ entraram: 1, sairam: 1 }), { entraram: '1 entrou', sairam: '1 saiu' });
igual('plural', frasesDoMovimento({ entraram: 2, sairam: 3 }), { entraram: '2 entraram', sairam: '3 saíram' });
igual('zero', frasesDoMovimento({ entraram: 0, sairam: 0 }), { entraram: '0 entraram', sairam: '0 saíram' });
igual('saída sem dado não vira frase', frasesDoMovimento({ entraram: 2, sairam: null }), { entraram: '2 entraram', sairam: null });

console.log(`\n${ok} ok, ${bad} falharam`);
process.exit(bad ? 1 : 0);
