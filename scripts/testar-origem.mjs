/**
 * DE ONDE A PESSOA VEIO — a atribuição de canal resolvida da URL.
 *
 * POR QUE ESTE TESTE EXISTE
 * O dado de atribuição só serve somado ao longo de meses, e é aí que o erro
 * aparece tarde demais: uma abreviação não reconhecida não quebra tela nenhuma
 * — ela vira uma categoria a mais na tabela, silenciosamente, e no fim do
 * trimestre o Instagram aparece dividido em `ig`, `insta` e `instagram-bio`,
 * cada um parecendo pequeno.
 *
 * Os três casos que o teste protege:
 *
 *   APELIDO: quem monta o link do post escreve `ig` ou `zap`, no celular, com
 *   pressa. Cada variação precisa cair no mesmo canal.
 *
 *   ENCURTADOR DO PRÓPRIO APP: link clicado dentro do Instagram chega como
 *   `l.instagram.com`, e do Facebook como `lm.facebook.com`. Comparar com
 *   "instagram.com" perde todos eles.
 *
 *   NAVEGAÇÃO INTERNA: o referrer da própria casa não é aquisição. Contá-la
 *   faria cada clique dentro do site parecer um canal.
 *
 * COMO RODAR
 *   node scripts/testar-origem.mjs      (ou: npm run testar:origem)
 */

import {
  CANAIS,
  canalDeReferrer,
  canalDeUtm,
  canalValido,
  contarPorCanal,
  resolverOrigem,
  rotuloDoCanal,
} from '../src/dominio/identidade/origem.js';

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

// ═════════════════ 1. A LISTA FECHADA ══════════════════════════════════════

bloco('1. A lista de canais');

checar('todo canal tem id e rótulo', true, CANAIS.every((c) => !!c.id && !!c.rotulo));
checar('nenhum id repetido', CANAIS.length, new Set(CANAIS.map((c) => c.id)).size);
checar('"direto" existe — é a ausência de origem', true, canalValido('direto'));
checar('id inventado não é válido', false, canalValido('mercado-livre'));
checar('rótulo de canal conhecido', 'Instagram', rotuloDoCanal('instagram'));
checar('rótulo de desconhecido devolve o próprio', 'xpto', rotuloDoCanal('xpto'));

// ═════════════════ 2. OS APELIDOS DA UTM ═══════════════════════════════════

bloco('2. Os apelidos que uma pessoa digita com pressa');

checar('instagram', 'instagram', canalDeUtm('instagram'));
checar('ig', 'instagram', canalDeUtm('ig'));
checar('insta', 'instagram', canalDeUtm('insta'));
checar('INSTAGRAM em maiúscula', 'instagram', canalDeUtm('INSTAGRAM'));
checar('com espaço em volta', 'instagram', canalDeUtm('  instagram  '));
checar('zap', 'whatsapp', canalDeUtm('zap'));
checar('wpp', 'whatsapp', canalDeUtm('wpp'));
checar('tt', 'tiktok', canalDeUtm('tt'));
checar('yt', 'youtube', canalDeUtm('yt'));
checar('adesivo é rua', 'rua', canalDeUtm('adesivo'));
checar('vazio não é canal', null, canalDeUtm(''));
checar('desconhecido não é canal', null, canalDeUtm('mercado-livre'));

// ⚠️ A CAMPANHA NÃO PODE VIRAR CANAL NOVO. `instagram-bio` e
// `instagram_stories` são o MESMO canal — se cada sufixo abrisse categoria, a
// contagem do Instagram apareceria repartida e cada pedaço pareceria pequeno.
bloco('3. Campanha no sufixo continua sendo o mesmo canal');

checar('instagram-bio', 'instagram', canalDeUtm('instagram-bio'));
checar('instagram_stories', 'instagram', canalDeUtm('instagram_stories'));
checar('ig-bio', 'instagram', canalDeUtm('ig-bio'));
checar('yt/descricao', 'youtube', canalDeUtm('yt/descricao'));

// ═════════════════ 4. O REFERRER ═══════════════════════════════════════════

bloco('4. O referrer, inclusive os encurtadores dos apps');

checar('google.com', 'google', canalDeReferrer('https://www.google.com/search?q=perua'));
checar('google.com.br', 'google', canalDeReferrer('google.com.br'));
checar('bing conta como busca', 'google', canalDeReferrer('https://bing.com/'));
checar('instagram.com', 'instagram', canalDeReferrer('https://instagram.com/'));
checar('l.instagram.com — o encurtador do app', 'instagram', canalDeReferrer('l.instagram.com'));
checar('lm.facebook.com', 'facebook', canalDeReferrer('lm.facebook.com'));
checar('youtu.be', 'youtube', canalDeReferrer('https://youtu.be/abc'));
checar('só o host, sem esquema', 'tiktok', canalDeReferrer('www.tiktok.com'));
checar('domínio fora da tabela é "outro"', 'outro', canalDeReferrer('https://blogdoperueiro.com.br/post'));
checar('vazio não é canal', null, canalDeReferrer(''));

