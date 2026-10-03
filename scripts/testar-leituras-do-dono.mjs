/**
 * QUANTO CADA TELA LÊ — o custo que não aparece em teste nenhum.
 *
 * POR QUE ESTE TESTE
 * Leitura demais não quebra nada. A tela abre, os números batem, e a conta do
 * Firestore cresce com a base: o painel do dono lia a lista de motoristas três
 * vezes na abertura, a caixa de chamados baixava `users` inteira para mostrar
 * vinte nomes, a soma do GMV caía em "baixar todo pagamento quitado" quando a
 * agregação falhava, e a responsável assinava toda mensalidade que já teve.
 * Nenhum desses defeitos produz erro — e é por isso que cada um precisa de uma
 * linha aqui, ou volta na primeira refatoração que "simplifica" a consulta.
 *
 * O QUE ELE MEDE
 *   1. o cache compartilhado (`compartilhado/cacheComValidade.js`), puro, com
 *      relógio injetado — validade, `forcar`, falha que não fica guardada e a
 *      promessa dividida entre quem pede junto;
 *   2. a janela de meses (`addMonths`), que decide onde as consultas cortam;
 *   3. por LEITURA DE ARQUIVO, que as consultas continuam com teto — os
 *      services importam o Firebase, e o Node não os carrega (ver
 *      `testar:imports`).
 *
 * COMO RODAR
 *   node scripts/testar-leituras-do-dono.mjs
 */

import { readFileSync } from 'node:fs';
import {
  aindaValido,
  criarCacheComValidade,
} from '../src/compartilhado/cacheComValidade.js';
import { addMonths } from '../src/compartilhado/formatters.js';

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

// CRLF vira LF: no Windows o checkout traz `\r\n` (autocrlf), e o corte de
// `corpoDe` procura o fechamento pela quebra de linha.
const ler = (rel) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/**
 * O corpo de uma função, do nome até o fechamento no início da linha. Os
 * arquivos seguem o formato do projeto (função de topo fecha com `}` na
 * coluna zero), e é isso que torna a fatia confiável sem um parser.
 */
function corpoDe(fonte, assinatura) {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return null;
  const f = fonte.indexOf('\n}\n', i);
  return fonte.slice(i, f < 0 ? undefined : f + 2);
}

// ───────────────────────────── 1. o cache ──────────────────────────────────
console.log('\n─── o cache com validade ───');

checar('dentro da validade vale', true, aindaValido(1000, 1500, 1000));
checar('na fronteira já não vale', false, aindaValido(1000, 2000, 1000));
checar('relógio que voltou não vale (seria para sempre)', false, aindaValido(1000, 900, 1000));
checar('sem validade nunca vale', false, aindaValido(1000, 1000, 0));
checar('data inválida não vale', false, aindaValido(NaN, 1000, 1000));

{
  let agora = 0;
  let idas = 0;
  const cache = criarCacheComValidade({ validadeMs: 60_000, relogio: () => agora });
  const buscar = () => {
    idas += 1;
    return Promise.resolve(`leitura ${idas}`);
  };

  const a = await cache.obter(buscar);
  agora = 59_999;
  const b = await cache.obter(buscar);
  checar('a segunda pedida dentro do prazo não vai ao banco', 1, idas);
  checar('e devolve a mesma leitura', a, b);

  agora = 60_000;
  const c = await cache.obter(buscar);
  checar('vencido, lê de novo', 2, idas);
  checar('e devolve a leitura nova', 'leitura 2', c);

  await cache.obter(buscar, { forcar: true });
  checar('`forcar` lê mesmo dentro do prazo (quem acabou de escrever)', 3, idas);

  cache.esquecer();
  await cache.obter(buscar);
  checar('`esquecer` esvazia', 4, idas);
}

{
  // DUAS ABAS MONTANDO JUNTAS: uma ida ao banco, não duas.
  let idas = 0;
  let soltar;
  const cache = criarCacheComValidade({ validadeMs: 60_000, relogio: () => 0 });
  const buscar = () => {
    idas += 1;
    return new Promise((r) => {
      soltar = r;
    });
  };
  const p1 = cache.obter(buscar);
  const p2 = cache.obter(buscar);
  checar('pedidas simultâneas dividem a mesma promessa', true, p1 === p2);
  // `buscar` roda no microtask seguinte (é o que captura o throw síncrono).
  await new Promise((r) => setTimeout(r, 0));
  soltar('pronto');
  checar('e o banco foi consultado uma vez', 1, idas);
  checar('as duas recebem o resultado', ['pronto', 'pronto'], await Promise.all([p1, p2]));
}

