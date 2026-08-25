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

async function main() {
  console.log('\n═══ elenco ═══');
  const dono = await criarLogin(`dono.${Date.now()}@teste.local`);
  const tio1 = await criarLogin(`tio1.${Date.now()}@teste.local`);
  const tio2 = await criarLogin(`tio2.${Date.now()}@teste.local`);
  const pai1 = await criarLogin(`pai1.${Date.now()}@teste.local`);

  await semear(`users/${dono.uid}`, { role: S('owner'), name: S('Dono') });
  await semear(`users/${tio1.uid}`, { role: S('admin'), name: S('Tio Um') });
  await semear(`users/${tio2.uid}`, { role: S('admin'), name: S('Tio Dois') });
  await semear(`users/${pai1.uid}`, {
    role: S('parent'),
    name: S('Pai Um'),
    adminUid: S(tio1.uid),
    childId: S('kid1'),
  });
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

  await tetoDeGets(tio1);

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
