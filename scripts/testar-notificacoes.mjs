/**
 * AS NOTIFICAÇÕES: app aberto, app fechado e e-mail (03/10/2026).
 *
 * O teste de código achou que o aviso falhava em quase todo elo:
 *   - o push mandava link relativo, o FCM recusava, e a recusa APAGAVA o
 *     aparelho da pessoa;
 *   - mais de vinte tipos não levavam a lugar nenhum ao tocar, e o push de
 *     vários abria "/" (o login);
 *   - com o app aberto, nada aparecia além do número do sino;
 *   - "está chegando" só existia como toast no Início, avisava a perua indo
 *     embora e tinha um segundo caminho com "Tio Nino" e emoji;
 *   - a buzina não tocava com o app fechado;
 *   - o e-mail saía de um remetente que só entrega ao dono da conta.
 *
 * Este script prova a régua e trava os pontos de código por leitura de
 * arquivo (o que mora atrás do SDK não carrega no Node).
 *
 * Rode: npm run testar:notificacoes
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ESPECIE_DO_AVISO } from '../src/dominio/identidade/avisos.js';
import { DESTINO_DO_AVISO, destinoDoAviso } from '../src/dominio/identidade/destinoDoAviso.js';
import { avisoDeAproximacao } from '../src/dominio/rota/proximidade.js';
import { fraseDaBuzina } from '../src/dominio/rota/buzina.js';
import * as caixaDeAvisos from '../src/dominio/identidade/caixaDeAvisos.js';

const require = createRequire(import.meta.url);
const servidorDestino = require('../functions/lib/destinoDoAviso.js');
const rotaAoVivo = require('../functions/lib/reguaDaRotaAoVivo.js');
const email = require('../functions/lib/emailDoAviso.js');
const acesso = require('../functions/lib/reguaDoAcessoTemporario.js');

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
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

bloco('1 · TODO TIPO LEVA A UM LUGAR, IGUAL NO SINO E NO PUSH');
const tipos = Object.keys(ESPECIE_DO_AVISO);
const semDestino = tipos.filter((t) => !(t in DESTINO_DO_AVISO));
checar('todo tipo com espécie tem destino', [], semDestino);
checar('a tabela do servidor é a mesma do app', JSON.stringify(DESTINO_DO_AVISO),
  JSON.stringify(servidorDestino.DESTINO_DO_AVISO));
const casos = [];
for (const t of tipos) {
  for (const papel of ['parent', 'admin', 'owner']) {
    for (const childId of [null, 'abc']) casos.push({ aviso: { type: t, childId }, papel });
  }
}
casos.push({ aviso: { type: 'x', destino: '/tio/taxa' }, papel: 'admin' });
casos.push({ aviso: { type: 'x', url: '//evil.com' }, papel: 'parent' });
checar(`o servidor decide igual ao app (${casos.length} casos)`, true,
  casos.every(({ aviso, papel }) => destinoDoAviso(aviso, papel) === servidorDestino.destinoDoAviso(aviso, papel)));
checar('nenhum destino é "/" (o login)', true,
  casos.every(({ aviso, papel }) => destinoDoAviso(aviso, papel) !== '/'));
checar('aviso da família nunca leva o motorista a tela da família', '/tio',
  destinoDoAviso({ type: 'contrato_pronto' }, 'admin'));
checar('o contrato aceito abre o contrato daquela criança', '/tio/children/k1/contract',
  destinoDoAviso({ type: 'contract_accepted', childId: 'k1' }, 'admin'));
checar('sem a criança, cai no painel em vez de um link quebrado', '/tio',
  destinoDoAviso({ type: 'contract_accepted' }, 'admin'));
checar('o recado da agenda leva cada lado ao seu caderno', ['/pai', '/tio/agenda'],
  [destinoDoAviso({ type: 'agenda_entry' }, 'parent'), destinoDoAviso({ type: 'agenda_entry' }, 'admin')]);
checar('o destino gravado no aviso vale (os avisos do servidor já o mandam)', '/tio/encerrar',
  destinoDoAviso({ type: 'encerramento_fim', destino: '/tio/encerrar' }, 'admin'));
checar('endereço de outro site no aviso é ignorado', '/pai',
  destinoDoAviso({ type: 'x', url: '//evil.com' }, 'parent'));
checar('o push leva o endereço INTEIRO', 'https://alobuzinou.com/pai/finance',
  servidorDestino.urlDoAviso({ type: 'payment_confirmed' }, 'parent'));

bloco('2 · O PUSH (app fechado)');
const push = ler('functions/lib/push.js');
checar('o link sai de urlDoAviso, nunca relativo', true, push.includes('urlDoAviso(notif, usuario.role)'));
checar('`invalid-argument` NÃO apaga token (é erro da mensagem)', false,
  /TOKEN_MORTO\s*=\s*\[[^\]]*invalid-argument/.test(push));
checar('a mensagem só tem dados — sem o bloco que duplicava o aviso', false,
  /\n\s+notification:\s*\{/.test(push));
checar('o acesso de 24h recebe os avisos da rota', true, push.includes('aparelhosDoAcessoTemporario'));
const sw = ler('public/firebase-messaging-sw.js');
checar('o worker desenha o aviso a partir dos dados', true, sw.includes('d.title'));
checar('o "está chegando" é substituído, não empilhado (tag)', true, sw.includes('tag: d.tag'));
checar('o worker não chama navigate() (as janelas não são dele)', false, /\.navigate\(/.test(sw));
checar('o worker manda o app abrir o caminho', true, sw.includes("tipo: 'abrir-aviso'"));
const pushService = ler('src/services/pushService.js');
checar('o app ouve o toque e navega', true, pushService.includes("m.tipo === 'abrir-aviso'"));
checar('o token é regravado ao abrir o app', true, pushService.includes('export async function sincronizarPush'));
checar('sair da conta tira o aparelho da lista', true,
  ler('src/context/AuthContext.jsx').includes('m.disablePush(user.uid)'));

bloco('3 · O APP ABERTO');
// A chamada mudou de casa em 03/10/2026: do `Header` (uma escuta por tela)
// para o `NotificacoesProvider` (uma escuta por sessão). O bloco 10 trava o resto.
checar('todo aviso novo vira cartão na tela', true,
  ler('src/context/NotificacoesContext.jsx').includes('avisoNaTela(aviso'));
const naTela = ler('src/components/notifications/avisoNaTela.jsx');
checar('a buzina não ganha cartão (ela já é a tela cheia)', true, naTela.includes("new Set(['buzina'])"));
checar('o sino usa a mesma tabela do push', true,
  ler('src/components/notifications/NotificationsBody.jsx').includes('destinoDoAviso(n, profile?.role)'));

bloco('4 · "ESTÁ CHEGANDO" — só aproximando, só para quem espera');
const zonas = [null, 'longe', 'perto', 'chegou'];
const status = ['home', 'onboard', 'atSchool', 'delivered'];
let iguais = true;
for (const a of zonas) for (const b of zonas) for (const s of status) {
  const x = { anterior: a, atual: b, statusDaCrianca: s };
  if (avisoDeAproximacao(x) !== rotaAoVivo.avisoDeAproximacao(x)) iguais = false;
}
checar('o servidor decide igual ao app (64 combinações)', true, iguais);
checar('longe → perto, esperando em casa: avisa', 'perto',
  avisoDeAproximacao({ anterior: 'longe', atual: 'perto', statusDaCrianca: 'home' }));
checar('perto → chegou, voltando na perua: avisa', 'chegou',
  avisoDeAproximacao({ anterior: 'perto', atual: 'chegou', statusDaCrianca: 'onboard' }));
checar('⚠️ a perua INDO EMBORA (chegou → perto) não avisa', null,
  avisoDeAproximacao({ anterior: 'chegou', atual: 'perto', statusDaCrianca: 'home' }));
checar('⚠️ criança já na escola não recebe "chegando"', null,
  avisoDeAproximacao({ anterior: 'longe', atual: 'perto', statusDaCrianca: 'atSchool' }));
checar('⚠️ criança já entregue também não', null,
  avisoDeAproximacao({ anterior: 'perto', atual: 'chegou', statusDaCrianca: 'delivered' }));
checar('a primeira leitura só calibra', null,
  avisoDeAproximacao({ anterior: null, atual: 'chegou', statusDaCrianca: 'home' }));
const t1 = rotaAoVivo.textoDaAproximacao({ zona: 'perto', quem: 'Tio Zé', nomeDaCrianca: 'Pedro Lima', statusDaCrianca: 'home' });
checar('o texto usa a MARCA e o primeiro nome', { type: 'perua_chegando', title: 'Tio Zé está chegando', body: 'A perua está perto. Hora de descer com Pedro.' }, t1);
checar('sem marca, "A perua"', 'A perua chegou',
  rotaAoVivo.textoDaAproximacao({ zona: 'chegou', quem: '', nomeDaCrianca: 'Lia', statusDaCrianca: 'onboard' }).title);
checar('nenhum texto da rota tem "Tio Nino" nem emoji', true,
  ['perto', 'chegou'].every((zona) => ['home', 'onboard'].every((s) => {
    const t = rotaAoVivo.textoDaAproximacao({ zona, quem: '', nomeDaCrianca: 'Ana', statusDaCrianca: s });
    return !/Tio Nino/.test(t.title + t.body) && !EMOJI.test(t.title + t.body);
  })));
checar('o Início da família não dispara mais o toast antigo', false,
  ler('src/pages/pai/PaiDashboard.jsx').includes('está a caminho`)'));
checar('o mapa da família não tem mais o segundo alerta', false,
  /Tio Nino tá chegando! Pode/.test(ler('src/pages/pai/PaiMap.jsx')));

bloco('4b · A FAIXA EM DOCUMENTO PRÓPRIO — o "anterior" é só do mesmo dia');
// O documento é um por criança, não por dia: sem esta régua, o "chegou" de
// ontem seria o "anterior" de hoje, e a primeira faixa do dia poderia avisar.
checar('mesmo dia: vale a faixa de antes', 'perto',
  rotaAoVivo.zonaAnteriorDoDia({ zona: 'perto', dateKey: '2026-10-05' }, { zona: 'chegou', dateKey: '2026-10-05' }));
checar('outro dia: não há anterior', null,
  rotaAoVivo.zonaAnteriorDoDia({ zona: 'chegou', dateKey: '2026-10-04' }, { zona: 'perto', dateKey: '2026-10-05' }));
checar('documento novo: não há anterior', null,
  rotaAoVivo.zonaAnteriorDoDia(null, { zona: 'longe', dateKey: '2026-10-05' }));
checar('sem dia gravado antes: não há anterior', null,
  rotaAoVivo.zonaAnteriorDoDia({ zona: 'longe' }, { zona: 'perto', dateKey: '2026-10-05' }));
checar('a primeira faixa do dia nunca avisa, nem "chegou"', null,
  rotaAoVivo.avisoDeAproximacao({
    anterior: rotaAoVivo.zonaAnteriorDoDia({ zona: 'longe', dateKey: '2026-10-04' }, { zona: 'chegou', dateKey: '2026-10-05' }),
    atual: 'chegou',
    statusDaCrianca: 'home',
  }));
const gatilhoDaRota = ler('functions/lib/avisosDaRota.js');
checar('o gatilho do "está chegando" escuta a faixa, não a viagem do dia', true,
  gatilhoDaRota.includes("document: 'children/{childId}/proximidade/{doc}'")
  && !gatilhoDaRota.includes("document: 'children/{childId}/rides/{dia}'"));
checar('e compara pela régua do mesmo dia', true, gatilhoDaRota.includes('zonaAnteriorDoDia(antes, depois)'));

bloco('5 · A BUZINA COM O APP FECHADO');
checar('a frase do servidor é a mesma do app', true,
  ['buscar', 'entregar', undefined].every((m) =>
    fraseDaBuzina({ momento: m, nomeDaCrianca: 'Caio Souza' }) ===
    rotaAoVivo.fraseDaBuzina({ momento: m, nomeDaCrianca: 'Caio Souza' })));
checar('cada buzina vira notificação', true,
  ler('functions/lib/avisosDaRota.js').includes("document: 'pendingCalls/{callId}'"));

bloco('6 · O E-MAIL');
const ROTA = ['rota_iniciada', 'proxima_parada', 'perua_chegando', 'perua_chegou', 'buzina',
  'child_onboard', 'child_arrived_school', 'child_arrived_home', 'nao_embarcou', 'rota_atrasada'];
checar('nenhum aviso de ROTA vai por e-mail (chegaria depois da perua)', [],
  email.TIPOS_POR_EMAIL.filter((t) => ROTA.includes(t)));
checar('nenhuma oferta comercial vai por e-mail', [],
  email.TIPOS_POR_EMAIL.filter((t) => ESPECIE_DO_AVISO[t] === 'oferta'));
checar('todo tipo de e-mail existe na tabela de espécies', [],
  email.TIPOS_POR_EMAIL.filter((t) => !(t in ESPECIE_DO_AVISO)));
const m = email.montarEmailDoAviso({ aviso: { title: 'Seu contrato <b>', body: 'Toque' }, nome: 'Mariana Souza', url: 'https://alobuzinou.com/pai/contrato' });
checar('o texto do aviso é escapado no HTML', true, m.html.includes('Seu contrato &lt;b&gt;'));
checar('o e-mail cumprimenta pelo primeiro nome', true, m.text.startsWith('Olá, Mariana!'));
checar('⚠️ o e-mail é SÓ a cobrança da plataforma ao motorista', ['fatura_vence'], email.TIPOS_POR_EMAIL);
checar('e só vai para motorista', 'admin', email.PAPEL_QUE_RECEBE_EMAIL);
checar('nenhum cliente cria o aviso que vira e-mail', true,
  ler('firestore.rules').includes("!(request.resource.data.type in ['fatura_vence'])"));
const pushJs = ler('functions/lib/push.js');
checar('o e-mail sai do MESMO gatilho do push (uma função por aviso, não duas)', true,
  pushJs.includes('enviarEmailSeFor(') && !ler('functions/index.js').includes('makeEnviarEmailDoAviso'));
checar('a mensalidade da família não tem mais e-mail agendado', false,
  ler('functions/index.js').includes('exports.sendPaymentReminders'));
const idx = ler('functions/index.js');
checar('o remetente é parâmetro, não o sandbox fixo', true,
  idx.includes("defineString('EMAIL_REMETENTE'") && !idx.includes('const FROM_EMAIL'));

bloco('7 · O ACESSO DE 24 HORAS DO SEGUNDO RESPONSÁVEL');
const AGORA = Date.parse('2026-10-05T10:00:00-03:00');
checar('vale dentro das 24h', true,
  acesso.acessoTemporarioValendo({ expiraEm: AGORA + 60_000 }, AGORA));
checar('depois do fim, não vale', false,
  acesso.acessoTemporarioValendo({ expiraEm: AGORA - 1 }, AGORA));
checar('encerrado antes da hora, não vale', false,
  acesso.acessoTemporarioValendo({ expiraEm: AGORA + 60_000, revogadoEm: 1 }, AGORA));
checar('sem data de fim, NÃO vale (nunca "para sempre")', false,
  acesso.acessoTemporarioValendo({}, AGORA));
checar('a duração é 24 horas', 24 * 60 * 60 * 1000, acesso.DURACAO_DO_ACESSO_MS);
checar('o token de 24h é lido', { id: 'abcdefghij12', segredo: 'xyz' },
  acesso.lerTokenTemporario('t_abcdefghij12.xyz'));
checar('o token do "quem busca hoje" não é confundido com ele', null,
  acesso.lerTokenTemporario('2026-10-05_k1.segredo'));
checar('ele só recebe avisos de ROTA — nada de dinheiro ou contrato', [],
  acesso.TIPOS_DO_ACESSO_TEMPORARIO.filter((t) => !ROTA.includes(t)));
checar('quem gera: a titular ou o motorista DA criança', [true, true, false],
  ['mae', 'tio', 'outro'].map((uid) => acesso.podeGerar({ uid, crianca: { parentUid: 'mae', adminUid: 'tio' } })));
const regras = ler('firestore.rules');
checar('ninguém escreve o acesso pelo cliente', true,
  /match \/acessosTemporarios\/\{id\}[\s\S]*?allow write: if false;/.test(regras));

bloco('8 · OS AVISOS QUE ESTAVAM FALTANDO');
checar('"Faltou" marcado pelo motorista avisa a família', true,
  /notifyAbsence\(\{\s*child: marcando\.child/.test(ler('src/components/route/OperacaoDaRota.jsx')));
checar('"Trocar" quem busca avisa o motorista', true,
  ler('src/components/altpickup/AltPickupSheet.jsx').includes('desfeito: true'));
checar('o motorista vê na rota quem recebe hoje', true,
  ler('src/components/route/OperacaoDaRota.jsx').includes('Hoje quem recebe:'));
checar('o embarque NA ESCOLA avisa a família', true,
  ler('src/services/routeStatusService.js').includes("a.statusAnterior === 'atSchool'"));
checar('o dono pode escrever os dois avisos dele', true,
  regras.includes("isOwner() && request.resource.data.type in ['chamado_respondido', 'indicacao_ativou']"));

bloco('9 · SONDA POSITIVA');
checar('o detector de "invalid-argument" reprovaria a lista antiga', true,
  /TOKEN_MORTO\s*=\s*\[[^\]]*invalid-argument/.test("const TOKEN_MORTO = ['x', 'invalid-argument'];"));
checar('o detector de bloco `notification` reprovaria o push antigo', true,
  /\n\s+notification:\s*\{/.test("x({\n        notification: {\n title"));

bloco('10 · O SINO OUVE UMA VEZ POR SESSÃO, E MARCA EM LOTES');
/* Até 03/10/2026 a escuta morava no `Header`, que cada tela monta: toda
   navegação derrubava a escuta e relia as 100 mais recentes. E "marcar todas"
   relia o histórico inteiro e mandava um lote só, que estoura acima de 500. */
