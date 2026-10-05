/**
 * A imagem grande do cartão do link — Node puro, sem runner.
 * Rodar: node scripts/testar-imagem-do-cartao.mjs
 *
 * Protege o desenho do PNG que vai na prévia do WhatsApp
 * (functions/lib/reguaDaImagemDoCartao.js), sem desenhar PNG nenhum: o resvg
 * mora em functions/node_modules, que o CI não instala — e `testar:imports`
 * reprovaria. O que se trava aqui é o SVG:
 *
 * - nada da criança entra, mesmo que alguém passe;
 * - o texto é escapado (nome de marca é texto livre, e SVG é XML);
 * - cor inválida ou sem cor cai no verde da casa;
 * - a letra lê sobre a cor (4,5:1), e a cor é a MESMA conta do app — o
 *   espelho de `paletaDaMarca` é comparado caso a caso;
 * - o nome longo cabe (medido pela tabela de larguras da fonte);
 * - a versão do endereço muda com marca, cor e logo;
 * - e a função do servidor não lê `children`.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { paletaDaMarca } from '../src/marca/corDaMarca.js';

const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDaImagemDoCartao.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};
const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
const textosDo = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

console.log('\n\x1b[1m1. Os dois desenhos\x1b[0m');
const tio = R.svgDoCartao({ tipo: 'tio', marca: 'Tio Nino', cor: '#D9622B', logo: LOGO });
const app = R.svgDoCartao({ tipo: 'app', marca: 'Tio Nino', cor: '#D9622B' });
eq('o do tio é 1200x630', /^<svg[^>]*width="1200" height="630"/.test(tio), true);
eq('o do tio diz o nome e "te convidou para o app"', textosDo(tio).includes('Tio Nino') && textosDo(tio).includes('te convidou para o app'), true);
eq('e assina "pelo Alô Buzinou"', textosDo(tio).includes('pelo Alô Buzinou'), true);
eq('com logo, o logo vai no círculo (e as iniciais não)', tio.includes(`href="${LOGO}"`) && !textosDo(tio).includes('TN'), true);
const tioSemLogo = R.svgDoCartao({ tipo: 'tio', marca: 'Tio Nino', cor: '#D9622B' });
eq('sem logo, as iniciais', textosDo(tioSemLogo).includes('TN') && !tioSemLogo.includes('<image'), true);
eq('o do app diz "Alô Buzinou" e "O app do transporte escolar"', textosDo(app).includes('Alô Buzinou') && textosDo(app).includes('O app do transporte escolar'), true);
eq('com a fita "Indicado por" e quem mandou', textosDo(app).includes('Indicado por') && textosDo(app).includes('Tio Nino'), true);
eq('o do app tem o fundo verde da casa', app.includes(`<rect width="1200" height="630" fill="${R.VERDE}"/>`), true);
eq('sem marca, nenhuma imagem (fica a padrão)', R.svgDoCartao({ tipo: 'tio', marca: '  ' }), null);
eq('tipo desconhecido, nenhuma imagem', R.svgDoCartao({ tipo: 'crianca', marca: 'Tio Nino' }), null);
eq('as duas fontes da marca, e só elas',
  [...new Set([...tio.matchAll(/font-family="([^"]+)"/g), ...app.matchAll(/font-family="([^"]+)"/g)].map((m) => m[1]))].sort(),
  ['Bricolage Grotesque', 'Instrument Sans']);
const fontes = fs.readdirSync(new URL('../functions/fontes/', import.meta.url));
eq('os arquivos das fontes vão junto no deploy (com a licença OFL)',
  ['BricolageGrotesque-ExtraBold.ttf', 'InstrumentSans-Bold.ttf', 'OFL-BricolageGrotesque.txt', 'OFL-InstrumentSans.txt'].every((f) => fontes.includes(f)), true);

console.log('\n\x1b[1m2. Nada da criança\x1b[0m');
const comCrianca = R.svgDoCartao({
  tipo: 'tio', marca: 'Tio Nino', cor: '#D9622B',
  name: 'Ana Clara', childName: 'Ana Clara', escola: 'Escola Sol', address: 'Rua das Flores, 100',
});
eq('campos a mais não entram no desenho', /Ana Clara|Escola Sol|Rua das Flores/.test(comCrianca), false);
const servidor = fs.readFileSync(new URL('../functions/lib/imagemDoCartao.js', import.meta.url), 'utf8');
eq('a função da imagem não lê children', /children|childIds|crianca/.test(servidor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), false);
eq('ela só desenha conta de motorista', /u\.role !== 'admin'/.test(servidor), true);
eq('e confere o uid antes de virar caminho', /idValido\(pedido\.uid\)/.test(servidor), true);
eq('sem fonte do sistema', /loadSystemFonts:\s*false/.test(servidor), true);

console.log('\n\x1b[1m3. Texto escapado (SVG é XML)\x1b[0m');
const xss = R.svgDoCartao({ tipo: 'tio', marca: 'Tio <script>alert(1)</script> & "Cia"', cor: '#1D4ED8' });
eq('nenhuma tag nova entra pelo nome', /<script/i.test(xss), false);
eq('o & vira &amp; e as aspas viram &quot;', xss.includes('&amp;') && xss.includes('&quot;Cia&quot;'), true);
const xssApp = R.svgDoCartao({ tipo: 'app', marca: '"/><image href="https://mal.com/x.png', cor: '#1D4ED8' });
eq('nem pela fita do app', /<image/.test(xssApp), false);
eq('logo que não é imagem embutida não entra', R.svgDoCartao({ tipo: 'tio', marca: 'Tio Nino', logo: 'https://mal.com/x.png' }).includes('<image'), false);
eq('nem data: de SVG (que carregaria script)', R.logoEmbutido('data:image/svg+xml;base64,PHN2Zz4='), null);
eq('emoji sai do nome (a fonte não tem, e sairia como quadrado)', R.nomeDesenhavel('Van do Zé \u{1F690}'), 'Van do Zé');

console.log('\n\x1b[1m4. A cor\x1b[0m');
for (const cor of [null, '', 'xyz', '#12345', 'red', '#808080', '#111111', '#FAFAFA']) {
  eq(`"${cor}" cai no verde da casa`, R.corViva(cor).marca, R.VERDE);
}
eq('no verde, a letra é branca', R.corViva('xyz').naMarca, '#FFFFFF');
eq('o fundo do tio sem cor é o verde', R.svgDoCartao({ tipo: 'tio', marca: 'Tio Nino', cor: 'xyz' }).includes(`fill="${R.VERDE}"/>`), true);

// O espelho: varre o círculo de cores e compara com a cor viva do app.
let iguais = 0, diferentes = [];
let legiveis = 0, ilegiveis = [];
for (let h = 0; h < 360; h += 12) {
  for (const s of [0.3, 0.6, 0.9]) {
    for (const l of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      const hex = '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
      const servidor = R.corViva(hex);
      const doApp = paletaDaMarca(hex);
      const esperado = doApp ? { marca: doApp.marca, naMarca: doApp.naMarca } : { marca: R.VERDE, naMarca: '#FFFFFF' };
      if (servidor.marca === esperado.marca && servidor.naMarca === esperado.naMarca) iguais++;
      else diferentes.push(hex);
      // A letra do nome e a da frase leem sobre o fundo.
      const fundo = R.hexParaRgb(servidor.marca);
      const suave = R.hexParaRgb(R.tintaSuave(servidor.marca, servidor.naMarca));
      if (R.contraste(R.hexParaRgb(servidor.naMarca), fundo) >= 4.5 && R.contraste(suave, fundo) >= 4.5) legiveis++;
      else ilegiveis.push(hex);
    }
  }
}
eq(`a cor viva do servidor é a do app (${iguais} cores comparadas)`, diferentes, []);
eq(`o nome e a frase leem a 4,5:1 em todas (${legiveis})`, ilegiveis, []);
eq('a frase é um tom mais suave que o nome, não a mesma letra', R.tintaSuave('#1D4ED8', '#FFFFFF') !== '#FFFFFF', true);

console.log('\n\x1b[1m5. O nome cabe\x1b[0m');
const LARGURA_DO_NOME = 1200 - 460 - 50;
const curto = R.encaixarNome('Tio Nino', LARGURA_DO_NOME, { maior: 120, menor: 80, maiorEmDuas: 92, menorEmDuas: 60 });
eq('nome curto: uma linha no corpo maior', curto, { linhas: ['Tio Nino'], corpo: 120 });
const longo = R.encaixarNome(R.nomeDesenhavel('Transportes Escolares Irmãos Albuquerque'), LARGURA_DO_NOME, { maior: 120, menor: 80, maiorEmDuas: 92, menorEmDuas: 60 });
eq('nome longo: duas linhas', longo.linhas.length, 2);
eq('e cada linha cabe na largura', longo.linhas.every((l) => R.larguraDoTexto(l, longo.corpo) <= LARGURA_DO_NOME), true);
const semEspaco = R.encaixarNome('X'.repeat(40), LARGURA_DO_NOME, { maior: 120, menor: 80, maiorEmDuas: 92, menorEmDuas: 60 });
eq('uma palavra enorme é cortada com "…"', semEspaco.linhas.length === 1 && semEspaco.linhas[0].endsWith('…'), true);
eq('e cabe', R.larguraDoTexto(semEspaco.linhas[0], semEspaco.corpo) <= LARGURA_DO_NOME, true);
eq('o nome passa de 40 letras: cortado', Array.from(R.nomeDesenhavel('a'.repeat(80))).length, 40);
const fitaLonga = R.svgDoCartao({ tipo: 'app', marca: 'W'.repeat(40) });
const naFita = textosDo(fitaLonga).at(-1);
const corpoDaFita = Number(/font-size="(\d+)">[^<]*<\/text><\/svg>$/.exec(fitaLonga)[1]);
eq('na fita do app, o nome comprido também cabe', R.larguraDoTexto(naFita, corpoDaFita) <= 1200 - 220 - 50, true);
eq('a frase do tio cabe ao lado do círculo', R.larguraDoTexto('te convidou para o app', 50, R.LETRAS_DO_TEXTO) <= LARGURA_DO_NOME, true);
eq('as iniciais: "Tio Nino" → "TN"', R.iniciais('Tio Nino'), 'TN');
eq('acento e pontuação: "érica, vans" → "EV"', R.iniciais('érica, vans'), 'ÉV');

console.log('\n\x1b[1m6. O endereço e a versão\x1b[0m');
const base = { marca: 'Tio Nino', cor: '#D9622B', logoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/marcaLogos%2Fu?alt=media&token=1' };
const v = R.versaoDaImagem(base);
eq('a versão é curta e só tem letra e número', /^[0-9a-z]{1,8}$/.test(v), true);
eq('é a mesma para os mesmos dados', R.versaoDaImagem({ ...base }), v);
eq('muda com a marca', R.versaoDaImagem({ ...base, marca: 'Tio Nina' }) !== v, true);
eq('muda com a cor', R.versaoDaImagem({ ...base, cor: '#1D4ED8' }) !== v, true);
eq('muda com o logo', R.versaoDaImagem({ ...base, logoURL: base.logoURL + 'x' }) !== v, true);
eq('o endereço', R.urlDaImagem('tio', 'UID1', base), `https://alobuzinou.com/cartao/tio/UID1.png?v=${v}`);
eq('lê o caminho do tio', R.lerCaminho('/cartao/tio/UID1.png'), { tipo: 'tio', uid: 'UID1' });
eq('lê o caminho do app', R.lerCaminho('/cartao/app/UID1.png'), { tipo: 'app', uid: 'UID1' });
eq('outro tipo, não', R.lerCaminho('/cartao/crianca/UID1.png'), null);
eq('caminho com barra a mais, não', R.lerCaminho('/cartao/tio/a/b.png'), null);

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
