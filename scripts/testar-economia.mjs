/**
 * "ECONOMIA DO MÊS" — a régua da tela do motorista (05/10/2026, versão B).
 *
 * POR QUE ESTE TESTE
 * A tela mostra inflação, juros, dólar e o litro que ELE pagou, e quanto o
 * custo dele por criança subiu. O erro caro não é um número feio, são três:
 *   1. a tela SUGERIR reajuste — um percentual perto de "mensalidade", um
 *      "aumente", um "sugerimos" (regra do dono, a mesma do "Preciso
 *      aumentar?");
 *   2. a tela AFIRMAR sem dado — 0% de inflação porque o documento não
 *      chegou, "ficou igual" porque não havia o valor de antes;
 *   3. as duas telas do custo DISCORDAREM — a Economia refazendo a conta do
 *      "Preciso aumentar?" por conta própria.
 * E a resposta do contrato manda tocar num botão: o teste confere que o
 * botão existe na ficha.
 *
 * COMO RODAR
 *   node scripts/testar-economia.mjs      (ou: npm run testar:economia)
 */

import { readFileSync } from 'node:fs';
import {
  MOVIMENTO,
  PERGUNTAS_DO_ENTENDA,
  ROTA_DE_ABASTECER,
  TEXTOS_DA_TELA,
  cartaoDaInflacao,
  cartaoDoCombustivel,
  cartaoDoDolar,
  cartaoDosJuros,
  cartoesDaEconomia,
  custoNaEconomia,
  fraseDoCusto,
  movimento,
  percentualComSinal,
  textoDoMovimento,
} from '../src/dominio/cobranca/economia.js';
import { altaEm12Meses, custoMensal, custoPorCrianca } from '../src/dominio/cobranca/precisoAumentar.js';
import { rotaProtegida } from '../src/dominio/identidade/trancaDoFinanceiro.js';

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

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

/** Tira comentários de JS/JSX: o porquê pode falar de reajuste; a tela não. */
function semComentarios(fonte) {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

// Os índices como a sondagem de 05/10/2026 os gravaria.
const IPCA = { mes: '2026-08', ipca12m: 4.22, mesAntes: '2025-08', ipca12mAntes: 5.13 };
const SELIC = { data: '2026-10-05', valor: 13.75, desde: '2026-09-17', dataAntes: '2025-10-05', valorAntes: 15 };
const DOLAR = { data: '2026-10-02', valor: 5.2238, desde: '2026-10-02', dataAntes: '2025-10-02', valorAntes: 5.3449 };
const HOJE = new Date(2026, 9, 5, 12);

const dia = (a, m, d) => new Date(a, m - 1, d, 12);
const mk = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
const fuel = (a, m, litros, preco) => ({
  category: 'fuel', amount: Math.round(litros * preco * 100) / 100, litros, date: dia(a, m, 10), monthKey: mk(a, m),
});
const despesa = (categoria, a, m, valor) => ({ category: categoria, amount: valor, date: dia(a, m, 15), monthKey: mk(a, m) });
const turma = (n, mensalidade = 500) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, active: true, monthlyFee: mensalidade }));

/** 12 meses, de novembro/2025 a outubro/2026: litro de 6,00 a 6,55, manutenção de 300 a 500. */
function umAnoDeDespesas() {
  const lista = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(2025, 10 + i, 1);
    const a = d.getFullYear();
    const m = d.getMonth() + 1;
    lista.push(fuel(a, m, 400, 6 + i * 0.05));
    lista.push(despesa('maintenance', a, m, i < 6 ? 300 : 500));
    lista.push(despesa('monitor', a, m, 1200));
    lista.push(despesa('insurance', a, m, 250));
  }
  return lista;
}

// ─────────────────────────────── a seta ─────────────────────────────────────

bloco('A seta');
checar('subiu', MOVIMENTO.SUBIU, movimento(6.3, 6));
checar('desceu', MOVIMENTO.DESCEU, movimento(4.22, 5.13));
checar('igual nos centavos', MOVIMENTO.IGUAL, movimento(5.2238, 5.22381));
checar('sem o de antes → null (não inventa "igual")', null, movimento(4.22, null));
checar('sem o de agora → null', null, movimento(undefined, 4));
checar('texto: em 12 meses', 'Subiu em 12 meses', textoDoMovimento(MOVIMENTO.SUBIU));
checar('texto: desde um mês', 'Desceu desde março de 2026', textoDoMovimento(MOVIMENTO.DESCEU, { desde: 'março de 2026' }));
checar('texto: igual', 'Igual a 12 meses atrás', textoDoMovimento(MOVIMENTO.IGUAL));
checar('sem movimento, sem texto', null, textoDoMovimento(null));

