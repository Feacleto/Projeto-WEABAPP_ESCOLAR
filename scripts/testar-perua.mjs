/**
 * "SUA PERUA" NO FINANCEIRO — abastecer, a reserva e o "preciso aumentar?".
 *
 * POR QUE ESTE TESTE
 * As três réguas fazem conta de dinheiro que o motorista vai usar para
 * decidir quanto cobrar das famílias. Os erros que importam aqui não quebram
 * tela nenhuma — eles produzem um número plausível e errado:
 *   - a média que puxa o "quanto leva para encher" para o dia estranho;
 *   - a alta do diesel que conta o VOLUME (ele pegou mais crianças) como se
 *     fosse PREÇO, e empurra um reajuste que as crianças novas já pagam;
 *   - o mês de combustível esquecido que baixa o custo médio calado;
 *   - a manutenção dividida por 12 de quem começou a lançar há três meses.
 * E um erro de PALAVRA: a reserva é anotação, o app não guarda dinheiro, e
 * "saldo"/"depositar" na tela fariam o motorista acreditar no contrário.
 *
 * COMO RODAR
 *   node scripts/testar-perua.mjs      (ou: npm run testar:perua)
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  TIPOS_DE_COMBUSTIVEL,
  abastecimentosDe,
  haQuantoTempo,
  litrosParaEncher,
  litrosPorValor,
  mesmoPosto,
  nomeDoPosto,
  postoComPreco,
  postosPerto,
  pontoDoPosto,
  enderecoDoPosto,
  RAIO_DO_POSTO_M,
  postosEmOrdem,
  precoDoLitro,
  precoEm12Meses,
  precoPlausivel,
  rotuloDoTipo,
  ultimoNoPosto,
  valorPorLitros,
} from '../src/dominio/cobranca/combustivel.js';
import {
  fimDoPlano,
  mediaDeManutencao,
  metaDaTroca,
  planoValido,
  porMesParaTroca,
  progresso,
  rotuloDoFim,
} from '../src/dominio/cobranca/reservaDaPerua.js';
import {
  altaEm12Meses,
  custoMensal,
  custoPorCrianca,
  emDestaque,
  mensalidadeMedia,
  mesesSemCombustivel,
  proximaRenovacao,
} from '../src/dominio/cobranca/precisoAumentar.js';

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

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-10-15');

const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
let seq = 0;
function desp(category, amount, iso, extra = {}) {
  const date = dia(iso);
  seq += 1;
  return { id: `d${seq}`, category, amount, date, monthKey: mk(date), ...extra };
}
const abastece = (iso, amount, litros, extra = {}) => desp('fuel', amount, iso, { litros, ...extra });

// ───────────────────────────── combustível ─────────────────────────────────

bloco('1. Os tipos de combustível');

checar('cinco tipos', 5, TIPOS_DE_COMBUSTIVEL.length);
checar('chaves na ordem da SPEC',
  ['diesel_s10', 'diesel_s500', 'gasolina', 'etanol', 'gnv'],
  TIPOS_DE_COMBUSTIVEL.map((t) => t.chave));
checar('GNV é m³', 'm³', TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === 'gnv').unidade);
checar('rótulo do S10', 'Diesel S10', rotuloDoTipo('diesel_s10'));
checar('chave desconhecida não aparece crua', 'Combustível', rotuloDoTipo('querosene'));

bloco('2. Litros, valor e preço do litro');

checar('R$ 200 a R$ 6,19 → 32,3 L', 32.3, litrosPorValor(200, 6.19));
checar('litros sem preço é null', null, litrosPorValor(200, 0));
checar('valor zero é null, não 0 L', null, litrosPorValor(0, 6));
checar('texto não é número (o domínio recebe number)', null, litrosPorValor('200', 6));
checar('40 L a R$ 6,19 → R$ 247,60', 247.6, valorPorLitros(40, 6.19));
checar('valor com litros zero é null', null, valorPorLitros(0, 6.19));
checar('preço do litro: 300 / 50', 6, precoDoLitro({ valor: 300, litros: 50 }));
checar('preço com 2 casas', 6.33, precoDoLitro({ valor: 190, litros: 30 }));
checar('preço sem litros é null', null, precoDoLitro({ valor: 300, litros: 0 }));
checar('R$ 6,19 é plausível', true, precoPlausivel(6.19));
checar('borda de baixo: R$ 3', true, precoPlausivel(3));
checar('borda de cima: R$ 12', true, precoPlausivel(12));
checar('R$ 0,59 é vírgula errada', false, precoPlausivel(0.59));
checar('R$ 61,90 é vírgula errada', false, precoPlausivel(61.9));
checar('texto não é preço', false, precoPlausivel('6.19'));

bloco('3. O nome do posto');

checar('apara e junta espaços', 'Posto São João', nomeDoPosto('  Posto   São  João '));
checar('vazio é vazio', '', nomeDoPosto('   '));
checar('corta em 60', 60, nomeDoPosto('x'.repeat(80)).length);
checar('sem acento e caixa é o mesmo posto', true, mesmoPosto('Posto São João', ' posto sao  joao'));
checar('dois vazios não são o mesmo posto', false, mesmoPosto('', ' '));

bloco('4. Os abastecimentos');

const lancados = [
  abastece('2026-10-10', 300, 50, { posto: 'Shell da Marginal', tipoCombustivel: 'diesel_s10', tanqueCheio: true }),
  abastece('2026-10-01', 240, 40, { posto: 'Ipiranga', tanqueCheio: true }),
  desp('fuel', 150, '2026-10-05'), // sem litros: é gasto, não abastecimento com conta
  desp('maintenance', 500, '2026-10-02', { litros: 30 }), // litros em outra categoria não conta
  abastece('2026-09-20', 280, 46, { posto: 'shell da marginal', tanqueCheio: true }),
  abastece('2026-09-12', 120, 20, { posto: 'Ipiranga' }),
  abastece('2026-09-01', 0, 0), // litros zero
];
const abast = abastecimentosDe(lancados);

checar('só fuel com litros > 0', 4, abast.length);
checar('mais recente primeiro', ['2026-10-10', '2026-10-01', '2026-09-20', '2026-09-12'],
  abast.map((a) => a.data.toISOString().slice(0, 10)));
checar('preço do litro calculado', 6, abast[0].precoLitro);
checar('tanque cheio só com true', false, abast[3].tanqueCheio);
checar('data como Timestamp do Firestore', 1,
  abastecimentosDe([{ category: 'fuel', amount: 60, litros: 10, date: { toDate: () => dia('2026-01-01') } }]).length);
checar('sem data não entra', 0, abastecimentosDe([{ category: 'fuel', amount: 60, litros: 10 }]).length);

checar('último no posto (outra grafia)', 50, ultimoNoPosto(abast, 'SHELL DA MARGINAL')?.litros);
checar('posto nunca visitado', null, ultimoNoPosto(abast, 'BR'));

bloco('5. Quanto leva para encher — mediana, nunca média');

checar('três tanques cheios: 50, 40, 46 → 46', 46, litrosParaEncher(abast));
// O ponto fora da curva: o dia em que o tanque estava quase seco.
const comEstranho = [{ tanqueCheio: true, litros: 45 }, { tanqueCheio: true, litros: 47 }, { tanqueCheio: true, litros: 95 }];
checar('o dia estranho não puxa (média daria 62)', 47, litrosParaEncher(comEstranho));
checar('um tanque cheio só não é costume', null, litrosParaEncher([{ tanqueCheio: true, litros: 50 }]));
checar('abastecimento parcial não conta', null, litrosParaEncher([{ tanqueCheio: false, litros: 50 }, { litros: 40 }]));

bloco('6. O preço em 12 meses');

const umAno = [
  { data: dia('2025-11-05'), litros: 50, valor: 250 }, // 5,00
  { data: dia('2025-11-20'), litros: 10, valor: 60 }, // 6,00 — mas são só 10 L
  { data: dia('2026-05-10'), litros: 50, valor: 275 },
  { data: dia('2026-10-03'), litros: 50, valor: 310 }, // 6,20
  { data: dia('2025-09-10'), litros: 50, valor: 100 }, // fora da janela
];
const p12 = precoEm12Meses(umAno, HOJE);
checar('preço do mês é ponderado pelos litros (310/60)', 5.17, p12?.antes);
checar('preço agora', 6.2, p12?.agora);
checar('um mês só não é tendência', null, precoEm12Meses([umAno[0], umAno[1]], HOJE));
checar('o que está fora da janela não conta', null,
  precoEm12Meses([umAno[4], umAno[3]], HOJE));

bloco('7. Os postos');

const postos = [
  { nome: 'Shell', preco: 6.1, tipo: 'diesel_s10', vistoEm: dia('2026-10-01') },
  { nome: 'Ipiranga', preco: 6.0, tipo: 'diesel_s10', vistoEm: dia('2026-10-10') },
  { nome: 'Sem data', preco: 6.3, tipo: 'diesel_s10' },
];
checar('o visto por último primeiro, sem data no fim', ['Ipiranga', 'Shell', 'Sem data'],
  postosEmOrdem(postos).map((p) => p.nome));
checar('não ordena por preço (nenhum posto é "recomendado")', 'Ipiranga', postosEmOrdem(postos)[0].nome);

const trocado = postoComPreco(postos, { nome: ' shell ', preco: 6.29, tipo: 'diesel_s10', em: dia('2026-10-14') });
checar('substitui o de mesmo nome', 3, trocado.length);
checar('no mesmo lugar, com o preço novo', 6.29, trocado[0].preco);
checar('array novo, o recebido não muda', 6.1, postos[0].preco);
const acrescido = postoComPreco(postos, { nome: 'BR', preco: 6.05, tipo: 'diesel_s10', em: dia('2026-10-14') });
checar('posto novo entra no fim', 'BR', acrescido.at(-1).nome);
checar('nome vazio não anota', 3, postoComPreco(postos, { nome: '  ', preco: 6 }).length);
const vinte = Array.from({ length: 20 }, (_, i) => ({
  nome: `Posto ${i}`, preco: 6, tipo: 'diesel_s10', vistoEm: dia(`2026-09-${String(i + 1).padStart(2, '0')}`),
}));
const vinteEUm = postoComPreco(vinte, { nome: 'Novo', preco: 6, tipo: 'diesel_s10', em: dia('2026-10-14') });
checar('máximo de 20', 20, vinteEUm.length);
checar('sai o visto há mais tempo', false, vinteEUm.some((p) => p.nome === 'Posto 0'));

bloco('8. Há quanto tempo');

checar('hoje', 'hoje', haQuantoTempo(dia('2026-10-15'), HOJE));
checar('ontem (de calendário)', 'ontem', haQuantoTempo(new Date('2026-10-14T23:50:00'), new Date('2026-10-15T00:10:00')));
checar('há 9 dias', 'há 9 dias', haQuantoTempo(dia('2026-10-06'), HOJE));
checar('data no futuro vira hoje', 'hoje', haQuantoTempo(dia('2026-10-20'), HOJE));

// ───────────────────────────── reserva ─────────────────────────────────────

bloco('9. O plano da troca');

const plano = { valorHoje: 120000, anos: 5, valorFinal: 60000, criadoEm: dia('2026-01-20') };
checar('plano válido', true, planoValido(plano));
checar('valor de hoje zero', false, planoValido({ ...plano, valorHoje: 0 }));
checar('21 anos', false, planoValido({ ...plano, anos: 21 }));
checar('anos quebrado', false, planoValido({ ...plano, anos: 2.5 }));
checar('valor final igual ao de hoje', false, planoValido({ ...plano, valorFinal: 120000 }));
checar('valor final zero vale (vai rodar até o fim)', true, planoValido({ ...plano, valorFinal: 0 }));
checar('meta = hoje − final', 60000, metaDaTroca(plano));
checar('por mês: 60000 / 60', 1000, porMesParaTroca(plano));
checar('por mês arredonda', 1667, porMesParaTroca({ valorHoje: 100000, anos: 5, valorFinal: 0 }));
checar('fim do plano: + 5 anos', '2031-01-20', fimDoPlano(plano)?.toISOString().slice(0, 10));
checar('rótulo do fim', 'janeiro de 2031', rotuloDoFim(plano));
checar('sem criadoEm não há fim', null, fimDoPlano({ ...plano, criadoEm: undefined }));
checar('criadoEm como Timestamp', 'março de 2028',
  rotuloDoFim({ ...plano, anos: 2, criadoEm: { seconds: dia('2026-03-10').getTime() / 1000 } }));

bloco('10. A manutenção média — divide pelo tempo de uso');

const tresMeses = [
  desp('fuel', 1500, '2026-08-05'),
  desp('maintenance', 1800, '2026-09-10'),
  desp('maintenance', 300, '2026-10-02'),
  desp('maintenance', 9999, '2025-09-01'), // fora da janela
];
const mm = mediaDeManutencao(tresMeses, HOJE);
checar('meses desde o 1º lançamento de qualquer categoria (ago..out)', 3, mm?.meses);
checar('total só da janela', 2100, mm?.total);
checar('por mês: 2100 / 3 (não / 12)', 700, mm?.porMes);
checar('sem manutenção é null', null, mediaDeManutencao([desp('fuel', 100, '2026-10-01')], HOJE));
checar('janela cheia: 12', 12,
  mediaDeManutencao([desp('other', 10, '2025-11-01'), desp('maintenance', 1200, '2026-10-01')], HOJE)?.meses);

bloco('11. O progresso do que foi anotado');

checar('metade', 0.5, progresso(30000, 60000));
checar('passou da meta para em 1', 1, progresso(90000, 60000));
checar('sem meta', null, progresso(1000, null));

// ───────────────────────────── preciso aumentar ────────────────────────────

/** Um ano inteiro de perua: nov/2025 a out/2026. */
const MESES_DO_ANO = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const ano = [];
for (const m of MESES_DO_ANO) {
  // 300 L todo mês; o litro sai de R$ 5,00 em novembro para R$ 6,00 em outubro.
  ano.push(abastece(`${m}-05`, m === '2026-10' ? 1800 : 1500, 300));
  ano.push(desp('monitor', 1000, `${m}-06`));
}
for (const m of ['2025-11', '2025-12', '2026-01']) ano.push(desp('maintenance', 100, `${m}-07`));
for (const m of ['2026-08', '2026-09', '2026-10']) ano.push(desp('maintenance', 400, `${m}-07`));
ano.push(desp('fuel', 9000, '2025-10-01')); // fora da janela

