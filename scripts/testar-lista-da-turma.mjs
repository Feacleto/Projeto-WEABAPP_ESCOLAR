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
 *   7. O catálogo de textos: toda afirmação com origem provada no código.
 *   8. As telas usam a régua e o catálogo (leitura de arquivo).
 *
 * Cada bloco tem SONDA: o comportamento antigo (ou uma mutação óbvia) é
 * medido e precisa reprovar, senão o teste não está medindo nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  valorObrigatorioNoCadastro,
} from '../src/dominio/escola/listaDaTurma.js';
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
} from '../src/marca/textosDaLista.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replace(/\r\n/g, '\n');
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
eq('o contador do topo: "1 de 5 famílias entraram no app"', contadorDeFamilias(1, 5), '1 de 5 famílias entraram no app');
eq('uma família só: frase sem "1 de 1"', [contadorDeFamilias(0, 1), contadorDeFamilias(1, 1)],
  ['A família ainda não entrou no app', 'A família entrou no app']);

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
    ['src/services/accountService.js', /contractAcceptedAt: null/],
    ['src/services/accountService.js', /await deleteChildPhoto\(childId\)/],
    ['src/services/childrenService.js', /if \('active' in updates\) \{/],
  ],
  'pagamentos-ficam': [['src/services/accountService.js', /O histórico de pagamentos da criança é PRESERVADO/]],
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
for (const a of afirmacoes) eq(`"${a.id}" cabe em 100 caracteres (${a.texto.length})`, a.texto.length <= 100, true);
for (const [id, t] of rotulos) eq(`rótulo "${id}" cabe em 45 caracteres`, t.length <= 45, true);
eq('número só vem por função (as afirmações fixas não têm dígito solto, exceto a de exemplo da régua)',
  afirmacoes.filter((a) => a.id !== 'foraDaRota' && /\d/.test(a.texto)).map((a) => a.id), []);
eq('sonda: a regra pega "recebeu" e "segurança"', [reprova('A família recebeu o convite'), reprova('Mais segurança')].every(Boolean), true);

bloco('7b. Tirar da turma diz o que se perde, e só o que existe');
eq('com família, aceite e foto', textoDeTirar({ nome: 'Pedro Henrique', temFamilia: true, temAceite: true, temFoto: true }),
  { titulo: 'Tirar Pedro da turma?', corpo: 'Vai desfazer o vínculo da família, zerar o aceite do contrato e apagar a foto. Não dá para voltar.', pagamentos: 'Os pagamentos que já existem continuam no Financeiro.' });
eq('o caso da especificação (família e foto)', textoDeTirar({ nome: 'Ana', temFamilia: true, temFoto: true }).corpo,
  'Vai desfazer o vínculo da família e apagar a foto. Não dá para voltar.');
eq('só a família', textoDeTirar({ nome: 'Ana', temFamilia: true }).corpo, 'Vai desfazer o vínculo da família. Não dá para voltar.');
eq('nada a perder além da turma', textoDeTirar({ nome: 'Ana' }).corpo, 'Ana sai da turma e da rota. Não dá para voltar.');
eq('nunca oferece Desfazer (não existe reativar)', /desfazer\b(?! o v)/i.test(JSON.stringify(textoDeTirar({ nome: 'Ana', temFamilia: true }))), false);
eq('sonda: a frase de hoje ("O histórico de pagamentos é preservado") não dizia que não volta',
  /Não dá para voltar/.test('A criança vai sair da lista ativa. O histórico de pagamentos é preservado.'), false);

