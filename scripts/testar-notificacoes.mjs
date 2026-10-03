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
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ESPECIE_DO_AVISO } from '../src/dominio/identidade/avisos.js';
import { DESTINO_DO_AVISO, destinoDoAviso } from '../src/dominio/identidade/destinoDoAviso.js';
import { avisoDeAproximacao } from '../src/dominio/rota/proximidade.js';
import { fraseDaBuzina } from '../src/dominio/rota/buzina.js';

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
checar('todo aviso novo vira cartão na tela', true,
  ler('src/components/layout/Header.jsx').includes('avisoNaTela(aviso'));
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

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