bloco('12. O custo mensal');

const custo = custoMensal({ despesas: ano, planoDaTroca: plano, hoje: HOJE });
checar('12 meses com lançamento', 12, custo?.meses);
checar('combustível: 18300 / 12', 1525, custo?.partes.find((p) => p.chave === 'fuel')?.valor);
checar('a troca entra como parte', 1000, custo?.partes.find((p) => p.chave === 'troca')?.valor);
checar('total soma as partes', 3650, custo?.total);
checar('sem plano, sem parte da troca', 2650, custoMensal({ despesas: ano, hoje: HOJE })?.total);
checar('plano inválido não entra', false,
  custoMensal({ despesas: ano, planoDaTroca: { valorHoje: 0 }, hoje: HOJE }).partes.some((p) => p.chave === 'troca'));
checar('sem despesas é null', null, custoMensal({ despesas: [], planoDaTroca: plano, hoje: HOJE }));
checar('mês sem lançamento não divide (2 meses com lançamento)', 2,
  custoMensal({ despesas: [desp('fuel', 100, '2026-01-01'), desp('fuel', 100, '2026-10-01')], hoje: HOJE }).meses);
checar('categoria desconhecida vai para Outros', 'other',
  custoMensal({ despesas: [desp('xyz', 100, '2026-10-01')], hoje: HOJE }).partes[0].chave);

