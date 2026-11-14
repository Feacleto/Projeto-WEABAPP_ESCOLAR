/**
 * Testes dos textos que mostram o valor do convite — Node puro, sem runner.
 * Rodar: node scripts/testar-valor-do-convite.mjs
 *
 * Protege docs/analise/12 (momentos 1, 2 e 4 e a linha "O que fazer"):
 * toda afirmação tem ORIGEM (uma funcionalidade que o app cumpre hoje, provada
 * por leitura de arquivo), nenhuma promete o que a marca proíbe, nenhuma é
 * longa demais para quem não lê, e os componentes usam o catálogo em vez de
 * reescrever o texto à mão.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  LINHA_DO_PIX,
  todasAsAfirmacoes,
  textoDoEnviado,
  textoDeQuemAvisouQuePagou,
  CARTEIRA_VAZIA,
  AVISOS_NO_CELULAR,
  ROTA_INICIADA,
  ROTA_INICIADA_SEM_MAPA,
  LINHAS_DO_VALOR,
  O_QUE_FAZER,
  AVISO_DO_BANCO,
  TITULO_DO_CARTAO,
  ROTULO_RECOLHIDO,
} from '../src/marca/valorDoConvite.js';
import { promessaProibida } from '../src/marca/promessas.js';
import { primeiroNomeSemTratamento } from '../src/compartilhado/formatters.js';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
// Sem comentários: a frase citada num comentário explicativo não é texto de tela.
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// A prova lê o CÓDIGO: uma frase que só aparece num comentário não prova que o app a cumpre.
const codigo = (p) => semComentarios(ler(p));

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

/**
 * A LISTA FECHADA de funcionalidades que existem, cada uma com o arquivo e o
 * padrão que a prova. Chave nova só entra aqui junto da prova de que o app a
 * cumpre — é o que impede o catálogo de prometer sem fonte.
 */