// ─────────────────────────────── os índices ─────────────────────────────────

bloco('Os índices com dado (os da sondagem)');
{
  const i = cartaoDaInflacao(IPCA);
  checar('inflação: número, %, seta e fonte',
    ['4,22', '%', 'desceu', 'Desceu em 12 meses', 'IPCA 12 meses · IBGE · agosto'],
    [i.numero, i.sufixo, i.movimento, i.textoDoMovimento, i.fonte]);
  const j = cartaoDosJuros(SELIC);
  checar('juros: Selic, desde a reunião', ['13,75', '%', 'desceu', 'Selic · Banco Central · desde 17/09'],
    [j.numero, j.sufixo, j.movimento, j.fonte]);
  checar('juros sem "desde" → a data do valor', 'Selic · Banco Central · 05/10',
    cartaoDosJuros({ ...SELIC, desde: null }).fonte);
  const d = cartaoDoDolar(DOLAR);
  checar('dólar: PTAX com R$, dia útil', ['R$ ', '5,22', 'desceu', 'PTAX · Banco Central · 02/10'],
    [d.prefixo, d.numero, d.movimento, d.fonte]);
  checar('os quatro, na ordem da tela', ['inflacao', 'juros', 'dolar', 'combustivel'],
    cartoesDaEconomia({ indices: { ipca: IPCA, selic: SELIC, dolar: DOLAR }, hoje: HOJE }).map((c) => c.chave));
}

bloco('Os índices SEM dado: nunca zero');
for (const [nome, c] of [
  ['inflação', cartaoDaInflacao(null)],
  ['juros', cartaoDosJuros(null)],
  ['dólar', cartaoDoDolar(undefined)],
  ['inflação com campo quebrado', cartaoDaInflacao({ mes: '2026-08', ipca12m: '4.22' })],
]) {
  checar(`${nome}: sem número, sem seta, diz que não chegou`, [null, null, TEXTOS_DA_TELA.semIndice],
    [c.numero, c.textoDoMovimento, c.semDado?.texto]);
}
checar('IPCA sem o mês de um ano antes → número sem seta', ['4,22', null],
  (({ numero, textoDoMovimento: t }) => [numero, t])(cartaoDaInflacao({ ...IPCA, mesAntes: null, ipca12mAntes: null })));
checar('sem âmbar em lugar nenhum da régua (seta é neutra)', false,
  JSON.stringify(cartoesDaEconomia({ indices: { ipca: IPCA, selic: SELIC, dolar: DOLAR }, hoje: HOJE })).includes('warning'));

// ─────────────────────────────── o combustível ──────────────────────────────

bloco('O combustível é o DELE');
{
  const sem = cartaoDoCombustivel({ despesas: [], hoje: HOJE });
  checar('sem abastecimento: diz onde lançar (Abastecer)', [null, ROTA_DE_ABASTECER, 'Abastecer'],
    [sem.numero, sem.semDado.rota, sem.semDado.rotulo]);
  checar('combustível sem litros não conta como preço', null,
    cartaoDoCombustivel({ despesas: [{ category: 'fuel', amount: 300, date: dia(2026, 10, 1) }], hoje: HOJE }).numero);

  const um = cartaoDoCombustivel({ despesas: [fuel(2026, 10, 50, 6.2), fuel(2026, 10, 50, 6.4)], tipo: 'diesel_s10', hoje: HOJE });
  checar('um mês só: a média do mês, sem seta', ['Diesel S10', '6,30', null, 'Seus abastecimentos · outubro'],
    [um.nome, um.numero, um.textoDoMovimento, um.fonte]);

  const ano = cartaoDoCombustivel({ despesas: umAnoDeDespesas(), tipo: 'diesel_s10', hoje: HOJE });
  checar('um ano: o mês mais recente contra o mais antigo, e DESDE QUANDO',
    ['6,55', 'subiu', 'Subiu desde novembro de 2025'],
    [ano.numero, ano.movimento, ano.textoDoMovimento]);

  const gnv = cartaoDoCombustivel({ despesas: [fuel(2026, 10, 20, 5)], tipo: 'gnv', hoje: HOJE });
  checar('GNV fala em m³', true, gnv.frase.includes('m³'));
}

// ─────────────────────────────── o custo ────────────────────────────────────

bloco('O custo: o que falta, sem número');
checar('sem turma', 'sem-turma', custoNaEconomia({ despesas: umAnoDeDespesas(), criancas: [], hoje: HOJE }).estado);
checar('turma toda inativa conta como sem turma', 'sem-turma',
  custoNaEconomia({ despesas: umAnoDeDespesas(), criancas: [{ active: false }], hoje: HOJE }).estado);
