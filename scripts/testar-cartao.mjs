/**
 * O cartão do link no WhatsApp — Node puro, sem runner.
 * Rodar: node scripts/testar-cartao.mjs
 *
 * Protege as três coisas que não podem quebrar calado (functions/lib/reguaDoCartao.js):
 * o cartão do tio e o do app dizem o texto "Direto" aprovado pelo dono; nada
 * da criança entra no cartão; e a troca das tags funciona no index.html DE
 * VERDADE — se alguém reformatar as tags de prévia, o cartão volta a ser o
 * padrão para todo mundo sem nenhum erro aparecer.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PADRAO,
  IMAGEM_PADRAO,
  logoConfiavel,
  cartaoDoConvite,
  cartaoDaIndicacao,
  trocarTagsDaPrevia,
} = require('../functions/lib/reguaDoCartao.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};
const LOGO = 'https://firebasestorage.googleapis.com/v0/b/alobuzinou-be81f.firebasestorage.app/o/marcaLogos%2Fabc?alt=media&token=x';

console.log('\n\x1b[1m1. O cartão do tio (convite à família)\x1b[0m');
eq('título com a marca', cartaoDoConvite({ marca: 'Tio Nino' }).titulo, 'Tio Nino te convidou para o app');
eq('linha aprovada', cartaoDoConvite({ marca: 'Tio Nino' }).descricao, 'A perua, os avisos e a mensalidade no seu celular.');
eq('sem marca, o cartão padrão', cartaoDoConvite({ marca: '' }), PADRAO);
eq('com o uid, a imagem é a GRANDE do tio', /^https:\/\/alobuzinou\.com\/cartao\/tio\/UID1\.png\?v=[0-9a-z]+$/.test(cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', logoURL: LOGO }).imagem), true);
eq('e ela é grande (1200x630)', cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', logoURL: LOGO }).imagemGrande, true);
eq('sem uid, a imagem padrão', cartaoDoConvite({ marca: 'Tio Nino', logoURL: LOGO }).imagem, IMAGEM_PADRAO);
eq('uid com barra não vira endereço', cartaoDoConvite({ uid: 'a/../b', marca: 'Tio Nino' }).imagem, IMAGEM_PADRAO);
eq('trocar o logo troca o endereço (o WhatsApp busca de novo)',
  cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', logoURL: LOGO }).imagem !== cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', logoURL: LOGO + '2' }).imagem, true);
eq('logo de fora do Storage nem entra na versão',
  cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', logoURL: 'https://exemplo.com/a.png' }).imagem, cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino' }).imagem);
eq('marca comprida é cortada', cartaoDoConvite({ marca: 'x'.repeat(80) }).titulo.length <= 40 + ' te convidou para o app'.length, true);

console.log('\n\x1b[1m2. O cartão do app (indicação)\x1b[0m');
eq('título com quem indicou', cartaoDaIndicacao({ marca: 'Tio Nino' }).titulo, 'Tio Nino te indicou o Alô Buzinou');
eq('linha aprovada', cartaoDaIndicacao({ marca: 'Tio Nino' }).descricao, 'O app do transporte escolar. Crie sua conta de motorista.');
eq('sem cupom, o cartão do app sem "indicado por"', cartaoDaIndicacao().titulo, 'Crie sua conta de motorista no Alô Buzinou');
eq('sem cupom, a imagem padrão', cartaoDaIndicacao().imagem, IMAGEM_PADRAO);
eq('com quem indicou, a imagem grande do app com a fita', /\/cartao\/app\/UID2\.png\?v=/.test(cartaoDaIndicacao({ uid: 'UID2', marca: 'Tio Nino' }).imagem), true);

console.log('\n\x1b[1m3. Só logo do próprio projeto\x1b[0m');
eq('logo do Storage, em marcaLogos/', logoConfiavel(LOGO), true);
eq('imagem de outro site, não', logoConfiavel('https://exemplo.com/logo.png'), false);
eq('outra pasta do Storage (foto de criança), não',
  logoConfiavel('https://firebasestorage.googleapis.com/v0/b/x/o/childPhotos%2Fabc?alt=media'), false);

console.log('\n\x1b[1m4. Nada da criança, nada de promessa\x1b[0m');
const textos = [cartaoDoConvite({ marca: 'Tio Nino' }), cartaoDaIndicacao({ marca: 'Tio Nino' }), cartaoDaIndicacao()]
  .map((c) => `${c.titulo} ${c.descricao}`).join(' ');
eq('nenhum "seguro/segurança"', /segur/i.test(textos), false);
eq('nenhum "desconto"', /descont/i.test(textos), false);
const fonte = fs.readFileSync(new URL('../functions/lib/cartaoDoLink.js', import.meta.url), 'utf8');
eq('o servidor não lê o nome da criança para o cartão', /crianca\.name|child\.name|childFirstName/.test(fonte), false);

console.log('\n\x1b[1m5. A troca funciona no index.html de verdade\x1b[0m');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cartao = cartaoDoConvite({ uid: 'UID1', marca: 'Tio "Nino" <b>', logoURL: LOGO });
const trocado = trocarTagsDaPrevia(index, cartao, 'https://alobuzinou.com/convite/ABC');
eq('og:title trocado (e escapado)', trocado.includes('<meta property="og:title" content="Tio &quot;Nino&quot; &lt;b&gt; te convidou para o app" />'), true);
eq('og:description trocada', trocado.includes('content="A perua, os avisos e a mensalidade no seu celular."'), true);
eq('og:image é a imagem grande', trocado.includes(`property="og:image" content="${cartao.imagem}"`), true);
eq('og:url é o do convite', trocado.includes('property="og:url" content="https://alobuzinou.com/convite/ABC"'), true);
eq('a imagem grande mantém as dimensões de 1200x630', trocado.includes('og:image:width'), true);
eq('o texto alternativo da imagem é o do cartão', trocado.includes('property="og:image:alt" content="Tio &quot;Nino&quot; &lt;b&gt; te convidou para o app"'), true);
eq('e o cartão grande do Twitter', /name="twitter:card"\s+content="summary_large_image"/.test(trocado), true);
const pequeno = trocarTagsDaPrevia(index, { ...cartao, imagemGrande: false }, 'https://alobuzinou.com/convite/ABC');
eq('imagem pequena (o ramo que sobrou) tira as dimensões', pequeno.includes('og:image:width'), false);
eq('o resto da página continua (o app carrega)', trocado.includes('<div id="root">') && trocado.length > index.length * 0.9, true);
const padrao = trocarTagsDaPrevia(index, PADRAO, 'https://alobuzinou.com/convite/ABC');
eq('cartão padrão mantém as dimensões da imagem', padrao.includes('og:image:width'), true);

console.log('\n\x1b[1m6. O hosting manda os três endereços para as funções\x1b[0m');
const hosting = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting.find((h) => h.target === 'app');
const fontes = hosting.rewrites.map((r) => r.source);
eq('/convite/** vai para cartaoDoLink', hosting.rewrites.find((r) => r.source === '/convite/**')?.function?.functionId, 'cartaoDoLink');
eq('/quero-fazer-parte vai para cartaoDoLink', hosting.rewrites.find((r) => r.source === '/quero-fazer-parte')?.function?.functionId, 'cartaoDoLink');
eq('/cartao/** vai para imagemDoCartao', hosting.rewrites.find((r) => r.source === '/cartao/**')?.function?.functionId, 'imagemDoCartao');
eq('e os três vêm ANTES do "**" (senão nunca são usados)',
  ['/convite/**', '/quero-fazer-parte', '/cartao/**'].every((f) => fontes.indexOf(f) >= 0 && fontes.indexOf('**') > fontes.indexOf(f)), true);

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
