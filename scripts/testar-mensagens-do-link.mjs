/**
 * Testes das mensagens que o tio manda com um link — Node puro, sem runner.
 * Rodar: node scripts/testar-mensagens-do-link.mjs
 *
 * Protege o texto "Direto" escolhido pelo dono (04/10/2026) e as três regras
 * que vieram com ele: quem fala é a marca do tio, o link fica no fim (é a única
 * ação), e nenhuma das duas mensagens fala em desconto, preço ou dias — o cupom
 * dá ACESSO a quem foi indicado, nunca preço (docs/descontos.md).
 */
import fs from 'node:fs';
import {
  mensagemDeIndicarParceiro,
  linkDaIndicacao,
  mensagemDaIndicacao,
  mensagemDoConvite,
  quemFala,
  mensagemDoCartaoDoTio,
  fraseDoCartaoDoTio,
  botaoDoCartaoDoTio,
  deQuem,
  MENSAGEM_DE_QUEM_VIU_O_CARTAO,
} from '../src/marca/mensagensDoLink.js';
import { podeDizer } from '../src/marca/promessas.js';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};
const URL_CONVITE = 'https://alobuzinou.com/convite/TNAB23CD';
const URL_CADASTRO = 'https://alobuzinou.com/quero-fazer-parte?utm_source=indicacao';

console.log('\n\x1b[1m1. Quem fala\x1b[0m');
eq('Tio ganha "o"', quemFala('Tio Nino'), 'o Tio Nino');
eq('Tia ganha "a"', quemFala('Tia Cida'), 'a Tia Cida');
eq('marca de empresa fica sem artigo', quemFala('Transportes Silva'), 'Transportes Silva');
eq('"Tiotônio" não é Tio', quemFala('Tiotônio Van'), 'Tiotônio Van');
eq('sem marca, nada', quemFala('  '), '');

console.log('\n\x1b[1m2. O convite à família (texto "Direto")\x1b[0m');
eq(
  'o texto escolhido, palavra por palavra',
  mensagemDoConvite({ marca: 'Tio Nino', nomeCrianca: 'Ana Clara', generoCrianca: 'female', url: URL_CONVITE }),
  `Oi! Aqui é o Tio Nino, do transporte da Ana. Os avisos da perua agora vão pelo app. Toque no link para entrar: ${URL_CONVITE}`,
);
eq(
  'menino ganha "do"',
  mensagemDoConvite({ marca: 'Tio Nino', nomeCrianca: 'Pedro', generoCrianca: 'male', url: URL_CONVITE }).includes('do transporte do Pedro.'),
  true,
);
eq(
  'sem marca, fala o transporte',
  mensagemDoConvite({ marca: '', nomeCrianca: 'Pedro', generoCrianca: 'male', url: URL_CONVITE }).startsWith('Oi! Aqui é do transporte escolar do Pedro.'),
  true,
);
eq(
  'sem criança, a frase não quebra',
  mensagemDoConvite({ marca: 'Tio Nino', url: URL_CONVITE }).startsWith('Oi! Aqui é o Tio Nino, do transporte. Os avisos'),
  true,
);
eq('o link é a última coisa', mensagemDoConvite({ marca: 'Tio Nino', nomeCrianca: 'Ana', url: URL_CONVITE }).endsWith(URL_CONVITE), true);

console.log('\n\x1b[1m3. A indicação (texto "Direto")\x1b[0m');
eq(
  'sem cupom, o texto escolhido',
  mensagemDaIndicacao({ marca: 'Tio Nino', url: URL_CADASTRO }),
  `Oi! Aqui é o Tio Nino. Estou usando o Alô Buzinou na minha perua: rota, mensalidade e recado das famílias num lugar só. Crie sua conta aqui: ${URL_CADASTRO}`,
);
const comCupom = mensagemDaIndicacao({ marca: 'Tio Nino', cupom: 'NINO-4821', url: linkDaIndicacao(URL_CADASTRO, 'NINO-4821') });
eq('com cupom, o código aparece', comCupom.includes('Use o cupom NINO-4821'), true);
eq('com cupom, o link continua no fim', comCupom.endsWith('cupom=NINO-4821'), true);
eq('o cupom vai na URL junto do utm', linkDaIndicacao(URL_CADASTRO, 'NINO-4821'), `${URL_CADASTRO}&cupom=NINO-4821`);
eq('sem cupom, a URL não muda', linkDaIndicacao(URL_CADASTRO, null), URL_CADASTRO);
eq('URL sem "?" ganha "?"', linkDaIndicacao('https://x/y', 'AB-1234'), 'https://x/y?cupom=AB-1234');