const FUNCIONALIDADES = {
  // A mensalidade só NASCE com a mãe dentro: sem `parentUid` o servidor pula.
  'mensalidade-nasce-com-a-mae': [
    ['functions/lib/billing.js', /if \(!child\.parentUid\) \{/],
    ['src/components/payments/estadoDaMensalidade.js', /rotulo: 'Avisaram que pagaram'/],
  ],
  'falta-avisada-no-painel': [
    ['src/services/absencesService.js', /absenceDeclarations/],
    ['src/pages/tio/TioDashboard.jsx', /useAbsences\(todayKey\)/],
    ['src/pages/tio/TioDashboard.jsx', /faltas avisadas hoje/],
  ],
  // De manhã: "A perua saiu" e a chegada na escola; à tarde, a entrega em casa.
  'push-de-saida-e-chegada': [
    ['src/services/routeStatusService.js', /type: 'rota_iniciada'/],
    ['src/services/routeStatusService.js', /child_arrived_home/],
    ['src/services/routeStatusService.js', /child_arrived_school/],
  ],
  // O que o MOTORISTA recebe de fato no celular.
  'push-ao-motorista': [
    ['src/services/notificationsService.js', /type: 'payment_claimed'/],
    ['src/services/absencesService.js', /type: 'absence_declared'/],
    ['functions/lib/destinoDoAviso.js', /absence_declared: \{ parent: '\/pai\/faltas', admin:/],
  ],
  'rota-iniciada': [
    ['src/components/route/ControleDeRota.jsx', /ROTA_INICIADA_SEM_MAPA/],
  ],
  // A família paga com a chave DO MOTORISTA (copia-e-cola montado da chave dele).
  'pix-direto': [
    ['src/components/payments/PixBlock.jsx', /key: admin\?\.pixKey/],
  ],
  // O mesmo botão do WhatsApp reenvia a cada toque, e há "Gerar link novo".
  'reenviar-link': [
    ['src/components/children/InviteShare.jsx', /data-convite-whatsapp/],
    ['src/components/children/InviteShare.jsx', /Gerar link novo/],
  ],
  'link-sem-numero': [
    ['src/components/children/InviteShare.jsx', /https:\/\/wa\.me\/\?text=/],
  ],
  // O que o tio VÊ: o aviso do Início, contado pelas crianças com convite pendente.
  'convites-abertos-no-inicio': [
    ['src/pages/tio/TioDashboard.jsx', /c\.inviteStatus === 'pending' && !c\.cadastroRapido/],
    ['src/pages/tio/TioDashboard.jsx', /ainda não entraram/],
    ['functions/lib/invites.js', /inviteStatus: 'used'/],
  ],
  'claimed-paid': [
    ['src/components/payments/AguardandoVoce.jsx', /Dar baixa/],
    ['src/services/paymentsService.js', /claimed/],
  ],
};

/**
 * AS CONDIÇÕES de que uma frase depende para ser verdade, e a prova de cada
 * uma. Frase condicionada sem condição declarada, ou com condição que o app não
 * cumpre, reprova.
 */
const CONDICOES = {
  'mae-no-app': [['functions/lib/billing.js', /if \(!child\.parentUid\) \{/]],
  'aviso-no-celular-da-mae': [['functions/lib/push.js', /fcmTokens/]],
  'chave-pix-cadastrada': [['src/components/payments/PixBlock.jsx', /key: admin\?\.pixKey/]],
};

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Mais do que a marca proíbe: promessas que o produto não cumpre. */
const PROMESSAS_FALSAS = [
  /cobra\w* por voce/, /cobranca automatica/, /cobra\w* sozinh/,
  /sabe quando o pix/, /sabe se o pix/, /pix chegou/,
  /reduz\w* (o )?atraso/, /paga\w* em dia/, /sem atraso/,
  /gratis/, /segur/, /automatic/, /\d/, /r\$/,
];

/** Devolve o motivo de reprovar a frase, ou null. */
function reprova(texto) {
  const raizProibida = promessaProibida(texto);
  if (raizProibida) return `raiz proibida da marca: ${raizProibida}`;
  const t = semAcento(texto);
  const achada = PROMESSAS_FALSAS.find((re) => re.test(t));
  return achada ? `promessa que o app não cumpre: ${achada}` : null;
}

/**
 * ⚠️ PRESENTE NÃO É MONTADO. Uma versão deste catálogo apoiou uma frase numa
 * etiqueta do `ChildCard`, e o `ChildCard` não é importado por nenhuma tela:
 * o texto existia no arquivo e ninguém o via. Aqui o grafo de imports de src/
 * (sem comentários) diz o que é ALCANÇÁVEL a partir do `main.jsx`, e um
 * componente .jsx só conta se algum arquivo alcançável o RENDERIZA (`<Nome`).
 */
function arquivosDe(dir) {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : arquivosDe(rel);
    return /\.(jsx?|mjs)$/.test(d.name) ? [rel] : [];
  });
}
const arquivosDoSrc = arquivosDe('src');
function resolverImport(de, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(de), spec));
  return [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`, `${base}/index.jsx`].find((c) => arquivosDoSrc.includes(c)) || null;
}
const fontes = Object.fromEntries(arquivosDoSrc.map((f) => [f, semComentarios(ler(f))]));
const grafoReal = Object.fromEntries(
  arquivosDoSrc.map((f) => [
    f,
    [...fontes[f].matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)]
      .map((m) => resolverImport(f, m[1]))
      .filter(Boolean),
  ]),
);
/** Quem se alcança a partir de `inicio` seguindo os imports. */
function alcancaveis(grafo, inicio) {
  const vistos = new Set([inicio]);
  const fila = [inicio];
  while (fila.length) {
    for (const g of grafo[fila.pop()] || []) if (!vistos.has(g)) { vistos.add(g); fila.push(g); }
  }
  return vistos;
}
/** Devolve por que o arquivo NÃO está montado, ou null se está. */
function naoMontado(arquivo, grafo, vistos, fonteDoArquivo) {
  if (!vistos.has(arquivo)) return 'não é alcançável a partir do main.jsx';
  if (!arquivo.endsWith('.jsx')) return null;
  const nome = path.basename(arquivo).replace(/\.\w+$/, '');
  const quem = Object.keys(grafo).filter((f) => f !== arquivo && vistos.has(f) && grafo[f].includes(arquivo));
  return quem.some((f) => new RegExp(`<${nome}\\b`).test(fonteDoArquivo(f)))
    ? null
    : 'nenhum arquivo alcançável o renderiza';
}
const alcancados = alcancaveis(grafoReal, 'src/main.jsx');

const afirmacoes = todasAsAfirmacoes();

console.log('\n\x1b[1m1. Cada afirmação tem origem\x1b[0m');
eq('o catálogo não está vazio', afirmacoes.length >= 9, true);
for (const a of afirmacoes) {
  eq(`"${a.id}" tem uma chave da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
}
for (const [chave, provas] of Object.entries(FUNCIONALIDADES)) {
  for (const [arquivo, padrao] of provas) {
    eq(`"${chave}" existe: ${arquivo} ~ ${padrao}`, padrao.test(codigo(arquivo)), true);
  }
}
for (const [chave, provas] of Object.entries(CONDICOES)) {
  for (const [arquivo, padrao] of provas) {
    eq(`condição "${chave}" existe: ${arquivo}`, padrao.test(codigo(arquivo)), true);
  }
}
for (const l of [...LINHAS_DO_VALOR, LINHA_DO_PIX]) {
  eq(`"${l.id || 'pix'}" declara uma condição da lista fechada`, Object.hasOwn(CONDICOES, l.condicao), true);
}
eq('nenhuma chave da lista fechada ficou sem uso',
  Object.keys(FUNCIONALIDADES).filter((k) => !afirmacoes.some((a) => a.sustenta === k)), []);

