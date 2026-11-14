/**
 * Testes da fila "Renovar contratos" (tela N1b) — Node puro, sem runner.
 * Rodar: node scripts/testar-renovacao.mjs
 *
 * Protege `src/dominio/cobranca/renovacaoDoContrato.js` e o caminho que ela
 * alimenta:
 *   1. quem entra e quem sai da fila;
 *   2. o critério bate com o que a COBRANÇA lê (`mesDentroDaVigencia` do
 *      servidor), caso a caso;
 *   3. a vigência nova não deixa buraco — nem em janeiro, nem em dezembro;
 *   4. a vigência que a cobrança lê NÃO muda antes do aceite;
 *   5. o número da versão é o maior mais um;
 *   6. a renovação passa pelo mesmo caminho do contrato que já existe;
 *   7. os textos só dizem o que o app cumpre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  MESES_DE_ANTECEDENCIA,
  filaDeRenovacao,
  mesDaqui,
  pedidoDeRenovacao,
  primeiroMesSemParcela,
  situacaoDaRenovacao,
  terminaAntesDoMes,
  vigenciaDaRenovacao,
} from '../src/dominio/cobranca/renovacaoDoContrato.js';
import {
  MESES_MAXIMOS,
  dataISO,
  parcelasDaVigencia,
  proximoNumeroDoContrato,
} from '../src/dominio/cobranca/contratoDaFamilia.js';
import * as textos from '../src/marca/textosDaRenovacao.js';
import { promessaProibida } from '../src/marca/promessas.js';

const require = createRequire(import.meta.url);
const servidor = require('../functions/lib/reguaDoContrato.js');
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

const H = (a, m, d) => new Date(a, m - 1, d, 12);
const crianca = (extra = {}) => ({
  id: 'k1', name: 'Ana Clara', active: true, parentUid: 'p1',
  vigenciaInicio: '2026-03-02', vigenciaFim: '2026-12-31',
  contratoVigente: { numero: 1 }, contratoAguardando: null,
  monthlyFee: 400, dueDay: 10,
  ...extra,
});
const NOV = H(2026, 11, 14);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m1. Quem entra e quem sai da fila\x1b[0m');
eq('antecedência de dois meses', MESES_DE_ANTECEDENCIA, 2);
eq('aceito, acaba em 31/12, hoje 14/11: renovar', situacaoDaRenovacao(crianca(), NOV), 'renovar');
eq('em 31/10 ainda não (dezembro está dentro)', situacaoDaRenovacao(crianca(), H(2026, 10, 31)), null);
eq('em 1º/11 já aparece', situacaoDaRenovacao(crianca(), H(2026, 11, 1)), 'renovar');
eq('em 20/12 continua', situacaoDaRenovacao(crianca(), H(2026, 12, 20)), 'renovar');
eq('em janeiro, já vencido, continua', situacaoDaRenovacao(crianca(), H(2027, 1, 5)), 'renovar');
eq('acaba em 31/12/2027: fora', situacaoDaRenovacao(crianca({ vigenciaFim: '2027-12-31' }), NOV), null);
eq('inativa: fora', situacaoDaRenovacao(crianca({ active: false }), NOV), null);
eq('passada a outro tio: fora', situacaoDaRenovacao(crianca({ transferidaPara: 'x' }), NOV), null);
eq('sem a família no app: sem-familia', situacaoDaRenovacao(crianca({ parentUid: null }), NOV), 'sem-familia');
eq('contrato novo esperando: esperando',
  situacaoDaRenovacao(crianca({ contratoAguardando: 2 }), NOV), 'esperando');
eq('primeiro contrato nunca assinado: sem-aceite',
  situacaoDaRenovacao(crianca({ contratoVigente: null, contratoAguardando: 1 }), NOV), 'sem-aceite');
eq('nem emitido: sem-aceite',
  situacaoDaRenovacao(crianca({ contratoVigente: null }), NOV), 'sem-aceite');
eq('aceite antigo (só contractAcceptedAt) renova',
  situacaoDaRenovacao(crianca({ contratoVigente: null, contractAcceptedAt: 'x' }), NOV), 'renovar');
eq('sem vigência gravada (a cobrança nunca para): fora',
  situacaoDaRenovacao(crianca({ vigenciaInicio: undefined, vigenciaFim: undefined }), NOV), null);
eq('contrato que ainda vai começar: fora',
  situacaoDaRenovacao(crianca({ vigenciaInicio: '2027-02-01', vigenciaFim: '2027-12-31' }), NOV), null);
const pedido = pedidoDeRenovacao(crianca(), NOV);
const depoisDoAceite = { ...crianca(), ...servidor.valoresDoAditivo(pedido.novos) };
eq('depois do aceite a linha SAI da fila', situacaoDaRenovacao(depoisDoAceite, NOV), null);

const fila = filaDeRenovacao([
  crianca({ id: 'a', name: 'Bia', vigenciaFim: '2026-12-31' }),
  crianca({ id: 'b', name: 'Ana', vigenciaFim: '2026-12-31' }),
  crianca({ id: 'c', name: 'Caio', vigenciaFim: '2026-11-30' }),
  crianca({ id: 'd', name: 'Theo', contratoAguardando: 2 }),
  crianca({ id: 'e', name: 'Lia', contratoVigente: null }),
  crianca({ id: 'f', name: 'Rui', parentUid: null }),
  crianca({ id: 'g', name: 'Zé', parentUid: null }),
  crianca({ id: 'h', name: 'Duda', vigenciaFim: '2027-12-31' }),
  crianca({ id: 'i', name: 'Ivo', active: false }),
], NOV);
eq('fila: a ordem é quem acaba primeiro, depois o nome', fila.renovar.map((l) => l.child.id), ['c', 'b', 'a']);
eq('fila: esperando e sem aceite à parte', [fila.esperando.map((l) => l.child.id), fila.semAceite.map((l) => l.child.id)], [['d'], ['e']]);
eq('fila: sem família só conta', fila.semFamilia, 2);
eq('fila: total sem os sem-família', fila.total, 5);
eq('fila: a linha traz a vigência nova', fila.renovar[1].nova, { inicio: '2026-03-02', fim: '2027-12-31' });
eq('fila vazia é fila vazia', filaDeRenovacao([], NOV).total, 0);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m2. O critério é o da cobrança (servidor), caso a caso\x1b[0m');
const inicios = ['2026-01-01', '2026-03-02', '2026-10-15', '2027-02-01'];
const fins = ['2026-06-30', '2026-11-10', '2026-12-31', '2027-01-31', '2027-06-30', '2027-12-31'];
let divergencias = 0, casos = 0;
for (let t = new Date(2026, 0, 3); t < new Date(2028, 0, 1); t.setDate(t.getDate() + 9)) {
  const alvo = mesDaqui(t, MESES_DE_ANTECEDENCIA);
  for (const i of inicios) for (const f of fins) {
    if (f <= i) continue;
    casos += 1;
    const esperado = !servidor.mesDentroDaVigencia(alvo, i, f) && alvo >= i.slice(0, 7);
    if (terminaAntesDoMes(alvo, i, f) !== esperado) divergencias += 1;
  }
}
eq(`nenhuma divergência em ${casos} combinações`, divergencias, 0);
eq('janeiro depois de 31/12 termina', terminaAntesDoMes('2027-01', '2026-03-02', '2026-12-31'), true);
eq('dezembro não termina', terminaAntesDoMes('2026-12', '2026-03-02', '2026-12-31'), false);
eq('o mês sem mensalidade é o primeiro que o servidor recusa (fim em 31/12: janeiro)', primeiroMesSemParcela('2026-03-02', '2026-12-31', NOV), '2027-01');
eq('mês começado conta inteiro: fim em 20/12 com início dia 10, dezembro AINDA tem parcela', primeiroMesSemParcela('2026-03-10', '2026-12-20', NOV), '2027-01');
eq('fim em 05/12 com início dia 10: dezembro já fica sem', primeiroMesSemParcela('2026-03-10', '2026-12-05', NOV), '2026-12');
eq('o mês achado é recusado pelo servidor e o anterior não', [servidor.mesDentroDaVigencia(primeiroMesSemParcela('2026-03-10', '2026-12-20', NOV), '2026-03-10', '2026-12-20'), servidor.mesDentroDaVigencia('2026-12', '2026-03-10', '2026-12-20')], [false, true]);
eq('sem vigência não há mês sem parcela', primeiroMesSemParcela(undefined, undefined, NOV), null);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m3. A vigência nova não deixa buraco\x1b[0m');
eq('prorroga: mantém o início e vai a 31/12 do ano seguinte',
  vigenciaDaRenovacao(crianca(), NOV), { inicio: '2026-03-02', fim: '2027-12-31' });
const aplicada = (c, hoje) => ({ ...c, ...servidor.valoresDoAditivo(pedidoDeRenovacao(c, hoje).novos) });
const r1 = aplicada(crianca(), NOV);
eq('depois do aceite, DEZEMBRO continua cobrado',
  servidor.mesDentroDaVigencia('2026-12', r1.vigenciaInicio, r1.vigenciaFim), true);
eq('e JANEIRO passa a ser cobrado',
  servidor.mesDentroDaVigencia('2027-01', r1.vigenciaInicio, r1.vigenciaFim), true);
eq('até dezembro de 2027, e não depois',
  [servidor.mesDentroDaVigencia('2027-12', r1.vigenciaInicio, r1.vigenciaFim),
    servidor.mesDentroDaVigencia('2028-01', r1.vigenciaInicio, r1.vigenciaFim)], [true, false]);
// Por que não "começa em 1º/01": a família que assina em novembro perderia
// a mensalidade de dezembro (a cobrança só lê os dois campos da criança).
eq('MUTAÇÃO: com início em 01/01/2027, dezembro sumiria',
  servidor.mesDentroDaVigencia('2026-12', '2027-01-01', '2027-12-31'), false);
eq('vencido antes deste mês: começa hoje',
  vigenciaDaRenovacao(crianca({ vigenciaFim: '2026-06-30' }), NOV), { inicio: '2026-11-14', fim: '2027-12-31' });
const venc = aplicada(crianca({ vigenciaFim: '2026-06-30' }), NOV);
eq('e não põe no papel os meses que ninguém cobrou (julho a outubro)',
  ['2026-07', '2026-10'].map((m) => servidor.mesDentroDaVigencia(m, venc.vigenciaInicio, venc.vigenciaFim)), [false, false]);
eq('passaria de 24 meses: começa no 1º deste mês',
  vigenciaDaRenovacao(crianca({ vigenciaInicio: '2026-01-05', vigenciaFim: '2027-12-31' }), H(2027, 11, 14)),
  { inicio: '2027-11-01', fim: '2028-12-31' });
eq('fim no meio do ano: até 31/12 do mesmo ano',
  vigenciaDaRenovacao(crianca({ vigenciaInicio: '2027-01-04', vigenciaFim: '2027-06-30' }), H(2027, 5, 10)),
  { inicio: '2027-01-04', fim: '2027-12-31' });
eq('só a vigência viaja: valor e vencimento são os da criança',
  Object.keys(pedido.novos).sort(), ['vigenciaFim', 'vigenciaInicio']);
eq('e o servidor não aplica valor nem vencimento no aceite',
  Object.keys(servidor.valoresDoAditivo(pedido.novos)).sort(), ['vigenciaFim', 'vigenciaInicio']);
eq('quem não está em "renovar" não gera pedido',
  [pedidoDeRenovacao(crianca({ contratoAguardando: 2 }), NOV), pedidoDeRenovacao(crianca({ contratoVigente: null }), NOV),
    pedidoDeRenovacao(crianca({ parentUid: null }), NOV)], [null, null, null]);

// Varredura: em toda renovação oferecida, nenhum mês entre hoje e o fim
// novo fica sem cobrança, o fim só anda para frente e o prazo cabe no teto.
let buracos = 0, recuos = 0, compridos = 0, ofertas = 0;
const iniciosV = ['2025-11-03', '2026-01-05', '2026-03-02', '2026-10-15'];
const finsV = ['2026-06-30', '2026-11-10', '2026-12-31', '2027-03-31', '2027-12-31'];
for (let t = new Date(2026, 0, 2); t < new Date(2028, 0, 1); t.setDate(t.getDate() + 7)) {
  for (const i of iniciosV) for (const f of finsV) {
    if (f <= i) continue;
    const c = crianca({ vigenciaInicio: i, vigenciaFim: f });
    if (situacaoDaRenovacao(c, t) !== 'renovar') continue;
    ofertas += 1;
    const d = aplicada(c, t);
    if (d.vigenciaFim <= f) recuos += 1;
    if (parcelasDaVigencia(d.vigenciaInicio, d.vigenciaFim) > MESES_MAXIMOS) compridos += 1;
    const ate = d.vigenciaFim.slice(0, 7);
    // Desde o mês de hoje — ou o do início, se o contrato ainda vai começar
    // (antes dele não há o que cobrar, com ou sem renovação).
    const [ia, im] = i.split('-').map(Number);
    const desde = i.slice(0, 7) > dataISO(t).slice(0, 7) ? new Date(ia, im - 1, 1) : new Date(t.getFullYear(), t.getMonth(), 1);
    for (let m = desde; dataISO(m).slice(0, 7) <= ate; m.setMonth(m.getMonth() + 1)) {
      if (!servidor.mesDentroDaVigencia(dataISO(m).slice(0, 7), d.vigenciaInicio, d.vigenciaFim)) buracos += 1;
    }
  }
}
eq(`varredura com ofertas (${ofertas})`, ofertas > 100, true);
eq('nenhum mês sem cobrança entre hoje e o fim novo', buracos, 0);
eq('o fim nunca recua', recuos, 0);
eq(`nenhum prazo passa de ${MESES_MAXIMOS} meses`, compridos, 0);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m4. A vigência que a cobrança lê NÃO muda antes do aceite\x1b[0m');
const servico = ler('src/services/contratosDaFamiliaService.js');
const corpoDe = (fonte, nome) => {
  const ini = fonte.indexOf(`export async function ${nome}(`);
  if (ini < 0) return '';
  const fim = fonte.indexOf('\nexport ', ini + 10);
  return fonte.slice(ini, fim < 0 ? undefined : fim);
};
const renovar = semComentarios(corpoDe(servico, 'renovarContrato'));
const salvar = semComentarios(corpoDe(servico, 'salvarCombinado'));
const ramoDoAditivo = (s) => s.slice(s.indexOf('const vigente = contratos.find'));
/** O ramo depois do aceite só emite a versão: nada de vigência na criança. */
const aditivoNaoTocaNaCrianca = (s) => {
  const ramo = ramoDoAditivo(s);
  return /emitir\(\{ child, dados, tipo: 'aditivo', contratos, mudancas, novosValores: novos \}\)/.test(ramo) &&
    !/naCrianca|updateDoc|writeBatch/.test(ramo);
};
eq('renovarContrato existe', renovar.length > 0, true);
eq('renovarContrato decide pela régua (pedidoDeRenovacao)', /pedidoDeRenovacao\(child, hoje\)/.test(renovar), true);
eq('renovarContrato passa por salvarCombinado com a vigência do pedido',
  /salvarCombinado\(\{ child, admin, contratos, novos: pedido\.novos \}\)/.test(renovar), true);
