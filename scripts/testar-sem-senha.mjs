/**
 * O QUE RODA SEM A SENHA DO FINANCEIRO NÃO MOSTRA VALOR (04/10/2026, "Rota e
 * Central" aprovada pelo dono; condições da QA à sessão negocio).
 *
 * Na rota, a tela é a Central da AUXILIAR, que usa o celular do motorista e não
 * pode saber quanto cada família paga. Mas é na porta que o dinheiro chega, e
 * ela dá baixa ("Recebi") sem ver valor. Para o Firestore ela e ele são a MESMA
 * conta: o valor chega ao aparelho — é cortina, não cofre, a mesma da senha —
 * e a única proteção é a TELA não imprimi-lo. Este teste trava isso:
 *
 *   1. A LISTA FECHADA dos componentes que rodam sem senha. Nenhum deles
 *      imprime valor: `formatCurrency`, `reais(`, "R$" ou `amount`.
 *      Componente novo na rota entra aqui na mesma alteração.
 *   2. A consulta da rota é ESTREITA: só `status == 'pending'` do próprio
 *      motorista, nada de pago nem de histórico.
 *   3. As duas saídas do "Recebi" gravam a marca `meta.via: 'sem_senha'`, e a
 *      trilha do pagamento mostra ao motorista o que foi feito sem a senha.
 *   4. A régua pura (`dominio/cobranca/semSenha.js`).
 *
 * As rules desta mudança moram em `testar-regras.mjs` (bloco "A ROTA SEM
 * SENHA"), porque precisam do emulador.
 */
import { readFileSync } from 'node:fs';
import { nomeDoMesDaMensalidade, emAbertoPorCrianca } from '../src/dominio/cobranca/semSenha.js';
import { VIA_SEM_SENHA, montarTrilha } from '../src/dominio/cobranca/trilhaDoPagamento.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (passou) ok++;
  else {
    bad++;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
  console.log(`  ${passou ? 'ok' : 'XX'}  ${nome}`);
}
const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

/**
 * Tira os comentários (eles EXPLICAM que não há valor, e citam "R$"): os de
 * bloco, os do JSX e os de linha — sem confundir com o "//" de um endereço.
 */
function semComentarios(fonte) {
  return fonte
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((linha) => linha.replace(/(^|[^:"'`])\/\/.*$/, '$1'))
    .join('\n');
}

/** O que denuncia um valor impresso. */
const IMPRIME_VALOR = [
  ['formatCurrency', /\bformatCurrency\b/],
  ['reais(', /\breais\s*\(/],
  ['"R$"', /R\$/],
  ['amount', /\bamount\b/],
];
function valoresImpressos(fonte) {
  const limpa = semComentarios(fonte);
  return IMPRIME_VALOR.filter(([, re]) => re.test(limpa)).map(([nome]) => nome);
}

console.log('1. os componentes da rota sem senha não imprimem valor');
const SEM_SENHA = [
  'src/components/route/OperacaoDaRota.jsx',
  'src/components/route/MensalidadeNaPorta.jsx',
  'src/components/route/PixDaPerua.jsx',
];
for (const arq of SEM_SENHA) {
  checar(`${arq}: nenhum valor`, [], valoresImpressos(ler(arq)));
}
// Sondas: o detector acusa o que deveria, e o comentário não conta.
checar('sonda: acusa formatCurrency e amount',
  ['formatCurrency', 'amount'], valoresImpressos('<b>{formatCurrency(p.amount)}</b>'));
checar('sonda: acusa "R$" escrito', ['"R$"'], valoresImpressos('<span>R$ 280,00</span>'));
checar('sonda: o comentário não conta',
  [], valoresImpressos('/* nunca o R$ nem o amount */\n{/* formatCurrency */}\n// reais(x)\nconst a = 1;'));

console.log('2. a consulta da rota é estreita');
const svc = semComentarios(ler('src/services/paymentsService.js'));
const fn = svc.slice(svc.indexOf('export function watchMensalidadesEmAberto'));
const corpo = fn.slice(0, fn.indexOf('\nexport ') > 0 ? fn.indexOf('\nexport ') : undefined);
checar('watchMensalidadesEmAberto existe', true, svc.includes('export function watchMensalidadesEmAberto'));
checar('filtra pelo próprio motorista', true, /where\('adminUid', '==', adminUid\)/.test(corpo));
checar('e só o que está em aberto', true, /where\('status', '==', 'pending'\)/.test(corpo));
checar('sem consulta de pago ou de histórico', false, /'paid'|'claimed'|orderBy|limit\(/.test(corpo));
const porta = semComentarios(ler('src/components/route/MensalidadeNaPorta.jsx'));
const naRota = SEM_SENHA.map((a) => semComentarios(ler(a))).join('\n');
checar('a rota não assina a lista completa de mensalidades', false,
  /\bwatchPayments\w*\(|\busePayments\(/.test(naRota));

console.log('3. o "Recebi" sem senha deixa marca, e a trilha a mostra');
checar('a marca é "sem_senha"', 'sem_senha', VIA_SEM_SENHA);
checar('as duas saídas do Recebi gravam a marca', 2,
  (porta.match(/meta:\s*\{\s*via:\s*VIA_SEM_SENHA/g) || []).length);
checar('o PIX não dá baixa: vira "a família disse que mandou"', true,
  porta.includes('anotarPixDaFamilia(') && porta.includes('PAYMENT_EVENTS.CLAIMED'));
const linha = (evento) => montarTrilha({ eventos: [evento] }).find((l) => l.tipo === evento.type || l.rotulo);
const baixa = linha({ type: 'confirmed', actorRole: 'admin', at: new Date('2026-10-04T08:00:00Z'), meta: { via: 'sem_senha' } });
checar('a baixa sem senha aparece como tal na trilha', true, /sem a senha/i.test(baixa?.rotulo || ''));
checar('e vem marcada', true, baixa?.semSenha === true);
const pix = linha({ type: 'claimed', actorRole: 'admin', at: new Date('2026-10-04T08:00:00Z'), meta: { via: 'sem_senha' } });
checar('o PIX anotado na rota aparece como tal', true, /sem a senha/i.test(pix?.rotulo || ''));
const normal = linha({ type: 'confirmed', actorRole: 'admin', at: new Date('2026-10-04T08:00:00Z') });
checar('a baixa normal NÃO diz "sem a senha"', false, /sem a senha/i.test(normal?.rotulo || ''));

console.log('4. a régua');
checar('o mês por extenso', 'outubro', nomeDoMesDaMensalidade('2026-10'));
checar('mês inválido não quebra', 'este mês', nomeDoMesDaMensalidade('outubro'));
const abertas = emAbertoPorCrianca([
  { childId: 'a', status: 'pending', month: '2026-10' },
  { childId: 'a', status: 'pending', month: '2026-09' },
  { childId: 'b', status: 'paid', month: '2026-10' },
  { childId: 'c', status: 'claimed', month: '2026-10' },
]);
checar('por criança, a mais antiga em aberto', '2026-09', abertas.a?.month);
checar('pago e avisado não entram', ['a'], Object.keys(abertas));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
