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

const PID = 'projeto-tio-nino-digital';
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
  // Os dois atores que faltavam. `espera` e o motorista inscrito e nao
  // aprovado: o isolamento dele inteiro depende de `isAppUser()` exclui-lo,
  // e nada testava isso. `anon` e o visitante da landing.
  const espera = await criarLogin(`espera.${Date.now()}@teste.local`);
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
  await semear(`users/${espera.uid}`, { role: S('aguardando'), name: S('Inscrito') });
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
      checkpoints: { mapValue: { fields: { embarcou: { mapValue: { fields: { lat: N(-23.1) } } } } } },
      combinado: { mapValue: { fields: { ida: S('06:20') } } },
      atualizadoEm: { timestampValue: '2026-08-25T09:20:00Z' },
    }));
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
  await oQueNinguemTestava({ tio1, tio2, pai1, dono, espera, anon });
  await decisao12({ tio1, tio2, pai1 });

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
 * A VAGA CONTRATADA — a única regra do projeto que usa `getAfter`.
 *
 * Ela é a que impõe o contrato: `children` só aceita `create` se o contador
 * `criancasAtivas` do motorista, JÁ INCREMENTADO, couber no `limiteCriancas`
 * que o dono negociou. Como rules não sabem contar documentos, a contagem
 * precisa estar materializada — e as duas escritas precisam vir no mesmo
 * commit, que é o que `getAfter` enxerga.
 *
 * POR ISSO O TESTE USA `:commit`, e não o PATCH de documento único usado no
 * resto do arquivo: com escritas separadas o `getAfter` vê o contador ANTIGO,
 * e o teste passaria por um motivo que não é o da regra.
 *
 * OS QUATRO CASOS CERCAM A DECISÃO:
 *   1. dentro do limite, com incremento  → PASSA  (prova que a regra existe)
 *   2. estourando o limite               → NEGA   (prova que ela morde)
 *   3. criando sem incrementar           → NEGA   (o furo óbvio)
 *   4. o motorista aumentando o próprio limite → NEGA
 *
 * O quarto é o que mais importa e é o mais fácil de esquecer: foi assim que o
 * `suspenso` vazou uma vez — campo de gestão que a lista de proibidos não
 * acompanhou, e o suspenso se liberava sozinho. Limite que o limitado aumenta
 * não é limite.
 */
