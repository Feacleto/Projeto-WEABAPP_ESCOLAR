/**
 * A AUXILIAR NA CENTRAL (05/10/2026) — o espaço "Auxiliar" na rolagem da
 * Carteira e o detalhe atrás da senha.
 *
 *   node scripts/testar-auxiliar-na-central.mjs
 *   (ou: npm run testar:auxiliar-na-central)
 *
 * Leitura de arquivo (as telas importam Firebase) e a régua pura da tranca:
 * a seção mora entre Turma e Sua perua, a porta antiga saiu de Contas, o
 * bloco não imprime dinheiro, o detalhe mora embaixo de /tio/finance — e a
 * régua da tranca concorda que esse caminho pede a senha —, e o endereço
 * velho redireciona em vez de cair no vazio.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { rotaProtegida } from '../src/dominio/identidade/trancaDoFinanceiro.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(nome); console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const central = semComentarios(ler('src/pages/tio/TioFinance.jsx'));
const bloco = semComentarios(ler('src/components/auxiliar/AuxiliarNaCentral.jsx'));
const app = semComentarios(ler('src/App.jsx'));

console.log('\n1. a seção na Carteira, entre Turma e Sua perua');
const iTurma = central.indexOf('>Turma</h2>');
const iAux = central.indexOf('<AuxiliarNaCentral');
const iPerua = central.indexOf('<BlocoSuaPerua');
const iContas = central.indexOf('>Contas</h2>');
checar('a Carteira insere <AuxiliarNaCentral>', true, iAux > -1);
checar('depois de Turma', true, iTurma > -1 && iAux > iTurma);
checar('antes de Sua perua', true, iPerua > -1 && iAux < iPerua);
checar('o bloco tem o título "Auxiliar"', true, />Auxiliar<\/h2>/.test(bloco));
checar('sonda: a busca da ordem enxerga Contas depois da perua', true, iContas > iPerua);

console.log('\n2. a porta antiga saiu de Contas');
const contas = central.slice(iContas);
checar('nenhuma Porta "Auxiliar" em Contas', false, /titulo="Auxiliar"/.test(contas));
checar('sonda: a Porta de Despesas continua lá', true, /titulo="Despesas do mês"/.test(contas));

console.log('\n3. nenhum valor em dinheiro no bloco');
checar('sem "R$"', false, /R\$/.test(bloco));
checar('sem formatCurrency / reais()', false, /formatCurrency|reais\(/.test(bloco));
checar('sem valorMensal', false, /valorMensal/.test(bloco));
checar('as linhas das próximas fases entram pela prop', true, /linhasDaAuxiliar\(a\)/.test(bloco));
checar('um só botão cheio na Carteira: o bloco não usa bg-primary cheio', false, /\bbg-primary\b/.test(bloco));

console.log('\n4. o detalhe atrás da senha, e o endereço velho redireciona');
checar('rota finance/auxiliar → TioAuxiliar', true, /path="finance\/auxiliar"\s+element=\{<TioAuxiliar \/>\}/.test(app));
checar('rota velha "auxiliar" redireciona com replace', true,
  /path="auxiliar"\s+element=\{<Navigate to="\/tio\/finance\/auxiliar" replace \/>\}/.test(app));
checar('a rota velha não renderiza mais a tela', false, /path="auxiliar"\s+element=\{<TioAuxiliar/.test(app));
checar('a régua da tranca protege /tio/finance/auxiliar', true, rotaProtegida('/tio/finance/auxiliar'));
checar('sonda: /tio/auxiliar (velho) não é protegido — por isso redireciona', false, rotaProtegida('/tio/auxiliar'));

console.log('\n5. ninguém navega mais para o endereço velho');
function arquivos(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(jsx?|mjs)$/.test(nome)) out.push(p);
  }
  return out;
}
const raiz = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const todos = arquivos(decodeURIComponent(raiz));
checar('sonda: a varredura acha a Carteira', true, todos.some((p) => p.endsWith('TioFinance.jsx')));
const sobras = todos
  .filter((p) => /['"`]\/tio\/auxiliar(?![\w/-])/.test(semComentarios(readFileSync(p, 'utf8'))));
checar('nenhum "/tio/auxiliar" em src/', [], sobras);
checar('sonda: o padrão casa o endereço velho', true, /['"`]\/tio\/auxiliar(?![\w/-])/.test("navigate('/tio/auxiliar')"));
checar('sonda: o padrão não casa o novo', false, /['"`]\/tio\/auxiliar(?![\w/-])/.test("navigate('/tio/finance/auxiliar')"));

console.log(`\n${ok} passaram, ${bad} falharam`);
if (bad) {
  console.log(falhas.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
