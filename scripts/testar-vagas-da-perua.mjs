/**
 * A perua em vagas — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:vagas-da-perua
 *
 * POR QUE ISTO EXISTE
 * O dono decidiu (05/10/2026) que o motorista diz quantas VAGAS a perua tem e
 * o app a desenha como o mapa de assentos de um avião. Quatro coisas não podem
 * escorregar, e cada uma tem um bloco aqui:
 *   1. o desenho (fileiras de três, a última com o resto);
 *   2. a conta (abaixo, igual e ACIMA das vagas — e acima nunca é erro);
 *   3. o número que vai para o banco é INTEIRO de 1 a 60 (a rule exige
 *      `is int`; texto de campo ou 15.5 seriam recusados);
 *   4. as telas: a palavra é "vaga", nunca "lugar"; a família e a auxiliar
 *      não alcançam nada de vagas; nenhuma tela da perua convida a pôr foto.
 *   5. a perua UNIFICADA das zonas da rota (05/10/2026): o DESENHO chega à
 *      auxiliar pelas zonas, mas a régua, o hook e o número de vagas não.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  VAGAS_MAXIMO,
  VAGAS_MINIMO,
  VAGAS_SUGERIDAS,
  ehBancoDeTras,
  emOrdemDeCadastro,
  fileirasDaPerua,
  frasesDaPerua,
  limitarVagas,
  ocupacao,
  passaDasVagas,
  vagasDesenhadas,
  vagasParaGravar,
  vagasValidas,
  criancaRapida,
  faltaCompletarOCadastro,
  caminhoDeCompletar,
} from '../src/dominio/identidade/vagasDaPerua.js';
import {
  faltaCompletarCadastro,
  passosQueFaltam,
} from '../src/dominio/identidade/cadastroDoMotorista.js';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}
function lanca(nome, fn) {
  try {
    fn();
    bad++;
    console.log(`  FALHOU ${nome}: devia recusar`);
  } catch {
    ok++;
  }
}

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ler = (rel) => readFileSync(join(RAIZ, rel), 'utf8');
function arquivos(dir) {
  const abs = join(RAIZ, dir);
  let saida = [];
  for (const nome of readdirSync(abs)) {
    const p = join(abs, nome);
    if (statSync(p).isDirectory()) saida = saida.concat(arquivos(relative(RAIZ, p)));
    else if (/\.(jsx?|mjs)$/.test(nome)) saida.push(relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return saida;
}
/** Tira os comentários: as regras valem para o que a tela FAZ e MOSTRA. */
function semComentarios(fonte) {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

console.log('\n1. o desenho da perua');
igual('1 vaga: banco de trás com uma', fileirasDaPerua(1), [[0]]);
igual('4 vagas: um banco de trás com quatro', fileirasDaPerua(4), [[0, 1, 2, 3]]);
igual('5 vagas: uma fileira e o banco de trás com duas', fileirasDaPerua(5), [[0, 1, 2], [3, 4]]);
igual('15 vagas: cinco fileiras de três', fileirasDaPerua(15), [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14],
]);
const sessenta = fileirasDaPerua(60);
igual('60 vagas: vinte fileiras', sessenta.length, 20);
igual('60 vagas: todas de três', sessenta.every((f) => f.length === 3), true);
igual('60 vagas: a última é a 59', sessenta.at(-1).at(-1), 59);
igual('16 vagas: o banco de trás leva quatro', fileirasDaPerua(16).at(-1), [12, 13, 14, 15]);
igual('nenhuma vaga se perde (1 a 60)',
  Array.from({ length: 60 }, (_, i) => fileirasDaPerua(i + 1).flat().length),
  Array.from({ length: 60 }, (_, i) => i + 1));
igual('nenhuma fileira passa de quatro (1 a 60)',
  Array.from({ length: 60 }, (_, i) => fileirasDaPerua(i + 1).every((f) => f.length <= 4)).every(Boolean), true);
igual('número inválido não desenha', fileirasDaPerua(0), []);
igual('texto não desenha', fileirasDaPerua('15'), []);
igual('5 vagas: banco de trás é a última', ehBancoDeTras(fileirasDaPerua(5), 1), true);
igual('15 vagas: a última fileira de três tem corredor', ehBancoDeTras(fileirasDaPerua(15), 4), false);

