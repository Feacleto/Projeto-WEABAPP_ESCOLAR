/**
 * A CONTA DA AUXILIAR (05/10/2026) — fase 1: papel, convite, vínculo e o
 * histórico do motorista.
 *
 *   node scripts/testar-auxiliar.mjs   (ou: npm run testar:auxiliar)
 *
 * Régua pura dos dois lados (servidor e app) e leitura de arquivo para o que
 * não dá para rodar sem Firebase: as rules fecham a escrita do vínculo e do
 * convite, o cliente não escreve `motoristaUid` nem `motoristaUids`, e
 * nenhuma tela da auxiliar imprime valor.
 *
 * Desde o VÍNCULO POR PAR (05/10/2026): `auxiliares/{motorista}_{auxiliar}`,
 * com períodos que somam, o histórico que nunca é apagado, até dois tios por
 * auxiliar e até duas auxiliares por tio — régua, espelho e varredura de
 * arquivo para que nenhum `auxiliares/${uid}` sozinho sobreviva.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { painelDe, ehAuxiliar } from '../src/dominio/identidade/papeis.js';
import {
  historicoDeAuxiliares,
  rotatividade,
  mensagemDoConviteDeAuxiliar,
  urlDoConviteDeAuxiliar,
  linkDoZap,
  mesesEntre,
  diasDeVinculo as diasDeVinculoDoApp,
  idDoVinculo as idDoVinculoDoApp,
  rotaDaPeruaRodando,
  trocaDePerua,
} from '../src/dominio/identidade/auxiliar.js';
import { readdirSync, statSync } from 'node:fs';

const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDoAuxiliar.js');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(nome); console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('\n1. o papel');
checar('auxiliar vai para /aux', '/aux', painelDe({ role: 'auxiliar' }));
checar('ehAuxiliar', true, ehAuxiliar({ role: 'auxiliar' }));
checar('motorista continua no /tio', '/tio', painelDe({ role: 'admin' }));

console.log('\n2. o convite (servidor)');
const AGORA = Date.UTC(2026, 9, 5, 12);
checar('código tem 10 letras sem 0/O/1/I', true, R.codigoValido(R.gerarCodigoDoConvite()));
checar('código com O é recusado', false, R.codigoValido('ABCDEFGHJO'));
checar('código com barra nunca vira caminho', false, R.codigoValido('ABCDE/GHJK'));
checar('convite novo vale', true, R.conviteVale({ criadoEmMs: AGORA - 1000 }, AGORA).vale);
checar('com 16 dias não vale', 'vencido', R.conviteVale({ criadoEmMs: AGORA - 16 * 864e5 }, AGORA).motivo);
checar('usado não vale', 'usado', R.conviteVale({ criadoEmMs: AGORA, usadoPor: 'x' }, AGORA).motivo);
checar('cancelado não vale', 'cancelado', R.conviteVale({ criadoEmMs: AGORA, canceladoEm: 1 }, AGORA).motivo);
checar('inexistente não vale', 'inexistente', R.conviteVale(null, AGORA).motivo);
checar('até 2 ativas: com 1 cabe', true, R.cabeMaisUma(1));
checar('com 2 não cabe', false, R.cabeMaisUma(2));
checar('telefone com DDD', '11977771234', R.telefoneLimpo('(11) 97777-1234'));
checar('telefone sem DDD é recusado', null, R.telefoneLimpo('97777-1234'));
checar('a régua não requer o SDK', false, /require\(/.test(ler('functions/lib/reguaDoAuxiliar.js')));

console.log('\n3. o histórico e a rotatividade (app)');
const MES = 30.4 * 864e5;
const periodo = (de, ate = null) => ({ de, ate });
const vinculos = [
  { auxiliarUid: 'a', motoristaUid: 'tio', nome: 'Cida', ativa: true, aceitoEm: AGORA - 1 * MES, periodos: [periodo(AGORA - 1 * MES)] },
  { auxiliarUid: 'b', motoristaUid: 'tio', nome: 'Rose', ativa: false, aceitoEm: AGORA - 19 * MES, encerradoEm: AGORA - 10 * MES, periodos: [periodo(AGORA - 19 * MES, AGORA - 10 * MES)] },
  { auxiliarUid: 'c', motoristaUid: 'tio', nome: 'Lúcia', ativa: false, aceitoEm: AGORA - 30 * MES, encerradoEm: AGORA - 25 * MES, periodos: [periodo(AGORA - 30 * MES, AGORA - 25 * MES)] },
];
const h = historicoDeAuxiliares(vinculos, AGORA);
checar('a ativa vem primeiro, depois a saída mais recente', ['Cida', 'Rose', 'Lúcia'], h.map((x) => x.nome));
checar('meses de cada uma', [1, 9, 5], h.map((x) => x.meses));
const r = rotatividade(vinculos, AGORA);
checar('total, ativas e média das que saíram', [3, 1, 7], [r.total, r.ativas, r.mediaDeMeses]);
checar('começaram nos últimos 12 meses', 1, r.ultimos12);
checar('sem nenhuma que saiu, a média não é inventada', null, rotatividade([{ uid: 'a', ativa: true, desde: AGORA }], AGORA).mediaDeMeses);
checar('quem ficou dias conta 1 mês', 1, mesesEntre(AGORA - 5 * 864e5, AGORA));
checar('o uid da lista é o DELA (o doc é do par)', ['a', 'b', 'c'], h.map((x) => x.uid));
// Quem saiu e voltou: UM documento, dois períodos, uma linha só com o tempo somado.
const voltou = historicoDeAuxiliares([{
  auxiliarUid: 'd', nome: 'Bete', ativa: false, aceitoEm: AGORA - 12 * MES, encerradoEm: AGORA - 1 * MES,
  periodos: [periodo(AGORA - 12 * MES, AGORA - 9 * MES), periodo(AGORA - 5 * MES, AGORA - 1 * MES)],
}], AGORA);
checar('quem voltou aparece uma vez só', 1, voltou.length);
checar('com o tempo SOMADO dos períodos (3 + 4 meses)', 7, voltou[0].meses);
checar('e o número de voltas', 1, voltou[0].voltas);
checar('o "desde" da lista é o primeiro aceite', AGORA - 12 * MES, voltou[0].primeiroMs);
const voltouAtiva = historicoDeAuxiliares([{
  auxiliarUid: 'd', nome: 'Bete', ativa: true, aceitoEm: AGORA - 12 * MES,
  periodos: [periodo(AGORA - 12 * MES, AGORA - 9 * MES), periodo(AGORA - 2 * MES)],
}], AGORA)[0];
checar('a ativa que voltou: "Desde" é o período de agora', AGORA - 2 * MES, voltouAtiva.desdeMs);
checar('e o aberto conta até agora (3 + 2 meses)', 5, voltouAtiva.meses);

console.log('\n4. o convite no WhatsApp');
const link = urlDoConviteDeAuxiliar('ABCDEFGHJK', 'https://alobuzinou.com');
checar('o link', 'https://alobuzinou.com/auxiliar/ABCDEFGHJK', link);
checar('a mensagem tem a marca, o primeiro nome e o link', true,
  ['Tio Nino', 'Cida', link].every((p) => mensagemDoConviteDeAuxiliar({ marca: 'Tio Nino', nome: 'Cida Souza', link }).includes(p)));
checar('o Zap vai para o número dela, com DDI', 'https://wa.me/5511977771234', linkDoZap('(11) 97777-1234'));

console.log('\n5. as travas (rules e servidor)');
const regras = ler('firestore.rules');
const blocoAux = regras.slice(regras.indexOf('match /auxiliares/{id}'), regras.indexOf('match /configFinanceiro/{uid}'));
checar('o bloco do vínculo existe', true, regras.includes('match /auxiliares/{id}'));
checar('ninguém escreve o vínculo pelo cliente', true, /allow write: if false;/.test(blocoAux));
checar('lê o vínculo só quem está nele (o tio ou a auxiliar do doc)', true,
  blocoAux.includes('resource.data.motoristaUid == request.auth.uid') && blocoAux.includes('resource.data.auxiliarUid == request.auth.uid'));
checar('o convite é só do servidor', true, /match \/convitesDeAuxiliar\/\{codigo\} \{\s*allow read, write: if false;/.test(regras));
checar('o cliente não escreve motoristaUid', true, regras.includes("'motoristaUid',"));
checar('nem motoristaUids (a lista dos tios ativos)', true, regras.includes("'motoristaUids',"));
checar('ela lê o motorista só com o vínculo DO PAR ativo', true,
  regras.includes("auxiliares/$(uid + '_' + request.auth.uid)).data.get('ativa', false) == true"));
checar('e a leitura do tio não depende de campo do perfil dela', false, regras.includes("userDoc().get('motoristaUid'"));
const indice = ler('functions/index.js');
checar('as cinco callables estão exportadas', true,
  ['convidarAuxiliar', 'cancelarConviteDeAuxiliar', 'verConviteDeAuxiliar', 'aceitarConviteDeAuxiliar', 'desativarAuxiliar'].every((n) => indice.includes(`exports.${n} =`)));
const servidor = ler('functions/lib/auxiliares.js');
checar('uma conta, um papel: família e motorista não viram auxiliar', true, servidor.includes("usuario.role !== 'auxiliar'"));
checar('a tela pública não devolve telefone nem valor', false,
  /telefone|valorMensal/.test(servidor.slice(servidor.indexOf('function makeVerConviteDeAuxiliar'), servidor.indexOf('function makeAceitarConviteDeAuxiliar')).split('return {').slice(-1)[0]));

console.log('\n6. nenhuma tela da auxiliar mostra valor');
for (const tela of ['src/pages/auxiliar/AuxHoje.jsx', 'src/pages/auxiliar/AuxPerfil.jsx', 'src/pages/auxiliar/AuxLayout.jsx', 'src/pages/ConviteAuxiliar.jsx']) {
  const s = semComentarios(ler(tela));
  checar(`${tela.split('/').pop()} não imprime valor`, false, /R\$|formatCurrency|monthlyFee|amount/.test(s));
}
checar('a sonda acha valor quando existe', true, /R\$|formatCurrency/.test('<p>R$ 350</p>'));

console.log('\n7. a turma dela é uma cópia com lista fechada (fase 2)');
const criancaCompleta = {
  adminUid: 'tio', active: true, name: 'Ana', photoURL: 'f', gender: 'girl', school: 'EMEF', horaPega: '06:40',
  parentName: 'Rita', parentPhone: '11977771234', status: 'onboard',
  monthlyFee: 350, dueDay: 10, saudeNotas: 'alergia', saudeConsentidaEm: 1, contratoVigente: 'c1',
  contractAcceptedAt: 1, address: 'Rua das Flores, 10', lat: -23.5, lng: -46.6, inviteCode: 'ABC', notes: 'portão de trás',
};
const recorte = R.recorteParaAuxiliar(criancaCompleta);
checar('leva o que ela precisa', ['Ana', 'EMEF', '06:40', '11977771234', 'onboard'],
  [recorte.name, recorte.school, recorte.horaPega, recorte.parentPhone, recorte.status]);
checar('nunca leva mensalidade, contrato, saúde, endereço nem convite', [],
  ['monthlyFee', 'dueDay', 'saudeNotas', 'saudeConsentidaEm', 'contratoVigente', 'contractAcceptedAt', 'address', 'lat', 'lng', 'inviteCode', 'notes']
    .filter((k) => k in recorte));
checar('criança inativa não aparece', null, R.recorteParaAuxiliar({ ...criancaCompleta, active: false }));
checar('a lista fechada não tem campo de dinheiro', false,
  R.CAMPOS_DA_TURMA_DA_AUXILIAR.some((k) => /fee|valor|amount|saude|contrat|due/i.test(k)));
const falta = R.faltaParaAuxiliar({ adminUid: 'tio', childId: 'a', dateKey: '2026-10-05', type: 'full', note: 'febre', parentUid: 'p' });
checar('a falta vai sem o recado da família', { dateKey: '2026-10-05', childId: 'a', type: 'full' }, falta);
const blocoTurma = regras.slice(regras.indexOf('match /turmaDaAuxiliar/'), regras.indexOf('match /auxiliares/{id}'));
checar('ninguém escreve a cópia pelo cliente', true, /allow write: if false;/.test(blocoTurma));
checar('só a auxiliar ATIVA daquele motorista lê a cópia (o vínculo do par)', true,
  blocoTurma.includes("auxiliares/$(motoristaUid + '_' + request.auth.uid)") && blocoTurma.includes('.data.ativa == true'));
const hojeDela = ler('src/pages/auxiliar/AuxHoje.jsx');
checar('a tela dela lê a cópia, nunca children', [true, false],
  [hojeDela.includes('useTurmaDaAuxiliar'), /useChildren|watchChildren|collection\(db, 'children'/.test(hojeDela)]);
checar('quando a última auxiliar sai, a cópia some', true, servidor.includes('apagarTurmaDaAuxiliar(db, uid)'));

console.log('\n8. ela marca na rota, só para a frente (fase 3)');
checar('ida: em casa → na perua', true, R.passoValido('home', 'onboard'));
checar('ida: na perua → na escola', true, R.passoValido('onboard', 'atSchool'));
checar('volta: na escola → na perua → em casa', [true, true], [R.passoValido('atSchool', 'onboard'), R.passoValido('onboard', 'delivered')]);
checar('desfazer não é dela: na perua → em casa', false, R.passoValido('onboard', 'home'));
checar('entregue não anda mais', false, R.passoValido('delivered', 'onboard'));
const chave = (ms) => new Date(ms).toISOString().slice(0, 10);
const ontem = { status: 'delivered', statusUpdatedAt: { toMillis: () => Date.UTC(2026, 9, 4, 12) } };
checar('o "entregue" de ontem vale "em casa" hoje', 'home', R.statusDeHoje(ontem, '2026-10-05', chave));
checar('o de hoje vale', 'delivered', R.statusDeHoje({ ...ontem, statusUpdatedAt: { toMillis: () => Date.UTC(2026, 9, 5, 12) } }, '2026-10-05', chave));
checar('de manhã o embarque não avisa a família', null, R.avisoDaMarcacao({ proximo: 'onboard', anterior: 'home', nome: 'Ana', hora: '06:40' }));
checar('na saída da escola avisa', 'child_onboard', R.avisoDaMarcacao({ proximo: 'onboard', anterior: 'atSchool', nome: 'Ana', hora: '12:10' })?.type);
checar('chegou na escola e em casa avisam', ['child_arrived_school', 'child_arrived_home'],
  [R.avisoDaMarcacao({ proximo: 'atSchool', nome: 'Ana', hora: '07:00' })?.type, R.avisoDaMarcacao({ proximo: 'delivered', nome: 'Ana', hora: '12:30' })?.type]);
const marcar = servidor.slice(servidor.indexOf('function makeMarcarParadaPelaAuxiliar'), servidor.indexOf('module.exports'));
checar('a marcação confere o vínculo ATIVO', true, marcar.includes('v.ativa !== true'));
checar('marcar recebe o motoristaUid e o passa no idValido ANTES de virar caminho', true,
  marcar.includes("request.data?.motoristaUid") && marcar.indexOf('idValido(motoristaUid)') > -1
  && marcar.indexOf('idValido(motoristaUid)') < marcar.indexOf('auxiliares/${R.idDoVinculo(motoristaUid, uid)}'));
checar('e o app manda o tio escolhido', true,
  ler('src/pages/auxiliar/AuxHoje.jsx').includes('marcarParadaPelaAuxiliar(child.id, acao.nextStatus, motoristaUid)'));
checar('e que a criança é do motorista dela', true, marcar.includes('child.adminUid !== motoristaUid'));
checar('e grava status, marco e aviso numa TRANSAÇÃO (toque duplo não avisa duas vezes)', true, ['runTransaction', 'tx.get(childRef)', 'tx.update(childRef', 'rides/${hoje}', "collection('notifications')"].every((p) => marcar.includes(p)));
checar('e recusa a conta trancada do motorista', true, marcar.includes('exigirContaDoMotoristaOperando(db, motoristaUid)'));
checar('convidar e aceitar também recusam conta trancada', 3, (servidor.match(/await exigirContaDoMotoristaOperando\(db,/g) || []).length);
const DIA = 864e5;
const T = Date.UTC(2026, 9, 5);
const opera = (m, ligada) => R.contaDoMotoristaOpera(m, { cobrancaLigada: ligada, agoraMs: T });
checar('suspenso não opera, nem com a cobrança desligada', false, opera({ role: 'admin', suspenso: true }, false));
checar('cobrança desligada: opera', true, opera({ role: 'admin', trialInicio: T - 200 * DIA }, false));
checar('cobrança ligada, teste vencido e sem assinatura: não opera', false, opera({ role: 'admin', trialInicio: T - 100 * DIA }, true));
checar('cobrança ligada, teste correndo: opera', true, opera({ role: 'admin', trialInicio: T - 10 * DIA }, true));
checar('teste nem começado: opera', true, opera({ role: 'admin' }, true));
checar('assinatura com folga de 10 dias: opera', true, opera({ role: 'admin', trialInicio: T - 200 * DIA, assinaturaAte: T - 5 * DIA }, true));
checar('assinatura vencida há 11 dias: não opera', false, opera({ role: 'admin', trialInicio: T - 200 * DIA, assinaturaAte: T - 11 * DIA }, true));
checar('quem não é motorista não opera', false, opera({ role: 'parent' }, false));
checar('a callable está exportada', true, indice.includes('exports.marcarParadaPelaAuxiliar ='));
checar('o PIX dela é o do motorista', true, ler('src/pages/auxiliar/AuxHoje.jsx').includes('<PixDaPerua perfil={motorista} />'));

console.log('\n9. o vínculo por PAR (05/10/2026)');
checar('o id do par', 'tio_aux', R.idDoVinculo('tio', 'aux'));
checar('o app monta o mesmo id', R.idDoVinculo('t1', 'a1'), idDoVinculoDoApp('t1', 'a1'));
checar('até 2 tios por auxiliar: com 0 e 1 cabe', [true, true], [R.cabeMaisUmTio(0), R.cabeMaisUmTio(1)]);
checar('com 2 tios não cabe o terceiro', false, R.cabeMaisUmTio(2));
checar('e o tio continua com até 2 auxiliares', [true, false], [R.cabeMaisUma(1), R.cabeMaisUma(2)]);
const D = 864e5;
checar('sem períodos, zero dias', 0, R.diasDeVinculo([], AGORA));
checar('um período fechado de 20 dias', 20, R.diasDeVinculo([periodo(AGORA - 40 * D, AGORA - 20 * D)], AGORA));
checar('o período aberto conta até agora', 10, R.diasDeVinculo([periodo(AGORA - 10 * D)], AGORA));
checar('recontratação: 20 dias + 15 abertos = 35 (a régua dos 30 dias soma)', 35,
  R.diasDeVinculo([periodo(AGORA - 60 * D, AGORA - 40 * D), periodo(AGORA - 15 * D)], AGORA));
checar('29 dias e 23 horas ainda não são 30', 29, R.diasDeVinculo([periodo(AGORA - 30 * D + 3600e3)], AGORA));
checar('aceita Timestamp (toMillis)', 5, R.diasDeVinculo([{ de: { toMillis: () => AGORA - 5 * D }, ate: null }], AGORA));
checar('período invertido ou sem início não conta', 0, R.diasDeVinculo([periodo(AGORA, AGORA - D), { ate: AGORA }], AGORA));
const casosDeDias = [
  [], [periodo(AGORA - 3 * D)], [periodo(AGORA - 90 * D, AGORA - 31 * D), periodo(AGORA - 7 * D)],
  [{ de: { toMillis: () => AGORA - 45 * D }, ate: { toMillis: () => AGORA - D } }], [periodo(AGORA, AGORA - D)],
];
checar('o espelho do app dá os mesmos dias, caso a caso', casosDeDias.map((c) => R.diasDeVinculo(c, AGORA)),
  casosDeDias.map((c) => diasDeVinculoDoApp(c, AGORA)));
const aberto = R.abrirPeriodo([], 'T1');
checar('abrir o primeiro período', [{ de: 'T1', ate: null }], aberto);
const fechado = R.fecharPeriodo(aberto, 'T2');
checar('desativar FECHA o período, não apaga', [{ de: 'T1', ate: 'T2' }], fechado);
checar('recontratar ACRESCENTA um período', [{ de: 'T1', ate: 'T2' }, { de: 'T3', ate: null }], R.abrirPeriodo(fechado, 'T3'));
checar('abrir com um já aberto não duplica', 1, R.abrirPeriodo(aberto, 'T9').length);
checar('a régua continua sem require', false, /require\(/.test(semComentarios(ler('functions/lib/reguaDoAuxiliar.js'))));

const aceitar = servidor.slice(servidor.indexOf('function makeAceitarConviteDeAuxiliar'), servidor.indexOf('function makeDesativarAuxiliar'));
const desativar = servidor.slice(servidor.indexOf('function makeDesativarAuxiliar'), servidor.indexOf('const chaveDoDia'));
checar('aceitar escreve o doc do PAR', true, aceitar.includes('auxiliares/${R.idDoVinculo(tioUid, uid)}'));
checar('aceitar confere o teto de tios dela e o de auxiliares dele', true,
  aceitar.includes('R.cabeMaisUmTio(') && aceitar.includes('R.cabeMaisUma('));
checar('quem já é auxiliar pode aceitar um segundo tio (o papel recusado é só outro)', true,
  aceitar.includes("usuario.role !== 'auxiliar'") && !aceitar.includes('Você já é auxiliar de outro motorista'));
checar('aceitar acrescenta o tio em motoristaUids', true, aceitar.includes('motoristaUids: FieldValue.arrayUnion(tioUid)'));
const perfilDela = aceitar.slice(aceitar.indexOf('tx.set(userRef'), aceitar.indexOf('}, { merge: true });', aceitar.indexOf('tx.set(userRef')));
checar('e não grava mais o motoristaUid singular no perfil', [true, false], [perfilDela.includes('motoristaUids'), /motoristaUid:/.test(perfilDela)]);
checar('recontratar reabre o MESMO doc com período novo', true, aceitar.includes('R.abrirPeriodo(vinculo.periodos'));
checar('o primeiro aceite fica (aceitoEm só no doc novo)', 1, (aceitar.match(/aceitoEm:/g) || []).length);
checar('desativar recebe auxiliarUid pelo idValido e lê o par do tio autenticado', true,
  desativar.includes("request.data?.auxiliarUid") && desativar.includes('idValido(auxiliarUid)')
  && desativar.includes('auxiliares/${R.idDoVinculo(uid, auxiliarUid)}'));
checar('desativar fecha o período e marca encerradoEm, sem apagar', [true, true, false],
  [desativar.includes('R.fecharPeriodo('), desativar.includes('encerradoEm:'), /\.delete\(\)/.test(desativar)]);
checar('desativar tira o tio de motoristaUids', true, desativar.includes('motoristaUids: FieldValue.arrayRemove(uid)'));

// Nenhum `auxiliares/${…}` sozinho sobrou: todo caminho do vínculo é o do par.
function varrer(dir, fora = []) {
  for (const nome of readdirSync(new URL(`../${dir}/`, import.meta.url))) {
    if (nome === 'node_modules') continue;
    const rel = `${dir}/${nome}`;
    if (statSync(new URL(`../${rel}`, import.meta.url)).isDirectory()) varrer(rel, fora);
    else if (/\.(js|jsx|mjs|cjs)$/.test(nome)) fora.push(rel);
  }
  return fora;
}
const SOZINHO = /auxiliares\/\$\{(?!R\.idDoVinculo\(|idDoVinculo\()[^}]*\}/;
const sozinhos = [...varrer('src'), ...varrer('functions/lib')].filter((a) => SOZINHO.test(semComentarios(ler(a))));
checar('nenhum auxiliares/${uid} sozinho no código (só o par)', [], sozinhos);
checar('sonda: o padrão acha o caminho antigo', true, SOZINHO.test('db.doc(`auxiliares/${uid}`)'));
checar('sonda: o padrão não acha o do par', false, SOZINHO.test('db.doc(`auxiliares/${R.idDoVinculo(tio, uid)}`)'));
const REGRA_SOZINHA = /auxiliares\/\$\((?:request\.auth\.uid|d\.auxiliarUid|request\.resource\.data\.auxiliarUid)\)/;
checar('nas rules também: nenhum vínculo lido pelo uid sozinho', false, REGRA_SOZINHA.test(regras));
checar('sonda: o padrão das rules acha o antigo', true, REGRA_SOZINHA.test('documents/auxiliares/$(request.auth.uid))'));
checar('o app da auxiliar não lê mais profile.motoristaUid', [],
  varrer('src').filter((a) => /profile\?\.motoristaUid\b/.test(ler(a))));

console.log('\n10. o app dela com dois tios');
const hojeSrc = ler('src/pages/auxiliar/AuxHoje.jsx');
checar('com dois tios, a troca de perua (um botão por tio)', true, hojeSrc.includes('ativos.length > 1') && hojeSrc.includes('escolher(b.motoristaUid)'));
checar('o acesso encerrado só quando não sobra tio ativo', true, hojeSrc.includes('vinculos?.length > 0 && ativos.length === 0'));
const perua = ler('src/hooks/usePeruaDaAuxiliar.js');
checar('a escolha da perua é lembrada no aparelho, com try/catch', true,
  perua.includes('localStorage') && (perua.match(/try \{/g) || []).length >= 2);
const convite = ler('src/pages/ConviteAuxiliar.jsx');
checar('o convite de um segundo tio diz "também"', true, convite.includes('Você vai trabalhar também na perua de'));
checar('ser auxiliar não pula mais o convite (só o link já usado por ela)', true, convite.includes('convite?.jaEhSeu'));
checar('os pagamentos dizem de qual tio é cada um', true, ler('src/pages/auxiliar/AuxPagamentos.jsx').includes('marcaDe(p.motoristaUid)'));

console.log('\n11. a troca de perua trava com a rota rodando (F4.1)');
{
  const agora = new Date(2026, 9, 5, 7, 10);
  const hojeCedo = { toDate: () => new Date(2026, 9, 5, 6, 45) };
  const ontem = { toDate: () => new Date(2026, 9, 4, 17, 0) };
  checar('ninguém na perua: não roda', false, rotaDaPeruaRodando([{ status: 'home' }, { status: 'atSchool', statusUpdatedAt: hojeCedo }], agora));
  checar('uma criança "Na perua" hoje: roda', true, rotaDaPeruaRodando([{ status: 'home' }, { status: 'onboard', statusUpdatedAt: hojeCedo }], agora));
  checar('"Na perua" de ontem não trava hoje', false, rotaDaPeruaRodando([{ status: 'onboard', statusUpdatedAt: ontem }], agora));
  checar('a data em milissegundos também vale', true, rotaDaPeruaRodando([{ status: 'onboard', statusUpdatedAt: agora.getTime() }], agora));
  checar('turma carregando (null): não trava', false, rotaDaPeruaRodando(null, agora));

  const ativos = [{ motoristaUid: 't1', marcaDoMotorista: 'Tio Nino' }, { motoristaUid: 't2', marcaDoMotorista: 'Tia Cida' }];
  const solta = trocaDePerua(ativos, 't1', false, { marca: 'Tio Nino', genero: 'male' });
  checar('sem rota: nenhum botão travado, nenhuma frase', [[false, false], null], [solta.botoes.map((b) => b.travado), solta.aviso]);
  const presa = trocaDePerua(ativos, 't1', true, { marca: 'Tio Nino', genero: 'male' });
  checar('com rota: só o OUTRO botão trava (os dois continuam na tela)', [false, true], presa.botoes.map((b) => b.travado));
  checar('a frase diz de quem é a rota', 'A rota do Tio Nino está rodando.', presa.aviso);
  checar('tia: "da"', 'A rota da Tia Cida está rodando.', trocaDePerua(ativos, 't2', true, { marca: 'Tia Cida', genero: 'female' }).aviso);
  checar('com um tio só, não há frase de troca', null, trocaDePerua([ativos[0]], 't1', true, { marca: 'Tio Nino' }).aviso);
  checar('o rótulo do botão é "Perua de {marca}"', 'Perua de Tia Cida', presa.botoes[1].rotulo);

  const tela = semComentarios(ler('src/pages/auxiliar/AuxHoje.jsx'));
  checar('a tela decide pela régua, com a turma da cópia', true,
    tela.includes('rotaDaPeruaRodando(criancas)') && tela.includes('trocaDePerua(ativos, motoristaUid, rodando'));
  checar('o botão travado fica desabilitado, não some', true, tela.includes('disabled={botao.travado}'));
  checar('a frase da trava em 16px (text-base)', true, /text-base[^"]*">\{troca\.aviso\}/.test(tela));
  checar('a auxiliar não lê liveLocation (nenhuma escuta da posição)', false, /liveLocation|useLiveLocation/.test(tela));
  checar('a cor do tio passa pela paletaDaMarca (contraste do app)', true,
    tela.includes('paletaDaMarca(motorista?.marcaCor)') && tela.includes('paletaDaMarca(admin?.marcaCor)'));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
