/**
 * T1 — PASSAR A FAMÍLIA PARA UM TIO PARCEIRO (05/10/2026, F2.7).
 *
 * A feature de 79055b0, 395c3de e 8a2f67f, com TRÊS aparelhos ao mesmo tempo,
 * um toque de cada pessoa (functions/lib/transferencias.js):
 *   0. com a cobrança DESLIGADA o botão não existe na ficha (caso negativo);
 *   1. Tio A abre a ficha da Ana → "Passar para outro tio" → escolhe o Tio B →
 *      "Enviar pedido"; o pedido no banco guarda só `previa` (primeiro nome e
 *      escola) e a família ainda não o vê (`familiaVe: false`);
 *   2. Tio B, em Comunidade › Tios parceiros, vê "Famílias para você" só com
 *      o primeiro nome e a escola — nada de saúde, foto, valor, endereço ou
 *      telefone, nem na tela nem no banco (a ficha antiga é recusada a ele) —
 *      e toca em "Aceito receber";
 *   3. a família vê o cartão no Início ("Ler e aceitar" / "Quero falar com …"),
 *      lê a folha e toca em "Aceito"; no banco: criança NOVA na turma de B
 *      sem nenhum campo de `CAMPOS_QUE_NUNCA_VAO`, a antiga inativa com
 *      `inativadoEm`, o vínculo da família trocado, e ela ainda lê a
 *      mensalidade e o contrato antigos com o PRÓPRIO token.
 *
 * Os três Chromes têm perfis próprios (t1-tio-a, t1-tio-b, t1-familia). O kit
 * só conhece duas posições de janela: os dois tios abrem no lado do
 * motorista, um por cima do outro.
 *
 * Rodar: node testes-navegador/semear-transferencia.mjs
 *        node testes-navegador/t1-transferencia.mjs
 * Precisa do emulador de FUNCTIONS de pé (meusParceiros, pedirTransferencia,
 * responderTransferencia, aceitarTransferencia são callables).
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit. No fim, a chave
 * `cobrancaLigada` volta ao valor que tinha antes da jornada.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP, garantirSessao, responderCookies } from './lib.mjs';

const P = 'demo-alobuzinou';
const RAIZ = `projects/${P}/databases/(default)/documents`;
const FS = `http://127.0.0.1:8085/v1/${RAIZ}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const SENHA = 'senha-de-teste-123';
// Os mesmos valores de semear-transferencia.mjs (importar de lá rodaria a semente).
const CRIANCA = 't1AnaClara';
const ESCOLA_B = 't1EscolaB';
const MARCA_A = 'Transporte Tio Arnaldo';
const MARCA_B = 'Perua do Tio Bruno';
const CONTA_A = { perfil: 't1-tio-a', painel: '/tio', email: 'tio.a.transferencia@teste.local', senha: SENHA };
const CONTA_B = { perfil: 't1-tio-b', painel: '/tio', email: 'tio.b.transferencia@teste.local', senha: SENHA };
const CONTA_F = { perfil: 't1-familia', painel: '/pai', email: 'familia.transferencia@teste.local', senha: SENHA };

// Espelho de CAMPOS_QUE_NUNCA_VAO (functions/lib/reguaDaTransferencia.js),
// menos os três que `criancaNova` grava DE NOVO de propósito: `status`
// ('home'), `schoolId` (a escola de B) e `statusUpdatedAt` (o servidor).
const NUNCA_VAO = [
  'saudeNotas', 'saudeConsentidaEm', 'photoURL', 'fotoDaTurmaConsentida', 'fotoDaTurmaEm',
  'monthlyFee', 'dueDay', 'vigenciaInicio', 'vigenciaFim', 'contratoVigente', 'contratoAguardando',
  'contractVersion', 'contractAcceptedAt', 'contractAcceptedByUid', 'contractAcceptedName',
  'contractHash', 'contratoAnteriorURL', 'horaPega', 'horaEntrega', 'period', 'pickupPeriod',
  'dropoffPeriod', 'lastStatusCheckpoint', 'altResponsibles', 'notes', 'inviteCode', 'autorizacaoDeclarada',
];
// O que o parceiro NUNCA pode ler antes do aceite — na tela e no pedido.
const SEGREDOS_NA_TELA = [
  /Ribeiro/, /Rua Funchal/, /04551/, /9\s?5555/, /amendoim/i, /380/, /R\$/, /Paula/, /Marcos/, /06:40|6h40/, /portão lateral/,
];

/* ── O banco ─────────────────────────────────────────────────────────────── */