console.log('\n2. a conta das vagas');
const turma = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
igual('abaixo', ocupacao({ vagas: 15, criancas: turma(14) }), { vagas: 15, criancas: 14, ocupadas: 14, livres: 1, acima: 0 });
igual('igual', ocupacao({ vagas: 15, criancas: turma(15) }), { vagas: 15, criancas: 15, ocupadas: 15, livres: 0, acima: 0 });
igual('acima', ocupacao({ vagas: 15, criancas: turma(17) }), { vagas: 15, criancas: 17, ocupadas: 15, livres: 0, acima: 2 });
igual('aceita só o número', ocupacao({ vagas: 10, criancas: 3 }).livres, 7);
igual('frase abaixo', frasesDaPerua({ vagas: 15, criancas: turma(14) }).contagem, '14 de 15 vagas');
igual('uma vaga livre', frasesDaPerua({ vagas: 15, criancas: turma(14) }).situacao, '1 vaga livre');
igual('várias livres', frasesDaPerua({ vagas: 15, criancas: turma(12) }).situacao, '3 vagas livres');
igual('cheia', frasesDaPerua({ vagas: 15, criancas: turma(15) }).situacao, 'Nenhuma vaga livre');
igual('acima', frasesDaPerua({ vagas: 15, criancas: turma(17) }).situacao, '2 crianças acima das vagas');
igual('a pergunta do dono', frasesDaPerua({ vagas: 15, criancas: turma(15) }).passouTitulo, 'Passou das vagas que você disse');
igual('a pergunta termina perguntando', frasesDaPerua({ vagas: 15, criancas: turma(15) }).passouPergunta.endsWith('Quer continuar?'), true);
igual('uma vaga no singular', frasesDaPerua({ vagas: 1, criancas: [] }).contagem, '0 de 1 vaga');
igual('cadastrar a 15ª não pergunta', passaDasVagas({ vagas: 15, ativas: 14 }), false);
igual('cadastrar a 16ª pergunta', passaDasVagas({ vagas: 15, ativas: 15 }), true);
igual('acima continua perguntando', passaDasVagas({ vagas: 15, ativas: 20 }), true);
igual('sem vagas ditas, nada a perguntar', passaDasVagas({ vagas: null, ativas: 40 }), false);
const desenho = vagasDesenhadas({ vagas: 3, criancas: turma(5) });
igual('acima: as vagas ficam cheias', desenho.vagas.map((v) => v.crianca?.id), ['c0', 'c1', 'c2']);
igual('acima: as que sobram vão para fora, sem erro', desenho.acima.map((c) => c.id), ['c3', 'c4']);
igual('abaixo: as livres vêm vazias', vagasDesenhadas({ vagas: 3, criancas: turma(1) }).vagas.map((v) => v.crianca?.id ?? null), ['c0', null, null]);
const ts = (d) => ({ seconds: Date.UTC(2026, 9, d) / 1000 });
igual('as crianças entram na ordem do cadastro',
  emOrdemDeCadastro([
    { id: 'b', name: 'Bia', createdAt: ts(3) },
    { id: 'a', name: 'Ana', createdAt: ts(1) },
    { id: 's', name: 'Sem data' },
    { id: 'c', name: 'Caio', createdAt: ts(2) },
  ]).map((c) => c.id),
  ['a', 'c', 'b', 's']);

