/**
 * Semeia dado de teste em produção, pela conta do MOTORISTA.
 *
 * POR QUE ISTO EXISTE
 * Nenhuma sessão tem navegador. Não dá pra abrir a tela, passar pelo
 * assistente de 4 passos e ver a lista encher. O que dá é exercitar a MESMA
 * camada que a tela usa — as regras do Firestore, autenticado como o usuário
 * de verdade — e conferir o que entra e o que é negado.
 *
 * Isso não substitui alguém abrindo a tela. Substitui a suposição de que a
 * tela funcionaria: se a escrita é negada por regra, nenhum layout salva.
 *
 * O QUE ELE CRIA, E POR QUE ESSES CASOS
 *   3 crianças, escolhidas pra cobrir os estados que aparecem com 30:
 *     - completa, com coordenada          → o caso feliz
 *     - sem escola                        → ficha preenchida depois, na rota
 *     - sem coordenada (geoPending)       → o Nominatim não acha boa parte
 *                                           dos endereços de periferia
 *     - uma delas SEM mensalidade         → o caso que some da cobrança
 *   4 pagamentos, um de cada estado que a tela desenha:
 *     pending, claimed, paid, e um ATRASADO (mês anterior, ainda pending)
 *
 * IDEMPOTENTE: marca tudo com `_seed: true` e apaga o que sobrou de uma
 * execução anterior antes de criar. Rodar duas vezes não duplica.
 *
 * O NOME COMEÇA COM 'TESTE — ' E TERMINA COM '(apagar)', DE PROPÓSITO.
 * O painel do dono conta base, GMV e ticket médio a partir das coleções
 * children e payments REAIS — e o próprio comentário daquele painel diz que esses são
 * os números que se leva pra conversa de investimento. Dado de teste entra na
 * conta. Se o nome não gritar, alguém vai olhar a métrica meses depois sem
 * saber que três das crianças nunca existiram.
 *
 * PRA LIMPAR:  node scripts/semear-teste.cjs --limpar
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const LIMPAR = process.argv.includes('--limpar');

const MOTORISTA = {
  email: 'motorista.teste@alobuzinou.com',
  senha: 'TesteTio2026!',
};

function lerEnv() {
  const bruto = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
  const env = {};
  for (const l of bruto.split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0 && !l.trim().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return env;
}

const env = lerEnv();
const KEY = env.VITE_FIREBASE_API_KEY;
const PID = env.VITE_FIREBASE_PROJECT_ID;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/`;

const S = (v) => ({ stringValue: String(v) });
const N = (v) => ({ doubleValue: Number(v) });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: !!v });
const T = (v) => ({ timestampValue: v });
const NULO = { nullValue: null };

async function entrar() {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...{ email: MOTORISTA.email, password: MOTORISTA.senha }, returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (j.error) throw new Error(`login do motorista: ${j.error.message}`);
  return { uid: j.localId, token: j.idToken };
}

function H(s) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` };
}

async function criar(colecao, campos, s) {
  const r = await fetch(`${DOCS}${colecao}`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({ fields: campos }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${colecao}: ${j.error.status} — ${j.error.message}`);
  return j.name.split('/').pop();
}

/** Apaga o que uma execução anterior deixou. */
async function limpar(colecao, s) {
  const r = await fetch(`${DOCS.replace(/\/$/, '')}:runQuery`, {
    method: 'POST',
    headers: H(s),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: {
          fieldFilter: {
            field: { fieldPath: '_seed' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
      },
    }),
  });
  const j = await r.json();
  if (!Array.isArray(j)) return 0;
  const nomes = j.filter((x) => x.document).map((x) => x.document.name);
  for (const nome of nomes) {
    await fetch(`https://firestore.googleapis.com/v1/${nome}`, {
      method: 'DELETE',
      headers: H(s),
    });
  }
  return nomes.length;
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesAnterior() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const s = await entrar();
  const agora = new Date().toISOString();
  console.log(`\nmotorista: ${s.uid}\n`);

  const apagadasP = await limpar('payments', s);
  const apagadasC = await limpar('children', s);
  if (apagadasP + apagadasC > 0) {
    console.log(`limpeza: ${apagadasC} criança(s) e ${apagadasP} pagamento(s) da rodada anterior\n`);
  }
  if (LIMPAR) {
    console.log('Só limpeza (--limpar). Nada criado.');
    return;
  }

  // ── as três crianças ────────────────────────────────────────────────────
  const base = {
    gender: S('male'),
    parentUid: NULO,
    inviteStatus: S('pending'),
    status: S('home'),
    active: B(true),
    period: S('morning'),
    pickupPeriod: S('morning'),
    dropoffPeriod: S('afternoon'),
    dueDay: I(10),
    createdAt: T(agora),
    statusUpdatedAt: T(agora),
    // `adminUid` é o escopo por motorista que a 3d introduziu. Semeamos com
    // ele DESDE JÁ pra o dado nascer no formato novo — assim a criança de
    // teste não vira caso do backfill, e o backfill continua medindo só o
    // legado de verdade.
    adminUid: S(s.uid),
    _seed: B(true),
  };

  const CRIANCAS = [
    {
      rotulo: 'completa',
      campos: {
        ...base,
        name: S('TESTE — Ana Clara (apagar)'),
        gender: S('female'),
        birthDate: S('2017-03-14'),
        address: S('Rua Cisplatina, 420 — Ipiranga, São Paulo'),
        lat: N(-23.5955),
        lng: N(-46.6103),
        geoPending: B(false),
        school: S('EMEF Prof. João Rodrigues'),
        schoolAddress: S('Rua Bom Pastor, 1100 — Ipiranga, São Paulo'),
        schoolLat: N(-23.5901),
        schoolLng: N(-46.6142),
        parentName: S('Marina Souza'),
        parentPhone: S('11988887777'),
        parentEmail: S('pai.teste@alobuzinou.com'),
        monthlyFee: N(450),
        inviteCode: S('TN7K2M9P'),
      },
    },
    {
      rotulo: 'sem escola (ficha completada depois)',
      campos: {
        ...base,
        name: S('TESTE — Pedro Henrique (apagar)'),
        birthDate: S('2015-08-02'),
        address: S('Av. Nazaré, 1580 — Ipiranga, São Paulo'),
        lat: N(-23.6018),
        lng: N(-46.6089),
        geoPending: B(false),
        school: S(''),
        schoolAddress: S(''),
        schoolLat: NULO,
        schoolLng: NULO,
        parentName: S('Rodrigo Lima'),
        parentPhone: S('11977776666'),
        monthlyFee: N(380),
        inviteCode: S('TN4J8H2X'),
      },
    },
    {
      rotulo: 'SEM coordenada e SEM mensalidade',
      campos: {
        ...base,
        name: S('TESTE — Miguel (apagar)'),
        birthDate: S('2018-11-27'),
        address: S('Viela São Jorge, 12 — fundos, Sacomã, São Paulo'),
        lat: NULO,
        lng: NULO,
        // O Nominatim não acha viela e "fundos". É o caso real de periferia
        // que fez a coordenada deixar de bloquear o cadastro.
        geoPending: B(true),
        school: S('EMEI Vila Independência'),
        schoolAddress: S('Rua Silva Bueno, 2200 — Ipiranga, São Paulo'),
        schoolLat: N(-23.5987),
        schoolLng: N(-46.6031),
        parentName: S('Juliana Santos'),
        parentPhone: S('11966665555'),
        // ZERO de propósito: é a criança que SOME da geração de cobrança.
        monthlyFee: N(0),
        inviteCode: S('TN9R3T5W'),
      },
    },
  ];

  const ids = [];
  for (const c of CRIANCAS) {
    const id = await criar('children', c.campos, s);
    ids.push({ id, rotulo: c.rotulo, nome: c.campos.name.stringValue, fee: Number(c.campos.monthlyFee.doubleValue) });
    console.log(`criança  ${id}  ${c.campos.name.stringValue}  (${c.rotulo})`);
  }

  // ── os quatro pagamentos ────────────────────────────────────────────────
  // Um de cada estado que a tela desenha, mais o atraso de mês anterior —
  // que é o caso que some do olho de quem só olha o mês corrente.
  const alvo = ids[0];
  const PAGS = [
    { rotulo: 'em aberto (mês atual)', status: 'pending', month: mesAtual() },
    { rotulo: 'pai avisou que pagou', status: 'claimed', month: mesAtual() },
    { rotulo: 'pago', status: 'paid', month: mesAtual() },
    { rotulo: 'ATRASADO (mês anterior)', status: 'pending', month: mesAnterior() },
  ];

  console.log('');
  for (const p of PAGS) {
    const campos = {
      childId: S(alvo.id),
      // Denormalizado de propósito: a tela lê o nome daqui em vez de buscar
      // o doc da criança. Vazio faz a lista aparecer sem nome.
      childName: S(alvo.nome),
      parentUid: NULO,
      adminUid: S(s.uid),
      month: S(p.month),
      amount: N(alvo.fee || 450),
      dueDate: T(`${p.month}-10T12:00:00.000Z`),
      status: S(p.status),
      createdAt: T(agora),
      _seed: B(true),
    };
    if (p.status === 'claimed') campos.claimedAt = T(agora);
    const id = await criar('payments', campos, s);
    console.log(`pagamento ${id}  ${p.month}  ${p.status.padEnd(8)}  ${p.rotulo}`);
  }

  console.log('\n' + '─'.repeat(64));
  console.log('Pra vincular o responsável de teste (passo de console):');
  console.log('  users/crgJWFVjF9RJ1ZdOQUEiTqugptD2');
  console.log('    role=parent  childIds=[' + alvo.id + ']  childId=' + alvo.id);
  console.log('    termsVersion="1.0" privacyVersion="1.0" termsAcceptedAt=agora');
  console.log('  children/' + alvo.id + ' -> parentUid, inviteStatus="used"');
  console.log('  payments (os 4) -> parentUid = crgJWFVjF9RJ1ZdOQUEiTqugptD2');
  console.log('─'.repeat(64));
  console.log('\nPra desfazer tudo: node scripts/semear-teste.cjs --limpar');
}

main().catch((e) => {
  console.error('\nFALHOU: ' + e.message);
  process.exit(1);
});
