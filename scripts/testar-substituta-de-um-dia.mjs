/**
 * A SUBSTITUTA DE UM DIA (F3, 05/10/2026) — o link, quando ele morre, e o
 * que ele mostra a quem não tem conta.
 *
 * POR QUE ESTE TESTE EXISTE
 * O link vai pelo WhatsApp para um TERCEIRO, sem conta e sem rules no
 * caminho. Quem decide o que ela vê é uma lista de campos dentro de
 * `recorteDaSubstituta`, e mais nada — então o caso central não é "o recorte
 * tem os campos certos", é "nenhum valor sensível aparece no JSON",
 * procurado um por um. E o caminho público não pode gravar nada além do
 * limite por IP: isso é conferido lendo o arquivo da callable.
 *
 * COMO RODAR
 *   node scripts/testar-substituta-de-um-dia.mjs   (ou: npm run testar:substituta-de-um-dia)
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  viagensDaSubstituta,
  mensagemDaSubstituta,
  falaComQuem,
  acessoAbertoDeHoje,
  palavraDoStatus,
} from '../src/dominio/rota/rotaDaSubstituta.js';
import { caminhoSemSegredo } from '../src/compartilhado/caminhoSemSegredo.js';
import { ESPECIE, ESPECIE_DO_AVISO } from '../src/dominio/identidade/avisos.js';
import { DESTINO_DO_AVISO } from '../src/dominio/identidade/destinoDoAviso.js';

const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDaSubstitutaDeUmDia.js');
const { contaDoMotoristaOpera } = require('../functions/lib/reguaDoAuxiliar.js');
const { estaLigada } = require('../functions/lib/reguaDaCobranca.js');
const avisosServidor = require('../functions/lib/avisos.js');
const destinoServidor = require('../functions/lib/destinoDoAviso.js');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8');

let ok = 0;
let bad = 0;
function checar(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`  ok  ${nome}`);
    ok += 1;
  } else {
    console.log(` FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    bad += 1;
  }
}
const eq = (nome, esperado, obtido) =>
  checar(nome, JSON.stringify(esperado) === JSON.stringify(obtido),
    `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
const bloco = (t) => console.log(`\n${t}`);
const sha = (t) => createHash('sha256').update(String(t)).digest('hex');

// Horas fixas em UTC: Brasília é UTC-3 (sem horário de verão desde 2019).
const BRT = (dia, hh, mm) => Date.UTC(2026, 9, dia, hh + 3, mm);

// ─────────────────────────────────────────────────────────────────────────
bloco('1 · O TOKEN');
const SEGREDO = 'Qk9hX2xpbmtfZGVfdW1fZGlhX3NlZ3JlZG9fMzJieXRlcw';
const ID = 'AbCdEfGhIj0123456789';
const token = R.montarToken(ID, SEGREDO);
eq('o formato é s_{id}.{segredo}', `s_${ID}.${SEGREDO}`, token);
eq('lê de volta id e segredo', { id: ID, segredo: SEGREDO }, R.lerTokenDaSubstituta(token));
eq('com espaço em volta, também', { id: ID, segredo: SEGREDO }, R.lerTokenDaSubstituta(`  ${token} `));
eq('sem o prefixo s_ não é token', null, R.lerTokenDaSubstituta(`${ID}.${SEGREDO}`));
eq('o token de 24h (t_) não é da substituta', null, R.lerTokenDaSubstituta(`t_${ID}.${SEGREDO}`));
eq('sem o ponto, não', null, R.lerTokenDaSubstituta(`s_${ID}`));
eq('segredo vazio, não', null, R.lerTokenDaSubstituta(`s_${ID}.`));
eq('id com barra (outro documento), não', null, R.lerTokenDaSubstituta(`s_abc/def/ghijkl.${SEGREDO}`));
eq('id curto demais, não', null, R.lerTokenDaSubstituta(`s_abc.${SEGREDO}`));
eq('segredo curto demais, não', null, R.lerTokenDaSubstituta(`s_${ID}.abc`));
eq('segredo com caractere fora do base64url, não', null, R.lerTokenDaSubstituta(`s_${ID}.${SEGREDO}/x`));
eq('nada, não', null, R.lerTokenDaSubstituta(undefined));

// ─────────────────────────────────────────────────────────────────────────
bloco('2 · O HASH');
checar('o mesmo segredo dá o mesmo hash', R.hashesIguais(sha(SEGREDO), sha(SEGREDO)));
checar('outro segredo, não', !R.hashesIguais(sha(SEGREDO), sha(`${SEGREDO}x`)));
checar('tamanho diferente, não', !R.hashesIguais(sha(SEGREDO), sha(SEGREDO).slice(1)));
checar('vazio nunca é igual', !R.hashesIguais('', ''));
checar('ausente nunca é igual', !R.hashesIguais(undefined, undefined));
const codigo = ler('functions/lib/substitutaDeUmDia.js');
checar('o banco guarda o HASH, nunca o segredo', /segredoHash:\s*sha256\(segredo\)/.test(codigo)
  && !/segredo:\s*segredo/.test(codigo));
checar('o segredo tem 32 bytes aleatórios', /BYTES_DO_SEGREDO = 32/.test(codigo)
  && /crypto\.randomBytes\(BYTES_DO_SEGREDO\)/.test(codigo));

// ─────────────────────────────────────────────────────────────────────────
bloco('3 · VIVO OU MORTO — e a mesma frase para todas as recusas');
const HOJE = '2026-10-05';
const ACESSO = {
  motoristaUid: 'tio1', substitutaId: 'sub1', nome: 'Joana Lima', dateKey: HOJE,
  segredoHash: sha(SEGREDO), criadoEm: BRT(5, 6, 0), encerradoEm: null, encerradoPor: null,
};
eq('o link de hoje, com o segredo certo, vale', { ok: true, motivo: null },
  R.acessoVale({ acesso: ACESSO, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE }));
eq('o de ontem não vale (meia-noite, pela leitura)', 'dia',
  R.acessoVale({ acesso: { ...ACESSO, dateKey: '2026-10-04' }, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE }).motivo);
eq('encerrado pelo tio não vale', 'encerrado',
  R.acessoVale({ acesso: { ...ACESSO, encerradoEm: BRT(5, 9, 0), encerradoPor: 'tio' }, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE }).motivo);
eq('segredo errado não vale', 'hash',
  R.acessoVale({ acesso: ACESSO, hashDoSegredo: sha('outro'), hojeChave: HOJE }).motivo);
eq('documento inexistente não vale', 'inexistente',
  R.acessoVale({ acesso: null, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE }).motivo);
eq('o hash vem antes do dia: sem o segredo, nada mais é olhado', 'hash',
  R.acessoVale({ acesso: { ...ACESSO, dateKey: '2026-10-04' }, hashDoSegredo: sha('x'), hojeChave: HOJE }).motivo);
eq('a frase é "Este link não vale mais."', 'Este link não vale mais.', R.FRASE_DO_LINK_MORTO);
const ver = codigo.slice(codigo.indexOf('function makeVerRotaDaSubstituta'), codigo.indexOf('module.exports'));
checar('a callable pública só recusa com a frase da régua',
  (ver.match(/new HttpsError\('not-found'/g) || []).length === 1
  && /new HttpsError\('not-found', R\.FRASE_DO_LINK_MORTO/.test(ver));
checar('a página diz a mesma frase', /Este link não vale mais\./.test(ler('src/pages/Substituta.jsx'))
  && /'Este link não vale mais\.'/.test(ler('src/services/substitutaDeUmDiaService.js')));
checar('só a sondagem conta no limite por IP (segredo errado, inexistente, formato)',
  R.recusaDeSondagem('hash') && R.recusaDeSondagem('inexistente') && R.recusaDeSondagem('formato')
  && !R.recusaDeSondagem('dia') && !R.recusaDeSondagem('encerrado') && !R.recusaDeSondagem('rota'));

// ─────────────────────────────────────────────────────────────────────────
bloco('3b · CONTA TRANCADA MATA O LINK (o mesmo predicado da auxiliar)');
const AGORA = BRT(5, 8, 0);
const DIA = 24 * 60 * 60 * 1000;
const opera = (tio, config) => contaDoMotoristaOpera(tio, { cobrancaLigada: estaLigada(config), agoraMs: AGORA });
const vale = (contaOpera) => R.acessoVale({ acesso: ACESSO, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE, contaOpera });
const LIGADA = { cobrancaLigada: true };
eq('conta suspensa = morto', 'conta', vale(opera({ role: 'admin', suspenso: true }, LIGADA)).motivo);
eq('suspensa, mesmo com a cobrança desligada = morto', 'conta', vale(opera({ role: 'admin', suspenso: true }, null)).motivo);
eq('teste vencido sem assinatura, cobrança ligada = morto', 'conta',
  vale(opera({ role: 'admin', trialInicio: AGORA - 100 * DIA }, LIGADA)).motivo);
eq('teste vencido com a cobrança DESLIGADA = vivo', true,
  vale(opera({ role: 'admin', trialInicio: AGORA - 100 * DIA }, null)).ok);
eq('conta ok (assinatura em dia) = vivo', true,
  vale(opera({ role: 'admin', trialInicio: AGORA - 100 * DIA, assinaturaAte: AGORA + 20 * DIA }, LIGADA)).ok);
eq('teste correndo = vivo', true, vale(opera({ role: 'admin', trialInicio: AGORA - 10 * DIA }, LIGADA)).ok);
eq('sem saber da conta (ausente), nunca vale', 'conta',
  R.acessoVale({ acesso: ACESSO, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE, contaOpera: false }).motivo);
checar('conta trancada não é sondagem (não conta no limite)', !R.recusaDeSondagem('conta'));
checar('a callable lê users e platformConfig e usa o MESMO predicado',
  /contaDoMotoristaOpera\(dadosDoTio, \{\s*cobrancaLigada: estaLigada\(/.test(ver)
  && /db\.doc\('platformConfig\/app'\)\.get\(\)/.test(ver)
  && /contaOpera, rota, paradas/.test(ver));
checar('o gerar continua exigindo a conta operando',
  /exigirContaDoMotoristaOperando\(db, uid\)/.test(codigo.slice(codigo.indexOf('function makeGerarAcessoDeSubstituta'))));

// ─────────────────────────────────────────────────────────────────────────
bloco('4 · A ROTA DO DIA ACABOU');
const ULTIMA = 17 * 60 + 30; // a última parada do dia, 17h30
const rotaFim = (hh, mm, extra = {}) => ({ routeActive: false, updatedAt: BRT(5, hh, mm), ...extra });
checar('a ida encerrada às 7h30 NÃO mata o link de quem faz a volta',
  !R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: rotaFim(7, 30), ultimaParadaMin: ULTIMA }));
checar('a rota encerrada às 17h40 mata',
  R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: rotaFim(17, 40), ultimaParadaMin: ULTIMA }));
checar('encerrada antes de o link nascer não conta (ele chamou depois da rota)',
  !R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 18, 0), rota: rotaFim(17, 40), ultimaParadaMin: ULTIMA }));
checar('rota rodando não mata',
  !R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: { routeActive: true, updatedAt: BRT(5, 17, 40) }, ultimaParadaMin: ULTIMA }));
checar('sem liveLocation, nada morre por rota',
  !R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: null, ultimaParadaMin: ULTIMA }));
checar('a rota abandonada (closeStaleRoutes grava closedAt) também conta',
  R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: { routeActive: false, updatedAt: BRT(5, 16, 0), closedAt: BRT(5, 17, 50) }, ultimaParadaMin: ULTIMA }));
checar('sem nenhuma hora na turma, qualquer encerramento conta',
  R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: rotaFim(7, 30), ultimaParadaMin: null }));
checar('o encerramento de ONTEM não conta para o link de hoje',
  !R.rotaDoDiaAcabou({ criadoEmMs: BRT(5, 6, 0), rota: { routeActive: false, updatedAt: BRT(4, 18, 0) }, ultimaParadaMin: ULTIMA }));
eq('pela régua inteira, a rota do dia é a quarta recusa', 'rota',
  R.acessoVale({ acesso: ACESSO, hashDoSegredo: sha(SEGREDO), hojeChave: HOJE, rota: rotaFim(17, 40),
    paradas: [{ horaPega: '06:30', horaEntrega: '17:30', falta: null }] }).motivo);
eq('a última parada ignora quem falta o dia inteiro', 12 * 60 + 30,
  R.ultimaParadaDoDia([{ horaPega: '06:30', horaEntrega: '12:30' }, { horaPega: '13:00', horaEntrega: '18:00', falta: 'full' }]));

// ─────────────────────────────────────────────────────────────────────────
bloco('5 · O RECORTE — o que ela NUNCA vê');
const ONTEM_MS = BRT(4, 12, 0);
const HOJE_MS = BRT(5, 7, 0);
const CRIANCAS = [
  {
    id: 'crianca_secreta_1',
    name: 'Ana Beatriz Souza',
    active: true,
    adminUid: 'tio1',
    school: 'EMEF Paulo Freire',
    schoolId: 'esc1',
    schoolPhone: '1133334444',
    schoolLat: -23.5, schoolLng: -46.6,
    horaPega: '06:40', horaEntrega: '12:30',
    period: 'morning',
    address: 'Rua das Acácias, 412, apto 71',
    cep: '04763110',
    lat: -23.61234, lng: -46.71234,
    parentName: 'Mariana Souza', parentPhone: '11987654321',
    parent2Name: 'Carlos Souza', parent2Phone: '11912345678',
    monthlyFee: 650, dueDay: 10,
    saudeNotas: 'Alergia a amendoim', saudeConsentidaEm: 1,
    photoURL: 'https://firebasestorage.googleapis.com/foto-da-ana.jpg',
    inviteCode: 'TNAB23CD',
    contratoVigente: 'contrato-7',
    status: 'onboard', statusUpdatedAt: HOJE_MS,
  },
  {
    id: 'c2', name: 'Theo', active: true, school: 'Colégio Lua', horaPega: '06:20', horaEntrega: '12:40',
    status: 'delivered', statusUpdatedAt: ONTEM_MS,
  },
  { id: 'c3', name: 'Caio Mendes', active: false, school: 'Colégio Lua', horaPega: '06:00' },
  { id: 'c4', name: 'Duda Reis', active: true, school: 'Colégio Lua', horaPega: '07:00', horaEntrega: '12:35' },
];
const FALTAS = [
  { childId: 'c4', dateKey: HOJE, type: 'full', note: 'Está com febre, mãe do Caio sabe' },
  { childId: 'c2', dateKey: '2026-10-04', type: 'full' },
];
const paradas = R.recorteDaSubstituta({ criancas: CRIANCAS, faltas: FALTAS, hojeChave: HOJE });
const json = JSON.stringify(paradas);
for (const [nome, valor] of [
  ['sobrenome', 'Souza'], ['segundo nome', 'Beatriz'], ['endereço', 'Acácias'], ['CEP', '04763110'],
  ['latitude', '-23.61234'], ['longitude', '-46.71234'], ['coordenada da escola', '-23.5'],
  ['telefone da mãe', '11987654321'], ['telefone do segundo', '11912345678'], ['telefone da escola', '1133334444'],
  ['nome da mãe', 'Mariana'], ['mensalidade', '650'], ['monthlyFee', 'monthlyFee'], ['saúde', 'amendoim'],
  ['saudeNotas', 'saude'], ['foto', 'foto-da-ana'], ['photoURL', 'photo'], ['convite', 'TNAB23CD'],
  ['contrato', 'contrato-7'], ['id da criança', 'crianca_secreta_1'], ['recado da falta', 'febre'],
  ['criança inativa', 'Caio'], ['adminUid', 'tio1'],
]) {
  checar(`não aparece: ${nome}`, !json.includes(valor), `achou "${valor}"`);
}
checar('cada parada tem EXATAMENTE os campos da lista',
  paradas.every((p) => JSON.stringify(Object.keys(p)) === JSON.stringify([...R.CAMPOS_DA_PARADA])));
eq('o primeiro nome de "Ana Beatriz Souza" é "Ana"', 'Ana', R.primeiroNome('Ana Beatriz Souza'));
eq('só as ativas, ordenadas pela hora de pegar', ['Theo', 'Ana', 'Duda'], paradas.map((p) => p.nome));
eq('a escola vai sozinha, com o primeiro nome', 'EMEF Paulo Freire', paradas.find((p) => p.nome === 'Ana').escola);
eq('o status de hoje vale', 'onboard', paradas.find((p) => p.nome === 'Ana').status);
eq('o status de ontem volta a "home"', 'home', paradas.find((p) => p.nome === 'Theo').status);
eq('a falta de hoje vem como tipo', 'full', paradas.find((p) => p.nome === 'Duda').falta);
eq('a falta de ontem não vem', null, paradas.find((p) => p.nome === 'Theo').falta);
checar('a chave é a posição, nunca o id', paradas.every((p, i) => p.chave === `p${i + 1}`));
eq('a marca é o nome que ele escolheu, nunca o nome civil',
  { nome: 'Tio Nino', artigo: 'o', logoURL: 'https://x/logo.png' },
  R.marcaParaSubstituta({ marcaNome: 'Tio Nino', name: 'Antônio Silva', marcaLogoURL: 'https://x/logo.png', phone: '11999999999' }));
eq('sem marca, nenhum nome (e nunca o civil)', null, R.marcaParaSubstituta({ name: 'Antônio Silva' }).nome);
eq('a tia leva "a"', 'a', R.marcaParaSubstituta({ marcaNome: 'Tia Lene', gender: 'female' }).artigo);
checar('as duas fontes (cópia da auxiliar e children) passam pela MESMA função',
  (codigo.match(/R\.recorteDaSubstituta\(/g) || []).length >= 2
  && /lerTurmaDoTio/.test(codigo) && /turmaDaAuxiliar\/\$\{motoristaUid\}\/criancas/.test(codigo)
  && /collection\('children'\)\.where\('adminUid', '==', motoristaUid\)/.test(codigo));
checar('nada no recorte é espalhado do documento', !/\.\.\.c\b|\.\.\.crianca|\.\.\.child/.test(
  ler('functions/lib/reguaDaSubstitutaDeUmDia.js').slice(ler('functions/lib/reguaDaSubstitutaDeUmDia.js').indexOf('function recorteDaSubstituta'))
    .replace(/\{ \.\.\.c, chave/, '')));

// ─────────────────────────────────────────────────────────────────────────
bloco('6 · A ORDEM DA VIAGEM (diaCompleto)');
const viagens = viagensDaSubstituta(paradas);
eq('ida e volta, na ordem do dia', ['ida', 'volta'], viagens.map((v) => v.direcao));
eq('a ida na ordem da hora', ['Theo', 'Ana', 'Duda'], viagens[0].paradas.map((p) => p.nome));
eq('a volta na ordem da hora', ['Ana', 'Duda', 'Theo'], viagens[1].paradas.map((p) => p.nome));
eq('a hora vem curta', '6h40', viagens[0].paradas.find((p) => p.nome === 'Ana').hora);
checar('quem falta o dia inteiro fica riscado, no lugar dele',
  viagens[0].paradas.find((p) => p.nome === 'Duda').fora === true
  && viagens[0].paradas.find((p) => p.nome === 'Duda').motivo === 'Falta hoje');
checar('o status em palavra', viagens[0].paradas.find((p) => p.nome === 'Ana').palavra === 'Na perua');
eq('as quatro palavras do app', ['Em casa', 'Na perua', 'Na escola', 'Entregue em casa'],
  ['home', 'onboard', 'atSchool', 'delivered'].map(palavraDoStatus));
const soPaiLeva = viagensDaSubstituta([{ chave: 'p1', nome: 'Lia', horaPega: '06:30', horaEntrega: '12:30', status: 'home', falta: 'no-pickup' }]);
checar('"o pai leva" risca só a ida', soPaiLeva[0].paradas[0].fora && !soPaiLeva[1].paradas[0].fora);

// ─────────────────────────────────────────────────────────────────────────
bloco('7 · GERAR DE NOVO ENCERRA O ANTERIOR');
eq('os abertos (de qualquer dia) são encerrados; os encerrados ficam',
  ['a1', 'a3'],
  R.anterioresParaEncerrar([{ id: 'a1', encerradoEm: null }, { id: 'a2', encerradoEm: 123 }, { id: 'a3', dateKey: '2026-10-04' }]));
const gerar = codigo.slice(codigo.indexOf('function makeGerarAcessoDeSubstituta'), codigo.indexOf('function makeEncerrarAcessoDeSubstituta'));
checar('o gerar encerra os anteriores NO MESMO LOTE do novo', /encerrarNoLote\(db, lote/.test(gerar)
  && gerar.indexOf('encerrarNoLote') < gerar.indexOf('lote.set(ref') && /await lote\.commit\(\)/.test(gerar));
checar('o gerar exige motorista com a conta operando', /exigirMotorista\(db, request\)/.test(gerar)
  && /exigirContaDoMotoristaOperando\(db, uid\)/.test(gerar));
checar('a substituta é DELE (motoristaUid do documento contra o uid autenticado)',
  /sub\.data\(\)\.motoristaUid !== uid/.test(gerar));
checar('o novo acesso nasce com os campos combinados',
  ['motoristaUid', 'substitutaId', 'nome', 'dateKey', 'segredoHash', 'criadoEm', 'encerradoEm: null', 'encerradoPor: null']
    .every((c) => gerar.includes(c)));
eq('a mensagem do WhatsApp',
  'Oi, Joana! Aqui é o Tio Nino. Hoje a rota é com você: https://x/substituta/s_a.b. Vale só hoje.',
  mensagemDaSubstituta({ nome: 'Joana Lima', marca: 'Tio Nino', link: 'https://x/substituta/s_a.b' }));
eq('a tia fala com "a"',
  'Oi, Joana! Aqui é a Tia Lene. Hoje a rota é com você: L. Vale só hoje.',
  mensagemDaSubstituta({ nome: 'Joana', marca: 'Tia Lene', link: 'L', gender: 'female' }));
eq('link morto: com quem falar', ['Fale com o Tio Nino.', 'Fale com a Tia Lene.', 'Fale com quem te mandou.'],
  [falaComQuem({ nome: 'Tio Nino', artigo: 'o' }), falaComQuem({ nome: 'Tia Lene', artigo: 'a' }), falaComQuem(null)]);
eq('o link aberto de hoje da substituta', 'a1', acessoAbertoDeHoje([
  { id: 'a0', substitutaId: 's1', dateKey: '2026-10-04', encerradoEm: null },
  { id: 'a2', substitutaId: 's1', dateKey: HOJE, encerradoEm: 1 },
  { id: 'a1', substitutaId: 's1', dateKey: HOJE, encerradoEm: null },
], 's1', HOJE)?.id);
eq('o de ontem não conta como aberto', null,
  acessoAbertoDeHoje([{ id: 'a0', substitutaId: 's1', dateKey: '2026-10-04', encerradoEm: null }], 's1', HOJE));

// ─────────────────────────────────────────────────────────────────────────
bloco('8 · O CAMINHO PÚBLICO NÃO ESCREVE');
const verSemLimite = ver.replace(/limite\.contar\(db, REGRAS\.SUBSTITUTA_PUBLICA, quem\)/g, '');
checar('nenhum .set/.update/.add/.delete/batch/transação em verRotaDaSubstituta',
  !/\.(set|update|add|delete|create)\(|\.batch\(|runTransaction|FieldValue/.test(verSemLimite), 'achou escrita');
checar('a única exceção é o limite por IP, contado só na sondagem',
  /if \(R\.recusaDeSondagem\(motivo\)\) await limite\.contar\(db, REGRAS\.SUBSTITUTA_PUBLICA, quem\)/.test(ver));
checar('confere o limite ANTES (lendo, sem escrever)', /limite\.aindaCabe\(db, REGRAS\.SUBSTITUTA_PUBLICA, quem\)/.test(ver));
checar('as funções que ela chama também só leem',
  !/\.(set|update|add|delete)\(/.test(codigo.slice(codigo.indexOf('async function lerTurmaDoTio'), codigo.indexOf('/** Encerra os acessos'))));
checar('é callable pública com o teto de instâncias público', /maxInstances: LIMITES\.PUBLICO/.test(ver));

// ─────────────────────────────────────────────────────────────────────────
bloco('9 · IDS POR idValido, E AS RULES');
checar('o substitutaId passa por idValido', /idValido\(substitutaId\)/.test(gerar));
const encerrar = codigo.slice(codigo.indexOf('function makeEncerrarAcessoDeSubstituta'), codigo.indexOf('function makeVerRotaDaSubstituta'));
checar('o id do encerrar passa por idValido', /idValido\(id\)/.test(encerrar));
checar('o encerrar confere que o link é do tio', /snap\.data\(\)\.motoristaUid !== uid/.test(encerrar));
checar('o id do token passa por idValido antes de virar caminho', /idValido\(partes\.id\)/.test(ver));
const rules = ler('firestore.rules');
const regra = rules.slice(rules.indexOf('match /acessosDeSubstituta/{id}'), rules.indexOf('match /acessosDeSubstituta/{id}') + 300);
checar('as rules têm o bloco', rules.includes('match /acessosDeSubstituta/{id}'));
checar('ninguém escreve pelo cliente (write false)', /allow write: if false;/.test(regra));
checar('só o tio do acesso lê (motoristaUid == auth.uid), sem o dono',
  /allow read: if isSignedIn\(\) && resource\.data\.motoristaUid == request\.auth\.uid;/.test(regra)
  && !/isOwner/.test(regra));

// ─────────────────────────────────────────────────────────────────────────
bloco('10 · O AVISO AO TIO, E O FIM DA ROTA SEM GATILHO');
eq('o tipo é fato, nos dois lados', [ESPECIE.FATO, ESPECIE.FATO],
  [ESPECIE_DO_AVISO.acesso_substituta_encerrado, avisosServidor.ESPECIE_DO_AVISO.acesso_substituta_encerrado]);
eq('leva à lista de substitutas, nos dois lados',
  ['/tio/finance/auxiliar/substitutas', '/tio/finance/auxiliar/substitutas'],
  [DESTINO_DO_AVISO.acesso_substituta_encerrado, destinoServidor.DESTINO_DO_AVISO.acesso_substituta_encerrado]);
eq('"Acesso da Joana encerrado." — sem contagem', 'Acesso da Joana encerrado.',
  R.avisoDeEncerrado({ nome: 'Joana Lima', por: 'rota' }).title);
checar('o aviso usa o tipo combinado', R.avisoDeEncerrado({ nome: 'J' }).type === 'acesso_substituta_encerrado');
checar('o closeStaleRoutes encerra os links de quem ele fechou',
  /encerrarAcessosPelaRota\(db, docSnap\.id\)/.test(ler('functions/lib/routes.js')));
checar('o encerrar da rota no app avisa o servidor',
  /avisarFimDaRotaParaSubstituta\(/.test(ler('src/hooks/useGeolocation.js')));
checar('nenhum gatilho novo em liveLocation (acordaria a cada posição)',
  !/document:\s*'liveLocation/.test(codigo) && !/document:\s*'liveLocation/.test(ler('functions/index.js')));
const index = ler('functions/index.js');
checar('as três callables estão exportadas',
  ['gerarAcessoDeSubstituta', 'encerrarAcessoDeSubstituta', 'verRotaDaSubstituta'].every((n) => index.includes(`exports.${n} =`)));

// ─────────────────────────────────────────────────────────────────────────
bloco('11 · O SEGREDO NÃO SAI DO APARELHO');
eq('o Analytics conta /substituta sem o token', '/substituta/:token',
  caminhoSemSegredo(`/substituta/${token}`));
checar('a rota pública existe no App', /path="\/substituta\/:token"/.test(ler('src/App.jsx')));
checar('a página não é indexada', /"source": "\/substituta\/\*\*"/.test(ler('firebase.json')));

console.log(`\n${ok} ok, ${bad} falha(s)`);
if (bad) process.exit(1);