bloco('13. Por criança e a mensalidade média');

checar('3650 / 10', 365, custoPorCrianca({ custo, criancas: 10 }));
checar('zero crianças é null, não infinito', null, custoPorCrianca({ custo, criancas: 0 }));
checar('aceita a lista de crianças (conta as ativas)', 1825,
  custoPorCrianca({ custo, criancas: [{ active: true }, {}, { active: false }] }));

const turma = [
  { monthlyFee: 400, active: true, vigenciaFim: '2026-12-31' },
  { monthlyFee: 500, active: true, vigenciaFim: '2026-11-30' },
  { monthlyFee: 0, active: true }, // bolsista: não entra na média
  { monthlyFee: 900, active: false, vigenciaFim: '2026-10-20' }, // saiu
  { monthlyFee: '450', vigenciaFim: '2026-10-01' }, // documento antigo, sem `active`; vigência já passou
];
checar('média de quem paga e está ativo', 450, mensalidadeMedia(turma));

bloco('14. A alta em 12 meses — PREÇO, não volume');

const alta = altaEm12Meses({ despesas: ano, abastecimentos: abastecimentosDe(ano), criancas: 10, hoje: HOJE });
checar('diesel agora', 6, alta?.dieselAgora);
checar('combustível: (6 − 5) × 300 L ÷ 10', 30, alta?.partes.find((p) => p.chave === 'combustivel')?.valor);
checar('manutenção: (400 − 100) ÷ 10', 30, alta?.partes.find((p) => p.chave === 'maintenance')?.valor);
checar('auxiliar sem mudança', 0, alta?.partes.find((p) => p.chave === 'monitor')?.valor);
checar('total', 60, alta?.total);
checar('sem abastecimentos passados, deriva das despesas', 30,
  altaEm12Meses({ despesas: ano, criancas: 10, hoje: HOJE })?.partes[0].valor);

// O caso que justifica a régua: ele dobrou o volume (pegou mais crianças) e o
// preço do litro NÃO mudou. Gasto subiu muito; alta de preço é zero.
const maisVolume = [];
for (const m of MESES_DO_ANO) {
  const litros = m >= '2026-05' ? 600 : 300;
  maisVolume.push(abastece(`${m}-05`, litros * 5, litros));
}
checar('volume dobrou, preço igual: alta do combustível é zero', 0,
  altaEm12Meses({ despesas: maisVolume, abastecimentos: abastecimentosDe(maisVolume), criancas: 10, hoje: HOJE })
    ?.partes[0].valor);

const caiu = ano.map((d) => (d.category === 'maintenance' && d.amount === 400 ? { ...d, amount: 0 } : d));
checar('custo que caiu aparece negativo', -10,
  altaEm12Meses({ despesas: caiu, criancas: 10, hoje: HOJE })?.partes.find((p) => p.chave === 'maintenance')?.valor);

const noveMeses = ano.filter((d) => d.monthKey >= '2026-02');
checar('9 meses de lançamento: ainda não dá', null, altaEm12Meses({ despesas: noveMeses, criancas: 10, hoje: HOJE }));
checar('10 meses: dá', true, altaEm12Meses({ despesas: ano.filter((d) => d.monthKey >= '2026-01'), criancas: 10, hoje: HOJE }) !== null);
checar('sem preço comparável, combustível 0 e diesel null', [0, null],
  (() => {
    const r = altaEm12Meses({ despesas: ano.filter((d) => d.category !== 'fuel'), criancas: 10, hoje: HOJE });
    return [r?.partes[0].valor, r?.dieselAntes];
  })());

