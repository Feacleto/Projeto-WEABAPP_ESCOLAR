/**
 * O QUE O BUSCADOR VÊ — e quem ele deve encontrar.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE
 * Medido no Google em 09/09/2026, buscando "alobuzinou":
 *
 *   1º  alobuzinou.com      ← O APP. Uma tela de login.
 *   2º  alobuzinou.com.br   ← a landing, sem título e sem descrição
 *
 * Duas coisas erradas ao mesmo tempo. A landing aparecia com a mensagem
 * *"gostaríamos de exibir a descrição aqui, mas o site não nos permite"* — o
 * texto específico de **robots.txt bloqueado**, herdado de quando o domínio
 * ainda apontava para a hospedagem antiga. E o app, que não tem nada para um
 * buscador, estava se oferecendo: sem `robots.txt` (o rewrite do SPA devolvia
 * o `index.html` naquele caminho), sem `noindex`, e com o MESMO `<title>` da
 * landing — então os dois competiam pela mesma busca e o buscador escolheu a
 * porta trancada.
 *
 * ⚠️ E O EFEITO PIOR NÃO ERA O RANKING. Com o app inteiro rastreável, um link
 * `/convite/{codigo}` postado num grupo de pais pode ser indexado — e esse
 * link é o token que cria conta vinculada a UMA criança.
 *
 * ── A ARMADILHA QUE ESTE ARQUIVO GUARDA
 * O conserto intuitivo é `Disallow: /` no app, e ele é o **contrário** do
 * pretendido: `Disallow` impede a LEITURA, não a indexação. Bloqueado, o
 * buscador não lê a página, não vê o `noindex`, e lista a URL crua — com o
 * código do convite dentro dela. Liberado, ele lê, vê o `noindex` e descarta
 * a URL inteira.
 *
 * O bloco 1 trava as duas metades juntas, porque separadas cada uma parece
 * um erro: "por que o app libera o robots?" e "por que o app tem noindex?".
 *
 * COMO RODAR
 *   node scripts/testar-busca.mjs      (ou: npm run testar:busca)
 */

import { readFileSync } from 'node:fs';
import { DEV_NAME, DEV_CNPJ } from '../src/config/developer.js';
import { COMPANY_INFO } from '../src/pages/legal/legalContent.js';

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
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/**
 * As dimensoes de um PNG, lidas do cabecalho IHDR.
 *
 * Sem dependencia de proposito: o que este teste precisa saber e se a imagem
 * e QUADRADA e do tamanho certo, e isso esta nos primeiros 24 bytes.
 */
