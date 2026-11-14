/**
 * A Lista da turma (RC2) — Node puro, sem runner.
 * Rodar: npm run testar:lista-da-turma
 *
 * Protege docs/analise/11-lista-da-turma.md (com as seções corrigidas):
 *   1. O ESTADO DO CONVITE sai do que o banco já guarda (`parentUid`,
 *      `conviteEnviadoEm`, `inviteCriadoEm` + 15 dias, `parentPhone`), e o
 *      envio mais velho que o link não conta.
 *   2. O CONTADOR e a FILA de convites: separados por estado; o botão do topo
 *      anda para a próxima depois de cada toque.
 *   3. O Início conta só quem pede um toque — e NÃO mais a mistura antiga.
 *   4. O que falta, a frase de estado (só a hora em âmbar), o agrupamento por
 *      escola, a caixa "a completar" e a fila de "sem valor".
 *   5. A hora de pegar PROPOSTA pela entrada da escola nunca repete hora.
 *   6. Fora da rota: o `cadastroRapido` cai no MESMO write que completa.
 *   7. O catálogo de textos: toda afirmação com origem provada no código; o
 *      "Tirar da turma" conferido contra o que o SERVIÇO faz (7b).
 *   8–11. As telas usam a régua e o catálogo (leitura de arquivo).
 *   12. O salvador por campo: COMPORTAMENTO com serviço falso (resolve,
 *       rejeita, fora de ordem, sem sinal) — e a mesma bateria contra
 *       MUTANTES do arquivo de verdade, que precisam reprovar.
 *   13–17. Os achados da auditoria (M1–M6), cada guarda com a mutação que a
 *       arranca do arquivo e precisa reprovar.
 *
 * ⚠️ SONDA DE VERDADE É MUTAÇÃO DO ARQUIVO. A versão anterior deste teste
 * tinha sondas que testavam uma string literal escrita no próprio teste, e
 * mutações simples no componente passavam (a auditoria mostrou quatro). O
 * padrão agora é o de `testar-valor-da-mensalidade.mjs`: arrancar a linha do
 * arquivo e exigir que a prova reprove.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONVITE,
  FALTA,
  estadoDoConvite,
  precisaDeConvite,
  resumoDosConvites,
  contarConvitesAMandar,
  proximaParaConvidar,
  oQueFalta,
  fraseDeEstado,
  resumoDaLinha,
  ruaCurta,
  agruparPorEscola,
  gruposACompletar,
  proporHorasDePegar,
  foraDaRota,
  completaParaARota,
  camposAoSalvar,
  SEM_ESCOLA,
  decidirOkDoNome,
  mensalidadeTravada,
  valorParaConferir,
  conferirProposta,
  temIrmaoNaTurma,
} from '../src/dominio/escola/listaDaTurma.js';
import { criarSalvadorPorCampo, FASE } from '../src/compartilhado/salvarPorCampo.js';
import { toqueCedoDemais } from '../src/compartilhado/toques.js';
import { valorDoCampoFalta } from '../src/dominio/cobranca/valorDaMensalidade.js';
import { blocosDaDirecao, normalizaHora } from '../src/dominio/rota/horarios.js';
import {
  contadorDeFamilias,
  textoForaDaRota,
  textoDeTirar,
  cabecalhoDaEscola,
  ROTULOS,
  GRUPO_A_COMPLETAR,
  todasAsAfirmacoesDaLista,
  SEM_VALOR,
  confirmacaoSemNumero,
  confiraOValor,
} from '../src/marca/textosDaLista.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replace(/\r\n/g, '\n');
function arquivosDe(dir) {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    if (d.isDirectory()) return d.name === 'node_modules' ? [] : arquivosDe(rel);
    return /\.(jsx?|mjs)$/.test(d.name) ? [rel] : [];
  });
}
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let ok = 0;
let falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.UTC(2026, 10, 14, 12);
const ha = (dias) => AGORA - dias * DIA;

// ─────────────────────────────────────────────────────────────────────────
bloco('1. O estado do convite');
const base = { id: 'x', name: 'Ana Clara', active: true, inviteStatus: 'pending', parentUid: null, inviteCriadoEm: ha(2) };
eq('entrou: tem parentUid', estadoDoConvite({ ...base, parentUid: 'mae1' }, AGORA), CONVITE.ENTROU);
eq('entrou vence até o link vencido (o link já foi usado)', estadoDoConvite({ ...base, parentUid: 'mae1', inviteCriadoEm: ha(40) }, AGORA), CONVITE.ENTROU);
eq('sem convite: tem número, nunca mandou', estadoDoConvite({ ...base, parentPhone: '11987654321' }, AGORA), CONVITE.SEM_CONVITE);
eq('sem telefone: nunca mandou e não tem número', estadoDoConvite(base, AGORA), CONVITE.SEM_TELEFONE);
eq('número curto demais conta como sem telefone', estadoDoConvite({ ...base, parentPhone: '98765' }, AGORA), CONVITE.SEM_TELEFONE);
eq('enviado: tocou depois do link', estadoDoConvite({ ...base, conviteEnviadoEm: ha(1) }, AGORA), CONVITE.ENVIADO);
eq('enviado aceita o Timestamp do Firestore (toMillis)',
  estadoDoConvite({ ...base, conviteEnviadoEm: { toMillis: () => ha(1) }, inviteCriadoEm: { toMillis: () => ha(2) } }, AGORA), CONVITE.ENVIADO);
eq('⚠️ envio mais VELHO que o link (gerou link novo) não conta',
  estadoDoConvite({ ...base, parentPhone: '11987654321', conviteEnviadoEm: ha(5), inviteCriadoEm: ha(1) }, AGORA), CONVITE.SEM_CONVITE);
eq('vencido: link com mais de 15 dias, nunca mandou', estadoDoConvite({ ...base, inviteCriadoEm: ha(16) }, AGORA), CONVITE.VENCIDO);
eq('vencido vale também para quem já tinha recebido (o link morreu)',
  estadoDoConvite({ ...base, inviteCriadoEm: ha(20), conviteEnviadoEm: ha(19) }, AGORA), CONVITE.VENCIDO);
eq('dia 15 ainda vale; dia 15 e um minuto não',
  [estadoDoConvite({ ...base, inviteCriadoEm: AGORA - 15 * DIA }, AGORA), estadoDoConvite({ ...base, inviteCriadoEm: AGORA - 15 * DIA - 60000 }, AGORA)],
  [CONVITE.SEM_TELEFONE, CONVITE.VENCIDO]);
eq('sem carimbo nenhum (cadastro antigo): não vence', estadoDoConvite({ ...base, inviteCriadoEm: null, createdAt: null }, AGORA), CONVITE.SEM_TELEFONE);
eq('o toque desta abertura vira Enviado antes do servidor', estadoDoConvite(base, AGORA, true), CONVITE.ENVIADO);
eq('o toque desta abertura NÃO esconde o link vencido', estadoDoConvite({ ...base, inviteCriadoEm: ha(30) }, AGORA, true), CONVITE.VENCIDO);
eq('precisa de convite: sem convite, sem telefone e vencido; não enviado nem entrou',
  [CONVITE.SEM_CONVITE, CONVITE.SEM_TELEFONE, CONVITE.VENCIDO, CONVITE.ENVIADO, CONVITE.ENTROU].map(precisaDeConvite),
  [true, true, true, false, false]);

// ─────────────────────────────────────────────────────────────────────────
bloco('2. O contador e a fila de convites');
const turma = [
  { ...base, id: 'a', name: 'Ana', parentUid: 'm1' },
  { ...base, id: 'b', name: 'Bia', conviteEnviadoEm: ha(1) },
  { ...base, id: 'c', name: 'Caio', inviteCriadoEm: ha(30) },
  { ...base, id: 'd', name: 'Davi' },
  { ...base, id: 'e', name: 'Eva', parentPhone: '11987654321', cadastroRapido: true },
  { ...base, id: 'f', name: 'Fábio', active: false },
];
eq('resumo separado por estado (a inativa não conta)', resumoDosConvites(turma, AGORA),
  { total: 5, entraram: 1, faltam: 4, aMandar: 3, enviados: 1, vencidos: 1, semTelefone: 1 });
eq('o toque desta abertura tira da conta "a mandar"', resumoDosConvites(turma, AGORA, new Set(['d'])).aMandar, 2);
eq('a próxima é a primeira que pede convite, na ordem da lista', proximaParaConvidar(turma, AGORA)?.id, 'c');
eq('depois de mandar para Caio, a próxima é Davi', proximaParaConvidar(turma, AGORA, 'c', new Set(['c']))?.id, 'd');
eq('e dá a volta no fim da lista', proximaParaConvidar(turma, AGORA, 'e')?.id, 'c');
eq('com todos tocados, o vencido continua na fila (o link morto pede link novo)', proximaParaConvidar(turma, AGORA, 'e', new Set(['c', 'd', 'e']))?.id, 'c');
eq('sem vencido e todos tocados, não há próxima', proximaParaConvidar(turma.filter((c) => c.id !== 'c'), AGORA, null, new Set(['d', 'e'])), null);
eq('lista vazia: nada', [proximaParaConvidar([], AGORA), resumoDosConvites([], AGORA).total], [null, 0]);
eq('o contador do topo: "1 de 5 famílias no app"', contadorDeFamilias(1, 5), '1 de 5 famílias no app');
eq('uma família só: frase sem "1 de 1"', [contadorDeFamilias(0, 1), contadorDeFamilias(1, 1)],
  ['A família ainda não está no app', 'A família está no app']);

// ─────────────────────────────────────────────────────────────────────────
bloco('3. O Início conta só quem pede um toque');
eq('contarConvitesAMandar = aMandar', contarConvitesAMandar(turma, AGORA), 3);
// SONDA: a conta antiga misturava enviado e escondia o cadastro rápido.
const antigos = turma.filter((c) => c.active !== false && c.inviteStatus === 'pending' && !c.cadastroRapido && !c.parentUid).map((c) => c.id);
const novos = turma.filter((c) => c.active !== false && precisaDeConvite(estadoDoConvite(c, AGORA))).map((c) => c.id);
eq('quem a conta nova cobra: o vencido, o sem telefone e o rápido com número', novos, ['c', 'd', 'e']);
eq('sonda: a conta antiga cobrava outras famílias (o enviado entrava, o rápido saía)', antigos, ['b', 'c', 'd']);
{
  const ini = semComentarios(ler('src/pages/tio/TioDashboard.jsx'));
  eq('o TioDashboard usa contarConvitesAMandar', /contarConvitesAMandar\(children, agoraDoConvite\)/.test(ini), true);
  eq('e não usa mais o filtro antigo', /c\.inviteStatus === 'pending' && !c\.cadastroRapido/.test(ini), false);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('4. O que falta, a frase de estado, as escolas e a caixa "a completar"');
const completa = {
  id: 'k', name: 'Lia', active: true, horaPega: '06:40', address: 'Rua das Flores, 120, Centro, São Paulo - SP',
  parentPhone: '11987654321', monthlyFee: 350, parentUid: null,
};
eq('completa: não falta nada', oQueFalta(completa), []);
eq('só o nome: falta hora, rua, WhatsApp e mensalidade (o número só depois da rua)',
  oQueFalta({ id: 'n', name: 'Nino' }), [FALTA.HORA, FALTA.RUA, FALTA.WHATSAPP, FALTA.MENSALIDADE]);
eq('rua sem número: falta o número', oQueFalta({ ...completa, numeroPendente: true }), [FALTA.NUMERO]);
eq('com a família no app o WhatsApp não é cobrado', oQueFalta({ ...completa, parentPhone: '', parentUid: 'm' }), []);
eq('mensalidade zero ou texto vazio: sem valor', [oQueFalta({ ...completa, monthlyFee: 0 }), oQueFalta({ ...completa, monthlyFee: '' })],
  [[FALTA.MENSALIDADE], [FALTA.MENSALIDADE]]);
eq('hora inválida ("manhã") conta como sem hora', oQueFalta({ ...completa, horaPega: 'manhã' }), [FALTA.HORA]);
eq('frase: só a hora é âmbar', fraseDeEstado({ ...completa, horaPega: '' }), { faltaHora: true, texto: '' });
eq('frase: o resto é neutro, até duas faltas', fraseDeEstado({ ...completa, parentPhone: '', numeroPendente: true }),
  { faltaHora: false, texto: 'falta número da casa e WhatsApp da mãe' });
eq('frase: mais de duas viram "(+N)"', fraseDeEstado({ id: 'n', name: 'Nino' }),
  { faltaHora: true, texto: 'falta rua e WhatsApp da mãe (+1)' });
eq('frase de quem está completa: vazia', fraseDeEstado(completa), { faltaHora: false, texto: '' });
eq('rua curta: rua e número', ruaCurta(completa.address), 'Rua das Flores, 120');
eq('rua curta sem número: só a rua', ruaCurta('Rua das Flores, Centro, São Paulo'), 'Rua das Flores');
eq('rua curta no formato dos Correios (montarEndereco)', ruaCurta('Rua das Trovas, 12, casa 2 — Socorro, São Paulo/SP'), 'Rua das Trovas, 12');
eq('a segunda linha: escola · hora · rua', resumoDaLinha({ ...completa, school: 'Alvorada' }), 'Alvorada · 6h40 · Rua das Flores, 120');
eq('a segunda linha não deixa buraco', resumoDaLinha({ name: 'X' }), '');

const escolas = [{ id: 'e1', nome: 'Alvorada', horaEntrada: '07:30' }, { id: 'e2', nome: 'Esperança' }];
const grupos = agruparPorEscola([
  { id: '1', schoolId: 'e2', school: 'Esperança' },
  { id: '2', schoolId: 'e1', school: 'Alvorada' },
  { id: '3' },
  { id: '4', school: 'Colégio Ômega' },
  { id: '5', schoolId: 'e1', school: 'Alvorada' },
  { id: '6', school: 'colegio omega' },
], escolas);
eq('grupos: por id, por nome (sem acento/caixa) e "sem escola" no fim',
  grupos.map((g) => [g.nome, g.criancas.map((c) => c.id)]),
  [['Alvorada', ['2', '5']], ['Colégio Ômega', ['4', '6']], ['Esperança', ['1']], ['', ['3']]]);
eq('o grupo traz a entrada da escola', grupos[0].horaEntrada, '07:30');
eq('o último é o sem escola', grupos[3].chave, SEM_ESCOLA);
eq('cabeçalho do grupo', [cabecalhoDaEscola('Alvorada', 2), cabecalhoDaEscola('', 1)], ['Alvorada · 2 crianças', 'Sem escola · 1 criança']);

const caixa = gruposACompletar([
  completa,
  { ...completa, id: 'h', horaPega: '' },
  { ...completa, id: 'm', monthlyFee: 0 },
  { ...completa, id: 'mm', monthlyFee: 0, numeroPendente: true },
  { ...completa, id: 'off', active: false, horaPega: '' },
]);
eq('a caixa agrupa pelo que falta, na ordem, e ignora quem saiu',
  caixa.map((g) => [g.falta, g.criancas.map((c) => c.id)]),
  [['hora', ['h']], ['numero', ['mm']], ['mensalidade', ['m', 'mm']]]);
eq('todo grupo tem nome na tela', Object.values(FALTA).every((f) => !!GRUPO_A_COMPLETAR[f]), true);

// ─────────────────────────────────────────────────────────────────────────
bloco('5. A hora de pegar proposta pela entrada (nunca a mesma em todas)');
const escolaComPonto = { id: 'e1', lat: -23.55, lng: -46.63 };
const semHora = [
  { id: 'p1', name: 'Perto', lat: -23.551, lng: -46.631 },
  { id: 'p2', name: 'Longe', lat: -23.58, lng: -46.66 },
  { id: 'p3', name: 'Meio', lat: -23.565, lng: -46.645 },
  { id: 'p4', name: 'Sem ponto' },
  { id: 'p5', name: 'Já tem', horaPega: '06:10', lat: -23.6, lng: -46.7 },
];
const prop = proporHorasDePegar({ criancas: semHora, escola: escolaComPonto, entrada: '07:30' });
const horas = prop.map((p) => p.hora);
eq('só quem está SEM hora recebe proposta', prop.map((p) => p.child.id).sort(), ['p1', 'p2', 'p3', 'p4']);
eq('nenhuma hora se repete', new Set(horas).size, horas.length);
eq('em ordem crescente', [...horas].sort(), horas);
eq('a mais longe vem antes da mais perto (sem ponto, no começo)', prop.map((p) => p.child.id), ['p4', 'p2', 'p3', 'p1']);
eq('todas antes da entrada', horas.every((h) => h < '07:30'), true);
eq('de 5 em 5 minutos', horas.every((h) => Number(h.slice(3)) % 5 === 0), true);
eq('sem entrada válida, sem proposta', proporHorasDePegar({ criancas: semHora, escola: escolaComPonto, entrada: 'cedo' }), []);
eq('todos com hora: sem proposta', proporHorasDePegar({ criancas: [semHora[4]], escola: escolaComPonto, entrada: '07:30' }), []);
{
  const muitas = Array.from({ length: 20 }, (_, i) => ({ id: `z${i}`, name: `Z${i}` }));
  const p = proporHorasDePegar({ criancas: muitas, escola: {}, entrada: '00:40' });
  eq('não atravessa a meia-noite para trás (quem não cabe fica sem proposta)', p.every((x) => normalizaHora(x.hora) === x.hora && x.hora < '00:40'), true);
  eq('...e de fato corta', p.length < 20, true);
}
// SONDA: "aplicar a todas" (o desenho recusado) repetiria a hora.
const aplicarATodas = semHora.filter((c) => !c.horaPega).map(() => '07:00');
eq('sonda: "aplicar a todas" repetiria a hora (reprovaria)', new Set(aplicarATodas).size === aplicarATodas.length, false);

// ─────────────────────────────────────────────────────────────────────────
bloco('6. Fora da rota até ter rua e hora');
const rapida = { id: 'r', name: 'Rui', active: true, cadastroRapido: true, horaEntrega: '12:30' };
eq('a criança da linha "+ Nome" fica fora da rota', [foraDaRota(rapida), foraDaRota(completa)], [true, false]);
eq('completa para a rota: rua e hora', [completaParaARota(completa), completaParaARota({ ...completa, address: '' })], [true, false]);
eq('salvar a hora sem a rua: continua fora', camposAoSalvar(rapida, { horaPega: '06:40' }), { horaPega: '06:40' });
eq('salvar a rua quando já tem hora: sai do cadastro rápido no MESMO write',
  camposAoSalvar({ ...rapida, horaPega: '06:40' }, { address: 'Rua A, 1' }), { address: 'Rua A, 1', cadastroRapido: false });
eq('quem não é rápida não ganha a marca', camposAoSalvar(completa, { name: 'Lia M' }), { name: 'Lia M' });
eq('a rota de verdade deixa a rápida fora e a completada dentro',
  [blocosDaDirecao([rapida], 'ida').length, blocosDaDirecao([{ ...rapida, horaPega: '06:40', address: 'Rua A, 1', ...camposAoSalvar({ ...rapida, horaPega: '06:40' }, { address: 'Rua A, 1' }) }], 'ida').length],
  [0, 1]);
eq('a frase de fora da rota', [textoForaDaRota(1), textoForaDaRota(3)],
  ['1 criança fica fora da rota até ter rua e hora de pegar.', '3 crianças ficam fora da rota até ter rua e hora de pegar.']);

// ─────────────────────────────────────────────────────────────────────────
bloco('7. O catálogo: toda afirmação com origem');
/**
 * A LISTA FECHADA de funcionalidades que as frases da lista afirmam, cada uma
 * com o arquivo e o padrão que a prova.
 */
