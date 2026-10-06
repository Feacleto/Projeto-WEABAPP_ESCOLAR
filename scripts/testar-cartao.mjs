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
  uidDoConheca,
  cartaoDoConheca,
  CAMPOS_DO_CARTAO_DO_TIO,
  FRASE_DO_CARTAO_QUE_NAO_VALE,
  recorteDoCartaoDoTio,
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

console.log('\n\x1b[1m5b. /conheca/<uid>: o cartão para CONHECER o tio (05/10/2026)\x1b[0m');
const motorista = { role: 'admin', marcaNome: 'Tio Nino', marcaCor: '#E07A3F', marcaLogoURL: LOGO, phone: '(11) 99999-8888', name: 'Antonino Silva', city: 'São Paulo', regiao: 'Socorro', cartaoPublico: true, pixKey: 'chave', criancasAtivas: 12, plano: 'mensal' };
eq('o uid do caminho é lido', uidDoConheca('/conheca/UID1'), 'UID1');
eq('com barra no fim também', uidDoConheca('/conheca/UID1/'), 'UID1');
eq('sem uid, nenhum', uidDoConheca('/conheca/'), null);
eq('uid com barra codificada não vira caminho', uidDoConheca('/conheca/a%2F..%2Fb'), null);
eq('outro endereço não é /conheca', uidDoConheca('/familia'), null);
const conheca = cartaoDoConheca('UID1', motorista);
eq('título "Conheça {marca}" — nunca "te convidou para o app"', conheca.titulo, 'Conheça Tio Nino');
eq('descrição com a cidade', conheca.descricao, 'Transporte escolar · São Paulo');
eq('sem cidade, só "Transporte escolar"', cartaoDoConheca('UID1', { ...motorista, city: '' }).descricao, 'Transporte escolar');
eq('a imagem é a MESMA do tio', conheca.imagem, cartaoDoConvite({ uid: 'UID1', marca: 'Tio Nino', cor: '#E07A3F', logoURL: LOGO }).imagem);
eq('o convite continua com o título dele', cartaoDoConvite({ marca: 'Tio Nino' }).titulo, 'Tio Nino te convidou para o app');
eq('uid inválido, o padrão', cartaoDoConheca('a/../b', motorista), PADRAO);
eq('uid que não existe, o padrão', cartaoDoConheca('UID1', null), PADRAO);
eq('família, o padrão', cartaoDoConheca('UID2', { role: 'parent', marcaNome: 'Rita' }), PADRAO);
eq('o dono, o padrão', cartaoDoConheca('UID3', { role: 'owner', marcaNome: 'Dono' }), PADRAO);
eq('motorista sem marca, o padrão', cartaoDoConheca('UID1', { ...motorista, marcaNome: '' }), PADRAO);
eq('motorista suspenso, o padrão', cartaoDoConheca('UID1', { ...motorista, suspenso: true }), PADRAO);
eq('nada além da marca e da cidade: nem nome civil, nem telefone, nem bairro',
  /Antonino|99999|Socorro/.test(JSON.stringify(conheca)), false);