checar('sem despesa', 'sem-despesa', custoNaEconomia({ despesas: [], criancas: turma(10), hoje: HOJE }).estado);
{
  const tres = umAnoDeDespesas().filter((d) => d.monthKey >= '2026-08');
  const c = custoNaEconomia({ despesas: tres, criancas: turma(10), hoje: HOJE });
  checar('3 meses: diz quantos faltam, sem número de custo',
    ['sem-alta', 'Você tem 3 meses com despesa lançada. Faltam 7 meses para comparar com 12 meses atrás.', undefined],
    [c.estado, c.texto, c.hoje]);
}

bloco('O custo: a MESMA conta do "Preciso aumentar?"');
{
  const despesas = umAnoDeDespesas();
  const criancas = turma(10);
  const c = custoNaEconomia({ despesas, criancas, ipca: IPCA, hoje: HOJE });
  const porCrianca = custoPorCrianca({ custo: custoMensal({ despesas, hoje: HOJE }), criancas });
  const alta = altaEm12Meses({ despesas, criancas, hoje: HOJE });
  checar('pronto', 'pronto', c.estado);
  checar('"hoje" é o custo por criança da régua de lá', porCrianca, c.hoje);
  checar('a diferença é a alta da régua de lá', alta.total, c.total);
  checar('"custava" = hoje − diferença', c.hoje - c.total, c.antes);
  checar('as partes fecham com o total', c.total, c.partes.reduce((s, p) => s + p.valor, 0));
  checar('combustível, manutenção e o resto, nessa ordem', ['combustivel', 'manutencao', 'resto'], c.partes.map((p) => p.chave));
  checar('o combustível é o da régua de lá (preço × litros ÷ crianças)',
    alta.partes.find((p) => p.chave === 'combustivel').valor, c.partes[0].valor);
  checar('as larguras somam ~100', true, Math.abs(c.partes.reduce((s, p) => s + p.largura, 0) - 100) <= 1);
  checar('variação do CUSTO com uma casa', Math.round((c.total / c.antes) * 1000) / 10, c.variacao);
  checar('a inflação vai ao lado', 4.22, c.inflacao);
  checar('sem IPCA, a inflação é null (a tela diz "Sem dado")', null,
    custoNaEconomia({ despesas, criancas, hoje: HOJE }).inflacao);
  const frase = fraseDoCusto(c, (v) => `R$ ${v}`);
  checar('a frase diz custava e hoje', `Cada criança custava R$ ${c.antes} por mês. Hoje custa R$ ${c.hoje}.`, frase);
}
{
  // Custo que caiu: a parte negativa aparece, e a barra dela fica vazia.
  const despesas = umAnoDeDespesas().map((d) => (d.category === 'maintenance'
    ? { ...d, amount: d.monthKey < '2026-05' ? 900 : 300 } : d));
  const c = custoNaEconomia({ despesas, criancas: turma(10), hoje: HOJE });
  const man = c.partes.find((p) => p.chave === 'manutencao');
  checar('parte que caiu: valor negativo, barra zero', [true, 0], [man.valor < 0, man.largura]);
}
checar('percentual com sinal', ['+8,3%', '−2,0%', '0,0%', '—'],
  [percentualComSinal(8.33), percentualComSinal(-2), percentualComSinal(0), percentualComSinal(null)]);

// ─────────────────────────────── o Entenda ──────────────────────────────────

bloco('O Entenda');
checar('três perguntas, na ordem do dono', [
  'O que é a Selic e por que me importa?',
  'Por que o dólar mexe no diesel?',
  'Posso aumentar a mensalidade no meio do contrato?',
], PERGUNTAS_DO_ENTENDA.map((p) => p.pergunta));
checar('a resposta do contrato, palavra por palavra (com o botão de hoje)',
  'Sozinho, não. O valor combinado com a família vale até o fim do contrato. Você pode propor um valor novo: na ficha da criança, toque em "Editar". A família recebe um contrato novo e o valor só passa a valer quando ela aceitar. Na renovação, o valor novo entra no contrato seguinte.',
  PERGUNTAS_DO_ENTENDA[2].resposta);
{
  // O botão que a resposta manda tocar EXISTE na ficha, e abre a folha do
  // combinado (contrato novo depois do aceite).
  const ficha = ler('src/pages/ChildDetail.jsx');
  const cartao = ler('src/components/contract/CartaoDoCombinado.jsx');
  checar('a ficha tem o "Editar" no bloco Dinheiro', true,
    /titulo="Dinheiro"[\s\S]{0,200}onEditar=/.test(ficha));
  checar('o cartão do combinado mostra "Editar" e abre a EditarCombinadoSheet', true,
    /> Editar\s*</.test(cartao) && cartao.includes('<EditarCombinadoSheet'));
  checar('nenhuma resposta manda tocar em "Mudar" (o nome antigo)', false,
    PERGUNTAS_DO_ENTENDA.some((p) => p.resposta.includes('"Mudar"')));
}

