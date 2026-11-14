/**
 * "A FAMÍLIA DE X ENTROU" — o aviso ao motorista no resgate do convite.
 * Node puro, sem runner: node scripts/testar-familia-entrou.mjs
 * (npm run testar:familia-entrou)
 *
 * Duas metades:
 *  1. a régua (`functions/lib/reguaDaFamiliaEntrou.js`): a quem vai, o id
 *     determinístico, e quando NÃO sai (irmão, sem motorista, id torto);
 *  2. a costura, por leitura de arquivo: `redeemInvite` escreve com
 *     `create()` (reentrega não duplica), FORA da transação, e o vínculo de
 *     irmão não escreve este tipo. Espécie e destino nos dois lados.
 *
 * O que só o emulador prova (a escrita de verdade) está em
 * `testar-familia-entrou-servidor.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { especieDoAviso, ESPECIE } from '../src/dominio/identidade/avisos.js';
import { destinoDoAviso } from '../src/dominio/identidade/destinoDoAviso.js';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const R = require('../functions/lib/reguaDaFamiliaEntrou.js');
const avisosServidor = require('../functions/lib/avisos.js');
const destinoServidor = require('../functions/lib/destinoDoAviso.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

const crianca = { name: 'Ana Clara', adminUid: 'tio1', parentUid: 'mae1', monthlyFee: 350 };

console.log('\n\x1b[1m1. A régua\x1b[0m');
eq('vai para o MOTORISTA da criança, com o tipo e a criança', R.avisoDaFamiliaEntrou(crianca, 'c1'), {
  userId: 'tio1',
  type: 'familia_entrou',
  childId: 'c1',
  title: 'A família de Ana entrou',
  body: 'A mensalidade dela passa a aparecer na Carteira.',
});
eq('sem valor, o corpo diz o que falta',
  R.avisoDaFamiliaEntrou({ ...crianca, monthlyFee: 0 }, 'c1').body,
  'Cadastre o valor da mensalidade para ela aparecer na Carteira.');
eq('valor em texto ou ausente conta como sem valor',
  [R.avisoDaFamiliaEntrou({ ...crianca, monthlyFee: 'abc' }, 'c1').body,
    R.avisoDaFamiliaEntrou({ ...crianca, monthlyFee: undefined }, 'c1').body].every((b) => b.startsWith('Cadastre')), true);
eq('valor em texto numérico conta como valor', R.avisoDaFamiliaEntrou({ ...crianca, monthlyFee: '350' }, 'c1').body.startsWith('A mensalidade'), true);
eq('vínculo de IRMÃO não avisa', R.avisoDaFamiliaEntrou({ ...crianca, vinculadoPor: 'irmao' }, 'c1'), null);
eq('criança sem motorista não avisa ninguém', R.avisoDaFamiliaEntrou({ ...crianca, adminUid: null }, 'c1'), null);
eq('motorista com barra no uid não vira caminho', R.avisoDaFamiliaEntrou({ ...crianca, adminUid: 'a/b' }, 'c1'), null);
eq('id de criança com barra não vira caminho', R.avisoDaFamiliaEntrou(crianca, 'c1/rides/x'), null);
eq('sem criança, nada', [R.avisoDaFamiliaEntrou(null, 'c1'), R.avisoDaFamiliaEntrou(undefined, 'c1')], [null, null]);
eq('o aviso não carrega dado da família (telefone, e-mail, endereço)',
  Object.keys(R.avisoDaFamiliaEntrou({ ...crianca, parentPhone: '11999', parentEmail: 'x@y', address: 'Rua' }, 'c1')).sort(),
  ['body', 'childId', 'title', 'type', 'userId']);

console.log('\n\x1b[1m2. O id determinístico\x1b[0m');
eq('o id é familia_entrou_{childId}', R.idDoAvisoDaFamiliaEntrou('c1'), 'familia_entrou_c1');
eq('o mesmo resgate dá o mesmo id', R.idDoAvisoDaFamiliaEntrou('abcXYZ_-9'), R.idDoAvisoDaFamiliaEntrou('abcXYZ_-9'));
eq('crianças diferentes, ids diferentes', R.idDoAvisoDaFamiliaEntrou('c1') !== R.idDoAvisoDaFamiliaEntrou('c2'), true);
eq('id torto é recusado', [R.idDoAvisoDaFamiliaEntrou(''), R.idDoAvisoDaFamiliaEntrou('a/b'), R.idDoAvisoDaFamiliaEntrou(null), R.idDoAvisoDaFamiliaEntrou('..')], [null, null, null, null]);

console.log('\n\x1b[1m3. Espécie e destino, nos dois lados\x1b[0m');
eq('é FATO no cliente (não se desliga)', especieDoAviso('familia_entrou'), ESPECIE.FATO);
eq('está na TABELA do cliente, não no padrão', /\n\s*familia_entrou: ESPECIE\.FATO,/.test(ler('src/dominio/identidade/avisos.js')), true);
eq('é FATO no servidor', avisosServidor.ESPECIE_DO_AVISO.familia_entrou, 'fato');
eq('toca mesmo com prazo e oferta desligados', avisosServidor.tocaNoAparelho('familia_entrou', ['prazo', 'oferta']), true);
eq('leva o tio à ficha da criança', destinoDoAviso({ type: 'familia_entrou', childId: 'c1' }, 'admin'), '/tio/children/c1');
eq('o servidor leva ao mesmo lugar', destinoServidor.destinoDoAviso({ type: 'familia_entrou', childId: 'c1' }, 'admin'), '/tio/children/c1');

console.log('\n\x1b[1m4. A costura em redeemInvite\x1b[0m');
const invites = semComentarios(ler('functions/lib/invites.js'));
const fimDaTransacao = invites.indexOf("logger.info('Convite resgatado'");
const chamada = invites.indexOf('await avisarQueAFamiliaEntrou(db, avisoAoMotorista)');
eq('redeemInvite usa a régua', /require\('\.\/reguaDaFamiliaEntrou'\)/.test(invites), true);
eq('o aviso é escrito DEPOIS da transação (falhar não desfaz o vínculo)',
  chamada > 0 && fimDaTransacao > 0 && chamada > fimDaTransacao, true);
const corpo = invites.slice(invites.indexOf('async function avisarQueAFamiliaEntrou'));
eq('com create() no id determinístico — reentrega não duplica',
  /db\.doc\(`notifications\/\$\{id\}`\)\.create\(/.test(corpo), true);
eq('nunca set() nem add() para este aviso',
  /notifications\/\$\{id\}`\)\.set\(|collection\('notifications'\)\.add\(/.test(corpo.slice(0, corpo.indexOf('\n}\n'))), false);
eq('o "já existe" é engolido, não vira erro', /err\?\.code === 6/.test(corpo), true);
const transacao = invites.slice(invites.indexOf('db.runTransaction'), fimDaTransacao);
eq('nada de notifications dentro da transação', /notifications/.test(transacao), false);
eq('a transação ainda recusa convite já usado (a reentrega para antes)',
  transacao.includes("child.inviteStatus !== 'pending'"), true);

console.log('\n\x1b[1m5. O vínculo automático de irmão não fala "entrou"\x1b[0m');
const irmao = ler('functions/lib/vincularIrmao.js');
eq('vincularIrmao não escreve familia_entrou', /familia_entrou|reguaDaFamiliaEntrou/.test(irmao), false);
eq('vincularIrmao marca vinculadoPor irmao (o que a régua recusa)', /vinculadoPor: 'irmao'/.test(irmao), true);

console.log('\n\x1b[1m6. Sonda positiva\x1b[0m');
// A mesma conferência da seção 4, contra o redeemInvite de ANTES (sem aviso)
// e contra um que escrevesse dentro da transação.
const avisaDepoisDaTransacao = (t) => {
  const fim = t.indexOf("logger.info('Convite resgatado'");
  const ch = t.indexOf('await avisarQueAFamiliaEntrou(db, avisoAoMotorista)');
  return ch > 0 && fim > 0 && ch > fim;
};
eq('a conferência aprova o arquivo de hoje', avisaDepoisDaTransacao(invites), true);
eq('e reprova o redeemInvite sem aviso (o de antes)',
  avisaDepoisDaTransacao(invites.replace('await avisarQueAFamiliaEntrou(db, avisoAoMotorista)', '')), false);
eq('um add() solto seria pego', /collection\('notifications'\)\.add\(/.test("await db.collection('notifications').add({"), true);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
