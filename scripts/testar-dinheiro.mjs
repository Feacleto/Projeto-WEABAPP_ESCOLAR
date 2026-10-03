/**
 * O campo de dinheiro — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:dinheiro
 *
 * POR QUE ISTO EXISTE
 * O `CampoDeValor` mostra o valor como no extrato ("1.200,00"), escreve
 * embaixo por extenso e aceita o valor DITO. As três conversões moram em
 * src/compartilhado/dinheiro.js e são o lugar onde um erro vira mensalidade
 * errada sem ninguém perceber: o extenso é justamente a conferência, então
 * extenso errado é a conferência mentindo. Este teste trava as três, e trava
 * também que nenhum campo de dinheiro do app volte a ser `type="number"`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  textoDoValor,
  valorDoDigitado,
  valorPorExtenso,
  valorDoQueFoiDito,
} from '../src/compartilhado/dinheiro.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (obtido === esperado) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}

console.log('\n1. o texto do campo');
igual('vazio', textoDoValor(''), '');
igual('inteiro', textoDoValor('350'), '350,00');
igual('milhar', textoDoValor('1200.5'), '1.200,50');
igual('número', textoDoValor(1234567.8), '1.234.567,80');

console.log('2. o que se digita (caixa eletrônico)');
igual('nada', valorDoDigitado(''), '');
igual('um dígito', valorDoDigitado('5'), '0.05');
igual('com máscara', valorDoDigitado('1.200,505'), '12005.05');
igual('zeros à esquerda', valorDoDigitado('0,00'), '');
igual('apagar volta casa', valorDoDigitado('350,0'), '35.00');
igual('teto de 9 dígitos', valorDoDigitado('99999999999'), '9999999.99');

console.log('3. por extenso');
const extensos = [
  [0, ''],
  [1, 'um real'],
  [2, 'dois reais'],
  [0.5, 'cinquenta centavos'],
  [0.01, 'um centavo'],
  [15, 'quinze reais'],
  [21, 'vinte e um reais'],
  [100, 'cem reais'],
  [101, 'cento e um reais'],
  [350, 'trezentos e cinquenta reais'],
  [450.9, 'quatrocentos e cinquenta reais e noventa centavos'],
  [1000, 'mil reais'],
  [1050, 'mil e cinquenta reais'],
  [1200, 'mil e duzentos reais'],
  [1230, 'mil duzentos e trinta reais'],
  [2500, 'dois mil e quinhentos reais'],
  [12000, 'doze mil reais'],
  [1000000, 'um milhão de reais'],
  [1200000, 'um milhão e duzentos mil reais'],
  ['1200.50', 'mil e duzentos reais e cinquenta centavos'],
];
for (const [v, e] of extensos) igual(`extenso ${v}`, valorPorExtenso(v), e);

console.log('4. o que se fala');
const falas = [
  ['350 reais', '350.00'],
  ['R$ 1.200,50', '1200.50'],
  ['r$ 450', '450.00'],
  ['trezentos e cinquenta', '350.00'],
  ['trezentos e cinquenta reais', '350.00'],
  ['mil e duzentos reais e cinquenta centavos', '1200.50'],
  ['1200 reais e 50 centavos', '1200.50'],
  ['dois mil', '2000.00'],
  ['2 mil', '2000.00'],
  ['2 mil e 500', '2500.00'],
  ['quinhentos e 50', '550.00'],
  ['cento e vinte reais', '120.00'],
  ['um real', '1.00'],
  ['cinquenta centavos', '0.50'],
  ['vinte vírgula cinquenta', '20.50'],
  ['2.500', '2500.00'],
  ['são 380 reais', '380.00'],
  ['quatorze', '14.00'],
  ['catorze', '14.00'],
  ['oi tudo bem', null],
  ['', null],
  ['zero', null],
];
for (const [f, e] of falas) igual(`dito "${f}"`, valorDoQueFoiDito(f), e);

console.log('5. ida e volta: o que se fala de volta é o que se digitou');
for (const v of ['350.00', '1200.50', '2500.00', '0.50', '1.00', '99.99']) {
  igual(`ida e volta ${v}`, valorDoQueFoiDito(valorPorExtenso(v)), v);
}

console.log('6. nenhum campo de dinheiro volta a ser type="number"');
for (const arq of [
  'src/components/children/ChildForm.jsx',
  'src/components/contract/EditarCombinadoSheet.jsx',
  // A despesa é lançada na folha desde 03/10/2026 — a tela de despesas a abre.
  'src/components/financeiro/FolhaDeDespesa.jsx',
]) {
  const fonte = readFileSync(join(raiz, arq), 'utf8');
  igual(`${arq} usa CampoDeValor`, fonte.includes('<CampoDeValor'), true);
}

console.log(`\n  ${ok} passaram, ${bad} falharam\n`);
process.exit(bad ? 1 : 0);