// ─────────────────────────────────────────────────────────────────────────
bloco('8. As telas usam a régua e o catálogo');
const lista = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
const share = semComentarios(ler('src/components/children/InviteShare.jsx'));
eq('a lista conta pelo resumoDosConvites', /resumoDosConvites\(children, agora, tocados\)/.test(lista), true);
eq('o botão do topo usa a próxima da fila', /proximaParaConvidar\(children, agora, ultimoConvidado, tocados\)/.test(lista), true);
eq('o contador sai do catálogo', /contadorDeFamilias\(convites\.entraram, convites\.total\)/.test(lista), true);
const linha = semComentarios(ler('src/components/children/LinhaDaTurma.jsx'));
eq('cada linha tem o convite enxuto', /<ConviteEnxuto crianca=\{child\}/.test(linha), true);
eq('o convite enxuto decide pelo estadoDoConvite', /estadoDoConvite\(crianca, agora, tocou\)/.test(share), true);
eq('o convite enxuto grava conviteEnviadoEm no toque', /const tocar = \(\) => \{\s*marcarConviteEnviado\(crianca\.id\)/.test(share), true);
eq('as três caras: Convidar, Enviado/Mandar de novo, Entrou',
  ['ROTULOS.convidar', 'ROTULOS.enviado', 'ROTULOS.mandarDeNovo', 'ROTULOS.entrou'].every((r) => share.includes(r)), true);
eq('o link vencido pede link novo antes', /estado === CONVITE\.VENCIDO[\s\S]{0,200}gerarLinkNovo\(crianca\.id\)/.test(share), true);
eq('sem número, o WhatsApp abre a escolha de contato', /https:\/\/wa\.me\/\?text=/.test(share), true);
eq('a trava dos dados do contrato vale no convite enxuto', /if \(faltaContrato\) \{/.test(share.slice(share.indexOf('export function ConviteEnxuto'))), true);

bloco('9. A lista como superfície de trabalho (leitura de arquivo)');
const servico = semComentarios(ler('src/services/listaDaTurmaService.js'));
const hook = semComentarios(ler('src/hooks/useSalvarNaLista.js'));
const campos = semComentarios(ler('src/components/children/CamposDaLinha.jsx'));
const rua = semComentarios(ler('src/components/children/CampoDaRua.jsx'));
const cabecalho = semComentarios(ler('src/components/children/CabecalhoDaEscola.jsx'));
const adicionar = semComentarios(ler('src/components/children/AdicionarCrianca.jsx'));
const completar = semComentarios(ler('src/components/children/ACompletar.jsx'));
const form = semComentarios(ler('src/components/children/ChildForm.jsx'));

// Campo a campo: cada gravação leva SÓ o campo mexido, pelo updateChild.
eq('o serviço grava pelo updateChild, com o fim do cadastroRapido no mesmo write',
  /await updateChild\(crianca\.id, camposAoSalvar\(crianca, m\)\)/.test(servico), true);
const GRAVACOES = [
  ["salvar('nome', { name: v })", 'nome'],
  ["salvar('genero', { gender: v })", 'menino ou menina'],
  ["salvar('escola', camposDaEscola(e))", 'escola'],
  ["salvar('hora', { horaPega: v })", 'hora de pegar'],
  ["salvar('mae', { parentName: v })", 'nome da mãe'],
  ["salvar('fone', { parentPhone: v })", 'WhatsApp da mãe'],
  ["salvar('mensalidade', { monthlyFee: Number(valor) })", 'mensalidade'],
];
for (const [trecho, nome] of GRAVACOES) eq(`a linha grava ${nome} sozinho`, linha.includes(trecho), true);
eq('a rua grava ao assentar (com número ou "não sei"), com numeroPendente e as partes',
  /salvar\('rua', \{[\s\S]*?numeroPendente: false/.test(rua) && /salvar\('rua', \{[\s\S]*?numeroPendente: true,\s*enderecoPartes:/.test(rua), true);
eq('nenhum botão "Salvar" na linha', /['>]\s*Salvar\s*['<]/.test(linha + campos + rua), false);
eq('o campo grava ao sair (onBlur), não a cada tecla', /onBlur=\{sair\}/.test(campos) && !/onChange=\{[^}]*onSalvar/.test(campos), true);
eq('"salvo ✓" só depois de o servidor responder (o await vem antes do estado salvo)',
  /await salvarCampoDaLista\(atual\.current, mudanca\);[\s\S]*?\[campo\]: 'salvo'/.test(hook), true);
eq('erro com "tentar de novo" que reenvia a mesma mudança',
  /\[campo\]: \{ erro: true, mudanca \}/.test(hook) && /salvar\(campo, e\.mudanca\)/.test(hook) && /ROTULOS\.tentarDeNovo/.test(campos), true);
eq('a hora de pegar avisa a família depois de gravar, só se mudou',
  /await updateChild[\s\S]*?if \(antes !== mudanca\.horaPega\)[\s\S]*?notifyScheduleChanged/.test(servico), true);
eq('nada de dado de criança no console (só o código do erro)',
  [hook, adicionar, lista].every((f) => !/console\.(log|error|warn)\([^)]*(crianca|child|nome|name)[^)]*\)/.test(f.replace(/err\?\.code/g, ''))), true);
eq('a linha abre no lugar (nunca navega)', /aria-expanded=\{aberta\}/.test(linha) && !/navigate\(/.test(linha), true);
eq('com contrato, a mensalidade não se edita na linha (reajuste é pela ficha)', /contratoFeito \? \(/.test(linha), true);

// "+ Nome" passa pela declaração, uma vez, e cria fora da rota.
eq('"+ Nome": confere a declaração ANTES de criar',
  adicionar.indexOf('declaracao.confirmar()') > -1 && adicionar.indexOf('declaracao.confirmar()') < adicionar.indexOf('addChild('), true);
eq('"+ Nome": só lembra da declaração DEPOIS de salvar', adicionar.indexOf('declaracao.lembrar()') > adicionar.indexOf('addChild('), true);
eq('"+ Nome": nasce cadastroRapido (fora da rota) e com autorizacaoDeclarada: true',
  /autorizacaoDeclarada: true,\s*cadastroRapido: true/.test(adicionar), true);
eq('"+ Nome": a caixa aparece só quando ainda não declarou na sessão',
  /declaracao\.jaDeclarou \? \(\s*<DeclaracaoJaFeita \/>/.test(adicionar), true);

// A hora proposta: nunca a mesma em todas.
eq('o cabeçalho grava criança a criança, cada uma com a SUA hora da proposta',
  /for \(const item of proposta\)[\s\S]*?salvarCampoDaLista\(item\.child, \{ horaPega: hora \}\)/.test(cabecalho), true);
eq('a hora vem de proporHorasDePegar, pela entrada',
  /proporHorasDePegar\(\{ criancas: grupo\.criancas, escola: grupo\.escola, entrada: entradaValida \}\)/.test(cabecalho), true);
const MESMA_HORA = /grupo\.criancas\.(map|forEach)\([^)]*\)[\s\S]{0,200}horaPega: (entrada|entradaValida|h)\b/;
eq('nenhuma gravação de horaPega igual para o grupo', MESMA_HORA.test(cabecalho), false);
eq('sonda: o padrão pega o "aplicar a todas"',
  MESMA_HORA.test('grupo.criancas.forEach((c) => salvar(c, { horaPega: entrada }))'), true);
eq('a entrada mora na escola (updateEscola)', /updateEscola\(escolaId, \{ horaEntrada/.test(servico), true);

// A caixa "a completar".
eq('a caixa usa a régua gruposACompletar', /gruposACompletar\(criancas\)/.test(completar), true);
eq('um campo por vez, com progresso e pular',
  /progressoDaFila\(pos \+ 1, ids\.length\)/.test(completar) && /ROTULOS\.pularEProxima/.test(completar), true);
eq('a fila de "sem valor" diz por quê', /SEM_VALOR\.texto/.test(completar), true);

// Tirar da turma: a verdade, sem desfazer.
eq('tirar usa deactivateChildAndParent e o texto honesto',
  /deactivateChildAndParent\(\{ childId: tirarDe\.id \}\)/.test(lista) && /textoDeTirar\(\{/.test(lista), true);
eq('tirar não oferece Desfazer', /Desfazer/.test(lista + linha), false);
eq('N3: a lista diz quantas estão fora da rota', /textoForaDaRota\(fora\)/.test(lista), true);

bloco('10. O cadastro completo: telefone opcional, herança e declaração da sessão');
eq('o WhatsApp da mãe é opcional (o formato continua cobrado quando há)',
  /if \(String\(form\.parentPhone \|\| ''\)\.trim\(\) && !isValidPhone\(form\.parentPhone\)\)/.test(form), true);
eq('sonda: a exigência antiga não volta', /if \(!isValidPhone\(form\.parentPhone\)\)/.test(form), false);
eq('"Cadastrar outra criança" herda valor e vencimento',
  /const cadastrarOutra = \(\) => \{[\s\S]*?monthlyFee: form\.monthlyFee,\s*dueDay: form\.dueDay,/.test(form), true);
eq('quem já declarou na sessão não é perguntado de novo no formulário',
  /jaDeclarouNestaSessao\(user\?\.uid\)/.test(form) && /jaDeclarou \? \(\s*<DeclaracaoJaFeita \/>/.test(form), true);
eq('o formulário lembra a declaração só depois de salvar',
  form.indexOf('lembrarDaDeclaracao(user?.uid)') > form.indexOf('await addChild(payload)'), true);

bloco('11. Valor zero não: a mensalidade é obrigatória no cadastro (decisão do dono)');
{
  const FALTA_VALOR = ['', null, undefined, 0, '0', '0.00', -10, 'abc', NaN];
  const TEM_VALOR = [0.01, '350.00', 350, '3.50'];
  eq('vazio, zero, negativo e lixo: falta o valor', FALTA_VALOR.map(valorObrigatorioNoCadastro), FALTA_VALOR.map(() => true));
  eq('qualquer valor acima de zero passa', TEM_VALOR.map(valorObrigatorioNoCadastro), TEM_VALOR.map(() => false));
  // MUTAÇÃO: trocar `> 0` por `>= 0` deixaria o zero passar — e o caso acima reprova.
  const mutante = (v) => { const n = Number(v); return !(Number.isFinite(n) && n >= 0); };
  eq('sonda de mutação: com ">= 0" o zero passaria (o caso do zero pega)', mutante(0) === valorObrigatorioNoCadastro(0), false);
  const regua = ler('src/dominio/escola/listaDaTurma.js');
  eq('a régua compara com "> 0" exato', /return !\(Number\.isFinite\(n\) && n > 0\);/.test(regua), true);

  const add = semComentarios(ler('src/components/children/AdicionarCrianca.jsx'));
  const telaLista = semComentarios(ler('src/pages/tio/TioChildren.jsx'));
  eq('"+ Nome": sem valor válido o OK não cria (a régua vem ANTES do addChild)',
    add.indexOf('valorObrigatorioNoCadastro(valor)') > -1 && add.indexOf('valorObrigatorioNoCadastro(valor)') < add.indexOf('addChild('), true);
  eq('"+ Nome": e diz "Diga o valor da mensalidade."', /setErroValor\(ROTULOS\.erroSemValor\)/.test(add) && ROTULOS.erroSemValor === 'Diga o valor da mensalidade.', true);
  eq('"+ Nome": grava o valor e o vencimento na criança', /monthlyFee: Number\(valor\),\s*dueDay,/.test(add), true);
  eq('"+ Nome": já vem com o valor da anterior', /useState\(valorAnterior\)/.test(add) && /<AdicionarCrianca escola=\{ultimaEscola\} anterior=\{anterior\} \/>/.test(telaLista), true);
  eq('"+ Nome": a anterior é a última criada COM valor (valor e vencimento)',
    /Number\(c\.monthlyFee\) > 0\)[\s\S]{0,120}emMs\(b\.createdAt\) - emMs\(a\.createdAt\)[\s\S]{0,140}dueDay: comValor\[0\]\.dueDay/.test(telaLista), true);
  eq('"+ Nome": o valor em letra grande antes do OK (R$ formatado)', /formatCurrency\(Number\(valor\)\)/.test(add) && /<CampoDeValor/.test(add), true);

  const card = semComentarios(ler('src/components/children/CadastroRapidoDaCrianca.jsx'));
  eq('card do primeiro acesso: o valor é obrigatório (antes do addChild)',
    card.indexOf('valorObrigatorioNoCadastro(form.monthlyFee)') > -1 &&
      card.indexOf('valorObrigatorioNoCadastro(form.monthlyFee)') < card.indexOf('addChild('), true);
  eq('card do primeiro acesso: grava o valor', /monthlyFee: Number\(form\.monthlyFee\)/.test(card), true);
  eq('card do primeiro acesso: não diz mais que a mensalidade é "depois"', /mensalidade você completa depois/.test(card), false);

  const vagaComComentario = ler('src/components/perua/FolhaDaVagaRapida.jsx');
  const vaga = semComentarios(vagaComComentario);
  eq('a vaga rápida é ISENTA, e diz por quê', /ISENTA DO VALOR OBRIGATÓRIO/.test(vagaComComentario) && /não é contrato nem\s*\* matrícula/.test(vagaComComentario), true);
  eq('a vaga rápida não pede valor (nem a régua, nem o campo)', !/valorObrigatorioNoCadastro|CampoDeValor|monthlyFee/.test(vaga), true);

  const formCompleto = semComentarios(ler('src/components/children/ChildForm.jsx'));
  eq('formulário completo: o passo 4 exige o valor', /if \(valorObrigatorioNoCadastro\(form\.monthlyFee\)\)\s*errs\.monthlyFee = 'Diga o valor da mensalidade\.'/.test(formCompleto), true);
  eq('formulário completo: o rascunho ("Salvar e completar depois") continua antes do passo 4',
    /canSaveEarly && step < TOTAL_STEPS/.test(formCompleto), true);

  eq('a linha aberta não diz mais "(se quiser)" na mensalidade', /seQuiser/.test(linha) || Object.hasOwn(ROTULOS, 'seQuiser'), false);
  eq('a linha aberta não grava zero (usa a régua)', /if \(valorObrigatorioNoCadastro\(valor\)\) \{\s*setErro\(ROTULOS\.erroSemValor\)/.test(linha), true);
  eq('o grupo "sem valor" diz que é cadastro antigo ou rascunho', /Cadastro antigo ou salvo para completar depois/.test(SEM_VALOR.texto), true);

  // A lista não oferece contrato para criança sem valor: não há botão de
  // contrato nela, e o contrato só é garantido com valor (> 0).
  eq('nenhum "Mandar contrato" na lista', /contrato/i.test([telaLista, linha, add, completar].join('\n').replace(/contratoFeito|contratoVigente|contratoAguardando|contractAcceptedAt/g, '')), false);
  eq('o convite da linha só garante contrato com valor', /Number\(crianca\.monthlyFee\) > 0 \? <GarantirContratoDe/.test(share), true);

  // O selo Entrou ✓ é montado por TioChildren (TioChildren → LinhaDaTurma → ConviteEnxuto).
  eq('Entrou ✓ montado por TioChildren', /<LinhaDaTurma\b/.test(telaLista) && /<ConviteEnxuto crianca=\{child\}/.test(linha) && /ROTULOS\.entrou/.test(share), true);
}

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