bloco('15. Os meses sem combustível são avisados');

const comBuraco = [
  desp('other', 50, '2026-06-02'),
  abastece('2026-06-05', 300, 50),
  desp('monitor', 1000, '2026-07-06'),
  abastece('2026-08-05', 300, 50),
  desp('fuel', 200, '2026-08-20'), // combustível sem litros também conta como lançado
  desp('monitor', 1000, '2026-09-06'),
];
checar('julho e setembro, não o mês atual', ['2026-07', '2026-09'], mesesSemCombustivel(comBuraco, HOJE));
checar('ano completo, nenhum buraco', [], mesesSemCombustivel(ano, HOJE));
checar('só lançamento no mês atual: nada a avisar', [], mesesSemCombustivel([desp('monitor', 1, '2026-10-01')], HOJE));
checar('mês vazio no meio também é avisado', ['2026-08', '2026-09'],
  mesesSemCombustivel([desp('fuel', 100, '2026-07-01')], HOJE));

bloco('16. A próxima renovação');

const renov = proximaRenovacao(turma, HOJE);
checar('o menor fim futuro entre as ativas (a que saiu não conta)', '2026-11-30',
  renov ? mk(renov) + '-' + String(renov.getDate()).padStart(2, '0') : null);
checar('vigência já vencida não conta', null, proximaRenovacao([{ vigenciaFim: '2026-10-01' }], HOJE));
checar('termina hoje ainda conta', 15, proximaRenovacao([{ vigenciaFim: '2026-10-15' }], HOJE)?.getDate());
checar('46 dias: destaque', true, emDestaque(renov, HOJE));
checar('60 dias (borda): destaque', true, emDestaque(dia('2026-12-14'), HOJE));
checar('61 dias: ainda não', false, emDestaque(dia('2026-12-15'), HOJE));

// ───────────────────────────── as palavras ─────────────────────────────────

bloco('17. A reserva não fala como banco');

/**
 * O app não guarda dinheiro: a tela da reserva não pode dizer saldo,
 * depositar, sacar, transferir nem rendimento. Comentário fica de fora — é
 * nele que a proibição é EXPLICADA, e reprovar a explicação seria o teste
 * mentindo (o caso já aconteceu em testar:auth).
 */
const PALAVRAS_DE_BANCO = /\b(saldos?|deposit\w*|dep[oó]sitos?|sacar|saques?|transfer\w*|rendiment\w*)\b/i;

function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'`])\/\/.*$/gm, '$1');
}

function palavrasDeBanco(fonte) {
  const achadas = [];
  semComentarios(fonte).split('\n').forEach((linha, i) => {
    const m = linha.match(PALAVRAS_DE_BANCO);
    if (m) achadas.push(`linha ${i + 1}: ${m[0]}`);
  });
  return achadas;
}

// Sonda positiva: o detector precisa pegar o que existe, senão "nada achado"
// não prova nada.
checar('sonda: "Seu saldo" é pego', 1, palavrasDeBanco('<p>Seu saldo é R$ 10</p>').length);
checar('sonda: "Depositar" é pego', 1, palavrasDeBanco('<Button>Depositar</Button>').length);
checar('sonda: no comentário não conta', 0, palavrasDeBanco('/* nunca "saldo" */\n// nem sacar').length);
checar('sonda: "anotou" e "guardado" passam', 0, palavrasDeBanco('<p>Você anotou R$ 500 guardado</p>').length);

const TELA_DA_RESERVA = new URL('../src/pages/tio/TioReserva.jsx', import.meta.url);
if (existsSync(TELA_DA_RESERVA)) {
  checar('TioReserva.jsx sem palavra de banco', [], palavrasDeBanco(readFileSync(TELA_DA_RESERVA, 'utf8')));
} else {
  console.log('  aviso: src/pages/tio/TioReserva.jsx ainda não existe — varredura pulada');
}
// As folhas que a reserva abre e a linha do caixa falam da mesma anotação:
// "saldo" numa delas desfaz o aviso da tela.
for (const arquivo of [
  '../src/components/financeiro/AnotarGuardadoSheet.jsx',
  '../src/components/financeiro/PlanoDaTrocaSheet.jsx',
  '../src/components/financeiro/BlocoSuaPerua.jsx',
]) {
  const url = new URL(arquivo, import.meta.url);
  if (existsSync(url)) {
    checar(`${arquivo.split('/').pop()} sem palavra de banco`, [], palavrasDeBanco(readFileSync(url, 'utf8')));
  }
}

// ─────────────────────── perfis de motorista ───────────────────────────────
//
// Os casos acima testam cada função com o dado mínimo. Estes montam a vida
// de um motorista inteiro, com os documentos COMO CHEGAM DO FIRESTORE
// (`date` é um Timestamp com `toDate`, `monthKey` desnormalizado, `amount`
// number), e conferem duas coisas: a resposta certa, e que nenhuma conta
// devolve NaN, Infinity ou negativo onde negativo não tem sentido — o defeito
// que não quebra tela nenhuma, só escreve "R$ NaN" ou "−3 litros".

bloco('18. PERFIS DE MOTORISTA');

/** Um Timestamp do Firestore: o domínio só pode depender de `toDate`. */
const ts = (iso) => {
  const d = dia(iso);
  return { toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
};
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let seqDoPerfil = 0;
/** A despesa como o `addExpense` grava (o monthKey sai da MESMA data). */
const lanc = (iso, category, amount, extra = {}) => ({
  id: `p${(seqDoPerfil += 1)}`,
  adminUid: 'tio',
  category,
  amount,
  description: '',
  date: ts(iso),
  monthKey: mk(dia(iso)),
  ...extra,
});
const abastDoPerfil = (iso, litros, amount, extra = {}) =>
  lanc(iso, 'fuel', amount, { litros, tipoCombustivel: 'diesel_s10', ...extra });

/** Varre o resultado atrás de NaN/Infinity, em qualquer profundidade. */
function numerosRuins(valor, caminho = 'r') {
  if (typeof valor === 'number') return Number.isFinite(valor) ? [] : [caminho];
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? [caminho] : [];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => numerosRuins(v, `${caminho}[${i}]`));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => numerosRuins(v, `${caminho}.${k}`));
  }
  return [];
}