{
  // A FALHA NÃO FICA GUARDADA: a próxima aba tenta de novo.
  let idas = 0;
  const cache = criarCacheComValidade({ validadeMs: 60_000, relogio: () => 0 });
  const quebra = () => {
    idas += 1;
    throw new Error('sem rede');
  };
  let erro = null;
  try {
    await cache.obter(quebra);
  } catch (e) {
    erro = e.message;
  }
  checar('o erro chega a quem pediu (até o throw síncrono)', 'sem rede', erro);
  // Deixa o `.catch` interno rodar antes da próxima pedida.
  await new Promise((r) => setTimeout(r, 0));
  const depois = await cache.obter(() => {
    idas += 1;
    return 'voltou';
  });
  checar('depois da falha, lê de novo em vez de repetir o erro', 'voltou', depois);
  checar('foram duas idas', 2, idas);
}

{
  // A falha de uma leitura VELHA não apaga a leitura nova que já a substituiu.
  let agora = 0;
  let rejeitarVelha;
  const cache = criarCacheComValidade({ validadeMs: 10, relogio: () => agora });
  const velha = cache.obter(() => new Promise((_, rej) => { rejeitarVelha = rej; }));
  velha.catch(() => {});
  agora = 20;
  let idas = 0;
  const nova = () => {
    idas += 1;
    return 'nova';
  };
  await cache.obter(nova);
  rejeitarVelha(new Error('velha caiu'));
  await new Promise((r) => setTimeout(r, 0));
  await cache.obter(nova);
  checar('a falha atrasada da leitura velha não esvazia a nova', 1, idas);
}

// ─────────────────────────── 2. a janela de meses ──────────────────────────
console.log('\n─── a janela de 12 meses ───');

// "12 meses" é o atual mais 11 para trás — o mesmo `-1` de MESES_NAVEGAVEIS_ATRAS.
checar('outubro olha até novembro do ano anterior', '2025-11', addMonths('2026-10', -11));
checar('janeiro atravessa o ano', '2025-02', addMonths('2026-01', -11));
checar('e a chave se compara como texto na ordem certa', true,
  addMonths('2026-10', -11) <= '2025-12' && '2025-10' < addMonths('2026-10', -11));

// ─────────────────────── 3. as consultas têm teto ──────────────────────────
console.log('\n─── o painel do dono ───');

const metricas = ler('src/services/adminMetricsService.js');
const soma = corpoDe(metricas, 'async function somaCampo(');
checar('somaCampo existe', true, !!soma);
// O plano B baixava todo pagamento quitado da plataforma para mostrar um número.
checar('somaCampo não cai em getDocs quando a agregação falha', false,
  !!soma && soma.includes('getDocs'));
checar('e devolve null (a tela diz "—")', true, !!soma && soma.includes('return null'));

checar('a lista de motoristas vem do cache compartilhado', true,
  metricas.includes('parceirosDoDono()') && metricas.includes('parceirosDoDono({ forcar })'));
checar('nenhuma cópia própria da consulta de motoristas no painel', false,
  metricas.includes("where('role', '==', 'admin')"));
checar('as avaliações são lidas num lugar só', 1,
  (metricas.match(/collection\(db, 'feedbacks'\)/g) || []).length);