const FUNCIONALIDADES = {
  'crianca-so-com-nome': [['src/services/childrenService.js', /name: data\.name\?\.trim\(\) \|\| ''/]],
  'convite-enviado-no-toque': [['src/services/fatosDoNivelService.js', /conviteEnviadoEm: serverTimestamp\(\)/]],
  'declaracao-por-sessao': [['src/dominio/identidade/autorizacaoDeclarada.js', /const declaradaNestaSessao = new Set\(\)/]],
  'cadastro-rapido-fora-da-viagem': [['src/dominio/rota/horarios.js', /c\?\.cadastroRapido !== true/]],
  'numero-pela-familia': [['src/pages/pai/PrimeiroAcessoDoPai.jsx', /numeroPendente: false/]],
  'sem-valor-sem-mensalidade': [['functions/lib/billing.js', /if \(fee <= 0\) \{/]],
  'hora-pega-na-porta': [['src/components/children/ChildForm.jsx', /a hora que a perua encosta na porta/]],
  'aviso-de-horario': [['src/services/notificationsService.js', /type: 'schedule_changed'/]],
  'proposta-pela-entrada': [['src/dominio/escola/listaDaTurma.js', /export function proporHorasDePegar\(\{ criancas, escola, entrada \}\)/]],
  'a-completar-recalcula': [['src/dominio/escola/listaDaTurma.js', /export function gruposACompletar\(criancas\)/]],
  'tirar-da-turma': [
    ['src/services/accountService.js', /httpsCallable\(functions, 'desvincularResponsavel'\)/],
    ['functions/lib/desvincularResponsavel.js', /tx\.delete\(userRef\);\s*return \{ ok: true, conta: 'apagada' \}/],
    ['src/services/accountService.js', /contractAcceptedAt: null/],
    ['src/services/accountService.js', /await deleteChildPhoto\(childId\)/],
    ['src/services/childrenService.js', /if \('active' in updates\) \{/],
  ],
  'pagamentos-ficam': [['src/services/accountService.js', /O histórico de pagamentos da criança é PRESERVADO/]],
  // Sem número, o WhatsApp abre a escolha de contato.
  'link-sem-numero': [['src/components/children/InviteShare.jsx', /https:\/\/wa\.me\/\?text=/]],
  // O cache do Firestore deste app é só em memória: fechar o app perde a escrita pendente.
  'cache-em-memoria': [['src/firebase/config.js', /localCache: memoryLocalCache\(/]],
  'proposta-conferida': [['src/dominio/escola/listaDaTurma.js', /export function conferirProposta\(proposta, atuais\)/]],
};
const CONDICOES = {
  'mae-no-app': [['src/services/notificationsService.js', /if \(!parentUid\) return;/]],
};
const afirmacoes = todasAsAfirmacoesDaLista();
for (const a of afirmacoes) {
  eq(`"${a.id}" tem origem da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
  if (a.condicao) eq(`"${a.id}" tem condição da lista fechada`, Object.hasOwn(CONDICOES, a.condicao), true);
}
for (const [chave, provas] of [...Object.entries(FUNCIONALIDADES), ...Object.entries(CONDICOES)]) {
  for (const [arq, re] of provas) eq(`"${chave}" existe: ${arq}`, re.test(ler(arq)), true);
}
eq('nenhuma origem da lista ficou sem uso',
  Object.keys(FUNCIONALIDADES).filter((k) => !afirmacoes.some((a) => a.sustenta === k)), []);

const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FALSAS = [/cobra\w* por voce/, /automatic/, /pix chegou/, /sabe quando o pix/, /gratis/, /segur/, /recebeu/, /receberam/];
function reprova(texto) {
  const r = promessaProibida(texto);
  if (r) return `raiz proibida: ${r}`;
  const f = FALSAS.find((re) => re.test(semAcento(texto)));
  return f ? `promessa que o app não cumpre: ${f}` : null;
}
const rotulos = Object.entries(ROTULOS).map(([k, v]) => [k, typeof v === 'function' ? v('Ana') : v]);
for (const [id, texto] of [...afirmacoes.map((a) => [a.id, a.texto]), ...rotulos, ...Object.entries(GRUPO_A_COMPLETAR)]) {
  eq(`"${id}" está limpo`, reprova(texto), null);
}
// "Tirar da turma" é a exceção de tamanho: precisa dizer TUDO o que se perde
// (A2), e vai em linhas curtas — cada LINHA cabe em 80.
for (const a of afirmacoes.filter((x) => x.sustenta !== 'tirar-da-turma')) {
  eq(`"${a.id}" cabe em 100 caracteres (${a.texto.length})`, a.texto.length <= 100, true);
}
for (const l of textoDeTirar({ nome: 'Ana', temFamilia: true, temAceite: true, temFoto: true }).linhas) {
  eq(`linha do "tirar" cabe em 80 caracteres (${l.length})`, l.length <= 80, true);
}
for (const [id, t] of rotulos) eq(`rótulo "${id}" cabe em 45 caracteres`, t.length <= 45, true);
eq('número só vem por função (as afirmações fixas não têm dígito solto, exceto as de exemplo da régua)',
  afirmacoes.filter((a) => !['foraDaRota', 'esperandoSinal', 'jaTinhamHora'].includes(a.id) && /\d/.test(a.texto)).map((a) => a.id), []);
eq('sonda: a regra pega "recebeu" e "segurança"', [reprova('A família recebeu o convite'), reprova('Mais segurança')].every(Boolean), true);

// ─────────────────────────────────────────────────────────────────────────
bloco('7b. Tirar da turma diz TUDO o que se perde — conferido contra o serviço');
{
  const todos = textoDeTirar({ nome: 'Pedro Henrique', temFamilia: true, temAceite: true, temFoto: true });
  eq('com família, aceite e foto: palavra por palavra', todos.linhas, [
    'Pedro sai da turma e da rota.',
    'A conta da família no app é encerrada quando este é o único filho dela.',
    'As faltas marcadas, quem busca e os recados são apagados.',
    'O aceite do contrato é apagado.',
    'A foto é apagada.',
    'Não dá para voltar.',
  ]);
  eq('com irmão na turma: a conta da família continua (e diz por quê)',
    textoDeTirar({ nome: 'Ana', temFamilia: true, irmaoNaTurma: true }).linhas[1],
    'A família continua no app: ela tem outro filho na sua turma.');
  eq('sem família: não fala de conta', /conta/.test(textoDeTirar({ nome: 'Ana' }).corpo), false);
  eq('contrato só esperando aceite: diz que é retirado (e não "aceite apagado")',
    [/esperava aceite/.test(textoDeTirar({ nome: 'Ana', temContratoEsperando: true }).corpo),
      /aceite do contrato é apagado/.test(textoDeTirar({ nome: 'Ana', temContratoEsperando: true }).corpo)], [true, false]);
  eq('sem foto, não fala de foto (aviso genérico ninguém lê)', /foto/.test(textoDeTirar({ nome: 'Ana', temFamilia: true }).corpo), false);
  eq('nunca oferece Desfazer (não existe reativar)', /desfazer/i.test(JSON.stringify(todos)), false);
  eq('o irmão é achado pelo parentUid na turma (e a própria criança não conta)',
    [temIrmaoNaTurma({ id: 'a', parentUid: 'm' }, [{ id: 'a', parentUid: 'm' }, { id: 'b', parentUid: 'm' }]),
      temIrmaoNaTurma({ id: 'a', parentUid: 'm' }, [{ id: 'a', parentUid: 'm' }]),
      temIrmaoNaTurma({ id: 'a', parentUid: 'm' }, [{ id: 'a', parentUid: 'm' }, { id: 'b', parentUid: 'm', active: false }]),
      temIrmaoNaTurma({ id: 'a' }, [{ id: 'b' }])], [true, false, false, false]);

  /**
   * O QUE O SERVIÇO FAZ DE VERDADE. Cada operação que apaga ou zera dado em
   * `deactivateChildAndParent` precisa estar mapeada para um efeito, e cada
   * efeito precisa aparecer no texto completo. Uma operação nova no serviço
   * sem frase na tela reprova aqui — foi assim que A2 aconteceu.
   */
  const servico = ler('src/services/accountService.js');
  const corpoDe = (fonte) => {
    const i = fonte.indexOf('export async function deactivateChildAndParent');
    const fim = fonte.indexOf('\nexport ', i + 10);
    return semComentarios(fonte.slice(i, fim));
  };
  const EFEITOS = {
    turma: /sai da turma e da rota/,
    conta: /conta da família no app é encerrada/,
    faltas: /faltas marcadas/,
    quemBusca: /quem busca/,
    recados: /recados/,
    aceite: /aceite do contrato é apagado/,
    esperando: /esperava aceite/,
    foto: /foto é apagada/,
  };
  // Operação destrutiva → efeito. `null` = não apaga dado de ninguém, com o motivo.
  const OPERACOES = {
    'apaga:futureAbs': 'faltas',
    'apaga:altPickupsSnap.docs': 'quemBusca',
    'apaga:agendaSnap.docs': 'recados',
    'apaga:parentNotifs.docs': null, // lista sempre vazia: a limpeza não cabe no cliente (comentário no serviço)
    'zera:docs': null, // a mesma lista vazia (`parentNotifs = { docs: [] }`), não é campo da criança
    'chama:desvincularResponsavel': 'conta',
    'chama:deleteChildPhoto': 'foto',
    'zera:active': 'turma',
    'zera:parentUid': 'conta',
    'zera:altResponsibles': 'quemBusca',
    'zera:contractAcceptedAt': 'aceite',
    'zera:contractAcceptedByUid': 'aceite',
    'zera:contractAcceptedName': 'aceite',
    'zera:contractHash': 'aceite',
    'zera:contractUserAgent': 'aceite',
    'zera:contratoVigente': 'aceite',
    'zera:contractVersion': 'aceite',
    'zera:contratoAguardando': 'esperando',
    'zera:photoURL': 'foto',
  };
  const operacoesDe = (corpo) => {
    const ops = new Set();
    const lote = corpo.match(/deleteInBatches\(\[([\s\S]*?)\]\)/);
    for (const m of (lote?.[1] || '').matchAll(/\.\.\.([\w.]+)/g)) ops.add(`apaga:${m[1]}`);
    for (const m of corpo.matchAll(/httpsCallable\(functions, '(\w+)'\)/g)) ops.add(`chama:${m[1]}`);
    for (const m of corpo.matchAll(/\b(deleteChildPhoto|deleteDoc|deleteObject)\(/g)) ops.add(`chama:${m[1]}`);
    for (const m of corpo.matchAll(/(\w+): (null|false|\[\])\s*[,}]/g)) ops.add(`zera:${m[1]}`);
    return [...ops];
  };
  const naoMapeadas = (corpo) => operacoesDe(corpo).filter((o) => !Object.hasOwn(OPERACOES, o));
  const semFrase = (corpo, texto) =>
    operacoesDe(corpo).map((o) => OPERACOES[o]).filter((e) => e && !EFEITOS[e].test(texto));
  const corpo = corpoDe(servico);
  eq('o serviço tem as operações esperadas (a leitura achou o corpo)', operacoesDe(corpo).length >= 15, true);
  eq('toda operação que apaga ou zera dado está mapeada para um efeito', naoMapeadas(corpo), []);
  const completo = textoDeTirar({ nome: 'Ana', temFamilia: true, temAceite: true, temContratoEsperando: true, temFoto: true }).corpo;
  eq('todo efeito do serviço aparece no texto completo', semFrase(corpo, completo), []);
  eq('o servidor APAGA a conta da família de um filho só (a frase diz isso)',
    /if \(outros\.length === 0\) \{[\s\S]{0,120}tx\.delete\(userRef\)/.test(ler('functions/lib/desvincularResponsavel.js')), true);
  // MUTAÇÃO: uma operação nova no serviço, sem frase, reprova.
  const comNova = corpo.replace('altResponsibles: [],', 'altResponsibles: [],\n    contatosDaEscola: [],');
  eq('mutação: campo novo zerado no serviço sem frase na tela reprova', naoMapeadas(comNova).length > 0, true);
  // MUTAÇÃO: o texto que esquece os recados reprova.
  eq('mutação: texto sem "recados" reprova', semFrase(corpo, completo.replace('recados', 'avisos')).includes('recados'), true);
  // E a tela usa o texto completo, com os dados que tem.
  const tela = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
  eq('a tela passa o irmão, o aceite (inclusive o vigente) e a versão esperando',
    /irmaoNaTurma: temIrmaoNaTurma\(tirarDe, children\)/.test(tela) &&
      /temAceite: !!\(tirarDe\.contractAcceptedAt \|\| tirarDe\.contratoVigente\)/.test(tela) &&
      /temContratoEsperando: tirarDe\.contratoAguardando != null/.test(tela), true);
  eq('a tela mostra TODAS as linhas', /textoTirar\.linhas\.map\(/.test(tela), true);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('7c. O toque duplo no "Tirar da turma"');
{
  eq('toque nos primeiros 400 ms é ignorado; depois, vale', [toqueCedoDemais(1000, 1399), toqueCedoDemais(1000, 1400), toqueCedoDemais(null, 5)], [true, false, false]);
  const dialogo = semComentarios(ler('src/components/common/ConfirmDialog.jsx'));
  const tela = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
  const PROVA = {
    'o diálogo ignora o toque cedo no confirmar': (t) =>
      /if \(ignorarToquesMs && toqueCedoDemais\(abertoEm\.current, Date\.now\(\), ignorarToquesMs\)\) return;/.test(t) &&
      /onClick=\{confirmar\}/.test(t),
    'o "Tirar da turma" liga a guarda de 400 ms': (t) => /ignorarToquesMs=\{400\}/.test(t),
    'tirar() não roda duas vezes (ref antes do await)': (t) =>
      /if \(!tirarDe \|\| tirandoAgora\.current\) return;\s*tirandoAgora\.current = true;/.test(t),
  };
  eq('diálogo: guarda presente', PROVA['o diálogo ignora o toque cedo no confirmar'](dialogo), true);
  eq('tela: guarda de 400 ms', PROVA['o "Tirar da turma" liga a guarda de 400 ms'](tela), true);
  eq('tela: ref contra o duplo confirmar', PROVA['tirar() não roda duas vezes (ref antes do await)'](tela), true);
  eq('mutação: diálogo chamando onConfirm direto reprova',
    PROVA['o diálogo ignora o toque cedo no confirmar'](dialogo.replace('onClick={confirmar}', 'onClick={onConfirm}')), false);
  eq('mutação: sem a guarda de 400 ms reprova', PROVA['o "Tirar da turma" liga a guarda de 400 ms'](tela.replace('ignorarToquesMs={400}', '')), false);
  // Só a TELA tira, e só pelo diálogo: a linha não chama o serviço.
  const quemTira = arquivosDe('src').filter((f) => /\bdeactivateChildAndParent\(/.test(semComentarios(ler(f))) && f !== 'src/services/accountService.js');
  eq('quem chama deactivateChildAndParent: a ficha e a lista, mais ninguém', quemTira.sort(), ['src/pages/ChildDetail.jsx', 'src/pages/tio/TioChildren.jsx']);
  const soPeloDialogo = (t) => {
    const chamadas = [...t.matchAll(/deactivateChildAndParent\(/g)].length;
    const dentroDeTirar = /const tirar = async \(\) => \{[\s\S]*?await deactivateChildAndParent\(\{ childId: tirarDe\.id \}\)/.test(t);
    return chamadas === 1 && dentroDeTirar && /onConfirm=\{tirar\}/.test(t) && (t.match(/\btirar\b(?!\w)/g) || []).filter((x) => x).length >= 2 && !/onTirar=\{\(\) => tirar\(/.test(t);
  };
  eq('na lista, só o confirmar do diálogo tira', soPeloDialogo(tela), true);
  eq('mutação: a linha tirando direto (sem diálogo) reprova',
    soPeloDialogo(tela.replace('onTirar={() => setTirarDe(child)}', 'onTirar={() => deactivateChildAndParent({ childId: child.id })}')), false);
  const linhaFonte = semComentarios(ler('src/components/children/LinhaDaTurma.jsx'));
  eq('a linha não conhece o serviço de conta', /accountService|deactivateChildAndParent/.test(linhaFonte), false);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('8. As telas usam a régua e o catálogo');
const lista = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
const share = semComentarios(ler('src/components/children/InviteShare.jsx'));
const enxuto = share.slice(share.indexOf('export function ConviteEnxuto'));
eq('a lista conta pelo resumoDosConvites', /resumoDosConvites\(children, agora, tocados\)/.test(lista), true);
eq('o botão do topo usa a próxima da fila', /proximaParaConvidar\(children, agora, ultimoConvidado, tocados\)/.test(lista), true);
eq('o contador sai do catálogo', /contadorDeFamilias\(convites\.entraram, convites\.total\)/.test(lista), true);
const linha = semComentarios(ler('src/components/children/LinhaDaTurma.jsx'));
eq('cada linha tem o convite enxuto', /<ConviteEnxuto\s+crianca=\{child\}/.test(linha), true);
eq('o convite enxuto decide pelo estadoDoConvite', /estadoDoConvite\(crianca, agora, tocou\)/.test(enxuto), true);
eq('o convite enxuto grava conviteEnviadoEm no toque', /const tocar = \(\) => \{\s*marcarConviteEnviado\(crianca\.id\)/.test(enxuto), true);
eq('as três caras: Convidar, Enviado/Mandar de novo, Entrou',
  ['ROTULOS.convidar', 'ROTULOS.enviado', 'ROTULOS.mandarDeNovo', 'ROTULOS.entrou'].every((r) => enxuto.includes(r)), true);
eq('o link vencido pede link novo antes', /estado === CONVITE\.VENCIDO[\s\S]{0,200}gerarLinkNovo\(crianca\.id\)/.test(enxuto), true);
eq('a trava dos dados do contrato vale no convite enxuto', /if \(faltaContrato\) \{/.test(enxuto), true);
eq('o "agora" acerta ao voltar ao primeiro plano (lista, Início e convite)',
  /const agora = useAgoraAoVoltar\(\);/.test(lista) &&
    /const agoraDoConvite = useAgoraAoVoltar\(\);/.test(semComentarios(ler('src/pages/tio/TioDashboard.jsx'))) &&
    /useAgoraAoVoltar\(\)/.test(enxuto) && !/useState\(\(\) => Date\.now\(\)\)/.test(lista + enxuto), true);
eq('o Turma (contratos) também mostra o link de quem é cadastroRapido, como a lista',
  /linkDoConvite: c\.inviteStatus === 'pending' && c\.inviteCode \? inviteUrl/.test(semComentarios(ler('src/pages/tio/TioTurma.jsx'))), true);

// ─────────────────────────────────────────────────────────────────────────
bloco('8b. M5: sem o número, uma confirmação com o nome COMPLETO antes do WhatsApp');
{
  eq('a frase da confirmação, com o nome completo',
    confirmacaoSemNumero('Ana  Clara Souza'), 'Vai para a família de Ana Clara Souza. Escolha o contato certo.');
  eq('sem nome não deixa buraco', /undefined|null|de \./.test(confirmacaoSemNumero('')), false);
  const PROVA = (t) => {
    const f = t.indexOf('const linkOuConfirmacao');
    if (f < 0) return false;
    const trecho = t.slice(f, f + 600);
    return /comNumero \?\s*\(\s*<a href=\{waHref\}[\s\S]*?onClick=\{tocar\}/.test(trecho) &&
      /:\s*\(\s*<button type="button" onClick=\{\(\) => setConfirmando\(true\)\}/.test(trecho) &&
      /confirmacaoSemNumero\(crianca\.name\)/.test(t) &&
      // nenhum <a> do WhatsApp fora da confirmação e do caminho com número
      (t.match(/data-convite-whatsapp/g) || []).length === 2;
  };
  eq('com número segue direto; sem número abre a confirmação', PROVA(enxuto), true);
  eq('mutação: sem número abrindo o WhatsApp direto reprova',
    PROVA(enxuto.replace('comNumero ? (', 'true ? (')), false);
  eq('mutação: a confirmação sem o nome reprova', PROVA(enxuto.replace('confirmacaoSemNumero(crianca.name)', "''")), false);
  eq('número incompleto conta como sem número (não abre conversa que não existe)',
    /linkDoWhatsApp\(\s*comNumero \? crianca\.parentPhone : ''/.test(enxuto) && /const comNumero = temTelefone\(crianca\);/.test(enxuto), true);
  eq('a MENSAGEM do convite não mudou (decisão do dono): continua mensagemDoConvite com o primeiro nome',
    /mensagemDoConvite\(\{ marca: profile\?\.marcaNome, nomeCrianca: firstName, generoCrianca: crianca\.gender, url \}\)/.test(enxuto), true);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('9. A lista como superfície de trabalho (leitura de arquivo)');
const servico = semComentarios(ler('src/services/listaDaTurmaService.js'));
const hook = semComentarios(ler('src/hooks/useSalvarNaLista.js'));
const campos = semComentarios(ler('src/components/children/CamposDaLinha.jsx'));
const rua = semComentarios(ler('src/components/children/CampoDaRua.jsx'));
const cabecalho = semComentarios(ler('src/components/children/CabecalhoDaEscola.jsx'));
const adicionar = semComentarios(ler('src/components/children/AdicionarCrianca.jsx'));
const completar = semComentarios(ler('src/components/children/ACompletar.jsx'));
const form = semComentarios(ler('src/components/children/ChildForm.jsx'));

eq('o serviço grava pelo updateChild, com o fim do cadastroRapido no mesmo write (e sem som por campo)',
  /await updateChild\(crianca\.id, camposAoSalvar\(crianca, m\), \{ silencioso: true \}\)/.test(servico), true);
const GRAVACOES = [
  ["salvar('nome', { name: v }, { digitado })", 'nome'],
  ["salvar('genero', { gender: v })", 'menino ou menina'],
  ["salvar('escola', camposDaEscola(e))", 'escola'],
  ["salvar('hora', { horaPega: v }, { digitado })", 'hora de pegar'],
  ["salvar('mae', { parentName: v }, { digitado })", 'nome da mãe'],
  ["salvar('fone', { parentPhone: v }, { digitado })", 'WhatsApp da mãe'],
  ["salvar('mensalidade', { monthlyFee: n }, { digitado, executar: (c) => salvarMensalidadeNaLista(c, n, admin.current) })", 'mensalidade'],
];
for (const [trecho, nome] of GRAVACOES) eq(`a linha grava ${nome} sozinho`, linha.includes(trecho), true);
eq('a rua grava ao assentar (com número ou "não sei"), com numeroPendente e as partes',
  /salvar\('rua', \{[\s\S]*?numeroPendente: false/.test(rua) && /salvar\('rua', \{[\s\S]*?numeroPendente: true,\s*enderecoPartes:/.test(rua), true);
eq('nenhum botão "Salvar" na linha', /['>]\s*Salvar\s*['<]/.test(linha + campos + rua), false);
eq('o campo grava ao sair (onBlur), não a cada tecla', /onBlur=\{sair\}/.test(campos) && !/onChange=\{[^}]*onSalvar/.test(campos), true);
eq('o campo NÃO é remontado pelo valor do banco (key com o valor salvo apagava o digitado)',
  /key=\{`(nome|hora|mae|fone|fee):/.test(linha), false);
eq('a hora de pegar avisa a família depois de gravar, só se mudou',
  /await updateChild[\s\S]*?if \(antes !== mudanca\.horaPega\)[\s\S]*?notifyScheduleChanged/.test(servico), true);
eq('nada de dado de criança no console (só o código do erro)',
  [hook, adicionar, lista, linha].every((f) => !/console\.(log|error|warn)\([^)]*(crianca|child|nome|name)[^)]*\)/.test(f.replace(/err\?\.code/g, ''))), true);
eq('a linha abre no lugar (nunca navega)', /aria-expanded=\{aberta\}/.test(linha) && !/navigate\(/.test(linha), true);
eq('o estado de salvar mora na TELA (um salvador), não na linha',
  /const salvador = useSalvadorDaLista\(\);/.test(lista) && /useSalvarNaLista\(child, salvador\)/.test(linha) &&
    /useSalvarNaLista\(crianca, salvador\)/.test(completar) && !/useState\(\{\}\)/.test(hook), true);
eq('a faixa "esperando sinal" no topo', /semSinal > 0 &&[\s\S]{0,300}textoEsperandoSinal\(semSinal\)/.test(lista), true);
eq('a linha fechada diz quando há escrita esperando sinal', /salvador\.esperandoSinal\(`\$\{child\.id\}:`\)/.test(linha), true);
eq('um som por rajada: as escritas são silenciosas e o salvador toca no fim',
  /aoTerminarRajada: somDeSalvo/.test(hook) &&
    /updateEscola\(escolaId, \{ horaEntrada: horaEntrada \|\| '' \}, \{ silencioso: true \}\)/.test(servico) &&
    /if \(!silencioso\) playSound\('salvo'\)/.test(ler('src/services/childrenService.js')) &&
    /if \(!silencioso\) playSound\('salvo'\)/.test(ler('src/services/escolasService.js')), true);

// "+ Nome" passa pela declaração, uma vez, e cria fora da rota.
eq('"+ Nome": só lembra da declaração DEPOIS de salvar', adicionar.indexOf('declaracao.lembrar()') > adicionar.indexOf('addChild('), true);
eq('"+ Nome": nasce cadastroRapido (fora da rota), com a declaração que a caixa diz — nunca um `true` à mão',
  /autorizacaoDeclarada: declaracao\.jaDeclarou \|\| declaracao\.marcada,\s*cadastroRapido: true/.test(adicionar) &&
    !/autorizacaoDeclarada: true/.test(adicionar) &&
    !/autorizacaoDeclarada: true/.test(semComentarios(ler('src/components/children/CadastroRapidoDaCrianca.jsx'))), true);
eq('"+ Nome": a caixa aparece só quando ainda não declarou na sessão',
  /declaracao\.jaDeclarou \? \(\s*<DeclaracaoJaFeita \/>/.test(adicionar), true);
eq('"+ Nome": o valor sobe acima do teclado ao focar', /blocoDoValor\.current\?\.scrollIntoView\?\.\(/.test(adicionar), true);

// A caixa "a completar".
eq('a caixa usa a régua gruposACompletar', /gruposACompletar\(criancas\)/.test(completar), true);
eq('um campo por vez, com progresso e pular',
  /progressoDaFila\(pos \+ 1, ids\.length\)/.test(completar) && /ROTULOS\.pularEProxima/.test(completar), true);
eq('a fila de "sem valor" diz por quê', /SEM_VALOR\.texto/.test(completar), true);
eq('"fora da rota" virou um grupo da folha', /textoForaDaRota\(fora\.length\)/.test(completar), true);

// Tirar da turma: a verdade, sem desfazer.
eq('tirar não oferece Desfazer', /Desfazer/.test(lista + linha), false);

// ─────────────────────────────────────────────────────────────────────────
bloco('10. O cadastro completo: telefone opcional, herança e declaração da sessão');
eq('o WhatsApp da mãe é opcional (o formato continua cobrado quando há)',
  /if \(String\(form\.parentPhone \|\| ''\)\.trim\(\) && !isValidPhone\(form\.parentPhone\)\)/.test(form), true);
eq('a exigência antiga não voltou', /if \(!isValidPhone\(form\.parentPhone\)\)/.test(form), false);
eq('"Cadastrar outra criança" herda valor e vencimento',
  /const cadastrarOutra = \(\) => \{[\s\S]*?monthlyFee: form\.monthlyFee,\s*dueDay: form\.dueDay,/.test(form), true);
eq('quem já declarou na sessão não é perguntado de novo no formulário',
  /jaDeclarouNestaSessao\(user\?\.uid\)/.test(form) && /jaDeclarou \? \(\s*<DeclaracaoJaFeita \/>/.test(form), true);
eq('o formulário lembra a declaração só depois de salvar',
  form.indexOf('lembrarDaDeclaracao(user?.uid)') > form.indexOf('await addChild(payload)'), true);

// ─────────────────────────────────────────────────────────────────────────
bloco('11. Valor zero não: a mensalidade é obrigatória no cadastro (decisão do dono)');
{
  // A régua é UMA só, a da RC1 (`valorDaMensalidade.js`, testada por
  // testar:valor-da-mensalidade). Aqui só se confere que a Lista a usa.
  const FALTA_VALOR = ['', null, undefined, 0, '0', '0.00', -10, 'abc', NaN];
  const TEM_VALOR = [0.01, '350.00', 350, '3.50', '350,00'];
  eq('vazio, zero, negativo e lixo: falta o valor', FALTA_VALOR.map(valorDoCampoFalta), FALTA_VALOR.map(() => true));
  eq('qualquer valor acima de zero passa (com vírgula também)', TEM_VALOR.map(valorDoCampoFalta), TEM_VALOR.map(() => false));
  const regua = semComentarios(ler('src/dominio/escola/listaDaTurma.js'));
  eq('a Lista não tem régua própria de valor (uma régua só)', /valorObrigatorioNoCadastro/.test(regua), false);
  eq('"sem valor" da caixa delega para a régua da cobrança', /return valorDaMensalidadeFalta\(crianca\);/.test(regua), true);
  eq('a caixa "A completar" usa a régua e a frase do catálogo', /valorDoCampoFalta\(valor\)\) return setErro\(DIGA_O_VALOR\)/.test(completar), true);

  const telaLista = lista;
  eq('"+ Nome": e diz "Diga o valor da mensalidade."', /setErroValor\(ROTULOS\.erroSemValor\)/.test(adicionar) && ROTULOS.erroSemValor === 'Diga o valor da mensalidade.', true);
  eq('"+ Nome": grava o valor e o vencimento na criança', /monthlyFee: Number\(valor\),\s*dueDay,/.test(adicionar), true);
  eq('"+ Nome": já vem com o valor da anterior', /useState\(valorAnterior\)/.test(adicionar) && /<AdicionarCrianca escola=\{ultimaEscola\} anterior=\{anterior\} \/>/.test(telaLista), true);
  eq('"+ Nome": a anterior é a última criada COM valor (valor e vencimento)',
    /Number\(c\.monthlyFee\) > 0\)[\s\S]{0,120}emMs\(b\.createdAt\) - emMs\(a\.createdAt\)[\s\S]{0,140}dueDay: comValor\[0\]\.dueDay/.test(telaLista), true);
  eq('"+ Nome": o valor em letra grande antes do OK (R$ formatado)', /formatCurrency\(Number\(valor\)\)/.test(adicionar) && /<CampoDeValor/.test(adicionar), true);

  const card = semComentarios(ler('src/components/children/CadastroRapidoDaCrianca.jsx'));
  eq('card do primeiro acesso: o valor é obrigatório (antes do addChild)',
    card.indexOf('valorDoCampoFalta(form.monthlyFee)') > -1 &&
      card.indexOf('valorDoCampoFalta(form.monthlyFee)') < card.indexOf('addChild('), true);
  eq('card do primeiro acesso: grava o valor', /monthlyFee: Number\(form\.monthlyFee\)/.test(card), true);

  const vagaComComentario = ler('src/components/perua/FolhaDaVagaRapida.jsx');
  const vaga = semComentarios(vagaComComentario);
  eq('a vaga rápida é ISENTA, e diz por quê', /ISENTA DO VALOR OBRIGATÓRIO/.test(vagaComComentario) && /não é contrato nem\s*\* matrícula/.test(vagaComComentario), true);
  eq('a vaga rápida não pede valor (nem a régua, nem o campo)', !/valorDoCampoFalta|CampoDeValor|monthlyFee/.test(vaga), true);

  eq('formulário completo: o passo 4 exige o valor', /if \(valorDoCampoFalta\(form\.monthlyFee\)\) errs\.monthlyFee = DIGA_O_VALOR;/.test(form), true);
  eq('a linha aberta não grava zero (usa a régua)', /if \(valorDoCampoFalta\(valor\)\) \{\s*setErro\(ROTULOS\.erroSemValor\);\s*return;/.test(linha), true);
  eq('o grupo "sem valor" diz que é cadastro antigo ou rascunho', /Cadastro antigo ou salvo para completar depois/.test(SEM_VALOR.texto), true);
  eq('o convite da lista espera o valor (como o InviteShare): sem valor, "Pôr o valor"',
    /if \(valorDaMensalidadeFalta\(crianca\)\) \{[\s\S]{0,200}onPedirValor\?\.\(crianca\.id\)/.test(enxuto), true);

  // O selo Entrou ✓ é montado por TioChildren (TioChildren → LinhaDaTurma → ConviteEnxuto).
  eq('Entrou ✓ montado por TioChildren', /<LinhaDaTurma\b/.test(telaLista) && /<ConviteEnxuto\s+crianca=\{child\}/.test(linha) && /ROTULOS\.entrou/.test(enxuto), true);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('12. O salvador por campo (máquina pura, com serviço falso)');
/**
 * COMPORTAMENTO, não texto: um serviço falso que resolve, rejeita e responde
 * FORA DE ORDEM, e um relógio falso. A mesma bateria roda contra a máquina de
 * verdade e contra MUTANTES dela (o arquivo com uma linha arrancada): cada
 * mutante precisa reprovar em pelo menos um caso.
 */
function adiada() {
  let resolver;
  let rejeitar;
  const promessa = new Promise((r, j) => {
    resolver = r;
    rejeitar = j;
  });
  return { promessa, resolver, rejeitar };
}
const tique = () => new Promise((r) => setTimeout(r, 0));
async function bateriaDoSalvador(criar, FASE) {
  const casos = [];
  const caso = (nome, ok) => casos.push([nome, !!ok]);
  const timers = [];
  const relogio = { agendar: (fn) => timers.push(fn) - 1, cancelar: (i) => { timers[i] = null; } };
  let sons = 0;
  const s = criar({ ...relogio, esperaMs: 6000, aoTerminarRajada: () => { sons += 1; } });

  // Resolve → salvo; rejeita → erro (com a mudança e o digitado guardados).
  const a = adiada();
  const pa = s.salvar('c1:nome', () => a.promessa, { mudanca: { name: 'Ana' }, digitado: 'Ana' });
  caso('saiu: salvando', s.ler('c1:nome')?.fase === FASE.SALVANDO);
  a.resolver();
  caso('servidor confirmou: salvo', (await pa) === true && s.ler('c1:nome')?.fase === FASE.SALVO);
  const b = adiada();
  const pb = s.salvar('c1:hora', () => b.promessa, { mudanca: { horaPega: '06:40' }, digitado: '06:40' });
  b.rejeitar({ code: 'permission-denied' });
  const eb = (await pb, s.ler('c1:hora'));
  caso('recusou: erro, nunca salvo', eb?.fase === FASE.ERRO);
  caso('o erro guarda o que ele digitou', eb?.digitado === '06:40');

  // Tentar de novo reenvia a MESMA escrita.
  let reenvios = 0;
  const c = adiada();
  s.salvar('c1:mae', () => { reenvios += 1; return reenvios === 1 ? Promise.reject(new Error('x')) : c.promessa; }, { mudanca: { parentName: 'Rita' } });
  await tique();
  const pc = s.tentarDeNovo('c1:mae');
  c.resolver();
  caso('"Tentar de novo" reenvia e acende salvo', (await pc) === true && reenvios === 2 && s.ler('c1:mae')?.fase === FASE.SALVO);

  // FORA DE ORDEM: a velha responde depois da nova.
  const v1 = adiada();
  const v2 = adiada();
  s.salvar('c2:nome', () => v1.promessa);
  s.salvar('c2:nome', () => v2.promessa);
  v1.resolver();
  await tique();
  caso('a resposta da velha NÃO acende salvo com a nova pendente', s.ler('c2:nome')?.fase === FASE.SALVANDO);
  v2.rejeitar(new Error('x'));
  await tique();
  caso('a nova falhou: erro (a velha não salva por ela)', s.ler('c2:nome')?.fase === FASE.ERRO);
  const w1 = adiada();
  const w2 = adiada();
  s.salvar('c3:nome', () => w1.promessa);
  s.salvar('c3:nome', () => w2.promessa);
  w2.resolver();
  await tique();
  w1.rejeitar(new Error('atrasada'));
  await tique();
  caso('o erro atrasado da velha não apaga o salvo da nova', s.ler('c3:nome')?.fase === FASE.SALVO);

  // Sem sinal: passa o tempo e vira "esperando"; a faixa conta.
  const semSinal = adiada();
  s.salvar('c4:rua', () => semSinal.promessa);
  timers.forEach((fn) => fn && fn());
  caso('sem resposta no prazo: esperando sinal', s.ler('c4:rua')?.fase === FASE.ESPERANDO);
  caso('a faixa conta quem espera sinal', s.esperandoSinal() === 1 && s.esperandoSinal('c4:') === 1 && s.esperandoSinal('c1:') === 0);
  semSinal.resolver();
  await tique();
  caso('o sinal voltou: salvo', s.ler('c4:rua')?.fase === FASE.SALVO && s.esperandoSinal() === 0);

  // Um som por rajada.
  const antes = sons;
  const r1 = adiada();
  const r2 = adiada();
  const r3 = adiada();
  s.salvar('c5:a', () => r1.promessa);
  s.salvar('c5:b', () => r2.promessa);
  s.salvar('c5:c', () => r3.promessa);
  r1.resolver();
  r2.resolver();
  await tique();
  caso('nada de som com escrita ainda pendente', sons === antes);
  r3.resolver();
  await tique();
  caso('três campos seguidos: UM som', sons === antes + 1);
  const r4 = adiada();
  s.salvar('c5:d', () => r4.promessa);
  r4.rejeitar(new Error('x'));
  await tique();
  caso('rajada que só falhou: sem som', sons === antes + 1);

  // Quem escuta é avisado.
  let avisos = 0;
  const parar = s.assinar(() => { avisos += 1; });
  const z = adiada();
  s.salvar('c6:x', () => z.promessa);
  z.resolver();
  await tique();
  parar();
  caso('quem escuta é avisado', avisos >= 2);
  return casos;
}
{
  const real = await bateriaDoSalvador(criarSalvadorPorCampo, FASE);
  for (const [nome, ok] of real) eq(nome, ok, true);

  // MUTANTES do arquivo de verdade.
  const fonte = ler('src/compartilhado/salvarPorCampo.js');
  const MUTANTES = [
    ['"salvo" no lugar do erro (o salvo vai para o catch)', (t) => t.replace('if (ok) {', 'if (true) {')],
    ['sem a conta de versão (a resposta velha muda a fase)', (t) => t.replace('if (!e || e.versao !== versao) return;', 'if (!e) return;')],
    ['sem o prazo de "esperando sinal"', (t) => t.replace('atual.fase = FASE.ESPERANDO;', '')],
    ['som a cada campo', (t) => t.replace('if (pendentes() === 0) {', 'if (true) {')],
    ['o erro não guarda o digitado', (t) => t.replace('const e = { versao, fase: FASE.SALVANDO, mudanca, executar, digitado, timer: null };', 'const e = { versao, fase: FASE.SALVANDO, mudanca, executar, timer: null };')],
  ];
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'mutante-salvador-'));
  try {
    let n = 0;
    for (const [nome, estragar] of MUTANTES) {
      const estragado = estragar(fonte);
      eq(`o mutante existe (${nome})`, estragado !== fonte, true);
      const arq = path.join(pasta, `m${n++}.mjs`);
      fs.writeFileSync(arq, estragado);
      const m = await import(pathToFileURL(arq).href);
      const r = await bateriaDoSalvador(m.criarSalvadorPorCampo, m.FASE);
      eq(`  e a bateria reprova o mutante`, r.some(([, ok]) => !ok), true);
    }
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────
bloco('13. O "OK" do "+ Nome": declaração, valor e toque duplo');
{
  const ok = (x) => decidirOkDoNome({ nome: 'Ana', valor: '350.00', declarou: true, ocupado: false, ...x });
  eq('tudo certo: cria', ok({}), 'criar');
  eq('sem nome: ignora', ok({ nome: '   ' }), 'ignorar');
  eq('toque já em curso: ignora (o duplo toque não cria duas)', ok({ ocupado: true }), 'ignorar');
  eq('sem declaração: pede a declaração (nada é criado)', ok({ declarou: false }), 'declaracao');
  eq('sem valor: pede o valor', ok({ valor: '' }), 'valor');
  eq('a declaração vem antes do valor', ok({ declarou: false, valor: '' }), 'declaracao');

  /** O componente obedece à decisão: cada passo que não é "criar" RETORNA antes do addChild. */
  const obedece = (t) => {
    const i = t.indexOf('const adicionar = async');
    const fim = t.indexOf('addChild(', i);
    if (i < 0 || fim < 0) return false;
    const antes = t.slice(i, fim);
    return /const passo = decidirOkDoNome\(\{[\s\S]*?declarou: declaracao\.jaDeclarou \|\| declaracao\.marcada,\s*ocupado: emCurso\.current,\s*\}\);/.test(antes) &&
      /if \(passo === 'ignorar'\) return;/.test(antes) &&
      /if \(passo === 'declaracao'\) \{\s*declaracao\.confirmar\(\);\s*return;\s*\}/.test(antes) &&
      /if \(passo === 'valor'\) \{\s*setErroValor\(ROTULOS\.erroSemValor\);\s*return;\s*\}/.test(antes) &&
      /emCurso\.current = true;/.test(antes) &&
      /finally \{\s*emCurso\.current = false;/.test(t);
  };
  eq('o componente obedece (lido do arquivo)', obedece(adicionar), true);
  const ESTRAGOS = [
    ['sem o return depois da declaração', (t) => t.replace("declaracao.confirmar();\n      return;", 'declaracao.confirmar();')],
    ['sem o return depois do erro de valor', (t) => t.replace('setErroValor(ROTULOS.erroSemValor);\n      return;', 'setErroValor(ROTULOS.erroSemValor);')],
    ['sem a guarda do toque duplo', (t) => t.replace('ocupado: emCurso.current,', 'ocupado: false,')],
    ['sem fechar a guarda antes do await', (t) => t.replace('emCurso.current = true;', '')],
    ['ignorando o "ignorar"', (t) => t.replace("if (passo === 'ignorar') return;", '')],
  ];
  for (const [nome, estragar] of ESTRAGOS) {
    const e = estragar(adicionar);
    eq(`o estrago existe (${nome})`, e !== adicionar, true);
    eq('  e a prova reprova', obedece(e), false);
  }
}

// ─────────────────────────────────────────────────────────────────────────
bloco('14. M1: a mensalidade só trava com o contrato ASSINADO');
{
  eq('trava: vigente ou aceito; não trava: só esperando aceite',
    [mensalidadeTravada({ contratoVigente: { numero: 1 } }), mensalidadeTravada({ contractAcceptedAt: 1 }),
      mensalidadeTravada({ contratoAguardando: 2 }), mensalidadeTravada({})], [true, true, false, false]);
  eq('"Confira" abaixo de R$ 30, sem bloquear',
    [valorParaConferir('3.50'), valorParaConferir('29.99'), valorParaConferir('30'), valorParaConferir(''), valorParaConferir('350,00')],
    [true, true, false, false, false]);
  eq('o "Confira" diz o valor', confiraOValor('R$ 3,50'), 'R$ 3,50? Confira.');
  const PROVA = (t) => /const travada = mensalidadeTravada\(child\);/.test(t) && /\{travada \? \(/.test(t) &&
    !/contratoAguardando/.test(t.slice(t.indexOf('function CorpoDaLinha'), t.indexOf('function CampoDaMensalidade')));
  eq('a linha trava só pela régua', PROVA(linha), true);
  eq('mutação: voltar a travar com a versão esperando reprova',
    PROVA(linha.replace('const travada = mensalidadeTravada(child);', 'const travada = mensalidadeTravada(child) || child.contratoAguardando != null;')), false);
  eq('a caixa "A completar" usa a mesma régua', /const contratoFeito = mensalidadeTravada\(crianca\);/.test(completar), true);
  eq('o "Confira" aparece no campo da linha', /valorParaConferir\(valor\) &&[\s\S]{0,160}confiraOValor\(/.test(linha), true);
  const contratos = semComentarios(ler('src/services/contratosDaFamiliaService.js'));
  eq('antes do aceite: com versão esperando passa por salvarCombinado; sem versão, grava direto',
    /if \(child\?\.contratoAguardando == null\) return 'sem-contrato';\s*return salvarCombinado\(/.test(contratos) &&
      /if \(r === 'sem-contrato'\) await salvarCampoDaLista\(crianca, \{ monthlyFee: valor \}\)/.test(servico), true);
  eq('depois do aceite o serviço recusa (a ficha faz o aditivo)',
    /if \(child\?\.contratoVigente \|\| child\?\.contractAcceptedAt\) throw/.test(contratos), true);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('15. M2: o contrato nasce no "Convidar", e a lista não abre escuta por linha');
{
  // As peças que a lista renderiza POR CRIANÇA (ou por escola) não podem
  // abrir escuta: era uma escuta de contratos por linha, mais uma da barra.
  const PECAS = [
    'src/components/children/LinhaDaTurma.jsx',
    'src/components/children/CabecalhoDaEscola.jsx',
    'src/components/children/ACompletar.jsx',
    'src/components/children/CamposDaLinha.jsx',
    'src/components/children/CampoDaRua.jsx',
  ];
  const ESCUTA = /\b(useContratos|useGarantirContrato|useChild|useChildren|watch\w+|onSnapshot)\(/;
  const comEscuta = (t) => ESCUTA.test(t);
  for (const f of PECAS) eq(`sem escuta: ${f}`, comEscuta(semComentarios(ler(f))), false);
  eq('sem escuta: ConviteEnxuto', comEscuta(enxuto), false);
  const comEscutaDeVolta = enxuto.replace('const { profile } = useAuth();', 'const { profile } = useAuth();\n  const { contratos } = useContratos(crianca);');
  eq('o estrago existe (escuta de contratos de volta ao ConviteEnxuto)', comEscutaDeVolta !== enxuto, true);
  eq('  e a prova reprova (acha a escuta)', comEscuta(comEscutaDeVolta), true);
  eq('o toque garante o contrato (uma leitura, do servidor)',
    /const tocar = \(\) => \{[\s\S]{0,200}garantirContratoAoConvidar\(\{ child: crianca, admin: profile \}\)/.test(enxuto), true);
  const contratos = semComentarios(ler('src/services/contratosDaFamiliaService.js'));
  eq('a leitura é do SERVIDOR (cache vazio emitiria a versão 1 por cima) e de UMA versão',
    /getDocsFromServer\(\s*query\(collection\(db, 'children', childId, 'contratos'\), orderBy\('numero', 'desc'\), limit\(1\)\)/.test(contratos), true);
  eq('ao fechar a linha, UMA conferência da versão esperando (só se gravou algo)',
    /if \(!mexeu\.current\) return;[\s\S]{0,160}atualizarContratoEsperando\(/.test(linha), true);
  eq('a conferência ao fechar não emite a PRIMEIRA versão (só com versão esperando)',
    /if \(!child\?\.id \|\| child\.contratoAguardando == null \|\| child\.contratoVigente\) return null;/.test(contratos), true);
  const PONTOS = arquivosDe('src').filter((f) => /garantirContratoAoConvidar\(\{/.test(semComentarios(ler(f))) && !f.includes('contratosDaFamiliaService'));
  eq('um ponto só na lista garante o contrato no toque', PONTOS, ['src/components/children/InviteShare.jsx']);
  eq('nenhum GarantirContratoDe sobrou', /GarantirContratoDe/.test(share), false);

  /**
   * AS ESCUTAS DA TELA, CONTADAS (o número do relatório). Antes: useChildren +
   * useEscolas + uma de contratos por criança com valor que não entrou + a
   * da barra do topo. Agora: as duas da tela, e nenhuma por linha.
   */
  const antes = (n) => 2 + n + 1;
  const depois = () => 2;
  eq('escutas com 15 crianças: 18 antes, 2 depois', [antes(15), depois()], [18, 2]);
  eq('escutas com 30 crianças: 33 antes, 2 depois', [antes(30), depois()], [33, 2]);
  eq('a tela abre exatamente as duas', [/useChildren\(\)/.test(lista), /useEscolas\(\)/.test(lista),
    [...lista.matchAll(/\b(useContratos|useGarantirContrato|useChild|watch\w+|onSnapshot)\(/g)].length], [true, true, 0]);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('16. M3: a proposta sai da entrada digitada e não some ao salvar');
{
  eq('o cabeçalho tem key só do grupo (sem a entrada)', /<CabecalhoDaEscola key=\{g\.chave\}/.test(lista) && !/key=\{`\$\{g\.chave\}:/.test(lista), true);
  const PROVA = (t) => /const entradaValida = normalizaHora\(entrada\);/.test(t) &&
    /proporHorasDePegar\(\{ criancas: grupo\.criancas, escola: grupo\.escola, entrada: entradaValida \}\)/.test(t);
  eq('a proposta usa a entrada do campo', PROVA(cabecalho), true);
  eq('mutação: a entrada do banco primeiro reprova', PROVA(cabecalho.replace('normalizaHora(entrada);', 'normalizaHora(grupo.horaEntrada || entrada);')), false);
  // Conferida contra a criança de agora.
  const proposta = [
    { child: { id: 'a', name: 'A' }, hora: '06:40' },
    { child: { id: 'b', name: 'B' }, hora: '06:50' },
    { child: { id: 'c', name: 'C' }, hora: '6:7' },
  ];
  const atuais = new Map([['a', { id: 'a', name: 'A' }], ['b', { id: 'b', name: 'B', horaPega: '07:00' }], ['c', { id: 'c', name: 'C' }]]);
  const r = conferirProposta(proposta, atuais);
  eq('quem ganhou hora no meio-tempo é pulado e contado', r.jaTinham, ['b']);
  eq('hora editada inválida é apontada (não pulada calada)', r.invalidas, ['c']);
  eq('grava só a que vale, com a criança de agora', r.gravar.map((x) => [x.child.id, x.hora]), [['a', '06:40']]);
  eq('o cabeçalho confere antes de gravar e não grava nada com hora inválida',
    /const r = conferirProposta\(proposta, criancasAoVivo\);\s*if \(r\.invalidas\.length\) \{\s*setInvalidas\(r\.invalidas\);\s*return;/.test(cabecalho) &&
      /for \(const item of r\.gravar\)[\s\S]*?salvarCampoDaLista\(item\.child, \{ horaPega: item\.hora \}\)/.test(cabecalho) &&
      /textoJaTinhamHora\(r\.jaTinham\.length\)/.test(cabecalho), true);
  const MESMA_HORA = /grupo\.criancas\.(map|forEach)\([^)]*\)[\s\S]{0,200}horaPega: (entrada|entradaValida|h)\b/;
  eq('nenhuma gravação de horaPega igual para o grupo', MESMA_HORA.test(cabecalho), false);
}

// ─────────────────────────────────────────────────────────────────────────
bloco('17. M6: a primeira tela de 360x640 mostra pelo menos 5 crianças (turma nova de 15)');
{
  /**
   * A CONTA, A PARTIR DAS CLASSES DOS ARQUIVOS — mudar uma altura falha aqui,
   * em vez de aparecer como a turma sumindo para baixo da dobra. Tailwind:
   * h-N/min-h-N = N×4 px. Turma nova: muitas incompletas, nenhuma família
   * dentro, com busca (15 > 12) — que agora é um botão ao lado do "A completar".
   */
  const px = (classe) => Number(classe.split('-').pop()) * 4;
  const achar = (t, re) => {
    const m = t.match(re);
    return m ? m[1] : null;
  };
  const cabecalhoApp = ler('src/components/layout/Header.jsx');
  const barra = px(achar(cabecalhoApp, /<div className="(h-\d+) px-4 flex items-center justify-between gap-3">/) || 'h-0');
  const tituloNaBarra = /<Header\s+title=\{ROTULOS\.titulo\}\s+tituloNaBarra/.test(lista);
  const menu = 64; // --altura-do-menu: 4rem (index.css)
  const espacoDoConteudo = 640 - barra - (tituloNaBarra ? 0 : 48) - menu;
  const pt = /className="space-y-2 px-4 pb-8 pt-2"/.test(lista) ? 8 : 12;
  const gap = /className="space-y-2 px-4 pb-8 pt-2"/.test(lista) ? 8 : 12;
  // O topo: py-2.5 + uma linha de texto (24) + space-y-2 + o botão (min-h-12).
  const topo = /className="space-y-2 rounded-2xl bg-card px-3 py-2\.5 shadow-rest"/.test(lista) &&
    /'tap inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-2/.test(enxuto)
    ? 10 + 24 + 8 + 48 + 10 : 200;
  const aCompletar = px(achar(completar, /className="tap flex (min-h-\d+) w-full min-w-0 items-center gap-2 rounded-2xl/) || 'min-h-50');
  const cabecalhoDaEscolaPx = px(achar(cabecalho, /<div className="flex (min-h-\d+) items-center gap-2">/) || 'min-h-35');
  const linhaPx = px(achar(linha, /className="tap flex (min-h-\d+) min-w-0 flex-1 items-center gap-3 rounded-xl text-left"/) || 'min-h-25') + 1; // + divisória
  const disponivel = espacoDoConteudo - pt - topo - gap - aCompletar - gap - cabecalhoDaEscolaPx - 4 - 1;
  const linhasVisiveis = Math.floor(disponivel / linhaPx);
  console.log(`      (barra ${barra}, título na barra ${tituloNaBarra}, topo ${topo}, "A completar" ${aCompletar}, escola ${cabecalhoDaEscolaPx}, linha ${linhaPx} → ${linhasVisiveis} linhas)`);
  eq('pelo menos 5 linhas de criança na primeira tela', linhasVisiveis >= 5, true);
  eq('o título vai na barra', tituloNaBarra, true);
  eq('a busca não ocupa linha própria fechada (é um botão ao lado do "A completar")',
    /\{temBusca && buscando && \(/.test(lista), true);
  eq('a linha da criança tem duas linhas de texto (nome + uma frase)',
    (linha.slice(linha.indexOf('export default function LinhaDaTurma'), linha.indexOf('function CorpoDaLinha')).match(/className="block truncate/g) || []).length, 2);
  eq('alvos ≥ 44 px: o botão do topo, a linha, o "A completar", o chip da entrada',
    [48, linhaPx - 1, aCompletar, cabecalhoDaEscolaPx].every((h) => h >= 44), true);
  eq('letra ≥ 14 px (nada de text-xs nas peças da lista)',
    [lista, linha, completar, cabecalho, enxuto].some((t) => /\btext-xs\b|text-\[1[0-3]px\]/.test(t)), false);
  eq('âmbar só na "falta hora de pegar" (e no grupo da hora)',
    [lista, cabecalho, enxuto].some((t) => /warning/.test(t)) ||
      (linha.match(/warning/g) || []).length !== 2 ||
      !/g\.falta === FALTA\.HORA \? 'border-warningBorder/.test(completar), false);
}

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