function medidaPng(rel) {
  const b = readFileSync(new URL(`../${rel}`, import.meta.url));
  if (!(b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)) return null;
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

const app = ler('index.html');
const robotsApp = ler('public/robots.txt');
const landing = ler('landing/index.html');
const robotsLanding = ler('landing/robots.txt');
const sitemap = ler('landing/sitemap.xml');

/** As linhas de diretiva do robots, sem os comentários que explicam a decisão. */
const diretivas = (txt) =>
  txt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

const tag = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

// ─────────────────────────────────────────────────────────────────────────
bloco('1. O app sai da busca — pelo noindex, nao pelo robots');

checar('o app declara noindex', true,
  /<meta name="robots" content="noindex[^"]*"/.test(app));
checar('e com follow, para o buscador chegar na landing', true,
  /content="noindex,\s*follow"/.test(app));

// ⚠️ ESTE E O CASO QUE PARECE ERRADO E E CERTO. Ver o cabecalho.
checar('o robots.txt do app LIBERA a leitura', true,
  diretivas(robotsApp).includes('Allow: /'));
checar('e nao bloqueia nada', [],
  diretivas(robotsApp).filter((l) => l.toLowerCase().startsWith('disallow')));

// A sonda positiva do descomentador: o comentario do arquivo CITA
// "Disallow: /convite/" para explicar por que ele saiu. Medir o texto cru
// reprovaria a explicacao junto com o defeito.
checar('o descomentador descomenta', true,
  robotsApp.includes('Disallow: /convite/') &&
  !diretivas(robotsApp).some((l) => l.includes('/convite/')));

// Sem este arquivo, `/robots.txt` devolvia o index.html do SPA.
checar('o robots do app nao anuncia sitemap', false,
  diretivas(robotsApp).some((l) => l.toLowerCase().startsWith('sitemap')));

// ─────────────────────────────────────────────────────────────────────────
bloco('2. A landing e quem deve ser encontrada');

checar('ela NAO tem noindex', false, /<meta name="robots"/.test(landing));
checar('o robots dela libera', true, diretivas(robotsLanding).includes('Allow: /'));
checar('e anuncia o sitemap', true,
  diretivas(robotsLanding).some((l) => l.startsWith('Sitemap:')));
checar('o sitemap aponta a home canonica', true,
  sitemap.includes('<loc>https://alobuzinou.com.br/</loc>'));
checar('e a canonica concorda com ele', 'https://alobuzinou.com.br/',
  tag(landing, /<link rel="canonical" href="([^"]+)"/));

// O `lastmod` e o unico sinal do sitemap que o Google leva a serio — e so
// enquanto for verdade. Data no futuro e a forma mais rapida de ele passar a
// ignorar o arquivo, entao o teste mede as duas coisas: formato e sanidade.
const lastmod = tag(sitemap, /<lastmod>([^<]+)<\/lastmod>/);
checar('o sitemap declara lastmod', true, Boolean(lastmod));
checar('no formato AAAA-MM-DD', true, /^\d{4}-\d{2}-\d{2}$/.test(lastmod || ''));
checar('e nao esta no futuro', true,
  Boolean(lastmod) && lastmod <= new Date().toISOString().slice(0, 10));

// ─────────────────────────────────────────────────────────────────────────
bloco('3. Os dois dominios nao competem pela mesma busca');

const tituloApp = tag(app, /<title>([^<]+)<\/title>/);
const tituloLanding = tag(landing, /<title>([^<]+)<\/title>/);

console.log(`       app:     "${tituloApp}"`);
console.log(`       landing: "${tituloLanding}" (${tituloLanding.length} caracteres)`);

checar('os titulos sao DIFERENTES', true, tituloApp !== tituloLanding);
checar('o da landing traz a marca', true, tituloLanding.includes('Alô Buzinou'));
// Marca sozinha so e achavel por quem ja sabe o nome. Quem TEM o problema
// digita a categoria.
checar('e a categoria', true, /transporte escolar/i.test(tituloLanding));
// O Google corta por volta de 60. Titulo cortado perde justamente o fim, que
// e onde a categoria esta.
checar('e cabe no que o Google mostra', true, tituloLanding.length <= 60);

const descLanding = tag(landing, /<meta name="description" content="([^"]+)"/);
checar('a landing tem descricao', true, Boolean(descLanding));
// 155 e nao 160: o Google corta por volta dai, e descricao no limite exato
// sai com "..." no lugar da ultima ideia — que aqui e justamente a frase que
// diferencia o produto ("a plataforma nao entra nela").
checar('e ela cabe com folga no que o Google mostra', true, descLanding.length <= 155);
console.log(`       descricao: ${descLanding.length} caracteres`);

// ─────────────────────────────────────────────────────────────────────────
bloco('4. Dado estruturado: so o que e verdade');