/** Firestore REST → objeto JS (o bastante para conferir). */
function valor(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  if ('mapValue' in v) return objeto(v.mapValue.fields);
  return v;
}
const objeto = (fields = {}) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, valor(v)]));

async function ler(caminho, token = 'owner') {
  const r = await fetch(`${FS}/${caminho}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, doc: r.ok ? objeto((await r.json()).fields) : null };
}
async function onde(colecao, campo, valorStr) {
  const r = await fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: ADM,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valorStr } } },
        limit: 50,
      },
    }),
  }).then((x) => x.json());
  return (Array.isArray(r) ? r : []).filter((x) => x.document)
    .map((x) => ({ id: x.document.name.split('/').pop(), ...objeto(x.document.fields) }));
}
async function chaveDaCobranca(ligada) {
  // Só o campo: o doc tem módulos e o interruptor da avaliação.
  // `null` APAGA o campo (ausente = desligada, como antes da jornada).
  const mascara = 'updateMask.fieldPaths=cobrancaLigada';
  const corpo = ligada === null ? { fields: {} } : { fields: { cobrancaLigada: { booleanValue: ligada } } };
  const r = await fetch(`${FS}/platformConfig/app?${mascara}`, { method: 'PATCH', headers: ADM, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`platformConfig/app: ${r.status} ${await r.text()}`);
}
/** Entra pela API do Auth: o uid e o token de verdade, para ler COMO a pessoa. */
async function tokenDe(email) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  }).then((x) => x.json());
  if (!r.localId) throw new Error(`Sem conta ${email} no emulador: rode semear-transferencia.mjs.`);
  return { uid: r.localId, token: r.idToken };
}

/* ── Os três aparelhos ───────────────────────────────────────────────────── */

const JORNADA = 'T1-transferencia';
// Abrir os três ANTES de qualquer print: cada abrirCelular limpa a pasta da
// jornada. Depois, B e a família ganham subpastas — senão os prints "01-…"
// e o resumo.json de um aparelho sobrescreveriam os do outro.
const A = await abrirCelular('motorista', { jornada: JORNADA, perfil: CONTA_A.perfil });
const Bt = await abrirCelular('motorista', { jornada: JORNADA, perfil: CONTA_B.perfil });
const F = await abrirCelular('responsavel', { jornada: JORNADA, perfil: CONTA_F.perfil });
for (const [cel, sub] of [[Bt, 'tio-b'], [F, 'familia']]) {
  cel.estado.pasta = path.join(cel.estado.pasta, sub);
  mkdirSync(cel.estado.pasta, { recursive: true });
}
A.estado.persona = 'Tio A';
Bt.estado.persona = 'Tio B';

const visivel = (loc) => loc.first().isVisible().catch(() => false);
const textoDaTela = (pg) => pg.evaluate(() => document.body.innerText).catch(() => '');
const r = {};
let chaveAntes;

try {
  const contaA = await tokenDe(CONTA_A.email);
  const contaB = await tokenDe(CONTA_B.email);
  const contaF = await tokenDe(CONTA_F.email);
  chaveAntes = (await ler('platformConfig/app')).doc?.cobrancaLigada ?? null;
  // Liga SÓ depois de guardar o valor de antes (a semente não liga): o
  // `finally` devolve o emulador como estava.
  await chaveDaCobranca(true);
  r.uids = { A: contaA.uid, B: contaB.uid, F: contaF.uid };

  await passo(A.pagina, A.estado, 'entra com a conta do Tio A');
  await garantirSessao(A.pagina, A.estado, CONTA_A);
  await responderCookies(A.pagina);
  await passo(Bt.pagina, Bt.estado, 'entra com a conta do Tio B');
  await garantirSessao(Bt.pagina, Bt.estado, CONTA_B);
  await responderCookies(Bt.pagina);
  await passo(F.pagina, F.estado, 'entra com a conta da família');
  await garantirSessao(F.pagina, F.estado, CONTA_F);
  await responderCookies(F.pagina);

  // ── 0. Cobrança desligada: o botão não existe ──────────────────────────
  const botaoPassar = A.pagina.getByRole('button', { name: 'Passar para outro tio', exact: true });
  await passo(A.pagina, A.estado, '0 · cobrança desligada: a ficha não oferece a passagem');
  await chaveDaCobranca(false);
  await A.pagina.goto(APP + `/tio/children/${CRIANCA}`);
  await esperar(4000);
  r.botaoComCobrancaDesligada = await visivel(botaoPassar);
  await registrar(A.pagina, A.estado, 'A-ficha-cobranca-desligada', { paginaInteira: true });
  if (r.botaoComCobrancaDesligada) {
    achado(A.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'ficha da criança', oque: '"Passar para outro tio" aparece com a cobrança desligada.' });
  }

  // A tela escuta platformConfig ao vivo (useCobrancaLigada): ligar deve
  // bastar. Se não aparecer, recarrega — e anota, porque a escuta falhou.
  await chaveDaCobranca(true);
  await esperar(3000);
  if (!(await visivel(botaoPassar))) {
    r.precisouRecarregar = true;
    await A.pagina.reload();
    await esperar(4000);
  }

  // ── 1. Tio A pede ──────────────────────────────────────────────────────
  await passo(A.pagina, A.estado, '1 · ficha da Ana → Passar para outro tio');
  r.botaoComCobrancaLigada = await visivel(botaoPassar);
  if (!r.botaoComCobrancaLigada) throw new Error('Com a cobrança ligada, "Passar para outro tio" não aparece na ficha da Ana.');
  await tocar(A.pagina, botaoPassar, 'Passar para outro tio');
  const folhaA = A.pagina.getByRole('dialog');
  await folhaA.getByText('Para qual tio parceiro?').waitFor({ timeout: 15000 });
  // A lista vem da callable meusParceiros: "Carregando…" até ela responder.
  const parceiroB = folhaA.getByRole('button', { name: new RegExp(MARCA_B) });
  await parceiroB.first().waitFor({ timeout: 20000 }).catch(() => {});
  await registrar(A.pagina, A.estado, 'A-lista-de-parceiros');
  if (!(await visivel(parceiroB))) {
    r.listaDeParceiros = (await folhaA.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`O Tio B não aparece na lista de parceiros: "${r.listaDeParceiros}"`);
  }
  r.escolasDoParceiroNaLista = (await parceiroB.first().innerText()).replace(/\s+/g, ' ');
  await tocar(A.pagina, parceiroB.first(), MARCA_B);
  await folhaA.getByText(`Passar Ana para ${MARCA_B}`).waitFor({ timeout: 10000 }).catch(() => {});
  r.folhaListaOQueVai = await visivel(folhaA.getByText('Se a família aceitar, vai'));
  r.folhaListaOQueFica = await visivel(folhaA.getByText('Fica com você'));
  await registrar(A.pagina, A.estado, 'A-o-que-vai-e-o-que-fica', { paginaInteira: true });
  await tocar(A.pagina, folhaA.getByRole('button', { name: 'Enviar pedido', exact: true }), 'Enviar pedido');
  r.toastDoPedido = await A.pagina.getByText(`Pedido enviado para ${MARCA_B}.`).first()
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await esperar(1500);
  r.cartaoDoPedidoNaFicha = await visivel(A.pagina.getByText(`Passar para ${MARCA_B}`, { exact: true }));
  r.cancelarNaFicha = await visivel(A.pagina.getByRole('button', { name: 'Cancelar pedido', exact: true }));
  await registrar(A.pagina, A.estado, 'A-pedido-aberto');
  if (!r.toastDoPedido) achado(A.estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'ficha', oque: `Não apareceu "Pedido enviado para ${MARCA_B}."` });
  if (!r.cartaoDoPedidoNaFicha) achado(A.estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'ficha', oque: 'Depois do pedido, a ficha não mostra o cartão do pedido aberto.' });

  // O pedido no banco: só a prévia, e a família ainda cega.
  const pedidos = await onde('transferenciasDeFamilia', 'deUid', contaA.uid);
  const pedido = pedidos.find((t) => t.childId === CRIANCA);
  if (!pedido) throw new Error('Nenhum transferenciasDeFamilia com deUid do Tio A e a Ana.');
  r.pedidoId = pedido.id;
  r.pedidoNoBanco = {
    estado: pedido.estado, paraUid: pedido.paraUid === contaB.uid, familiaUid: pedido.familiaUid === contaF.uid,
    familiaVe: pedido.familiaVe, previa: pedido.previa, marcaDe: pedido.marcaDe, marcaPara: pedido.marcaPara,
    expiraEm: pedido.expiraEm, chaves: Object.keys(pedido).sort(),
  };
  const diasAteExpirar = (Date.parse(pedido.expiraEm) - Date.now()) / 86400000;
  r.pedidoDiasAteExpirar = Math.round(diasAteExpirar * 10) / 10;
  const chavesEsperadas = ['childId', 'criadoEm', 'deUid', 'estado', 'expiraEm', 'familiaUid', 'familiaVe', 'id', 'marcaDe', 'marcaPara', 'paraUid', 'previa'];
  const sobrando = r.pedidoNoBanco.chaves.filter((k) => !chavesEsperadas.includes(k));
  const previaChaves = Object.keys(pedido.previa || {}).sort().join(',');
  if (pedido.estado !== 'pedido' || pedido.familiaVe !== false || pedido.paraUid !== contaB.uid) {
    achado(A.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'banco', oque: `Pedido nasceu ${JSON.stringify({ estado: pedido.estado, familiaVe: pedido.familiaVe })}, e não pedido/false para o Tio B.` });
  }
  if (previaChaves !== 'escola,primeiroNome' || pedido.previa?.primeiroNome !== 'Ana' || !/vila ol/i.test(pedido.previa?.escola || '')) {
    achado(A.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: `A prévia do pedido é ${JSON.stringify(pedido.previa)}, e não só { primeiroNome: 'Ana', escola }.` });
  }
  if (sobrando.length) {
    achado(A.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: `O pedido guarda campos além do esperado: ${sobrando.join(', ')}.` });
  }
  if (diasAteExpirar < 6.9 || diasAteExpirar > 7.1) {
    achado(A.estado, { gravidade: 'atrapalha', lente: 'regra', tela: 'banco', oque: `O pedido vence em ${r.pedidoDiasAteExpirar} dias, e não em 7.` });
  }
  // A família não pode ler o pedido antes do aceite do parceiro (rules).
  r.familiaLePedidoAntes = (await ler(`transferenciasDeFamilia/${pedido.id}`, contaF.token)).status;
  if (r.familiaLePedidoAntes === 200) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: 'A família lê o pedido antes de o parceiro aceitar.' });
  }

  // ── 2. Tio B vê só o primeiro nome e a escola, e aceita ────────────────
  await passo(Bt.pagina, Bt.estado, '2 · Comunidade › Tios parceiros: "Famílias para você"');
  await Bt.pagina.goto(APP + '/tio/comunidade');
  await esperar(2500);
  await tocar(Bt.pagina, Bt.pagina.getByRole('tab', { name: 'Tios parceiros' }), 'Tios parceiros');
  const titulo = Bt.pagina.getByText(`${MARCA_A} quer passar Ana para você`, { exact: true });
  await titulo.waitFor({ timeout: 20000 }).catch(() => {});
  r.tioBVePedido = await visivel(titulo);
  if (!r.tioBVePedido) throw new Error(`O Tio B não vê "${MARCA_A} quer passar Ana para você" na aba Tios parceiros.`);
  const cartaoB = Bt.pagina.locator('div.rounded-2xl', { has: titulo }).first();
  r.cartaoDoTioB = (await cartaoB.innerText()).replace(/\s+/g, ' ').trim();
  r.tioBVeEscola = /vila ol/i.test(r.cartaoDoTioB);
  r.tioBVeAvisoDoContato = await visivel(Bt.pagina.getByText('O endereço e o contato da família chegam quando ela aceitar.'));
  await registrar(Bt.pagina, Bt.estado, 'B-familias-para-voce', { paginaInteira: true });
  // A tela INTEIRA, não só o cartão: nenhum segredo da família antes do aceite.
  const telaB = await textoDaTela(Bt.pagina);
  r.segredosNaTelaDoB = SEGREDOS_NA_TELA.filter((re) => re.test(telaB)).map(String);
  if (r.segredosNaTelaDoB.length) {
    achado(Bt.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'Comunidade', oque: `Antes do aceite, o Tio B vê: ${r.segredosNaTelaDoB.join(', ')}.` });
  }
  if (!r.tioBVeEscola) achado(Bt.estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Comunidade', oque: 'O pedido não diz a escola da criança.' });
  // E no banco: a ficha antiga é recusada ao Tio B (só o pedido é dele).
  r.tioBLeFichaAntiga = (await ler(`children/${CRIANCA}`, contaB.token)).status;
  if (r.tioBLeFichaAntiga === 200) {
    achado(Bt.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: 'O Tio B lê o documento da criança antes do aceite da família.' });
  }
  r.tioBLePedido = (await ler(`transferenciasDeFamilia/${pedido.id}`, contaB.token)).status;

  await tocar(Bt.pagina, cartaoB.getByRole('button', { name: 'Aceito receber', exact: true }), 'Aceito receber');
  r.toastDoTioB = await Bt.pagina.getByText('Aceito. Agora a família decide.').first()
    .waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  await esperar(1500);
  await registrar(Bt.pagina, Bt.estado, 'B-aceitou');
  const depoisDoB = (await ler(`transferenciasDeFamilia/${pedido.id}`)).doc || {};
  r.pedidoDepoisDoB = { estado: depoisDoB.estado, familiaVe: depoisDoB.familiaVe };
  if (depoisDoB.estado !== 'parceiro_aceitou' || depoisDoB.familiaVe !== true) {
    const aviso = !r.toastDoTioB ? (await textoDaTela(Bt.pagina)).match(/assine um plano[^.]*\./i)?.[0] : null;
    throw new Error(`Depois do "Aceito receber" o pedido ficou ${JSON.stringify(r.pedidoDepoisDoB)}${aviso ? ` — a tela disse "${aviso}" (o Tio B não é pagante?)` : ''}.`);
  }

  // ── 3. A família aceita ────────────────────────────────────────────────
  await passo(F.pagina, F.estado, '3 · Início: o cartão da passagem');
  if (!new URL(F.pagina.url()).pathname.startsWith('/pai')) await F.pagina.goto(APP + '/pai');
  const lerEAceitar = F.pagina.getByRole('button', { name: 'Ler e aceitar', exact: true });
  // A escuta é ao vivo (watchTransferenciasDaFamilia); recarrega só se não vier.
  await lerEAceitar.waitFor({ timeout: 15000 }).catch(async () => {
    r.familiaPrecisouRecarregar = true;
    await F.pagina.reload();
    await lerEAceitar.waitFor({ timeout: 15000 }).catch(() => {});
  });
  r.familiaVeCartao = await visivel(lerEAceitar);
  if (!r.familiaVeCartao) throw new Error('A família não vê "Ler e aceitar" no Início.');
  r.fraseDoCartao = await visivel(F.pagina.getByText(`${MARCA_A} vai passar o transporte de Ana para ${MARCA_B}`));
  const falar = F.pagina.getByRole('link', { name: `Quero falar com ${MARCA_A}` });
  r.falarComOTio = await visivel(falar);
  r.falarComOTioHref = r.falarComOTio ? await falar.first().getAttribute('href') : null;
  if (!r.falarComOTio) achado(F.estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Início da família', oque: `Não aparece "Quero falar com ${MARCA_A}".` });
  else if (!/wa\.me\/5511977771111$/.test(r.falarComOTioHref || '')) {
    achado(F.estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Início da família', oque: `"Quero falar com…" leva a ${r.falarComOTioHref}, e não ao WhatsApp do Tio A.` });
  }
  await registrar(F.pagina, F.estado, 'F-cartao-no-inicio', { paginaInteira: true });

  await tocar(F.pagina, lerEAceitar, 'Ler e aceitar');
  const folhaF = F.pagina.getByRole('dialog');
  await folhaF.getByText(`Vai para ${MARCA_B}`).waitFor({ timeout: 10000 }).catch(() => {});
  r.folhaDaFamilia = {
    vai: await visivel(folhaF.getByText(`Vai para ${MARCA_B}`)),
    fica: await visivel(folhaF.getByText(`Fica com ${MARCA_A}`)),
    saudeFica: await visivel(folhaF.getByText('A foto e os dados de saúde')),
  };
  await registrar(F.pagina, F.estado, 'F-folha-o-que-vai', { paginaInteira: true });
  await tocar(F.pagina, folhaF.getByRole('button', { name: 'Aceito', exact: true }), 'Aceito');
  r.toastDaFamilia = await F.pagina.getByText(`Pronto. Agora o transporte é com ${MARCA_B}.`).first()
    .waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  await esperar(2500);
  await registrar(F.pagina, F.estado, 'F-depois-do-aceite', { paginaInteira: true });
  r.cartaoSumiu = !(await visivel(lerEAceitar));

  // ── 3b. O banco depois do aceite ───────────────────────────────────────
  const fim = (await ler(`transferenciasDeFamilia/${pedido.id}`)).doc || {};
  r.pedidoNoFim = { estado: fim.estado, novaCriancaId: fim.novaCriancaId };
  if (fim.estado !== 'concluida' || !fim.novaCriancaId) {
    throw new Error(`Depois do "Aceito" da família o pedido ficou ${JSON.stringify(r.pedidoNoFim)}.`);
  }
  const nova = (await ler(`children/${fim.novaCriancaId}`)).doc || {};
  const antiga = (await ler(`children/${CRIANCA}`)).doc || {};
  const familia = (await ler(`users/${contaF.uid}`)).doc || {};
  r.criancaNova = {
    adminUidEhB: nova.adminUid === contaB.uid, parentUidEhF: nova.parentUid === contaF.uid,
    active: nova.active, status: nova.status, vinculadoPor: nova.vinculadoPor,
    schoolIdEhDeB: nova.schoolId === ESCOLA_B, primeiroMesCobrado: nova.primeiroMesCobrado,
    transferidaDe: nova.transferidaDe, nome: nova.name, endereco: nova.address,
  };
  r.copiadosQueNaoDeviam = NUNCA_VAO.filter((c) => c in nova);
  if (!r.criancaNova.adminUidEhB || !r.criancaNova.parentUidEhF || nova.active !== true) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'banco', oque: `A criança nova não ficou ativa na turma de B com a família: ${JSON.stringify(r.criancaNova)}.` });
  }
  if (r.copiadosQueNaoDeviam.length) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: `Foram copiados para o Tio B: ${r.copiadosQueNaoDeviam.join(', ')}.` });
  }
  if (!r.criancaNova.schoolIdEhDeB) {
    achado(F.estado, { gravidade: 'atrapalha', lente: 'regra', tela: 'banco', oque: `A escola não casou com a do Tio B pelo nome (schoolId = ${nova.schoolId}).` });
  }
  if (nova.name !== 'Ana Clara Ribeiro' || !/Rua Funchal, 210/.test(nova.address || '') || nova.parentPhone !== '(11) 95555-3333') {
    achado(F.estado, { gravidade: 'atrapalha', lente: 'regra', tela: 'banco', oque: 'Nome, endereço ou WhatsApp da família não foram para a criança nova.' });
  }
  // O histórico também não vai: nenhuma viagem e nenhum contrato na nova.
  const sub = async (s) => ((await fetch(`${FS}/children/${fim.novaCriancaId}/${s}`, { headers: ADM }).then((x) => x.json())).documents || []).length;
  r.novaTemViagens = await sub('rides');
  r.novaTemContratos = await sub('contratos');
  if (r.novaTemViagens || r.novaTemContratos) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: `A criança nova nasceu com ${r.novaTemViagens} viagens e ${r.novaTemContratos} contratos da antiga.` });
  }

  r.criancaAntiga = {
    active: antiga.active, inativadoEm: antiga.inativadoEm || null, adminUidAindaEhA: antiga.adminUid === contaA.uid,
    transferidaParaB: antiga.transferidaPara?.uid === contaB.uid, saudeFicou: !!antiga.saudeNotas,
  };
  if (antiga.active !== false || !antiga.inativadoEm || !r.criancaAntiga.transferidaParaB || !r.criancaAntiga.adminUidAindaEhA) {
    achado(A.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'banco', oque: `A criança antiga não saiu como devia: ${JSON.stringify(r.criancaAntiga)}.` });
  }

  r.vinculoDaFamilia = {
    childIds: familia.childIds, adminUid: familia.adminUid === contaB.uid ? 'B' : familia.adminUid === contaA.uid ? 'A' : familia.adminUid,
    adminUidsTemB: (familia.adminUids || []).includes(contaB.uid), adminUidsTemA: (familia.adminUids || []).includes(contaA.uid),
  };
  if (!(familia.childIds || []).includes(fim.novaCriancaId) || (familia.childIds || []).includes(CRIANCA) || !r.vinculoDaFamilia.adminUidsTemB) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'banco', oque: `O vínculo da família não trocou: ${JSON.stringify(r.vinculoDaFamilia)}.` });
  }
  // Sem nada em aberto com A (a semente só tem mensalidade paga), A sai da lista.
  if (r.vinculoDaFamilia.adminUidsTemA) {
    achado(F.estado, { gravidade: 'melhoria', lente: 'regra', tela: 'banco', oque: 'O Tio A continuou em adminUids sem mensalidade em aberto nem outra criança ativa.' });
  }

  // A família continua lendo o que já foi — com o PRÓPRIO token, pelas rules.
  const pagamentos = await onde('payments', 'childId', CRIANCA);
  r.mensalidadesAntigas = pagamentos.length;
  r.familiaLeMensalidadeAntiga = pagamentos.length
    ? (await ler(`payments/${pagamentos[0].id}`, contaF.token)).status
    : 'sem mensalidade semeada';
  r.familiaLeContratoAntigo = (await ler(`children/${CRIANCA}/contratos/1`, contaF.token)).status;
  r.familiaLeFichaAntiga = (await ler(`children/${CRIANCA}`, contaF.token)).status;
  if (r.familiaLeMensalidadeAntiga !== 200) {
    achado(F.estado, { gravidade: 'bloqueia', lente: 'dinheiro', tela: 'banco', oque: `Depois da passagem, a família não lê a mensalidade antiga (HTTP ${r.familiaLeMensalidadeAntiga}).` });
  }
  if (r.familiaLeContratoAntigo !== 200) {
    achado(F.estado, { gravidade: 'atrapalha', lente: 'regra', tela: 'banco', oque: `Depois da passagem, a família não lê o contrato antigo (HTTP ${r.familiaLeContratoAntigo}).` });
  }
  // E o Tio B agora lê a criança NOVA, nunca a antiga.
  r.tioBLeNova = (await ler(`children/${fim.novaCriancaId}`, contaB.token)).status;
  r.tioBLeAntigaDepois = (await ler(`children/${CRIANCA}`, contaB.token)).status;
  if (r.tioBLeNova !== 200) achado(Bt.estado, { gravidade: 'bloqueia', lente: 'regra', tela: 'banco', oque: `O Tio B não lê a criança nova (HTTP ${r.tioBLeNova}).` });
  if (r.tioBLeAntigaDepois === 200) achado(Bt.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'banco', oque: 'O Tio B lê a ficha antiga (com a saúde) depois da passagem.' });

  // ── 3c. As duas telas dos tios depois ──────────────────────────────────
  await passo(Bt.pagina, Bt.estado, '3 · a Ana na turma do Tio B');
  await Bt.pagina.goto(APP + `/tio/children/${fim.novaCriancaId}`);
  await esperar(3500);
  await registrar(Bt.pagina, Bt.estado, 'B-ficha-da-ana-nova', { paginaInteira: true });
  const fichaB = await textoDaTela(Bt.pagina);
  r.fichaDoBMostraSaude = /amendoim/i.test(fichaB);
  if (r.fichaDoBMostraSaude) achado(Bt.estado, { gravidade: 'bloqueia', lente: 'privacidade', tela: 'ficha do Tio B', oque: 'A ficha nova mostra a saúde da Ana.' });

  await passo(A.pagina, A.estado, '3 · a ficha antiga no Tio A');
  await A.pagina.reload();
  await esperar(3500);
  r.fichaAntigaAindaOferecePassar = await visivel(botaoPassar);
  await registrar(A.pagina, A.estado, 'A-ficha-depois', { paginaInteira: true });
  if (r.fichaAntigaAindaOferecePassar) {
    achado(A.estado, { gravidade: 'atrapalha', lente: 'regra', tela: 'ficha do Tio A', oque: 'A criança já passada ainda oferece "Passar para outro tio".' });
  }
} catch (err) {
  console.error(err);
  achado(A.estado, { gravidade: 'bloqueia', lente: 'teste', tela: '—', oque: `A jornada parou: ${err.message}` });
  for (const cel of [A, Bt, F]) await registrar(cel.pagina, cel.estado, 'zz-onde-parou').catch(() => {});
} finally {
  // As outras jornadas contam com a cobrança como estava antes desta.
  if (chaveAntes !== undefined) await chaveDaCobranca(chaveAntes === true ? true : chaveAntes === false ? false : null).catch(() => {});
}

A.estado.resultado = r;
r.achados = [A, Bt, F].flatMap((c) => c.estado.achados.map((a) => ({ aparelho: c.estado.persona, ...a })));
console.log(JSON.stringify(r, null, 2));
await encerrar(Bt.contexto, Bt.pagina, Bt.estado, { manterAberto: 0 });
await encerrar(F.contexto, F.pagina, F.estado, { manterAberto: 0 });
await encerrar(A.contexto, A.pagina, A.estado);