// ⚠️ NAVEGAÇÃO INTERNA NÃO É AQUISIÇÃO.
bloco('5. O referrer da própria casa não conta');

checar('a landing', null, canalDeReferrer('https://alobuzinou.com.br/'));
checar('o app', null, canalDeReferrer('alobuzinou.com'));
checar('com www', null, canalDeReferrer('https://www.alobuzinou.com.br/#motorista'));
checar('subdomínio da casa', null, canalDeReferrer('teste.alobuzinou.com'));
checar('domínio parecido NÃO é da casa', 'outro', canalDeReferrer('alobuzinou.com.br.golpe.net'));

// ═════════════════ 6. A DECISÃO ════════════════════════════════════════════

// A UTM GANHA DO REFERRER, e a ordem tem consequência de negócio: app de
// mensagem abre link sem referrer, e o WhatsApp é o canal principal deste
// negócio. Quem confia no referrer perde justamente ele.
bloco('6. UTM ganha do referrer');

checar(
  'UTM decide mesmo com referrer de outro canal',
  { canal: 'instagram', detalhe: '' },
  resolverOrigem({ utmSource: 'instagram', referrer: 'https://google.com' })
);
checar(
  'sem UTM, o referrer resolve',
  { canal: 'google', detalhe: 'google.com' },
  resolverOrigem({ referrer: 'https://google.com/search' })
);
checar(
  'a campanha vira detalhe, e o canal fica limpo',
  { canal: 'instagram', detalhe: 'instagram-bio' },
  resolverOrigem({ utmSource: 'instagram-bio' })
);
checar(
  'UTM igual ao canal não repete o dado em detalhe',
  '',
  resolverOrigem({ utmSource: 'instagram' }).detalhe
);

// "OUTRO" E "DIRETO" SÃO COISAS DIFERENTES, e confundi-los apaga a única
// pista de campanha nova: em 'outro' houve link com UTM, ela só não está na
// tabela — e o `detalhe` é o que permite descobrir qual.
bloco('7. "Outro" não é "direto"');

checar(
  'UTM irreconhecível é "outro", com o texto guardado',
  { canal: 'outro', detalhe: 'feira-do-transporte' },
  resolverOrigem({ utmSource: 'feira-do-transporte' })
);
checar(
  'nada em nenhum dos dois é "direto"',
  { canal: 'direto', detalhe: '' },
  resolverOrigem({})
);
checar(
  'referrer interno também cai em "direto"',
  { canal: 'direto', detalhe: '' },
  resolverOrigem({ referrer: 'https://alobuzinou.com.br/' })
);
checar('chamada sem argumento nenhum não explode', 'direto', resolverOrigem().canal);

// ⚠️ A URL É TEXTO DE QUEM VISITA. `?o=` é editável na barra de endereço, e a
// saída precisa continuar dentro da lista fechada.
bloco('8. O que vem da URL é não confiável');

checar('canal devolvido está sempre na lista', true, canalValido(resolverOrigem({ utmSource: '<script>' }).canal));
checar(
  'detalhe é truncado',
  60,
  resolverOrigem({ utmSource: 'x'.repeat(500) }).detalhe.length
);

// ═════════════════ 9. A CONTAGEM DO PAINEL ═════════════════════════════════

bloco('9. A contagem por canal');

const base = [
  { origem: { canal: 'instagram' } },
  { origem: { canal: 'instagram' } },
  { origem: { canal: 'indicacao' } },
  { origem: { canal: 'direto' } },
  {}, // conta antiga, sem o campo
];

checar('soma o total', 5, contarPorCanal(base).total);
checar(
  'maior primeiro',
  ['instagram', 'direto', 'indicacao'],
  contarPorCanal(base).linhas.map((l) => l.canal)
);
checar('conta sem origem cai em "direto"', 2, contarPorCanal(base).linhas.find((l) => l.canal === 'direto').quantos);
checar('percentual é inteiro', 40, contarPorCanal(base).linhas[0].percentual);
checar('canal inválido no banco cai em "direto"', 1, contarPorCanal([{ origem: { canal: 'xpto' } }]).linhas[0].quantos);
checar('e ele é reportado como "direto"', 'direto', contarPorCanal([{ origem: { canal: 'xpto' } }]).linhas[0].canal);
checar('só canais presentes aparecem', 3, contarPorCanal(base).linhas.length);

// ⚠️ ONDE O NÚMERO NÃO EXISTE, A TELA DIZ "—", NUNCA ZERO. Dez canais zerados
// parecem medição e não são.
bloco('10. Base vazia devolve null, não uma tabela de zeros');

checar('lista vazia', null, contarPorCanal([]));
checar('nada passado', null, contarPorCanal());
checar('argumento inválido', null, contarPorCanal('nada disso'));

// ═════════════════ FIM ═════════════════════════════════════════════════════

console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
console.log('════════════════════════════════════════════════════════════════');
if (bad) {
  console.log('');
  falhas.forEach((f) => console.log(`  · ${f}`));
  process.exit(1);
}
