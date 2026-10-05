/**
 * Passar a família para outro tio (fase 2 da rede) — Node puro, sem runner.
 * Rodar: node scripts/testar-transferencia.mjs
 *
 * O que não pode quebrar calado:
 * - só quem PAGA pede e recebe, e com a cobrança desligada nada acontece;
 * - o parceiro, antes do aceite da família, vê só o primeiro nome e a escola;
 * - a criança NOVA nasce de uma lista fechada: saúde, foto, dinheiro,
 *   contrato, horários e histórico NUNCA vão;
 * - a família não paga o mesmo mês duas vezes;
 * - o tio de antes sai da família só quando não sobra nada com ele;
 * - o app e o servidor contam igual.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as app from '../src/dominio/identidade/transferencia.js';

const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDaTransferencia.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

console.log('\n\x1b[1m1. O app e o servidor contam igual\x1b[0m');
eq('mesmo prazo', app.DIAS_PARA_RESPONDER, R.DIAS_PARA_RESPONDER);
eq('mesmos estados', { ...app.ESTADO }, { ...R.ESTADO });
eq('mesmos estados abertos', [...app.ABERTOS], [...R.ABERTOS]);
const agora = Date.parse('2026-10-05T15:00:00Z');
for (const [nome, t] of [
  ['pedido no prazo', { estado: 'pedido', expiraEm: agora + 1000 }],
  ['pedido vencido', { estado: 'pedido', expiraEm: agora - 1 }],
  ['aceito pelo parceiro e vencido', { estado: 'parceiro_aceitou', expiraEm: agora }],
  ['concluída não vence', { estado: 'concluida', expiraEm: agora - 1 }],
  ['sem prazo', { estado: 'pedido' }],
]) {
  eq(`mesmo estado efetivo: ${nome}`, app.estadoEfetivo(t, agora), R.estadoEfetivo(t, agora));
}
eq('vencido vira EXPIRADA', R.estadoEfetivo({ estado: 'pedido', expiraEm: agora - 1 }, agora), 'expirada');
eq('o prazo é de 7 dias', R.expiraEmMs(agora) - agora, 7 * 86400000);

console.log('\n\x1b[1m2. Quem pode pedir\x1b[0m');
const tioPagante = { role: 'admin', plano: 'mensal' };
const parceiro = { role: 'admin', plano: 'anual' };
const crianca = { adminUid: 'de', parentUid: 'mae', active: true, name: 'Lia Souza', school: 'EMEF Sol' };
const base = { cobrancaLigada: true, uid: 'de', tio: tioPagante, crianca, parceiroUid: 'para', parceiro, ehParceiro: true, temAberta: false };
eq('o caminho certo passa', R.podePedir(base).ok, true);
eq('cobrança desligada: fora do ar', R.podePedir({ ...base, cobrancaLigada: false }).ok, false);
eq('cobrança carregando (null) também não', R.podePedir({ ...base, cobrancaLigada: null }).ok, false);
eq('tio sem plano não pede', R.podePedir({ ...base, tio: { role: 'admin' } }).ok, false);
eq('tio suspenso não pede', R.podePedir({ ...base, tio: { ...tioPagante, suspenso: true } }).ok, false);
eq('criança de outro tio não', R.podePedir({ ...base, crianca: { ...crianca, adminUid: 'x' } }).ok, false);
eq('criança inativa não', R.podePedir({ ...base, crianca: { ...crianca, active: false } }).ok, false);
eq('família fora do app não (é ela quem aceita)', R.podePedir({ ...base, crianca: { ...crianca, parentUid: null } }).ok, false);
eq('quem não é parceiro não recebe', R.podePedir({ ...base, ehParceiro: false }).ok, false);
eq('não passa para si mesmo', R.podePedir({ ...base, parceiroUid: 'de' }).ok, false);
eq('parceiro que não é motorista não', R.podePedir({ ...base, parceiro: { role: 'parent' } }).ok, false);
eq('parceiro suspenso não', R.podePedir({ ...base, parceiro: { ...parceiro, suspenso: true } }).ok, false);
eq('um pedido aberto por criança', R.podePedir({ ...base, temAberta: true }).ok, false);
eq('atraso não derruba o pagante (só sair derruba)', R.ehPagante({ plano: 'mensal', faturaAtrasada: true }), true);

console.log('\n\x1b[1m3. O parceiro: o que vê e quando pode aceitar\x1b[0m');
eq('a prévia é só o primeiro nome e a escola', R.previaDoParceiro({ ...crianca, address: 'Rua A', parentPhone: '11999' }), { primeiroNome: 'Lia', escola: 'EMEF Sol' });
const pedido = { paraUid: 'para', estado: 'pedido', expiraEm: agora + 1000 };
const srvTransf = fs.readFileSync('functions/lib/transferencias.js', 'utf8');
eq('parceiro pagante, com o contrato aceito, aceita', R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'para', t: pedido, parceiro, contratoAceito: true, agoraMs: agora }).ok, true);
{
  const aceitoAnual = { aceitoEm: 1, conteudo: { plano: { id: 'anual' } } };
  const aceitoMensal = { aceitoEm: 1, conteudo: { plano: { id: 'mensal' } } };
  const pendenteAnual = { aceitoEm: null, conteudo: { plano: { id: 'anual' } } };
  const aceita = (contratos) => R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'para', t: pedido, parceiro,
    contratoAceito: R.contratoAceitoDoPlano(contratos, parceiro.plano), agoraMs: agora });
  const semContrato = aceita([]);
  eq('plano sem contrato: recusa, com precisaAssinar', [semContrato.ok, semContrato.precisaAssinar], [false, true]);
  eq('a frase pede o contrato', semContrato.erro, 'Para receber uma família, aceite o contrato da assinatura antes.');
  eq('contrato aceito de OUTRO plano: recusa', aceita([aceitoMensal]).ok, false);
  eq('contrato pendente: recusa', aceita([pendenteAnual]).ok, false);
  eq('contrato aceito do plano atual: passa', aceita([aceitoMensal, pendenteAnual, aceitoAnual]).ok, true);
  eq('sem plano, contrato nenhum vale', R.contratoAceitoDoPlano([aceitoAnual], undefined), false);
  eq('sem a leitura (padrão), recusa', R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'para', t: pedido, parceiro, agoraMs: agora }).ok, false);
  eq('o servidor lê os contratos dele e passa à régua', srvTransf.includes("db.collection('contratosAssociacao').where('tioUid', '==', uid)")
    && srvTransf.includes("contratoAceito: R.contratoAceitoDoPlano("), true);
}
const semPlano = R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'para', t: pedido, parceiro: { role: 'admin' }, agoraMs: agora });
eq('parceiro sem plano é mandado assinar (não perde a família)', [semPlano.ok, semPlano.precisaAssinar], [false, true]);
eq('outro tio não responde', R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'x', t: pedido, parceiro, agoraMs: agora }).ok, false);
eq('pedido vencido não se aceita', R.podeAceitarParceiro({ cobrancaLigada: true, uid: 'para', t: { ...pedido, expiraEm: agora - 1 }, parceiro, agoraMs: agora }).ok, false);

console.log('\n\x1b[1m4. A família aceita, e confere de novo o que mudou em 7 dias\x1b[0m');
const aceitoPeloParceiro = { familiaUid: 'mae', deUid: 'de', estado: 'parceiro_aceitou', expiraEm: agora + 1000 };
const familia = { cobrancaLigada: true, uid: 'mae', t: aceitoPeloParceiro, crianca, parceiro, agoraMs: agora };
eq('o caminho certo passa', R.podeAceitarFamilia(familia).ok, true);
eq('outra família não', R.podeAceitarFamilia({ ...familia, uid: 'outra' }).ok, false);
eq('antes de o parceiro aceitar, não', R.podeAceitarFamilia({ ...familia, t: { ...aceitoPeloParceiro, estado: 'pedido' } }).ok, false);
eq('o parceiro cancelou o plano no meio: não', R.podeAceitarFamilia({ ...familia, parceiro: { role: 'admin' } }).ok, false);
eq('a criança já saiu da turma: não', R.podeAceitarFamilia({ ...familia, crianca: { ...crianca, active: false } }).ok, false);
eq('a criança mudou de responsável: não', R.podeAceitarFamilia({ ...familia, crianca: { ...crianca, parentUid: 'pai' } }).ok, false);
eq('cobrança desligada no meio: não', R.podeAceitarFamilia({ ...familia, cobrancaLigada: false }).ok, false);

console.log('\n\x1b[1m5. A criança nova: a lista fechada\x1b[0m');
const antiga = {
  id: 'velha', ...crianca, gender: 'f', birthDate: '2018-03-01', turma: '2º A', professora: 'Rosa',
  parentName: 'Ana', parentPhone: '11988887777', parentPhoneChave: '5511988887777', parent2Name: 'Beto', parent2Phone: '11977776666',
  address: 'Rua A, 10', cep: '04763110', lat: -23.6, lng: -46.7, schoolAddress: 'Rua B', schoolPhone: '1133334444', schoolLat: -23.5, schoolLng: -46.6,
  saudeNotas: 'alergia', saudeConsentidaEm: 1, photoURL: 'https://x', fotoDaTurmaConsentida: true, fotoDaTurmaEm: 1,
  monthlyFee: 400, dueDay: 10, vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31', contratoVigente: { numero: 1 },
  contractHash: 'abc', contractAcceptedAt: 1, horaPega: '06:40', horaEntrega: '12:30', period: 'manha',
  status: 'onboard', statusUpdatedAt: 1, altResponsibles: [{ nome: 'Vó' }], notes: 'nota do tio', inviteCode: 'TNABCDEF',
  schoolId: 'escolaDoTioDeAntes', lastStatusCheckpoint: { lat: 1 }, autorizacaoDeclarada: true,
};
const nova = R.criancaNova({ antiga, paraUid: 'para', transferenciaId: 't1', schoolId: 'escolaDoParceiro', agoraMs: agora });
for (const campo of R.CAMPOS_QUE_NUNCA_VAO) {
  if (campo === 'schoolId' || campo === 'status') continue; // reescritos abaixo, com valor do parceiro
  eq(`NUNCA vai: ${campo}`, campo in nova, false);
}
eq('o schoolId é o da escola DO PARCEIRO, não o do tio de antes', nova.schoolId, 'escolaDoParceiro');
eq('o status começa em casa', nova.status, 'home');
eq('o dono é o parceiro', nova.adminUid, 'para');
eq('já ligada à família', [nova.parentUid, nova.inviteStatus, nova.active], ['mae', 'used', true]);
eq('o que vai, vai inteiro', R.CAMPOS_QUE_VAO.every((c) => JSON.stringify(nova[c]) === JSON.stringify(antiga[c])), true);
eq('nenhum campo da lista que vai está também na que nunca vai', R.CAMPOS_QUE_VAO.filter((c) => R.CAMPOS_QUE_NUNCA_VAO.includes(c)), []);
eq('ela sabe de onde veio', nova.transferidaDe, { childId: 'velha', transferenciaId: 't1' });
const semUndefined = R.criancaNova({ antiga: { id: 'v', parentUid: 'mae', name: 'Lia' }, paraUid: 'para', transferenciaId: 't1' });
eq('campo ausente na antiga não vira undefined (o Firestore recusaria)', Object.values(semUndefined).some((v) => v === undefined), false);
eq('a escola casa pelo nome, sem acento e sem caixa', R.escolaDoParceiro('EMEF  São João', [{ id: 'e1', nome: 'Colégio Lua' }, { id: 'e2', nome: 'emef sao joao' }]), 'e2');
eq('sem escola igual, null', R.escolaDoParceiro('EMEF Sol', [{ id: 'e1', nome: 'Colégio Lua' }]), null);

console.log('\n\x1b[1m6. O dinheiro: o mês da passagem não é cobrado duas vezes\x1b[0m');
eq('o primeiro mês cobrado é o seguinte', nova.primeiroMesCobrado, '2026-11');
eq('em dezembro, janeiro do ano que vem', R.mesSeguinte(Date.parse('2026-12-20T12:00:00Z')), '2027-01');
eq('dia 31 às 23h em Brasília ainda é o mês de Brasília', R.mesSeguinte(Date.parse('2026-11-01T01:00:00Z')), '2026-11');
eq('o mês da passagem não é cobrado', R.mesCobravel('2026-10', '2026-11'), false);
eq('o seguinte é', R.mesCobravel('2026-11', '2026-11'), true);
eq('criança sem a marca é cobrada como sempre', R.mesCobravel('2026-10', undefined), true);
const billing = fs.readFileSync('functions/lib/billing.js', 'utf8');
eq('o billing respeita o primeiro mês cobrado', /mesCobravel\(monthKey, child\.primeiroMesCobrado\)/.test(billing), true);

console.log('\n\x1b[1m7. O vínculo da família depois do aceite\x1b[0m');
const fam = { childIds: ['velha', 'irmao'], adminUids: ['de', 'outro'], adminUid: 'de', childId: 'velha' };
const sozinha = R.vinculoDaFamilia({ familia: fam, antigaId: 'velha', novaId: 'nova', deUid: 'de', paraUid: 'para' });
eq('a nova entra no lugar da antiga', sozinha.childIds, ['irmao', 'nova']);
eq('sem nada com ele, o tio de antes sai', sozinha.adminUids, ['outro', 'para']);
eq('e o singular vira o parceiro', [sozinha.adminUid, sozinha.childId], ['para', 'nova']);
const devendo = R.vinculoDaFamilia({ familia: fam, antigaId: 'velha', novaId: 'nova', deUid: 'de', paraUid: 'para', emAbertoComDe: 1 });
eq('com mensalidade em aberto, ele fica na lista (ela precisa do PIX dele)', devendo.adminUids, ['de', 'outro', 'para']);
eq('mas o singular vira o parceiro mesmo assim', devendo.adminUid, 'para');
const irmaoComEle = R.vinculoDaFamilia({ familia: fam, antigaId: 'velha', novaId: 'nova', deUid: 'de', paraUid: 'para', outrasAtivasComDe: 1 });
eq('com outro filho ainda com ele, ele fica, e o singular também', [irmaoComEle.adminUids.includes('de'), irmaoComEle.adminUid], [true, 'de']);
eq('singular de outro motorista não muda', R.vinculoDaFamilia({ familia: { ...fam, adminUid: 'outro' }, antigaId: 'velha', novaId: 'nova', deUid: 'de', paraUid: 'para' }).adminUid, 'outro');

console.log('\n\x1b[1m8. Os avisos não levam dado da família\x1b[0m');
const avisos = [
  R.avisoAoParceiro({ marcaDe: 'Tio Nino', previa: { primeiroNome: 'Lia', escola: 'EMEF Sol' } }),
  R.avisoAFamilia({ marcaDe: 'Tio Nino', marcaPara: 'Zé da Van', nome: 'Lia Souza' }),
  R.avisoDeResposta({ marcaPara: 'Zé da Van', nome: 'Lia', aceito: true }),
  R.avisoDeResposta({ marcaPara: 'Zé da Van', nome: 'Lia', aceito: false }),
  R.avisosDaConclusao({ marcaPara: 'Zé da Van', nome: 'Lia Souza' }).aoTioDeAntes,
  R.avisosDaConclusao({ marcaPara: 'Zé da Van', nome: 'Lia Souza' }).aoTioNovo,
];
const tudo = avisos.map((a) => `${a.title} ${a.body}`).join(' ');
eq('nenhum aviso cita sobrenome, endereço, telefone ou valor', /Souza|Rua|11988|R\$|alergia/.test(tudo), false);
eq('todos os avisos são de tipos classificados', avisos.every((a) => /^transferencia_/.test(a.type)), true);
eq('o pedido da família ao tio usa o primeiro nome', app.pedidoDaFamilia({ nomeCrianca: 'Lia Souza' }).title, 'A família de Lia pediu para passar a outro tio');
eq('um pedido da família por criança por mês', app.idDoPedidoDaFamilia('c1', new Date('2026-11-01T02:00:00Z')), 'outrotio_c1_2026-10');

console.log('\n\x1b[1m9. As travas no código\x1b[0m');
const srv = fs.readFileSync('functions/lib/transferencias.js', 'utf8');
const regras = fs.readFileSync('firestore.rules', 'utf8');
eq('todo id do cliente passa pela régua dos ids', (srv.match(/idValido\(/g) || []).length >= 7, true);
eq('a família só vê depois do parceiro (familiaVe gravado no aceite dele)', /familiaVe: true/.test(srv) && /familiaVe: false/.test(srv), true);
eq('o aceite da família roda numa transação', /runTransaction/.test(srv), true);
eq('a criança antiga NÃO troca de dono', /tx\.update\(criancaSnap\.ref, \{[^}]*adminUid/.test(srv), false);
eq('nas rules, ninguém escreve na coleção', /match \/transferenciasDeFamilia\/\{id\} \{[\s\S]*?allow write: if false;/.test(regras), true);
eq('nas rules, a família lê só com familiaVe', /resource\.data\.familiaUid == request\.auth\.uid && resource\.data\.familiaVe == true/.test(regras), true);
eq('nas rules, a criança transferida fica congelada para o tio', /!\('transferidaPara' in resource\.data\)/.test(regras), true);
const telas = ['src/components/transferencia/PassarParaOutroTio.jsx', 'src/components/transferencia/PedirOutroTio.jsx']
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
eq('as duas portas somem com a cobrança desligada', (telas.match(/if \(!cobranca/g) || []).length, 2);
const aceite = fs.readFileSync('src/components/transferencia/TransferenciaParaAceitar.jsx', 'utf8');
eq('o "Aceito" da família mora dentro da folha que mostra o que vai', /<Sheet[\s\S]*O_QUE_VAI[\s\S]*Aceito/.test(aceite), true);
// Só o texto do botão (o comentário do componente explica por que não há).
eq('a família não tem botão de recusar (fala com o tio)', />\s*Recusar\s*</.test(aceite), false);
eq('sonda: o detector acha um botão de recusar', />\s*Recusar\s*</.test('<button>Recusar</button>'), true);

console.log('\n\x1b[1m9. O teto de 10 por mês (F2.4)\x1b[0m');
{
  const outubro = Date.parse('2026-10-20T15:00:00Z');
  const noMes = Date.parse('2026-10-03T12:00:00Z');
  const pedido = (estado, extra = {}) => ({ estado, criadoEm: noMes, expiraEm: outubro + 86400000, ...extra });
  const dez = Array.from({ length: 10 }, () => pedido('concluida'));
  eq('o teto é 10', R.TETO_POR_MES, 10);
  eq('9 no mês: o 10º passa', R.podePedir({ ...base, pedidasNoMes: 9 }).ok, true);
  eq('10 no mês: o 11º é recusado', R.podePedir({ ...base, pedidasNoMes: 10 }).ok, false);
  eq('a frase do teto', R.podePedir({ ...base, pedidasNoMes: 10 }).erro,
    'Você já passou 10 famílias este mês. Fale com o suporte para passar mais.');
  eq('sem a contagem, vale zero (o caminho de antes passa)', R.podePedir(base).ok, true);
  eq('10 concluídas contam 10', R.pedidosQueContam(dez, outubro), 10);
  eq('abertos contam (família a caminho)', R.pedidosQueContam([pedido('pedido'), pedido('parceiro_aceitou')], outubro), 2);
  eq('cancelados contam (pedir e cancelar não burla)', R.pedidosQueContam([pedido('cancelada')], outubro), 1);
  eq('o "não posso" do parceiro não conta', R.pedidosQueContam([pedido('recusada_parceiro')], outubro), 0);
  eq('expirado (gravado) não conta', R.pedidosQueContam([pedido('expirada')], outubro), 0);
  eq('vencido sem resposta (estado efetivo) não conta',
    R.pedidosQueContam([pedido('pedido', { expiraEm: outubro - 1 })], outubro), 0);
  eq('10 concluídas + 3 recusadas: ainda é 10, o 11º recusa',
    R.podePedir({ ...base, pedidasNoMes: R.pedidosQueContam([...dez, ...Array(3).fill(pedido('recusada_parceiro'))], outubro) }).ok, false);
  eq('8 concluídas + 5 recusadas: passa', R.podePedir({ ...base, pedidasNoMes: R.pedidosQueContam([...dez.slice(2), ...Array(5).fill(pedido('recusada_parceiro'))], outubro) }).ok, true);
  const setembro = dez.map((t) => ({ ...t, criadoEm: Date.parse('2026-09-28T12:00:00Z') }));
  eq('mês virado zera', R.pedidosQueContam(setembro, outubro), 0);
  // 01/10 00:30 em Brasília = 03:30 UTC; 30/09 23:30 em Brasília = 01/10 02:30 UTC.
  eq('o mês é o de Brasília: 30/09 23h30 de lá ainda é setembro',
    R.pedidosQueContam([pedido('concluida', { criadoEm: Date.parse('2026-10-01T02:30:00Z') })], outubro), 0);
  eq('o mês é o de Brasília: 01/10 00h30 de lá já é outubro',
    R.pedidosQueContam([pedido('concluida', { criadoEm: Date.parse('2026-10-01T03:30:00Z') })], outubro), 1);
  eq('início do mês em Brasília', new Date(R.inicioDoMesMs(outubro)).toISOString(), '2026-10-01T03:00:00.000Z');
  eq('janeiro vira certo', new Date(R.inicioDoMesMs(Date.parse('2027-01-01T02:00:00Z'))).toISOString(), '2026-12-01T03:00:00.000Z');

  eq('o servidor conta os pedidos DELE do mês e passa à régua', /where\('deUid', '==', uid\)\s*\.where\('criadoEm', '>=', Timestamp\.fromMillis\(R\.inicioDoMesMs\(agora\)\)\)/.test(srv)
    && srv.includes('pedidasNoMes:') && srv.includes('R.pedidosQueContam('), true);
  const indices = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8')).indexes;
  eq('o índice composto deUid + criadoEm existe', indices.some((i) => i.collectionGroup === 'transferenciasDeFamilia'
    && i.fields.map((f) => f.fieldPath).join(',') === 'deUid,criadoEm'), true);
  const pedir = srv.slice(srv.indexOf('function makePedirTransferencia'), srv.indexOf('function makeResponderTransferencia'));
  eq('a contagem do mês e o pedido estão na MESMA transação (dois toques juntos não passam do 10º)',
    /runTransaction\(async \(tx\) => \{[\s\S]*tx\.get\(db\.collection\(COLECAO\)\.where\('deUid', '==', uid\)\s*\.where\('criadoEm'[\s\S]*R\.podePedir\([\s\S]*tx\.set\(ref,/.test(pedir), true);
  eq('o pedido não é mais gravado num lote fora da transação', /db\.batch\(\)/.test(pedir), false);
  eq('o "já existe pedido aberto" também conta dentro da transação',
    /runTransaction[\s\S]*tx\.get\(db\.collection\(COLECAO\)\.where\('deUid', '==', uid\)\.where\('childId', '==', childId\)/.test(pedir), true);
}

console.log('\n\x1b[1m10. A volta ao aceite depois de assinar (F2.4)\x1b[0m');
{
  const volta = fs.readFileSync('src/components/transferencia/voltaAoAceite.js', 'utf8');
  const pedidos = fs.readFileSync('src/components/transferencia/PedidosParaVoce.jsx', 'utf8');
  const planos = fs.readFileSync('src/pages/tio/TioPlanos.jsx', 'utf8');
  const comunidade = fs.readFileSync('src/pages/tio/TioComunidade.jsx', 'utf8');
  eq('o aviso da volta', volta.includes("'Pronto. Agora você pode aceitar a família.'"), true);
  eq('o sessionStorage tem try/catch nas três pontas', (volta.match(/try \{/g) || []).length, 3);
  eq('o pedido vai aos planos no state e no sessionStorage', pedidos.includes('guardarVolta(t.id)')
    && pedidos.includes("navigate(soFaltaContrato ? '/tio/contrato-plataforma' : '/tio/planos', { state: { voltarAoPedido: assinar } })"), true);
  const contrato = fs.readFileSync('src/pages/tio/TioContratoAssociacao.jsx', 'utf8');
  eq('os planos levam ao CONTRATO com o pedido, nunca direto à Comunidade',
    planos.includes("navigate('/tio/contrato-plataforma', pedido ? { state: { voltarAoPedido: pedido } } : undefined)")
    && !planos.includes('CAMINHO_DA_VOLTA'), true);
  eq('é o aceite do contrato que volta ao pedido',
    /await aceitarContrato\([\s\S]*lerVolta\(location\.state\)[\s\S]*navigate\(CAMINHO_DA_VOLTA, \{ replace: true, state: \{ pedidoAberto: pedido \} \}\)/.test(contrato), true);
  eq('sem pedido, o fim de sempre (fica no contrato)', contrato.includes("toast.success('Contrato aceito. Uma cópia fica sempre aqui.')"), true);
  eq('contrato já aceito para o plano: volta direto', contrato.includes('contratoFechaAssinatura(contrato, profile?.plano)'), true);
  const { contratoFechaAssinatura } = await import('../src/components/transferencia/voltaAoAceite.js');
  eq('fecha: aceito e com o mesmo plano', contratoFechaAssinatura({ aceitoEm: 1, conteudo: { plano: { id: 'mensal' } } }, 'mensal'), true);
  eq('não fecha: contrato pendente', contratoFechaAssinatura({ aceitoEm: null, conteudo: { plano: { id: 'mensal' } } }, 'mensal'), false);
  eq('não fecha: aceito para outro plano', contratoFechaAssinatura({ aceitoEm: 1, conteudo: { plano: { id: 'anual' } } }, 'mensal'), false);
  eq('não fecha: sem plano', contratoFechaAssinatura({ aceitoEm: 1, conteudo: { plano: { id: 'mensal' } } }, null), false);
  {
    const { contratoParaAssinar } = await import('../src/dominio/associacao/contratoAssociacao.js');
    const aceitoVelho = { id: 't_1000', emitidoEm: 1000, aceitoEm: 1500, conteudo: { plano: { id: 'mensal' } } };
    const pendenteNovo = { id: 't_2000', emitidoEm: 2000, aceitoEm: null, conteudo: { plano: { id: 'mensal' } } };
    eq('o atalho não fecha com o aceito velho quando há um pendente novo',
      contratoFechaAssinatura(contratoParaAssinar([aceitoVelho, pendenteNovo]), 'mensal'), false);
    eq('sem pendente novo, o aceito do plano fecha',
      contratoFechaAssinatura(contratoParaAssinar([aceitoVelho]), 'mensal'), true);
  }
  eq('o servidor exige plano E contrato aceito (assinatura fechada)',
    R.podeAceitarParceiro.toString().includes('ehPagante(parceiro)') && R.podeAceitarParceiro.toString().includes('contratoAceito !== true'), true);
  eq('a Comunidade abre na aba dos parceiros', comunidade.includes('location.state?.pedidoAberto ? PUBLICO.PARCEIROS'), true);
  eq('o pedido de volta aparece com o aviso', pedidos.includes('voltouPara === t.id && <p') && pedidos.includes('{AVISO_DA_VOLTA}'), true);
  // O aceite nunca é automático: responderTransferencia só no clique.
  const chamadas = pedidos.match(/responderTransferencia\(/g) || [];
  eq('o aceite continua sendo um toque (uma chamada só, dentro do responder)', chamadas.length, 1);
  eq('a volta não aceita nada sozinha (nem importa quem aceita)', /responderTransferencia|aceitarTransferencia|import /.test(volta.replace(/\/\*[\s\S]*?\*\//g, '')), false);
}

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
