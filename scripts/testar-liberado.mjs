/**
 * O QUE CADA NÍVEL LIBERA — `npm run testar:liberado`.
 *
 * Guarda `src/dominio/identidade/liberadoPorNivel.js` e as três telas que o
 * leem. As regras que este arquivo trava (decisão do dono, 30/10/2026):
 *   1. a Comunidade aparece do Ouro em diante, e nível desconhecido esconde;
 *   2. nenhum recurso escondido é pedido por uma missão de nível mais baixo
 *      (senão a missão é impossível e o motorista trava);
 *   3. a aba e a rota leem a MESMA regra — aba escondida com rota aberta, ou o
 *      contrário, é o app se contradizendo;
 *   4. o pedido de transferência nunca fica sem lugar: abaixo do Ouro ele
 *      aparece no Início;
 *   5. a celebração que cruza o Ouro anuncia a Comunidade, uma vez.
 */
import { readFileSync } from 'node:fs';
import { LIBERA_NO, liberado } from '../src/dominio/identidade/liberadoPorNivel.js';
import { MISSOES, NIVEIS } from '../src/dominio/identidade/nivel.js';
import { itemDoParaVoce } from '../src/dominio/identidade/paraVoce.js';

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
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}
const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

bloco('1. A Comunidade aparece do Ouro em diante');
for (const n of ['sem_nivel', 'bronze', 'prata']) {
  checar(`${n}: escondida`, false, liberado('comunidade', n));
}
for (const n of ['ouro', 'platina', 'diamante']) {
  checar(`${n}: aparece`, true, liberado('comunidade', n));
}
checar('nível ausente esconde', false, liberado('comunidade', undefined));
checar('nível inventado esconde', false, liberado('comunidade', 'esmeralda'));
checar('recurso fora da lista nunca é escondido', true, liberado('carteira', 'sem_nivel'));
checar('todo recurso aponta para um nível que existe', [],
  Object.entries(LIBERA_NO).filter(([, r]) => !NIVEIS.includes(r.nivel)).map(([k]) => k));

bloco('2. Nenhuma missão pede o que ainda está escondido');
for (const [recurso, regra] of Object.entries(LIBERA_NO)) {
  const impossiveis = MISSOES
    .filter((m) => m.destino && m.destino.startsWith(regra.rota))
    .filter((m) => !liberado(recurso, m.nivel))
    .map((m) => m.id);
  checar(`${recurso}: nenhuma missão abaixo do nível pede a rota`, [], impossiveis);
}
// Sonda positiva: uma missão de Bronze apontando para a Comunidade PRECISA ser pega.
const sonda = MISSOES.concat([{ id: 'sonda', nivel: 'bronze', destino: '/tio/comunidade' }])
  .filter((m) => m.destino?.startsWith(LIBERA_NO.comunidade.rota))
  .filter((m) => !liberado('comunidade', m.nivel))
  .map((m) => m.id);
checar('sonda: missão de Bronze na Comunidade seria acusada', ['sonda'], sonda);

bloco('3. A aba e a rota leem a mesma regra');
const layout = ler('src/pages/tio/TioLayout.jsx');
checar('o menu filtra a aba da Comunidade pela regra', true,
  /ABA_DA_COMUNIDADE\s*\|\|\s*comunidadeLiberada/.test(layout) && /liberado\('comunidade'/.test(layout));
const app = ler('src/App.jsx');
checar('a rota da Comunidade passa pelo guarda de nível', true,
  /path="comunidade"\s+element=\{<SoNoNivel recurso="comunidade"><TioComunidade/.test(app));
checar('o guarda usa a mesma regra', true, /function SoNoNivel[\s\S]{0,400}liberado\(recurso, nivel\)/.test(app));

bloco('4. O pedido de transferência nunca fica sem lugar');
const inicio = ler('src/pages/tio/TioDashboard.jsx');
checar('abaixo do Ouro, o Início mostra os pedidos', true,
  /!comunidadeLiberada[\s\S]{0,120}<PedidosParaVoce\s*\/>/.test(inicio));
checar('a Comunidade continua mostrando os pedidos', true,
  /<PedidosParaVoce\s*\/>/.test(ler('src/pages/tio/TioComunidade.jsx')));

bloco('5. A celebração do Ouro anuncia a Comunidade, uma vez');
const base = { foraDaRota: true, emDia: true };
const cruzou = itemDoParaVoce({ ...base, nivel: 'ouro', nivelVisto: 'prata' });
checar('cruzou o Ouro: leva para a Comunidade', '/tio/comunidade', cruzou?.destino);
checar('e a frase cabe em 10 palavras', true, cruzou.frase.split(/\s+/).length <= 10);
const pulou = itemDoParaVoce({ ...base, nivel: 'platina', nivelVisto: 'prata' });
checar('pulou da Prata para a Platina: também anuncia', '/tio/comunidade', pulou?.destino);
const depois = itemDoParaVoce({ ...base, nivel: 'platina', nivelVisto: 'ouro' });
checar('Ouro → Platina: não anuncia de novo', '/tio/nivel', depois?.destino);
const prata = itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'bronze' });
checar('Prata: celebração comum, sem Comunidade', '/tio/nivel', prata?.destino);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