/** Roda todas as réguas sobre um perfil. */
function tudo({ despesas, criancas = [], plano = null, hoje = HOJE }) {
  const abs = abastecimentosDe(despesas);
  const custo = custoMensal({ despesas, planoDaTroca: plano, hoje });
  return {
    abs,
    encher: litrosParaEncher(abs),
    preco12: precoEm12Meses(abs, hoje),
    manut: mediaDeManutencao(despesas, hoje),
    custo,
    porCrianca: custoPorCrianca({ custo, criancas }),
    cobra: mensalidadeMedia(criancas),
    alta: altaEm12Meses({ despesas, criancas, hoje }),
    semComb: mesesSemCombustivel(despesas, hoje),
    renov: proximaRenovacao(criancas, hoje),
  };
}

function semNumeroRuim(nome, r) {
  checar(`${nome}: nenhum NaN/Infinity`, [], numerosRuins(r));
  const negativos = [];
  if (r.custo && r.custo.total < 0) negativos.push('custo.total');
  if (r.porCrianca !== null && r.porCrianca < 0) negativos.push('porCrianca');
  if (r.manut && r.manut.porMes < 0) negativos.push('manut.porMes');
  if (r.encher !== null && r.encher <= 0) negativos.push('encher');
  for (const a of r.abs) if (!(a.litros > 0)) negativos.push(`litros de ${a.id}`);
  checar(`${nome}: nenhum negativo onde não cabe`, [], negativos);
}

const TURMA = [
  { id: 'c1', active: true, monthlyFee: 400, vigenciaFim: '2026-12-15' },
  { id: 'c2', active: true, monthlyFee: 450, vigenciaFim: '2027-02-10' },
  { id: 'c3', active: true, monthlyFee: 350 },
  { id: 'c4', active: false, monthlyFee: 9000, vigenciaFim: '2026-10-20' }, // saiu
];

// ── A cada 3 dias, o ano inteiro, com o preço subindo de 6,00 para 6,50 ──
{
  const despesas = [];
  for (let i = 0; i < 200; i += 1) {
    const d = new Date(2025, 10, 1 + i * 3, 12);
    if (d > HOJE) break;
    const mes = (d.getFullYear() - 2025) * 12 + d.getMonth() - 10; // 0..11
    const preco = 6 + mes * (0.5 / 11);
    const litros = 40 + (i % 3) * 5;
    despesas.push(
      abastDoPerfil(isoLocal(d), litros, Math.round(litros * preco * 100) / 100, {
        tanqueCheio: i % 4 === 0,
        posto: i % 2 ? 'Posto São João' : 'Shell da Marginal',
      })
    );
  }
  despesas.push(lanc('2025-11-20', 'monitor', 1200), lanc('2026-10-05', 'monitor', 1300));
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('a cada 3 dias', r);
  checar('a cada 3 dias: mais recente primeiro', true, r.abs.every((a, i, l) => i === 0 || l[i - 1].data >= a.data));
  checar('a cada 3 dias: preço 12m = 6,00 → 6,50', { antes: 6, agora: 6.5 }, { antes: r.preco12?.antes, agora: r.preco12?.agora });
  checar('a cada 3 dias: encher é um dos volumes usados', true, [40, 45, 50].includes(r.encher));
  checar('a cada 3 dias: nenhum mês sem combustível', [], r.semComb);
  checar('a cada 3 dias: a alta aparece (12 meses lançados)', true, r.alta !== null);
  checar('a cada 3 dias: alta do combustível positiva', true, r.alta?.partes[0].valor > 0);
  checar('a cada 3 dias: a inativa não entra no por criança', Math.round(r.custo.total / 3), r.porCrianca);
  checar('a cada 3 dias: mensalidade média ignora a inativa', 400, r.cobra);
  checar('a cada 3 dias: renovação é a da ativa, não a da que saiu', '2026-12-15', isoLocal(r.renov));
}

// ── Uma vez por semana, preço parado ──
{
  const despesas = [];
  for (let s = 0; s < 60; s += 1) {
    const d = new Date(2025, 9, 18 + s * 7, 12);
    if (d > HOJE) break;
    despesas.push(abastDoPerfil(isoLocal(d), 60, 360, { tanqueCheio: true }));
  }
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('semanal', r);
  checar('semanal: encher = 60', 60, r.encher);
  checar('semanal: preço parado, alta do combustível 0', 0, r.alta?.partes[0].valor);
  checar('semanal: preço igual dos dois lados', true, r.preco12?.antes === r.preco12?.agora);
}

// ── Uma vez por mês ──
{
  const despesas = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(2025, 10 + m, 5, 12);
    despesas.push(abastDoPerfil(isoLocal(d), 200, Math.round(200 * (5.8 + m * 0.05) * 100) / 100));
  }
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('mensal', r);
  checar('mensal: custo é a média de 12 meses', 12, r.custo.meses);
  checar('mensal: sem tanque cheio, sem Encher', null, r.encher);
  checar('mensal: nenhum mês sem combustível', [], r.semComb);
}

// ── Só lança à noite, com a data de ontem ──
{
  // Abasteceu de manhã no dia 1º; lançou às 22h do dia 2 escolhendo
  // "Ontem". O monthKey sai da data escolhida, não do dia em que digitou.
  const despesas = [abastDoPerfil('2026-09-30', 50, 300), abastDoPerfil('2026-10-01', 50, 310)];
  const hojeNoite = new Date(2026, 9, 2, 22, 0);
  const abs = abastecimentosDe(despesas);
  const p = precoEm12Meses(abs, hojeNoite);
  checar('noite: o de ontem diz "ontem"', 'ontem', haQuantoTempo(abs[0].data, hojeNoite));
  checar('noite: setembro e outubro são meses distintos', { mesAntes: '2026-09', mesAgora: '2026-10' },
    { mesAntes: p?.mesAntes, mesAgora: p?.mesAgora });
  checar('noite: data no futuro (relógio adiantado) diz "hoje"', 'hoje', haQuantoTempo(dia('2026-10-03'), hojeNoite));
}

// ── Nunca marca tanque cheio ──
{
  const despesas = [abastDoPerfil('2026-09-01', 50, 300), abastDoPerfil('2026-09-10', 70, 420), abastDoPerfil('2026-10-01', 55, 330)];
  checar('sem tanque cheio: Encher não aparece', null, litrosParaEncher(abastecimentosDe(despesas)));
  checar('um tanque cheio só: ainda não', null,
    litrosParaEncher(abastecimentosDe([...despesas, abastDoPerfil('2026-10-05', 62, 380, { tanqueCheio: true })])));
  checar('tanqueCheio "true" (texto) não conta', null,
    litrosParaEncher(abastecimentosDe([
      abastDoPerfil('2026-10-05', 62, 380, { tanqueCheio: 'true' }),
      abastDoPerfil('2026-10-06', 62, 380, { tanqueCheio: 'true' }),
    ])));
}