console.log('\n\x1b[1m1b. O que sustenta e o que mostra está MONTADO numa tela\x1b[0m');
const arquivosDeProva = new Set(
  [...Object.values(FUNCIONALIDADES), ...Object.values(CONDICOES)]
    .flat()
    .map(([arquivo]) => arquivo)
    .filter((a) => a.startsWith('src/')),
);
// Os componentes e páginas que MOSTRAM as frases do catálogo.
const TELAS_QUE_MOSTRAM = [
  'src/components/children/PorQueConvidar.jsx',
  'src/components/children/InviteShare.jsx',
  'src/components/children/ChildForm.jsx',
  'src/pages/ChildDetail.jsx',
  'src/components/payments/AguardandoVoce.jsx',
  'src/components/tio/ConvitePush.jsx',
  'src/components/route/ControleDeRota.jsx',
  'src/pages/tio/TioFinance.jsx',
  'src/pages/tio/TioDashboard.jsx',
];
for (const a of new Set([...arquivosDeProva, ...TELAS_QUE_MOSTRAM])) {
  eq(`montado: ${a}`, naoMontado(a, grafoReal, alcancados, (f) => fontes[f]), null);
}
// Sonda positiva: um componente órfão — e um que só é importado por órfão — reprovam.
const grafoFalso = {
  'src/main.jsx': ['src/App.jsx'],
  'src/App.jsx': ['src/Tela.jsx'],
  'src/Tela.jsx': [],
  'src/Orfao.jsx': ['src/Tela.jsx'],
  'src/FilhoDoOrfao.jsx': [],
  'src/Importado.jsx': [],
};
grafoFalso['src/Orfao.jsx'].push('src/FilhoDoOrfao.jsx');
grafoFalso['src/App.jsx'].push('src/Importado.jsx');
const fontesFalsas = {
  'src/main.jsx': '', 'src/App.jsx': '<Tela />', 'src/Tela.jsx': '', 'src/Orfao.jsx': '<FilhoDoOrfao />',
  'src/FilhoDoOrfao.jsx': '', 'src/Importado.jsx': '',
};
const vistosFalsos = alcancaveis(grafoFalso, 'src/main.jsx');
const verFalso = (a) => naoMontado(a, grafoFalso, vistosFalsos, (f) => fontesFalsas[f]);
eq('sonda: componente montado passa', verFalso('src/Tela.jsx'), null);
eq('sonda: componente órfão reprova', verFalso('src/Orfao.jsx') !== null, true);
eq('sonda: componente só importado por órfão reprova', verFalso('src/FilhoDoOrfao.jsx') !== null, true);
eq('sonda: importado mas nunca renderizado reprova', verFalso('src/Importado.jsx') !== null, true);

console.log('\n\x1b[1m2. Nada que a marca proíbe ou que o app não cumpre\x1b[0m');
const todosOsTextos = [
  ...afirmacoes.map((a) => [a.id, a.texto]),
  ['titulo', TITULO_DO_CARTAO],
  ['rotulo recolhido', ROTULO_RECOLHIDO],
];
for (const [id, texto] of todosOsTextos) {
  eq(`"${id}" está limpo`, reprova(texto), null);
}

// Frase condicionada não pode soar como "sempre verdadeira".
const ABSOLUTOS = /\b(sempre|toda|todas|todos|qualquer|nunca|automatic\w*|na hora)\b/;
for (const l of [...LINHAS_DO_VALOR, LINHA_DO_PIX]) {
  eq(`"${l.id || 'pix'}" não usa palavra absoluta`, ABSOLUTOS.test(semAcento(l.texto)), false);
}