console.log('\n\x1b[1m4. Nada de preço, desconto ou promessa\x1b[0m');
// O cupom dá ACESSO, nunca preço (a regra do portão), e número na mensagem
// envelhece no WhatsApp por meses.
const todas = [
  mensagemDoConvite({ marca: 'Tio Nino', nomeCrianca: 'Ana', generoCrianca: 'female', url: URL_CONVITE }),
  mensagemDaIndicacao({ marca: 'Tio Nino', url: URL_CADASTRO }),
  comCupom,
];
for (const [i, m] of todas.entries()) {
  const semUrl = m.replace(/https?:\S+/g, '');
  eq(`mensagem ${i + 1} sem "desconto"`, /descont/i.test(semUrl), false);
  eq(`mensagem ${i + 1} sem número de dias ou reais`, /\d/.test(semUrl.replace(/NINO-\d+/, '')), false);
  eq(`mensagem ${i + 1} não promete segurança`, podeDizer(semUrl), true);
}

console.log('\n\x1b[1m5. As duas telas usam estas mensagens\x1b[0m');
// Sonda por leitura de arquivo: as telas importam React, o Node não as carrega.
const convite = fs.readFileSync(new URL('../src/components/children/InviteShare.jsx', import.meta.url), 'utf8');
const indicar = fs.readFileSync(new URL('../src/pages/tio/TioIndicar.jsx', import.meta.url), 'utf8');
eq('InviteShare chama mensagemDoConvite', convite.includes('mensagemDoConvite('), true);
eq('TioIndicar chama mensagemDaIndicacao', indicar.includes('mensagemDaIndicacao('), true);
eq('TioIndicar não põe mais os dias de teste na mensagem', indicar.includes('DIAS_DE_TRIAL'), false);

console.log('\n\x1b[1m6. Indicar um parceiro para uma família (etapa 2)\x1b[0m');
const indicando = mensagemDeIndicarParceiro({ marca: 'Tio Nino', parceiro: { marca: 'Zé da Van', lugar: 'Zona Sul', whatsapp: '5511987654321' } });
eq('o texto, com o WhatsApp formatado', indicando, 'Oi! Aqui é o Tio Nino. Quero te indicar Zé da Van (Zona Sul), que também usa o Alô Buzinou. O WhatsApp é (11) 98765-4321. Se chamar, diz que fui eu que indiquei.');
eq('parceiro "Tio" ganha o artigo', mensagemDeIndicarParceiro({ marca: 'Tia Cida', parceiro: { marca: 'Tio Zé' } }).includes('indicar o Tio Zé, que'), true);
eq('sem WhatsApp, a frase não quebra', mensagemDeIndicarParceiro({ marca: 'Tio Nino', parceiro: { marca: 'Zé' } }).includes('WhatsApp'), false);
eq('não promete nada sobre o colega', podeDizer(indicando), true);

console.log('\n\x1b[1m7. O cartão do tio para uma família NOVA (05/10/2026)\x1b[0m');
const URL_CONHECA = 'https://alobuzinou.com/conheca/UID1';
eq('o texto aprovado pelo dono', mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: URL_CONHECA }),
  `Oi! Aqui é o Tio Nino, transporte escolar. Na minha perua os avisos para as famílias vão pelo app Alô Buzinou. Quer conversar sobre vaga? É só me responder aqui. ${URL_CONHECA}`);
eq('tia: "a Tia Rosa"', mensagemDoCartaoDoTio({ marca: 'Tia Rosa', url: URL_CONHECA }).startsWith('Oi! Aqui é a Tia Rosa, transporte escolar.'), true);
eq('sem marca, "do transporte escolar"', mensagemDoCartaoDoTio({ marca: '', url: URL_CONHECA }).startsWith('Oi! Aqui é do transporte escolar. Na minha perua'), true);
eq('nunca "entrar"', /entrar|entre\b/i.test(mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: URL_CONHECA })), false);
eq('o link no fim', mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: URL_CONHECA }).endsWith(URL_CONHECA), true);
eq('sem número e sem promessa', [/\d/.test(mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: '' })), podeDizer(mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: '' }))], [false, true]);
eq('"de quem" segue o artigo', [deQuem('Tio Nino'), deQuem('Tia Rosa'), deQuem('Transportes Silva')], ['do Tio Nino', 'da Tia Rosa', 'de Transportes Silva']);
eq('a frase da página', fraseDoCartaoDoTio('Tia Rosa'), 'Na perua da Tia Rosa, os avisos vão pelo app Alô Buzinou: quando a perua sai, quando está chegando e quando a criança chega.');
eq('o botão', botaoDoCartaoDoTio('Tia Rosa'), 'Falar com a Tia Rosa no WhatsApp');
eq('a mensagem de quem viu o cartão', MENSAGEM_DE_QUEM_VIU_O_CARTAO, 'Oi! Vi o seu cartão e quero conversar sobre vaga na perua.');
eq('a frase e a mensagem não prometem segurança', podeDizer(fraseDoCartaoDoTio('Tio Nino')) && podeDizer(MENSAGEM_DE_QUEM_VIU_O_CARTAO), true);

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