// ── Perua a GNV ──
{
  const despesas = [
    abastDoPerfil('2026-09-02', 18.5, 92.5, { tipoCombustivel: 'gnv', tanqueCheio: true }),
    abastDoPerfil('2026-10-02', 19, 102.6, { tipoCombustivel: 'gnv', tanqueCheio: true }),
  ];
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('GNV', r);
  checar('GNV: preço do m³', 5.4, r.abs[0].precoLitro);
  checar('GNV: o tipo vem junto', 'gnv', r.abs[0].tipo);
  checar('GNV: unidade m³', 'm³', TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === 'gnv').unidade);
  checar('GNV: encher em m³ (mediana de 18,5 e 19, arredondada)', 19, r.encher);
}

// ── Troca de posto, e o mesmo posto escrito de outro jeito ──
{
  const despesas = [
    abastDoPerfil('2026-09-01', 50, 300, { posto: 'Posto São João' }),
    abastDoPerfil('2026-09-20', 50, 320, { posto: 'Ipiranga do Centro' }),
    abastDoPerfil('2026-10-01', 50, 310, { posto: '  posto   sao joao ' }),
  ];
  const abs = abastecimentosDe(despesas);
  checar('posto: "posto sao joao" é o "Posto São João" mais recente', 6.2, ultimoNoPosto(abs, 'Posto São João')?.precoLitro);
  checar('posto: o nome lançado vem limpo', 'posto sao joao', abs[0].posto);
  checar('posto: o outro posto continua separado', 6.4, ultimoNoPosto(abs, 'ipiranga do centro')?.precoLitro);
  let lista = postoComPreco([], { nome: 'Posto São João', preco: 6.1, tipo: 'diesel_s10', em: ts('2026-09-01') });
  lista = postoComPreco(lista, { nome: 'posto sao joao', preco: 6.2, tipo: 'diesel_s10', em: ts('2026-10-01') });
  checar('posto: acento e caixa diferentes não duplicam', 1, lista.length);
  checar('posto: fica o preço novo', 6.2, lista[0].preco);
  checar('posto: só espaço não é posto', false, mesmoPosto('   ', '   '));
}

// ── 21 postos: sai o visto há mais tempo ──
{
  let lista = [];
  for (let i = 1; i <= 20; i += 1) {
    // Fora de ordem de propósito: o visto há mais tempo é o Posto 7.
    const diaDoMes = i === 7 ? 1 : i + 5;
    lista = postoComPreco(lista, {
      nome: `Posto ${i}`, preco: 6, tipo: 'diesel_s10', em: ts(`2026-09-${String(diaDoMes).padStart(2, '0')}`),
    });
  }
  const depois = postoComPreco(lista, { nome: 'Posto Novo', preco: 6.5, tipo: 'diesel_s10', em: ts('2026-10-15') });
  checar('21 postos: continuam 20', 20, depois.length);
  checar('21 postos: saiu o visto há mais tempo (Posto 7)', false, depois.some((p) => p.nome === 'Posto 7'));
  checar('21 postos: o novo ficou', true, depois.some((p) => p.nome === 'Posto Novo'));
  checar('21 postos: o novo é o primeiro em ordem', 'Posto Novo', postosEmOrdem(depois)[0].nome);
  checar('21 postos: a lista recebida não muda', 20, lista.length);
  // O recém-anotado SEM data (dado incompleto) não pode expulsar a si
  // mesmo, calado: ele é justamente o último que ele viu.
  const semData = postoComPreco(lista, { nome: 'Posto Sem Data', preco: 6.5, tipo: 'diesel_s10' });
  checar('21 postos: o recém-anotado sem data ainda entra', true, semData.some((p) => p.nome === 'Posto Sem Data'));
}

