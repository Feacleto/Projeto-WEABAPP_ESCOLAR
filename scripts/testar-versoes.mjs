/**
 * A VERSÃO DO APP (04/10/2026) — `npm run testar:versoes`.
 *
 * Mede a régua de `src/compartilhado/versaoDoApp.js`: o número sobe de um em
 * um por publicação, o da frente só por decisão, v1.10 vem depois de v1.9, e
 * o texto do suporte cabe no limite que as rules impõem a `version` (40).
 * E confere, por leitura de arquivo, que o build e o script usam a MESMA
 * régua — uma segunda conta de "qual é a próxima" seria uma segunda verdade.
 */
import { readFileSync } from 'node:fs';
import {
  dataPorExtenso,
  lerMarca,
  nomeDaVersao,
  ordenarMarcas,
  proximaMarca,
  textoParaSuporte,
} from '../src/compartilhado/versaoDoApp.js';

let ok = 0;
let falhas = 0;
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) ok += 1;
  else falhas += 1;
  console.log(`  ${igual ? 'ok ' : 'FALHOU'}  ${nome}${igual ? '' : ` — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

console.log('1. Ler e nomear');
checar('v1.12 vira maior 1, menor 12', { maior: 1, menor: 12 }, lerMarca('v1.12'));
checar('nome sem o v', '1.12', nomeDaVersao('v1.12'));
checar('marca de outra coisa não é versão', null, lerMarca('teste-1'));
checar('três partes não é versão', null, lerMarca('v1.2.3'));

console.log('2. A próxima');
checar('sem nenhuma, a primeira marcada é a 1.1 (a 1.0 foi o número fixo)', 'v1.1', proximaMarca(null));
checar('de um em um', 'v1.13', proximaMarca('v1.12'));
checar('de 1.9 para 1.10 (número, não texto)', 'v1.10', proximaMarca('v1.9'));
checar('o da frente só por decisão', 'v2.0', proximaMarca('v1.37', { maior: true }));
checar('depois do 2.0, 2.1', 'v2.1', proximaMarca('v2.0'));

console.log('3. Ordem');
checar('v1.10 é mais nova que v1.9', ['v2.0', 'v1.10', 'v1.9', 'v1.0'],
  ordenarMarcas(['v1.9', 'v1.0', 'v2.0', 'v1.10', 'lixo']));
checar('sem marcas, lista vazia', [], ordenarMarcas([]));

console.log('4. O que a pessoa e o suporte leem');
checar('data por extenso', '4 de outubro', dataPorExtenso('2026-10-04T15:00:00'));
checar('data inválida não inventa', null, dataPorExtenso('não é data'));
checar('suporte: versão e commit', '1.12 · commit 391 (abc1234)',
  textoParaSuporte({ versao: '1.12', commit: '391', hash: 'abc1234' }));
checar('suporte sem commit (dev)', 'dev', textoParaSuporte({}));
const longo = textoParaSuporte({ versao: '1.13-prévia', commit: '123456', hash: 'abcdef1234' });
checar('cabe no limite de 40 das rules', true, longo.length <= 40);

console.log('5. Uma régua só');
const vite = readFileSync('vite.config.js', 'utf8');
const script = readFileSync('scripts/versao.mjs', 'utf8');
checar('o build usa a régua', true, /from '\.\/src\/compartilhado\/versaoDoApp\.js'/.test(vite));
checar('o script usa a régua', true, /from '\.\.\/src\/compartilhado\/versaoDoApp\.js'/.test(script));
checar('o build não conta commits como versão', false, /versao: `1\.\$\{commits\}`/.test(vite));
checar('o script recusa commit sujo', true, /status --porcelain/.test(script));

console.log(`\n${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