console.log('\n3. o número que vai para o banco é INTEIRO de 1 a 60');
igual('limites', [VAGAS_MINIMO, VAGAS_MAXIMO, VAGAS_SUGERIDAS], [1, 60, 15]);
igual('15 vale', vagasValidas(15), true);
igual('15.5 não vale', vagasValidas(15.5), false);
igual('"15" (texto) não vale', vagasValidas('15'), false);
igual('0 não vale', vagasValidas(0), false);
igual('61 não vale', vagasValidas(61), false);
igual('o texto do campo vira inteiro', vagasParaGravar('15'), 15);
igual('o que sai para gravar é Number.isInteger', Number.isInteger(vagasParaGravar(' 22 ')), true);
igual('60 passa', vagasParaGravar(60), 60);
lanca('15.5 é recusado (não arredonda meia criança)', () => vagasParaGravar(15.5));
lanca('"15,5" é recusado', () => vagasParaGravar('15,5'));
lanca('0 é recusado', () => vagasParaGravar(0));
lanca('61 é recusado', () => vagasParaGravar(61));
lanca('vazio é recusado', () => vagasParaGravar(''));
igual('o − não passa do mínimo', limitarVagas(0), 1);
igual('o + não passa do máximo', limitarVagas(61), 60);
igual('o − e + devolvem inteiro', Number.isInteger(limitarVagas(14.6)), true);
const service = semComentarios(ler('src/services/configFinanceiroService.js'));
igual('o service grava o que sai de vagasParaGravar',
  /const vagasDaPerua = vagasParaGravar\(valor\);\s*return setDoc\(doc\(db, 'configFinanceiro', uid\), \{ vagasDaPerua \}/.test(service), true);
igual('as vagas moram em configFinanceiro, nunca em users',
  /setDoc\(doc\(db, 'users'[^;]*vagasDaPerua/.test(service), false);

console.log('\n4. o passo do primeiro acesso');
const completo = {
  role: 'admin', name: 'João', phone: '11987654321', gender: 'male', marcaNome: 'Tio João',
  city: 'São Paulo', companyName: 'João', companyDocument: '52998224725', companyAddress: 'Rua X, 1',
};
igual('sem ler a config, o passo não aparece', passosQueFaltam(completo), []);
igual('config lida e sem vagas: só o passo das vagas', passosQueFaltam(completo, { vagasDaPerua: null }), ['vagas']);
igual('com vagas: nada falta', faltaCompletarCadastro(completo, { vagasDaPerua: 15 }), false);
igual('vagas inválidas contam como faltando', passosQueFaltam(completo, { vagasDaPerua: 0 }), ['vagas']);
igual('as vagas vêm depois da marca',
  passosQueFaltam({ role: 'admin' }, {}), ['voce', 'marca', 'vagas', 'local', 'contrato']);
igual('a família nunca vê o passo', passosQueFaltam({ role: 'parent' }, {}), []);

console.log('\n5. as telas');
// As telas da perua: os componentes novos e a régua. A palavra "lugar" é
// procurada SÓ nelas (e no que elas mostram), porque em outras telas ela tem
// outros sentidos legítimos ("no lugar do mapa", "lugar da perua no rodapé").
const DA_PERUA = [...arquivos('src/components/perua'), 'src/dominio/identidade/vagasDaPerua.js', 'src/hooks/useVagasDaPerua.js'];
igual('os componentes da perua existem', DA_PERUA.length >= 9, true);
for (const arq of DA_PERUA) {
  const fonte = semComentarios(ler(arq));
  igual(`${arq}: nunca diz "lugar"`, /\blugar(es)?\b/i.test(fonte), false);
  igual(`${arq}: não convida a pôr foto`, /photoURL|type="file"|\bfoto/i.test(fonte), false);
}
igual('sonda: o padrão pega a palavra', /\blugar(es)?\b/i.test(semComentarios('<p>1 lugar livre</p>')), true);
igual('sonda: comentário não conta', /\blugar(es)?\b/i.test(semComentarios('// o lugar\n/* lugar */')), false);
// E nas telas tocadas, a linha que entrou não pode trazer a palavra.
for (const [arq, marca] of [
  ['src/pages/tio/PrimeiroAcesso.jsx', 'PassoDasVagas'],
  ['src/pages/tio/TioDashboard.jsx', 'LinhaDaPerua'],
  ['src/pages/tio/TioPlanos.jsx', 'PeruaNaConta'],
  ['src/pages/tio/TioTurma.jsx', 'PeruaDoMes'],
  ['src/components/children/ChildForm.jsx', 'PerguntaDasVagas'],
]) {
  const linhas = ler(arq).split('\n').filter((l) => l.includes(marca));
  igual(`${arq}: usa ${marca}`, linhas.length >= 2, true);
  igual(`${arq}: a linha da perua não diz "lugar"`, linhas.some((l) => /\blugar/i.test(l)), false);
}
// Quem vê: só o motorista. A família e a auxiliar não importam nada de vagas.
const PROIBIDO = /vagasDaPerua|useVagasDaPerua|components\/perua\/|\.\.\/perua\//;
const DE_FORA = [
  ...arquivos('src/pages/pai'),
  ...arquivos('src/pages/auxiliar'),
  ...arquivos('src/components/auxiliar'),
  'src/pages/Acompanhar.jsx',
];
const vazou = DE_FORA.filter((arq) => PROIBIDO.test(ler(arq)));
igual('família e auxiliar não alcançam vagas', vazou, []);
// Sonda positiva: o padrão pega o import de verdade.
igual('sonda: o padrão pega o import', PROIBIDO.test("import LinhaDaPerua from '../../components/perua/LinhaDaPerua';"), true);
// Nenhuma rule compara vagas com crianças: "nunca trava".
igual('nenhuma rule compara vagas com crianças', /vagasDaPerua[^;]*criancasAtivas|criancasAtivas[^;]*vagasDaPerua/.test(ler('firestore.rules')), false);

console.log('\n6. a perua das zonas da rota (o mesmo desenho)');
{
  // A auxiliar não vê vagas, mas vê a PERUA: as zonas (que ela usa) desenham
  // `DesenhoDaPerua` no modo da rota. O que continua proibido a ela é a
  // régua/hook de vagas e o NÚMERO — o desenho só recebe quantos assentos.
  const zonas = semComentarios(ler('src/components/route/ZonasDaRota.jsx'));
  igual('as zonas usam o mesmo desenho da perua, no modo da rota', [true, true],
    [zonas.includes("import DesenhoDaPerua from '../perua/DesenhoDaPerua'"), zonas.includes('<DesenhoDaPerua naRota')]);
  igual('as zonas não leem vagas (nem hook, nem régua, nem configFinanceiro)', false,
    /useVagasDaPerua|vagasDaPerua|configFinanceiro|frasesDaPerua|ocupacao\(/.test(zonas));
  igual('sem o número do tio, os assentos são as crianças da viagem', true,
    /Number\.isInteger\(assentos\) && assentos > 0 \? assentos : daViagem/.test(zonas));
  const tioAoVivo = semComentarios(ler('src/components/route/RotaAoVivoDoTio.jsx'));
  igual('o TIO passa as vagas dele como assentos', true,
    tioAoVivo.includes('useVagasDaPerua()') && tioAoVivo.includes('assentos={Number.isInteger(vagas) ? vagas : null}'));
  const auxHoje = semComentarios(ler('src/pages/auxiliar/AuxHoje.jsx'));
  igual('a AUXILIAR usa as zonas sem passar assentos (nada de vagas)', [true, false],
    [auxHoje.includes('<ZonasDaRota'), /assentos=|vagas/i.test(auxHoje)]);
  const desenho = semComentarios(ler('src/components/perua/DesenhoDaPerua.jsx'));
  igual('no modo da rota o assento sem ninguém não se chama "vaga"', true,
    desenho.includes('aria-label="Assento vazio"') && desenho.includes("naRota ? 'Também na perua' : 'Acima das vagas'"));
  igual('no modo da rota a vaga livre não é tocável', true, desenho.includes('onVagaLivre={naRota ? null : onVagaLivre}'));
  igual('o desenho não mostra número (nada de frasesDaPerua/ocupacao)', false, /frasesDaPerua|ocupacao\(/.test(desenho));
}


console.log('\n7. o cadastro rápido pelo assento');
igual('a folha rápida grava só nome, gênero e a marca', criancaRapida({ nome: '  Ana Lima ', genero: 'female' }),
  { name: 'Ana Lima', gender: 'female', cadastroRapido: true });
igual('gênero fora de menino/menina vira null', criancaRapida({ nome: 'Leo', genero: 'x' }).gender, null);
igual('sem nome não existe criança', criancaRapida({ nome: '   ', genero: 'male' }), null);
igual('a criança rápida "falta completar"', [faltaCompletarOCadastro({ cadastroRapido: true }), faltaCompletarOCadastro({ cadastroRapido: false }), faltaCompletarOCadastro({})], [true, false, false]);
igual('completar leva ao formulário em modo edição', caminhoDeCompletar('abc'), '/tio/children/abc/completar');
{
  const linha = semComentarios(ler('src/components/perua/LinhaDaPerua.jsx'));
  igual('a vaga livre abre a folha rápida, não o ChildForm', [true, false],
    [linha.includes('onVagaLivre={() => setRapida(true)}'), linha.includes("navigate('/tio/children/new')")]);
  const folha = semComentarios(ler('src/components/perua/FolhaDaVagaRapida.jsx'));
  igual('a folha grava por criancaRapida e oferece o cadastro completo', true,
    folha.includes('criancaRapida(') && folha.includes('addChild(dados)') && folha.includes("navigate('/tio/children/new')"));
  igual('a folha não diz "lugar"', false, /lugar/i.test(folha));
  const ficha = semComentarios(ler('src/pages/ChildDetail.jsx'));
  const lista = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
  igual('ficha e lista mostram "Falta completar o cadastro"', [true, true],
    [ficha.includes('Falta completar o cadastro'), lista.includes('Falta completar o cadastro')]);
  igual('convite escondido até completar', true, ficha.includes('faltaCompletarOCadastro(child) &&') && ficha.includes('Complete o cadastro para mandar o convite.'));
  const serv = semComentarios(ler('src/services/childrenService.js'));
  igual('o serviço aceita cadastroRapido', true, serv.includes('data.cadastroRapido'));
  const form = semComentarios(ler('src/components/children/ChildForm.jsx'));
  igual('completar atualiza e zera cadastroRapido', true, form.includes('cadastroRapido: false') && form.includes('updateChild(idParaCompletar'));
}

console.log(`\n${ok} ok, ${bad} falharam`);
if (bad) process.exit(1);