console.log('\n\x1b[1m3. Curto para quem não lê\x1b[0m');
const DO_CARTAO = [
  ...LINHAS_DO_VALOR.map((l) => [l.id, l.texto]),
  ['pix', afirmacoes.find((a) => a.id === 'pix').texto],
  ['mandarDeNovo', O_QUE_FAZER.mandarDeNovo.texto],
  ['semNumero', O_QUE_FAZER.semNumero.texto],
  ['bancoNaoVisto', AVISO_DO_BANCO.texto],
];
for (const [id, texto] of DO_CARTAO) {
  eq(`"${id}" cabe em 60 caracteres (${texto.length})`, texto.length <= 60, true);
}
eq('o cartão tem exatamente três linhas de valor', LINHAS_DO_VALOR.length, 3);

console.log('\n\x1b[1m4. O momento 2 com e sem nome\x1b[0m');
const comNome = textoDoEnviado('Ana Clara Souza');
const semNome = textoDoEnviado('');
eq('com nome: o texto verdadeiro, palavra por palavra', comNome,
  'Enviado para Ana. Quando ela entrar, sai do aviso “ainda não entraram” no Início.');
eq('sem nome: o texto verdadeiro, palavra por palavra', semNome,
  'Enviado. Quando a família entrar, sai do aviso “ainda não entraram” no Início.');
eq('o aviso que o texto cita existe no Início, com esse nome',
  /ainda não entraram/.test(fontes['src/pages/tio/TioDashboard.jsx']) && /Início/.test(comNome), true);
eq('com nome: só o primeiro nome', comNome.startsWith('Enviado para Ana. '), true);
eq('com nome: não carrega o sobrenome', comNome.includes('Clara'), false);
eq('sem nome: não deixa buraco nem "undefined"', /undefined|null|\{|\}|para \./.test(semNome), false);
eq('sem nome: fala da família', semNome.includes('família'), true);
eq('nulo e espaços valem como sem nome', [textoDoEnviado(null), textoDoEnviado('   ')], [semNome, semNome]);
eq('com nome cabe em 90 caracteres', comNome.length <= 90, true);

// Rodada 2 do passeio visual: "Dona Marta" saía "Enviado para Dona.".
const TRATAMENTOS_CASOS = [
  ['Dona Marta', 'Marta'],
  ['dona marta', 'marta'],
  ['DONA Marta', 'Marta'],
  ['Sra. Ana Paula', 'Ana'],
  ['sra ana', 'ana'],
  ['Seu João', 'João'],
  ['D. Marta', 'Marta'],
  ['Dr. Carlos', 'Carlos'],
  ['Tia Cida', 'Cida'],
  ['Maria', 'Maria'],
  ['Maria Dona', 'Maria'],
  ['  ', ''],
  ['Dona', ''],
  ['Sra.', ''],
  ['Dona Sra.', ''],
  [null, ''],
];
for (const [entrada, esperado] of TRATAMENTOS_CASOS) {
  eq(`primeiroNomeSemTratamento(${JSON.stringify(entrada)}) = "${esperado}"`,
    primeiroNomeSemTratamento(entrada), esperado);
}
eq('"Dona Marta" vira "Enviado para Marta."', textoDoEnviado('Dona Marta').startsWith('Enviado para Marta. '), true);
eq('só "Dona" vira a frase sem nome', [textoDoEnviado('Dona'), textoDoEnviado('sra.')], [semNome, semNome]);
eq('nenhum tratamento sobra como nome na frase',
  TRATAMENTOS_CASOS.map(([e]) => textoDoEnviado(e)).filter((t) => /para (dona|seu|sra|sr|d|dr|tia)\b/i.test(t)), []);
// Mutação: a versão ingênua (primeira palavra) precisa REPROVAR estes casos,
// senão a tabela acima não está provando nada.
const ingenuo = (n) => String(n ?? '').trim().split(/\s+/)[0] || '';
eq('sonda: o primeiro-nome ingênuo erra pelo menos 6 dos casos',
  TRATAMENTOS_CASOS.filter(([e, esp]) => ingenuo(e) !== esp).length >= 6, true);