// ── Virada de ano e fevereiro ──
{
  const hojeJan = dia('2027-01-20');
  const despesas = [
    abastDoPerfil('2026-01-10', 50, 290), // fora da janela (fev/2026 a jan/2027)
    abastDoPerfil('2026-02-28', 50, 300),
    lanc('2026-03-15', 'maintenance', 600),
    abastDoPerfil('2026-12-31', 50, 320),
    abastDoPerfil('2027-01-02', 50, 325),
  ];
  const p = precoEm12Meses(abastecimentosDe(despesas), hojeJan);
  checar('virada: a janela começa em fevereiro de 2026', '2026-02', p?.mesAntes);
  checar('virada: termina em janeiro de 2027', '2027-01', p?.mesAgora);
  checar('virada: janeiro de 2026 ficou fora do preço', 6, p?.antes);
  const sem = mesesSemCombustivel(despesas, hojeJan);
  checar('virada: março a novembro avisados',
    ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'], sem);
  checar('virada: dezembro e janeiro não avisados', false, sem.includes('2026-12') || sem.includes('2027-01'));
  const m = mediaDeManutencao(despesas, hojeJan);
  checar('virada: manutenção ÷ 12 meses de uso (fev → jan)', { porMes: 50, meses: 12 }, { porMes: m?.porMes, meses: m?.meses });
  const hojeFev = dia('2027-02-28');
  const doMonitor = [lanc('2027-01-05', 'monitor', 1000), lanc('2027-02-01', 'monitor', 1000)];
  checar('fevereiro como mês atual: não é avisado', false, mesesSemCombustivel(doMonitor, hojeFev).includes('2027-02'));
  checar('fevereiro como mês atual: janeiro sem combustível é avisado', ['2027-01'], mesesSemCombustivel(doMonitor, hojeFev));
}

// ── Primeiro mês de uso ──
{
  const despesas = [abastDoPerfil('2026-10-02', 50, 315, { tanqueCheio: true }), lanc('2026-10-03', 'maintenance', 900)];
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('primeiro mês', r);
  checar('primeiro mês: custo de 1 mês', 1, r.custo.meses);
  checar('primeiro mês: a manutenção inteira no mês', 900, r.manut.porMes);
  checar('primeiro mês: sem alta', null, r.alta);
  checar('primeiro mês: sem preço de 12 meses', null, r.preco12);
  checar('primeiro mês: nada a avisar', [], r.semComb);
}

// ── Nenhuma despesa ──
{
  const r = tudo({ despesas: [], criancas: TURMA });
  semNumeroRuim('sem despesa', r);
  checar('sem despesa: custo null', null, r.custo);
  checar('sem despesa: por criança null', null, r.porCrianca);
  checar('sem despesa: manutenção null', null, r.manut);
  checar('sem despesa: nada a avisar', [], r.semComb);
  checar('despesas null não quebra', null, custoMensal({ despesas: null, hoje: HOJE }));
}

// ── Mensalidade 0 ou ausente ──
{
  checar('mensalidade: 0, null e ausente não entram na média', 500,
    mensalidadeMedia([{ monthlyFee: 0 }, {}, { monthlyFee: 500 }, { monthlyFee: null }]));
  checar('mensalidade: todas zero → null', null, mensalidadeMedia([{ monthlyFee: 0 }, { monthlyFee: undefined }]));
  checar('mensalidade: negativa não entra', null, mensalidadeMedia([{ monthlyFee: -300 }]));
  checar('mensalidade: lista null', null, mensalidadeMedia(null));
}

// ── Zero crianças, e só crianças que saíram ──
{
  const despesas = [abastDoPerfil('2026-10-02', 50, 315)];
  const r0 = tudo({ despesas, criancas: [] });
  semNumeroRuim('zero crianças', r0);
  checar('zero crianças: por criança null (sem ÷ 0)', null, r0.porCrianca);
  checar('zero crianças: alta null', null, r0.alta);
  const ri = tudo({ despesas, criancas: [{ active: false, monthlyFee: 400 }] });
  checar('só inativa: por criança null', null, ri.porCrianca);
  checar('só inativa: mensalidade null', null, ri.cobra);
  checar('crianças como número 0', null, custoPorCrianca({ custo: { total: 100 }, criancas: 0 }));
  checar('crianças como texto', null, custoPorCrianca({ custo: { total: 100 }, criancas: 'abc' }));
}

// ── A renovação: passado, hoje, 59/60/61 dias, ausente ──
{
  const h = HOJE;
  const em = (dias) => isoLocal(new Date(h.getFullYear(), h.getMonth(), h.getDate() + dias, 12));
  const renov = (vig) => proximaRenovacao([{ active: true, vigenciaFim: vig }], h);
  checar('renovação no passado: ignorada', null, renov(em(-1)));
  checar('renovação hoje: conta e fica em destaque', true, emDestaque(renov(em(0)), h));
  checar('renovação em 59 dias: destaque', true, emDestaque(renov(em(59)), h));
  checar('renovação em 60 dias: destaque', true, emDestaque(renov(em(60)), h));
  checar('renovação em 61 dias: sem destaque', false, emDestaque(renov(em(61)), h));
  checar('renovação ausente: null', null, renov(undefined));
  checar('renovação em texto fora do formato: null', null, renov('31/12/2026'));
  checar('renovação como Timestamp', em(30), isoLocal(proximaRenovacao([{ vigenciaFim: ts(em(30)) }], h)));
  checar('renovação: a mais perto entre várias', em(20),
    isoLocal(proximaRenovacao([{ vigenciaFim: em(90) }, { vigenciaFim: em(20) }, { vigenciaFim: em(-5) }], h)));
  checar('renovação: criança inativa não conta', null, proximaRenovacao([{ active: false, vigenciaFim: em(10) }], h));
  checar('emDestaque(null)', false, emDestaque(null, h));
}

// ── O plano da troca nos extremos ──
{
  const base = { valorHoje: 240000, criadoEm: ts('2026-10-01') };
  checar('plano valorFinal 0: válido', true, planoValido({ ...base, anos: 5, valorFinal: 0 }));
  checar('plano valorFinal 0: meta inteira', 240000, metaDaTroca({ ...base, anos: 5, valorFinal: 0 }));
  checar('plano 1 ano: por mês', 20000, porMesParaTroca({ ...base, anos: 1, valorFinal: 0 }));
  checar('plano 1 ano: fim', 'outubro de 2027', rotuloDoFim({ ...base, anos: 1, valorFinal: 0 }));
  checar('plano 20 anos: por mês', 1000, porMesParaTroca({ ...base, anos: 20, valorFinal: 0 }));
  checar('plano 20 anos: fim', 'outubro de 2046', rotuloDoFim({ ...base, anos: 20, valorFinal: 0 }));
  checar('plano 21 anos: inválido', false, planoValido({ ...base, anos: 21, valorFinal: 0 }));
  checar('plano 2,5 anos: inválido', false, planoValido({ ...base, anos: 2.5, valorFinal: 0 }));
  checar('plano anos "5" (texto): inválido', false, planoValido({ ...base, anos: '5', valorFinal: 0 }));
  checar('plano final = hoje: inválido', false, planoValido({ ...base, anos: 5, valorFinal: 240000 }));
  checar('plano final negativo: inválido', false, planoValido({ ...base, anos: 5, valorFinal: -1 }));
  checar('plano NaN: inválido', false, planoValido({ valorHoje: NaN, anos: 5, valorFinal: 0 }));
  checar('plano sem criadoEm (servidor ainda não gravou): sem fim', '', rotuloDoFim({ valorHoje: 1000, anos: 1, valorFinal: 0 }));
  // Feito em 29/02: um ano depois não existe 29/02, e o fim é fevereiro,
  // não 1º de março.
  checar('plano feito em 29/02: o fim é fevereiro', 'fevereiro de 2029',
    rotuloDoFim({ valorHoje: 1000, anos: 1, valorFinal: 0, criadoEm: ts('2028-02-29') }));
}

// ── Guardado maior que a meta ──
{
  checar('guardado > meta: progresso 1', 1, progresso({ valor: 300000 }, 240000));
  checar('guardado = meta: progresso 1', 1, progresso(240000, 240000));
  checar('guardado negativo: progresso 0', 0, progresso({ valor: -50 }, 240000));
  checar('guardado texto lixo: progresso 0', 0, progresso({ valor: 'abc' }, 240000));
  checar('meta 0: null', null, progresso(100, 0));
  checar('meta NaN: null', null, progresso(100, NaN));
}

// ── Outras categorias não mexem no combustível ──
{
  const so = [abastDoPerfil('2026-09-05', 50, 300), abastDoPerfil('2026-10-05', 50, 320)];
  const com = [
    ...so,
    lanc('2026-09-10', 'maintenance', 1500),
    lanc('2026-10-01', 'installment', 2000),
    lanc('2026-10-02', 'other', 50, { litros: 30 }),
    lanc('2026-10-03', 'insurance', 300),
  ];
  checar('outras categorias: os mesmos abastecimentos', abastecimentosDe(so).map((a) => a.id), abastecimentosDe(com).map((a) => a.id));
  checar('outras categorias: o mesmo preço de 12 meses', precoEm12Meses(abastecimentosDe(so), HOJE), precoEm12Meses(abastecimentosDe(com), HOJE));
  checar('outras categorias: "other" com litros não é abastecimento', false, abastecimentosDe(com).some((a) => a.id === com[4].id));
  const c = custoMensal({ despesas: com, hoje: HOJE });
  checar('outras categorias: o combustível do custo é só o fuel', 310, c.partes.find((p) => p.chave === 'fuel')?.valor);
  checar('categoria desconhecida vai para "Outros"', 'other',
    custoMensal({ despesas: [lanc('2026-10-01', 'pedagio', 80)], hoje: HOJE }).partes[0].chave);
}

// ── Abastecimento antigo SEM litros (anterior à feature) ──
{
  const despesas = [
    lanc('2026-03-05', 'fuel', 900), // antigo: só o valor
    lanc('2026-04-05', 'fuel', 950, { litros: null }),
    lanc('2026-05-05', 'fuel', 980, { litros: '' }),
    lanc('2026-06-05', 'fuel', 990, { litros: 0 }),
    abastDoPerfil('2026-09-05', 50, 300),
    abastDoPerfil('2026-10-05', 50, 320),
  ];
  const r = tudo({ despesas, criancas: TURMA });
  semNumeroRuim('sem litros', r);
  checar('sem litros: fora dos abastecimentos', 2, r.abs.length);
  checar('sem litros: continua no custo (é gasto)', Math.round((900 + 950 + 980 + 990 + 300 + 320) / 6),
    r.custo.partes.find((p) => p.chave === 'fuel')?.valor);
  checar('sem litros: o mês dele não é "sem combustível"', false, r.semComb.includes('2026-03'));
  checar('sem litros: o preço de 12 meses só usa os que têm litros', { antes: 6, agora: 6.4 },
    { antes: r.preco12?.antes, agora: r.preco12?.agora });
  checar('litros com valor 0: preço null, não Infinity', null, abastecimentosDe([abastDoPerfil('2026-10-01', 40, 0)])[0].precoLitro);
  checar('documento sem date: ignorado', 0, abastecimentosDe([{ category: 'fuel', litros: 40, amount: 200 }]).length);
  checar('amount em texto vira número', 200, abastecimentosDe([abastDoPerfil('2026-10-01', 40, '200')])[0].valor);
}

// ── Preço com uma casa a mais (6,339) ──
{
  checar('6,339: plausível', true, precoPlausivel(6.339));
  checar('6,339: R$ 300 dão 47,3 litros', 47.3, litrosPorValor(300, 6.339));
  checar('6,339: 50 litros custam R$ 316,95', 316.95, valorPorLitros(50, 6.339));
  checar('6,339: o preço do abastecimento volta com 2 casas', 6.34, precoDoLitro({ valor: 316.95, litros: 50 }));
}

// ── Entradas que não podem virar conta ──
{
  checar('litrosPorValor com preço 0', null, litrosPorValor(300, 0));
  checar('litrosPorValor com NaN', null, litrosPorValor(NaN, 6));
  checar('valorPorLitros com Infinity', null, valorPorLitros(Infinity, 6));
  checar('precoDoLitro sem nada', null, precoDoLitro());
  checar('haQuantoTempo com data lixo', '', haQuantoTempo('lixo', HOJE));
  checar('altaEm12Meses sem argumento', null, altaEm12Meses());
  checar('custoPorCrianca sem argumento', null, custoPorCrianca());
}

// ───────────────── o posto pelo lugar (04/10/2026) ─────────────────────────
{
  const em = new Date(2026, 9, 2);
  let lista = postoComPreco([], { nome: 'Posto Shell', preco: 6.29, tipo: 'diesel_s10', em, endereco: '  Av. Interlagos,  1500 · Socorro ', lat: -23.654321, lng: -46.712345 });
  checar('lugar: o ponto do posto vai com 4 casas', { lat: -23.6543, lng: -46.7123 }, { lat: lista[0].lat, lng: lista[0].lng });
  checar('lugar: o endereço vem limpo', 'Av. Interlagos, 1500 · Socorro', lista[0].endereco);
  lista = postoComPreco(lista, { nome: 'posto shell', preco: 6.39, tipo: 'diesel_s10', em: new Date(2026, 9, 9) });
  checar('lugar: anotar o preço de novo NÃO apaga o lugar', [-23.6543, 'Av. Interlagos, 1500 · Socorro'], [lista[0].lat, lista[0].endereco]);
  checar('lugar: e o preço novo fica', 6.39, lista[0].preco);
  checar('lugar: o raio é de 200 metros', 200, RAIO_DO_POSTO_M);
  checar('lugar: a 40 metros, é o posto', ['posto shell'], postosPerto(lista, { lat: -23.6546, lng: -46.7124 }).map((p) => p.nome));
  checar('lugar: a 1 km, não é', 0, postosPerto(lista, { lat: -23.6633, lng: -46.7123 }).length);
  const dois = postoComPreco(lista, { nome: 'Ipiranga', preco: 6.1, tipo: 'diesel_s10', em, lat: -23.6550, lng: -46.7123 });
  checar('lugar: dois perto, o mais perto primeiro', ['posto shell', 'Ipiranga'], postosPerto(dois, { lat: -23.6544, lng: -46.7123 }).map((p) => p.nome));
  checar('lugar: posto sem ponto guardado não entra', 0, postosPerto([{ nome: 'BR', preco: 6 }], { lat: -23.6, lng: -46.7 }).length);
  checar('lugar: sem posição, nada', 0, postosPerto(lista, null).length);
  checar('lugar: ponto fora do mapa é null', null, pontoDoPosto(200, 10));
  checar('lugar: endereço pelo nome', 'Av. Interlagos, 1500 · Socorro', enderecoDoPosto(lista, 'POSTO SHELL'));
  checar('lugar: posto sem endereço devolve vazio', '', enderecoDoPosto(dois, 'Ipiranga'));
  const tela = readFileSync(new URL('../src/pages/tio/TioAbastecer.jsx', import.meta.url), 'utf8');
  checar('lugar: a tela NÃO preenche o preço com o último visto', false, tela.includes('textoDe(ultimo.preco'));
  checar('lugar: a tela pergunta se ele está no posto', true, tela.includes('Você está no posto agora?'));
}

// ───────────────────────────── resumo ──────────────────────────────────────

console.log('');
console.log(`${ok} ok, ${bad} falha(s)`);
if (bad) {
  console.log('');
  for (const f of falhas) console.log(` - ${f}`);
  process.exit(1);
}