async function vagaContratada(tio1, tio2) {
  const doc = (c) => `projects/${PID}/databases/(default)/documents/${c}`;

  // Cenário: tio1 contratou 2 vagas e está usando 1.
  await semear(`users/${tio1.uid}`, {
    role: S('admin'),
    name: S('Tio Um'),
    limiteCriancas: { integerValue: '2' },
    criancasAtivas: { integerValue: '1' },
  });

  const criarComContador = (sessao, uid, idCrianca, contador) =>
    fetch(`${FS}:commit`, {
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

  // 1. Segunda criança, contador indo a 2, limite 2. Cabe.
  checar('vaga', 'cria a 2ª criança dentro do limite de 2', 'PASSA',
    await criarComContador(tio1, tio1.uid, `vaga_ok_${Date.now()}`, 2));

  // 2. Terceira, contador a 3, limite 2. Não cabe.
  await semear(`users/${tio1.uid}`, { criancasAtivas: { integerValue: '2' } });
  checar('vaga', 'a 3ª criança estoura o limite de 2', 'NEGA',
    await criarComContador(tio1, tio1.uid, `vaga_no_${Date.now()}`, 3));

  // 3. Criar sem mexer no contador — o furo óbvio.
  const semContador = await fetch(`${FS}/children?documentId=vaga_solta_${Date.now()}`, {
    method: 'POST',
    headers: H(tio1),
    body: JSON.stringify({
      fields: { name: S('Solta'), adminUid: S(tio1.uid), active: B(true) },
    }),
  }).then((r) => r.status);
  checar('vaga', 'criar criança sem incrementar o contador', 'NEGA', semContador);

  // 4. O motorista aumentando o próprio teto. É a fraude que paga a conta.
  //
  // ESTE CASO PASSAVA PELO MOTIVO ERRADO, e só apareceu quando um caso de
  // forma IDÊNTICA, escrito no bloco da decisão 12, deu 200 contra as mesmas
  // rules. A diferença não estava na regra: estava no ator.
  //
  // O `criarComContador` acima usa `:commit`, e um write de `update` no REST
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
async function oQueNinguemTestava({ tio1, tio2, pai1, dono, espera, anon }) {
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

  await semear('taxaConfig/app', { percentual: N(6), piso: N(50), pixKey: S('plataforma@x.com') });
  await semear('taxaParceiros/' + tio1.uid, { modo: S('percentual'), valor: N(6) });
  await semear('faturasParceiro/' + tio1.uid + '_2026-08', { tioUid: S(tio1.uid), total: N(180) });

  checar('pos', 'o motorista le a regua da taxa (pra saber pra onde pagar)', 'PASSA',
    await ler('taxaConfig/app', tio1));
  // A estrutura de preco da plataforma nao e assunto do responsavel: ele nao
  // tem tela que leia isto, e o bloco vizinho (taxaParceiros) ja argumenta que
  // preco nao pode vazar nem pro proprio motorista.
  checar('taxa', 'o responsavel le a estrutura de preco da plataforma', 'NEGA',
    await ler('taxaConfig/app', pai1));
  checar('taxa', 'tio2 le a negociacao do tio1', 'NEGA',
    await ler('taxaParceiros/' + tio1.uid, tio2));
  checar('taxa', 'tio2 le a fatura do tio1', 'NEGA',
    await ler('faturasParceiro/' + tio1.uid + '_2026-08', tio2));
  checar('pos', 'o dono le a fatura que emitiu', 'PASSA',
    await ler('faturasParceiro/' + tio1.uid + '_2026-08', dono));

  console.log('\n=== O BENEFICIO E A FILA ===');

  await semear('entryBonuses/' + tio1.uid, { meses: N(3), sorteadoEm: S('2026-08-01') });
  checar('pos', 'o motorista le o proprio premio', 'PASSA',
    await ler('entryBonuses/' + tio1.uid, tio1));
  checar('bonus', 'tio2 le o premio do tio1', 'NEGA',
    await ler('entryBonuses/' + tio1.uid, tio2));
  // `entryBonuses` e beneficio em dinheiro e ninguem escreve dali — nem o dono.
  checar('bonus', 'o motorista escreve o proprio premio', 'NEGA',
    await escrever('entryBonuses/' + tio1.uid, tio1, { meses: N(4) }, ['meses']));
  checar('bonus', 'o motorista varre a lista de premios', 'NEGA',
    await listar('entryBonuses', tio1));

  await semear('waitlistParents/lead1', {
    name: S('Familia Souza'), email: S('souza@x.com'), createdAt: S('2026-08-01'),
  });
  // A gemea `waitlistDrivers` foi fechada porque anonimo enchia de lixo. Esta
  // ficou aberta tres linhas abaixo, sem uma linha de justificativa.
  checar('fila', 'o motorista le os leads de familia da plataforma', 'NEGA',
    await ler('waitlistParents/lead1', tio1));
  checar('fila', 'o motorista APAGA um lead de familia', 'NEGA',
    await apagar('waitlistParents/lead1', tio1));

  console.log('\n=== O INSCRITO NAO APROVADO — `aguardando` nao alcanca nada ===');

  // O papel existe pra que esquecer uma checagem faca ele ver MENOS, nao mais.
  // Nada media isso ate aqui.
  checar('espera', 'inscrito le a crianca de um parceiro', 'NEGA',
    await ler('children/kid1', espera));
  checar('espera', 'inscrito le o recado de escola do parceiro', 'NEGA',
    await ler('schoolBroadcasts/br1', espera));
  checar('espera', 'inscrito le a agenda do parceiro', 'NEGA',
    await ler('agendaEntries/ag1', espera));
  checar('espera', 'inscrito le a mensalidade de uma familia', 'NEGA',
    await ler('payments/pag1', espera));
  checar('espera', 'inscrito le a regua da taxa', 'NEGA',
    await ler('taxaConfig/app', espera));
  checar('pos', 'inscrito le o proprio documento (a fila dele)', 'PASSA',
    await ler('users/' + espera.uid, espera));

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
  checar('pix', 'inscrito nao aprovado le o doc de um motorista', 'NEGA',
    await ler('users/' + tio1.uid, espera));

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
async function decisao12({ tio1, tio2, pai1 }) {
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
