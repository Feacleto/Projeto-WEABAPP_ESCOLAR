/**
 * TESTE DAS REGRAS DO FIRESTORE, CONTRA O EMULADOR.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A auditoria anterior encontrou onze furos de isolamento entre motoristas —
 * todos sondando o ambiente PUBLICADO, com contas reais. Isso funciona, mas
 * tem dois problemas: só testa o que já está no ar (regra nova em arquivo não
 * é testável) e escreve dado de teste em produção.
 *
 * Aqui as mesmas perguntas são feitas ao emulador, contra o `firestore.rules`
 * do disco. Roda antes do deploy, não depois.
 *
 * COMO RODAR
 *   npx firebase emulators:start --only auth,firestore
 *   node scripts/testar-regras.mjs
 *
 * CADA BLOCO TEM SONDA POSITIVA E NEGATIVA, E ISSO NÃO É ZELO
 * Sonda negativa sozinha passa verde esteja a regra publicada ou não — se o
 * emulador estiver com o arquivo errado, ou se um `match` inteiro sumir, tudo
 * vira 403 e o relatório fica todo verde pelo motivo mais errado possível.
 * A positiva é o que prova que o teste está falando com a regra certa.
 *
 * E O ATOR PRECISA SER CONFERIDO ANTES
 * Numa rodada anterior o provisionamento do segundo motorista falhou em
 * silêncio. Os 403 seguintes pareciam isolamento; eram um usuário sem papel
 * nenhum. `conferirElenco()` existe por causa disso: se o elenco não está de
 * pé, o teste aborta em vez de mentir.
 */

import { readFile } from 'node:fs/promises';

const PID = 'alobuzinou-be81f';
// O ENDEREÇO VEM DO EMULADOR, não escrito à mão (04/10/2026). O
// `emulators:exec` exporta onde subiu cada um; com as portas fixas, um
// emulador em outra porta (para não brigar com outra sessão aberta) fazia o
// teste rodar contra o emulador ALHEIO, cheio de dados velhos — e as falhas
// "409 já existe" e "403" pareciam defeito das regras.
const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const HOST_FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const AUTH = `http://${HOST_AUTH}/identitytoolkit.googleapis.com/v1/accounts`;
const FS = `http://${HOST_FS}/v1/projects/${PID}/databases/(default)/documents`;

// O emulador aceita este bearer como Admin SDK: ignora regras. É como o
// cenário é montado — semear passando pelas regras testaria a semeadura, não
// o caso.
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const H = (s) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${s.t}` });

const S = (v) => ({ stringValue: v });
const B = (v) => ({ booleanValue: v });
const N = (v) => ({ doubleValue: v });
/** Timestamp. `dias` negativos = no passado. */
const T = (dias) => ({
  timestampValue: new Date(Date.now() + dias * 86400000).toISOString(),
});

let ok = 0;
let bad = 0;
const falhas = [];

function checar(bloco, nome, esperado, status) {
  const passou = esperado === 'PASSA' ? status === 200 : status !== 200;
  const marca = passou ? '  ok ' : ' FALHA';
  console.log(`${marca} ${nome.padEnd(52)} ${esperado.padEnd(5)} → ${status}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`[${bloco}] ${nome} — esperado ${esperado}, veio ${status}`);
  }
}

async function criarLogin(email) {
  const r = await fetch(`${AUTH}:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Teste123!', returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${email}: ${j.error.message}`);
  return { uid: j.localId, t: j.idToken };
}

/**
 * SESSAO ANONIMA — o ator que faltava, e que motivou metade das correcoes
 * deste arquivo.
 *
 * A landing chama `signInAnonymously` pra gravar lead. Isso significa que
 * qualquer VISITANTE do site passa em `isSignedIn()`. Toda regra que para
 * nesse predicado esta aberta pra internet, e ate aqui nenhum teste tinha
 * como perceber: o elenco so tinha gente com papel.
 */
async function criarAnonimo() {
  const r = await fetch(`${AUTH}:signUp?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`anonimo: ${j.error.message}`);
  return { uid: j.localId, t: j.idToken };
}

// ⚠️ `semear` SUBSTITUI o documento inteiro — é PATCH sem `updateMask`, e o
// Firestore trata isso como escrita completa. Semear `{ plano }` sobre um
// usuário APAGA `role`, `trialInicio` e o resto, e o caso seguinte falha por
// um motivo que não tem nada a ver com a regra sendo testada. Aconteceu.
//
// Para acrescentar campo, repita o documento inteiro.
const semear = (caminho, fields) =>
  fetch(`${FS}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });

const ler = (caminho, s) => fetch(`${FS}/${caminho}`, { headers: H(s) }).then((r) => r.status);

const escrever = (caminho, s, fields, mascara) =>
  fetch(`${FS}/${caminho}${mascara ? `?${mascara.map((m) => `updateMask.fieldPaths=${m}`).join('&')}` : ''}`, {
    method: 'PATCH',
    headers: H(s),
    body: JSON.stringify({ fields }),
  }).then((r) => r.status);

const criar = (col, id, s, fields) =>
  fetch(`${FS}/${col}?documentId=${id}`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({ fields }),
  }).then((r) => r.status);

const apagar = (caminho, s) =>
  fetch(`${FS}/${caminho}`, { method: 'DELETE', headers: H(s) }).then((r) => r.status);

const consultar = (col, campo, valor, s) =>
  fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } },
        },
        limit: 20,
      },
    }),
  }).then((r) => r.status);

const listar = (col, s) => fetch(`${FS}/${col}?pageSize=50`, { headers: H(s) }).then((r) => r.status);

/** A vitrine pública da home. `comFiltro` inclui `hiddenByOwner == false`. */
function consultaVitrine(s, comFiltro) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'allowTestimonial' }, op: 'EQUAL', value: B(true) } },
  ];
  if (comFiltro) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'hiddenByOwner' }, op: 'EQUAL', value: B(false) },
    });
  }
  return fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'feedbacks' }],
        where: { compositeFilter: { op: 'AND', filters } },
        limit: 50,
      },
    }),
  }).then((r) => r.status);
}

/** "Você já avaliou antes" — o autor procurando a própria avaliação. */
function consultaMinhaAvaliacao(s) {
  return fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'feedbacks' }],
        where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: S(s.uid) } },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 1,
      },
    }),
  }).then((r) => r.status);
}

/**
 * A consulta do caderno do responsável, como o cliente a monta.
 * Com `adminUid` null, monta a versão antiga (só array-contains) — que a regra
 * nova recusa inteira.
 */
function consultaAgenda(s, adminUid) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'parentUids' }, op: 'ARRAY_CONTAINS', value: S(s.uid) } },
  ];
  if (adminUid) {
    filters.push({ fieldFilter: { field: { fieldPath: 'scope' }, op: 'EQUAL', value: S('school') } });
    filters.push({ fieldFilter: { field: { fieldPath: 'adminUid' }, op: 'EQUAL', value: S(adminUid) } });
  }
  return fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'agendaEntries' }],
        where: { compositeFilter: { op: 'AND', filters } },
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 50,
      },
    }),
  }).then((r) => r.status);
}