// ─────────────────────────── informar, nunca sugerir ────────────────────────

bloco('Nenhum texto sugere reajuste, investimento ou IA');
const PROIBIDOS = [
  [/aumente/i, '"aumente"'],
  [/reajust/i, '"reajuste"'],
  [/sugerimos|sugerido|sugest|sugir/i, 'sugestão'],
  [/recomend|aconselh/i, 'recomendação'],
  [/cobr(e|ar) mais/i, '"cobre mais"'],
  [/invist|investimento|aplique|aplicação|poupança|rendimento|render/i, 'investimento'],
  [/intelig[eê]ncia artificial|\bIA\b/, 'IA'],
  [/mensalidade[^.]{0,40}\d+([,.]\d+)?\s*%/i, '% perto de mensalidade'],
  [/\d+([,.]\d+)?\s*%[^.]{0,40}mensalidade/i, '% perto de mensalidade'],
];
function proibidoEm(texto) {
  return PROIBIDOS.filter(([re]) => re.test(texto)).map(([, nome]) => nome);
}
// Sondas positivas: o varredor precisa pegar o que veio proibir.
checar('sonda: "Sugerimos reajuste de 8% na mensalidade" é pego', true,
  proibidoEm('Sugerimos reajuste de 8% na mensalidade.').length > 0);
checar('sonda: "aumente a mensalidade em 5%" é pego', true, proibidoEm('Você pode subir a mensalidade em 5%.').length > 0
  && proibidoEm('Aumente').length > 0);
checar('sonda: "Seu custo +8,3%" NÃO é pego (é custo, não preço)', [], proibidoEm('Seu custo por criança +8,3%'));

{
  const cenarios = [
    cartoesDaEconomia({ indices: { ipca: IPCA, selic: SELIC, dolar: DOLAR }, despesas: umAnoDeDespesas(), tipo: 'diesel_s10', hoje: HOJE }),
    cartoesDaEconomia({ indices: {}, despesas: [], hoje: HOJE }),
    cartoesDaEconomia({ indices: {}, despesas: [fuel(2026, 10, 30, 6)], tipo: 'gnv', hoje: HOJE }),
  ].flat();
  const custos = [
    custoNaEconomia({ despesas: umAnoDeDespesas(), criancas: turma(10), ipca: IPCA, hoje: HOJE }),
    custoNaEconomia({ despesas: [], criancas: turma(10), hoje: HOJE }),
    custoNaEconomia({ despesas: umAnoDeDespesas(), criancas: [], hoje: HOJE }),
    custoNaEconomia({ despesas: umAnoDeDespesas().slice(-8), criancas: turma(3), hoje: HOJE }),
  ];
  const textos = [
    ...cenarios.flatMap((c) => [c.nome, c.textoDoMovimento, c.frase, c.fonte, c.semDado?.texto, c.semDado?.rotulo]),
    ...custos.flatMap((c) => [c.texto, fraseDoCusto(c, (v) => `R$ ${v}`), ...(c.partes || []).map((p) => p.rotulo)]),
    ...PERGUNTAS_DO_ENTENDA.flatMap((p) => [p.pergunta, p.resposta]),
    ...Object.values(TEXTOS_DA_TELA),
  ].filter(Boolean);
  const achados = textos.flatMap((t) => proibidoEm(t).map((p) => `${p}: ${t}`));
  checar(`os ${textos.length} textos da régua estão limpos`, [], achados);

  const tela = semComentarios(ler('src/pages/tio/TioEconomia.jsx'));
  checar('a tela (sem comentários) está limpa', [], proibidoEm(tela));
  checar('a tela não usa âmbar (seta neutra)', false, /warning/.test(tela));
  checar('a tela tem UM botão cheio (um <Button> primário)', 1, (tela.match(/<Button\b/g) || []).length);
}

// ─────────────────────────────── a rota ─────────────────────────────────────

bloco('A rota e as portas');
checar('/tio/finance/economia pede a senha do Financeiro', true, rotaProtegida('/tio/finance/economia'));
checar('a rota está no App', true, ler('src/App.jsx').includes('path="finance/economia"'));
checar('a porta no grupo "Sua perua"', true, ler('src/components/financeiro/BlocoSuaPerua.jsx').includes("'/tio/finance/economia'"));
checar('a porta no "Preciso aumentar?"', true, ler('src/pages/tio/TioPrecisoAumentar.jsx').includes('"/tio/finance/economia"'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
