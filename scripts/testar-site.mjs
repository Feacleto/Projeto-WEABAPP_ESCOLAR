/**
 * O SITE (alobuzinou.com.br) — páginas próprias, e o site antigo fora do ar.
 *
 * Em 02/10/2026 o site antigo (/saiba-mais, uma página comprida) virou sete
 * páginas próprias, e a HOME NÃO MUDOU — só o destino dos links. Este teste
 * trava as partes que se desfazem sem ninguém ver:
 *
 *   - cada página tem Voltar e Entrar no app, e usa o molde comum;
 *   - nenhum link do site volta a apontar para /saiba-mais, e o endereço
 *     antigo é um 301 para a home (quem tinha o link salvo não vê erro);
 *   - o formulário do investidor fala com o próprio site, e a CSP continua
 *     fechada (`connect-src 'self'`);
 *   - nada de emoji (decisão do dono: ícone desenhado, nunca emoji);
 *   - a régua do contato do investidor.
 *
 * COMO RODAR
 *   node scripts/testar-site.mjs      (ou: npm run testar:site)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { lerLead } = require('../functions/lib/reguaDoLead.js');

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
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const raiz = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, raiz), 'utf8').split('\r').join('');

const PAGINAS = ['como-funciona', 'motorista', 'familia', 'sobre', 'duvidas', 'contato', 'investidores'];

bloco('1 · CADA PÁGINA PRÓPRIA TEM VOLTAR E ENTRAR NO APP');
checar('são sete páginas', 7, PAGINAS.filter((p) => existsSync(new URL(`landing/${p}.html`, raiz))).length);
for (const p of PAGINAS) {
  const h = ler(`landing/${p}.html`);
  checar(`${p}: tem o Voltar`, true, /data-voltar[^>]*>[\s\S]*?Voltar<\/a>/.test(h));
  checar(`${p}: tem o Entrar no app`, true, h.includes('href="https://alobuzinou.com/login">Entrar no app</a>'));
  checar(`${p}: usa o molde comum`, true, h.includes('/paginas.css') && h.includes('/paginas.js'));
  checar(`${p}: canonical aponta para ela mesma`, true, h.includes(`rel="canonical" href="https://alobuzinou.com.br/${p}"`));
}

bloco('2 · O SITE ANTIGO SAIU DO AR SEM QUEBRAR LINK');
checar('o arquivo antigo não está mais na pasta publicada', false, existsSync(new URL('landing/saiba-mais.html', raiz)));
checar('mas está guardado em docs/arquivo', true, existsSync(new URL('docs/arquivo/site-completo-2026-09.html', raiz)));
const htmlsDoSite = readdirSync(new URL('landing/', raiz)).filter((f) => f.endsWith('.html'));
checar('nenhuma página do site linka /saiba-mais', [],
  htmlsDoSite.filter((f) => /href="[^"]*saiba-mais/.test(ler(`landing/${f}`))));
const fb = JSON.parse(ler('firebase.json'));
const landing = fb.hosting.find((h) => h.target === 'landing');
checar('/saiba-mais vira 301 para a home',
  true, (landing.redirects || []).some((r) => r.source === '/saiba-mais' && r.destination === '/' && r.type === 301));
const sitemap = ler('landing/sitemap.xml');
checar('o sitemap não lista mais /saiba-mais', false, /<loc>[^<]*saiba-mais/.test(sitemap));
checar('e lista as sete páginas', PAGINAS, PAGINAS.filter((p) => sitemap.includes(`https://alobuzinou.com.br/${p}<`)));

bloco('3 · A HOME NÃO MUDOU — SÓ O DESTINO DOS LINKS');
const home = ler('landing/index.html');
for (const [rotulo, dest] of [['Como funciona', '/como-funciona'], ['Pra família', '/familia'], ['Sobre nós', '/sobre'], ['Dúvidas', '/duvidas'], ['Contato', '/contato'], ['Investidores', '/investidores']]) {
  // Os links viraram quadrados com ícone (04/10/2026): confere o destino e o
  // rótulo DENTRO do mesmo link, não o formato antigo `<a>Rótulo</a>`.
  checar(`"${rotulo}" abre ${dest}`, true,
    new RegExp(`href="${dest}"[^>]*>(?:(?!</a>)[\\s\\S])*<b>${rotulo}</b>`).test(home));
}

bloco('4 · O FORMULÁRIO DO INVESTIDOR FALA COM O PRÓPRIO SITE');
checar('o hosting repassa /api/interesse-investidor para a function', true,
  (landing.rewrites || []).some((r) => r.source === '/api/interesse-investidor' && r.function?.functionId === 'registrarInteresseInvestidor'));
checar('e a function existe no index', true, ler('functions/index.js').includes('exports.registrarInteresseInvestidor ='));
checar('o formulário chama o caminho do próprio site', true, ler('landing/paginas.js').includes("fetch('/api/interesse-investidor'"));
const csp = JSON.stringify(landing.headers || []);
checar("a CSP continua só com connect-src 'self'", true, /connect-src 'self';/.test(csp));
checar('a página tem o campo-isca escondido', true, ler('landing/investidores.html').includes('class="isca"'));

bloco('5 · SEM EMOJI NO SITE');
// O que conta é o que o VISITANTE vê: comentário de código fica de fora (o
// projeto marca decisões com o sinal de atenção, e isso não chega à tela).
// Pictograma pelo Unicode, menos ©, ® e ™, símbolos tipográficos do rodapé.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|&#1[23]\d{4};/u;
const semComentario = (t) =>
  t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const arquivos = [...htmlsDoSite.map((f) => `landing/${f}`), 'landing/paginas.css', 'landing/paginas.js'];
checar('nenhum arquivo do site mostra emoji', [], arquivos.filter((f) => EMOJI.test(semComentario(ler(f)))));
checar('o © do rodapé não conta como emoji', false, EMOJI.test('© 2026 Alô Buzinou'));
checar('o detector pega emoji (sonda positiva)', true, EMOJI.test('Chamar no WhatsApp \u{1F4AC}'));
checar('e pega a entidade HTML de emoji (sonda positiva)', true, EMOJI.test('&#128172; Chamar'));

bloco('6 · O CONTATO DO INVESTIDOR');
checar('contato válido passa', { ok: true, lead: { nome: 'Ana Souza', email: 'ana@exemplo.com', whatsapp: '11987654321' } },
  lerLead({ nome: '  Ana   Souza ', email: 'ANA@exemplo.com', whatsapp: '(11) 98765-4321' }));
checar('WhatsApp é opcional', true, lerLead({ nome: 'Ana', email: 'a@b.co' }).ok);
checar('sem nome, não grava', { ok: false, erro: 'nome' }, lerLead({ nome: 'A', email: 'a@b.co' }));
checar('e-mail errado, não grava', { ok: false, erro: 'email' }, lerLead({ nome: 'Ana', email: 'ana@' }));
checar('robô preencheu a isca: responde ok e NÃO grava', { ok: true, isca: true }, lerLead({ nome: 'Ana', email: 'a@b.co', site: 'http://spam' }));
checar('texto gigante é cortado', 80, lerLead({ nome: 'x'.repeat(500), email: 'a@b.co' }).lead.nome.length);
checar('corpo vazio não quebra', false, lerLead(undefined).ok);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