async function main() {
  console.log('\n═══ elenco ═══');
  const dono = await criarLogin(`dono.${Date.now()}@teste.local`);
  const tio1 = await criarLogin(`tio1.${Date.now()}@teste.local`);
  const tio2 = await criarLogin(`tio2.${Date.now()}@teste.local`);
  const pai1 = await criarLogin(`pai1.${Date.now()}@teste.local`);
  // `novato` e o ator que a AUTOINSCRICAO criou: um motorista de verdade,
  // com conta legitima, zero criancas e zero vinculo. Ele nao existia antes
  // porque `role: 'admin'` so nascia com aprovacao do dono — e e exatamente
  // por isso que ele precisa existir agora: e o perfil que passa a existir aos
  // milhares, e o unico que exercita "isAdmin() sem nada por tras".
  //
  // O antigo `espera` (role 'aguardando') morreu com a fila.
  const novato = await criarLogin(`novato.${Date.now()}@teste.local`);
  const anon = await criarAnonimo();

  await semear(`users/${dono.uid}`, { role: S('owner'), name: S('Dono') });
  await semear(`users/${tio1.uid}`, { role: S('admin'), name: S('Tio Um') });
  await semear(`users/${tio2.uid}`, { role: S('admin'), name: S('Tio Dois') });
  await semear(`users/${pai1.uid}`, {
    role: S('parent'),
    name: S('Pai Um'),
    adminUid: S(tio1.uid),
    childId: S('kid1'),
  });
  await semear(`users/${novato.uid}`, { role: S('admin'), name: S('Novato') });
  await semear('appState/init', { hasAdmin: B(true), adminUid: S(tio1.uid) });

  await semear('children/kid1', {
    name: S('Ana'),
    adminUid: S(tio1.uid),
    parentUid: S(pai1.uid),
    active: B(true),
    monthlyFee: N(300),
  });
  await semear('children/kid2', {
    name: S('Beto'),
    adminUid: S(tio2.uid),
    parentUid: S('outro'),
    active: B(true),
    monthlyFee: N(300),
  });

  // Documentos do tio1 que o tio2 vai tentar alcançar.
  await semear('schools/esc1', { adminUid: S(tio1.uid), nome: S('EMEF Vila Nova') });
  await semear('expenses/desp1', { adminUid: S(tio1.uid), monthKey: S('2026-08'), amount: N(120) });
  await semear('children/kid1/rides/2026-08-25', { posicao: { integerValue: '1' } });
  await semear('absenceDeclarations/2026-08-25_kid1', {
    adminUid: S(tio1.uid),
    childId: S('kid1'),
    dateKey: S('2026-08-25'),
    declaredBy: S('admin'),
  });
  await semear('altPickups/ap1', {
    adminUid: S(tio1.uid),
    childId: S('kid1'),
    nome: S('Vovó Marta'),
    telefone: S('11999998888'),
  });
  await semear('agendaEntries/ag1', {
    adminUid: S(tio1.uid),
    childId: S('kid1'),
    scope: S('child'),
    message: S('recado'),
  });
  await semear('schoolBroadcasts/br1', {
    adminUid: S(tio1.uid),
    createdBy: S(tio1.uid),
    schoolName: S('EMEF Vila Nova'),
  });
  await semear('liveLocation/' + tio1.uid, { routeActive: B(true), lat: N(-23.1) });

  console.log('elenco montado — conferindo antes de confiar em qualquer 403:');
  await conferirElenco(tio1, tio2, pai1, dono);

  // ── o app tem que continuar funcionando ────────────────────────────────
  console.log('\n═══ POSITIVAS — sem estas, todo 403 abaixo é mentira ═══');
  checar('pos', 'tio1 lê a própria criança', 'PASSA', await ler('children/kid1', tio1));
  checar('pos', 'pai lê o próprio filho', 'PASSA', await ler('children/kid1', pai1));
  checar('pos', 'tio1 lê a própria escola', 'PASSA', await ler('schools/esc1', tio1));
  checar('pos', 'tio1 lê a própria despesa', 'PASSA', await ler('expenses/desp1', tio1));
  checar('pos', 'tio1 escreve a viagem da criança dele', 'PASSA',
    await escrever('children/kid1/rides/2026-08-25', tio1, { posicao: { integerValue: '2' } }, ['posicao']));
  checar('pos', 'pai lê a viagem do próprio filho', 'PASSA', await ler('children/kid1/rides/2026-08-25', pai1));
  checar('pos', 'tio1 escreve a própria posição', 'PASSA',
    await escrever(`liveLocation/${tio1.uid}`, tio1, { lat: N(-23.2) }, ['lat']));
  checar('pos', 'tio1 lê a própria ausência', 'PASSA', await ler('absenceDeclarations/2026-08-25_kid1', tio1));
  checar('pos', 'dono lista users', 'PASSA', await listar('users', dono));
  checar('pos', 'tio1 consulta as escolas dele', 'PASSA', await consultar('schools', 'adminUid', tio1.uid, tio1));

  // ── isolamento entre motoristas ────────────────────────────────────────
  console.log('\n═══ ISOLAMENTO — tio2 alcançando o dado do tio1 ═══');
  checar('iso', 'tio2 lê a criança do tio1', 'NEGA', await ler('children/kid1', tio2));
  checar('iso', 'tio2 lê a escola do tio1', 'NEGA', await ler('schools/esc1', tio2));
  checar('iso', 'tio2 altera a escola do tio1', 'NEGA',
    await escrever('schools/esc1', tio2, { nome: S('roubada') }, ['nome']));
  checar('iso', 'tio2 apaga a escola do tio1', 'NEGA', await apagar('schools/esc1', tio2));
  checar('iso', 'tio2 lê a despesa do tio1', 'NEGA', await ler('expenses/desp1', tio2));
  checar('iso', 'tio2 altera a despesa do tio1', 'NEGA',
    await escrever('expenses/desp1', tio2, { amount: N(999) }, ['amount']));
  checar('iso', 'tio2 lê a viagem da criança do tio1', 'NEGA', await ler('children/kid1/rides/2026-08-25', tio2));
  checar('iso', 'tio2 escreve na viagem da criança do tio1', 'NEGA',
    await escrever('children/kid1/rides/2026-08-25', tio2, { posicao: { integerValue: '9' } }, ['posicao']));
  checar('iso', 'tio2 escreve na posição do tio1', 'NEGA',
    await escrever(`liveLocation/${tio1.uid}`, tio2, { lat: N(-99) }, ['lat']));

  console.log('\n═══ ISOLAMENTO — operação do dia ═══');
  checar('op', 'tio2 lê a ausência da criança do tio1', 'NEGA',
    await ler('absenceDeclarations/2026-08-25_kid1', tio2));
  checar('op', 'tio2 ALTERA a ausência da criança do tio1', 'NEGA',
    await escrever('absenceDeclarations/2026-08-25_kid1', tio2, { declaredBy: S('admin') }, ['declaredBy']));
  checar('op', 'tio2 APAGA a ausência da criança do tio1', 'NEGA',
    await apagar('absenceDeclarations/2026-08-25_kid1', tio2));
  checar('op', 'tio2 marca falta na criança do tio1', 'NEGA',
    // Id ÚNICO por rodada, de propósito.
    //
    // Na primeira versão o id era fixo. A rodada 1 criou o documento (o furo
    // era real), e a rodada 2 recebeu 409 por ele já existir — que o teste leu
    // como "negado, passou". Verde pelo motivo errado, exatamente o que este
    // arquivo existe pra impedir: um `create` só é testável contra um id que
    // ainda não existe.
    await criar('absenceDeclarations', `2026-08-26_kid1_${Date.now()}`, tio2, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S('2026-08-26'), declaredBy: S('admin'),
    }));
  checar('op', 'tio2 lê quem busca a criança do tio1', 'NEGA', await ler('altPickups/ap1', tio2));
  checar('op', 'tio2 altera quem busca a criança do tio1', 'NEGA',
    await escrever('altPickups/ap1', tio2, { nome: S('estranho') }, ['nome']));
  checar('op', 'tio2 lê o recado do tio1', 'NEGA', await ler('agendaEntries/ag1', tio2));
  checar('op', 'tio2 lê o aviso de escola do tio1', 'NEGA', await ler('schoolBroadcasts/br1', tio2));

  // ── privilégio ─────────────────────────────────────────────────────────
  console.log('\n═══ PRIVILÉGIO ═══');
  checar('priv', 'tio2 reescreve a pixKey do tio1', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio2, { pixKey: S('roubada') }, ['pixKey']));
  checar('priv', 'tio2 lista users', 'NEGA', await listar('users', tio2));
  checar('priv', 'tio2 apaga o doc do dono', 'NEGA', await apagar(`users/${dono.uid}`, tio2));
  checar('priv', 'tio2 se promove a superAdmin', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio2, { superAdmin: B(true) }, ['superAdmin']));
  checar('priv', 'tio2 reaponta appState/init', 'NEGA',
    await escrever('appState/init', tio2, { adminUid: S(tio2.uid) }, ['adminUid']));
  checar('priv', 'tio2 apaga appState/init (elo 1 da escalada)', 'NEGA', await apagar('appState/init', tio2));

  // ── users/{uid} escopado por vínculo ───────────────────────────────────
  //
  // O `|| isAdmin()` solto do `allow get` saiu em 06/09/2026, e este bloco é
  // o que prova. Ele deixava QUALQUER motorista ler o doc de QUALQUER
  // usuário — nome, e-mail, telefone e CHAVE PIX de toda a base, bastando o
  // uid (que o `allow list` público de `feedbacks` já entrega).
  //
  // Era furo conhecido e assumido, segurado pela APROVAÇÃO: `role: 'admin'`
  // só existia depois do aval do dono. Com a entrada por autoatendimento,
  // "quem passa aqui" deixa de ser um conjunto escolhido a dedo e vira
  // qualquer pessoa com um e-mail — e o mesmo furo vira a base inteira a um
  // getDocs de distância.
  checar('priv', 'tio1 lê o doc do responsável DELE', 'PASSA',
    await ler(`users/${pai1.uid}`, tio1));
  checar('priv', 'tio2 lê o doc do responsável de OUTRA perua', 'NEGA',
    await ler(`users/${pai1.uid}`, tio2));
  checar('priv', 'tio2 lê o doc de outro motorista', 'NEGA',
    await ler(`users/${tio1.uid}`, tio2));
  checar('priv', 'tio2 lê o doc do dono', 'NEGA', await ler(`users/${dono.uid}`, tio2));
  checar('priv', 'o dono lê o doc de um motorista', 'PASSA',
    await ler(`users/${tio1.uid}`, dono));
  // A outra ponta, que já valia e continua valendo: sem ela o responsável
  // perde a chave PIX e o telefone de quem leva o filho dele.
  checar('priv', 'o pai lê o doc do motorista dele', 'PASSA',
    await ler(`users/${tio1.uid}`, pai1));
  checar('priv', 'o pai lê o doc de OUTRO motorista', 'NEGA',
    await ler(`users/${tio2.uid}`, pai1));

  // ── o pai não passa do próprio quintal ─────────────────────────────────
  console.log('\n═══ O RESPONSÁVEL ═══');
  checar('pai', 'pai lê a criança de outro motorista', 'NEGA', await ler('children/kid2', pai1));
  checar('pai', 'pai escreve na viagem do próprio filho', 'NEGA',
    await escrever('children/kid1/rides/2026-08-25', pai1, { posicao: { integerValue: '5' } }, ['posicao']));
  checar('pai', 'pai lê a despesa do motorista', 'NEGA', await ler('expenses/desp1', pai1));
  checar('pai', 'pai lê a escola (dado do motorista)', 'NEGA', await ler('schools/esc1', pai1));
  checar('pai', 'pai lê a posição do motorista dele', 'PASSA', await ler(`liveLocation/${tio1.uid}`, pai1));
  checar('pai', 'pai lê a posição de OUTRO motorista', 'NEGA', await ler(`liveLocation/${tio2.uid}`, pai1));

  // ── correspondência, suporte e caderno ─────────────────────────────────
  console.log('\n═══ CORRESPONDÊNCIA E SUPORTE ═══');
  await semear('notifications/n1', {
    userId: S(pai1.uid), type: S('absence'), title: S('aviso'),
    createdAt: { timestampValue: '2026-08-25T09:00:00Z' },
  });
  await semear('supportTickets/t1', {
    uid: S(pai1.uid), role: S('parent'), category: S('bug'),
    description: S('texto livre com nomes'), status: S('open'),
    createdAt: { timestampValue: '2026-08-25T09:00:00Z' },
  });
  await semear('pendingCalls/pc1', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childName: S('Ana'),
  });
  await semear('agendaEntries/ag2', {
    adminUid: S(tio1.uid), scope: S('school'), message: S('reunião'),
    parentUids: { arrayValue: { values: [S(pai1.uid)] } },
  });

  checar('pos', 'o destinatário lê a própria notificação', 'PASSA', await ler('notifications/n1', pai1));
  checar('pos', 'o pai lê o recado de escola do motorista dele', 'PASSA', await ler('agendaEntries/ag2', pai1));
  checar('pos', 'o dono lê um chamado de suporte', 'PASSA', await ler('supportTickets/t1', dono));

  checar('corr', 'tio2 lê a notificação do pai do tio1', 'NEGA', await ler('notifications/n1', tio2));
  checar('corr', 'tio2 apaga a notificação do pai do tio1', 'NEGA', await apagar('notifications/n1', tio2));
  checar('corr', 'tio2 injeta aviso na caixa do pai do tio1', 'NEGA',
    await criar('notifications', `phish_${Date.now()}`, tio2, {
      userId: S(pai1.uid), type: S('info'), title: S('Pague neste PIX'),
      createdAt: { timestampValue: '2026-08-25T09:00:00Z' },
    }));
  checar('corr', 'tio2 lê o chamado de suporte do pai do tio1', 'NEGA', await ler('supportTickets/t1', tio2));
  checar('corr', 'tio2 lê a buzina da família do tio1', 'NEGA', await ler('pendingCalls/pc1', tio2));
  // O recado plantado: tio2 grava com adminUid DELE e o uid do pai do tio1 na
  // lista. A regra confere se o leitor é cliente de quem publicou.
  await semear('agendaEntries/ag3', {
    adminUid: S(tio2.uid), scope: S('school'), message: S('recado plantado'),
    parentUids: { arrayValue: { values: [S(pai1.uid)] } },
  });
  checar('corr', 'recado plantado por tio2 não entra no caderno do pai', 'NEGA',
    await ler('agendaEntries/ag3', pai1));

  checar('corr', 'pai declara falta com adminUid de outro motorista', 'NEGA',
    await criar('absenceDeclarations', `forjada_${Date.now()}`, pai1, {
      adminUid: S(tio2.uid), childId: S('kid1'), dateKey: S('2026-08-27'),
      declaredBy: S('parent'),
    }));
  checar('pos', 'pai declara falta com o adminUid certo', 'PASSA',
    await criar('absenceDeclarations', `legitima_${Date.now()}`, pai1, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S('2026-08-28'),
      declaredBy: S('parent'),
    }));

  checar('corr', 'campo fora da whitelist em rides', 'NEGA',
    await escrever('children/kid1/rides/2026-08-25', tio1, { inventado: S('x') }, ['inventado']));

  // O PAYLOAD REAL, campo por campo.
  //
  // A whitelist de `rides` é uma lista escrita à mão, e lista escrita à mão
  // erra por omissão. Um probe meu usou `embarcouEm` — nome que o serviço não
  // grava — levou 403 e por um momento pareceu que eu tinha quebrado o
  // rastreador em produção. O caso abaixo copia o que `anotarMarco` e
  // `publicarOrdemDoDia` mandam de verdade: se alguém adicionar um campo ao
  // serviço e esquecer da regra, quebra AQUI, e não na rota do motorista.
  checar('pos', 'anotarMarco com o payload real', 'PASSA',
    await escrever('children/kid1/rides/2026-08-25', tio1, {
      dateKey: S('2026-08-25'), childId: S('kid1'),
      adminUid: S(tio1.uid), parentUid: S(pai1.uid),
      marcos: { mapValue: { fields: { embarcou: { timestampValue: '2026-08-25T09:20:00Z' } } } },
      combinado: { mapValue: { fields: { ida: S('06:20') } } },
      atualizadoEm: { timestampValue: '2026-08-25T09:20:00Z' },
    }));

  // ⚠️ `checkpoints` SAIU DA WHITELIST EM 11/09/2026, E A RECUSA É O TESTE.
  //
  // Ele guardava, por status, onde o veículo do motorista estava na hora da
  // marcação — e o dono decidiu que o registro é "entregou, e a que horas",
  // sem nada de lugar. O código parou de escrever; **campo sem gravador que
  // segue permitido é campo livre**, e é o argumento que manteve
  // `limiteCriancas` proibido depois de ele sair do modelo.
  //
  // Sem este caso, o conserto é uma linha de código que qualquer alteração
  // futura desfaz sem nada reclamar.
  checar('corr', 'checkpoints não entra mais em rides', 'NEGA',
    await escrever('children/kid1/rides/2026-08-25', tio1, {
      checkpoints: { mapValue: { fields: { embarcou: { mapValue: { fields: { lat: N(-23.1) } } } } } },
    }, ['checkpoints']));
  checar('pos', 'publicarOrdemDoDia com o payload real', 'PASSA',
    await escrever('children/kid1/rides/2026-08-25', tio1, {
      dateKey: S('2026-08-25'), childId: S('kid1'),
      adminUid: S(tio1.uid), parentUid: S(pai1.uid),
      combinado: { mapValue: { fields: { ida: S('06:20'), volta: S('12:35') } } },
      ordemIda: { integerValue: '1' }, totalIda: { integerValue: '3' },
      ordemVolta: { integerValue: '2' }, totalVolta: { integerValue: '3' },
      atualizadoEm: { timestampValue: '2026-08-25T09:20:00Z' },
    }));

  // A CONSULTA, não só a leitura de um documento.
  //
  // Regra e consulta são coisas separadas: o Firestore recusa a consulta
  // INTEIRA quando ela não prova cada condição da regra — não devolve "a parte
  // que você pode". O sintoma é o caderno do pai abrindo vazio, sem erro na
  // tela e sem nada no console. Ao apertar `agendaEntries` eu quebrei
  // exatamente isso, e só apareceu porque este caso existe.
  checar('lista', 'a consulta do caderno do pai (scope + adminUid)', 'PASSA',
    await consultaAgenda(pai1, tio1.uid));
  checar('lista', 'a mesma consulta sem provar o escopo', 'NEGA',
    await consultaAgenda(pai1, null));

  // ── dinheiro, moderação e aceite ────────────────────────────────────────
  console.log('\n═══ DINHEIRO, MODERAÇÃO E ACEITE ═══');
  await semear('children/kid3', {
    name: S('Ciça'), adminUid: S(tio1.uid), parentUid: S(pai1.uid),
    active: B(true), monthlyFee: N(300),
    contractAcceptedAt: { timestampValue: '2026-08-01T09:00:00Z' },
    contractAcceptedByUid: S(pai1.uid), contractHash: S('hash-original'),
  });
  checar('aceite', 'pai reescreve um contrato já aceito', 'NEGA',
    await escrever('children/kid3', pai1, {
      contractHash: S('hash-trocado'),
      contractAcceptedByUid: S(pai1.uid),
    }, ['contractHash', 'contractAcceptedByUid']));
  // Era PASSA até 02/10/2026: o aceite agora é da callable `aceitarContrato`,
  // sobre a versão gravada — nenhum cliente escreve aceite. Ver "O ACEITE".
  checar('aceite', 'pai NÃO grava o aceite pelo cliente (é do servidor)', 'NEGA',
    await escrever('children/kid1', pai1, {
      contractVersion: S('v1'),
      contractAcceptedAt: { timestampValue: '2026-08-25T09:00:00Z' },
      contractAcceptedByUid: S(pai1.uid),
      contractAcceptedName: S('Pai Um'),
      contractHash: S('hash'),
      contractUserAgent: S('probe'),
    }, ['contractVersion', 'contractAcceptedAt', 'contractAcceptedByUid',
        'contractAcceptedName', 'contractHash', 'contractUserAgent']));

  // A vitrine da home é alimentada por LIST, não por get — foi exatamente por
  // isso que a moderação não funcionava: o `get` filtrava `hiddenByOwner` e o
  // `list` não. Medir a CONSULTA é o que importa aqui.
  await semear('feedbacks/f1', {
    uid: S(pai1.uid), role: S('parent'), rating: N(5),
    comment: S('ótimo'), allowTestimonial: B(true), hiddenByOwner: B(false),
    createdAt: { timestampValue: '2026-08-20T09:00:00Z' },
  });
  checar('moderacao', 'vitrine sem provar hiddenByOwner é recusada', 'NEGA',
    await consultaVitrine(pai1, false));
  checar('pos', 'a vitrine provando o filtro carrega', 'PASSA',
    await consultaVitrine(pai1, true));
  checar('pos', 'o autor encontra a própria avaliação', 'PASSA',
    await consultaMinhaAvaliacao(pai1));

  await tetoDeGets(tio1);
  await vagaContratada(tio1, tio2);
  await oQueNinguemTestava({ tio1, tio2, pai1, dono, novato, anon });
  await decisao12({ tio1, tio2, pai1, novato, dono });
  await oAceite({ tio1, tio2, pai1 });
  await oTesteDeCodigo({ tio1, tio2, pai1, dono });
  await aRotaSemSenha({ tio1, tio2, pai1 });
  await oCodigoDeIndicacao({ tio1 });
  await aAuxiliar({ pai1 });
  await aAuxiliarNoDinheiro({ pai1, novato, dono, anon });
  await aAuditoriaDeSeguranca({ tio1, tio2, pai1, novato, dono });
  await oFinanceiroTrancado({ tio2, pai1, novato, dono, anon });
  await osNiveis({ tio1, tio2, pai1, dono, anon });

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${ok} passaram, ${bad} falharam`);
  if (falhas.length) {
    console.log(`${'─'.repeat(64)}`);
    falhas.forEach((f) => console.log('  ✗ ' + f));
  }
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(bad > 0 ? 1 : 0);
}

/**
 * O QUE O TESTE DE CÓDIGO DE 03/10/2026 ACHOU NAS REGRAS (testes-navegador/
 * TESTE-DE-CODIGO.md): C1, A4, A6, A8, e as duas portas novas do segundo
 * responsável.
 */
async function criarComHoraDoServidor(caminho, s, fields, campoHora) {
  const base = FS.slice(0, -'/documents'.length);
  const nome = `projects/${PID}/databases/(default)/documents/${caminho}`;
  return fetch(`${base}/documents:commit`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      writes: [{
        update: { name: nome, fields },
        updateTransforms: [{ fieldPath: campoHora, setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }],
    }),
  }).then((r) => r.status);
}

/**
 * Uma ATUALIZAÇÃO com a hora do servidor num campo — o `serverTimestamp()` do
 * app num `updateDoc`. O documento precisa existir.
 */
async function atualizarComHoraDoServidor(caminho, s, fields, mascara, campoHora) {
  const base = FS.slice(0, -'/documents'.length);
  const nome = `projects/${PID}/databases/(default)/documents/${caminho}`;
  return fetch(`${base}/documents:commit`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      writes: [{
        update: { name: nome, fields },
        updateMask: { fieldPaths: mascara },
        updateTransforms: [{ fieldPath: campoHora, setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      }],
    }),
  }).then((r) => r.status);
}

/**
 * A ROTA SEM SENHA (04/10/2026, "Rota e Central"). Na rota, a auxiliar usa o
 * celular do motorista e anota "a família disse que mandou PIX": o motorista
 * grava `claimed` com `claimedAt` — o que só a família fazia. O que este bloco
 * trava (casos pedidos pela QA à sessão negocio):
 *   - o `claimedAt` do motorista só na transição pending → claimed, e só com a
 *     hora do SERVIDOR (data forjada seria prova falsa de quando ela avisou);
 *   - de outro motorista, nunca;
 *   - o evento `claimed` do motorista só com `meta.via: 'sem_senha'` — sem a
 *     marca, a trilha confundiria com o "Já paguei" que ela mesma tocou.
 */
async function aRotaSemSenha({ tio1, tio2, pai1 }) {
  console.log('\n=== A ROTA SEM SENHA (04/10/2026) ===');
  const BL = 'sem senha';
  const PAG = 'payments/pagSemSenha';
  const pendente = () => semear(PAG, {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
    childName: S('Ana'), month: S('2026-10'), amount: N(300), status: S('pending'),
  });
  const CLAIM = { status: S('claimed'), paymentMethod: S('pix') };

  await pendente();
  checar(BL, 'o motorista de OUTRA perua anota o PIX', 'NEGA',
    await atualizarComHoraDoServidor(PAG, tio2, CLAIM, ['status', 'paymentMethod'], 'claimedAt'));
  checar(BL, 'o motorista inventa a hora do aviso', 'NEGA',
    await escrever(PAG, tio1, { ...CLAIM, claimedAt: { timestampValue: '2026-01-01T00:00:00Z' } },
      ['status', 'paymentMethod', 'claimedAt']));
  checar(BL, 'o motorista grava claimedAt dando baixa (não é a transição)', 'NEGA',
    await atualizarComHoraDoServidor(PAG, tio1, { status: S('paid'), paymentMethod: S('cash') },
      ['status', 'paymentMethod'], 'claimedAt'));
  checar(BL, 'o motorista anota o PIX da família com a hora do servidor', 'PASSA',
    await atualizarComHoraDoServidor(PAG, tio1, CLAIM, ['status', 'paymentMethod'], 'claimedAt'));

  const META = (via) => ({ mapValue: { fields: via ? { via: S(via), method: S('pix') } : { method: S('pix') } } });
  checar(BL, 'o evento "claimed" do motorista sem a marca da rota', 'NEGA',
    await criarComHoraDoServidor(`${PAG}/events/s1`, tio1,
      { type: S('claimed'), actorUid: S(tio1.uid), actorRole: S('admin'), meta: META(null) }, 'at'));
  checar(BL, 'o evento "claimed" do motorista com outra marca', 'NEGA',
    await criarComHoraDoServidor(`${PAG}/events/s2`, tio1,
      { type: S('claimed'), actorUid: S(tio1.uid), actorRole: S('admin'), meta: META('com_senha') }, 'at'));
  checar(BL, 'o evento "claimed" do motorista marcado "sem_senha"', 'PASSA',
    await criarComHoraDoServidor(`${PAG}/events/s3`, tio1,
      { type: S('claimed'), actorUid: S(tio1.uid), actorRole: S('admin'), meta: META('sem_senha') }, 'at'));
  checar(BL, 'outro motorista grava o evento marcado', 'NEGA',
    await criarComHoraDoServidor(`${PAG}/events/s4`, tio2,
      { type: S('claimed'), actorUid: S(tio2.uid), actorRole: S('admin'), meta: META('sem_senha') }, 'at'));
}

/**
 * O CÓDIGO DE INDICAÇÃO É DO SERVIDOR (04/10/2026, cupom do cartão do app).
 * Ele casa a indicação: escrito pelo cliente, um motorista copiaria o código
 * de outro e levaria o crédito. Só a callable `meuCodigoDeIndicacao` grava.
 */
async function oCodigoDeIndicacao({ tio1 }) {
  console.log('\n=== O CÓDIGO DE INDICAÇÃO (04/10/2026) ===');
  checar('codigo', 'o motorista escreve o próprio codigoDeIndicacao', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1, { codigoDeIndicacao: S('TIOUM1') }, ['codigoDeIndicacao']));
  // Sonda: o mesmo motorista ainda escreve uma preferência dele no mesmo
  // documento — o NEGA de cima é pelo campo, não pela conta.
  checar('codigo', 'e ainda grava uma preferência dele (sonda)', 'PASSA',
    await escrever(`users/${tio1.uid}`, tio1, { compartilhaLocalizacao: B(true) }, ['compartilhaLocalizacao']));
}

/**
 * A CONTA DA AUXILIAR (05/10/2026) — o quinto papel, sempre ligado a um
 * motorista. O que este bloco trava (casos pedidos à QA pela sessão negocio):
 *   - ela lê o doc do motorista DELA, e só enquanto o vínculo está ativo;
 *   - nunca o de outro motorista;
 *   - o motorista lista os vínculos dele; outro motorista não lê;
 *   - ninguém escreve vínculo nem convite pelo cliente (são callables);
 *   - ela não se liga a um motorista sozinha (`motoristaUid` é do servidor).
 *
 * Atores PRÓPRIOS: um 403 aqui não pode ser herança de outro bloco.
 */
async function aAuxiliar({ pai1 }) {
  console.log('\n=== A CONTA DA AUXILIAR (05/10/2026) ===');
  const BL = 'auxiliar';
  const moto = await criarLogin(`aux.moto.${Date.now()}@teste.local`);
  const outro = await criarLogin(`aux.outro.${Date.now()}@teste.local`);
  const aux = await criarLogin(`aux.ela.${Date.now()}@teste.local`);
  await semear(`users/${moto.uid}`, { role: S('admin'), name: S('Tio da Aux'), pixKey: S('tio@pix') });
  await semear(`users/${outro.uid}`, { role: S('admin'), name: S('Outro Tio') });
  await semear(`users/${aux.uid}`, { role: S('auxiliar'), name: S('Rosa'), motoristaUid: S(moto.uid) });
  await semear(`auxiliares/${aux.uid}`, { motoristaUid: S(moto.uid), nome: S('Rosa'), ativa: B(true) });

  checar(BL, 'a auxiliar ATIVA lê o doc do motorista dela', 'PASSA', await ler(`users/${moto.uid}`, aux));
  checar(BL, 'a auxiliar lê o doc de OUTRO motorista', 'NEGA', await ler(`users/${outro.uid}`, aux));
  checar(BL, 'a auxiliar lê o doc de uma família', 'NEGA', await ler(`users/${pai1.uid}`, aux));
  checar(BL, 'ela lê o próprio vínculo', 'PASSA', await ler(`auxiliares/${aux.uid}`, aux));
  checar(BL, 'o motorista lista os vínculos dele', 'PASSA', await consultar('auxiliares', 'motoristaUid', moto.uid, moto));
  checar(BL, 'outro motorista lê o vínculo', 'NEGA', await ler(`auxiliares/${aux.uid}`, outro));
  checar(BL, 'outro motorista lista os vínculos do primeiro', 'NEGA',
    await consultar('auxiliares', 'motoristaUid', moto.uid, outro));

  // Ninguém escreve pelo cliente: convidar, aceitar e desativar são callables.
  checar(BL, 'o motorista escreve o vínculo', 'NEGA',
    await escrever(`auxiliares/${aux.uid}`, moto, { ativa: B(false) }, ['ativa']));
  checar(BL, 'a auxiliar se reativa', 'NEGA',
    await escrever(`auxiliares/${aux.uid}`, aux, { ativa: B(true) }, ['ativa']));
  checar(BL, 'alguém cria um vínculo novo', 'NEGA',
    await criar('auxiliares', outro.uid, outro, { motoristaUid: S(moto.uid), ativa: B(true) }));
  checar(BL, 'o motorista cria um convite pelo cliente', 'NEGA',
    await criar('convitesDeAuxiliar', 'COD12345', moto, { motoristaUid: S(moto.uid) }));
  checar(BL, 'alguém lê um convite pelo código', 'NEGA', await ler('convitesDeAuxiliar/COD12345', aux));

  // Ela não se liga sozinha, nem muda de papel.
  checar(BL, 'a auxiliar troca o próprio motoristaUid', 'NEGA',
    await escrever(`users/${aux.uid}`, aux, { motoristaUid: S(outro.uid) }, ['motoristaUid']));
  checar(BL, 'qualquer conta grava motoristaUid em si', 'NEGA',
    await escrever(`users/${outro.uid}`, outro, { motoristaUid: S(moto.uid) }, ['motoristaUid']));
  checar(BL, 'a auxiliar vira motorista', 'NEGA',
    await escrever(`users/${aux.uid}`, aux, { role: S('admin') }, ['role']));

  // FASE 2 — A TURMA DELA: a cópia em turmaDaAuxiliar/{motorista}, com a
  // lista fechada de campos (sem endereço, saúde, valor nem coordenada). Só
  // o servidor escreve; só a auxiliar ATIVA daquele motorista lê.
  const COPIA = `turmaDaAuxiliar/${moto.uid}`;
  await semear(COPIA, { ligadaEm: T(0) });
  await semear(`${COPIA}/criancas/kidAux1`, { name: S('Caio'), status: S('home'), active: B(true) });
  await semear(`${COPIA}/faltas/hoje_kidAux1`, { dateKey: S('2026-10-05'), childId: S('kidAux1'), type: S('absence') });
  const aux2 = await criarLogin(`aux.outra.${Date.now()}@teste.local`);
  await semear(`users/${aux2.uid}`, { role: S('auxiliar'), name: S('Lia'), motoristaUid: S(outro.uid) });
  await semear(`auxiliares/${aux2.uid}`, { motoristaUid: S(outro.uid), nome: S('Lia'), ativa: B(true) });

  checar(BL, 'a auxiliar ativa lê a turma do motorista dela', 'PASSA', await ler(`${COPIA}/criancas/kidAux1`, aux));
  checar(BL, 'e lista a turma', 'PASSA', await listar(`${COPIA}/criancas`, aux));
  checar(BL, 'e lê as faltas do dia', 'PASSA', await listar(`${COPIA}/faltas`, aux));
  checar(BL, 'a auxiliar de OUTRO motorista lê essa turma', 'NEGA', await ler(`${COPIA}/criancas/kidAux1`, aux2));
  checar(BL, 'o próprio motorista lê a cópia (não precisa dela)', 'NEGA', await ler(`${COPIA}/criancas/kidAux1`, moto));
  checar(BL, 'uma família lê a cópia', 'NEGA', await ler(`${COPIA}/criancas/kidAux1`, pai1));
  checar(BL, 'a auxiliar escreve na cópia', 'NEGA',
    await escrever(`${COPIA}/criancas/kidAux1`, aux, { status: S('delivered') }, ['status']));
  checar(BL, 'o motorista escreve na cópia', 'NEGA',
    await escrever(`${COPIA}/criancas/kidAux1`, moto, { name: S('Outro') }, ['name']));
  checar(BL, 'alguém cria uma criança na cópia', 'NEGA',
    await criar(`${COPIA}/criancas`, 'kidFalso', aux, { name: S('Falso') }));
  checar(BL, 'alguém sem vínculo lê a cópia', 'NEGA', await ler(`${COPIA}/criancas/kidAux1`, outro));

  // Desativada, perde o acesso — mesmo com o motoristaUid ainda no doc dela.
  await semear(`auxiliares/${aux.uid}`, { motoristaUid: S(moto.uid), nome: S('Rosa'), ativa: B(false) });
  checar(BL, 'a auxiliar DESATIVADA não lê mais o doc do motorista', 'NEGA', await ler(`users/${moto.uid}`, aux));
  checar(BL, 'nem a turma dele', 'NEGA', await ler(`${COPIA}/criancas/kidAux1`, aux));
}

/**
 * A AUXILIAR NO DINHEIRO (05/10/2026, fases 4 e 5 da sessão negocio): o
 * pagamento dela, a falta, as substitutas e o Financeiro dela. Casos pedidos
 * pelos agentes à QA. Atores PRÓPRIOS, para um 403 não ser herança.
 *   - pagamentosDaAuxiliar: o tio e a auxiliar leem (ela mesmo desativada),
 *     mais ninguém; nenhum cliente escreve — são callables;
 *   - configFinanceiro: a auxiliar lê só o dela e não escreve;
 *   - expenses e senhasDoFinanceiro: fechados para ela;
 *   - substitutasDoTio: só o tio, com campos e limites fechados, e só com a
 *     conta operando;
 *   - faltasDaAuxiliar: id amarrado a {tio}_{aux}_{dia}, vínculo dele e
 *     ATIVO para criar; a auxiliar não lê;
 *   - o lote da substituição (falta + despesa + substituta) passa inteiro.
 */
async function aAuxiliarNoDinheiro({ pai1, novato, dono, anon }) {
  console.log('\n=== A AUXILIAR NO DINHEIRO (05/10/2026) ===');
  const BL = 'aux-dinheiro';
  const agora = Date.now();
  const moto = await criarLogin(`din.moto.${agora}@teste.local`);
  const outroMoto = await criarLogin(`din.outro.${agora}@teste.local`);
  const aux = await criarLogin(`din.aux.${agora}@teste.local`);
  const auxOutra = await criarLogin(`din.auxoutra.${agora}@teste.local`);
  const auxParada = await criarLogin(`din.auxparada.${agora}@teste.local`);
  const motoSusp = await criarLogin(`din.susp.${agora}@teste.local`);
  const motoVenc = await criarLogin(`din.venc.${agora}@teste.local`);
  await semear(`users/${moto.uid}`, { role: S('admin'), name: S('Tio Din') });
  await semear(`users/${outroMoto.uid}`, { role: S('admin'), name: S('Outro Din') });
  await semear(`users/${motoSusp.uid}`, { role: S('admin'), name: S('Suspenso'), suspenso: B(true) });
  await semear(`users/${motoVenc.uid}`, { role: S('admin'), name: S('Vencido'), trialInicio: T(-120) });
  for (const [a, m, ativa] of [[aux, moto, true], [auxOutra, outroMoto, true], [auxParada, moto, false]]) {
    await semear(`users/${a.uid}`, { role: S('auxiliar'), name: S('Aux'), motoristaUid: S(m.uid) });
    await semear(`auxiliares/${a.uid}`, { motoristaUid: S(m.uid), nome: S('Aux'), ativa: B(ativa) });
  }
  const I = (v) => ({ integerValue: String(v) });

  // 1. pagamentosDaAuxiliar
  const PAG = `pagamentosDaAuxiliar/${moto.uid}_${aux.uid}_2026-10`;
  await semear(PAG, {
    motoristaUid: S(moto.uid), auxiliarUid: S(aux.uid), mes: S('2026-10'), valor: N(800), anotadoEm: T(0),
  });
  checar(BL, 'o tio lê o pagamento que anotou', 'PASSA', await ler(PAG, moto));
  checar(BL, 'e consulta os dele', 'PASSA', await consultar('pagamentosDaAuxiliar', 'motoristaUid', moto.uid, moto));
  checar(BL, 'a auxiliar lê o pagamento dela', 'PASSA', await ler(PAG, aux));
  checar(BL, 'e consulta os dela', 'PASSA', await consultar('pagamentosDaAuxiliar', 'auxiliarUid', aux.uid, aux));
  checar(BL, 'outra auxiliar NÃO lê', 'NEGA', await ler(PAG, auxOutra));
  checar(BL, 'outro motorista NÃO lê', 'NEGA', await ler(PAG, outroMoto));
  checar(BL, 'a família NÃO lê', 'NEGA', await ler(PAG, pai1));
  checar(BL, 'o novato NÃO lê', 'NEGA', await ler(PAG, novato));
  checar(BL, 'anônimo NÃO lê', 'NEGA', await ler(PAG, anon));
  checar(BL, 'consulta sem filtro é recusada', 'NEGA', await listar('pagamentosDaAuxiliar', moto));
  checar(BL, 'outro motorista consulta pelo uid do primeiro', 'NEGA',
    await consultar('pagamentosDaAuxiliar', 'motoristaUid', moto.uid, outroMoto));
  checar(BL, 'o tio muda o valor pelo app', 'NEGA', await escrever(PAG, moto, { valor: N(1) }, ['valor']));
  checar(BL, 'a auxiliar grava recebidoEm pelo app', 'NEGA', await escrever(PAG, aux, { recebidoEm: T(0) }, ['recebidoEm']));
  checar(BL, 'o dono escreve no pagamento', 'NEGA', await escrever(PAG, dono, { valor: N(1) }, ['valor']));
  checar(BL, 'o tio cria um pagamento pelo app', 'NEGA',
    await criar('pagamentosDaAuxiliar', `${moto.uid}_${aux.uid}_2026-11`, moto,
      { motoristaUid: S(moto.uid), auxiliarUid: S(aux.uid), mes: S('2026-11') }));
  await semear(`auxiliares/${aux.uid}`, { motoristaUid: S(moto.uid), nome: S('Aux'), ativa: B(false) });
  checar(BL, 'desativada, a auxiliar ainda lê o pagamento dela', 'PASSA', await ler(PAG, aux));
  await semear(`auxiliares/${aux.uid}`, { motoristaUid: S(moto.uid), nome: S('Aux'), ativa: B(true) });

  // 2. configFinanceiro
  await semear(`configFinanceiro/${aux.uid}`, { temSenha: B(true) });
  await semear(`configFinanceiro/${moto.uid}`, { usoDaPerua: S('so_rota') });
  checar(BL, 'a auxiliar lê o configFinanceiro DELA', 'PASSA', await ler(`configFinanceiro/${aux.uid}`, aux));
  checar(BL, 'a auxiliar NÃO lê o do tio', 'NEGA', await ler(`configFinanceiro/${moto.uid}`, aux));
  checar(BL, 'a auxiliar NÃO escreve no dela', 'NEGA',
    await escrever(`configFinanceiro/${aux.uid}`, aux, { usoDaPerua: S('so_rota') }, ['usoDaPerua']));
  checar(BL, 'a família NÃO lê o do tio', 'NEGA', await ler(`configFinanceiro/${moto.uid}`, pai1));
  checar(BL, 'o tio lê o dele, como antes', 'PASSA', await ler(`configFinanceiro/${moto.uid}`, moto));

  // 3 e 4. expenses e senha
  await semear('expenses/expDin1', {
    adminUid: S(moto.uid), amount: N(80), category: S('monitor'), monthKey: S('2026-10'), date: T(0),
  });
  checar(BL, 'a auxiliar NÃO lê uma despesa do tio', 'NEGA', await ler('expenses/expDin1', aux));
  checar(BL, 'nem consulta as despesas dele', 'NEGA', await consultar('expenses', 'adminUid', moto.uid, aux));
  await semear(`senhasDoFinanceiro/${aux.uid}`, { hash: S('abc'), sal: S('def') });
  checar(BL, 'a auxiliar NÃO lê o hash da própria senha', 'NEGA', await ler(`senhasDoFinanceiro/${aux.uid}`, aux));
  checar(BL, 'nem zera as tentativas', 'NEGA',
    await escrever(`senhasDoFinanceiro/${aux.uid}`, aux, { erros: I(0) }, ['erros']));

  // 5. substitutasDoTio
  const SUB = (extra = {}) => ({
    motoristaUid: S(moto.uid), nome: S('Ana Paula'), telefone: S('11987654321'),
    vezes: I(0), ultimaEm: S('2026-10-05'), ultimoValor: N(80), criadaEm: T(0), ...extra,
  });
  checar(BL, 'o tio cadastra uma substituta com os 7 campos', 'PASSA', await criar('substitutasDoTio', 'subDin1', moto, SUB()));
  checar(BL, 'campo a mais é recusado', 'NEGA', await criar('substitutasDoTio', 'subDin2', moto, SUB({ cpf: S('123') })));
  checar(BL, 'uid de outro motorista', 'NEGA', await criar('substitutasDoTio', 'subDin3', moto, SUB({ motoristaUid: S(outroMoto.uid) })));
  checar(BL, 'telefone curto (9 dígitos)', 'NEGA', await criar('substitutasDoTio', 'subDin4', moto, SUB({ telefone: S('119876543') })));
  checar(BL, 'telefone longo (12 dígitos)', 'NEGA', await criar('substitutasDoTio', 'subDin5', moto, SUB({ telefone: S('119876543210') })));
  checar(BL, 'telefone com letras', 'NEGA', await criar('substitutasDoTio', 'subDin6', moto, SUB({ telefone: S('(11)98765-43') })));
  checar(BL, 'nome vazio', 'NEGA', await criar('substitutasDoTio', 'subDin7', moto, SUB({ nome: S('') })));
  checar(BL, 'nome com 61 letras', 'NEGA', await criar('substitutasDoTio', 'subDin8', moto, SUB({ nome: S('a'.repeat(61)) })));
  checar(BL, 'valor zero', 'NEGA', await criar('substitutasDoTio', 'subDin9', moto, SUB({ ultimoValor: N(0) })));
  checar(BL, 'valor acima de 5000', 'NEGA', await criar('substitutasDoTio', 'subDin10', moto, SUB({ ultimoValor: N(5001) })));
  checar(BL, 'o tio lê a substituta dele', 'PASSA', await ler('substitutasDoTio/subDin1', moto));
  checar(BL, 'e atualiza as vezes', 'PASSA',
    await escrever('substitutasDoTio/subDin1', moto, { vezes: I(1) }, ['vezes']));
  checar(BL, 'outro motorista NÃO lê', 'NEGA', await ler('substitutasDoTio/subDin1', outroMoto));
  checar(BL, 'outro motorista NÃO muda', 'NEGA',
    await escrever('substitutasDoTio/subDin1', outroMoto, { vezes: I(9) }, ['vezes']));
  checar(BL, 'a auxiliar NÃO lê a lista de substitutas', 'NEGA', await ler('substitutasDoTio/subDin1', aux));
  checar(BL, 'a auxiliar NÃO apaga', 'NEGA', await apagar('substitutasDoTio/subDin1', aux));
  checar(BL, 'o novato NÃO lê', 'NEGA', await ler('substitutasDoTio/subDin1', novato));
  checar(BL, 'conta SUSPENSA não cadastra', 'NEGA',
    await criar('substitutasDoTio', 'subDinS', motoSusp, SUB({ motoristaUid: S(motoSusp.uid) })));
  checar(BL, 'conta com o TESTE VENCIDO não cadastra', 'NEGA',
    await criar('substitutasDoTio', 'subDinV', motoVenc, SUB({ motoristaUid: S(motoVenc.uid) })));

  // 6. faltasDaAuxiliar
  const DIA = '2026-10-05';
  const FALTA = (auxUid, dia = DIA, extra = {}) => ({
    motoristaUid: S(moto.uid), auxiliarUid: S(auxUid), nomeDaAuxiliar: S('Aux'),
    dateKey: S(dia), criadaEm: T(0), ...extra,
  });
  const idFalta = (auxUid, dia = DIA) => `${moto.uid}_${auxUid}_${dia}`;
  checar(BL, 'o tio registra a falta da auxiliar dele', 'PASSA',
    await criar('faltasDaAuxiliar', idFalta(aux.uid), moto, FALTA(aux.uid)));
  checar(BL, 'id que não bate com o dia', 'NEGA',
    await criar('faltasDaAuxiliar', idFalta(aux.uid, '2026-10-06'), moto, FALTA(aux.uid, DIA)));
  checar(BL, 'auxiliar de OUTRO motorista', 'NEGA',
    await criar('faltasDaAuxiliar', idFalta(auxOutra.uid), moto, FALTA(auxOutra.uid)));
  checar(BL, 'vínculo que não existe', 'NEGA',
    await criar('faltasDaAuxiliar', idFalta('ninguem'), moto, FALTA('ninguem')));
  checar(BL, 'auxiliar DESATIVADA não ganha falta nova', 'NEGA',
    await criar('faltasDaAuxiliar', idFalta(auxParada.uid), moto, FALTA(auxParada.uid)));
  checar(BL, 'campo a mais na falta', 'NEGA',
    await criar('faltasDaAuxiliar', idFalta(aux.uid, '2026-10-07'), moto, FALTA(aux.uid, '2026-10-07', { nota: S('x') })));
  const SUBST = { mapValue: { fields: { id: S('subDin1'), nome: S('Ana Paula'), telefone: S('11987654321'), valor: N(80) } } };
  checar(BL, 'o update acrescenta a substituta e a despesa', 'PASSA',
    await escrever(`faltasDaAuxiliar/${idFalta(aux.uid)}`, moto, { substituta: SUBST, despesaId: S('expDin1') }, ['substituta', 'despesaId']));
  checar(BL, 'substituta com valor acima do teto', 'NEGA',
    await escrever(`faltasDaAuxiliar/${idFalta(aux.uid)}`, moto,
      { substituta: { mapValue: { fields: { id: S('s'), nome: S('Ana'), telefone: S('11987654321'), valor: N(9000) } } } }, ['substituta']));
  checar(BL, 'a auxiliar NÃO lê a falta dela', 'NEGA', await ler(`faltasDaAuxiliar/${idFalta(aux.uid)}`, aux));
  checar(BL, 'outro motorista NÃO lê', 'NEGA', await ler(`faltasDaAuxiliar/${idFalta(aux.uid)}`, outroMoto));
  checar(BL, 'outro motorista NÃO apaga', 'NEGA', await apagar(`faltasDaAuxiliar/${idFalta(aux.uid)}`, outroMoto));
  checar(BL, 'o tio apaga a falta dele', 'PASSA', await apagar(`faltasDaAuxiliar/${idFalta(aux.uid)}`, moto));

  // 7. O lote da substituição, como o app manda: falta (já existe) +
  // substituta nova + despesa "monitor", num commit só.
  const DIA2 = '2026-10-08';
  await semear(`faltasDaAuxiliar/${idFalta(aux.uid, DIA2)}`, {
    motoristaUid: S(moto.uid), auxiliarUid: S(aux.uid), nomeDaAuxiliar: S('Aux'), dateKey: S(DIA2),
  });
  const base = FS.slice(0, -'/documents'.length);
  const doc = (c) => `projects/${PID}/databases/(default)/documents/${c}`;
  const lote = await fetch(`${base}/documents:commit`, {
    method: 'POST',
    headers: H(moto),
    body: JSON.stringify({
      writes: [
        {
          update: { name: doc('substitutasDoTio/subDinLote'), fields: {
            motoristaUid: S(moto.uid), nome: S('Bia'), telefone: S('11912345678'),
            vezes: I(1), ultimaEm: S(DIA2), ultimoValor: N(90),
          } },
          updateTransforms: [{ fieldPath: 'criadaEm', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: false },
        },
        {
          update: { name: doc('expenses/expDinLote'), fields: {
            adminUid: S(moto.uid), amount: N(90), category: S('monitor'),
            description: S('Substituta Bia em 08/10'), date: T(0), monthKey: S('2026-10'),
          } },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: false },
        },
        {
          update: { name: doc(`faltasDaAuxiliar/${idFalta(aux.uid, DIA2)}`), fields: {
            substituta: { mapValue: { fields: { id: S('subDinLote'), nome: S('Bia'), telefone: S('11912345678'), valor: N(90) } } },
            despesaId: S('expDinLote'),
          } },
          updateMask: { fieldPaths: ['substituta', 'despesaId'] },
          currentDocument: { exists: true },
        },
      ],
    }),
  }).then((r) => r.status);
  checar(BL, 'o lote da substituição passa inteiro (falta + despesa + substituta)', 'PASSA', lote);
}

/**
 * O FINANCEIRO COM SENHA (03/10/2026). A auxiliar usa o celular do motorista
 * e não deve ver valores — o Financeiro abre com uma senha conferida por
 * callable. O que este bloco trava:
 *   - `senhasDoFinanceiro/{uid}` (o hash): ninguém do lado de fora, nem ele;
 *   - `configFinanceiro/{uid}`: só ele lê; `temSenha` é do servidor;
 *     `kmDasRotas` só sobe, e no máximo 1000 por escrita;
 *   - `expenses.kmPainel`/`kmContador`: número não negativo;
 *   - `children.inativadoEm`: a data da saída, gravada junto do `active: false`.
 *
 * Atores PRÓPRIOS: o `tio1` a esta altura já foi reescrito por blocos
 * anteriores (plano, teste vencido...), e um 403 aqui não pode ser herança.
 */
async function oFinanceiroTrancado({ tio2, pai1, novato, dono, anon }) {
  console.log('\n═══ O FINANCEIRO COM SENHA — senha, km e saída da criança ═══');
  const fin = await criarLogin(`fin.${Date.now()}@teste.local`);
  const fin2 = await criarLogin(`fin2.${Date.now()}@teste.local`);
  await semear(`users/${fin.uid}`, { role: S('admin'), name: S('Tio Financeiro') });
  await semear(`users/${fin2.uid}`, { role: S('admin'), name: S('Tio Sem Config') });
  await semear(`users/${pai1.uid}`, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(fin.uid), childId: S('kidFin'),
  });
  await semear('children/kidFin', {
    name: S('Caio'), adminUid: S(fin.uid), parentUid: S(pai1.uid), active: B(true), monthlyFee: N(300),
  });
  await semear(`senhasDoFinanceiro/${fin.uid}`, { hash: S('abc'), sal: S('def') });
  await semear(`configFinanceiro/${fin.uid}`, { temSenha: B(true), kmDasRotas: N(100) });

  const BL = 'financeiro';
  const cfg = `configFinanceiro/${fin.uid}`;
  // O que `somarKmDasRotas` manda: setDoc com merge e só o increment.
  const somarKm = (sessao, uid, valor) => {
    const base = FS.slice(0, -'/documents'.length);
    return fetch(`${base}/documents:commit`, {
      method: 'POST',
      headers: H(sessao),
      body: JSON.stringify({
        writes: [{
          update: { name: `projects/${PID}/databases/(default)/documents/configFinanceiro/${uid}`, fields: {} },
          updateMask: { fieldPaths: [] },
          updateTransforms: [{ fieldPath: 'kmDasRotas', increment: { doubleValue: valor } }],
        }],
      }),
    }).then((r) => r.status);
  };

  // A SENHA — nem ele, nem ninguém.
  checar(BL, 'o próprio motorista NÃO lê o hash da senha', 'NEGA', await ler(`senhasDoFinanceiro/${fin.uid}`, fin));
  checar(BL, 'o próprio NÃO zera o contador de tentativas', 'NEGA',
    await escrever(`senhasDoFinanceiro/${fin.uid}`, fin, { erros: N(0) }, ['erros']));
  checar(BL, 'o próprio NÃO cria o documento da senha', 'NEGA',
    await criar('senhasDoFinanceiro', novato.uid, novato, { hash: S('x') }));
  checar(BL, 'outro motorista não lê a senha', 'NEGA', await ler(`senhasDoFinanceiro/${fin.uid}`, tio2));
  checar(BL, 'a família não lê a senha', 'NEGA', await ler(`senhasDoFinanceiro/${fin.uid}`, pai1));
  checar(BL, 'o dono não lê a senha', 'NEGA', await ler(`senhasDoFinanceiro/${fin.uid}`, dono));
  checar(BL, 'anônimo não lê a senha', 'NEGA', await ler(`senhasDoFinanceiro/${fin.uid}`, anon));

  // A CONFIGURAÇÃO — só ele.
  checar(BL, 'o próprio lê a configuração', 'PASSA', await ler(cfg, fin));
  checar(BL, 'a família dele NÃO lê a configuração', 'NEGA', await ler(cfg, pai1));
  checar(BL, 'outro motorista NÃO lê a configuração', 'NEGA', await ler(cfg, tio2));
  checar(BL, 'novato NÃO lê a configuração alheia', 'NEGA', await ler(cfg, novato));
  checar(BL, 'o dono NÃO lê a configuração', 'NEGA', await ler(cfg, dono));
  checar(BL, 'anônimo NÃO lê a configuração', 'NEGA', await ler(cfg, anon));
  checar(BL, 'outro motorista NÃO escreve na configuração', 'NEGA',
    await escrever(cfg, tio2, { usoDaPerua: S('so_rota') }, ['usoDaPerua']));

  // temSenha é do servidor.
  checar(BL, 'ele NÃO apaga o próprio temSenha', 'NEGA', await escrever(cfg, fin, {}, ['temSenha']));
  checar(BL, 'ele NÃO grava temSenha: false', 'NEGA',
    await escrever(cfg, fin, { temSenha: B(false) }, ['temSenha']));
  checar(BL, 'novato NÃO cria a configuração com temSenha', 'NEGA',
    await criar('configFinanceiro', novato.uid, novato, { temSenha: B(true) }));
  checar(BL, 'novato cria a própria só com usoDaPerua', 'PASSA',
    await criar('configFinanceiro', novato.uid, novato, { usoDaPerua: S('tambem_fora') }));
  checar(BL, 'novato NÃO cria a configuração de outro', 'NEGA',
    await criar('configFinanceiro', fin2.uid, novato, { usoDaPerua: S('so_rota') }));

  // usoDaPerua.
  checar(BL, 'ele responde "só nas rotas"', 'PASSA',
    await escrever(cfg, fin, { usoDaPerua: S('so_rota') }, ['usoDaPerua']));
  checar(BL, 'resposta fora da lista é recusada', 'NEGA',
    await escrever(cfg, fin, { usoDaPerua: S('as_vezes') }, ['usoDaPerua']));
  checar(BL, 'campo estranho é recusado', 'NEGA',
    await escrever(cfg, fin, { saldo: N(1) }, ['saldo']));

  // OS PLANOS FINANCEIROS (05/10/2026): metas que ele anota, no máximo 12.
  // O formato de cada plano é da régua no aparelho; a rule segura o tamanho
  // da lista e o escopo (só ele).
  const PLANOS = (n) => ({
    arrayValue: {
      values: Array.from({ length: n }, (_, i) => ({
        mapValue: { fields: { id: S(`p${i}`), nome: S(`Plano ${i}`), valor: N(500), data: S('2027-01') } },
      })),
    },
  });
  checar(BL, 'ele grava 12 planos', 'PASSA', await escrever(cfg, fin, { planos: PLANOS(12) }, ['planos']));
  checar(BL, 'o 13º plano é recusado', 'NEGA', await escrever(cfg, fin, { planos: PLANOS(13) }, ['planos']));
  checar(BL, 'planos que não são lista são recusados', 'NEGA',
    await escrever(cfg, fin, { planos: S('meu plano') }, ['planos']));
  checar(BL, 'outro motorista grava planos no documento dele', 'NEGA',
    await escrever(cfg, tio2, { planos: PLANOS(1) }, ['planos']));

  // kmDasRotas só sobe.
  checar(BL, 'somar 5 km (increment, como o SDK manda)', 'PASSA', await somarKm(fin, fin.uid, 5));
  checar(BL, 'km NÃO desce (increment negativo)', 'NEGA', await somarKm(fin, fin.uid, -3));
  checar(BL, 'km NÃO desce (valor menor)', 'NEGA', await escrever(cfg, fin, { kmDasRotas: N(10) }, ['kmDasRotas']));
  checar(BL, 'km NÃO pula mais de 1000 numa escrita', 'NEGA', await somarKm(fin, fin.uid, 1500));
  checar(BL, 'km NÃO vira texto', 'NEGA', await escrever(cfg, fin, { kmDasRotas: S('999') }, ['kmDasRotas']));
  checar(BL, 'km NÃO é apagado (voltaria a zero)', 'NEGA', await escrever(cfg, fin, {}, ['kmDasRotas']));
  checar(BL, 'a primeira soma de quem não tinha documento', 'PASSA', await somarKm(fin2, fin2.uid, 7.5));
  checar(BL, 'outro motorista NÃO soma km no contador alheio', 'NEGA', await somarKm(tio2, fin.uid, 5));
  checar(BL, 'ninguém apaga a configuração, nem ele', 'NEGA', await apagar(cfg, fin));

  // A despesa com km.
  const despesa = (extra = {}) => ({
    adminUid: S(fin.uid), monthKey: S('2026-10'), amount: N(250), category: S('combustivel'), ...extra,
  });
  checar(BL, 'despesa com kmPainel e kmContador passa', 'PASSA',
    await criar('expenses', 'despKm1', fin, despesa({ kmPainel: N(123456), kmContador: N(105) })));
  checar(BL, 'despesa sem km continua passando', 'PASSA', await criar('expenses', 'despKm2', fin, despesa()));
  checar(BL, 'kmPainel negativo é recusado', 'NEGA',
    await criar('expenses', 'despKm3', fin, despesa({ kmPainel: N(-1) })));
  checar(BL, 'kmContador em texto é recusado', 'NEGA',
    await criar('expenses', 'despKm4', fin, despesa({ kmContador: S('105') })));
  checar(BL, 'corrigir o kmPainel depois passa', 'PASSA',
    await escrever('expenses/despKm1', fin, { kmPainel: N(123460) }, ['kmPainel']));
  checar(BL, 'outro motorista não cria despesa com km em nome dele', 'NEGA',
    await criar('expenses', 'despKm5', tio2, despesa({ kmPainel: N(1) })));

  // "SUA PERUA" (03/10/2026) — o abastecimento na despesa, e as quatro
  // chaves novas da configuração. Cada validação tem o caso que passa ao lado.
  const I = (v) => ({ integerValue: String(v) });
  const M = (fields) => ({ mapValue: { fields } });
  const L = (values) => ({ arrayValue: { values } });
  const abast = (extra = {}) => despesa({ category: S('fuel'), ...extra });
  checar(BL, 'abastecimento completo em fuel passa', 'PASSA',
    await criar('expenses', 'despAb1', fin, abast({
      litros: N(52.4), tipoCombustivel: S('diesel_s10'), posto: S('Posto do Zé'), tanqueCheio: B(true),
    })));
  checar(BL, 'litros fora de fuel é recusado', 'NEGA',
    await criar('expenses', 'despAb2', fin, despesa({ category: S('maintenance'), litros: N(10) })));
  checar(BL, 'posto fora de fuel é recusado', 'NEGA',
    await criar('expenses', 'despAb3', fin, despesa({ category: S('other'), posto: S('Shell') })));
  checar(BL, 'litros zero é recusado', 'NEGA', await criar('expenses', 'despAb4', fin, abast({ litros: N(0) })));
  checar(BL, 'litros acima de 500 é recusado', 'NEGA',
    await criar('expenses', 'despAb5', fin, abast({ litros: N(501) })));
  checar(BL, 'litros em texto é recusado', 'NEGA',
    await criar('expenses', 'despAb6', fin, abast({ litros: S('40') })));
  checar(BL, 'GNV (m³ no mesmo campo) passa', 'PASSA',
    await criar('expenses', 'despAb7', fin, abast({ litros: N(15), tipoCombustivel: S('gnv') })));
  checar(BL, 'combustível fora da lista é recusado', 'NEGA',
    await criar('expenses', 'despAb8', fin, abast({ tipoCombustivel: S('querosene') })));
  checar(BL, 'posto com mais de 60 letras é recusado', 'NEGA',
    await criar('expenses', 'despAb9', fin, abast({ posto: S('x'.repeat(61)) })));
  checar(BL, 'tanqueCheio em texto é recusado', 'NEGA',
    await criar('expenses', 'despAb10', fin, abast({ tanqueCheio: S('sim') })));
  checar(BL, 'trocar para manutenção mantendo os litros é recusado', 'NEGA',
    await escrever('expenses/despAb1', fin, { category: S('maintenance') }, ['category']));
  checar(BL, 'trocar para manutenção tirando os quatro passa', 'PASSA',
    await escrever('expenses/despAb1', fin, { category: S('maintenance') },
      ['category', 'litros', 'tipoCombustivel', 'posto', 'tanqueCheio']));
  checar(BL, 'corrigir os litros de um abastecimento passa', 'PASSA',
    await escrever('expenses/despAb7', fin, { litros: N(16.2) }, ['litros']));

  // combustivelDaPerua.
  checar(BL, 'ele diz que a perua é diesel S10', 'PASSA',
    await escrever(cfg, fin, { combustivelDaPerua: S('diesel_s10') }, ['combustivelDaPerua']));
  checar(BL, 'combustível da perua fora da lista é recusado', 'NEGA',
    await escrever(cfg, fin, { combustivelDaPerua: S('alcool') }, ['combustivelDaPerua']));

  // postos. A rule não valida item por item (não há laço nas rules).
  const posto = (nome) => M({ nome: S(nome), preco: N(6.29), tipo: S('diesel_s10'), vistoEm: T(0) });
  const varios = (n) => L(Array.from({ length: n }, (_, i) => posto(`P${i}`)));
  checar(BL, 'lista de postos passa', 'PASSA',
    await escrever(cfg, fin, { postos: L([posto('Ipiranga'), posto('Shell')]) }, ['postos']));
  checar(BL, 'lista vazia de postos passa', 'PASSA', await escrever(cfg, fin, { postos: L([]) }, ['postos']));
  checar(BL, 'lista com 20 postos passa', 'PASSA', await escrever(cfg, fin, { postos: varios(20) }, ['postos']));
  checar(BL, 'lista com 21 postos é recusada', 'NEGA', await escrever(cfg, fin, { postos: varios(21) }, ['postos']));
  checar(BL, 'postos que não são lista são recusados', 'NEGA',
    await escrever(cfg, fin, { postos: posto('Shell') }, ['postos']));

  // planoDaTroca.
  const plano = (extra = {}) => M({
    valorHoje: N(180000), anos: I(5), valorFinal: N(60000), criadoEm: T(0), ...extra,
  });
  checar(BL, 'plano da troca válido passa', 'PASSA',
    await escrever(cfg, fin, { planoDaTroca: plano() }, ['planoDaTroca']));
  checar(BL, 'plano com valor final igual ao de hoje é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ valorFinal: N(180000) }) }, ['planoDaTroca']));
  checar(BL, 'plano com valor de hoje zero é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ valorHoje: N(0), valorFinal: N(0) }) }, ['planoDaTroca']));
  checar(BL, 'plano com 21 anos é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ anos: I(21) }) }, ['planoDaTroca']));
  checar(BL, 'plano com 0 anos é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ anos: I(0) }) }, ['planoDaTroca']));
  checar(BL, 'plano com anos quebrados é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ anos: N(2.5) }) }, ['planoDaTroca']));
  checar(BL, 'plano com valor final negativo é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ valorFinal: N(-1) }) }, ['planoDaTroca']));
  checar(BL, 'plano sem criadoEm é recusado', 'NEGA',
    await escrever(cfg, fin, {
      planoDaTroca: M({ valorHoje: N(180000), anos: I(5), valorFinal: N(60000) }),
    }, ['planoDaTroca']));
  checar(BL, 'plano com chave estranha é recusado', 'NEGA',
    await escrever(cfg, fin, { planoDaTroca: plano({ juros: N(1) }) }, ['planoDaTroca']));

  // guardado — anotação, o app não guarda dinheiro.
  const caixa = (valor) => M({ valor: N(valor), em: T(0) });
  checar(BL, 'anotar o guardado da troca passa', 'PASSA',
    await escrever(cfg, fin, { guardado: M({ troca: caixa(1200) }) }, ['guardado']));
  checar(BL, 'anotar as duas caixas passa', 'PASSA',
    await escrever(cfg, fin, { guardado: M({ troca: caixa(1200), manutencao: caixa(0) }) }, ['guardado']));
  checar(BL, 'guardado negativo é recusado', 'NEGA',
    await escrever(cfg, fin, { guardado: M({ troca: caixa(-5) }) }, ['guardado']));
  checar(BL, 'caixa desconhecida é recusada', 'NEGA',
    await escrever(cfg, fin, { guardado: M({ ferias: caixa(100) }) }, ['guardado']));
  checar(BL, 'caixa sem a data é recusada', 'NEGA',
    await escrever(cfg, fin, { guardado: M({ manutencao: M({ valor: N(10) }) }) }, ['guardado']));
  checar(BL, 'guardado que não é mapa é recusado', 'NEGA',
    await escrever(cfg, fin, { guardado: N(1200) }, ['guardado']));
  checar(BL, 'outro motorista NÃO anota o guardado alheio', 'NEGA',
    await escrever(cfg, tio2, { guardado: M({ troca: caixa(1) }) }, ['guardado']));
  checar(BL, 'a configuração com tudo continua legível por ele', 'PASSA', await ler(cfg, fin));

  // A data de saída da criança.
  checar(BL, 'o motorista inativa a criança com inativadoEm', 'PASSA',
    await escrever('children/kidFin', fin, { active: B(false), inativadoEm: T(0) }, ['active', 'inativadoEm']));
  checar(BL, 'a família não grava inativadoEm', 'NEGA',
    await escrever('children/kidFin', pai1, { inativadoEm: T(0) }, ['inativadoEm']));
}

async function oTesteDeCodigo({ tio1, tio2, pai1, dono }) {
  console.log('\n=== O TESTE DE CÓDIGO (03/10/2026) ===');

  // C1 — o motorista mexe no estado da cobrança, nunca em de quem ela é.
  await semear('payments/pagC1', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
    childName: S('Ana'), month: S('2026-09'), amount: N(300), status: S('pending'),
  });
  checar('C1', 'tio1 reescreve a família de uma cobrança dele', 'NEGA',
    await escrever('payments/pagC1', tio1, { parentUid: S('outraFamilia') }, ['parentUid']));
  checar('C1', 'tio1 reescreve o valor', 'NEGA',
    await escrever('payments/pagC1', tio1, { amount: N(9999) }, ['amount']));
  checar('C1', 'tio1 troca a criança da cobrança', 'NEGA',
    await escrever('payments/pagC1', tio1, { childId: S('kid2') }, ['childId']));
  checar('C1', 'tio1 dá baixa (o caminho normal) continua passando', 'PASSA',
    await escrever('payments/pagC1', tio1, { status: S('paid'), paymentMethod: S('pix') }, ['status', 'paymentMethod']));

  // A4 — cada lado escreve só os fatos dele, com a hora do servidor.
  checar('A4', 'a família grava "o motorista confirmou"', 'NEGA',
    await criarComHoraDoServidor('payments/pagC1/events/f1', pai1,
      { type: S('confirmed'), actorUid: S(pai1.uid), actorRole: S('admin') }, 'at'));
  checar('A4', 'a família inventa a data do aviso', 'NEGA',
    await criar('payments/pagC1/events', 'f2', pai1, {
      type: S('claimed'), actorUid: S(pai1.uid), actorRole: S('parent'),
      at: { timestampValue: '2026-01-01T00:00:00Z' },
    }));
  checar('A4', 'a família registra o próprio aviso com a hora do servidor', 'PASSA',
    await criarComHoraDoServidor('payments/pagC1/events/f3', pai1,
      { type: S('claimed'), actorUid: S(pai1.uid), actorRole: S('parent') }, 'at'));
  checar('A4', 'o motorista finge que a família avisou', 'NEGA',
    await criarComHoraDoServidor('payments/pagC1/events/f4', tio1,
      { type: S('claimed'), actorUid: S(tio1.uid), actorRole: S('parent') }, 'at'));
  checar('A4', 'o motorista registra a confirmação dele', 'PASSA',
    await criarComHoraDoServidor('payments/pagC1/events/f5', tio1,
      { type: S('confirmed'), actorUid: S(tio1.uid), actorRole: S('admin') }, 'at'));

  // A6 — a família seguinte não lê o contrato da anterior.
  await semear('children/kidA6', {
    name: S('Caio'), adminUid: S(tio1.uid), parentUid: S(pai1.uid), active: B(true),
  });
  await semear('children/kidA6/contratos/1', {
    numero: N(1), status: S('substituido'), adminUid: S(tio1.uid), familia: S('familiaAnterior'),
  });
  await semear('children/kidA6/contratos/2', {
    numero: N(2), status: S('aguardando'), adminUid: S(tio1.uid), familia: S(pai1.uid),
  });
  checar('A6', 'a família nova lê a versão da família anterior', 'NEGA',
    await ler('children/kidA6/contratos/1', pai1));
  checar('A6', 'a família lê a versão dela', 'PASSA',
    await ler('children/kidA6/contratos/2', pai1));
  checar('A6', 'o motorista continua lendo o histórico inteiro', 'PASSA',
    await ler('children/kidA6/contratos/1', tio1));

  // A8 — os dois avisos do dono.
  checar('A8', 'o dono avisa "respondemos seu chamado"', 'PASSA',
    await criar('notifications', 'donoA8a', dono, {
      userId: S(tio1.uid), type: S('chamado_respondido'), title: S('Respondemos seu chamado'),
      createdAt: { timestampValue: new Date().toISOString() },
    }));
  checar('A8', 'mas não escreve qualquer tipo de aviso', 'NEGA',
    await criar('notifications', 'donoA8b', dono, {
      userId: S(pai1.uid), type: S('payment_confirmed'), title: S('Pago'),
      createdAt: { timestampValue: new Date().toISOString() },
    }));

  // A faixa da perua mora em children/{id}/proximidade/atual (03/10/2026).
  const faixa = (extra = {}) => ({
    zona: S('perto'), dateKey: S('2026-10-03'), adminUid: S(tio1.uid), parentUid: S(pai1.uid),
    atualizadoEm: { timestampValue: new Date().toISOString() }, ...extra,
  });
  checar('faixa', 'o motorista da criança grava a faixa', 'PASSA',
    await escrever('children/kid1/proximidade/atual', tio1, faixa()));
  checar('faixa', 'o motorista lê a própria faixa', 'PASSA',
    await ler('children/kid1/proximidade/atual', tio1));
  checar('faixa', 'outro motorista grava na criança de terceiro', 'NEGA',
    await escrever('children/kid1/proximidade/atual', tio2, faixa({ adminUid: S(tio2.uid) })));
  checar('faixa', 'a família não grava', 'NEGA',
    await escrever('children/kid1/proximidade/atual', pai1, faixa()));
  checar('faixa', 'nem lê (o que chega a ela é a notificação)', 'NEGA',
    await ler('children/kid1/proximidade/atual', pai1));
  checar('faixa', 'distância no lugar da palavra é recusada', 'NEGA',
    await escrever('children/kid1/proximidade/atual', tio1, faixa({ zona: S('1.2km') })));
  checar('faixa', 'coordenada junto é recusada', 'NEGA',
    await escrever('children/kid1/proximidade/atual', tio1, faixa({ lat: N(-23.5) })));
  checar('faixa', 'outro documento que não "atual" é recusado', 'NEGA',
    await escrever('children/kid1/proximidade/outro', tio1, faixa()));

  // A cobrança da plataforma é o único aviso que vira e-mail: só o servidor cria.
  checar('email', 'o motorista forja uma "fatura" para a família dele', 'NEGA',
    await criar('notifications', 'faturaFalsa', tio1, {
      userId: S(pai1.uid), type: S('fatura_vence'), title: S('Sua fatura vence em 3 dias'),
      createdAt: { timestampValue: new Date().toISOString() },
    }));

  // O acesso de 24 horas: lê quem é da criança, ninguém escreve.
  await semear('acessosTemporarios/ac1', {
    childId: S('kid1'), parentUid: S(pai1.uid), adminUid: S(tio1.uid),
    expiraEm: { timestampValue: new Date(Date.now() + 3600000).toISOString() },
  });
  checar('24h', 'a titular lê o acesso do filho', 'PASSA', await ler('acessosTemporarios/ac1', pai1));
  checar('24h', 'o motorista da criança lê', 'PASSA', await ler('acessosTemporarios/ac1', tio1));
  checar('24h', 'outro motorista não lê', 'NEGA', await ler('acessosTemporarios/ac1', tio2));
  checar('24h', 'ninguém cria acesso pelo cliente', 'NEGA',
    await criar('acessosTemporarios', 'ac2', pai1, { childId: S('kid1'), parentUid: S(pai1.uid) }));
  checar('24h', 'nem estica o prazo', 'NEGA',
    await escrever('acessosTemporarios/ac1', pai1,
      { expiraEm: { timestampValue: '2099-01-01T00:00:00Z' } }, ['expiraEm']));

  // A família cadastra o segundo responsável — e só ele.
  checar('24h', 'a família cadastra o segundo responsável', 'PASSA',
    await escrever('children/kid1', pai1, { parent2Name: S('Vó Lúcia'), parent2Phone: S('11988887777') },
      ['parent2Name', 'parent2Phone']));
  checar('24h', 'mas não troca o WhatsApp principal (é a chave do irmão)', 'NEGA',
    await escrever('children/kid1', pai1, { parentPhone: S('11900000000') }, ['parentPhone']));
}

/**
 * O ACEITE DO CONTRATO E A CONTA DA FAMÍLIA (02/10/2026).
 *
 * Dois buracos achados lendo as jornadas, e os dois eram do ramo do MOTORISTA:
 *
 * 1. O `update` dele em `children` aceitava qualquer campo fora da saúde —
 *    inclusive `contractAcceptedAt`, `contractHash` e o nome de quem assinou.
 *    Um aceite que a outra parte reescreve não prova nada. Ele pode APAGAR o
 *    aceite (remover a criança zera tudo), nunca escrever um.
 * 2. "Remover criança" apagava `users/{pai}` inteiro — a mãe de dois irmãos
 *    perdia o outro filho. A conta de mais de um filho agora só sai pela
 *    callable `desvincularResponsavel`, que tira UMA criança da lista.
 *
 * Elenco próprio (`kidAceite`, `paiAceite`) para não sujar o dos outros blocos.
 */
async function oAceite({ tio1, tio2, pai1 }) {
  console.log('\n=== O ACEITE — o motorista não escreve a assinatura da família ===');
  const crianca = (extra = {}) => ({
    adminUid: S(tio1.uid), name: S('Kid Aceite'), active: B(true), ...extra,
  });

  await semear('children/kidAceite', crianca());
  checar('aceite', 'motorista NÃO grava um aceite que não houve', 'NEGA',
    await escrever('children/kidAceite', tio1,
      { contractAcceptedAt: T(0), contractAcceptedName: S('Mãe Inventada'), contractHash: S('abc') },
      ['contractAcceptedAt', 'contractAcceptedName', 'contractHash']));

  await semear('children/kidAceite', crianca({
    contractAcceptedAt: T(-5), contractAcceptedName: S('Mãe Real'), contractHash: S('h1'),
  }));
  checar('aceite', 'motorista NÃO troca o nome de quem assinou', 'NEGA',
    await escrever('children/kidAceite', tio1,
      { contractAcceptedName: S('Outra Pessoa') }, ['contractAcceptedName']));
  checar('aceite', 'motorista NÃO troca o hash do aceite', 'NEGA',
    await escrever('children/kidAceite', tio1, { contractHash: S('h2') }, ['contractHash']));
  checar('aceite', 'outro motorista NÃO apaga o aceite', 'NEGA',
    await escrever('children/kidAceite', tio2,
      { contractAcceptedAt: { nullValue: null }, contractAcceptedName: { nullValue: null },
        contractHash: { nullValue: null } },
      ['contractAcceptedAt', 'contractAcceptedName', 'contractHash']));
  // Positivas: as que a correção não pode quebrar.
  checar('pos', 'motorista APAGA o aceite ao remover a criança', 'PASSA',
    await escrever('children/kidAceite', tio1,
      { active: B(false), contractAcceptedAt: { nullValue: null },
        contractAcceptedName: { nullValue: null }, contractHash: { nullValue: null } },
      ['active', 'contractAcceptedAt', 'contractAcceptedName', 'contractHash']));
  await semear('children/kidAceite', crianca({ contractAcceptedAt: T(-5), contractHash: S('h1') }));
  checar('pos', 'motorista edita a mensalidade sem tocar no aceite', 'PASSA',
    await escrever('children/kidAceite', tio1, { monthlyFee: N(400) }, ['monthlyFee']));

  checar('aceite', 'motorista NÃO aponta qual contrato "vale"', 'NEGA',
    await escrever('children/kidAceite', tio1,
      { contratoVigente: { mapValue: { fields: { numero: { integerValue: '1' } } } } },
      ['contratoVigente']));

  // ── as versões gravadas (children/{id}/contratos/{n}) ──
  const I = (n) => ({ integerValue: String(n) });
  const versao = (extra = {}) => ({
    numero: I(1), tipo: S('contrato'), status: S('aguardando'), adminUid: S(tio1.uid),
    dados: { mapValue: { fields: { finance: { mapValue: { fields: { monthlyFee: N(400) } } } } } },
    // De quem é a versão (03/10/2026): a família da criança na emissão.
    familia: S(pai1.uid),
    ...extra,
  });
  await semear('children/kidAceite', crianca({ parentUid: S(pai1.uid) }));
  checar('pos', 'motorista emite a versão 1 do contrato', 'PASSA',
    await criar('children/kidAceite/contratos', '1', tio1, versao()));
  checar('aceite', 'motorista NÃO emite versão em nome de outra família', 'NEGA',
    await criar('children/kidAceite/contratos', '8', tio1, versao({ numero: I(8), familia: S('outraFamilia') })));
  checar('aceite', 'motorista NÃO emite versão já "aceita"', 'NEGA',
    await criar('children/kidAceite/contratos', '2', tio1, versao({ numero: I(2), status: S('aceito') })));
  checar('aceite', 'motorista NÃO emite com aceite dentro', 'NEGA',
    await criar('children/kidAceite/contratos', '3', tio1,
      versao({ numero: I(3), aceitoNome: S('Mãe Inventada') })));
  checar('aceite', 'o número do documento e o de dentro batem', 'NEGA',
    await criar('children/kidAceite/contratos', '4', tio1, versao({ numero: I(9) })));
  checar('aceite', 'outro motorista NÃO emite contrato da criança', 'NEGA',
    await criar('children/kidAceite/contratos', '5', tio2, versao({ numero: I(5), adminUid: S(tio2.uid) })));
  checar('aceite', 'a família NÃO emite contrato', 'NEGA',
    await criar('children/kidAceite/contratos', '6', pai1, versao({ numero: I(6), adminUid: S(pai1.uid) })));
  checar('pos', 'a família lê a versão emitida', 'PASSA',
    await ler('children/kidAceite/contratos/1', pai1));
  checar('aceite', 'outro motorista NÃO lê a versão', 'NEGA',
    await ler('children/kidAceite/contratos/1', tio2));
  checar('aceite', 'a família NÃO marca a versão como aceita', 'NEGA',
    await escrever('children/kidAceite/contratos/1', pai1,
      { status: S('aceito'), aceitoNome: S('Pai Um') }, ['status', 'aceitoNome']));
  checar('aceite', 'motorista NÃO edita o texto da versão emitida', 'NEGA',
    await escrever('children/kidAceite/contratos/1', tio1,
      { dados: { mapValue: { fields: {} } } }, ['dados']));
  checar('pos', 'motorista retira a versão que ninguém aceitou', 'PASSA',
    await escrever('children/kidAceite/contratos/1', tio1,
      { status: S('retirado'), retiradoEm: T(0) }, ['status', 'retiradoEm']));
  await semear('children/kidAceite/contratos/7', versao({ numero: I(7), status: S('aceito') }));
  checar('aceite', 'motorista NÃO retira a versão aceita', 'NEGA',
    await escrever('children/kidAceite/contratos/7', tio1,
      { status: S('retirado'), retiradoEm: T(0) }, ['status', 'retiradoEm']));
  checar('aceite', 'ninguém apaga uma versão', 'NEGA',
    await apagar('children/kidAceite/contratos/7', tio1));

  // ── o documento do dia que ainda não existe (teste R2, 02/10/2026) ──
  // A tela escuta `{dia}_{criança}` antes de alguém criá-lo. Antes, a regra
  // lia `resource.data` de um nulo e negava — e a escuta morria.
  await semear('children/kidAceite', crianca({ parentUid: S(pai1.uid) }));
  // 404 é a resposta CERTA aqui: a regra deixou ler e o documento não existe.
  // Recusa seria 403.
  const ausente = async (pr) => ((await pr) === 404 ? 200 : 403);
  checar('pos', 'a mãe escuta a falta de hoje antes de existir', 'PASSA',
    await ausente(ler('absenceDeclarations/2099-01-01_kidAceite', pai1)));
  checar('pos', 'a mãe escuta o "quem busca hoje" antes de existir', 'PASSA',
    await ausente(ler('altPickups/2099-01-01_kidAceite', pai1)));
  checar('pos', 'o motorista dela escuta também', 'PASSA',
    await ausente(ler('altPickups/2099-01-01_kidAceite', tio1)));
  checar('dia', 'outro motorista NÃO escuta o documento da criança alheia', 'NEGA',
    await ler('absenceDeclarations/2099-01-01_kidAceite', tio2));
  checar('dia', 'id sem criança dela não abre nada', 'NEGA',
    await ler('altPickups/2099-01-01_kidQueNaoExiste', pai1));

  // ── a conta da família ──
  const pai = (ids) => ({
    role: S('parent'), name: S('Pai Aceite'), adminUid: S(tio1.uid), childId: S(ids[0]),
    childIds: { arrayValue: { values: ids.map(S) } },
    adminUids: { arrayValue: { values: [S(tio1.uid)] } },
  });
  await semear('users/paiAceite', pai(['kidAceite', 'kidIrmao']));
  checar('aceite', 'motorista NÃO apaga a conta de quem tem 2 filhos', 'NEGA',
    await apagar('users/paiAceite', tio1));
  await semear('users/paiAceite', pai(['kidAceite']));
  checar('pos', 'motorista apaga a conta de quem tem 1 filho só', 'PASSA',
    await apagar('users/paiAceite', tio1));
}

/**
 * A CRIANÇA NASCE SEM O CONTADOR — e o contador é do servidor (03/10/2026).
 *
 * ── O QUE ESTE BLOCO MEDIA ANTES
 * Era "a vaga contratada" e depois "o contador no mesmo commit": `children` só
 * aceitava `create` se `users.criancasAtivas` subisse no MESMO lote, conferido
 * com `getAfter`. A regra do contador em `users` aceitava passos de ±1 — e o
 * próprio comentário dela confessava o que não fechava: N escritas de −1
 * chegam no mesmo lugar que uma de −N, e o contador é o número que a fatura
 * multiplica pela taxa.
 *
 * ── O QUE MUDOU
 * `criancasAtivas` e `trialInicio` foram para a lista PROIBIDA de `users`: um
 * gatilho em `children` reconta a turma, e a primeira rota liga o relógio pelo
 * servidor. A criança nasce SOZINHA, e o lote antigo (criança + contador) passa
 * a ser recusado INTEIRO — batch é atômico, e a metade do contador é proibida.
 *
 * ── E O `create` GANHOU LISTA DE PROIBIDOS
 * O `update` do motorista recusava aceite de contrato, saúde e vínculo; o
 * `create` aceitava os três. "Sempre que o update for restritivo, pergunte 'e
 * se ele criar do zero?'".
 */
/**
 * O LOTE ANTIGO: criança + contador no mesmo `:commit`. Fica como sonda — é o
 * que um app em cache, de antes de 03/10/2026, ainda manda.
 *
 * ⚠️ Um write de `update` no REST SUBSTITUI o documento quando não vai máscara
 * — por isso o `updateMask` no contador.
 */
function criarCriancaComContador(sessao, uid, idCrianca, contador) {
  const doc = (c) => `projects/${PID}/databases/(default)/documents/${c}`;
  return fetch(`${FS}:commit`, {
    method: 'POST',
    headers: H(sessao),
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: doc(`children/${idCrianca}`),
            fields: { name: S('Nova'), adminUid: S(uid), active: B(true) },
          },
          currentDocument: { exists: false },
        },
        {
          update: {
            name: doc(`users/${uid}`),
            fields: { criancasAtivas: { integerValue: String(contador) } },
          },
          updateMask: { fieldPaths: ['criancasAtivas'] },
        },
      ],
    }),
  }).then((r) => r.status);
}

/** A criança SOZINHA, como o app grava desde 03/10/2026. */
function criarCrianca(sessao, uid, idCrianca, extra = {}) {
  return criar('children', idCrianca, sessao, {
    name: S('Nova'), adminUid: S(uid), active: B(true),
    inviteStatus: S('pending'), parentUid: { nullValue: null }, ...extra,
  });
}

async function vagaContratada(tio1, tio2) {
  console.log('\n═══ A CRIANÇA NASCE SOZINHA — o contador é do servidor ═══');

  await semear(`users/${tio1.uid}`, {
    role: S('admin'),
    name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '1' },
  });

  // 1. O caminho novo: a criança sozinha. Era NEGA até 03/10/2026.
  checar('vaga', 'cria a criança sem tocar no contador', 'PASSA',
    await criarCrianca(tio1, tio1.uid, `vaga_ok_${Date.now()}`));

  // 2. O lote antigo é recusado inteiro: a metade do contador é proibida.
  checar('vaga', 'o lote antigo (criança + contador) é recusado', 'NEGA',
    await criarCriancaComContador(tio1, tio1.uid, `vaga_lote_${Date.now()}`, 2));

  // 3. Passar do antigo teto continua passando — o teto saiu em 10/09/2026.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'), name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '2' },
  });
  checar('vaga', 'a 3ª criança passa do antigo teto de 2 e ENTRA', 'PASSA',
    await criarCrianca(tio1, tio1.uid, `vaga_cresce_${Date.now()}`));

  // 4. O PAYLOAD REAL de `childrenService.addChild`, campo por campo — a
  // lista de proibidos do `create` não pode pegar nenhum campo legítimo.
  checar('vaga', 'o cadastro com o payload real do app', 'PASSA',
    await criar('children', `vaga_real_${Date.now()}`, tio1, {
      name: S('Lia'), gender: S('female'), birthDate: S(''),
      parentName: S('Mãe da Lia'), parentEmail: S(''), parentPhone: S('11988887777'),
      parentPhoneChave: S('11988887777'), parent2Name: S(''), parent2Phone: S(''),
      address: S('Rua X, 10'), cep: S('04763110'), lat: N(-23.6), lng: N(-46.7),
      geoPending: B(false), schoolId: S('esc1'), school: S('EMEF'), schoolAddress: S(''),
      schoolPhone: S(''), schoolLat: { nullValue: null }, schoolLng: { nullValue: null },
      horaPega: S('06:40'), horaEntrega: S('12:30'), turma: S(''), professora: S(''),
      period: S('morning'), pickupPeriod: S('morning'), dropoffPeriod: S('morning'),
      monthlyFee: N(300), dueDay: { integerValue: '10' },
      vigenciaInicio: S('2026-10-01'), vigenciaFim: S('2026-12-31'),
      notes: S(''), inviteCode: S('TNAB23CD'), inviteStatus: S('pending'),
      parentUid: { nullValue: null }, adminUid: S(tio1.uid), status: S('home'),
      statusUpdatedAt: T(0), active: B(true), createdAt: T(0),
    }));

  // 5. ⚠️ O QUE O `update` RECUSA, O `create` TAMBÉM. Cada um destes nascia.
  checar('vaga', 'a criança nasce com o contrato "aceito"', 'NEGA',
    await criarCrianca(tio1, tio1.uid, `vaga_aceite_${Date.now()}`, {
      contractAcceptedAt: T(0), contractAcceptedName: S('Mãe Inventada'), contractHash: S('h'),
    }));
  checar('vaga', 'nem apontando qual contrato "vale"', 'NEGA',
    await criarCrianca(tio1, tio1.uid, `vaga_vigente_${Date.now()}`, {
      contratoVigente: { mapValue: { fields: { numero: { integerValue: '1' } } } },
    }));
  checar('vaga', 'nem com nota de saúde que a mãe não consentiu', 'NEGA',
    await criarCrianca(tio1, tio1.uid, `vaga_saude_${Date.now()}`, {
      saudeNotas: S('alergia'), saudeConsentidaEm: T(0),
    }));
  checar('vaga', 'nem com o convite já "usado"', 'NEGA',
    await criarCrianca(tio1, tio1.uid, `vaga_usado_${Date.now()}`, { inviteStatus: S('used') }));
  checar('vaga', 'nem marcada como vinculada pelo irmão', 'NEGA',
    await criarCrianca(tio1, tio1.uid, `vaga_irmao_${Date.now()}`, { vinculadoPor: S('irmao') }));

  // 6. O motorista aumentando o próprio teto. O campo morreu, a trava não.
  //
  // RESSEMEAR ANTES DE MEDIR: o `:commit` sem máscara substitui o documento,
  // e sem `role` todo 403 seria falta de cadastro, não escopo.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'), name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '2' },
  });
  checar('vaga', 'o motorista aumenta o próprio limiteCriancas', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1,
      { limiteCriancas: { integerValue: '99' } }, ['limiteCriancas']));

  // E o vizinho: limite de OUTRO motorista, que nem é dele.
  await semear(`users/${tio2.uid}`, {
    role: S('admin'), name: S('Tio Dois'),
    limiteCriancas: { integerValue: '1' },
  });
  checar('vaga', 'tio1 mexe no limite do tio2', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio1,
      { limiteCriancas: { integerValue: '99' } }, ['limiteCriancas']));

  // ── trialInicio — DO SERVIDOR, desde 03/10/2026 ──────────────────────
  //
  // Era "gravável UMA vez, nunca alterável" pelo próprio motorista, na
  // primeira rota. A regra proibia a REESCRITA e aceitava qualquer data na
  // primeira escrita: o caso abaixo, com março, PASSAVA — um relógio ligado
  // seis meses no passado, vencido na hora que ele quisesse, ou no futuro e
  // nunca vencido. Agora a primeira rota liga o relógio por function.
  checar('trial', 'o motorista liga o próprio relógio no passado', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1,
      { trialInicio: { timestampValue: '2026-03-01T12:00:00Z' } }, ['trialInicio']));
  checar('trial', 'nem com a hora de agora (é do servidor)', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1, { trialInicio: T(0) }, ['trialInicio']));

  // O vizinho: nem o relógio do colega ele encosta.
  checar('trial', 'tio1 liga o relógio do tio2', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio1,
      { trialInicio: { timestampValue: '2026-03-01T12:00:00Z' } }, ['trialInicio']));

  // ── assinaturaAte — quem cobra escreve, quem deve não ───────────────
  //
  // O campo diz ATÉ QUANDO a conta está paga, e é o que decide se o app
  // bloqueia por fim de teste. Ele existe porque nenhuma regra alcança o
  // contrato de associação: o id dele é `${tioUid}_${Date.now()}`, que não
  // se calcula.
  //
  // Livre, o motorista grava o ano 2099 em si mesmo e nunca mais paga —
  // `limiteCriancas` com outro nome, o devedor editando a própria cláusula.
  checar('assinatura', 'o motorista escreve a própria assinaturaAte', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1,
      { assinaturaAte: { timestampValue: '2099-01-01T12:00:00Z' } }, ['assinaturaAte']));

  checar('assinatura', 'nem a do colega', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio1,
      { assinaturaAte: { timestampValue: '2099-01-01T12:00:00Z' } }, ['assinaturaAte']));

  // ── uso — o motorista ESCREVE, e essa é a troca ─────────────────────
  //
  // `ultimaRota` e `rotasNoMes` são gravados pelo próprio motorista, no mesmo
  // gesto que liga o GPS — e, ao contrário de `trialInicio`, `limiteCriancas` e
  // `assinaturaAte`, NÃO estão na lista proibida. A diferença é o que está em
  // jogo: mentir aqui faz ele parecer ativo e sumir de uma lista de
  // acompanhamento; mentir lá seria não pagar. Um é sinal de saúde, o outro é
  // cláusula.
  //
  // ESTE TESTE EXISTE PARA A TROCA FICAR ESCRITA. Se alguém um dia decidir que
  // o sinal de uso passa a valer dinheiro, este caso vira 'NEGA' e a gravação
  // migra para uma function — e o teste é onde a mudança de ideia aparece.
  checar('uso', 'o motorista registra a própria última rota', 'PASSA',
    await escrever(`users/${tio1.uid}`, tio1,
      { ultimaRota: { timestampValue: '2026-09-15T12:00:00Z' } }, ['ultimaRota']));

  // E o vizinho continua fora: o sinal é fraco, mas é dele.
  checar('uso', 'e não a do colega', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio1,
      { ultimaRota: { timestampValue: '2026-09-15T12:00:00Z' } }, ['ultimaRota']));

  // ── preferência de aviso — a pessoa escolhe o que toca no aparelho ───
  //
  // `avisosDesligados` NÃO precisou de rule nova: o `update` de `users` é
  // lista de PROIBIDOS, e preferência de notificação não é cláusula de
  // contrato. O caso existe justamente porque isso é fácil de quebrar SEM
  // querer — no dia em que alguém apertar a lista para uma whitelist, ou
  // acrescentar o campo aos proibidos "por segurança", a tela de
  // preferências para de salvar e o sintoma é um interruptor que volta
  // sozinho, sem erro visível.
  //
  // ⚠️ E O VIZINHO NÃO ESCREVE A PREFERÊNCIA DE NINGUÉM. Calar o aviso de
  // outra pessoa é desligar o "chegou em casa" dela pelo lado de fora — e o
  // ramo do motorista no doc do responsável não existe mais justamente para
  // esse tipo de coisa não ter porta.
  checar('preferencia', 'a pessoa desliga os próprios avisos', 'PASSA',
    await escrever(`users/${tio1.uid}`, tio1,
      { avisosDesligados: { arrayValue: { values: [{ stringValue: 'oferta' }] } } },
      ['avisosDesligados']));

  checar('preferencia', 'e não os do colega', 'NEGA',
    await escrever(`users/${tio2.uid}`, tio1,
      { avisosDesligados: { arrayValue: { values: [{ stringValue: 'oferta' }] } } },
      ['avisosDesligados']));
}

/**
 * O TETO QUE MORDE NÃO É O DE 500 OPERAÇÕES POR BATCH — É O DE 20 `get()`.
 *
 * A regra de `children/{id}/rides/{dia}` resolve permissão com um `get()` no
 * doc da criança. Num lote de "embarquei todos", cada documento aponta pra uma
 * criança DIFERENTE, então nada cacheia e o Firestore corta a requisição.
 *
 * Medido aqui: 18 crianças passa, 19 devolve 403. E batch é atômico — nada
 * salva. Uma perua escolar leva 15 a 20 crianças, ou seja, o lote caía dentro
 * da faixa de uso normal, e o erro morria num `console.error`: o motorista
 * marcava todo mundo, e nenhum pai via nada mudar.
 *
 * Este caso existe pra impedir que o CHUNK volte a subir. Ele não testa uma
 * regra; testa o custo dela — que é o tipo de coisa que nenhuma leitura de
 * código pega e nenhum teste de caminho feliz alcança, porque só aparece com
 * turma cheia.
 */
async function tetoDeGets(tio) {
  console.log('\n═══ CUSTO DA REGRA — lote de viagens ═══');
  const kids = [];
  // 20 e não 16: o caso de 19 usa slice(0, 19), e num elenco de 16 o slice
  // devolve 16 em silêncio — o teste passaria medindo outro número.
  for (let i = 0; i < 20; i += 1) {
    const id = `teto_kid_${i}_${Date.now()}`;
    await semear(`children/${id}`, {
      name: S(`Kid${i}`),
      adminUid: S(tio.uid),
      parentUid: S('p'),
      active: B(true),
      monthlyFee: N(100),
    });
    kids.push(id);
  }

  const lote = async (n) => {
    const writes = kids.slice(0, n).map((id) => ({
      update: {
        name: `projects/${PID}/databases/(default)/documents/children/${id}/rides/2026-08-25`,
        fields: { posicao: { integerValue: '1' } },
      },
    }));
    const r = await fetch(`${FS}:commit`, {
      method: 'POST',
      headers: H(tio),
      body: JSON.stringify({ writes }),
    });
    return r.status;
  };

  // Três casos, cercando a decisão pelos dois lados.
  //
  // O limiar medido é 18 passa / 19 nega. Numa primeira versão eu afirmei que
  // 16 já quebrava — e 16 passou. O número exato tinha que ser MEDIDO, não
  // deduzido do "20" da documentação: a regra também gasta acessos que não são
  // por documento, e a conta não fecha de cabeça.
  checar('teto', 'lote de 15 viagens (o CHUNK do código)', 'PASSA', await lote(15));
  checar('teto', 'lote de 19 estoura o teto de get()', 'NEGA', await lote(19));

  // E o que de fato protege: o CHUNK do fonte. Os dois casos acima provam onde
  // fica a parede; este prova que o código continua longe dela. Sem ele, subir
  // o CHUNK pra 200 de novo passaria despercebido — o lote grande só é montado
  // com turma cheia, que nenhuma conta de teste tem.
  const TETO_SEGURO = 18;
  for (const arq of ['src/services/ridesService.js', 'src/services/routeStatusService.js']) {
    const fonte = await readFile(new URL(`../${arq}`, import.meta.url), 'utf8');
    const achado = fonte.match(/const CHUNK = (\d+)/);
    const valor = achado ? Number(achado[1]) : NaN;
    checar('teto', `CHUNK de ${arq.split('/').pop()} ≤ ${TETO_SEGURO}`, 'PASSA',
      valor > 0 && valor <= TETO_SEGURO ? 200 : 403);
  }
}

/**
 * O QUE NINGUEM TESTAVA — as oito colecoes sem um unico caso, mais os dois
 * atores que o elenco nao tinha.
 *
 * POR QUE ESTE BLOCO EXISTE
 * A suite cobria treze dos vinte e quatro blocos de `firestore.rules`. Os onze
 * de fora incluiam `payments` (o dinheiro do pai) e as cinco colecoes da taxa
 * (o dinheiro da plataforma) — as duas metades do modelo financeiro, sem uma
 * sonda. Nao era descuido de quem escreveu: e o efeito de a suite ter nascido
 * de uma auditoria de ISOLAMENTO entre motoristas, e dinheiro nao ter
 * aparecido naquela auditoria.
 *
 * ALGUNS CASOS AQUI NASCEM VERMELHOS, E ISSO E O PONTO.
 * Eles afirmam o comportamento CERTO, nao o atual. Sao a rede que o item A3 do
 * plano de arquitetura (docs/arquitetura.md) precisa pra ser aplicado
 * com seguranca: sem eles, mexer
 * em rule e trocar um furo conhecido por um desconhecido.
 */
async function oQueNinguemTestava({ tio1, tio2, pai1, dono, novato, anon }) {
  // RESTAURA O ELENCO ANTES DE MEDIR — e o motivo e uma armadilha real.
  //
  // `vagaContratada` cria criancas por `:commit`, e um write de `update` no
  // REST do Firestore SUBSTITUI o documento quando nao vai mascara junto. O
  // efeito e que `users/{tio1}` sai de la com `criancasAtivas` e MAIS NADA:
  // sem `role`, o tio deixa de passar em `isAdmin()` e em `isAppUser()`.
  //
  // Enquanto esse era o ultimo bloco do arquivo, ninguem via. Qualquer teste
  // acrescentado depois dele nasce com o ator sem papel — e o 403 resultante
  // se parece com isolamento funcionando, que e exatamente a mentira que o
  // `conferirElenco()` deste arquivo existe pra impedir.
  await semear('users/' + tio1.uid, {
    role: S('admin'), name: S('Tio Um'), pixKey: S('tio1@pix.com'), phone: S('11999990000'),
  });
  await semear('users/' + tio2.uid, {
    role: S('admin'), name: S('Tio Dois'), pixKey: S('tio2@pix.com'),
  });

  console.log('\n=== A PORTA DA FRENTE — o payload REAL de `inscreverAssociado` ===');
  //
  // POR QUE ESTE BLOCO EXISTE, e e o caso mais caro que este arquivo ja
  // deixou passar.
  //
  // Todo motorista deste teste e SEMEADO com `semear`, que usa o bearer de
  // Admin SDK e ignora regras. Isso monta o cenario, mas significa que o
  // `allow create` de `users` — a porta por onde TODO motorista entra — nunca
  // era exercitado por um cliente de verdade.
  //
  // Quando `origem` nasceu no `inscreverAssociado` e nao subiu para o
  // `hasOnly`, os 202 casos daqui continuaram verdes e o produto parou de
  // aceitar cadastro: `permission-denied` em 100% das inscricoes, com a conta
  // do Auth ja criada e a pessoa presa numa sessao sem documento.
  //
  // O caso NEGATIVO abaixo e o que da valor ao positivo: ele prova que a
  // whitelist ainda e whitelist. Sem ele, alguem "conserta" um create
  // recusado trocando o `hasOnly` por `hasAll` e nada acusa.
  {
    const recem = await criarLogin(`inscricao.${Date.now()}@teste.local`);
    // Exatamente o que `src/services/associadoService.js` grava — inclusive
    // `origem`, que `resolverOrigem` SEMPRE devolve (`{canal:'direto'}` no
    // pior caso), e por isso vai em todo cadastro.
    const payloadDeInscricao = {
      role: S('admin'),
      name: S('Tio Recem Chegado'),
      email: S('recem@teste.local'),
      phone: S('11988887777'),
      city: S('Sao Paulo'),
      criancasEstimadas: N(12),
      createdAt: T(0),
      origem: {
        mapValue: { fields: { canal: S('direto'), detalhe: S('') } },
      },
    };
    checar('inscricao', 'o motorista se cadastra com o payload REAL do app', 'PASSA',
      await criar('users', recem.uid, recem, payloadDeInscricao));

    const outro = await criarLogin(`inscricao2.${Date.now()}@teste.local`);
    checar('inscricao', 'e sem `origem` tambem passa (o campo e opcional)', 'PASSA',
      await criar('users', outro.uid, outro, {
        role: S('admin'), name: S('Tio Sem Origem'), email: S('so@teste.local'),
        phone: S('11977776666'), city: S('Osasco'), criancasEstimadas: N(3),
        createdAt: T(0),
      }));

    // A WHITELIST CONTINUA SENDO WHITELIST. Um campo a mais e recusa, e cada
    // um destes seria uma fraude: nascer com teto, com o teste escolhido, ja
    // pago, ou dono.
    const comExtra = (extra) => {
      const terceiro = criarLogin(`inscricao.extra.${Date.now()}.${Math.random()}@teste.local`);
      return terceiro.then((s) =>
        criar('users', s.uid, s, {
          role: S('admin'), name: S('Tio Esperto'), email: S('e@teste.local'),
          phone: S('11966665555'), city: S('Diadema'), criancasEstimadas: N(1),
          createdAt: T(0), ...extra,
        }));
    };
    checar('inscricao', 'mas nao nasce com `limiteCriancas`', 'NEGA',
      await comExtra({ limiteCriancas: N(999) }));
    checar('inscricao', 'nem com `trialInicio` escolhido a dedo', 'NEGA',
      await comExtra({ trialInicio: T(0) }));
    checar('inscricao', 'nem com `assinaturaAte` no futuro', 'NEGA',
      await comExtra({ assinaturaAte: T(365) }));
    checar('inscricao', 'nem com `superAdmin`', 'NEGA',
      await comExtra({ superAdmin: B(true) }));
    checar('inscricao', 'nem com o aceite de termos ja forjado', 'NEGA',
      await comExtra({ termsVersion: S('v1') }));
  }

  console.log('\n=== O DINHEIRO — as duas metades, sem cobertura ate aqui ===');

  await semear('payments/pag1', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
    childName: S('Ana'), month: S('2026-08'), amount: N(300), status: S('pending'),
  });
  await semear('payments/pag1/events/ev1', { tipo: S('criado'), por: S(tio1.uid) });

  checar('pos', 'tio1 le o proprio pagamento', 'PASSA', await ler('payments/pag1', tio1));
  checar('pos', 'o pai le a propria mensalidade', 'PASSA', await ler('payments/pag1', pai1));
  checar('dinheiro', 'tio2 le o pagamento do tio1', 'NEGA', await ler('payments/pag1', tio2));
  checar('dinheiro', 'tio2 da baixa no pagamento do tio1', 'NEGA',
    await escrever('payments/pag1', tio2, { status: S('paid') }, ['status']));

  // A trilha e append-only DE PROPOSITO (update e delete sao false). Isso torna
  // o `create` a unica porta — e um evento forjado por outro motorista fica la
  // pra sempre, porque nem o dono consegue apagar.
  checar('dinheiro', 'tio2 le a trilha do pagamento alheio', 'NEGA',
    await ler('payments/pag1/events/ev1', tio2));
  checar('dinheiro', 'tio2 forja evento na trilha alheia', 'NEGA',
    await criar('payments/pag1/events', 'forjado', tio2, { tipo: S('pago'), por: S(tio2.uid) }));

  await semear('taxaConfig/app', { diaVencimento: N(10), pixKey: S('plataforma@x.com') });
  await semear('taxaParceiros/' + tio1.uid, { notaInterna: S('conversou em agosto') });
  await semear('faturasParceiro/' + tio1.uid + '_2026-08', { tioUid: S(tio1.uid), total: N(180) });

  // ESTE CASO ESPERAVA 'PASSA', COM A JUSTIFICATIVA "pra saber pra onde pagar"
  // — e a justificativa era falsa. `fecharFatura` COPIA a chave PIX pra dentro
  // da fatura, e o comentário dele diz por quê: "o motorista não lê a
  // estrutura de preço da plataforma, e não deveria".
  //
  // Três arquivos afirmavam que esta coleção era `read: isOwner()`. A rule
  // dizia `isAdmin() || isOwner()`, e o teste carimbava a rule. Um invariante
  // documentado em três lugares, violado ao lado, e um caso verde por cima.
  checar('taxa', 'o motorista le a regua de preco da plataforma', 'NEGA',
    await ler('taxaConfig/app', tio1));
  checar('pos', 'o dono le a regua de preco', 'PASSA',
    await ler('taxaConfig/app', dono));
  // A estrutura de preco da plataforma nao e assunto do responsavel: ele nao
  // tem tela que leia isto, e o bloco vizinho (taxaParceiros) ja argumenta que
  // preco nao pode vazar nem pro proprio motorista.
  checar('taxa', 'o responsavel le a estrutura de preco da plataforma', 'NEGA',
    await ler('taxaConfig/app', pai1));
  checar('taxa', 'tio2 le a negociacao do tio1', 'NEGA',
    await ler('taxaParceiros/' + tio1.uid, tio2));
  // ── A CLÁUSULA DE PREÇO (06/09/2026) ─────────────────────────────────
  //
  // O modelo virou taxa por crianca, e cada campo abaixo e clausula: livre, o
  // motorista se poe no plano mais barato, se marca fundador vitalicio, se da
  // cinco indicacoes que nao existem e se isenta ate 2099. Clausula que o
  // devedor edita nao e clausula.
  checar('preco', 'o motorista escolhe o proprio plano', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { plano: S('anual') }, ['plano']));
  // ⚠️ `planoId` MORREU COMO CAMPO E CONTINUA PROIBIDO. Documento antigo ainda
  // o tem, e campo sem gravador nao e campo livre.
  checar('preco', 'nem escreve o planoId morto', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { planoId: S('ate40') }, ['planoId']));
  checar('preco', 'o motorista se marca fundador vitalicio', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { condicaoFundador: S('vitalicio') }, ['condicaoFundador']));
  checar('preco', 'o motorista inventa indicacoes', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { indicacoesAtivas: N(5) }, ['indicacoesAtivas']));
  checar('preco', 'o motorista se isenta ate 2099', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { isencaoAte: S('2099-12') }, ['isencaoAte']));
  checar('preco', 'e o vizinho tambem nao mexe no plano dele', 'NEGA',
    await escrever('users/' + tio1.uid, tio2, { plano: S('anual') }, ['plano']));
  checar('pos', 'o dono define o plano do parceiro', 'PASSA',
    await escrever('users/' + tio1.uid, dono, { plano: S('mensal') }, ['plano']));
  checar('pos', 'e a condicao de fundador', 'PASSA',
    await escrever('users/' + tio1.uid, dono, { condicaoFundador: S('metade') }, ['condicaoFundador']));

  // ── A CONCESSAO (06/09/2026) ─────────────────────────────────────────
  //
  // Ela e a clausula mais perigosa da lista, e nasceu ja protegida.
  //
  // `concessoes` e a EXCECAO que o dono abre a tabela. Livre, o motorista se
  // concede 90% por doze meses com o motivo que quiser, e a fatura sai
  // obedecendo: `precoDoMes` nao julga concessao, ele soma a fracao que
  // encontrar. O efeito ja estava barrado (`descontos`, `isencaoAte`), mas o
  // REGISTRO tambem precisa estar — senao a ficha mostraria uma concessao que
  // o dono nunca abriu, e a proxima tela que ler dali gravaria o efeito.
  const CONCESSAO = {
    arrayValue: {
      values: [
        {
          mapValue: {
            fields: {
              tipo: S('desconto'),
              fracao: N(0.9),
              ate: S('2027-12'),
              motivo: S('porque eu quis'),
            },
          },
        },
      ],
    },
  };
  checar('preco', 'o motorista se concede 90%', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { concessoes: CONCESSAO }, ['concessoes']));
  checar('preco', 'nem o vizinho concede pra ele', 'NEGA',
    await escrever('users/' + tio1.uid, tio2, { concessoes: CONCESSAO }, ['concessoes']));
  checar('pos', 'o dono concede', 'PASSA',
    await escrever('users/' + tio1.uid, dono, { concessoes: CONCESSAO }, ['concessoes']));

  // ── O SELO (06/09/2026) ──────────────────────────────────────────────
  //
  // A forma desta trava e DIFERENTE das outras deste bloco, e o motivo e que
  // aqui nao da pra proibir a ESCRITA: o motorista precisa poder dizer "enviei
  // o alvara". Entao a rule prende o VALOR — a unica coisa que distingue
  // "enviei" de "estou verificado".
  //
  // Sem isto o selo nao valeria nada, e valeria MENOS que nada: a familia veria
  // "alvara municipal conferido" numa tela em que ninguem conferiu. E a
  // decisao 6 — verificacao e selo, e selo que o proprio se da e propaganda.
  checar('selo', 'o motorista diz que enviou o alvara', 'PASSA',
    await escrever('users/' + tio1.uid, tio1, { verificacao: S('enviada') }, ['verificacao']));
  checar('selo', 'mas nao se marca verificado', 'NEGA',
    await escrever('users/' + tio1.uid, tio1, { verificacao: S('verificada') }, ['verificacao']));
  checar('selo', 'nem assina a data da conferencia', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { verificadoEm: { timestampValue: '2026-09-15T12:00:00Z' } }, ['verificadoEm']));
  checar('selo', 'nem estica a validade do proprio alvara', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { alvaraValidade: { timestampValue: '2099-01-01T12:00:00Z' } }, ['alvaraValidade']));
  checar('selo', 'e nao verifica o vizinho', 'NEGA',
    await escrever('users/' + tio2.uid, tio1, { verificacao: S('verificada') }, ['verificacao']));
  checar('pos', 'o dono confere', 'PASSA',
    await escrever('users/' + tio1.uid, dono, { verificacao: S('verificada') }, ['verificacao']));

  // ── O ADESIVO: a colecao que existe por causa do ENDERECO ────────────
  //
  // Ele nao pode morar em `users` (as familias leem, e a perua sai da casa do
  // motorista) nem em `taxaParceiros` (que guarda a nota interna do dono sobre
  // ele, e rules nao escondem campo). Daqui: o dono le tudo, ele le so o dele.
  const ADESIVO = (uid) => ({
    tioUid: S(uid),
    estado: S('pedido'),
    endereco: { mapValue: { fields: { cep: S('13000-000'), numero: S('10') } } },
  });
  checar('adesivo', 'o motorista pede o proprio', 'PASSA',
    await escrever('pedidosAdesivo/' + tio1.uid, tio1, ADESIVO(tio1.uid)));
  checar('adesivo', 'e le o proprio pedido', 'PASSA',
    await ler('pedidosAdesivo/' + tio1.uid, tio1));
  // ⚠️ O ENDERECO DE UM NAO E DO OUTRO. `isAdmin()` sozinho aqui entregaria o
  // endereco residencial de todo parceiro a qualquer conta de motorista.
  checar('adesivo', 'tio2 le o endereco do tio1', 'NEGA',
    await ler('pedidosAdesivo/' + tio1.uid, tio2));
  checar('adesivo', 'e nao pede no lugar dele', 'NEGA',
    await escrever('pedidosAdesivo/' + tio2.uid, tio1, ADESIVO(tio2.uid)));
  // Quem posta e o dono: um motorista que se marca "entregue" apaga a unica
  // linha que faria o adesivo sair.
  checar('adesivo', 'o motorista se marca entregue', 'NEGA',
    await escrever('pedidosAdesivo/' + tio1.uid, tio1, { estado: S('entregue') }, ['estado']));
  checar('pos', 'o dono posta o adesivo', 'PASSA',
    await escrever('pedidosAdesivo/' + tio1.uid, dono, { estado: S('postado') }, ['estado']));
  checar('pos', 'e le a fila inteira', 'PASSA',
    await listar('pedidosAdesivo', dono));

  // ── A INDICACAO (06/09/2026) ─────────────────────────────────────────
  //
  // O estado `ativa` vale 10% de desconto. Se o indicador pudesse escreve-lo,
  // ele indicaria cinco cadastros de teste e zeraria a propria conta com
  // receita que nunca entrou — a carencia deixaria de existir.
  const IND = (uid) => ({
    indicadorUid: S(uid),
    chave: S('11911112222'),
    telefoneDigitado: S('(11) 91111-2222'),
    estado: S('pendente'),
  });
  // ⚠️ `em` E A HORA DO SERVIDOR DESDE 03/10/2026 — "vale quem indicou
  // primeiro", e com `em` do cliente o segundo gravava o ano passado e roubava
  // o credito. Por isso os casos de criacao vao com `REQUEST_TIME`.
  checar('indicacao', 'quem indica depois finge ter indicado antes', 'NEGA',
    await criar('indicacoes', tio1.uid + '_11977778888', tio1,
      { ...IND(tio1.uid), chave: S('11977778888'), em: { timestampValue: '2025-01-01T00:00:00Z' } }));
  checar('indicacao', 'o id nao bate com a chave (contaria em dobro)', 'NEGA',
    await criarComHoraDoServidor('indicacoes/' + tio1.uid + '_outro', tio1, IND(tio1.uid), 'em'));
  checar('indicacao', 'nem leva campo de fora (estado de ativacao, desconto)', 'NEGA',
    await criarComHoraDoServidor('indicacoes/' + tio1.uid + '_11966667777', tio1,
      { ...IND(tio1.uid), chave: S('11966667777'), ativadaEm: T(0) }, 'em'));
  checar('indicacao', 'o motorista indica alguem', 'PASSA',
    await criarComHoraDoServidor('indicacoes/' + tio1.uid + '_11911112222', tio1, IND(tio1.uid), 'em'));
  checar('indicacao', 'e le a propria', 'PASSA',
    await ler('indicacoes/' + tio1.uid + '_11911112222', tio1));
  // ⚠️ A indicacao de um NAO e do outro: ela carrega o telefone de um terceiro
  // que ainda nem e usuario da plataforma.
  checar('indicacao', 'tio2 le a indicacao do tio1', 'NEGA',
    await ler('indicacoes/' + tio1.uid + '_11911112222', tio2));
  // ⚠️ E A LISTAGEM E DO DONO. Uma consulta por `chave` nao e escopada por
  // dono: liberada, ela entrega a lista de telefones que a base inteira
  // indicou a quem criar uma conta em trinta segundos.
  checar('indicacao', 'o motorista lista todas as indicacoes', 'NEGA',
    await listar('indicacoes', tio1));
  checar('pos', 'o dono lista as indicacoes', 'PASSA',
    await listar('indicacoes', dono));
  // Nascer ativa seria a carencia pulada numa unica escrita.
  checar('indicacao', 'ela nao nasce ativa', 'NEGA',
    await criarComHoraDoServidor('indicacoes/' + tio1.uid + '_11933334444', tio1,
      { ...IND(tio1.uid), chave: S('11933334444'), estado: S('ativa') }, 'em'));
  checar('indicacao', 'nem indica em nome do vizinho', 'NEGA',
    await criarComHoraDoServidor('indicacoes/' + tio2.uid + '_11955556666', tio1,
      { ...IND(tio2.uid), chave: S('11955556666') }, 'em'));
  // O DESCONTO E DO DONO. Este e o campo que a fatura le.
  checar('indicacao', 'o motorista se ativa a propria indicacao', 'NEGA',
    await escrever('indicacoes/' + tio1.uid + '_11911112222', tio1,
      { estado: S('ativa') }, ['estado']));
  checar('pos', 'o dono ativa a indicacao', 'PASSA',
    await escrever('indicacoes/' + tio1.uid + '_11911112222', dono,
      { estado: S('ativa') }, ['estado']));

  // ── A PESQUISA (06/09/2026) ──────────────────────────────────────────
  //
  // Nao ha dinheiro nem promessa aqui: alguem levantou a mao para um recurso
  // que ainda nao existe. O que a rule protege e a LISTAGEM — quem na base
  // quer o que e informacao comercial da plataforma, nao dado do motorista.
  checar('interesse', 'o motorista levanta a mao', 'PASSA',
    await escrever('interesses/' + tio1.uid + '_cartao', tio1,
      { tioUid: S(tio1.uid), assunto: S('cartao') }));
  checar('interesse', 'e le o proprio', 'PASSA',
    await ler('interesses/' + tio1.uid + '_cartao', tio1));
  checar('interesse', 'mas nao levanta a mao pelo vizinho', 'NEGA',
    await escrever('interesses/' + tio2.uid + '_cartao', tio1,
      { tioUid: S(tio2.uid), assunto: S('cartao') }));
  // ⚠️ A TOMADA (03/10/2026): o `update` conferia so o documento NOVO, entao
  // tio2 reescrevia o interesse do tio1 com o proprio uid e a mao levantada
  // sumia da pesquisa. Primeiro o doc do tio1 existe (caso acima); depois o
  // vizinho tenta tomar.
  checar('interesse', 'o vizinho toma o interesse ja registrado', 'NEGA',
    await escrever('interesses/' + tio1.uid + '_cartao', tio2,
      { tioUid: S(tio2.uid), assunto: S('cartao') }));
  checar('pos', 'o dono do interesse continua atualizando o dele', 'PASSA',
    await escrever('interesses/' + tio1.uid + '_cartao', tio1,
      { tioUid: S(tio1.uid), assunto: S('cartao') }));
  checar('interesse', 'e nao lista a pesquisa da casa', 'NEGA',
    await listar('interesses', tio1));
  checar('pos', 'o dono le a pesquisa', 'PASSA',
    await listar('interesses', dono));

  // ── AS CONSULTAS QUE O APP REALMENTE FAZ ─────────────────────────────
  //
  // ⚠️ `read` COBRE `list`, MAS SÓ PARA CONSULTA ESCOPADA. `indicar` e a tela
  // `/tio/indicar` fazem `where('indicadorUid', '==', uid)` ANTES de gravar —
  // se essa consulta for negada, o motorista nao consegue indicar ninguem e a
  // tela dele fica vazia, sem erro visivel.
  //
  // A listagem SEM filtro ja e testada acima como NEGA. Este caso e o outro
  // lado: sem ele, so provamos o que nao funciona.
  checar('indicacao', 'o motorista consulta as indicacoes DELE', 'PASSA',
    await consultar('indicacoes', 'indicadorUid', tio1.uid, tio1));
  // E a mesma consulta apontada pro vizinho continua fechada.
  checar('indicacao', 'e nao consulta as do vizinho', 'NEGA',
    await consultar('indicacoes', 'indicadorUid', tio2.uid, tio1));

  // ── O `conceder` COM O PAYLOAD REAL ──────────────────────────────────
  //
  // `hasOnly` e avaliado sobre o conjunto INTEIRO de campos tocados. Testar
  // `concessoes` sozinho nao prova nada sobre a escrita que o app faz: ela leva
  // `concessoes` + `descontos` + `isencaoAte` no MESMO lote, porque o registro e
  // o efeito nao podem se separar. Se um deles ficasse de fora da lista, a
  // concessao falharia inteira — em producao, na primeira vez.
  checar('pos', 'o dono concede registro e efeito juntos', 'PASSA',
    await escrever('users/' + tio1.uid, dono, {
      concessoes: CONCESSAO,
      descontos: { arrayValue: { values: [
        { mapValue: { fields: {
          origem: S('concessao'), fracao: N(0.3), ate: S('2027-02'),
        } } },
      ] } },
      isencaoAte: S('2026-11'),
    }, ['concessoes', 'descontos', 'isencaoAte']));

  // ── AS SETE PORTAS QUE A AUTOINSCRICAO ABRIU (06/09/2026) ────────────
  //
  // Auditoria depois da virada comercial. Cada caso aqui e um ataque que uma
  // conta de motorista criada em trinta segundos executava.

  // 1. APAGAR E RECRIAR era a volta por fora de TODA a tranca: some
  // `suspenso`, some `trialInicio` (90 dias de novo, repetivel pra sempre) e
  // some `limiteCriancas`. O `update` estava blindado campo a campo; o par
  // delete -> create passava por fora da lista inteira.
  const comHistoria = await criarLogin(`historia.${Date.now()}@teste.local`);
  await semear(`users/${comHistoria.uid}`, {
    role: S('admin'), name: S('Com Historia'), trialInicio: T(-100), suspenso: B(true),
  });
  checar('porta', 'suspenso apaga o proprio doc pra se recriar limpo', 'NEGA',
    await apagar('users/' + comHistoria.uid, comHistoria));
  // Conta nova, sem historia, continua podendo sair — e e o caso comum de
  // LGPD: "criei e me arrependi".
  const semHistoria = await criarLogin(`limpo.${Date.now()}@teste.local`);
  await semear(`users/${semHistoria.uid}`, { role: S('admin'), name: S('Limpo') });
  checar('pos', 'conta sem historia ainda se apaga', 'PASSA',
    await apagar('users/' + semHistoria.uid, semHistoria));
  // ⚠️ A HISTORIA QUE IMPEDE APAGAR MUDOU (03/10/2026): era `trialInicio`, e
  // agora o servidor guarda o relogio em `taxaParceiros` e o restaura se o doc
  // voltar. O que segue morando so aqui e a TURMA — o contador, que tambem e
  // do servidor agora.
  const comTurma = await criarLogin(`turma.${Date.now()}@teste.local`);
  await semear(`users/${comTurma.uid}`, {
    role: S('admin'), name: S('Com Turma'), criancasAtivas: { integerValue: '2' },
  });
  checar('porta', 'motorista com criancas ativas apaga o proprio doc', 'NEGA',
    await apagar('users/' + comTurma.uid, comTurma));
  const soRelogio = await criarLogin(`relogio.${Date.now()}@teste.local`);
  await semear(`users/${soRelogio.uid}`, {
    role: S('admin'), name: S('So Relogio'), trialInicio: T(-30),
    criancasAtivas: { integerValue: '0' },
  });
  checar('pos', 'quem rodou rota mas nao tem crianca ativa se apaga', 'PASSA',
    await apagar('users/' + soRelogio.uid, soRelogio));

  // 2. COBRANCA FORJADA na familia de outro motorista. O cliente nunca criou
  // `payments` — quem cria e a Cloud Function, com Admin SDK.
  checar('porta', 'motorista cria cobranca apontada pra familia alheia', 'NEGA',
    await criar('payments', 'forjado-' + Date.now(), tio2, {
      adminUid: S(tio2.uid), parentUid: S(pai1.uid), amount: N(300), status: S('pending'),
    }));

  // 3. BUZINA na familia de outro motorista: toca em tela cheia, com o nome de
  // uma crianca dentro. A consequencia nao e vazamento — e a crianca descendo
  // para uma van errada.
  checar('porta', 'motorista buzina na familia de outro', 'NEGA',
    await criar('pendingCalls', 'buzina-' + Date.now(), tio2, {
      adminUid: S(tio2.uid), parentUid: S(pai1.uid), childId: S('kid1'),
      childName: S('Ana'), status: S('ringing'),
    }));
  checar('pos', 'mas buzina na propria familia continua', 'PASSA',
    await criar('pendingCalls', 'ok-' + Date.now(), tio1, {
      adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
      childName: S('Ana'), status: S('ringing'),
    }));

  // 4. CRIANCA PLANTADA na conta de uma familia alheia: `parentUid` e do
  // `redeemInvite`, e o cadastro grava `null`.
  checar('porta', 'motorista cadastra crianca apontando familia alheia', 'NEGA',
    await criar('children', 'plantada-' + Date.now(), tio2, {
      name: S('Fantasma'), adminUid: S(tio2.uid), parentUid: S(pai1.uid), active: B(true),
    }));

  // 5. AVALIACAO PRIVADA de terceiro, lida por id. A decisao 12 tirou o
  // `isAdmin()` do `list` e esqueceu o `get`.
  await semear('feedbacks/privado1', {
    uid: S(pai1.uid), role: S('parent'), allowTestimonial: B(false),
    answers: { mapValue: { fields: { rating: N(2) } } },
  });
  checar('porta', 'motorista le a avaliacao privada de um responsavel', 'NEGA',
    await ler('feedbacks/privado1', tio2));
  checar('pos', 'o dono le', 'PASSA', await ler('feedbacks/privado1', dono));
  checar('pos', 'e o autor le a propria', 'PASSA', await ler('feedbacks/privado1', pai1));

  // 6. O PONTEIRO DA VITRINE. A janela do bootstrap ficava aberta sempre que
  // `appState/init` nao existisse — e o primeiro cadastrado apontava pra si.
  checar('porta', 'motorista cria appState/init apontando pra si', 'NEGA',
    await criar('appState', 'novo-' + Date.now(), tio2, { adminUid: S(tio2.uid) }));

  // ── VARIOS DONOS, E O LEGADO `superAdmin` NAO ABRE MAIS NADA ─────────
  //
  // `isOwner()` sempre checou o PAPEL, nunca a identidade — duas contas com
  // `role: 'owner'` sempre foram duas donas. O que dizia o contrario era um
  // comentario, e o bloco das rules chegou a se contradizer dentro de si.
  //
  // O fallback `superAdmin` saiu em 06/09/2026: a base e zero e a conta de
  // dono ainda vai ser criada, entao era a unica janela em que ele podia sair
  // sem trancar ninguem.
  const dono2 = await criarLogin(`dono2.${Date.now()}@teste.local`);
  const falsoDono = await criarLogin(`falso.${Date.now()}@teste.local`);
  await semear(`users/${dono2.uid}`, { role: S('owner'), name: S('Dona Dois') });
  await semear(`users/${falsoDono.uid}`, {
    role: S('admin'), name: S('Legado'), superAdmin: B(true),
  });

  checar('pos', 'o SEGUNDO dono le a regua de preco', 'PASSA',
    await ler('taxaConfig/app', dono2));
  checar('pos', 'e lista users como o primeiro', 'PASSA', await listar('users', dono2));
  checar('priv', 'o legado superAdmin nao abre mais o painel', 'NEGA',
    await listar('users', falsoDono));
  checar('priv', 'nem le a regua de preco', 'NEGA',
    await ler('taxaConfig/app', falsoDono));

  console.log('\n=== A TRANCA — teste vencido e atraso nao sao motorista ===');

  // ESTE BLOCO E O MAIS CARO DE ERRAR DO ARQUIVO.
  //
  // Ele prova que a conta inativa para de escrever de VERDADE, e nao so na
  // tela — `GuardaDaConta` esconde o painel, mas o token continua valido e uma
  // aba antiga escreve igual. E prova, junto, que o bloqueado NAO fica preso:
  // ele ainda alcanca o caminho de voltar a pagar.
  const vencido = await criarLogin(`vencido.${Date.now()}@teste.local`);
  const emDia = await criarLogin(`emdia.${Date.now()}@teste.local`);
  const carencia = await criarLogin(`carencia.${Date.now()}@teste.local`);

  // Teste iniciado ha 100 dias, nunca pagou. Acabou.
  await semear(`users/${vencido.uid}`, {
    role: S('admin'), name: S('Vencido'), trialInicio: T(-100),
  });
  // Teste vencido, mas com assinatura em dia: e cliente.
  await semear(`users/${emDia.uid}`, {
    role: S('admin'), name: S('Em dia'), trialInicio: T(-200), assinaturaAte: T(20),
  });
  // Assinatura venceu ha 3 dias — dentro da folga. A TELA ja bloqueou; a rule
  // ainda deixa passar, e a assimetria e deliberada: errar para o lado
  // permissivo custa uma aba velha escrevendo; errar para o outro tranca um
  // motorista PAGANTE as seis da manha.
  await semear(`users/${carencia.uid}`, {
    role: S('admin'), name: S('Carencia'), trialInicio: T(-200), assinaturaAte: T(-3),
  });

  // ⚠️ A TRANCA SO EXISTE COM A COBRANCA LIGADA (02/10/2026). A chave unica
  // `platformConfig/app.cobrancaLigada` nasce desligada — ausente e desligada
  // —, e desligada ninguem e trancado por teste vencido. Este bloco liga a
  // chave para medir a tranca; o caso desligado vem logo depois.
  await semear('platformConfig/app', { cobrancaLigada: B(true) });

  checar('tranca', 'quem esta com o teste vencido cadastra crianca', 'NEGA',
    await criar('children', `kid-vencido-${Date.now()}`, vencido, {
      name: S('X'), adminUid: S(vencido.uid), active: B(true),
    }));
  checar('tranca', 'e nem escreve a propria posicao ao vivo', 'NEGA',
    await escrever('liveLocation/' + vencido.uid, vencido, { lat: N(-23) }, ['lat']));
  checar('tranca', 'nem cria recado de escola', 'NEGA',
    await criar('schoolBroadcasts', `br-vencido-${Date.now()}`, vencido, {
      adminUid: S(vencido.uid), texto: S('oi'),
    }));

  // COM A COBRANCA DESLIGADA, O MESMO VENCIDO OPERA. Sem isto, esconder as
  // telas de cobranca nao bastava: no dia 91 o app quebrava calado.
  await semear('platformConfig/app', { cobrancaLigada: B(false) });
  checar('pos', 'cobranca desligada: o vencido escreve a posicao ao vivo', 'PASSA',
    await escrever('liveLocation/' + vencido.uid, vencido, { lat: N(-23) }, ['lat']));
  checar('pos', 'e cria recado de escola', 'PASSA',
    await criar('schoolBroadcasts', `br-desligada-${Date.now()}`, vencido, {
      adminUid: S(vencido.uid), texto: S('oi'),
    }));
  await semear('platformConfig/app', { cobrancaLigada: B(true) });

  // ⚠️ ESTES TRES CASOS MEDEM O ESTADO DA CONTA, NAO O CONTADOR. Desde
  // 03/10/2026 a crianca nasce sozinha (o contador e do servidor), entao o
  // POST solto e o caminho certo — o lote com contador seria recusado pela
  // lista proibida de `users` e "provaria" um bloqueio que nao existe.
  checar('pos', 'quem esta com a assinatura em dia opera normalmente', 'PASSA',
    await criarCrianca(emDia, emDia.uid, `kid-emdia-${Date.now()}`));
  checar('pos', 'e quem venceu ha 3 dias ainda opera (a folga da rule)', 'PASSA',
    await criarCrianca(carencia, carencia.uid, `kid-carencia-${Date.now()}`));
  // Quem nunca rodou uma rota nao tem `trialInicio`: o relogio nao comecou.
  // Bloquear aqui seria bloquear todo mundo no primeiro dia.
  checar('pos', 'quem nunca rodou rota nao e bloqueado', 'PASSA',
    await criarCrianca(novato, novato.uid, `kid-novato-${Date.now()}`));

  // ⚠️ O RESPIRO. Sem ele, o bloqueado nao consegue CONTRATAR — que e
  // exatamente o que o desbloqueia — e o beco nao tem saida dentro do produto.
  checar('pos', 'o bloqueado ainda le o proprio cadastro', 'PASSA',
    await ler('users/' + vencido.uid, vencido));
  await semear('faturasParceiro/' + vencido.uid + '_2026-09', {
    tioUid: S(vencido.uid), total: N(149), status: S('aberta'),
  });
  checar('pos', 'o bloqueado ainda le a propria fatura (pra pagar)', 'PASSA',
    await ler('faturasParceiro/' + vencido.uid + '_2026-09', vencido));
  // O documento INTEIRO de novo — ver o aviso em `semear`.
  await semear(`users/${vencido.uid}`, {
    role: S('admin'), name: S('Vencido'), trialInicio: T(-100), plano: S('mensal'),
  });
  checar('pos', 'e o bloqueado AINDA EMITE contrato — o caminho de voltar', 'PASSA',
    await criar('contratosAssociacao', vencido.uid + '_' + Date.now(), vencido, {
      tioUid: S(vencido.uid),
      aceitoEm: { nullValue: null },
      conteudo: {
        mapValue: { fields: { plano: { mapValue: { fields: { id: S('mensal') } } } } },
      },
    }));

  // ── O ASSOCIADO EMITE O PROPRIO CONTRATO ─────────────────────────────
  //
  // O dono acabou de gravar 'mensal' no plano do tio1 (caso acima). A regra
  // exige que o plano DENTRO do contrato bata com esse — senao ele assinaria
  // um documento com o preco do anual e o compromisso do mensal, e e o
  // documento que aparece numa discussao.
  //
  // ⚠️ A AMARRA E SOBRE O PLANO, NAO SOBRE O VALOR. Com preco por crianca o
  // valor muda todo mes; exigir que o contrato repita um numero faria o
  // documento nascer invalido na crianca seguinte.
  const contrato = (plano) => ({
    tioUid: S(tio1.uid),
    aceitoEm: { nullValue: null },
    conteudo: {
      mapValue: {
        fields: { plano: { mapValue: { fields: { id: S(plano) } } } },
      },
    },
  });
  checar('pos', 'o motorista emite o contrato do plano que o dono gravou', 'PASSA',
    await criar('contratosAssociacao', tio1.uid + '_1', tio1, contrato('mensal')));
  checar('preco', 'mas nao um contrato de plano DIFERENTE', 'NEGA',
    await criar('contratosAssociacao', tio1.uid + '_2', tio1, contrato('anual')));
  checar('preco', 'nem emite contrato no nome de outro motorista', 'NEGA',
    await criar('contratosAssociacao', tio2.uid + '_1', tio2, contrato('mensal')));
  // Quem nao contratou nada nao tem `plano`, entao nao ha o que bater.
  checar('preco', 'quem nao contratou nao emite contrato nenhum', 'NEGA',
    await criar('contratosAssociacao', novato.uid + '_1', novato, contrato('mensal')));

  // A prospeccao saiu das rules junto com o orcamento.
  await semear('leadsFunil/lead1', { nome: S('Motorista X'), etapa: S('novo') });
  checar('funil', 'nem o dono alcanca o funil que saiu das rules', 'NEGA',
    await ler('leadsFunil/lead1', dono));

  checar('taxa', 'tio2 le a fatura do tio1', 'NEGA',
    await ler('faturasParceiro/' + tio1.uid + '_2026-08', tio2));
  checar('pos', 'o dono le a fatura que emitiu', 'PASSA',
    await ler('faturasParceiro/' + tio1.uid + '_2026-08', dono));

  console.log('\n=== O BENEFICIO E A FILA ===');

  // `premios` SAIU das rules em 07/09/2026 junto com a roleta — sem match, ela
  // cai no default deny. Os casos continuam aqui pelo mesmo motivo das filas de
  // espera abaixo: o dado pode ter sobrado no banco, e o que importa e que
  // ninguem alcance o que sobrou. Um premio orfao ainda e beneficio em
  // dinheiro.
  await semear('premios/' + tio1.uid, { premioId: S('desconto30'), fracao: N(0.3) });
  checar('bonus', 'o motorista nao le nem o proprio premio orfao', 'NEGA',
    await ler('premios/' + tio1.uid, tio1));
  checar('bonus', 'tio2 le o premio do tio1', 'NEGA',
    await ler('premios/' + tio1.uid, tio2));
  checar('bonus', 'nem o dono alcanca o que sobrou', 'NEGA',
    await ler('premios/' + tio1.uid, dono));
  checar('bonus', 'o motorista escreve o proprio premio', 'NEGA',
    await escrever('premios/' + tio1.uid, tio1, { meses: N(4) }, ['meses']));
  checar('bonus', 'o motorista varre a lista de premios', 'NEGA',
    await listar('premios', tio1));

  // As duas listas de espera SAIRAM das rules em 06/09/2026 — sem match, elas
  // caem no default deny. O caso continua aqui porque o dado pode ter sobrado
  // no banco, e o que importa e que ninguem alcance o que sobrou.
  await semear('waitlistParents/lead1', {
    name: S('Familia Souza'), email: S('souza@x.com'), createdAt: S('2026-08-01'),
  });
  checar('fila', 'o motorista le os leads de familia da plataforma', 'NEGA',
    await ler('waitlistParents/lead1', tio1));
  checar('fila', 'nem o DONO alcanca a lista que saiu das rules', 'NEGA',
    await ler('waitlistParents/lead1', dono));

  console.log('\n=== O MOTORISTA RECEM-CADASTRADO — `isAdmin()` sem nada por tras ===');

  // ESTE BLOCO E A CONSEQUENCIA DIRETA DA AUTOINSCRICAO.
  //
  // Antes, `role: 'admin'` era um conjunto escolhido a dedo pelo dono, e uma
  // regra frouxa tinha plateia limitada. Agora qualquer pessoa com um e-mail
  // chega aqui em trinta segundos — entao toda regra que para num `isAdmin()`
  // solto virou porta publica no mesmo dia.
  //
  // O `novato` e o unico ator que prova isso: conta legitima, zero vinculo.
  checar('novato', 'novato le a crianca de outro motorista', 'NEGA',
    await ler('children/kid1', novato));
  checar('novato', 'novato le o recado de escola de outro', 'NEGA',
    await ler('schoolBroadcasts/br1', novato));
  checar('novato', 'novato le a agenda de outro', 'NEGA',
    await ler('agendaEntries/ag1', novato));
  checar('novato', 'novato le a mensalidade de uma familia alheia', 'NEGA',
    await ler('payments/pag1', novato));
  checar('novato', 'novato le a regua de preco da plataforma', 'NEGA',
    await ler('taxaConfig/app', novato));
  checar('novato', 'novato le o doc de outro motorista', 'NEGA',
    await ler('users/' + tio1.uid, novato));
  checar('novato', 'novato le o doc de um responsavel alheio', 'NEGA',
    await ler('users/' + pai1.uid, novato));
  checar('novato', 'novato varre users atras da base', 'NEGA',
    await listar('users', novato));
  checar('novato', 'novato le a despesa de outro motorista', 'NEGA',
    await ler('expenses/desp1', novato));
  checar('novato', 'novato le a posicao ao vivo de outra perua', 'NEGA',
    await ler('liveLocation/' + tio1.uid, novato));
  checar('pos', 'novato le o proprio documento', 'PASSA',
    await ler('users/' + novato.uid, novato));

  console.log('\n=== A SESSAO ANONIMA — o visitante da landing ===');

  checar('anon', 'visitante le a crianca', 'NEGA', await ler('children/kid1', anon));
  checar('anon', 'visitante le o doc de um motorista', 'NEGA',
    await ler('users/' + tio1.uid, anon));
  checar('anon', 'visitante le uma mensalidade', 'NEGA', await ler('payments/pag1', anon));
  checar('anon', 'visitante varre os depoimentos', 'NEGA', await listar('feedbacks', anon));

  console.log('\n=== O DOC DO MOTORISTA — a chave PIX ===');

  // O pai PRECISA ler o doc do motorista dele — e onde esta a chave pra pagar.
  checar('pos', 'o pai le o doc do motorista DELE', 'PASSA',
    await ler('users/' + tio1.uid, pai1));
  // Mas so o dele. A regra hoje libera qualquer `isAppUser()` a ler qualquer
  // doc com role admin: nome, telefone, e-mail e CHAVE PIX de todo parceiro.
  checar('pix', 'o pai le o doc de um motorista que nao e o dele', 'NEGA',
    await ler('users/' + tio2.uid, pai1));
  checar('pix', 'um motorista recem-cadastrado le o doc de outro', 'NEGA',
    await ler('users/' + tio1.uid, novato));

  // A MAE COM DOIS FILHOS EM PERUAS DIFERENTES.
  //
  // `users.adminUid` guarda o PRIMEIRO motorista — o proprio redeemInvite diz
  // isso: "o vinculo por criança continua em child.adminUid, que e o dado
  // real". Mas a interface resolve o motorista pelo adminUid da CRIANCA
  // ATIVA. Escopar so pelo campo singular fazia ela perder a chave PIX e a
  // marca ao trocar pro segundo filho — falha silenciosa, em cima de dinheiro.
  //
  // `adminUids` e a lista que o resgate do convite alimenta por arrayUnion.
  // Este caso e o que impede de "simplificar" a regra de volta.
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid), childId: S('kid1'),
    adminUids: { arrayValue: { values: [S(tio1.uid), S(tio2.uid)] } },
  });
  checar('pos', 'a mae de dois filhos le o doc do SEGUNDO motorista', 'PASSA',
    await ler('users/' + tio2.uid, pai1));

  // ⚠️ E AS OUTRAS TRES SUPERFICIES DA MESMA MAE.
  //
  // Quando este `allow get` passou a aceitar `adminUids`, o idioma foi escrito
  // inline e TRES regras ficaram atras, cada uma comparando so o singular:
  // `liveLocation`, `notifications` e `agendaEntries`. Como o unico caso aqui
  // era a leitura do doc do motorista, a bateria seguiu verde e a mae de perua
  // dupla ficou sem o mapa do segundo filho, sem nenhum aviso trocado com o
  // segundo motorista, e sem os recados de escola dele no caderno.
  //
  // Os quatro casos abaixo existem para que o helper `ehMotoristaDaFamilia`
  // nao possa ser desfeito em um lugar so.
  await semear('liveLocation/' + tio2.uid, {
    lat: N(-23.55), lng: N(-46.63), updatedAt: T(0),
  });
  checar('pos', 'e ve a PERUA do segundo motorista no mapa', 'PASSA',
    await ler('liveLocation/' + tio2.uid, pai1));

  checar('pos', 'e avisa o SEGUNDO motorista ("paguei")', 'PASSA',
    await criar('notifications', 'nt-dupla-' + Date.now(), pai1, {
      userId: S(tio2.uid), type: S('payment_claimed'),
      title: S('Mensalidade paga'), createdAt: T(0),
    }));

  await semear('agendaEntries/ag-escola-tio2', {
    scope: S('school'), schoolName: S('EMEF Teste'), adminUid: S(tio2.uid),
    parentUids: { arrayValue: { values: [S(pai1.uid)] } },
    createdAt: T(0), type: S('aviso'),
  });
  checar('pos', 'e le o recado de escola do segundo motorista', 'PASSA',
    await ler('agendaEntries/ag-escola-tio2', pai1));

  // A lista nao e curinga em NENHUMA das tres: motorista de fora continua fora.
  await semear('liveLocation/' + novato.uid, {
    lat: N(-23.5), lng: N(-46.6), updatedAt: T(0),
  });
  checar('pix', 'mas nao a perua de um motorista que nao leva filho dela', 'NEGA',
    await ler('liveLocation/' + novato.uid, pai1));

  // E a lista nao e curinga: motorista que nao leva filho dela continua fora.
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid), childId: S('kid1'),
    adminUids: { arrayValue: { values: [S(tio1.uid)] } },
  });
  checar('pix', 'com a lista sem ele, o segundo motorista volta a ser negado', 'NEGA',
    await ler('users/' + tio2.uid, pai1));
}

/**
 * DECISÃO 12 — nenhuma regra de negócio depende de lista de campos mantida à
 * mão (`docs/decisoes.md`).
 *
 * Todos os furos de permissão deste projeto nasceram do mesmo jeito: uma
 * whitelist de campos dentro de um arquivo de 1.393 linhas. A lista não é
 * verificada por nada — ela é prosa com sintaxe. Quando um campo novo aparece
 * no modelo, ninguém é obrigado a lembrar de acrescentá-lo, e o furo fica
 * aberto até alguém sondar.
 *
 * Enquanto o invariante não sobe pra camada de caso de uso (o "alvo" da
 * decisão), o que segura a lista é isto aqui: um caso NEGATIVO por campo, com
 * o nome da regra que ele prova.
 *
 * Cada um destes falhou contra as rules antes do conserto — é por isso que
 * eles existem, e é o que a decisão exige.
 */
async function decisao12({ tio1, tio2, pai1, novato, dono }) {
  console.log('\n=== DECISÃO 12 — a lista de campos proibidos ===');

  // Restaura o elenco: `vagaContratada` e o bloco anterior reescrevem estes
  // documentos, e o teste seguinte nasceria com ator sem papel. Ver a nota em
  // `oQueNinguemTestava`.
  await semear('users/' + tio1.uid, {
    role: S('admin'), name: S('Tio Um'), pixKey: S('tio1@pix.com'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '1' },
  });
  await semear('users/' + tio2.uid, { role: S('admin'), name: S('Tio Dois') });
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid), childId: S('kid1'),
  });

  // ── responsavel_nao_reescreve_o_proprio_adminUid ────────────────────────
  //
  // `adminUid` é a CHAVE DE ESCOPO do responsável, não um dado de cadastro.
  // A rule de `liveLocation` autoriza a leitura por
  // `userDoc().get('adminUid','') == docId` — então quem consegue reescrever
  // o próprio campo passa a ver o GPS AO VIVO da perua de qualquer motorista,
  // e ainda ganha o direito de criar notificação para qualquer uid (a rule de
  // `notifications` compara com o mesmo campo).
  //
  // Não é escalada de papel: ele continua `parent`. É escalada de ESCOPO, que
  // a lista de campos proibidos não cobria.
  checar('decisao12', 'responsavel_nao_reescreve_o_proprio_adminUid', 'NEGA',
    await escrever('users/' + pai1.uid, pai1, { adminUid: S(tio2.uid) }, ['adminUid']));

  // Prova de que o dano existe: com o campo trocado, esta leitura passaria.
  // Fica como positiva do vínculo LEGÍTIMO — o pai lê a perua do motorista
  // dele, e é isso que a correção não pode quebrar.
  //
  // RESSEMEIA O VÍNCULO ANTES DE MEDIR. Enquanto a brecha existia, o caso
  // acima CONSEGUIA gravar `adminUid: tio2` no doc do pai — e a positiva
  // abaixo passava a ler a perua de um motorista que não é o dele, dando 403
  // por motivo certo e resultado confuso. Depois do conserto a escrita é
  // negada e o campo nem muda; a ressemeadura deixa o caso determinístico nos
  // dois mundos, que é o que um teste de regressão precisa ser.
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid), childId: S('kid1'),
  });
  await semear('liveLocation/' + tio1.uid, { routeActive: B(true), lat: N(-23.1) });
  checar('pos', 'o pai lê a perua do motorista DELE', 'PASSA',
    await ler('liveLocation/' + tio1.uid, pai1));

  // ── motorista_nao_escreve_o_proprio_limiteCriancas ──────────────────────
  //
  // A vaga contratada é cláusula do contrato de associação: quem escreve é
  // quem NEGOCIA (o ramo do dono, logo acima na rule, já lista o campo). Sem
  // ele na lista proibida, o devedor editava o próprio limite — e o limite é
  // exatamente o que as rules de `children` validam com `getAfter`.
  //
  // O comentário da rule já afirmava que isto era proibido. Não era.
  checar('decisao12', 'motorista_nao_escreve_o_proprio_limiteCriancas', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { limiteCriancas: { integerValue: '999' } }, ['limiteCriancas']));

  // ── motorista_nao_altera_o_proprio_criancasAtivas ───────────────────────
  //
  // O contador é a contagem MATERIALIZADA que sustenta o limite: `allow
  // create` em `children` compara `criancasAtivas` com `limiteCriancas` via
  // `getAfter`. Livre em valor e direção, bastava gravar `0` para cadastrar
  // sem teto — sem precisar tocar em `limiteCriancas`.
  //
  // O QUE A REGRA PODE EXIGIR É A FORMA DO PASSO, não a existência da criança:
  // rule não enxerga as outras escritas do batch. Todo caminho legítimo usa
  // `increment(±1)` (conferido nos três call sites), então o passo de UM é a
  // forma verdadeira — e é ela que barra o salto.
  //
  // Note que o comentário de `accountService.js` prometia o inverso ("descida
  // livre, subida de um em um"). Descida livre é exatamente o ataque: é ela
  // que zera o contador.
  await semear('users/' + tio1.uid, {
    role: S('admin'), name: S('Tio Um'),
    limiteCriancas: { integerValue: '5' },
    criancasAtivas: { integerValue: '5' },
  });
  checar('decisao12', 'motorista_nao_altera_o_proprio_criancasAtivas', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '0' } }, ['criancasAtivas']));
  checar('decisao12', 'nem inflar o contador de uma vez', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '99' } }, ['criancasAtivas']));

  // ⚠️ O PASSO DE UM ERA PASSA ATÉ 03/10/2026, E ERA O FURO DECLARADO.
  // A regra aceitava ±1 porque o cliente acompanhava cada criança no mesmo
  // lote — e cinco escritas de −1 zeravam o contador igual a uma de −5. O
  // contador passou a ser recontado por um gatilho em `children`: o cliente
  // não o escreve mais, nem de um em um.
  checar('decisao12', 'nem desce de um em um (agora e do servidor)', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '4' } }, ['criancasAtivas']));
  checar('decisao12', 'nem sobe de um em um', 'NEGA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '6' } }, ['criancasAtivas']));

  // O cadastro comum não pode ter sido pego junto: a lista proibida cresceu,
  // e ela vale pro ramo de "a própria pessoa edita o próprio doc".
  checar('pos', 'o motorista continua editando o próprio cadastro', 'PASSA',
    await escrever('users/' + tio1.uid, tio1, { phone: S('11988887777') }, ['phone']));
  checar('pos', 'o responsável continua editando o próprio cadastro', 'PASSA',
    await escrever('users/' + pai1.uid, pai1, { name: S('Pai Um Silva') }, ['name']));

  // ── motorista_nao_atualiza_buzina_de_outro ──────────────────────────────
  //
  // O `allow read` deste bloco já foi escopado por `ehDoMotorista()`; o
  // `update` ficou com `isAdmin()` solto — metade do bloco corrigida e a
  // outra metade não, que é o padrão que o próprio arquivo cataloga.
  //
  // Sem escopo, qualquer motorista reescreve a buzina de qualquer família:
  // marcar como `resolved` a chamada que o pai ainda não atendeu apaga da tela
  // dele o aviso de que a perua está na porta.
  await semear('pendingCalls/pc1', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childName: S('Ana'),
    status: S('ringing'),
  });
  checar('decisao12', 'motorista_nao_atualiza_buzina_de_outro', 'NEGA',
    await escrever('pendingCalls/pc1', tio2, { status: S('resolved') }, ['status']));
  checar('pos', 'o motorista da buzina continua encerrando a dele', 'PASSA',
    await escrever('pendingCalls/pc1', tio1, { status: S('resolved') }, ['status']));

  // ── motorista_nao_lista_feedbacks_da_plataforma ─────────────────────────
  //
  // `feedbacks` guarda `uid`, `role` e as respostas de quem avaliou — de TODA
  // a plataforma. O ramo `isAdmin()` no `allow list` deixava um parceiro
  // varrer a base inteira: as avaliações que as famílias dos concorrentes
  // escreveram, com o uid de cada uma.
  //
  // Não há tela de motorista que liste feedback: quem modera é o dono
  // (`isOwner()`), e o autor encontra o próprio pelo ramo de `limit <= 5`.
  await semear('feedbacks/f2', {
    uid: S(pai1.uid), role: S('parent'), rating: N(5),
    comment: S('avaliação de outra operação'),
    allowTestimonial: B(false), hiddenByOwner: B(false),
  });
  checar('decisao12', 'motorista_nao_lista_feedbacks_da_plataforma', 'NEGA',
    await listar('feedbacks', tio2));

  // ── O MOTORISTA NAO FORJA O CONSENTIMENTO DA FAMILIA DELE ───────────────
  //
  // O ramo do motorista no `allow update` de `users` estava escopado por
  // `adminUid` e SEM lista de campos. Isso fechou "qualquer motorista em
  // qualquer doc" e deixou aberto "o motorista dele em tudo que nao esta na
  // lista de proibidos" — que incluia dois campos que nao sao cadastro.
  //
  // Sondado no emulador antes do conserto: HTTP 200 nos dois.
  //
  //   termsVersion  aceite de LGPD escrito por OUTRA pessoa. O `allow create`
  //                 exclui esse campo dizendo que "consentimento que a
  //                 plataforma escreve pelo usuario nao e consentimento" — e
  //                 o `update` o deixava passar na mao de terceiro.
  //   fcmTokens     apagar = a familia para de receber push, inclusive a
  //                 buzina. ACRESCENTAR O PROPRIO = o motorista passa a
  //                 receber os pushes dela.
  //
  // O caso POSITIVO existe pelo motivo de sempre: sem ele, este bloco fica
  // verde no dia em que o ramo do motorista desaparecer por inteiro, e
  // ninguem descobre que a correcao de cadastro parou de funcionar.
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Mae'), phone: S('11911112222'),
    email: S('mae@teste.local'), adminUid: S(tio1.uid),
    childIds: { arrayValue: { values: [S('kid1')] } },
    termsVersion: S('v1'),
  });

  checar('consentimento', 'motorista_nao_forja_o_aceite_de_termos_da_familia', 'NEGA',
    await escrever('users/' + pai1.uid, tio1, { termsVersion: S('v9') }, ['termsVersion']));
  checar('consentimento', 'nem a data do aceite', 'NEGA',
    await escrever('users/' + pai1.uid, tio1, { termsAcceptedAt: T(0) }, ['termsAcceptedAt']));
  checar('consentimento', 'motorista_nao_mexe_nos_tokens_de_push_da_familia', 'NEGA',
    await escrever('users/' + pai1.uid, tio1,
      { fcmTokens: { arrayValue: { values: [S('token-do-tio')] } } }, ['fcmTokens']));
  checar('consentimento', 'e outro motorista continua nao alcancando nada dela', 'NEGA',
    await escrever('users/' + pai1.uid, tio2, { phone: S('11900000000') }, ['phone']));
  // ⚠️ NEM O TELEFONE — o ramo do motorista SAIU do `allow update` de `users`.
  //
  // Estreitar para `['name','email','phone']` foi o primeiro conserto, e a
  // varredura seguinte mostrou que nem isso tem consumidor: `updateProfile` só
  // é chamado com o próprio uid, e o contato que o motorista edita vive em
  // `children.parentName`/`parentPhone`. Permissão sem razão é como uma lista
  // de exceção vira lista de permissão.
  checar('consentimento', 'e nem o telefone — nao ha ramo de motorista aqui', 'NEGA',
    await escrever('users/' + pai1.uid, tio1, { phone: S('11933334444') }, ['phone']));
  checar('pos', 'e a propria familia continua registrando o aceite dela', 'PASSA',
    await escrever('users/' + pai1.uid, pai1, { termsVersion: S('v2') }, ['termsVersion']));

  // ── SAUDE DA CRIANCA: SO A RESPONSAVEL ESCREVE ──────────────────────────
  //
  // ⚠️ POR QUE ESTE BLOCO EXISTE
  //
  // O campo era do MOTORISTA: o cadastro de crianca pedia "Alergias,
  // instrucoes especiais...", ou seja, o app CONVIDAVA ele a escrever dado de
  // saude de menor — sensivel pela LGPD (art. 5o II), exigindo consentimento
  // especifico e destacado (art. 11 I) e, sendo crianca, o art. 14 §1o. E quem
  // digitava nao era quem consentia: a crianca e cadastrada ANTES do convite,
  // e a mae pode nunca resgata-lo.
  //
  // O ramo do motorista no `allow update` de `children` permite QUALQUER outro
  // campo — entao sem esta prova o desenho de `docs/consentimento-saude.md`
  // seria so interface. Interface nao e tranca.
  await semear('children/kid-saude', {
    name: S('Ana'), adminUid: S(tio1.uid), parentUid: S(pai1.uid), active: B(true),
  });

  checar('saude', 'o motorista NAO escreve nota de saude da crianca dele', 'NEGA',
    await escrever('children/kid-saude', tio1,
      { saudeNotas: S('alergia a amendoim') }, ['saudeNotas']));
  checar('saude', 'nem a data do consentimento', 'NEGA',
    await escrever('children/kid-saude', tio1,
      { saudeConsentidaEm: T(0) }, ['saudeConsentidaEm']));
  checar('saude', 'e outro motorista muito menos', 'NEGA',
    await escrever('children/kid-saude', tio2,
      { saudeNotas: S('x') }, ['saudeNotas']));

  // ⚠️ OS DOIS CAMPOS ANDAM JUNTOS: nota sem data e o dado sem o registro do
  // consentimento — o passivo sem a defesa.
  checar('saude', 'a responsavel nao grava a nota SEM a data do consentimento', 'NEGA',
    await escrever('children/kid-saude', pai1,
      { saudeNotas: S('alergia a amendoim') }, ['saudeNotas']));
  checar('pos', 'mas grava os dois juntos', 'PASSA',
    await escrever('children/kid-saude', pai1,
      { saudeNotas: S('alergia a amendoim'), saudeConsentidaEm: T(0) },
      ['saudeNotas', 'saudeConsentidaEm']));
  // ⚠️ ORDEM IMPORTA AQUI, e a primeira versao deste bloco errou por isso.
  //
  // O caso da nota orfa vem ANTES do de apagar: se ele viesse depois, o
  // documento ja estaria com os dois campos vazios, e apagar "so a nota"
  // satisfaria a regra dos dois vazios — passando verde pelo motivo errado.
  // Aqui o documento ainda tem a data, entao limpar so a nota deixaria a data
  // orfa, que e o que a regra recusa.
  checar('saude', 'nao apaga so a nota, deixando a data orfa', 'NEGA',
    await escrever('children/kid-saude', pai1,
      { saudeNotas: S('') }, ['saudeNotas']));
  checar('saude', 'nem apaga so a data, deixando a nota sem consentimento', 'NEGA',
    await escrever('children/kid-saude', pai1,
      { saudeConsentidaEm: { nullValue: null } }, ['saudeConsentidaEm']));
  // E APAGAR OS DOIS JUNTOS PASSA: guardar a data de um consentimento sem o
  // dado que ele autorizava nao serve a ninguem, e o art. 18 VI (revogacao)
  // precisa de saida dentro do produto.
  checar('pos', 'e apaga os dois juntos (o direito de revogar)', 'PASSA',
    await escrever('children/kid-saude', pai1,
      { saudeNotas: S(''), saudeConsentidaEm: { nullValue: null } },
      ['saudeNotas', 'saudeConsentidaEm']));
  // Responsavel de OUTRA crianca nao alcanca esta.
  checar('saude', 'responsavel alheio nao escreve saude desta crianca', 'NEGA',
    await escrever('children/kid-saude', novato,
      { saudeNotas: S('x'), saudeConsentidaEm: T(0) },
      ['saudeNotas', 'saudeConsentidaEm']));
  // O motorista LE — e e o ponto do dado existir.
  checar('pos', 'o motorista DELA le a crianca (e a nota vem com ela)', 'PASSA',
    await ler('children/kid-saude', tio1));

  // ── O ANIVERSARIO E DA FAMILIA (02/10/2026) ──────────────────────────────
  // Saiu do cadastro do motorista, que quase nunca sabe a data, e entrou no
  // ramo da responsavel junto de turma e sala. O ramo e lista de PERMITIDOS:
  // a data nao pode servir de carona para um campo de dinheiro.
  checar('pos', 'a responsavel grava turma, sala e aniversario', 'PASSA',
    await escrever('children/kid-saude', pai1,
      { turma: S('3o B'), sala: S('12'), birthDate: S('2018-05-14') },
      ['turma', 'sala', 'birthDate']));
  checar('aniversario', 'mas o aniversario nao leva a mensalidade de carona', 'NEGA',
    await escrever('children/kid-saude', pai1,
      { birthDate: S('2018-05-15'), monthlyFee: { integerValue: '1' } },
      ['birthDate', 'monthlyFee']));
  checar('aniversario', 'e quem nao e da crianca nao grava o aniversario dela', 'NEGA',
    await escrever('children/kid-saude', novato,
      { birthDate: S('2018-05-15') }, ['birthDate']));

  // ── A CHAVE DO IRMAO E DO SERVIDOR (02/10/2026) ──────────────────────────
  // Crianca nova com este WhatsApp entra SOZINHA na conta que tem a chave
  // (`vincularIrmao.js`). Se a responsavel pudesse escreve-la, poria o numero
  // de outra mae e receberia os filhos dela.
  checar('irmao', 'a responsavel NAO grava a propria chave de telefone', 'NEGA',
    await escrever('users/' + pai1.uid, pai1,
      { phoneChave: S('11987654321') }, ['phoneChave']));
  checar('pos', 'mas continua editando o proprio telefone de contato', 'PASSA',
    await escrever('users/' + pai1.uid, pai1,
      { phone: S('11987654321') }, ['phone']));
  checar('irmao', 'nem o numero que digitou ao pedir acesso sem link', 'NEGA',
    await escrever('users/' + pai1.uid, pai1,
      { telefoneAguardandoChave: S('11987654321') }, ['telefoneAguardandoChave']));

  // ── O NUMERO DA CASA QUE O MOTORISTA NAO SABIA (02/10/2026) ──────────────
  // A familia completa o endereco UMA vez, so com `numeroPendente` ligado, e
  // so os campos do endereco. Fora disso, a casa continua sendo do motorista.
  checar('casa', 'sem pendencia, a responsavel nao muda o endereco', 'NEGA',
    await escrever('children/kid-saude', pai1,
      { address: S('Rua X, 1'), numeroPendente: B(false) }, ['address', 'numeroPendente']));
  await semear('children/kid-casa', {
    name: S('Bia'), adminUid: S(tio1.uid), parentUid: S(pai1.uid), active: B(true),
    numeroPendente: B(true), address: S('Rua das Trovas — Socorro'),
  });
  checar('casa', 'nem leva a mensalidade de carona no numero', 'NEGA',
    await escrever('children/kid-casa', pai1,
      { address: S('Rua das Trovas, 120'), numeroPendente: B(false), monthlyFee: { integerValue: '1' } },
      ['address', 'numeroPendente', 'monthlyFee']));
  checar('pos', 'com o numero pendente, ela completa o endereco', 'PASSA',
    await escrever('children/kid-casa', pai1,
      { address: S('Rua das Trovas, 120 — Socorro'), numeroPendente: B(false) },
      ['address', 'numeroPendente']));
  checar('casa', 'e depois disso a porta fecha', 'NEGA',
    await escrever('children/kid-casa', pai1,
      { address: S('Outra rua, 9'), numeroPendente: B(false) }, ['address', 'numeroPendente']));

  // ── O CONTATO DO INVESTIDOR (02/10/2026) ─────────────────────────────────
  // Nome, e-mail e WhatsApp de quem pediu o material pelo site. So o dono le;
  // quem grava e a function, com Admin SDK.
  await semear('leadsInvestidor/lead-1', { nome: S('Ana'), email: S('ana@exemplo.com') });
  checar('pos', 'o dono le o contato do investidor', 'PASSA',
    await ler('leadsInvestidor/lead-1', dono));
  checar('investidor', 'motorista nao le o contato do investidor', 'NEGA',
    await ler('leadsInvestidor/lead-1', tio1));
  checar('investidor', 'e ninguem grava contato pelo app', 'NEGA',
    await escrever('leadsInvestidor/lead-2', pai1, { nome: S('x'), email: S('x@y.z') }, ['nome', 'email']));

  // ── O PEDIDO DE ACESSO SEM LINK (02/10/2026) ─────────────────────────────
  // Nasce de um numero digitado, que nao e segredo. So o servidor escreve, e
  // quem le e a pessoa que pediu e o motorista DONO da crianca.
  await semear('pedidosDeVinculo/kid-saude_' + pai1.uid, {
    childId: S('kid-saude'), adminUid: S(tio1.uid), parentUid: S(pai1.uid),
    status: S('aguardando'),
  });
  // ⚠️ AGUARDANDO, QUEM PEDIU NÃO LÊ (03/10/2026): o pedido por telefone
  // responde sempre o mesmo, e o "aguardando" no console diria que o número é
  // de uma família da plataforma. Respondido, ela lê.
  checar('acesso', 'quem pediu NAO le o pedido ainda aguardando', 'NEGA',
    await ler('pedidosDeVinculo/kid-saude_' + pai1.uid, pai1));
  await semear('pedidosDeVinculo/kid-resp_' + pai1.uid, {
    childId: S('kid-resp'), adminUid: S(tio1.uid), parentUid: S(pai1.uid),
    status: S('aprovado'),
  });
  checar('pos', 'quem pediu le o proprio pedido ja respondido', 'PASSA',
    await ler('pedidosDeVinculo/kid-resp_' + pai1.uid, pai1));
  checar('pos', 'o motorista da crianca le o pedido', 'PASSA',
    await ler('pedidosDeVinculo/kid-saude_' + pai1.uid, tio1));
  checar('pedido', 'outro motorista nao le o pedido', 'NEGA',
    await ler('pedidosDeVinculo/kid-saude_' + pai1.uid, tio2));
  checar('pedido', 'quem pediu nao se aprova sozinho', 'NEGA',
    await escrever('pedidosDeVinculo/kid-saude_' + pai1.uid, pai1,
      { status: S('aprovado') }, ['status']));
  checar('pedido', 'nem o motorista aprova por fora da callable', 'NEGA',
    await escrever('pedidosDeVinculo/kid-saude_' + pai1.uid, tio1,
      { status: S('aprovado') }, ['status']));

  // A PORTA QUE CONTINUA ABERTA, e tem consumidor: remover pai vinculado.
  //
  // ⚠️ POR ÚLTIMO DE PROPÓSITO — este caso APAGA o documento, e qualquer
  // asserção depois dele mediria a ausência do doc em vez da regra.
  checar('pos', 'mas o motorista DELA ainda APAGA o doc dela (remover vinculado)', 'PASSA',
    await apagar('users/' + pai1.uid, tio1));
}

