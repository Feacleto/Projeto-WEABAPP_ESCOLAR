/**
 * SEMEIA O MOTORISTA DO TESTE DO FINANCEIRO (03/10/2026).
 *
 * Cria, direto nos emuladores, o Seu Zé com o primeiro acesso completo, a
 * turma de seis crianças (uma que saiu este mês), as mensalidades de outubro
 * (pagas, avisadas e em aberto) e algumas despesas — o bastante para o caixa,
 * o extrato, a turma e o histórico da folha terem o que mostrar.
 * Idempotente: ids fixos; rodar de novo só regrava.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 * Login: ze.financeiro@teste.local / senha-de-teste-123
 */
const P = 'demo-alobuzinou';
const FS = `http://127.0.0.1:8085/v1/projects/${P}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const EMAIL = 'ze.financeiro@teste.local';
const SENHA = 'senha-de-teste-123';

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });
const NULO = { nullValue: null };

async function gravar(caminho, fields) {
  const r = await fetch(`${FS}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}

// A conta: cria; se já existe, entra para saber o uid.
let r = await fetch(`${AUTH}/accounts:signUp?key=demo`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: SENHA, returnSecureToken: true }),
}).then((x) => x.json());
if (!r.localId) {
  r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA, returnSecureToken: true }),
  }).then((x) => x.json());
}
const uid = r.localId;
if (!uid) throw new Error('Não consegui criar nem entrar na conta: ' + JSON.stringify(r));

// Cada rodada começa da PRIMEIRA VEZ: sem senha, sem resposta sobre a perua.
for (const c of ['configFinanceiro', 'senhasDoFinanceiro']) {
  await fetch(`${FS}/${c}/${uid}`, { method: 'DELETE', headers: ADM });
}

const agora = new Date();
const dia = (d, h = 9) => new Date(agora.getFullYear(), agora.getMonth(), d, h);
const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

await gravar(`users/${uid}`, {
  role: S('admin'), email: S(EMAIL), name: S('José Aparecido Lima'), phone: S('(11) 98765-4321'),
  gender: S('male'), marcaNome: S('Transporte Tio Zé'), city: S('São Paulo'), uf: S('SP'),
  termsVersion: S('1.2'), privacyVersion: S('1.2'), termsAcceptedAt: T(new Date(2026, 8, 1)),
  tutorialDone: B(true), pixKey: S('11987654321'), pixKeyType: S('phone'),
  criancasAtivas: I(5), createdAt: T(new Date(2026, 6, 1)),
});

const criancas = [
  ['finMiguel', 'Miguel Santos', 350, 10, new Date(2026, 5, 2), true],
  ['finLaura', 'Laura Mendes', 350, 10, new Date(2026, 7, 5), true],
  ['finDavi', 'Davi Rocha', 320, 5, new Date(2026, 8, 1), true],
  ['finHelena', 'Helena Costa', 350, 10, dia(1), true],
  ['finLucas', 'Lucas Prado', 350, 15, dia(2), true],
  ['finBruno', 'Bruno Alves', 300, 10, new Date(2026, 3, 1), false],
];
for (const [id, nome, valor, venc, criada, ativa] of criancas) {
  const f = {
    adminUid: S(uid), name: S(nome), monthlyFee: N(valor), dueDay: I(venc), active: B(ativa),
    status: S('home'), createdAt: T(criada), schoolName: S('EMEF Vila Olímpia'),
    parentName: S('Responsável de ' + nome.split(' ')[0]), parentPhone: S('(11) 91234-0000'),
  };
  if (!ativa) f.inativadoEm = T(dia(2, 18));
  await gravar(`children/${id}`, f);
}

const pagamentos = [
  ['finMiguel', 350, 'paid', 'pix', dia(3, 8)],
  ['finLaura', 350, 'paid', 'cash', dia(2, 17)],
  ['finDavi', 320, 'paid', 'pix', dia(1, 7)],
  ['finHelena', 350, 'claimed', 'pix', null],
  ['finLucas', 350, 'pending', null, null],
];
for (const [cid, valor, st, metodo, pagoEm] of pagamentos) {
  const nome = criancas.find((c) => c[0] === cid)[1];
  await gravar(`payments/${cid}_${mes}`, {
    adminUid: S(uid), childId: S(cid), childName: S(nome), parentUid: NULO, month: S(mes),
    amount: N(valor), status: S(st), paymentMethod: metodo ? S(metodo) : NULO,
    paidAt: pagoEm ? T(pagoEm) : NULO, dueDate: T(dia(10)), createdAt: T(dia(1, 0)),
    ...(st === 'claimed' ? { claimedAt: T(dia(3, 7)) } : {}),
  });
}

const despesas = [
  ['finDesp1', 'fuel', 280, 'Posto Shell', dia(2, 18), 41200],
  ['finDesp2', 'monitor', 900, 'Salário da Cida', dia(1, 10), null],
  ['finDesp3', 'fuel', 260, 'Posto Ipiranga', new Date(2026, 8, 24), 40780],
  ['finDesp4', 'maintenance', 420, 'Troca de óleo', new Date(2026, 7, 12), 38020],
  ['finDesp5', 'monitor', 900, 'Salário da Cida', new Date(2026, 8, 1, 10), null],
  ['finDesp6', 'other', 18.4, 'Pedágio', new Date(2026, 8, 20), null],
  ['finDesp7', 'other', 18.4, 'Pedágio', new Date(2026, 8, 13), null],
  ['finDesp8', 'other', 35, 'Lavagem', new Date(2026, 8, 6), null],
];
for (const [id, cat, valor, desc, data, km] of despesas) {
  const mk = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  await gravar(`expenses/${id}`, {
    adminUid: S(uid), category: S(cat), amount: N(valor), description: S(desc),
    date: T(data), monthKey: S(mk), createdAt: T(data), ...(km ? { kmPainel: N(km) } : {}),
  });
}

console.log(`Semeado. uid=${uid}  login: ${EMAIL} / ${SENHA}`);