checar('as faturas do console têm janela de meses', true,
  /collection\(db, 'faturasParceiro'\),\s*where\('mes', '>=',/.test(metricas));
checar('a coleção inteira de faturas não é mais lida', false,
  metricas.includes("getDocs(collection(db, 'faturasParceiro'))"));
// O teto vale para quem acabou de escrever também.
const consolePublico = corpoDe(metricas, 'export function carregarConsole(');
checar('carregarConsole repassa `forcar` às peças', true,
  !!consolePublico && consolePublico.includes('buscarConsole({ forcar })'));

const usuarios = ler('src/services/userService.js');
checar('a caixa não lista mais `users` inteira', false,
  usuarios.includes("getDocs(collection(db, 'users'))"));
checar('a busca por uid respeita o teto de 30 do `in`', true,
  usuarios.includes('LOTE_DE_UIDS = 30') && usuarios.includes("where(documentId(), 'in', lote)"));
const aba = ler('src/components/admin/ChamadosTab.jsx');
checar('a aba de chamados pede só quem está na tela', true,
  aba.includes('buscarUsuariosPorUid(') && !aba.includes('listarUsuarios'));

const suporte = ler('src/services/supportService.js');
const caixa = corpoDe(suporte, 'export function watchChamados(');
// `limit` sem ordem devolve os N primeiros por id — e o chamado de hoje podia
// não estar entre eles.
checar('a caixa assina os abertos por status', true,
  !!caixa && caixa.includes("where('status', '==', 'open')"));
checar('e o histórico por data, do mais novo', true,
  !!caixa && caixa.includes("orderBy('createdAt', 'desc')"));
checar('nenhum limit solto sem filtro nem ordem', false,
  !!caixa && caixa.includes('query(col, limit('));

const indicacao = ler('src/services/indicacaoService.js');
const casar = corpoDe(indicacao, 'export async function casarEAtivar(');
checar('casarEAtivar não lê a coleção inteira de indicações', false,
  !!casar && casar.includes('listarTodasIndicacoes'));
const candidatas = corpoDe(indicacao, 'async function candidatasDoIndicado(');
checar('procura pela chave do telefone, com teto', true,
  !!candidatas && candidatas.includes("where('chave', '==', chave)") && candidatas.includes('limit('));
checar('e pela indicação já casada com este indicado', true,
  !!candidatas && candidatas.includes("where('indicadoUid', '==', indicadoUid)"));

const selo = ler('src/services/seloService.js');
const pedidos = corpoDe(selo, 'export function watchPedidosAdesivo(');
checar('a fila de adesivos tem teto', true, !!pedidos && pedidos.includes('limit('));

for (const [arquivo, nome] of [
  ['src/services/indicacaoService.js', 'export function listarTodasIndicacoes('],
  ['src/services/interesseService.js', 'export function listarInteresses('],
  ['src/services/userService.js', 'export function parceirosDoDono('],
]) {
  const corpo = corpoDe(ler(arquivo), nome);
  checar(`${nome.replace('export function ', '').replace('(', '')} passa pelo cache`, true,
    !!corpo && corpo.includes('.obter('));
}

console.log('\n─── o motorista e a família ───');

const agenda = ler('src/services/agendaService.js');
const avisos = corpoDe(agenda, 'export function watchAdminAgenda(');
checar('a agenda do motorista tem teto', true,
  !!avisos && avisos.includes('limit(AVISOS_POR_PAGINA)'));
const maisAvisos = corpoDe(agenda, 'export async function maisAvisosDoMotorista(');
checar('e o resto vem por página, depois do cursor', true,
  !!maisAvisos && maisAvisos.includes('startAfter(cursor)') && maisAvisos.includes('limit('));
checar('a tela oferece os antigos', true,
  ler('src/pages/tio/TioAgenda.jsx').includes('maisAvisosDoMotorista('));

const pagamentos = ler('src/services/paymentsService.js');
const doPai = corpoDe(pagamentos, 'export function watchPaymentsByParent(');
checar('a família assina uma janela de meses', true,
  !!doPai && doPai.includes("where('month', '>=', primeiroMesDoResponsavel())"));
// Dívida não tem idade: a mensalidade antiga em aberto não pode sumir do
// "a pagar" só porque saiu da janela.
checar('mas o que está em aberto vem de qualquer mês', true,
  !!doPai && doPai.includes("where('status', 'in', ['pending', 'claimed'])"));
checar('a história inteira só no extrato, sob demanda', true,
  ler('src/pages/pai/PaiFinanceReport.jsx').includes('usePaymentsByParent(user?.uid, { historico: true })'));
for (const tela of ['src/pages/pai/PaiDashboard.jsx', 'src/pages/pai/PaiFinance.jsx']) {
  checar(`${tela.split('/').pop()} lê a janela, não o histórico`, false,
    ler(tela).includes('historico: true'));
}

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