eq('renovarContrato não escreve nada por conta própria',
  /updateDoc|writeBatch|setDoc|batch\./.test(renovar), false);
eq('depois do aceite, salvarCombinado só emite o aditivo (sem gravar na criança)', aditivoNaoTocaNaCrianca(salvar), true);
eq('MUTAÇÃO: o aditivo gravando a vigência na criança seria pego',
  aditivoNaoTocaNaCrianca(salvar.replace(
    "novosValores: novos })", "novosValores: novos, naCrianca: novos })")), false);
eq('a emissão só põe o ponteiro na criança (e o que naCrianca trouxer)',
  /batch\.update\(doc\(db, 'children', child\.id\), \{ \.\.\.naCrianca, contratoAguardando: numero \}\)/.test(servico), true);
const aceitar = ler('functions/lib/aceitarContrato.js');
eq('quem aplica a vigência é o aceite, no servidor',
  /contrato\.tipo === 'aditivo' \? valoresDoAditivo\(contrato\.novosValores\)/.test(aceitar), true);
eq('e só a família da criança aceita', /crianca\.parentUid !== uid/.test(aceitar), true);
// Simulação com as réguas reais: emitida (só o ponteiro) → a cobrança de
// janeiro continua sem nascer; aceita → nasce.
const emitida = { ...crianca(), contratoAguardando: 2 };
eq('emitida e não aceita: janeiro continua fora',
  servidor.mesDentroDaVigencia('2027-01', emitida.vigenciaInicio, emitida.vigenciaFim), false);
