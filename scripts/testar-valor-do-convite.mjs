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
import {
  todasAsAfirmacoes,
  textoDoEnviado,
  LINHAS_DO_VALOR,
  O_QUE_FAZER,
  AVISO_DO_BANCO,
  TITULO_DO_CARTAO,
  ROTULO_RECOLHIDO,
} from '../src/marca/valorDoConvite.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
// Sem comentários: a frase citada num comentário explicativo não é texto de tela.
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
  'mensalidades-pagas-avisaram-atrasadas': [
    ['src/components/payments/estadoDaMensalidade.js', /rotulo: 'Pagas'/],
    ['src/components/payments/estadoDaMensalidade.js', /rotulo: 'Avisaram que pagaram'/],
    ['src/components/payments/estadoDaMensalidade.js', /rotulo: 'Atrasadas'/],
  ],
  'falta-avisada-no-painel': [
    ['src/services/absencesService.js', /absenceDeclarations/],
    ['src/pages/tio/TioDashboard.jsx', /useAbsences/],
  ],
  'push-de-embarque': [
    ['functions/lib/avisos.js', /child_onboard:/],
    ['functions/lib/destinoDoAviso.js', /child_onboard:/],
  ],
  'pix-direto': [
    ['src/pages/pai/PaiFinance.jsx', /PIX direto/],
  ],
  'reenviar-link': [
    ['src/components/children/InviteShare.jsx', /tocar de novo reenvia/],
    ['src/components/children/InviteShare.jsx', /Gerar link novo/],
  ],
  'link-sem-numero': [
    ['src/components/children/InviteShare.jsx', /https:\/\/wa\.me\/\?text=/],
  ],
  inviteUsedAt: [
    ['functions/lib/invites.js', /inviteUsedAt/],
    ['src/components/children/ChildCard.jsx', /inviteStatus === 'pending'/],
    ['src/components/children/ChildCard.jsx', /Convite pendente/],
  ],
  'claimed-paid': [
    ['src/components/payments/AguardandoVoce.jsx', /Dar baixa/],
    ['src/services/paymentsService.js', /claimed/],
  ],
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

const afirmacoes = todasAsAfirmacoes();

console.log('\n\x1b[1m1. Cada afirmação tem origem\x1b[0m');
eq('o catálogo não está vazio', afirmacoes.length >= 9, true);
for (const a of afirmacoes) {
  eq(`"${a.id}" tem uma chave da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
}
for (const [chave, provas] of Object.entries(FUNCIONALIDADES)) {
  for (const [arquivo, padrao] of provas) {
    eq(`"${chave}" existe: ${arquivo} ~ ${padrao}`, padrao.test(ler(arquivo)), true);
  }
}
eq('nenhuma chave da lista fechada ficou sem uso',
  Object.keys(FUNCIONALIDADES).filter((k) => !afirmacoes.some((a) => a.sustenta === k)), []);

console.log('\n\x1b[1m2. Nada que a marca proíbe ou que o app não cumpre\x1b[0m');
const todosOsTextos = [
  ...afirmacoes.map((a) => [a.id, a.texto]),
  ['titulo', TITULO_DO_CARTAO],
  ['rotulo recolhido', ROTULO_RECOLHIDO],
];
for (const [id, texto] of todosOsTextos) {
  eq(`"${id}" está limpo`, reprova(texto), null);
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
eq('com nome: só o primeiro nome', comNome.startsWith('Enviado para Ana. '), true);
eq('com nome: não carrega o sobrenome', comNome.includes('Clara'), false);
eq('sem nome: não deixa buraco nem "undefined"', /undefined|null|\{|\}|para \./.test(semNome), false);
eq('sem nome: fala da família', semNome.includes('família'), true);
eq('nulo e espaços valem como sem nome', [textoDoEnviado(null), textoDoEnviado('   ')], [semNome, semNome]);
eq('com nome cabe em 80 caracteres', comNome.length <= 80, true);
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