const fonteDoEnviado = codigo('src/marca/valorDoConvite.js').match(/function textoDoEnviado[\s\S]*?\n}/)[0];
eq('textoDoEnviado usa primeiroNomeSemTratamento (não o split ingênuo)',
  /primeiroNomeSemTratamento\(nome\)/.test(fonteDoEnviado) && !/split\(/.test(fonteDoEnviado), true);
eq('nenhuma das duas formas promete um "Entrou ✓" que a tela não tem',
  /entrou ✓/i.test(comNome + semNome), false);

console.log('\n\x1b[1m5. Os componentes usam o catálogo\x1b[0m');
const cartao = ler('src/components/children/PorQueConvidar.jsx');
const share = ler('src/components/children/InviteShare.jsx');
const aguardando = ler('src/components/payments/AguardandoVoce.jsx');
const form = ler('src/components/children/ChildForm.jsx');
const finance = ler('src/pages/tio/TioFinance.jsx');
const detalhe = ler('src/pages/ChildDetail.jsx');
const todasAsFrases = afirmacoes.map((a) => a.texto).concat([TITULO_DO_CARTAO, ROTULO_RECOLHIDO]);
for (const [nome, fonte] of [['PorQueConvidar', cartao], ['InviteShare', share], ['AguardandoVoce', aguardando]]) {
  eq(`${nome} importa o catálogo`, /marca\/valorDoConvite\.js/.test(fonte), true);
  eq(`${nome} não repete nenhuma frase do catálogo à mão`,
    todasAsFrases.filter((f) => semComentarios(fonte).includes(f)), []);
}
eq('o cartão desenha as três linhas e a do PIX pelo catálogo',
  /LINHAS_DO_VALOR/.test(cartao) && /LINHA_DO_PIX/.test(cartao) && /O_QUE_FAZER/.test(cartao), true);
eq('o InviteShare usa textoDoEnviado quando mostra o enviado',
  /mostrarEnviado && \([\s\S]*?textoDoEnviado\(nomeDoResponsavel\)/.test(share), true);
eq('a tela final do ChildForm renderiza o cartão', /<PorQueConvidar\b/.test(form), true);
eq('a ficha da criança (convite pendente) renderiza o cartão', /<PorQueConvidar\b/.test(detalhe), true);
eq('o ChildForm passa o nome de quem recebe ao InviteShare', /nomeDoResponsavel=\{responsavel\}/.test(form), true);
eq('AguardandoVoce mostra a frase do banco e a lembra no aparelho',
  /AVISO_DO_BANCO\.texto/.test(aguardando) && /lembrar\(CHAVE_AVISO_DO_BANCO\)/.test(aguardando), true);
eq('AguardandoVoce só é renderizado em TioFinance (a frase mora num lugar)',
  /<AguardandoVoce\b/.test(finance), true);
eq('o botão que a frase manda tocar existe em AguardandoVoce',
  /toque em ([^.]+)\./.test(AVISO_DO_BANCO.texto) &&
    aguardando.includes(AVISO_DO_BANCO.texto.match(/toque em ([^.]+)\./)[1]), true);

console.log('\n\x1b[1m5b. Os textos corrigidos na 2ª rodada\x1b[0m');
const reguaDosAvisos = require('../functions/lib/reguaDosAvisos.js');
const aviso = reguaDosAvisos.avisoDoConvite({
  crianca: { name: 'Ana Clara', inviteStatus: 'pending', createdAt: new Date(2026, 8, 10, 12) },
  agora: new Date(2026, 8, 14, 12),
});
const tour = ler('src/components/tutorial/interactiveSteps.js');
const fonteDe = (p) => semComentarios(ler(p));
eq('A: o chip 1 fala da mensalidade com a mãe no app', LINHAS_DO_VALOR[0].texto, 'Com a mãe no app, você acompanha a mensalidade dela');
eq('B: o chip 3 fala da saída e da chegada', LINHAS_DO_VALOR[2].texto, 'A mãe é avisada quando a perua sai e quando o filho chega');
eq('D: a Carteira vazia diz que a mensalidade aparece depois que a família entra',
  CARTEIRA_VAZIA, 'A mensalidade de cada família aparece depois que ela entra no app.');
eq('D: TioFinance usa o texto do catálogo', /\? CARTEIRA_VAZIA\b/.test(fonteDe('src/pages/tio/TioFinance.jsx')), true);
eq('E: o convite do aviso só promete o que o motorista recebe',
  /quem avisou que vai faltar/.test(AVISOS_NO_CELULAR) && /quem avisou que pagou/.test(AVISOS_NO_CELULAR) &&
    !/chegada|cobran/.test(semAcento(AVISOS_NO_CELULAR)), true);
eq('E: ConvitePush usa o texto do catálogo', /\{AVISOS_NO_CELULAR\}/.test(fonteDe('src/components/tio/ConvitePush.jsx')), true);
eq('F: com nome, o sujeito é a família', textoDeQuemAvisouQuePagou('Ana Clara'), 'A família de Ana avisou que pagou');
eq('F: sem nome, "Uma família"', textoDeQuemAvisouQuePagou(null), 'Uma família avisou que pagou');
eq('F: AguardandoVoce usa a função do catálogo', /textoDeQuemAvisouQuePagou\(p\.childName\)/.test(fonteDe('src/components/payments/AguardandoVoce.jsx')), true);
eq('F: a linha pode quebrar (sem truncate cortando "A família de …")',
  /break-words[^"]*"[^<]*>\s*\{textoDeQuemAvisouQuePagou/.test(fonteDe('src/components/payments/AguardandoVoce.jsx')), true);
eq('G: a rota inicia calma e sem jargão', [ROTA_INICIADA, /!|gps/i.test(ROTA_INICIADA + ROTA_INICIADA_SEM_MAPA)], ['Rota iniciada.', false]);
eq('G: o aviso sem mapa continua dizendo o que as famílias não veem', ROTA_INICIADA_SEM_MAPA.includes('não aparece no mapa'), true);
eq('G: ControleDeRota usa o catálogo', /\? ROTA_INICIADA\s*:\s*ROTA_INICIADA_SEM_MAPA/.test(fonteDe('src/components/route/ControleDeRota.jsx')), true);
eq('H: o título do tour', /title: 'Sua turma, escolas e horários estão aqui'/.test(tour), true);
eq('I: o convite parado não afirma que a família recebeu',
  [aviso?.titulo, /recebeu/.test(aviso?.corpo || '')], ['O convite de Ana está parado', false]);
eq('I: e diz há quanto tempo e o que fazer',
  aviso?.corpo, 'Já faz 4 dias e a família ainda não entrou. Toque para mandar de novo.');

console.log('\n\x1b[1m5c. Os textos antigos não voltam (src/ e functions/lib/)\x1b[0m');
const ANTIGOS = [
  'Acompanhe o pagamento: quem pagou, avisou ou atrasou',
  'A mãe é avisada quando o filho entra na perua',
  'Os pagamentos do mês são gerados quando você cadastra crianças',
  'chegada da criança, recado de escola e cobrança',
  'Rota começou! GPS ligado',
  'ambiente de operação',
  'A família recebeu há',
  'não foi usado',
  'some da lista',
];
function arquivos(dir) {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : arquivos(rel);
    return /\.(jsx?|cjs|mjs)$/.test(d.name) ? [rel] : [];
  });
}
const alvos = [...arquivos('src'), ...arquivos('functions/lib')];
for (const antigo of ANTIGOS) {
  eq(`ninguém escreve mais "${antigo}"`, alvos.filter((f) => semComentarios(ler(f)).includes(antigo)), []);
}
eq('a sonda acha o antigo quando ele existe', semComentarios("x = 'Rota começou! GPS ligado.'").includes(ANTIGOS[4]), true);

console.log('\n\x1b[1m6. A memória do aparelho nunca derruba a tela\x1b[0m');
const lembrete = ler('src/compartilhado/lembreteDoAparelho.js');
eq('leitura e escrita em try/catch',
  (lembrete.match(/try \{/g) || []).length >= 2 && (lembrete.match(/catch/g) || []).length >= 2, true);
eq('o cartão e o aviso usam o helper, não o localStorage direto',
  !/localStorage/.test(cartao) && !/localStorage/.test(aguardando), true);

console.log('\n\x1b[1m7. Sonda positiva: a regra pega o que deve\x1b[0m');
eq('"cobra por você" é reprovado', reprova('O app cobra por você.') !== null, true);
eq('"segurança" é reprovado', reprova('Mais segurança para a turma') !== null, true);
eq('"grátis" é reprovado', reprova('Convide, é grátis') !== null, true);
eq('"sabe quando o PIX chegou" é reprovado', reprova('O app sabe quando o PIX chegou.') !== null, true);
eq('"reduz o atraso" é reprovado', reprova('Reduz o atraso das famílias') !== null, true);
eq('número solto é reprovado', reprova('7 de 10 famílias entram') !== null, true);
eq('uma frase honesta passa', reprova('Convide a família para acompanhar o pagamento'), null);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
