/**
 * O RETRATO DAS PESSOAS — régua das abas Famílias, Auxiliares e Contas do
 * painel do dono e do bloco "Jornada no app" da ficha.
 *
 *   node scripts/testar-retrato-das-pessoas.mjs
 */
import { readFileSync } from 'node:fs';
import {
  nomeAbreviado, marcaDoMotorista, fichasDeFamilias, funilDaFamilia,
  linhasDeResponsaveis, retratoDeAuxiliares, motoristaAtivo, matrizDeContas,
  motoristasSuspensos, jornadaDoMotorista, paraMs,
} from '../src/dominio/identidade/retratoDasPessoas.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else { bad += 1; falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`); }
}

const DIA = 86400000;
const AGORA = Date.parse('2026-10-05T12:00:00Z');
const ts = (ms) => ({ toMillis: () => ms });
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

console.log('\n─── nomes e marca ───');
checar('primeiro nome e última inicial', 'Maria L.', nomeAbreviado('Maria Souza Lima'));
checar('um nome só', 'Ana', nomeAbreviado('Ana'));
checar('vazio', 'Sem nome', nomeAbreviado('  '));
checar('marca antes do nome civil', 'Tio Nino', marcaDoMotorista({ marcaNome: 'Tio Nino', name: 'João' }));
checar('sem marca, nome', 'João', marcaDoMotorista({ name: 'João' }));
checar('motorista ausente', null, marcaDoMotorista(undefined));
checar('timestamp', 5, paraMs(ts(5)));
checar('nulo', null, paraMs(null));

console.log('\n─── famílias ───');
checar('ficha que falhou fica null',
  { responsaveis: 4, criancasComFamilia: null, convitesSemResposta: 0, pedidosEsperando: null },
  fichasDeFamilias({ responsaveis: 4, criancasComFamilia: null, convitesSemResposta: 0 }));
const f1 = funilDaFamilia({ cadastradas: 10, comConta: 8, aceitaram: 4, comAvisos: null });
checar('funil: valores', [10, 8, 4, null], f1.map((e) => e.valor));
checar('funil: taxa sobre o anterior', [null, 80, 50, null], f1.map((e) => e.taxa));
checar('degrau null apaga a taxa do seguinte', null, funilDaFamilia({ cadastradas: 10, comConta: null, aceitaram: 4 })[2].taxa);
checar('anterior zero não divide', null, funilDaFamilia({ cadastradas: 0, comConta: 0 })[1].taxa);

const motoristas = [
  { uid: 'm1', marcaNome: 'Tio Nino', name: 'Nino', ultimaRota: ts(AGORA - 2 * DIA) },
  { uid: 'm2', name: 'Zé', ultimaRota: ts(AGORA - 40 * DIA) },
  { uid: 'm3', marcaNome: 'Tia Lu', suspenso: true, suspensoEm: ts(AGORA - 5 * DIA), ultimaRota: ts(AGORA - DIA) },
  { uid: 'm4', marcaNome: 'Nunca', suspenso: true, suspensoEm: ts(AGORA - 9 * DIA) },
  { uid: 'm5', name: 'Sem rota' },
];
const usuarios = [
  { uid: 'p1', role: 'parent', name: 'Carla Mendes Dias', adminUid: 'm1', childIds: ['a', 'b'], createdAt: ts(AGORA - 10 * DIA),
    fcmTokens: ['tok'], address: 'Rua Secreta', phone: '11999', email: 'c@x.com', nivel: 'ouro' },
  { uid: 'p2', role: 'parent', name: 'Rui', adminUid: 'm9', childIds: [], createdAt: ts(AGORA - DIA), fcmTokens: [] },
  { uid: 'p3', role: 'admin', name: 'Motorista' },
];
const linhas = linhasDeResponsaveis(usuarios, motoristas);
checar('só responsáveis, mais novo primeiro', ['p2', 'p1'], linhas.map((l) => l.uid));
checar('motorista cruzado pela marca', [null, 'Tio Nino'], linhas.map((l) => l.motorista));
checar('filhos e avisos', [[0, false], [2, true]], linhas.map((l) => [l.filhos, l.avisos]));
const json = JSON.stringify(linhas);
for (const proibido of ['Rua Secreta', '11999', 'c@x.com', 'ouro', 'address', 'phone', 'email', 'nivel', 'tok', 'Mendes']) {
  checar(`a linha não carrega "${proibido}"`, false, json.includes(proibido));
}