const comOgUrl = trocarTagsDaPrevia(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), conheca, 'https://alobuzinou.com/conheca/UID1');
eq('o og:url é o endereço do /conheca', /property="og:url" content="https:\/\/alobuzinou\.com\/conheca\/UID1"/.test(comOgUrl), true);
const servidorDoCartao = fs.readFileSync(new URL('../functions/lib/cartaoDoLink.js', import.meta.url), 'utf8');
eq('o servidor usa o limite do convite público em /conheca',
  /startsWith\('\/conheca\/'\)[\s\S]*?aindaCabe\(db, REGRAS\.CONVITE_PUBLICO/.test(servidorDoCartao), true);
eq('e lê o doc pelo uid já conferido (uidDoConheca)', servidorDoCartao.includes('uidDoConheca(caminho)'), true);
eq('a /familia não passa mais pela função', /'\/familia'/.test(servidorDoCartao), false);

console.log('\n\x1b[1m5c. a callable pública verCartaoDoTio\x1b[0m');
const recorte = recorteDoCartaoDoTio('UID1', motorista);
eq('com o cartão ligado: só os cinco campos, nessa ordem', Object.keys(recorte), ['marca', 'logoURL', 'cor', 'cidade', 'whatsapp']);
eq('a lista fechada é a decidida', [...CAMPOS_DO_CARTAO_DO_TIO], ['marca', 'logoURL', 'cor', 'cidade', 'whatsapp']);
eq('os valores', recorte, { marca: 'Tio Nino', logoURL: LOGO, cor: '#E07A3F', cidade: 'São Paulo', whatsapp: '11999998888' });
eq('o BAIRRO nunca sai (nem a chave, nem o valor)', /bairro|regiao|Socorro/i.test(JSON.stringify(recorte)), false);
const { cartaoPublico: _semCampo, ...semOptIn } = motorista;
eq('OPT-IN: sem o campo, nada (a callable responde a frase única)', recorteDoCartaoDoTio('UID1', semOptIn), null);
eq('OPT-IN: desligado (false), nada', recorteDoCartaoDoTio('UID1', { ...motorista, cartaoPublico: false }), null);
eq('OPT-IN: sem o campo, o cartão do /conheca é o PADRÃO', cartaoDoConheca('UID1', semOptIn), PADRAO);
eq('OPT-IN: desligado, o cartão do /conheca é o PADRÃO', cartaoDoConheca('UID1', { ...motorista, cartaoPublico: 'sim' }), PADRAO);
eq('o cartão do WhatsApp só leva a cidade, nunca o bairro', /Socorro|bairro|regiao/i.test(JSON.stringify(cartaoDoConheca('UID1', motorista))), false);
eq('nada de PIX, plano, turma ou nome civil', /chave|mensal|Antonino|"12"|:12/.test(JSON.stringify(recorte)), false);
eq('sem telefone, o WhatsApp não vai', recorteDoCartaoDoTio('UID1', { ...motorista, phone: '' }).whatsapp, null);
eq('logo de fora do projeto não vai', recorteDoCartaoDoTio('UID1', { ...motorista, marcaLogoURL: 'https://exemplo.com/a.png' }).logoURL, null);
eq('sem cartão (família, dono, suspenso, sem marca, inválido, inexistente): null', [
  recorteDoCartaoDoTio('UID2', { role: 'parent', marcaNome: 'Rita' }),
  recorteDoCartaoDoTio('UID3', { role: 'owner', marcaNome: 'Dono' }),
  recorteDoCartaoDoTio('UID1', { ...motorista, suspenso: true }),
  recorteDoCartaoDoTio('UID1', { ...motorista, marcaNome: ' ' }),
  recorteDoCartaoDoTio('a/../b', motorista),
  recorteDoCartaoDoTio('UID1', null),
], [null, null, null, null, null, null]);
eq('a frase única', FRASE_DO_CARTAO_QUE_NAO_VALE, 'Este cartão não vale mais.');
const callable = fs.readFileSync(new URL('../functions/lib/cartaoDoTio.js', import.meta.url), 'utf8');
const codigoDaCallable = callable.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
eq('zero escrita (nem set, update, add, delete, nem transação)', /\.(set|update|add|delete|create)\(|runTransaction|batch\(/.test(codigoDaCallable), false);
eq('uma resposta só para toda recusa (a mesma frase, num lugar só)', (codigoDaCallable.match(/FRASE_DO_CARTAO_QUE_NAO_VALE/g) || []).length, 2);
eq('o recorte é o da régua (nunca um spread do doc)', codigoDaCallable.includes('recorteDoCartaoDoTio(uid,') && !/\.\.\.snap\.data|\.\.\.usuario/.test(codigoDaCallable), true);
eq('o uid passa por idValido antes do caminho', codigoDaCallable.indexOf('idValido(uid)') > -1 && codigoDaCallable.indexOf('idValido(uid)') < codigoDaCallable.indexOf('users/${uid}'), true);
eq('com o limite do convite público', codigoDaCallable.includes('aindaCabe(db, REGRAS.CONVITE_PUBLICO'), true);
eq('está exportada', fs.readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8').includes('exports.verCartaoDoTio ='), true);

console.log('\n\x1b[1m6. O hosting manda os quatro endereços para as funções\x1b[0m');
const hosting = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting.find((h) => h.target === 'app');
const fontes = hosting.rewrites.map((r) => r.source);
eq('/convite/** vai para cartaoDoLink', hosting.rewrites.find((r) => r.source === '/convite/**')?.function?.functionId, 'cartaoDoLink');
eq('/quero-fazer-parte vai para cartaoDoLink', hosting.rewrites.find((r) => r.source === '/quero-fazer-parte')?.function?.functionId, 'cartaoDoLink');
eq('/cartao/** vai para imagemDoCartao', hosting.rewrites.find((r) => r.source === '/cartao/**')?.function?.functionId, 'imagemDoCartao');
eq('/conheca/** vai para cartaoDoLink', hosting.rewrites.find((r) => r.source === '/conheca/**')?.function?.functionId, 'cartaoDoLink');
eq('a /familia NÃO passa por função (nenhuma função fria na frente dela)', fontes.includes('/familia'), false);
eq('/conheca nunca é indexada (X-Robots-Tag noindex)',
  /noindex/.test(hosting.headers.find((h) => h.source === '/conheca/**')?.headers?.find((x) => x.key === 'X-Robots-Tag')?.value || ''), true);
eq('e os quatro vêm ANTES do "**" (senão nunca são usados)',
  ['/convite/**', '/quero-fazer-parte', '/conheca/**', '/cartao/**'].every((f) => fontes.indexOf(f) >= 0 && fontes.indexOf('**') > fontes.indexOf(f)), true);

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
