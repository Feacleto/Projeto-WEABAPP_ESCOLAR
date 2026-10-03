/**
 * A CHAVE DA COBRANÇA E OS MÓDULOS — `npm run testar:modulos`.
 *
 * Guarda as regras de src/dominio/associacao/modulosDeCobranca.js e o espelho
 * delas em functions/lib/reguaDaCobranca.js. As duas precisam responder igual:
 * se divergirem, a tela promete um desconto que o servidor não concede (ou o
 * contrário), e nada quebra para avisar.
 *
 * As regras que este arquivo trava (decisões do dono, 02/10/2026):
 *   1. ausente = DESLIGADA, na mestra e em cada módulo;
 *   2. ligar a mestra liga SÓ a base — nenhum desconto acorda junto;
 *   3. desconto ligado sem a base não vale (não há fatura pra descontar);
 *   4. aviso de cobrança some do sino com o módulo dele desligado;
 *   5. módulo com período só vale dentro dele.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { cobrancaLigada } from '../src/dominio/associacao/cobrancaLigada.js';
import {
  MODULO,
  MODULOS_DE_COBRANCA,
  moduloAtivo,
  moduloLigadoNoPainel,
  avisoVisivel,
} from '../src/dominio/associacao/modulosDeCobranca.js';

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

// O espelho do servidor é a regra PURA (sem Firebase), separada de quem lê o
// banco justamente para este teste alcançá-la.
const require = createRequire(import.meta.url);
const servidor = require('../functions/lib/reguaDaCobranca.js');

const DIA = new Date(2027, 0, 20, 12); // 20/01/2027, meio-dia

bloco('1. Ausente é desligada');
checar('sem documento, a cobrança está desligada', false, cobrancaLigada(null));
checar('documento sem o campo, desligada', false, cobrancaLigada({}));
checar('só o true explícito liga', false, cobrancaLigada({ cobrancaLigada: 'sim' }));
checar('true liga', true, cobrancaLigada({ cobrancaLigada: true }));
for (const m of MODULOS_DE_COBRANCA) {
  checar(`sem mestra, o módulo ${m.id} não vale`, false, moduloAtivo({}, m.id, DIA));
}

bloco('2. Ligar a mestra liga só a base');
const soMestra = { cobrancaLigada: true };
checar('a base vale', true, moduloAtivo(soMestra, MODULO.PLANO, DIA));
checar('a escada NÃO acorda junto', false, moduloAtivo(soMestra, MODULO.ESCADA, DIA));
checar('a indicação NÃO acorda junto', false, moduloAtivo(soMestra, MODULO.INDICACAO, DIA));
// O campo antigo da escada não manda mais: `janelaEscada` ausente era "aberta".
checar('o campo antigo janelaEscada não liga a escada', false,
  moduloAtivo({ cobrancaLigada: true, janelaEscada: true }, MODULO.ESCADA, DIA));

bloco('3. Desconto sem a base não vale — mas o painel mostra o que foi gravado');
const soIndicacao = { modulos: { indicacao: true } };
checar('indicação ligada sem a base não vale', false, moduloAtivo(soIndicacao, MODULO.INDICACAO, DIA));
checar('mas o painel mostra o interruptor ligado', true,
  moduloLigadoNoPainel(soIndicacao, MODULO.INDICACAO, DIA));
const baseEIndicacao = { cobrancaLigada: true, modulos: { indicacao: true } };
checar('com a base, a indicação vale', true, moduloAtivo(baseEIndicacao, MODULO.INDICACAO, DIA));
checar('e a escada continua desligada', false, moduloAtivo(baseEIndicacao, MODULO.ESCADA, DIA));
checar('módulo desconhecido nunca vale', false, moduloAtivo(baseEIndicacao, 'inventado', DIA));

bloco('4. O sino');
checar('aviso que não é de cobrança aparece sempre', true, avisoVisivel({}, 'child_arrived_home', DIA));
checar('"seu teste começou" some com a cobrança desligada', false,
  avisoVisivel({}, 'comercial_teste_comecou', DIA));
checar('e volta com a base ligada', true, avisoVisivel(soMestra, 'comercial_teste_comecou', DIA));
checar('aviso de indicação só com o módulo dela', false, avisoVisivel(soMestra, 'indicacao_ativou', DIA));
checar('e volta com ele ligado', true, avisoVisivel(baseEIndicacao, 'indicacao_ativou', DIA));
checar('nenhum tipo de aviso pertence a dois módulos', true, (() => {
  const vistos = MODULOS_DE_COBRANCA.flatMap((m) => m.tiposDeAviso || []);
  return new Set(vistos).size === vistos.length;
})());

bloco('5. Período (o caso sazonal)');
const ferias = (de, ate) => ({ cobrancaLigada: true, modulos: { indicacao: { ativo: true, de, ate } } });
checar('dentro do período vale', true, moduloAtivo(ferias('2027-01-15', '2027-02-15'), MODULO.INDICACAO, DIA));
checar('antes do início não vale', false, moduloAtivo(ferias('2027-02-01', '2027-02-15'), MODULO.INDICACAO, DIA));
checar('depois do fim não vale', false, moduloAtivo(ferias('2027-01-01', '2027-01-10'), MODULO.INDICACAO, DIA));
checar('o último dia ainda vale', true, moduloAtivo(ferias('2027-01-01', '2027-01-20'), MODULO.INDICACAO, DIA));
checar('ativo:false desliga mesmo dentro do período', false,
  moduloAtivo({ cobrancaLigada: true, modulos: { indicacao: { ativo: false } } }, MODULO.INDICACAO, DIA));

bloco('6. Cliente e servidor respondem igual');
const casos = [
  null, {}, soMestra, soIndicacao, baseEIndicacao,
  { cobrancaLigada: true, janelaEscada: true },
  { cobrancaLigada: true, modulos: { escada: true, indicacao: false } },
  ferias('2027-01-15', '2027-02-15'), ferias('2027-02-01', '2027-02-15'),
];
for (const [i, c] of casos.entries()) {
  checar(`caso ${i}: a mestra`, cobrancaLigada(c), servidor.estaLigada(c));
  for (const m of MODULOS_DE_COBRANCA) {
    checar(`caso ${i}: ${m.id}`, moduloAtivo(c, m.id, DIA), servidor.moduloEstaAtivo(c, m.id, DIA));
  }
}
const espelho = readFileSync(new URL('../functions/lib/reguaDaCobranca.js', import.meta.url), 'utf8');
checar('todo módulo do registro existe no espelho do servidor', [],
  MODULOS_DE_COBRANCA.filter((m) => !new RegExp(`\\b${m.id}:`).test(espelho)).map((m) => m.id));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