const cru = tag(landing, /application\/ld\+json">([\s\S]*?)<\/script>/);
checar('a landing tem JSON-LD', true, Boolean(cru));

let dados = null;
try {
  dados = JSON.parse(cru);
} catch (e) {
  checar('e ele e JSON valido', true, `erro: ${e.message}`);
}
if (dados) {
  checar('e ele e JSON valido', true, true);
  checar('descreve uma Organization', 'Organization', dados['@type']);

  // ⚠️ A LISTA DO QUE NAO PODE ESTAR AQUI. Nota inventada em dado estruturado
  // e penalidade manual, nao otimizacao — e as tres primeiras ja sao
  // proibidas pela regua da marca, independente de SEO.
  const PROIBIDOS = [
    ['aggregateRating', 'nao existe avaliacao real'],
    ['ratingValue', 'idem'],
    ['reviewCount', 'idem'],
    ['review', 'idem'],
    ['offers', 'preco e conversa com o consultor'],
    ['price', 'idem'],
    ['numberOfEmployees', 'a marca nao publica numero de cliente nem de equipe'],
  ];
  const texto = JSON.stringify(dados);
  for (const [campo, porque] of PROIBIDOS) {
    checar(`nao declara "${campo}" (${porque})`, false, texto.includes(campo));
  }

  // A sonda positiva: sem ela o bloco fica verde no dia em que o JSON-LD
  // deixar de ser encontrado e `texto` virar "{}".
  checar('o detector detecta (sonda positiva)', true,
    JSON.stringify({ ...dados, aggregateRating: {} }).includes('aggregateRating'));

  // ── A DUPLICACAO DECLARADA, E O TESTE QUE A SEGURA ────────────────────
  //
  // A landing e HTML estatico sem build: ela nao alcanca `developer.js`. Os
  // dados legais estao escritos la a mao, de propriedade — e o unico jeito de
  // isso nao virar a quarta versao da identidade da empresa e comparar aqui.
  checar('a razao social bate com developer.js', DEV_NAME, dados.legalName);
  checar('o CNPJ tambem', DEV_CNPJ, dados.taxID);
  checar('e o e-mail bate com o dos documentos legais', COMPANY_INFO.email, dados.email);

  // O canal do Encarregado tem que RECEBER: e por isso que ele e o `.com`.
  checar('o e-mail e do dominio que tem caixa', true,
    dados.email.endsWith('@alobuzinou.com'));
}

// -----------------------------------------------------------------------
bloco('5. O icone e o logo, que sao o que APARECE na busca');

// ⚠️ O GOOGLE EXIGE ICONE QUADRADO COM LADO MULTIPLO DE 48px. As medidas do
// .ico (16, 32, 48) nao bastam na pratica, e era por isso que os dois
// dominios apareciam com um GLOBO GENERICO em 09/09/2026 — nao havia icone
// que ele aceitasse. Nao e escolha estetica: e requisito publicado.
const declaradoPng = tag(
  landing,
  /<link rel="icon" type="image[/]png" sizes="[0-9]+x[0-9]+" href="([^"]+)"/
);
checar('a landing declara um icone PNG para a busca', true, Boolean(declaradoPng));

if (declaradoPng) {
  const ic = medidaPng(`landing${declaradoPng}`);
  checar('e o arquivo existe de verdade', true, Boolean(ic));
  if (ic) {
    console.log(`       icone: ${declaradoPng} = ${ic.largura}x${ic.altura}`);
    checar('o icone e quadrado', true, ic.largura === ic.altura);
    checar('e o lado e multiplo de 48', 0, ic.largura % 48);
  }
}

// ⚠️ ESTE BLOCO GUARDA UM DEFEITO ESCRITO E CORRIGIDO NO MESMO DIA: o `logo`
// do JSON-LD apontava para `og-image.png`, que e o CARTAO de compartilhamento
// — 1200x630, retangular. Logo de organizacao tem que ser quadrado, e o
// cartao social tem campo proprio (`image`). Virou `mark-512.png`, a marca
// sozinha.
if (dados) {
  const caminhoLogo = String(dados.logo || '').replace('https://alobuzinou.com.br', '');
  const lg = medidaPng(`landing${caminhoLogo}`);
  checar('o logo do JSON-LD existe como arquivo', true, Boolean(lg));
  if (lg) {
    console.log(`       logo: ${caminhoLogo} = ${lg.largura}x${lg.altura}`);
    checar('o logo e quadrado', true, lg.largura === lg.altura);
    // O minimo do Google e 112px; 512 da folga para o painel.
    checar('e tem pelo menos 112px de lado', true, lg.largura >= 112);
  }

  // A sonda que guarda o defeito: o cartao social nao pode voltar a ser logo.
  checar('o logo NAO e o cartao social', false, String(dados.logo).includes('og-image'));
  checar('e o cartao social esta no campo dele', true,
    String(dados.image || '').includes('og-image'));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