/**
 * A AUDITORIA DE SEGURANÇA DE 03/10/2026 — cada caso ENCADEIA o ataque.
 *
 * Os furos daqui não eram "uma escrita proibida que passava": eram uma escrita
 * permitida no PRÓPRIO documento que abria a porta de outro. Testar só a
 * escrita provaria pouco — o que importa é o passo seguinte. Por isso cada
 * caso escreve primeiro (no que é dele) e depois tenta usar o que escreveu.
 *
 * E cada ataque tem, ao lado, o caminho legítimo que a correção não pode
 * quebrar.
 */
async function aAuditoriaDeSeguranca({ tio1, tio2, pai1, novato, dono }) {
  console.log('\n=== A AUDITORIA DE SEGURANÇA (03/10/2026) — o ataque encadeado ===');

  // Elenco limpo: `decisao12` APAGA o doc do pai1 no fim, e os blocos
  // anteriores reescrevem os dos motoristas.
  await semear('users/' + tio1.uid, { role: S('admin'), name: S('Tio Um'), pixKey: S('tio1@pix.com') });
  await semear('users/' + tio2.uid, { role: S('admin'), name: S('Tio Dois') });
  await semear('users/' + novato.uid, { role: S('admin'), name: S('Novato') });
  await semear('users/' + pai1.uid, {
    role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid), childId: S('kid1'),
    childIds: { arrayValue: { values: [S('kid1')] } },
    adminUids: { arrayValue: { values: [S(tio1.uid)] } },
  });
  await semear('liveLocation/' + tio1.uid, { routeActive: B(true), lat: N(-23.1) });
  await semear('children/kid1', {
    name: S('Ana'), adminUid: S(tio1.uid), parentUid: S(pai1.uid), active: B(true),
    monthlyFee: N(300), inviteStatus: S('used'),
  });
  await semear('children/kid2', {
    name: S('Beto'), adminUid: S(tio2.uid), parentUid: { nullValue: null }, active: B(true),
    inviteStatus: S('pending'),
  });

  // ── S1. `adminUids` NA LISTA PROIBIDA ──────────────────────────────────
  // O singular já estava; a lista não — e `ehMotoristaDaFamilia()` aceita os
  // dois. O novato se dava `adminUids: [tio1]` e lia o doc do tio1 (PIX), a
  // perua dele ao vivo, e escrevia avisos na caixa dele.
  checar('S1', 'novato grava adminUids=[tio1] no proprio doc', 'NEGA',
    await escrever('users/' + novato.uid, novato,
      { adminUids: { arrayValue: { values: [S(tio1.uid)] } } }, ['adminUids']));
  checar('S1', '... e por isso NAO le o doc do tio1 (a chave PIX)', 'NEGA',
    await ler('users/' + tio1.uid, novato));
  checar('S1', '... nem a perua do tio1 ao vivo', 'NEGA',
    await ler('liveLocation/' + tio1.uid, novato));
  checar('S1', '... nem escreve aviso na caixa do tio1', 'NEGA',
    await criar('notifications', 'S1-' + Date.now(), novato, {
      userId: S(tio1.uid), type: S('payment_claimed'), title: S('Pague aqui'), createdAt: T(0),
    }));
  checar('S1', 'a mae poe OUTRO motorista na propria lista', 'NEGA',
    await escrever('users/' + pai1.uid, pai1,
      { adminUids: { arrayValue: { values: [S(tio1.uid), S(tio2.uid)] } } }, ['adminUids']));
  checar('S1', '... e por isso nao le o doc do tio2', 'NEGA',
    await ler('users/' + tio2.uid, pai1));
  checar('pos', 'a mae continua lendo o doc do motorista DELA', 'PASSA',
    await ler('users/' + tio1.uid, pai1));
  checar('pos', 'e editando o proprio nome', 'PASSA',
    await escrever('users/' + pai1.uid, pai1, { name: S('Pai Um Souza') }, ['name']));

  // ── S2. O MOTORISTA DESVINCULA, NUNCA VINCULA ──────────────────────────
  // `parentUid` é quem LÊ a criança. tio2 apontava a criança DELE para a mãe
  // de outra perua, e ela aparecia no app daquela família.
  checar('S2', 'tio2 aponta a crianca dele para a mae do tio1', 'NEGA',
    await escrever('children/kid2', tio2, { parentUid: S(pai1.uid) }, ['parentUid']));
  checar('S2', '... e a mae do tio1 continua sem enxergar a crianca dele', 'NEGA',
    await ler('children/kid2', pai1));
  checar('S2', 'tio2 marca o convite como "usado"', 'NEGA',
    await escrever('children/kid2', tio2, { inviteStatus: S('used') }, ['inviteStatus']));
  checar('S2', 'tio2 marca a crianca como "vinculada pelo irmao"', 'NEGA',
    await escrever('children/kid2', tio2, { vinculadoPor: S('irmao') }, ['vinculadoPor']));
  checar('pos', 'o motorista edita a crianca sem tocar no vinculo', 'PASSA',
    await escrever('children/kid1', tio1, { monthlyFee: N(320) }, ['monthlyFee']));

  // ── S6. OS UIDS DO CORPO DA VIAGEM SÃO ENDEREÇO ────────────────────────
  // O servidor avisa o `parentUid` gravado em `rides/{dia}`.
  checar('S6', 'tio1 grava na viagem o uid de uma familia alheia', 'NEGA',
    await escrever('children/kid1/rides/2026-10-03', tio1, {
      dateKey: S('2026-10-03'), childId: S('kid1'), adminUid: S(tio1.uid),
      parentUid: S('familiaAlheia'), atualizadoEm: T(0),
    }));
  checar('S6', 'nem se assina como outro motorista', 'NEGA',
    await escrever('children/kid1/rides/2026-10-03', tio1, {
      dateKey: S('2026-10-03'), childId: S('kid1'), adminUid: S(tio2.uid),
      parentUid: S(pai1.uid), atualizadoEm: T(0),
    }));
  checar('pos', 'a viagem com a familia da crianca passa', 'PASSA',
    await escrever('children/kid1/rides/2026-10-03', tio1, {
      dateKey: S('2026-10-03'), childId: S('kid1'), adminUid: S(tio1.uid),
      parentUid: S(pai1.uid), atualizadoEm: T(0),
    }));

  // ── S5. FALTA E "QUEM BUSCA" SÓ NA CRIANÇA DA TURMA, NO ID DELA ────────
  const dia = '2026-10-05';
  checar('S5', 'novato marca falta na crianca do tio1 (adminUid dele)', 'NEGA',
    await criar('absenceDeclarations', `${dia}_kid1`, novato, {
      adminUid: S(novato.uid), childId: S('kid1'), dateKey: S(dia), declaredBy: S('admin'),
    }));
  checar('S5', '... e a mae do tio1 nao ve falta nenhuma la', 'PASSA',
    (await ler(`absenceDeclarations/${dia}_kid1`, pai1)) === 404 ? 200 : 403);
  checar('S5', 'o motorista marca falta num id inventado', 'NEGA',
    await criar('absenceDeclarations', `qualquer_${Date.now()}`, tio1, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S(dia), declaredBy: S('admin'),
    }));
  checar('pos', 'o motorista marca falta na crianca dele, no id do dia', 'PASSA',
    await criar('absenceDeclarations', `${dia}_kid1`, tio1, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S(dia), declaredBy: S('admin'),
    }));
  checar('S5', 'e nao muda a falta de crianca depois', 'NEGA',
    await escrever(`absenceDeclarations/${dia}_kid1`, tio1, { childId: S('kid2') }, ['childId']));

  checar('S5', 'novato indica "quem busca" na crianca do tio1', 'NEGA',
    await criar('altPickups', `${dia}_kid1`, novato, {
      adminUid: S(novato.uid), childId: S('kid1'), dateKey: S(dia),
      name: S('Estranho'), phone: S('11900000000'),
    }));
  checar('S5', '... e a mae nao ve estranho nenhum la', 'PASSA',
    (await ler(`altPickups/${dia}_kid1`, pai1)) === 404 ? 200 : 403);
  checar('S5', 'a mae manda o "quem busca" para outro motorista', 'NEGA',
    await criar('altPickups', `${dia}_kid1`, pai1, {
      adminUid: S(tio2.uid), childId: S('kid1'), dateKey: S(dia),
      name: S('Vovo'), phone: S('11911112222'),
    }));
  checar('pos', 'a mae indica a avo, para o motorista da crianca', 'PASSA',
    await criar('altPickups', `${dia}_kid1`, pai1, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S(dia),
      name: S('Vovo'), phone: S('11911112222'),
    }));
  checar('pos', 'o motorista indica na crianca dele, no id do dia', 'PASSA',
    await criar('altPickups', `2026-10-06_kid1`, tio1, {
      adminUid: S(tio1.uid), childId: S('kid1'), dateKey: S('2026-10-06'),
      name: S('Tia'), phone: S('11922223333'),
    }));

  // ── O CADERNO: recado de UMA criança ───────────────────────────────────
  checar('agenda', 'tio2 escreve recado no caderno da mae do tio1', 'NEGA',
    await criar('agendaEntries', 'ag-S-' + Date.now(), tio2, {
      scope: S('child'), adminUid: S(tio2.uid), childId: S('kid1'),
      parentUid: S(pai1.uid), message: S('Pague no meu PIX'), createdAt: T(0),
    }));
  checar('agenda', 'nem pela crianca DELE, endereçado a ela', 'NEGA',
    await criar('agendaEntries', 'ag-S2-' + Date.now(), tio2, {
      scope: S('child'), adminUid: S(tio2.uid), childId: S('kid2'),
      parentUid: S(pai1.uid), message: S('Pague no meu PIX'), createdAt: T(0),
    }));
  // O que já estava plantado antes da correção também não é lido.
  await semear('agendaEntries/ag-plantado', {
    scope: S('child'), adminUid: S(tio2.uid), childId: S('kid2'),
    parentUid: S(pai1.uid), message: S('plantado'), createdAt: T(0),
  });
  checar('agenda', 'a mae nao le o recado plantado por outro motorista', 'NEGA',
    await ler('agendaEntries/ag-plantado', pai1));
  checar('pos', 'o motorista escreve recado na crianca dele', 'PASSA',
    await criar('agendaEntries', 'ag-ok-' + Date.now(), tio1, {
      scope: S('child'), adminUid: S(tio1.uid), childId: S('kid1'),
      parentUid: S(pai1.uid), message: S('Levar agasalho'), createdAt: T(0),
    }));
  await semear('agendaEntries/ag-legit', {
    scope: S('child'), adminUid: S(tio1.uid), childId: S('kid1'),
    parentUid: S(pai1.uid), message: S('recado'), createdAt: T(0),
  });
  checar('pos', 'e a mae le o recado do motorista dela', 'PASSA',
    await ler('agendaEntries/ag-legit', pai1));
  // A CONSULTA do caderno precisa provar o motorista — sem `adminUid`, o
  // Firestore recusa a consulta inteira (é o que o cliente precisa mudar).
  const caderno = (comMotorista) => {
    const filters = [
      { fieldFilter: { field: { fieldPath: 'scope' }, op: 'EQUAL', value: S('child') } },
      { fieldFilter: { field: { fieldPath: 'parentUid' }, op: 'EQUAL', value: S(pai1.uid) } },
    ];
    if (comMotorista) {
      filters.push({ fieldFilter: { field: { fieldPath: 'adminUid' }, op: 'EQUAL', value: S(tio1.uid) } });
    }
    return fetch(`${FS}:runQuery`, {
      method: 'POST', headers: H(pai1),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'agendaEntries' }],
          where: { compositeFilter: { op: 'AND', filters } },
          limit: 50,
        },
      }),
    }).then((r) => r.status);
  };
  checar('agenda', 'a consulta do caderno SEM o motorista e recusada', 'NEGA', await caderno(false));
  checar('pos', 'a consulta do caderno provando o motorista carrega', 'PASSA', await caderno(true));

  // ── A BUZINA: a família só responde ────────────────────────────────────
  await semear('pendingCalls/pcS', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
    childName: S('Ana'), momento: S('buscar'), status: S('ringing'),
  });
  checar('buzina', 'a mae reescreve o texto da buzina', 'NEGA',
    await escrever('pendingCalls/pcS', pai1, { childName: S('Outro nome') }, ['childName']));
  checar('buzina', 'nem a faz tocar de novo', 'NEGA',
    await escrever('pendingCalls/pcS', pai1, { status: S('ringing') }, ['status']));
  checar('pos', 'a mae responde "estou indo"', 'PASSA',
    await escrever('pendingCalls/pcS', pai1,
      { status: S('acknowledged'), acknowledgedAt: T(0) }, ['status', 'acknowledgedAt']));
  checar('pos', 'e encerra', 'PASSA',
    await escrever('pendingCalls/pcS', pai1,
      { status: S('resolved'), resolvedAt: T(0), resolvedBy: S('parent') },
      ['status', 'resolvedAt', 'resolvedBy']));

  // ── URL DO NOSSO BUCKET ────────────────────────────────────────────────
  const NOSSO = 'https://firebasestorage.googleapis.com/v0/b/alobuzinou-be81f.firebasestorage.app/o/childPhotos%2Fkid1?alt=media';
  const ALHEIO = 'https://firebasestorage.googleapis.com/v0/b/projeto-qualquer.appspot.com/o/x.jpg?alt=media';
  checar('url', 'a mae poe na crianca a foto de outro bucket', 'NEGA',
    await escrever('children/kid1', pai1, { photoURL: S(ALHEIO) }, ['photoURL']));
  checar('url', 'nem de um site qualquer', 'NEGA',
    await escrever('children/kid1', pai1, { photoURL: S('https://exemplo.com/a.jpg') }, ['photoURL']));
  checar('pos', 'a foto do nosso bucket passa', 'PASSA',
    await escrever('children/kid1', pai1, { photoURL: S(NOSSO) }, ['photoURL']));
  checar('pos', 'e tirar a foto (avatar gerado) passa', 'PASSA',
    await escrever('children/kid1', pai1, { photoURL: { nullValue: null } }, ['photoURL']));

  await semear('payments/pagS', {
    adminUid: S(tio1.uid), parentUid: S(pai1.uid), childId: S('kid1'),
    month: S('2026-10'), amount: N(300), status: S('pending'),
  });
  checar('url', 'a mae avisa que pagou com comprovante de outro bucket', 'NEGA',
    await escrever('payments/pagS', pai1,
      { status: S('claimed'), receiptURL: S(ALHEIO) }, ['status', 'receiptURL']));
  checar('url', 'o motorista anexa comprovante de outro bucket', 'NEGA',
    await escrever('payments/pagS', tio1, { receiptURL: S(ALHEIO) }, ['receiptURL']));
  checar('pos', 'a mae avisa com o comprovante do nosso bucket', 'PASSA',
    await escrever('payments/pagS', pai1,
      { status: S('claimed'), receiptURL: S(NOSSO) }, ['status', 'receiptURL']));

  // ── O DEPOIMENTO NASCE ESCONDIDO (decisão do dono) ─────────────────────
  const depo = (extra = {}) => ({
    uid: S(pai1.uid), role: S('parent'), version: S('1.0.0'),
    answers: { mapValue: { fields: { rating: N(5) } } },
    comment: S('Muito bom'), allowTestimonial: B(true), hiddenByOwner: B(true),
    allowPhoto: B(false), authorFirstName: S('Pai'), authorPhotoURL: { nullValue: null },
    ...extra,
  });
  checar('depo', 'o depoimento nasce publicado na home', 'NEGA',
    await criarComHoraDoServidor('feedbacks/depo-pub', pai1, depo({ hiddenByOwner: B(false) }), 'createdAt'));
  checar('depo', 'a mae assina como "motorista"', 'NEGA',
    await criarComHoraDoServidor('feedbacks/depo-papel', pai1, depo({ role: S('admin') }), 'createdAt'));
  checar('depo', 'nem com campo de fora (nome completo, telefone)', 'NEGA',
    await criarComHoraDoServidor('feedbacks/depo-extra', pai1, depo({ telefone: S('11999990000') }), 'createdAt'));
  checar('depo', 'nem com um texto do tamanho de um livro', 'NEGA',
    await criarComHoraDoServidor('feedbacks/depo-longo', pai1, depo({ comment: S('x'.repeat(1001)) }), 'createdAt'));
  checar('pos', 'o depoimento escondido nasce', 'PASSA',
    await criarComHoraDoServidor('feedbacks/depo-ok', pai1, depo(), 'createdAt'));
  checar('pos', 'e o dono o publica', 'PASSA',
    await escrever('feedbacks/depo-ok', dono, { hiddenByOwner: B(false) }, ['hiddenByOwner']));

  // ── A AVALIAÇÃO RÁPIDA diz o MOMENTO (03/10/2026) ──────────────────────
  // `acompanhamento` é de quem abriu o link sem conta, e só a callable grava.
  const rapida = (momento) => depo({
    allowTestimonial: B(false), authorFirstName: { nullValue: null }, momento: S(momento),
  });
  checar('pos', 'a mae avalia no dia entregue', 'PASSA',
    await criarComHoraDoServidor('feedbacks/rapida-ok', pai1, rapida('dia_entregue'), 'createdAt'));
  checar('avaliacao', 'a mae se passa por quem acompanhou pelo link', 'NEGA',
    await criarComHoraDoServidor('feedbacks/rapida-link', pai1, rapida('acompanhamento'), 'createdAt'));
  checar('avaliacao', 'nem com um momento inventado', 'NEGA',
    await criarComHoraDoServidor('feedbacks/rapida-x', pai1, rapida('qualquer'), 'createdAt'));

  // ── O CHAMADO: lista fechada, nasce aberto ─────────────────────────────
  const chamado = (extra = {}) => ({
    uid: S(pai1.uid), role: S('parent'), version: S('1.0.0'), category: S('bug'),
    description: S('O mapa nao abre'),
    deviceInfo: { mapValue: { fields: { userAgent: S('x'), platform: S('y') } } },
    status: S('open'), createdAt: T(0), ...extra,
  });
  checar('chamado', 'o chamado nasce "fechado" (some da caixa do dono)', 'NEGA',
    await criar('supportTickets', 'ch-fechado', pai1, chamado({ status: S('closed') })));
  checar('chamado', 'nem com campo de fora', 'NEGA',
    await criar('supportTickets', 'ch-extra', pai1, chamado({ prioridade: S('urgente') })));
  checar('chamado', 'nem com um megabyte de texto', 'NEGA',
    await criar('supportTickets', 'ch-longo', pai1, chamado({ description: S('x'.repeat(2001)) })));
  checar('pos', 'o chamado com o payload real abre', 'PASSA',
    await criar('supportTickets', 'ch-ok', pai1, chamado()));
}

