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
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts`;
const FS = `http://127.0.0.1:8085/v1/projects/${PID}/databases/(default)/documents`;

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
  checar('pos', 'pai aceita um contrato ainda não aceito', 'PASSA',
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
  await decisao12({ tio1, tio2, pai1, novato });

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
 * O CONTADOR DE CRIANÇAS — a única regra do projeto que usa `getAfter`.
 *
 * ── ⚠️ ISTO ERA "A VAGA CONTRATADA", E O TETO SAIU EM 10/09/2026
 * A regra recusava a criança que passasse de `limiteCriancas`. Com preço por
 * faixa isso era a cláusula sendo cobrada; com preço por criança virou só uma
 * porta na cara de quem acabou de ganhar um cliente. O teto saiu do modelo:
 * NADA trava quando a operação cresce, e a fatura acompanha o tamanho.
 *
 * O que ficou é a INTEGRIDADE: `children` só aceita `create` se
 * `criancasAtivas` subir no MESMO commit. Não é teto, é o número que a fatura
 * multiplica pela taxa — criança criada sem ele é criança que o app serve e
 * ninguém cobra.
 *
 * POR ISSO O TESTE USA `:commit`, e não o PATCH de documento único usado no
 * resto do arquivo: com escritas separadas o `getAfter` vê o contador ANTIGO,
 * e o teste passaria por um motivo que não é o da regra.
 *
 * ── ⚠️ E O CASO 2 É NOVO, PORQUE A GARANTIA ERA FALSA
 * A conta antiga era `criancasAtivas <= limiteCriancas`, com o limite ausente
 * valendo 999999. Para todo motorista sem teto definido — que era todo mundo
 * em teste — `0 <= 999999` passava SEM incremento nenhum. O comentário da rule
 * afirmava "criar criança sem incrementar não passa" e isso só valia para quem
 * já estava no teto.
 *
 * A regra passou a comparar o contador DEPOIS com o de ANTES, e os casos
 * abaixo cercam a decisão nova:
 *   1. criando com incremento              → PASSA
 *   2. criando SEM incremento, sem teto    → NEGA  (o furo que existia)
 *   3. criando com o contador DESCENDO     → NEGA
 *   4. passando do antigo teto             → PASSA (o teto não existe mais)
 *   5. o motorista aumentando o próprio limiteCriancas → NEGA
 *
 * O quinto é o que mais importa e é o mais fácil de esquecer: foi assim que o
 * `suspenso` vazou uma vez — campo de gestão que a lista de proibidos não
 * acompanhou. `limiteCriancas` não tem mais gravador, e continua proibido:
 * campo sem dono não é campo livre.
 */
/**
 * CRIAR CRIANÇA COM O CONTADOR SUBINDO, no MESMO commit.
 *
 * ⚠️ É O ÚNICO JEITO DE CRIAR CRIANÇA QUE AS RULES ACEITAM, e por isso este
 * helper é de módulo e não do bloco da vaga. Três casos deste arquivo criavam
 * criança com um POST solto para provar OUTRA coisa (que a conta em dia
 * opera), e passaram a dar 403 quando a regra passou a exigir o incremento de
 * verdade — falhando pelo motivo errado, que é o que este arquivo inteiro foi
 * escrito para não fazer.
 *
 * O PATCH de documento único não serve: `getAfter` só enxerga o que vem no
 * mesmo commit, então com escritas separadas ele vê o contador ANTIGO.
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

async function vagaContratada(tio1, tio2) {

  // Cenário: tio1 contratou 2 vagas e está usando 1.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'),
    name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '1' },
  });

  // 1. Segunda criança, contador subindo de 1 para 2.
  checar('vaga', 'cria a criança incrementando o contador', 'PASSA',
    await criarCriancaComContador(tio1, tio1.uid, `vaga_ok_${Date.now()}`, 2));

  // 2. ⚠️ O FURO QUE EXISTIA. Contador parado em 2, e este motorista NÃO tem
  // teto definido — que era o caso da base inteira em teste. Com a conta
  // antiga (`0 <= 999999`) isto passava.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'), name: S('Tio Um'),
    criancasAtivas: { integerValue: '2' },
  });
  checar('vaga', 'criar sem incrementar, mesmo sem teto definido', 'NEGA',
    await criarCriancaComContador(tio1, tio1.uid, `vaga_parado_${Date.now()}`, 2));

  // 3. Contador DESCENDO junto de uma criança nova. Absurdo, e por isso mesmo
  // é o caso que um `>=` mal escrito deixaria passar.
  checar('vaga', 'criar com o contador descendo', 'NEGA',
    await criarCriancaComContador(tio1, tio1.uid, `vaga_desce_${Date.now()}`, 1));

  // 4. ⚠️ PASSAR DO ANTIGO TETO AGORA PASSA, e este caso é a decisão de
  // 10/09/2026 escrita em teste. Limite 2, contador indo a 3.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'), name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '2' },
  });
  checar('vaga', 'a 3ª criança passa do antigo teto de 2 e ENTRA', 'PASSA',
    await criarCriancaComContador(tio1, tio1.uid, `vaga_cresce_${Date.now()}`, 3));

  // Criar sem mexer no contador, pelo caminho de documento único.
  const semContador = await fetch(`${FS}/children?documentId=vaga_solta_${Date.now()}`, {
    method: 'POST',
    headers: H(tio1),
    body: JSON.stringify({
      fields: { name: S('Solta'), adminUid: S(tio1.uid), active: B(true) },
    }),
  }).then((r) => r.status);
  checar('vaga', 'criar criança sem incrementar o contador', 'NEGA', semContador);

  // 5. O motorista aumentando o próprio teto. O campo morreu, a trava não.
  //
  // ESTE CASO PASSAVA PELO MOTIVO ERRADO, e só apareceu quando um caso de
  // forma IDÊNTICA, escrito no bloco da decisão 12, deu 200 contra as mesmas
  // rules. A diferença não estava na regra: estava no ator.
  //
  // O `criarCriancaComContador` acima usa `:commit`, e um write de `update` no REST
  // do Firestore SUBSTITUI o documento quando não vai máscara junto — então
  // `users/{tio1}` saía de lá só com `criancasAtivas`, sem `role`. Sem papel,
  // `isAdmin()` é falso e o outro ramo compara `role` sobre chave ausente,
  // que é erro, e erro nega. Tudo virava 403 por falta de cadastro, não por
  // escopo — o 403 que este arquivo inteiro foi escrito pra não confiar.
  //
  // Ressemear antes de medir é o que faz o caso provar o que ele diz provar.
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


  // ── trialInicio — gravável UMA VEZ, nunca alterável ─────────────────
  //
  // O relógio dos três meses começa na primeira rota, e quem o liga é o
  // PRÓPRIO motorista, no cliente: o GPS liga no meio-fio e esperar cold
  // start de function com o passageiro na porta é a regressão que a decisão
  // 2 já recusou. Então a rule não pode proibir a escrita — ela precisa
  // proibir a REESCRITA.
  //
  // Sem isso o motorista reinicia o próprio teste para sempre: roda uma
  // rota, o campo grava; três meses depois grava de novo e ganha mais três.
  // Seria o devedor editando a própria cláusula, igual a limiteCriancas.
  //
  // OS DOIS CASOS SÃO SEQUENCIAIS DE PROPÓSITO: o primeiro grava de verdade,
  // e é o que faz o campo existir para o segundo. Testar a imutabilidade
  // contra um campo semeado à mão provaria menos — provaria a regra contra
  // um estado que o app nunca produz.
  checar('trial', 'o motorista liga o próprio relógio na primeira rota', 'PASSA',
    await escrever(`users/${tio1.uid}`, tio1,
      { trialInicio: { timestampValue: '2026-03-01T12:00:00Z' } }, ['trialInicio']));

  checar('trial', 'e não consegue ligá-lo de novo depois', 'NEGA',
    await escrever(`users/${tio1.uid}`, tio1,
      { trialInicio: { timestampValue: '2026-09-01T12:00:00Z' } }, ['trialInicio']));

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
  checar('indicacao', 'o motorista indica alguem', 'PASSA',
    await escrever('indicacoes/' + tio1.uid + '_11911112222', tio1, IND(tio1.uid)));
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
    await escrever('indicacoes/' + tio1.uid + '_11933334444', tio1,
      { ...IND(tio1.uid), chave: S('11933334444'), estado: S('ativa') }));
  checar('indicacao', 'nem indica em nome do vizinho', 'NEGA',
    await escrever('indicacoes/' + tio2.uid + '_11955556666', tio1,
      { ...IND(tio2.uid), chave: S('11955556666') }));
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

  // ⚠️ ESTES TRES CASOS MEDEM O ESTADO DA CONTA, NAO O CONTADOR — e por isso
  // usam o commit com incremento. Com um POST solto eles davam 403 pela regra
  // do contador e "provavam" um bloqueio que nao existe.
  checar('pos', 'quem esta com a assinatura em dia opera normalmente', 'PASSA',
    await criarCriancaComContador(emDia, emDia.uid, `kid-emdia-${Date.now()}`, 1));
  checar('pos', 'e quem venceu ha 3 dias ainda opera (a folga da rule)', 'PASSA',
    await criarCriancaComContador(carencia, carencia.uid, `kid-carencia-${Date.now()}`, 1));
  // Quem nunca rodou uma rota nao tem `trialInicio`: o relogio nao comecou.
  // Bloquear aqui seria bloquear todo mundo no primeiro dia.
  checar('pos', 'quem nunca rodou rota nao e bloqueado', 'PASSA',
    await criarCriancaComContador(novato, novato.uid, `kid-novato-${Date.now()}`, 1));

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
async function decisao12({ tio1, tio2, pai1, novato }) {
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

  // E os dois caminhos REAIS continuam passando — sem isto, o conserto
  // quebraria cadastro e remoção de criança, que é pior que o furo.
  checar('pos', 'o contador desce de um em um (desativar criança)', 'PASSA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '4' } }, ['criancasAtivas']));
  checar('pos', 'e sobe de um em um (cadastrar criança)', 'PASSA',
    await escrever('users/' + tio1.uid, tio1,
      { criancasAtivas: { integerValue: '5' } }, ['criancasAtivas']));

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

  // A PORTA QUE CONTINUA ABERTA, e tem consumidor: remover pai vinculado.
  //
  // ⚠️ POR ÚLTIMO DE PROPÓSITO — este caso APAGA o documento, e qualquer
  // asserção depois dele mediria a ausência do doc em vez da regra.
  checar('pos', 'mas o motorista DELA ainda APAGA o doc dela (remover vinculado)', 'PASSA',
    await apagar('users/' + pai1.uid, tio1));
}

/**
 * Confere que cada ator É quem o teste supõe, ANTES de medir qualquer coisa.
 *
 * Sem isto, um ator sem papel devolve 403 em tudo e o relatório sai verde
 * como se o isolamento estivesse perfeito. Já aconteceu.
 */
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
