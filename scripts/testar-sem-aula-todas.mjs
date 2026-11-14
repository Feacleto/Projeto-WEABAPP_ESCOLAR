/**
 * "NÃO TEM AULA" PARA TODAS AS ESCOLAS — confirmação e contagem.
 * Node puro, sem runner: node scripts/testar-sem-aula-todas.mjs
 * (npm run testar:sem-aula-todas)
 *
 * Prova a régua (`src/dominio/escola/avisoSemAula.js`): o número é de
 * FAMÍLIAS com conta (irmãos contam uma vez, quem não entrou não conta),
 * "todas" pede confirmação e uma escola não, e o envio sai escola por escola.
 * Por leitura de arquivo: a folha usa a régua e o catálogo, só confirma em
 * "todas", e o lote do serviço continua 15.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TODAS_AS_ESCOLAS,
  ofereceTodas,
  precisaConfirmar,
  criancasDeTodas,
  familiasComConta,
  envioPorEscola,
} from '../src/dominio/escola/avisoSemAula.js';
import {
  textoDaConfirmacaoSemAula,
  textoDoBotaoSemAulaTodas,
} from '../src/marca/valorDosAvisos.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

// Duas escolas: Ana e Pedro são irmãos (mesma conta), Lia não entrou no app,
// Theo está na outra escola, Bia foi tirada da turma.
const escolaA = { id: 'eA', nome: 'Escola A', legada: false, criancas: [
  { id: 'ana', parentUid: 'mae1' },
  { id: 'pedro', parentUid: 'mae1' },
  { id: 'lia', parentUid: null },
  { id: 'bia', parentUid: 'mae9', active: false },
] };
const escolaH = { id: 'legado:h', nome: 'Escola H', legada: true, criancas: [{ id: 'theo', parentUid: 'mae2' }] };
const opcoes = [escolaA, escolaH];

console.log('\n\x1b[1m1. O número é de famílias com conta\x1b[0m');
const todas = criancasDeTodas(opcoes);
eq('todas as crianças ativas das duas escolas', todas.map((c) => c.id), ['ana', 'pedro', 'lia', 'theo']);
eq('irmãos contam uma vez, quem não entrou não conta: 2 famílias', familiasComConta(todas), 2);
eq('criança inativa não conta', familiasComConta([{ parentUid: 'x', active: false }]), 0);
eq('lista vazia ou torta dá zero', [familiasComConta([]), familiasComConta(null), familiasComConta([null, {}])], [0, 0, 0]);
eq('a mesma criança em duas opções não repete', criancasDeTodas([escolaA, escolaA]).length, 3);

console.log('\n\x1b[1m2. Só "todas" pede confirmação\x1b[0m');
eq('todas: confirma', precisaConfirmar(TODAS_AS_ESCOLAS), true);
eq('uma escola: direto, como hoje', [precisaConfirmar('eA'), precisaConfirmar('legado:h'), precisaConfirmar('')], [false, false, false]);
eq('a opção aparece com duas escolas', ofereceTodas(opcoes), true);
eq('e não aparece com uma só', ofereceTodas([escolaA]), false);
eq('escola sem criança não conta como escola', ofereceTodas([escolaA, { id: 'v', criancas: [] }]), false);

console.log('\n\x1b[1m3. O envio sai escola por escola, só com as marcadas\x1b[0m');
const envio = envioPorEscola(opcoes, new Set(['lia']));
eq('uma entrada por escola', envio.map((e) => e.escola.id), ['eA', 'legado:h']);
eq('sem a desmarcada e sem a inativa', envio[0].criancas.map((c) => c.id), ['ana', 'pedro']);
eq('escola com tudo desmarcado fica de fora (sem histórico vazio)',
  envioPorEscola(opcoes, new Set(['theo'])).map((e) => e.escola.id), ['eA']);
eq('desmarcadas como array também valem', envioPorEscola(opcoes, ['ana', 'pedro', 'lia']).map((e) => e.escola.id), ['legado:h']);

console.log('\n\x1b[1m4. O texto da confirmação\x1b[0m');
eq('com famílias', textoDaConfirmacaoSemAula(2), 'Vai avisar 2 famílias. O aviso não volta.');
eq('uma família no singular', textoDaConfirmacaoSemAula(1), 'Vai avisar 1 família. O aviso não volta.');
eq('ninguém no app: não promete aviso, diz que a falta fica',
  textoDaConfirmacaoSemAula(0), 'Nenhuma família entrou no app. As faltas ficam marcadas.');
eq('número torto vale como zero', [textoDaConfirmacaoSemAula(-3), textoDaConfirmacaoSemAula(NaN), textoDaConfirmacaoSemAula(undefined)]
  .every((t) => t.startsWith('Nenhuma')), true);
eq('o botão com o número de famílias', [textoDoBotaoSemAulaTodas(2), textoDoBotaoSemAulaTodas(1), textoDoBotaoSemAulaTodas(0)],
  ['Avisar 2 famílias', 'Avisar 1 família', 'Marcar as faltas']);

console.log('\n\x1b[1m5. A folha usa a régua e o catálogo\x1b[0m');
const folha = semComentarios(ler('src/components/broadcasts/SchoolBroadcastSheet.jsx'));
eq('importa a régua de dominio/escola', /dominio\/escola\/avisoSemAula\.js/.test(folha), true);
eq('importa o catálogo', /marca\/valorDosAvisos\.js/.test(folha), true);
eq('a confirmação mostra o texto do catálogo com a contagem de famílias',
  /\{textoDaConfirmacaoSemAula\(familias\)\}/.test(folha), true);
eq('a contagem vem de familiasComConta sobre as marcadas', /familiasComConta\(alcancadas\)/.test(folha), true);
eq('o envio só pede confirmação por precisaConfirmar', /precisaConfirmar\(escolaId\) && !confirmando/.test(folha), true);
eq('"todas" envia pela régua, escola por escola', /envioPorEscola\(opcoes, desmarcadas\)/.test(folha), true);
eq('o texto de confirmação não está escrito à mão', /O aviso não volta/.test(folha), false);
const servico = ler('src/services/broadcastService.js');
eq('o lote do serviço continua 15 (as rules não aguentam mais)', /const CHUNK = 15;/.test(servico), true);

console.log('\n\x1b[1m6. Sonda positiva\x1b[0m');
eq('contar crianças em vez de famílias daria 3, não 2', todas.filter((c) => c.parentUid).length, 3);
eq('uma folha que confirmasse sempre seria pega',
  /precisaConfirmar\(escolaId\) && !confirmando/.test('if (!confirmando) { setConfirmando(true); }'), false);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
