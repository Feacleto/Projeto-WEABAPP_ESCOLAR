/**
 * A Comunidade (etapa 1) — Node puro, sem runner.
 * Rodar: node scripts/testar-comunidade.mjs
 *
 * O que não pode quebrar calado:
 * - foto da turma só sai com o "sim" de CADA família marcada (LGPD art. 14);
 * - para os tios parceiros, nunca criança;
 * - a foto some (DIAS_DA_FOTO), e o app e o servidor contam o mesmo prazo;
 * - só a família escreve o "sim", e ninguém lê a foto pelo Storage.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as app from '../src/dominio/identidade/comunidade.js';

const require = createRequire(import.meta.url);
const srv = require('../functions/lib/reguaDaComunidade.js');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

console.log('\n\x1b[1m1. O app e o servidor contam igual\x1b[0m');
eq('mesmo prazo', app.DIAS_DA_FOTO, srv.DIAS_DA_FOTO);
eq('mesmas épocas', [...app.EPOCAS], [...srv.EPOCAS]);
eq('mesmos públicos', { ...app.PUBLICO }, { ...srv.PUBLICO });
eq('mesma legenda máxima', app.LEGENDA_MAX, srv.LEGENDA_MAX);
eq('a foto dura 30 dias (o fim da época)', srv.DIAS_DA_FOTO, 30);
eq('expira 30 dias depois', srv.expiraEmMs(0), 30 * 86400000);

console.log('\n\x1b[1m2. Para as famílias: o "sim" de cada uma\x1b[0m');
const turma = {
  a: { adminUid: 'tio', fotoDaTurmaConsentida: true },
  b: { adminUid: 'tio', fotoDaTurmaConsentida: true },
  c: { adminUid: 'tio' },
  d: { adminUid: 'tio', fotoDaTurmaConsentida: false },
  x: { adminUid: 'outro', fotoDaTurmaConsentida: true },
  z: { adminUid: 'tio', fotoDaTurmaConsentida: true, active: false },
};
const base = { uid: 'tio', publico: 'familias', epoca: 'Natal', todasMarcadas: true, turma };
eq('todas com o sim: publica', srv.validarPublicacao({ ...base, criancas: ['a', 'b'] }).ok, true);
eq('sem resposta conta como não', srv.validarPublicacao({ ...base, criancas: ['a', 'c'] }).semSim, ['c']);
eq('"não" não sai', srv.validarPublicacao({ ...base, criancas: ['d'] }).ok, false);
eq('criança de outro tio não sai', srv.validarPublicacao({ ...base, criancas: ['x'] }).ok, false);
eq('criança fora da turma não sai', srv.validarPublicacao({ ...base, criancas: ['z'] }).ok, false);
eq('sem confirmar que marcou todas, não', srv.validarPublicacao({ ...base, criancas: ['a'], todasMarcadas: false }).ok, false);
eq('foto sem criança marcada, confirmada, publica', srv.validarPublicacao({ ...base, criancas: [] }).ok, true);
eq('criança repetida na lista, não', srv.validarPublicacao({ ...base, criancas: ['a', 'a'] }).ok, false);
eq('época fora da lista, não', srv.validarPublicacao({ ...base, criancas: ['a'], epoca: 'Aniversário' }).ok, false);
eq('legenda comprida, não', srv.validarPublicacao({ ...base, criancas: ['a'], legenda: 'x'.repeat(81) }).ok, false);

console.log('\n\x1b[1m3. Para os tios parceiros: nunca criança\x1b[0m');
const par = { uid: 'tio', publico: 'parceiros', epoca: 'Natal', turma };
eq('sem criança e declarado: publica', srv.validarPublicacao({ ...par, criancas: [], semCrianca: true }).ok, true);
eq('com criança marcada, mesmo com o sim, não', srv.validarPublicacao({ ...par, criancas: ['a'], semCrianca: true }).ok, false);
eq('sem a declaração, não', srv.validarPublicacao({ ...par, criancas: [] }).ok, false);
eq('o app diz o mesmo antes do toque', app.prontaParaPublicar({ publico: 'parceiros', marcadas: ['a'], epoca: 'Natal', semCrianca: true, temFoto: true }).ok, false);

console.log('\n\x1b[1m4. O app avisa o que falta\x1b[0m');
const turmaApp = [{ id: 'a', fotoDaTurmaConsentida: true }, { id: 'c' }];
eq('sem foto', app.prontaParaPublicar({ publico: 'familias', temFoto: false }).motivo, 'Escolha a foto.');
eq('criança sem o sim', app.prontaParaPublicar({ publico: 'familias', marcadas: ['c'], turma: turmaApp, epoca: 'Natal', todasMarcadas: true, temFoto: true }).ok, false);
eq('pronta', app.prontaParaPublicar({ publico: 'familias', marcadas: ['a'], turma: turmaApp, epoca: 'Natal', todasMarcadas: true, temFoto: true }).ok, true);
eq('"sim" ausente é sem resposta', app.simDaFoto({}), 'sem_resposta');
eq('quando some', [app.quandoSome(5 * 86400000, 0), app.quandoSome(86400000, 0), app.quandoSome(0, 0)], ['Some em 5 dias', 'Some amanhã', 'Some hoje']);

console.log('\n\x1b[1m5. Os parceiros vêm da indicação\x1b[0m');
eq(
  'quem eu indiquei e quem me indicou, sem repetir',
  srv.parceirosDe('eu', {
    feitas: [{ indicadoUid: 'ze' }, { indicadoUid: null }, { indicadoUid: 'eu' }],
    recebidas: [{ indicadorUid: 'cida' }, { indicadorUid: 'ze' }],
  }),
  [{ uid: 'ze', papel: 'voce_indicou' }, { uid: 'cida', papel: 'indicou_voce' }],
);
eq('indicação ainda sem conta não é parceiro', srv.parceirosDe('eu', { feitas: [{ indicadoUid: undefined }] }), []);

console.log('\n\x1b[1m6. O arquivo é da pasta do tio\x1b[0m');
eq('caminho certo', srv.caminhoValido('tio', 'fotosDaTurma/tio/a1b2c3d4e5f6.jpg'), true);
eq('pasta de outro tio, não', srv.caminhoValido('tio', 'fotosDaTurma/outro/a1b2c3d4e5f6.jpg'), false);
eq('subpasta escondida, não', srv.caminhoValido('tio', 'fotosDaTurma/tio/../x/a1b2c3.jpg'), false);
eq('outra pasta do bucket, não', srv.caminhoValido('tio', 'childPhotos/abc'), false);

console.log('\n\x1b[1m7. As travas estão nas regras\x1b[0m');
const regras = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
const blocoFoto = regras.slice(regras.indexOf('match /fotosDaTurma/{id}'), regras.indexOf('match /pedidosAdesivo'));
eq('ninguém escreve fotosDaTurma pelo app', /allow write: if false;/.test(blocoFoto), true);
eq('a família só lê até vencer', blocoFoto.includes('resource.data.expiraEm > request.time'), true);
eq('a família só lê as "para as famílias"', blocoFoto.includes("resource.data.publico == 'familias'"), true);
eq('o motorista não escreve o "sim" da família', /hasAny\(\['fotoDaTurmaConsentida', 'fotoDaTurmaEm'\]\)/.test(regras), true);
const blocoStorage = storage.slice(storage.indexOf('match /fotosDaTurma/'), storage.indexOf('match /fotosDaTurma/') + 600);
eq('ninguém lê a foto pelo Storage', blocoStorage.includes('allow read: if false;'), true);

console.log('\n\x1b[1m8. Etapa 2: a família avalia, e o tio vê só a média fechada\x1b[0m');
eq('app e servidor contam o mesmo mínimo', app.MIN_RESPOSTAS, srv.MIN_RESPOSTAS);
for (const d of ['2026-01-01T00:00:00Z', '2026-06-30T23:59:59Z', '2026-07-01T00:00:00Z', '2026-12-31T23:00:00Z']) {
  eq(`mesmo semestre em ${d}`, app.semestreDe(new Date(d)), srv.semestreDe(new Date(d)));
}
eq('julho é o 2º semestre (em UTC, como as rules)', srv.semestreDe(new Date('2026-07-01T00:00:00Z')), '2026-2');
eq('o anterior do 1º é o 2º do ano passado', srv.semestreAnterior('2026-1'), '2025-2');
eq('nota só de 1 a 5, inteira', [0, 1, 5, 6, 4.5].map(srv.notaValida), [false, true, true, false, false]);
const r4 = srv.resumoParaOTio({ semestre: '2026-2', notasDoAnterior: [5, 5, 4, 1], totalAtual: 3 });
eq('com 4 respostas, sem média', r4.anterior.media, null);
eq('do semestre corrente, só quantos', r4.atual, { semestre: '2026-2', total: 3 });
eq('o corrente NUNCA traz média (denunciaria quem deu)', 'media' in r4.atual, false);
const r5 = srv.resumoParaOTio({ semestre: '2026-2', notasDoAnterior: [5, 5, 4, 4, 5, 9], totalAtual: 0 });
eq('com 5 respostas válidas, a média de uma casa', r5.anterior, { semestre: '2026-1', total: 5, media: 4.6 });
eq('a tela diz o semestre por extenso', app.semestrePorExtenso('2026-1'), '1º semestre de 2026');
eq('o id carrega o motorista, a família e o semestre', app.idDaAvaliacao('tio', 'mae', '2026-2'), 'tio_mae_2026-2');
const blocoNota = regras.slice(regras.indexOf('match /avaliacoesDoTio/{id}'), regras.indexOf('match /pedidosAdesivo'));
eq('o tio não lista as notas', blocoNota.includes('allow list, delete: if false;'), true);
eq('não existe nota do tio sobre a família', /avaliacoesDaFamilia|notaDaFamilia/.test(regras), false);

console.log('\n\x1b[1m9. Fase 1 da rede: escolas, aviso ao parceiro, aviso da foto e o pedido do sim\x1b[0m');
eq('escolas: sem repetir, sem vazio, até quatro',
  srv.escolasDoParceiro(['EE Sol', 'ee sol', '', null, 'Colégio Lua', 'B', 'C', 'D']),
  ['EE Sol', 'Colégio Lua', 'B', 'C']);
const antesDas3 = new Date('2026-10-06T02:30:00Z'); // 23h30 do dia 5 em Brasília
eq('o dia do aviso é o de Brasília', srv.diaEmBrasilia(antesDas3), '2026-10-05');
eq('um aviso ao parceiro por par e por dia', srv.idDoAvisoAoParceiro('p1', 't1', antesDas3), 'parceiro_p1_t1_2026-10-05');
const aviso = srv.avisoAoParceiro('Tio Nino');
eq('o aviso ao parceiro diz quem indicou', aviso.title, 'Tio Nino indicou você a uma família');
eq('e não leva nada da família (só tipo, título e corpo)', Object.keys(aviso).sort(), ['body', 'title', 'type']);
eq('o aviso ao parceiro não cita criança nem família pelo nome', /Ana|filho|criança/i.test(aviso.title + aviso.body), false);
eq('um aviso da foto por época, por família e por ano',
  srv.idDoAvisoDaFoto('t1', 'Natal', 'mae1', antesDas3), `fototurma_t1_${srv.EPOCAS.indexOf('Natal')}_2026_mae1`);
eq('época fora da lista não vira aviso', srv.idDoAvisoDaFoto('t1', 'Qualquer', 'mae1'), null);
eq('o aviso da foto diz quanto tempo ela fica', srv.avisoDaFoto('Tio Nino', 'Natal').body, 'Natal. Ela fica no app por 30 dias.');
eq('famílias da turma: uma por conta, só criança ativa, sem id com barra',
  srv.familiasDaTurma([
    { parentUid: 'm1' }, { parentUid: 'm1' }, { parentUid: 'm2', active: false },
    { parentUid: 'm3' }, { parentUid: 'x/y' }, {},
  ]),
  ['m1', 'm3']);
const turmaSim = [
  { id: 'a', name: 'Ana Souza', parentUid: 'm1' },
  { id: 'b', name: 'Bia', parentUid: 'm2', fotoDaTurmaConsentida: false },
  { id: 'c', name: 'Caio', parentUid: 'm3', fotoDaTurmaConsentida: true },
  { id: 'd', name: 'Duda' },
  { id: 'e', name: 'Edu', parentUid: 'm5', active: false },
];
eq('perguntar só a quem tem conta e não respondeu (o "não" também é resposta)',
  app.quemFaltaResponder(turmaSim).map((c) => c.id), ['a']);
eq('sem conta no app não dá para perguntar', app.semContaParaPerguntar(turmaSim).map((c) => c.id), ['d']);
eq('um pedido por criança por mês, no mês de Brasília', app.idDoPedidoDaFoto('a', new Date('2026-11-01T02:00:00Z')), 'simfoto_a_2026-10');
eq('o pedido usa o primeiro nome e manda ao Início',
  app.pedidoDaFoto({ marca: 'Tio Nino', nomeCrianca: 'Ana Souza' }),
  { type: 'pedido_sim_da_foto', title: 'Tio Nino pergunta: Ana pode aparecer na foto da turma?', body: 'Responda no Início do app. Você pode mudar quando quiser.' });
const srvComunidade = fs.readFileSync('functions/lib/comunidade.js', 'utf8');
eq('o servidor confere a parceria antes de avisar', /parceiros\.some\(\(p\) => p\.uid === parceiroUid\)/.test(srvComunidade), true);
eq('o id do parceiro passa pela régua dos ids', /idValido\(parceiroUid\)/.test(srvComunidade), true);
eq('das escolas do parceiro, só o nome', /select\('nome'\)/.test(srvComunidade), true);
eq('o aviso da foto só sai para as famílias, não para os parceiros',
  /if \(d\.publico === PUBLICO\.FAMILIAS\) await avisarFamiliasDaFoto/.test(srvComunidade), true);

console.log('\n\x1b[1m10. F1.5: a auxiliar posta, para as famílias, em nome do tio\x1b[0m');
eq('o tio publica em nome próprio, na pasta dele',
  srv.quemPublica({ papel: 'admin', uid: 'tio', publico: 'parceiros' }), { ok: true, tioUid: 'tio', pastaUid: 'tio', pelaAuxiliar: false });
eq('a auxiliar publica para as famílias, em nome do tio, da pasta dela',
  srv.quemPublica({ papel: 'auxiliar', uid: 'cida', tioUid: 'tio', publico: 'familias' }), { ok: true, tioUid: 'tio', pastaUid: 'cida', pelaAuxiliar: true });
eq('a auxiliar NÃO publica para os tios parceiros',
  srv.quemPublica({ papel: 'auxiliar', uid: 'cida', tioUid: 'tio', publico: 'parceiros' }).ok, false);
eq('a auxiliar sem dizer a perua, não', srv.quemPublica({ papel: 'auxiliar', uid: 'cida', publico: 'familias' }).ok, false);
eq('a auxiliar em nome dela mesma, não', srv.quemPublica({ papel: 'auxiliar', uid: 'cida', tioUid: 'cida', publico: 'familias' }).ok, false);
eq('família não publica', srv.quemPublica({ papel: 'parent', uid: 'mae', tioUid: 'tio', publico: 'familias' }).ok, false);
const vinc = { motoristaUid: 'tio', auxiliarUid: 'cida', ativa: true };
eq('vínculo ativo do par vale', srv.vinculoDaAuxiliarVale(vinc, 'tio', 'cida'), true);
eq('sem vínculo, não', srv.vinculoDaAuxiliarVale(null, 'tio', 'cida'), false);
eq('vínculo desativado, não', srv.vinculoDaAuxiliarVale({ ...vinc, ativa: false }, 'tio', 'cida'), false);
eq('vínculo de outra auxiliar, não', srv.vinculoDaAuxiliarVale(vinc, 'tio', 'bia'), false);
eq('vínculo com outro tio, não', srv.vinculoDaAuxiliarVale(vinc, 'outro', 'cida'), false);
eq('o caminho dela é aceito na pasta DELA', srv.caminhoValido('cida', 'fotosDaTurma/cida/a1b2c3d4e5f6.jpg'), true);
eq('e não na pasta do tio', srv.caminhoValido('cida', 'fotosDaTurma/tio/a1b2c3d4e5f6.jpg'), false);
eq('a cópia vai para a pasta do tio, com o mesmo nome',
  srv.caminhoNaPastaDoTio('fotosDaTurma/cida/a1b2c3d4e5f6.jpg', 'cida', 'tio'), 'fotosDaTurma/tio/a1b2c3d4e5f6.jpg');
eq('caminho fora da pasta dela não vira cópia', srv.caminhoNaPastaDoTio('fotosDaTurma/bia/a1b2c3d4e5f6.jpg', 'cida', 'tio'), null);
const aut = srv.autoriaDaFoto({ pelaAuxiliar: true, uid: 'cida', nome: 'Aparecida Souza', tioUid: 'tio' });
eq('no doc que a família lê, só o primeiro nome dela', aut.naFoto, { postadaPorNome: 'Aparecida' });
eq('o uid dela NUNCA vai no doc da família', ['postadaPor' in aut.naFoto, Object.values(aut.naFoto).includes('cida')], [false, false]);
eq('o uid mora no registro só do servidor', aut.registro, { postadaPor: 'cida', adminUid: 'tio' });
eq('foto do tio não tem autoria', srv.autoriaDaFoto({ pelaAuxiliar: false, uid: 'tio' }), { naFoto: {}, registro: null });
const fotoAux = { adminUid: 'tio', postadaPorNome: 'Aparecida' };
const reg = { postadaPor: 'cida', adminUid: 'tio' };
eq('o tio apaga a que ela postou', srv.podeApagar(fotoAux, reg, { uid: 'tio', papel: 'admin' }), true);
eq('a autora apaga a dela', srv.podeApagar(fotoAux, reg, { uid: 'cida', papel: 'auxiliar' }), true);
eq('outra auxiliar, não', srv.podeApagar(fotoAux, reg, { uid: 'bia', papel: 'auxiliar' }), false);
eq('a auxiliar não apaga foto do tio (sem registro)', srv.podeApagar(fotoAux, null, { uid: 'cida', papel: 'auxiliar' }), false);
eq('outro tio, não', srv.podeApagar(fotoAux, reg, { uid: 'outro', papel: 'admin' }), false);
eq('registro de outra foto não vale', srv.podeApagar(fotoAux, { postadaPor: 'cida', adminUid: 'outro' }, { uid: 'cida', papel: 'auxiliar' }), false);
eq('o "sim" dela é a régua do tio (uid do TIO)',
  srv.validarPublicacao({ ...base, uid: 'tio', criancas: ['a', 'c'] }).semSim, ['c']);
const avisoFoto = srv.avisoDaFoto('Tio Nino', 'Natal');
eq('o aviso às famílias leva a marca do tio', avisoFoto.title, 'Tio Nino postou a foto da turma');
eq('e nenhum nome dela', /Aparecida|auxiliar/i.test(avisoFoto.title + avisoFoto.body), false);
const pub = srvComunidade.slice(srvComunidade.indexOf('function makePublicarFotoDaTurma'), srvComunidade.indexOf('async function criarSeNaoExiste'));
eq('o servidor confere o vínculo do par e a conta do tio', [pub.includes('vinculoDaAuxiliarVale('), pub.includes('exigirContaDoMotoristaOperando(db, tioUid)')], [true, true]);
eq('o tioUid passa pela régua dos ids', pub.includes('idValido(tioUid)'), true);
eq('o doc leva o adminUid do TIO', pub.includes('adminUid: tioUid'), true);
eq('o doc nunca grava postadaPor', /postadaPor\s*:/.test(pub), false);
eq('o aviso sai em nome do tio', pub.includes('avisarFamiliasDaFoto(db, tioUid, d.epoca)'), true);
eq('o "sim" conferido com o uid do tio', pub.includes('uid: tioUid,'), true);
eq('a cópia vai para a pasta do tio e o original sai', [pub.includes('origem.copy(arquivo)'), pub.includes('origem.delete(')], [true, true]);
eq('foto e registro de autoria nascem no mesmo lote', pub.includes('lote.set(db.doc(`${AUTORIA}/${ref.id}`)'), true);
const apagarSrv = srvComunidade.slice(srvComunidade.indexOf('async function apagarFoto'), srvComunidade.indexOf('function makeApagarFotoDaTurma'));
eq('apagar (inclusive a limpeza dos 30 dias) leva o registro junto', apagarSrv.includes('${AUTORIA}/${ref.id}'), true);
eq('"as minhas fotos" da auxiliar saem do registro, pela callable',
  /function makeMinhasFotosDaTurma[\s\S]*exigirAuxiliar[\s\S]*collection\(AUTORIA\)\.where\('postadaPor', '==', uid\)/.test(srvComunidade), true);
const servicoApp = fs.readFileSync('src/services/comunidadeService.js', 'utf8');
eq('o app não consulta foto por quem postou', /where\('postadaPor'/.test(servicoApp), false);

console.log(`\n${ok} ok, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