const arquivosDoSrc = (() => {
  const lista = [];
  const andar = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) andar(p);
      else if (/\.(js|jsx)$/.test(e.name)) lista.push(p);
    }
  };
  andar('src');
  return lista;
})();
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const quemChama = (re) => arquivosDoSrc.filter((p) => re.test(semComentario(ler(p))));
// Chamada, não definição: `function useNotifications(` é o próprio hook.
const CHAMA_ESCUTA = /(?<!function\s+)\buseNotifications\s*\(/;
checar('a escuta do sino é aberta num lugar só (o provider)',
  ['src/context/NotificacoesContext.jsx'], quemChama(CHAMA_ESCUTA));
checar('e o service é assinado só pelo hook dela',
  ['src/hooks/useNotifications.js'], quemChama(/(?<!function\s+)\bwatchUserNotifications\s*\(/));
checar('o Header só lê a escuta da sessão', true,
  ler('src/components/layout/Header.jsx').includes('useNotificacoesDaSessao()'));
checar('o corpo do sino (folha e página) também só lê', true,
  ler('src/components/notifications/NotificationsBody.jsx').includes('useNotificacoesDaSessao()'));
checar('o provider também cuida do push do aparelho', true,
  ler('src/context/NotificacoesContext.jsx').includes('usePushDoAparelho('));
for (const layout of ['src/pages/tio/TioLayout.jsx', 'src/pages/pai/PaiLayout.jsx']) {
  checar(`${layout.split('/').pop()} monta o provider`, true, ler(layout).includes('<NotificacoesProvider>'));
}
checar('sonda: o detector de chamada acharia o Header antigo', true,
  CHAMA_ESCUTA.test(semComentario("const { unreadCount } = useNotifications({ userId });")));

const caixa = caixaDeAvisos;
checar('o lote de leitura cabe no teto do Firestore (≤ 450)', true, caixa.LOTE_DE_LEITURA <= 450);
const mil = Array.from({ length: 1000 }, (_, i) => `n${i}`);
checar('1000 ids viram lotes de no máximo 450', [450, 450, 100],
  caixa.emLotes(mil, caixa.LOTE_DE_LEITURA).map((l) => l.length));
checar('lista vazia não gera lote', [], caixa.emLotes([]));
checar('só os não lidos são marcados, sem repetição', ['a', 'c'],
  caixa.idsNaoLidos([
    { id: 'a', isRead: false },
    { id: 'b', isRead: true },
    { id: 'c' },
    { id: 'a', isRead: false },
    { id: 'd', readAt: new Date() },
  ]));
const servico = ler('src/services/notificationsService.js');
const corpoMarcar = servico.slice(servico.indexOf('export async function markAllNotificationsRead'));
const fimMarcar = corpoMarcar.indexOf('\n}\n');
const marcar = corpoMarcar.slice(0, fimMarcar);
checar('"marcar todas" não relê o histórico do banco', false, /getDocs|query\(/.test(marcar));
checar('"marcar todas" escreve em lotes', true, marcar.includes('emLotes(unicos, LOTE_DE_LEITURA)'));
checar('o sino passa só os ids não lidos do que já carregou', true,
  ler('src/components/notifications/NotificationsBody.jsx')
    .includes('markAllNotificationsRead(idsNaoLidos(notifications))'));

const T0 = Date.parse('2026-10-03T12:00:00Z');
const ts = (ms) => ({ toMillis: () => ms });
checar('primeira carga: nada é novo', [],
  caixa.avisosQueChegaram([{ id: 'x', createdAt: ts(T0) }], null, T0));
checar('aviso que chegou depois de a escuta abrir é novo', ['y'],
  caixa.avisosQueChegaram([{ id: 'x' }, { id: 'y', createdAt: ts(T0 + 5000) }].map((n) =>
    ({ createdAt: ts(T0 - 1000), ...n })), new Set(['x']), T0).map((n) => n.id));
checar('aviso VELHO que entra na janela (outro saiu) não é novo', [],
  caixa.avisosQueChegaram([{ id: 'velho', createdAt: ts(T0 - 40 * 86400000) }], new Set(), T0));
checar('escrita local ainda sem hora do servidor conta como nova', ['z'],
  caixa.avisosQueChegaram([{ id: 'z', createdAt: null }], new Set(), T0).map((n) => n.id));
checar('o relógio atrasado do aparelho tem folga', ['w'],
  caixa.avisosQueChegaram([{ id: 'w', createdAt: ts(T0 - 5 * 60000) }], new Set(), T0).map((n) => n.id));
checar('o hook usa a régua de aviso novo', true,
  ler('src/hooks/useNotifications.js').includes('avisosQueChegaram(list, seenIdsRef.current, inicio)'));

bloco('11 · O AVISO DURA 90 DIAS');
const reguaLimpeza = require('../functions/lib/reguaDosAvisosAntigos.js');
checar('o prazo é 90 dias', 90, reguaLimpeza.DIAS_DE_RETENCAO_DOS_AVISOS);
const agora = new Date('2026-10-03T07:00:00Z');
checar('o corte é exatamente 90 dias antes', '2026-07-05T07:00:00.000Z',
  reguaLimpeza.corteDosAvisos(agora).toISOString());
checar('89 dias: fica', false, reguaLimpeza.avisoVencido(new Date(agora.getTime() - 89 * 86400000), agora));
checar('91 dias: sai', true, reguaLimpeza.avisoVencido(new Date(agora.getTime() - 91 * 86400000), agora));
checar('sem data: fica (o lado seguro)', false, reguaLimpeza.avisoVencido(null, agora));
checar('o lote da limpeza cabe no teto do Firestore', true, reguaLimpeza.LOTE_DA_LIMPEZA <= 450);
checar('a régua não requer nada', false, /\brequire\s*\(/.test(semComentario(ler('functions/lib/reguaDosAvisosAntigos.js'))));
const limpeza = ler('functions/lib/limpezaDosAvisos.js');
checar('a limpeza usa o corte da régua (não reescreve o 90)', true,
  limpeza.includes('corteDosAvisos(agora)') && !/\b90\b/.test(semComentario(limpeza)));
checar('a limpeza é paginada', true,
  limpeza.includes(".where('createdAt', '<', corte)") && limpeza.includes(".orderBy('createdAt')")
  && limpeza.includes('.limit(LOTE_DA_LIMPEZA)'));
checar('agendada no fuso de Brasília, na região do projeto', true,
  limpeza.includes("timeZone: 'America/Sao_Paulo'") && limpeza.includes("'southamerica-east1'"));
checar('uma execução por vez, com nova tentativa', true,
  limpeza.includes('concurrency: 1') && limpeza.includes('retryCount: 2')
  && limpeza.includes('maxInstances: LIMITES.AGENDADO') && limpeza.includes('timeoutSeconds: LIMITES.TEMPO_AGENDADO'));
checar('o orçamento de tempo fica abaixo do timeout do agendado', true,
  reguaLimpeza.ORCAMENTO_DA_LIMPEZA_MS < require('../functions/lib/limites.js').TEMPO_AGENDADO * 1000);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
