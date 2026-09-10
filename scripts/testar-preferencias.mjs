/**
 * PREFERÊNCIA DE AVISO, E O CANAL DE CADA MARCO DA COBRANÇA.
 *
 * Dois consertos que nasceram do mesmo defeito — ninguém tinha o mapa de
 * todos os avisos juntos:
 *
 *   1. O app tinha 31 tipos de aviso e NENHUMA preferência. Quem se irritasse
 *      com uma peça comercial só podia desligar push no sistema operacional,
 *      e aí perdia "Lucas chegou em casa". O maior risco do conjunto, e ele
 *      crescia a cada tipo novo.
 *
 *   2. Dois agendados falavam da MESMA mensalidade para a MESMA família no
 *      mesmo minuto — push e e-mail — em três dos cinco marcos. Cada régua
 *      estava certa sozinha.
 *
 * COMO RODAR
 *   node scripts/testar-preferencias.mjs   (ou: npm run testar:preferencias)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import {
  ESPECIE,
  DESLIGAVEIS,
  ESPECIE_DO_AVISO,
  especieDoAviso,
  podeDesligar,
  tocaNoAparelho,
  normalizarPreferencias,
  CHAVES_DE_AVISO,
} from '../src/dominio/identidade/avisos.js';
// O espelho do servidor: quem aplica o guarda é o `push.js`, que não alcança
// `src/`. A duplicação é obrigatória; o que este arquivo garante é que ela
// não divirja.
import {
  ESPECIE_DO_AVISO as ESPECIE_SERVIDOR,
  tocaNoAparelho as tocaServidor,
} from '../functions/lib/avisos.js';
import {
  CANAL_DO_MARCO,
  pushMandaEm,
  emailMandaEm,
} from '../functions/lib/canalDaCobranca.js';

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

// ═══════════ 1. O QUE NUNCA PODE SER DESLIGADO ═══════════════════════════

bloco('1. Fato e estado não se desligam — um é o produto, o outro é a conta dela');

// ⚠️ O CASO QUE JUSTIFICA A TELA INTEIRA. Alguém desliga tudo o que dá para
// desligar, e a criança chegando em casa CONTINUA tocando. Se este caso
// falhar, a preferência virou o botão que apaga o produto.
const TUDO_DESLIGADO = DESLIGAVEIS;
checar('a criança chegou em casa toca mesmo com tudo desligado', true,
  tocaNoAparelho('child_arrived_home', TUDO_DESLIGADO));
checar('a rota começou também', true, tocaNoAparelho('rota_iniciada', TUDO_DESLIGADO));
checar('o recado do motorista também', true, tocaNoAparelho('agenda_entry', TUDO_DESLIGADO));
checar('a rota atrasada também — é estado', true,
  tocaNoAparelho('rota_atrasada', TUDO_DESLIGADO));
checar('e a conta pausada também', true,
  tocaNoAparelho('comercial_retorno', TUDO_DESLIGADO));

// Sonda positiva: sem ela, uma função que devolvesse `true` sempre passaria
// em todos os casos acima.
checar('mas a oferta cala', false, tocaNoAparelho('comercial_indicacao', TUDO_DESLIGADO));
checar('e o prazo também', false, tocaNoAparelho('payment_due_5d', TUDO_DESLIGADO));

bloco('2. Desligar uma espécie não desliga a outra');

checar('só prazo desligado: a oferta continua', true,
  tocaNoAparelho('comercial_teste_comecou', [ESPECIE.PRAZO]));
checar('só prazo desligado: o prazo cala', false,
  tocaNoAparelho('fatura_vence', [ESPECIE.PRAZO]));
checar('só oferta desligada: o prazo continua', true,
  tocaNoAparelho('payment_overdue_7d', [ESPECIE.OFERTA]));
checar('sem preferência nenhuma, tudo toca', true, tocaNoAparelho('payment_due_0d', []));
checar('e lista ausente também', true, tocaNoAparelho('payment_due_0d'));

bloco('3. Uma preferência inválida não cala o produto');

// ⚠️ Gravar `['fato']` à mão — ou um bug de tela — não pode silenciar a
// chegada da criança. A régua ignora o que não é desligável.
checar('desligar "fato" é ignorado', true, tocaNoAparelho('child_arrived_home', ['fato']));
checar('desligar "estado" é ignorado', true, tocaNoAparelho('rota_atrasada', ['estado']));
checar('lixo na lista é ignorado', true, tocaNoAparelho('rota_iniciada', ['banana']));
checar('e a normalização joga fora o que não vale', [ESPECIE.PRAZO],
  normalizarPreferencias(['fato', 'prazo', 'banana']));
checar('a normalização ordena, para o documento não mudar à toa',
  normalizarPreferencias(['oferta', 'prazo']),
  normalizarPreferencias(['prazo', 'oferta']));

bloco('4. Tipo desconhecido toca — o padrão é o seguro, não o conveniente');

// Tipo novo que alguém esqueceu de classificar continua chegando. Um aviso a
// mais é ruído; um aviso de chegada que não toca é a mãe na calçada.
checar('tipo que ninguém classificou continua tocando', true,
  tocaNoAparelho('tipo_que_nao_existe', TUDO_DESLIGADO));
checar('e a espécie dele é fato', ESPECIE.FATO, especieDoAviso('tipo_que_nao_existe'));
checar('podeDesligar recusa fato', false, podeDesligar(ESPECIE.FATO));
checar('e aceita oferta', true, podeDesligar(ESPECIE.OFERTA));

// ═══════════ 5. TODO TIPO QUE O APP ESCREVE ESTÁ CLASSIFICADO ════════════

bloco('5. Nenhum tipo escapa da tabela');

// ⚠️ ESTE É O CASO QUE ENVELHECE BEM. Ele varre o código procurando o que é
// gravado em `notifications` e exige que cada um tenha espécie. Sem ele, o
// tipo 32 nasceria fora da tabela, cairia no padrão `fato`, e ninguém saberia
// qual chave o desliga — a tela de preferências passaria a mentir por omissão.
const arquivos = [];
for (const raiz of ['src', 'functions/lib']) {
  for (const f of readdirSync(raiz, { recursive: true })) {
    const caminho = `${raiz}/${String(f).split(sep).join('/')}`;
    if (/\.(jsx?|mjs)$/.test(caminho)) arquivos.push(caminho);
  }
}

const tiposNoCodigo = new Set();
for (const f of arquivos) {
  // Os dois arquivos de espécie são a TABELA, não remetentes.
  if (f.endsWith('dominio/identidade/avisos.js')) continue;
  if (f.endsWith('functions/lib/avisos.js')) continue;
  let texto = '';
  try {
    texto = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  // `type: 'algo'` — a forma com que todo remetente grava o documento.
  for (const m of texto.matchAll(/\btype:\s*'([a-z0-9_]+)'/g)) {
    tiposNoCodigo.add(m[1]);
  }
}

// `image/png` e afins entram pelo mesmo padrão; só interessam os que a
// tabela conhece ou deveria conhecer.
const IGNORAR = new Set(['image', 'text']);
const semEspecie = [...tiposNoCodigo]
  .filter((t) => !IGNORAR.has(t) && !t.includes('/'))
  .filter((t) => !(t in ESPECIE_DO_AVISO))
  .sort();

checar('todo tipo gravado em notifications tem espécie', [], semEspecie);
checar('e a varredura realmente encontrou tipos', true, tiposNoCodigo.size > 10);

// ═══════════ 6. O ESPELHO DO SERVIDOR ════════════════════════════════════

bloco('6. As duas tabelas de espécie não divergem');

checar('as duas conhecem os mesmos tipos',
  Object.keys(ESPECIE_DO_AVISO).sort(),
  Object.keys(ESPECIE_SERVIDOR).sort());

const divergentes = Object.keys(ESPECIE_DO_AVISO).filter(
  (t) => ESPECIE_DO_AVISO[t] !== ESPECIE_SERVIDOR[t]
);
checar('e classificam cada um igual', [], divergentes);

// A função também, caso a caso — a tabela pode bater e o guarda divergir.
const CENARIOS = [
  ['child_arrived_home', DESLIGAVEIS],
  ['payment_due_5d', [ESPECIE.PRAZO]],
  ['comercial_indicacao', [ESPECIE.OFERTA]],
  ['comercial_indicacao', []],
  ['rota_atrasada', DESLIGAVEIS],
  ['tipo_inexistente', DESLIGAVEIS],
  ['fatura_vence', ['fato']],
];
CENARIOS.forEach(([tipo, prefs], i) => {
  checar(`espelho do guarda, caso ${i + 1}`,
    tocaNoAparelho(tipo, prefs), tocaServidor(tipo, prefs));
});
// ⚠️ A SONDA ESTAVA COM A POLARIDADE INVERTIDA, e o comentário anunciava
// justamente o que ela não impedia.
//
// Ela esperava `false` — o mesmo valor que uma função gutada a
// `return false` devolveria. Os sete casos de espelho acima comparam as duas
// cópias entre si; com as duas devolvendo `false` sempre, os sete passam E a
// sonda passa junto. Ela só descartava "devolve `true` sempre", que é o
// cenário oposto ao que preocupa aqui.
//
// A sonda certa exige um `true` do servidor: a chegada da criança tocando
// mesmo com tudo desligado é a afirmação mais forte deste arquivo, e é ela
// que uma função gutada a `false` quebraria.
checar('a sonda exige um true do servidor', true,
  tocaServidor('child_arrived_home', DESLIGAVEIS));
checar('e um false, para não ser sempre-verdade', false,
  tocaServidor('payment_due_5d', [ESPECIE.PRAZO]));

bloco('7. A tela mostra só o que dá para desligar');

checar('duas chaves, nem uma a mais', DESLIGAVEIS.length, CHAVES_DE_AVISO.length);
checar('e as duas são desligáveis', true,
  CHAVES_DE_AVISO.every((c) => podeDesligar(c.especie)));
// ⚠️ A FRASE DO PRAZO PRECISA DIZER QUE A DÍVIDA CONTINUA. Sem isso, alguém
// desliga achando que resolveu a cobrança — e descobre no bloqueio.
const prazo = CHAVES_DE_AVISO.find((c) => c.especie === ESPECIE.PRAZO);
checar('a chave de prazo avisa que a cobrança segue', true,
  /cobran|e-mail|continua/i.test(prazo.descricao));

// ═══════════ 8. UM MARCO, UM CANAL ═══════════════════════════════════════

bloco('8. Push e e-mail nunca falam no mesmo dia sobre a mesma mensalidade');

// ⚠️ A REGRA É ESTA, e a divisão em si é julgamento — ver o cabeçalho de
// `canalDaCobranca.js`. Mudar de ideia sobre quem pega qual marco não deve
// quebrar este teste; pôr dois canais no mesmo marco deve.
const MARCOS = Object.keys(CANAL_DO_MARCO).map(Number);
const dobrados = MARCOS.filter((d) => pushMandaEm(d) && emailMandaEm(d));
checar('nenhum marco tem os dois canais', [], dobrados);

const orfaos = MARCOS.filter((d) => !pushMandaEm(d) && !emailMandaEm(d));
checar('e nenhum marco ficou sem canal', [], orfaos);

// Os cinco marcos da régua de push continuam existindo como marcos — o que
// mudou foi quem manda em cada um.
checar('os cinco marcos estão cobertos', [5, 3, 0, -3, -7].sort((a, b) => a - b),
  MARCOS.slice().sort((a, b) => a - b));

// Um dia que ninguém atribuiu não vira dois avisos por omissão.
checar('dia sem marco não é de ninguém — push', false, pushMandaEm(-1));
checar('dia sem marco não é de ninguém — e-mail', false, emailMandaEm(-1));
checar('nem um dia distante', false, pushMandaEm(-90));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