eq('e a linha vira "esperando", sem segundo botão', situacaoDaRenovacao(emitida, NOV), 'esperando');
const aceita = { ...emitida, ...servidor.valoresDoAditivo(pedido.novos), contratoAguardando: null };
eq('aceita: janeiro nasce', servidor.mesDentroDaVigencia('2027-01', aceita.vigenciaInicio, aceita.vigenciaFim), true);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m5. O número da versão é o maior mais um\x1b[0m');
eq('nenhuma versão: 1', proximoNumeroDoContrato([]), 1);
eq('lista ausente: 1', proximoNumeroDoContrato(undefined), 1);
eq('1 e 3 (2 retirada e sumida da lista): 4', proximoNumeroDoContrato([{ numero: 1 }, { numero: 3 }]), 4);
eq('número gravado como texto ainda conta', proximoNumeroDoContrato([{ numero: '5' }, { numero: 2 }]), 6);
eq('as retiradas contam (o caminho delas existe)',
  proximoNumeroDoContrato([{ numero: 1, status: 'aceito' }, { numero: 2, status: 'retirado' }]), 3);
eq('o service usa a régua, e não uma cópia local',
  /const numero = proximoNumeroDoContrato\(contratos\);/.test(servico) && !/function proximoNumero\(/.test(servico), true);
eq('as rules amarram o id ao número gravado',
  /string\(request\.resource\.data\.numero\) == numero/.test(ler('firestore.rules')), true);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m6. O mesmo caminho do contrato que já existe\x1b[0m');
eq('emitir grava a versão em children/{id}/contratos/{numero}',
  /batch\.set\(doc\(db, 'children', child\.id, 'contratos', String\(numero\)\), \{/.test(servico), true);
eq('com status aguardando e a família da criança',
  /status: 'aguardando',[\s\S]{0,400}familia: child\.parentUid \|\| null/.test(servico), true);
eq('o aditivo avisa a família pelo aviso que já existe (sem tipo novo)',
  /notifyContratoPronto\(\{ parentUid: child\.parentUid, childName: child\.name, mudanca: true \}\)/.test(salvar), true);
const pagina = ler('src/pages/tio/TioRenovarContratos.jsx');
eq('a tela renova por renovarContrato', /renovarContrato\(\{ child: linha\.child, admin: profile \}\)/.test(pagina), true);
eq('a tela não fala com o Firebase', /firebase/.test(pagina), false);
eq('a tela não grava vigência', /vigenciaFim\s*:/.test(semComentarios(pagina)), false);
eq('a rota existe', /path="finance\/renovar" element=\{<TioRenovarContratos \/>\}/.test(ler('src/App.jsx')), true);
eq('a turma leva à fila', /navigate\('\/tio\/finance\/renovar'\)/.test(ler('src/pages/tio/TioTurma.jsx')), true);
eq('a régua não importa nada além do contrato', (() => {
  const fonte = ler('src/dominio/cobranca/renovacaoDoContrato.js');
  const imports = [...fonte.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  return imports;
})(), ['./contratoDaFamilia.js']);

/* ───────────────────────────────────────────────────────────────────────── */
console.log('\n\x1b[1m7. Os textos só dizem o que o app cumpre\x1b[0m');
const FUNCIONALIDADES = {
  'aditivo-so-vale-no-aceite': [
    ['functions/lib/aceitarContrato.js', /valoresDoAditivo\(contrato\.novosValores\)/],
    ['src/services/contratosDaFamiliaService.js', /tipo: 'aditivo'/],
  ],
  'mensalidade-respeita-vigencia': [
    ['functions/lib/billing.js', /mesDentroDaVigencia\(monthKey, child\.vigenciaInicio, child\.vigenciaFim\)/],
  ],
  'contrato-novo-no-app-da-familia': [
    ['src/components/contract/AvisoDeMudancaNoContrato.jsx', /contrato novo para assinar/],
    ['src/services/notificationsService.js', /if \(mudanca\) \{/],
  ],
  'primeiro-contrato-espera-aceite': [
    ['src/App.jsx', /estadoDoContrato\(child\) === 'aguardando'/],
  ],
  'situacoes-da-fila': [
    ['src/dominio/cobranca/renovacaoDoContrato.js', /estado === 'mudanca'\) return 'esperando';/],
    ['src/dominio/cobranca/renovacaoDoContrato.js', /return 'sem-aceite';/],
  ],
  'aceite-pela-conta-da-familia': [
    ['functions/lib/aceitarContrato.js', /crianca\.parentUid !== uid/],
  ],
};
const CONDICOES = {
  'familia-assina': [['functions/lib/aceitarContrato.js', /status: 'aceito'/]],
};
const afirmacoes = textos.todasAsAfirmacoes();
for (const a of afirmacoes) {
  eq(`"${a.id}" tem origem na lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
  if (a.condicao) eq(`"${a.id}" tem condição na lista fechada`, Object.hasOwn(CONDICOES, a.condicao), true);
}
for (const [chave, provas] of Object.entries({ ...FUNCIONALIDADES, ...CONDICOES })) {
  for (const [arquivo, padrao] of provas) eq(`"${chave}" existe: ${arquivo}`, padrao.test(ler(arquivo)), true);
}
eq('nenhuma origem sobrando', Object.keys(FUNCIONALIDADES).filter((k) => !afirmacoes.some((a) => a.sustenta === k)), []);

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FALSAS = [/renovad/, /gratis/, /automatic/, /garant/, /cobra\w* por voce/, /sozinh/];
const reprova = (t) => promessaProibida(t) || FALSAS.find((re) => re.test(semAcento(t))) || null;
const todos = [
  ...afirmacoes.map((a) => [a.id, a.texto]),
  ['titulo', textos.TITULO],
  ['botao', textos.rotuloDoBotao('2027-12-31')],
  ['fim', textos.textoDoFim('2026-12-31')],
  ['linha', textos.nomeDaLinha('Ana Clara')],
  ['porta', textos.textoDaPorta(9)],
];
for (const [id, t] of todos) eq(`"${id}" está limpo`, reprova(t), null);
for (const [id, t] of [['botao', textos.rotuloDoBotao('2027-12-31')], ['esperando', textos.ESPERANDO.texto],
  ['semAceite', textos.SEM_ACEITE.texto], ['fim', textos.textoDoFim('2026-12-31')], ['porta', textos.textoDaPorta(12)]]) {
  eq(`"${id}" é curto (${t.length} ≤ 45)`, t.length <= 45, true);
}
eq('o botão diz o ano do fim novo', textos.rotuloDoBotao('2027-12-31'), 'Renovar para 2027');
eq('a linha fala da família, com o primeiro nome', textos.nomeDaLinha('Ana Clara Souza'), 'A família de Ana');
eq('sem nome não deixa buraco', textos.nomeDaLinha(''), 'Uma família');
eq('o mês sem mensalidade sai da régua', textos.textoDoMesSemMensalidade('2027-01'),
  'Sem a assinatura, a mensalidade de janeiro não é gerada.');
eq('o enviado não diz que já renovou e diz até quando',
  textos.textoDoEnviado('Ana Clara', '2027-12-31'),
  'Contrato novo enviado à família de Ana. Quando ela assinar, vale até 31/12/2027.');
eq('porta no singular', textos.textoDaPorta(1), '1 contrato acabando');
eq('a tela usa o catálogo', /marca\/textosDaRenovacao\.js/.test(pagina), true);
const frases = afirmacoes.map((a) => a.texto).concat([textos.TITULO]);
eq('a tela não repete frase do catálogo à mão', frases.filter((f) => semComentarios(pagina).includes(f)), []);

console.log('\n\x1b[1m7b. O aviso não volta: confirmar ANTES de mandar\x1b[0m');
const codigo = semComentarios(pagina);
/** O botão da linha só abre a pergunta; só o "Mandar" do diálogo envia. */
const confirmaAntes = (fonte) =>
  /onClick=\{\(\) => setConfirmando\(linha\)\}/.test(fonte) &&
  !/onClick=\{\(\) => renovar\(/.test(fonte) &&
  /<ConfirmDialog[\s\S]*?onConfirm=\{\(\) => renovar\(confirmando\)\}[\s\S]*?\/>/.test(fonte) &&
  [...fonte.matchAll(/\brenovar\(/g)].length === 1 &&
  [...fonte.matchAll(/renovarContrato\(/g)].length === 1 &&
  /const renovar = async/.test(fonte);
eq('o botão da linha abre a confirmação, e só o "Mandar" chama renovar', confirmaAntes(codigo), true);
eq('MUTAÇÃO: ligar o botão direto a renovar() reprova',
  confirmaAntes(codigo.replace('onClick={() => setConfirmando(linha)}', 'onClick={() => renovar(linha)}')), false);
eq('o diálogo usa o componente que já existe', /from '\.\.\/\.\.\/components\/common\/ConfirmDialog'/.test(pagina), true);
eq('com "Mandar" e "Agora não" do catálogo',
  [textos.BOTAO_MANDAR, textos.BOTAO_AGORA_NAO, /confirmLabel=\{BOTAO_MANDAR\}/.test(codigo), /cancelLabel=\{BOTAO_AGORA_NAO\}/.test(codigo)],
  ['Mandar', 'Agora não', true, true]);
eq('a pergunta com nome', textos.perguntaDeMandar('Ana Clara Souza'), 'Mandar o contrato novo para a família de Ana assinar?');
eq('sem nome cai para "a família"', [textos.perguntaDeMandar(''), textos.perguntaDeMandar(null)],
  ['Mandar o contrato novo para a família assinar?', 'Mandar o contrato novo para a família assinar?']);
eq('a consequência diz que não volta e até quando vale', textos.consequenciaDeMandar('2027-12-31'),
  'O aviso chega no celular dela e não volta. Quando ela assinar, vale até 31/12/2027.');
eq('nada de "renovado" na confirmação',
  reprova(`${textos.perguntaDeMandar('Ana')} ${textos.consequenciaDeMandar('2027-12-31')}`), null);

console.log('\n\x1b[1m8. Sonda positiva: as regras pegam o que devem\x1b[0m');
eq('"renovado" é reprovado', reprova('Contrato renovado!') !== null, true);
eq('"garantido" é reprovado', reprova('Janeiro garantido') !== null, true);
eq('frase honesta passa', reprova('Contrato novo enviado.'), null);
eq('a varredura acharia um buraco se houvesse',
  servidor.mesDentroDaVigencia('2026-12', '2027-01-01', '2027-12-31') === false, true);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
