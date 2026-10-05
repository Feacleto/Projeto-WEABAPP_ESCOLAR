/**
 * A FALTA DA AUXILIAR E AS SUBSTITUTAS (05/10/2026) — fase 5 da conta da
 * auxiliar.
 *
 *   node scripts/testar-substitutas.mjs   (ou: npm run testar:substitutas)
 *
 * Régua pura (id da falta, validação, contador recontado, controle do mês,
 * "já foi sua auxiliar", ordem da lista) e leitura de arquivo para o que não
 * roda sem Firebase: nenhum texto de desconto automático, nenhuma estrela,
 * "Falar" pelo `linkDoZap`, nenhuma tela da auxiliar alcançando as
 * substitutas, e as rules presas ao motorista. Os casos de regra de verdade
 * (emulador) ficam para `testar:regras`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import {
  CATEGORIA_DA_SUBSTITUTA,
  idDaFalta,
  nomeDaSubstituta,
  telefoneDaSubstituta,
  valorDoDia,
  validarSubstituta,
  faltaDoDia,
  estatisticaDaSubstituta,
  ordenarSubstitutas,
  jaFoiAuxiliar,
  reaisCurto,
  diaCurto,
  nomeDoMesDaChave,
  linhaDaEscolha,
  linhaDoCartao,
  descricaoDaDespesa,
  resumoDoMes,
  linhasDaFaltaDeHoje,
} from '../src/dominio/identidade/faltaDaAuxiliar.js';

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

console.log('\n1. a falta: uma por auxiliar por dia');
checar('o id é motorista_auxiliar_dia', 'tio_aux1_2026-10-12', idDaFalta('tio', 'aux1', '2026-10-12'));
checar('o mesmo dia dá o mesmo id (toque duplo não vira duas faltas)', true,
  idDaFalta('tio', 'aux1', '2026-10-12') === idDaFalta('tio', 'aux1', '2026-10-12'));
const faltas = [
  { id: 'f1', auxiliarUid: 'aux1', nomeDaAuxiliar: 'Cida', dateKey: '2026-10-02', substituta: { id: 's1', nome: 'Joana', telefone: '11977771234', valor: 80 } },
  { id: 'f2', auxiliarUid: 'aux1', nomeDaAuxiliar: 'Cida', dateKey: '2026-10-09', substituta: null },
  { id: 'f3', auxiliarUid: 'aux2', nomeDaAuxiliar: 'Rose', dateKey: '2026-10-12', substituta: { id: 's1', nome: 'Joana', telefone: '11977771234', valor: 90.5 } },
  { id: 'f4', auxiliarUid: 'aux1', nomeDaAuxiliar: 'Cida', dateKey: '2026-09-30', substituta: { id: 's2', nome: 'Lia', telefone: '11966665555', valor: 70 } },
];
checar('acha a falta do dia', 'f2', faltaDoDia(faltas, 'aux1', '2026-10-09')?.id);
checar('outro dia não tem falta', null, faltaDoDia(faltas, 'aux1', '2026-10-10'));
checar('outra auxiliar no mesmo dia não conta', null, faltaDoDia(faltas, 'aux2', '2026-10-09'));

console.log('\n2. o que a tela aceita');
checar('nome limpo', 'Joana Souza', nomeDaSubstituta('  Joana   Souza '));
checar('nome vazio é recusado', null, nomeDaSubstituta('   '));
checar('nome com 61 letras é recusado', null, nomeDaSubstituta('a'.repeat(61)));
checar('telefone vira só dígitos com DDD', '11977771234', telefoneDaSubstituta('(11) 97777-1234'));
checar('celular antigo ganha o nono dígito', '11987654321', telefoneDaSubstituta('(11) 8765-4321'));
checar('fixo fica com 10 dígitos', '1132654321', telefoneDaSubstituta('(11) 3265-4321'));
checar('sem DDD é recusado', null, telefoneDaSubstituta('97777-1234'));
checar('valor com vírgula', 80.5, valorDoDia('80,50'));
checar('valor do CampoDeValor (texto com ponto)', 80, valorDoDia('80.00'));
checar('zero é recusado', null, valorDoDia(0));
checar('acima de 5000 é recusado', null, valorDoDia(5000.01));
checar('5000 passa', 5000, valorDoDia(5000));
checar('vazio é recusado', null, valorDoDia(''));
checar('substituta válida', { ok: true, nome: 'Joana', telefone: '11977771234' }, validarSubstituta({ nome: 'Joana', telefone: '11 97777-1234' }));
checar('sem nome diz o quê', 'Qual o nome dela?', validarSubstituta({ nome: '', telefone: '11977771234' }).erro);
checar('sem WhatsApp diz o quê', 'WhatsApp com DDD.', validarSubstituta({ nome: 'Joana', telefone: '123' }).erro);

console.log('\n3. o contador é RECONTADO das faltas');
checar('Joana: 2 vezes, a última em 12/10 por R$ 90,50', { vezes: 2, ultimaEm: '2026-10-12', ultimoValor: 90.5 }, estatisticaDaSubstituta(faltas, 's1'));
const semF3 = faltas.filter((f) => f.id !== 'f3');
checar('desfeita a última, volta para a anterior', { vezes: 1, ultimaEm: '2026-10-02', ultimoValor: 80 }, estatisticaDaSubstituta(semF3, 's1'));
checar('quem nunca veio fica zerada', { vezes: 0, ultimaEm: null, ultimoValor: null }, estatisticaDaSubstituta(faltas, 'nao-existe'));

console.log('\n4. a ordem da lista e as frases');
const lista = ordenarSubstitutas([
  { id: 'a', nome: 'Bia', vezes: 0 },
  { id: 'b', nome: 'Lia', vezes: 1, ultimaEm: '2026-09-30' },
  { id: 'c', nome: 'Joana', vezes: 3, ultimaEm: '2026-10-12' },
  { id: 'd', nome: 'Ana', vezes: 1, ultimaEm: '2026-10-05' },
  { id: 'e', nome: 'Alice', vezes: 0 },
]);
checar('mais vezes primeiro, depois a mais recente, depois o nome', ['Joana', 'Ana', 'Lia', 'Alice', 'Bia'], lista.map((s) => s.nome));
checar('linha da escolha', '3 vezes · última R$ 80', linhaDaEscolha({ vezes: 3, ultimoValor: 80 }));
checar('linha da escolha no singular', '1 vez · última R$ 80,50', linhaDaEscolha({ vezes: 1, ultimoValor: 80.5 }).replace(/ /g, ' '));
checar('linha da escolha de quem nunca veio', 'ainda não substituiu', linhaDaEscolha({ vezes: 0 }));
checar('linha do cartão', 'Substituiu 3 vezes · última em 12/10 · R$ 80', linhaDoCartao({ vezes: 3, ultimaEm: '2026-10-12', ultimoValor: 80 }));
checar('linha do cartão de quem nunca veio', 'Ainda não substituiu', linhaDoCartao({ vezes: 0 }));
checar('reais curto', 'R$ 1.200', reaisCurto(1200));
checar('dia curto', '12/10', diaCurto('2026-10-12'));
checar('nome do mês', 'outubro', nomeDoMesDaChave('2026-10'));
checar('descrição da despesa', 'Substituta: Joana · 12/10', descricaoDaDespesa('Joana', '2026-10-12'));
checar('a categoria da despesa é a mesma do pagamento (monitor, "Auxiliar" no caixa)', 'monitor', CATEGORIA_DA_SUBSTITUTA);

console.log('\n5. "já foi sua auxiliar" — pelo telefone, nunca pelo nome');
const historico = [{ uid: 'x', nome: 'Rose', telefone: '(11) 8765-4321', ativa: false }];
checar('o mesmo número com outra máscara', true, jaFoiAuxiliar('11987654321', historico));
checar('o mesmo nome com outro número não é', false, jaFoiAuxiliar('11911112222', [{ nome: 'Joana', telefone: '11933334444' }]));
checar('histórico vazio', false, jaFoiAuxiliar('11987654321', []));

console.log('\n6. o controle do mês');
const r = resumoDoMes(faltas, '2026-10');
checar('faltas de cada auxiliar no mês (a de setembro fica fora)', [['Cida', 2], ['Rose', 1]], r.porAuxiliar.map((a) => [a.nome, a.faltas]));
checar('cada substituição: dia, nome e valor', [['2026-10-02', 'Joana', 80], ['2026-10-12', 'Joana', 90.5]], r.substituicoes.map((s) => [s.dateKey, s.nome, s.valor]));
checar('o gasto com substitutas', 170.5, r.total);
checar('mês sem falta: zero, sem inventar', { total: 0, faltas: 0 }, { total: resumoDoMes(faltas, '2026-11').total, faltas: resumoDoMes(faltas, '2026-11').totalDeFaltas });

console.log('\n7. o app nunca desconta sozinho, e não há estrelas nesta fase');
const arquivos = [
  'src/dominio/identidade/faltaDaAuxiliar.js',
  'src/services/substitutasService.js',
  'src/hooks/useSubstitutas.js',
  'src/pages/tio/TioSubstitutas.jsx',
  ...readdirSync(new URL('../src/components/auxiliar/', import.meta.url)).map((f) => `src/components/auxiliar/${f}`),
];
const codigo = arquivos.map((a) => semComentarios(ler(a))).join('\n');
const DESCONTO = /descontad[oa]|desconto autom|descontar do|desconta do pagamento|valor a descontar|calcularDesconto/i;
checar('nenhum texto ou conta de desconto automático', false, DESCONTO.test(codigo));
checar('a sonda de desconto acha quando existe', true, DESCONTO.test('O dia será descontado do pagamento'));
const ESTRELA = /Star\b|estrela|avalia[cç][aã]o|nota d[ae]/i;
checar('nenhuma estrela nem avaliação', false, ESTRELA.test(codigo));
checar('a sonda de estrela acha quando existe', true, ESTRELA.test("import { Star } from 'lucide-react'"));
const telaSubs = ler('src/pages/tio/TioSubstitutas.jsx');
checar('"Falar" abre o WhatsApp pelo linkDoZap', true, telaSubs.includes('href={linkDoZap(s.telefone)}') && telaSubs.includes('Falar'));
const telaAux = ler('src/pages/tio/TioAuxiliar.jsx');
checar('as ex-auxiliares têm "Falar" pelo linkDoZap', true, telaAux.includes('href={linkDoZap(h.telefone)}'));
checar('e "Ver minhas substitutas" no fim', true, telaAux.includes('Ver minhas substitutas') && telaAux.includes('to="/tio/finance/auxiliar/substitutas"'));
checar('a rota existe, embaixo de /tio/finance (atrás da senha: mostra valores)', true, ler('src/App.jsx').includes('<Route path="finance/auxiliar/substitutas" element={<TioSubstitutas />} />'));

console.log('\n8. a auxiliar não alcança nada disto');
const telasDela = readdirSync(new URL('../src/pages/auxiliar/', import.meta.url)).map((f) => `src/pages/auxiliar/${f}`);
for (const t of [...telasDela, 'src/pages/ConviteAuxiliar.jsx']) {
  checar(`${t.split('/').pop()} não importa as substitutas`, false, /substitutasService|useSubstitutas|faltaDaAuxiliar/.test(ler(t)));
}
checar('a camada: componente não importa o Firestore', false,
  arquivos.filter((a) => a.endsWith('.jsx')).some((a) => /from 'firebase\//.test(ler(a))));
checar('a régua não importa Firebase nem React', false, /from '(firebase|react)/.test(ler('src/dominio/identidade/faltaDaAuxiliar.js')));
const servico = semComentarios(ler('src/services/substitutasService.js'));
checar('a substituição vai num lote só (falta + despesa + contador)', true,
  /export async function registrarSubstituicao[\s\S]*writeBatch[\s\S]*'expenses'[\s\S]*faltasDaAuxiliar[\s\S]*batch\.commit/.test(servico));
checar('a despesa usa a categoria da régua', true, servico.includes('category: CATEGORIA_DA_SUBSTITUTA'));
checar('a substituta guarda só nome e WhatsApp (nada de CPF nem endereço)', false, /cpf|endereco|address/i.test(servico));

console.log('\n9. as rules');
const regras = ler('firestore.rules');
const blocoSub = regras.slice(regras.indexOf('match /substitutasDoTio/{id}'), regras.indexOf('match /faltasDaAuxiliar/{id}'));
const blocoFalta = regras.slice(regras.indexOf('match /faltasDaAuxiliar/{id}'), regras.indexOf('match /configFinanceiro/{uid}'));
checar('substituta: lista fechada de campos', true, blocoSub.includes("hasOnly(['motoristaUid', 'nome', 'telefone', 'vezes',"));
checar('substituta: só o próprio motorista, com a conta valendo', true,
  blocoSub.includes('allow read, delete: if isAdmin() && resource.data.motoristaUid == request.auth.uid')
  && blocoSub.includes('d.motoristaUid == request.auth.uid'));
checar('falta: o id é motorista_auxiliar_dia', true, blocoFalta.includes("id == request.auth.uid + '_' + d.auxiliarUid + '_' + d.dateKey"));
checar('falta: a auxiliar precisa ser dele (o vínculo do PAR)', true,
  blocoFalta.includes("exists(/databases/$(database)/documents/auxiliares/$(request.auth.uid + '_' + d.auxiliarUid))"));
checar('falta nova: o vínculo do par precisa estar ativo', true,
  blocoFalta.includes("auxiliares/$(request.auth.uid + '_' + request.resource.data.auxiliarUid)).data.get('ativa', false) == true"));
checar('falta: só o próprio motorista lê', true, blocoFalta.includes('allow read: if isAdmin() && resource.data.motoristaUid == request.auth.uid'));
checar('o valor do dia tem teto de 5000 nas rules', true, regras.includes('v is number && v > 0 && v <= 5000'));
checar('o telefone tem 10 ou 11 dígitos nas rules', true, regras.includes("t.matches('^[0-9]{10,11}$')"));

console.log('\n10. "Cida faltou hoje" no Início (sem valor nenhum)');
{
  const hoje = '2026-10-05';
  const faltasHoje = [
    { auxiliarUid: 'a1', nomeDaAuxiliar: 'Cida Souza', dateKey: hoje, substituta: { id: 's1', nome: 'Joana Lima', telefone: '11987654321', valor: 87.5 } },
    { auxiliarUid: 'a2', nomeDaAuxiliar: 'Bia', dateKey: hoje, substituta: null },
    { auxiliarUid: 'a1', nomeDaAuxiliar: 'Cida Souza', dateKey: '2026-10-04', substituta: null },
  ];
  const linhas = linhasDaFaltaDeHoje(faltasHoje, hoje);
  const da = (uid) => linhas.find((l) => l.auxiliarUid === uid) || {};
  checar('uma linha por auxiliar que faltou HOJE (ontem não entra)', 2, linhas.length);
  checar('com substituta: o nome dela', { titulo: 'Cida faltou hoje', sub: 'Substituta: Joana' },
    { titulo: da('a1').titulo, sub: da('a1').sub });
  checar('sem nome: "Sua auxiliar faltou hoje"', 'Sua auxiliar faltou hoje',
    linhasDaFaltaDeHoje([{ auxiliarUid: 'a9', nomeDaAuxiliar: '', dateKey: hoje, substituta: null }], hoje)[0]?.titulo);
  checar('sem artigo antes do nome', false, linhas.some((l) => /^A /.test(l.titulo)));
  checar('sem substituta: diz que não há', 'Sem substituta registrada', da('a2').sub);
  const texto = JSON.stringify(linhas);
  checar('nenhum "R$" no texto', false, texto.includes('R$'));
  checar('nenhum valor no texto (87,50 / 87.5)', false, /87[.,]5/.test(texto));
  checar('a linha só tem auxiliarUid, titulo e sub (nada copiado da falta)', ['auxiliarUid', 'sub', 'titulo'],
    Object.keys(linhas[0]).sort());
  checar('a falta desfeita some (lista sem ela)', 0, linhasDaFaltaDeHoje([], hoje).length);
  checar('sem dia, nada', 0, linhasDaFaltaDeHoje(faltasHoje, null).length);
  checar('com vínculos, a que saiu não entra', ['a1'],
    linhasDaFaltaDeHoje(faltasHoje, hoje, [{ auxiliarUid: 'a1', ativa: true }, { auxiliarUid: 'a2', ativa: false }]).map((l) => l.auxiliarUid));
  checar('falta duplicada do mesmo dia vira uma linha', 1,
    linhasDaFaltaDeHoje([faltasHoje[0], { ...faltasHoje[0] }], hoje).length);

  const hook = semComentarios(ler('src/hooks/useFaltaDaAuxiliarHoje.js'));
  checar('o Início usa a escuta estreita do dia, não a larga da Carteira', true,
    hook.includes('watchFaltasDeHoje') && !hook.includes('watchFaltasDasAuxiliares'));
  checar('o dia é o mesmo getDateKey com que a Carteira grava', true, hook.includes('getDateKey()'));
  const servHoje = servico.slice(servico.indexOf('export function watchFaltasDeHoje'));
  checar('a consulta do Início é presa ao motorista E ao dia', true,
    /where\('motoristaUid', '==', motoristaUid\),\s*where\('dateKey', '==', dateKey\)/.test(servHoje));
  const inicio = semComentarios(ler('src/pages/tio/TioDashboard.jsx'));
  checar('o Início monta a linha com a régua e leva à Carteira', true,
    inicio.includes('useFaltaDaAuxiliarHoje()') && inicio.includes("navigate('/tio/finance/auxiliar')"));
  checar('o Início não lê valor de substituta', false, /substituta\??\.valor/.test(inicio));
  checar('a falta de hoje tira o "em dia" (o Para você não aparece por cima)', true,
    inicio.includes('faltasDaAuxiliar.length === 0'));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