/**
 * Confere que cada ator É quem o teste supõe, ANTES de medir qualquer coisa.
 *
 * Sem isto, um ator sem papel devolve 403 em tudo e o relatório sai verde
 * como se o isolamento estivesse perfeito. Já aconteceu.
 */
/**
 * OS NÍVEIS (docs/niveis.md, decisão 23). O selo é lido SÓ pelo próprio
 * motorista (a família deixou de ver em 04/10/2026), e escrito por ninguém do
 * lado do cliente. As
 * atividades de Platina todo usuário do app lê, e só o dono lança.
 */
async function osNiveis({ tio1, tio2, pai1, dono, anon }) {
  console.log('\n═══ os níveis ═══');
  // O bloco do Financeiro, logo antes, religa o pai1 a OUTRO motorista: aqui ele
  // volta a ser família do tio1, senão "a família NÃO lê" passaria pelo motivo errado.
  await semear(`users/${pai1.uid}`, { role: S('parent'), name: S('Pai Um'), adminUid: S(tio1.uid) });
  await semear(`niveis/${tio1.uid}`, { nivel: S('prata'), desde: T(-3), atualizadoEm: T(0) });
  await semear(`niveis/${tio2.uid}`, { nivel: S('ouro'), desde: T(-3), atualizadoEm: T(0) });

  checar('nivel', 'motorista lê o próprio nível', 'PASSA', await ler(`niveis/${tio1.uid}`, tio1));
  checar('nivel', 'família NÃO lê o nível do motorista dela', 'NEGA', await ler(`niveis/${tio1.uid}`, pai1));
  checar('nivel', 'outro motorista NÃO lê o nível', 'NEGA', await ler(`niveis/${tio1.uid}`, tio2));
  checar('nivel', 'família NÃO lê o nível de outro motorista', 'NEGA', await ler(`niveis/${tio2.uid}`, pai1));
  checar('nivel', 'anônimo NÃO lê nível', 'NEGA', await ler(`niveis/${tio1.uid}`, anon));
  checar('nivel', 'ninguém lista os níveis da base', 'NEGA', await listar('niveis', dono));
  checar('nivel', 'motorista NÃO escreve o próprio nível', 'NEGA',
    await escrever(`niveis/${tio1.uid}`, tio1, { nivel: S('diamante') }, ['nivel']));
  checar('nivel', 'motorista NÃO cria o nível de outro', 'NEGA',
    await criar('niveis', `x${Date.now()}`, tio1, { nivel: S('diamante') }));
  checar('nivel', 'família NÃO escreve o nível do motorista', 'NEGA',
    await escrever(`niveis/${tio1.uid}`, pai1, { nivel: S('bronze') }, ['nivel']));
  checar('nivel', 'nem o dono escreve nível (só o servidor)', 'NEGA',
    await escrever(`niveis/${tio1.uid}`, dono, { nivel: S('diamante') }, ['nivel']));

  const atividade = {
    titulo: S('Lance as despesas do mês'),
    descricao: S('Uma despesa neste mês'),
    verificacao: S('despesasDoMes'),
    lancadaEm: T(0),
    ativa: B(true),
  };
  await semear('atividadesDaPlatina/a1', atividade);
  checar('platina', 'motorista lê a atividade', 'PASSA', await ler('atividadesDaPlatina/a1', tio2));
  checar('platina', 'família lê a atividade', 'PASSA', await ler('atividadesDaPlatina/a1', pai1));
  checar('platina', 'anônimo NÃO lê a atividade', 'NEGA', await ler('atividadesDaPlatina/a1', anon));
  checar('platina', 'dono lança atividade', 'PASSA',
    await criar('atividadesDaPlatina', `a${Date.now()}`, dono, atividade));
  checar('platina', 'motorista NÃO lança atividade', 'NEGA',
    await criar('atividadesDaPlatina', `b${Date.now()}`, tio1, atividade));
  checar('platina', 'motorista NÃO altera atividade', 'NEGA',
    await escrever('atividadesDaPlatina/a1', tio1, { ativa: B(false) }, ['ativa']));
  checar('platina', 'dono desliga atividade', 'PASSA',
    await escrever('atividadesDaPlatina/a1', dono, { ativa: B(false) }, ['ativa']));
  checar('platina', 'nem o dono apaga atividade', 'NEGA', await apagar('atividadesDaPlatina/a1', dono));
}

async function conferirElenco(tio1, tio2, pai1, dono) {
  const papel = async (s) => {
    const r = await fetch(`${FS}/users/${s.uid}`, { headers: ADM });
    if (r.status !== 200) return null;
    return (await r.json()).fields?.role?.stringValue || null;
  };
  const elenco = {
    tio1: await papel(tio1),
    tio2: await papel(tio2),
    pai1: await papel(pai1),
    dono: await papel(dono),
  };
  console.log('  ', JSON.stringify(elenco));
  const esperado = { tio1: 'admin', tio2: 'admin', pai1: 'parent', dono: 'owner' };
  for (const [quem, deve] of Object.entries(esperado)) {
    if (elenco[quem] !== deve) {
      console.error(`\nABORTA: ${quem} deveria ser '${deve}' e é '${elenco[quem]}'.`);
      console.error('Sem o elenco de pé, todo 403 abaixo seria falta de papel, não isolamento.\n');
      process.exit(2);
    }
  }
}

main().catch((e) => {
  console.error('\nERRO:', e.message);
  console.error('O emulador está de pé? npx firebase emulators:start --only auth,firestore\n');
  process.exit(3);
});