console.log('\n─── auxiliares ───');
const vinculos = [
  { motoristaUid: 'm1', auxiliarUid: 'a1', nome: 'Paula Rocha', ativa: true, valorMensal: 1234, periodos: [{ de: ts(AGORA - 60 * DIA), ate: null }] },
  { motoristaUid: 'm1', auxiliarUid: 'a2', nome: 'Rita Alves', ativa: true, valorMensal: 900, aceitoEm: ts(AGORA - 20 * DIA), periodos: [] },
  { motoristaUid: 'm2', auxiliarUid: 'a3', nome: 'Gil', ativa: false, encerradoEm: ts(AGORA - 10 * DIA), periodos: [{ de: ts(AGORA - 90 * DIA), ate: ts(AGORA - 10 * DIA) }] },
  { motoristaUid: 'm2', auxiliarUid: 'a4', nome: 'Velha', ativa: false, encerradoEm: ts(AGORA - 100 * DIA), periodos: [] },
];
const r = retratoDeAuxiliares(vinculos, motoristas, AGORA);
checar('ativas', 2, r.ativas);
checar('motoristas com auxiliar (distintos)', 1, r.motoristasComAuxiliar);
checar('saíram em 30 dias', 1, r.saiuEm30);
checar('ativas primeiro, depois por início', ['Rita A.', 'Paula R.', 'Gil', 'Velha'], r.linhas.map((l) => l.nome));
checar('marca do motorista', 'Tio Nino', r.linhas[1].motorista);
checar('o valor do pagamento nunca sai', false, JSON.stringify(r).includes('1234') || JSON.stringify(r).includes('valorMensal'));
checar('saiu sem data gravada: null', null, retratoDeAuxiliares([{ motoristaUid: 'm1', ativa: false, periodos: [] }], motoristas, AGORA).saiuEm30);
checar('nenhum vínculo: zero é verdade', 0, retratoDeAuxiliares([], motoristas, AGORA).saiuEm30);

console.log('\n─── contas ───');
checar('ativo: rota há 2 dias', true, motoristaAtivo(motoristas[0], AGORA));
checar('inativo: rota há 40 dias', false, motoristaAtivo(motoristas[1], AGORA));
checar('sem ultimaRota não é ativo', false, motoristaAtivo(motoristas[4], AGORA));
checar('na fronteira dos 30 dias ainda é ativo', true, motoristaAtivo({ ultimaRota: ts(AGORA - 30 * DIA) }, AGORA));
checar('rota no futuro não conta', false, motoristaAtivo({ ultimaRota: ts(AGORA + DIA) }, AGORA));
const m = matrizDeContas({ motoristas, totalFamilias: 120, totalAuxiliares: null }, AGORA);
checar('motoristas: ativas, inativas, suspensas, total', [1, 2, 2, 5], [m[0].ativas, m[0].inativas, m[0].suspensas, m[0].total]);
checar('família: total e "—" no resto', [120, null, null, null], [m[1].total, m[1].ativas, m[1].inativas, m[1].suspensas]);
checar('auxiliar sem contagem fica null', null, m[2].total);
checar('suspensos, mais recente primeiro', ['Tia Lu', 'Nunca'], motoristasSuspensos(motoristas).map((s) => s.marca));
checar('desde da suspensão', AGORA - 5 * DIA, motoristasSuspensos(motoristas)[0].desdeMs);

console.log('\n─── jornada ───');
checar('sem documento: null', null, jornadaDoMotorista(null, AGORA));
const j = jornadaDoMotorista({
  nivel: 'prata', proxima: { id: 'x', titulo: 'Cadastrar o telefone da escola' },
  feitasEm: { a: null, b: AGORA - 3 * DIA, c: AGORA - 8 * DIA }, progresso: { nivel: 'prata', feitas: 2, total: 5 },
}, AGORA);
checar('nível, próxima, dias da última, feitas e total', ['prata', 'Cadastrar o telefone da escola', 3, 2, 5],
  [j.nivel, j.proxima, j.diasDesdeAUltima, j.feitas, j.total]);
checar('só datas nulas: dias null', null, jornadaDoMotorista({ nivel: 'bronze', feitasEm: { a: null } }, AGORA).diasDesdeAUltima);

console.log('\n─── pureza e leitura ───');
checar('a régua não importa nada', false, /^\s*import\s/m.test(ler('src/dominio/identidade/retratoDasPessoas.js')));
const srv = ler('src/services/pessoasDoPainelService.js');
const semImport = srv.replace(/import[\s\S]*?from 'firebase\/firestore';/, '');
checar('todo getDocs tem limit', (semImport.match(/getDocs\(/g) || []).length, (semImport.match(/limit\(/g) || []).length);
checar('o service não lê acessosTemporarios', false, /collection\(db, 'acessosTemporarios'\)/.test(srv));
checar('pedido pendente usa o status que o servidor grava', true,
  srv.includes("'aguardando'") && ler('functions/lib/pedidosDeAcesso.js').includes("status: 'aguardando'"));
for (const arq of ['FamiliasTab', 'AuxiliaresTab', 'ContasTab', 'JornadaNaFicha']) {
  checar(`${arq}: sem Firestore direto na tela`, false, /firebase\/firestore/.test(ler(`src/components/admin/${arq}.jsx`)));
}

console.log(`\n${ok} ok, ${bad} falha(s)`);
if (bad) { console.log(falhas.join('\n')); process.exit(1); }
