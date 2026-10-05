/**
 * A CONTA DA AUXILIAR (05/10/2026) — fase 1: papel, convite, vínculo e o
 * histórico do motorista.
 *
 *   node scripts/testar-auxiliar.mjs   (ou: npm run testar:auxiliar)
 *
 * Régua pura dos dois lados (servidor e app) e leitura de arquivo para o que
 * não dá para rodar sem Firebase: as rules fecham a escrita do vínculo e do
 * convite, o cliente não escreve `motoristaUid`, e nenhuma tela da auxiliar
 * imprime valor.
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
} from '../src/dominio/identidade/auxiliar.js';

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
const vinculos = [
  { uid: 'a', nome: 'Cida', ativa: true, desde: AGORA - 1 * MES },
  { uid: 'b', nome: 'Rose', ativa: false, desde: AGORA - 19 * MES, ate: AGORA - 10 * MES },
  { uid: 'c', nome: 'Lúcia', ativa: false, desde: AGORA - 30 * MES, ate: AGORA - 25 * MES },
];
const h = historicoDeAuxiliares(vinculos, AGORA);
checar('a ativa vem primeiro, depois a saída mais recente', ['Cida', 'Rose', 'Lúcia'], h.map((x) => x.nome));
checar('meses de cada uma', [1, 9, 5], h.map((x) => x.meses));
const r = rotatividade(vinculos, AGORA);
checar('total, ativas e média das que saíram', [3, 1, 7], [r.total, r.ativas, r.mediaDeMeses]);
checar('começaram nos últimos 12 meses', 1, r.ultimos12);
checar('sem nenhuma que saiu, a média não é inventada', null, rotatividade([{ uid: 'a', ativa: true, desde: AGORA }], AGORA).mediaDeMeses);
checar('quem ficou dias conta 1 mês', 1, mesesEntre(AGORA - 5 * 864e5, AGORA));

console.log('\n4. o convite no WhatsApp');
const link = urlDoConviteDeAuxiliar('ABCDEFGHJK', 'https://alobuzinou.com');
checar('o link', 'https://alobuzinou.com/auxiliar/ABCDEFGHJK', link);
checar('a mensagem tem a marca, o primeiro nome e o link', true,
  ['Tio Nino', 'Cida', link].every((p) => mensagemDoConviteDeAuxiliar({ marca: 'Tio Nino', nome: 'Cida Souza', link }).includes(p)));
checar('o Zap vai para o número dela, com DDI', 'https://wa.me/5511977771234', linkDoZap('(11) 97777-1234'));

console.log('\n5. as travas (rules e servidor)');
const regras = ler('firestore.rules');
const blocoAux = regras.slice(regras.indexOf('match /auxiliares/{auxUid}'), regras.indexOf('match /configFinanceiro/{uid}'));
checar('ninguém escreve o vínculo pelo cliente', true, /allow write: if false;/.test(blocoAux));
checar('o convite é só do servidor', true, /match \/convitesDeAuxiliar\/\{codigo\} \{\s*allow read, write: if false;/.test(regras));
checar('o cliente não escreve motoristaUid', true, regras.includes("'motoristaUid',"));
checar('ela lê o motorista só com o vínculo ativo', true, regras.includes("auxiliares/$(request.auth.uid)).data.get('ativa', false) == true"));
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
const blocoTurma = regras.slice(regras.indexOf('match /turmaDaAuxiliar/'), regras.indexOf('match /auxiliares/{auxUid}'));
checar('ninguém escreve a cópia pelo cliente', true, /allow write: if false;/.test(blocoTurma));
checar('só a auxiliar ATIVA daquele motorista lê a cópia', true,
  blocoTurma.includes('.data.motoristaUid == motoristaUid') && blocoTurma.includes('.data.ativa == true'));
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
checar('a marcação confere o vínculo ATIVO', true, marcar.includes("!vinculo.data().ativa"));
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

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
