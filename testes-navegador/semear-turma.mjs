/**
 * SEMEIA A TURMA DE QUATRO para o teste da rota (03/10/2026).
 *
 * O Pedro já existe (veio das jornadas M3/R1, com a Mariana). Este script
 * cria, direto no emulador, mais três crianças do mesmo motorista:
 *   - Lia   — mesma escola do Pedro, sem responsável no app
 *   - Caio  — Escola Estadual Funchal (uma segunda escola)
 *   - Duda  — mesma escola do Caio, com FALTA avisada para hoje
 * Idempotente: ids fixos, rodar de novo só regrava.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 */
const P = 'demo-alobuzinou';
const FS = `http://127.0.0.1:8085/v1/projects/${P}/databases/(default)/documents`;
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });

async function ler(caminho) {
  const r = await fetch(`${FS}/${caminho}`, { headers: ADM });
  return r.ok ? (await r.json()).fields : null;
}
async function gravar(caminho, fields) {
  const r = await fetch(`${FS}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}

// O Pedro diz quem é o motorista e a primeira escola.
const busca = await fetch(`${FS}:runQuery`, {
  method: 'POST',
  headers: ADM,
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'children' }],
      where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: S('Pedro Henrique Souza') } },
      limit: 1,
    },
  }),
}).then((r) => r.json());
const pedro = busca[0]?.document?.fields;
if (!pedro) throw new Error('O Pedro não existe — rode M3 e R1 antes.');
const adminUid = pedro.adminUid.stringValue;

const escolaB = 'escolaFunchalTeste';
await gravar(`schools/${escolaB}`, {
  adminUid: S(adminUid),
  name: S('Escola Estadual Funchal'),
  nome: S('Escola Estadual Funchal'),
  address: S('Rua Funchal, 500 — Vila Olímpia, São Paulo/SP'),
  endereco: S('Rua Funchal, 500 — Vila Olímpia, São Paulo/SP'),
  lat: N(-23.5921),
  lng: N(-46.6889),
  createdAt: T(new Date()),
});

const base = (extra) => ({
  adminUid: S(adminUid),
  active: B(true),
  status: S('home'),
  statusUpdatedAt: T(new Date(Date.now() - 86400000)),
  period: S('morning'),
  pickupPeriod: S('morning'),
  dropoffPeriod: S('morning'),
  monthlyFee: I(450),
  dueDay: I(10),
  inviteStatus: S('pending'),
  parentUid: { nullValue: null },
  geoPending: B(false),
  createdAt: T(new Date()),
  ...extra,
});

const criancas = {
  liaTeste: base({
    name: S('Lia Martins'), gender: S('female'),
    address: S('Rua Fidêncio Ramos, 200 — Vila Olímpia, São Paulo/SP'),
    lat: N(-23.5947), lng: N(-46.6858),
    horaPega: S('06:50'), horaEntrega: S('12:55'),
    school: pedro.school, schoolId: pedro.schoolId, schoolAddress: pedro.schoolAddress,
    schoolLat: pedro.schoolLat, schoolLng: pedro.schoolLng,
    parentName: S('Rita Martins'), parentPhone: S('11955554444'), inviteCode: S('TNLIA001'),
  }),
  caioTeste: base({
    name: S('Caio Ribeiro'), gender: S('male'),
    address: S('Rua Ramos Batista, 150 — Vila Olímpia, São Paulo/SP'),
    lat: N(-23.5935), lng: N(-46.6842),
    horaPega: S('06:55'), horaEntrega: S('13:00'),
    school: S('Escola Estadual Funchal'), schoolId: S(escolaB),
    schoolAddress: S('Rua Funchal, 500 — Vila Olímpia, São Paulo/SP'),
    schoolLat: N(-23.5921), schoolLng: N(-46.6889),
    parentName: S('Paulo Ribeiro'), parentPhone: S('11944443333'), inviteCode: S('TNCAIO01'),
  }),
  dudaTeste: base({
    name: S('Duda Alves'), gender: S('female'),
    address: S('Rua Ribeirão Claro, 80 — Vila Olímpia, São Paulo/SP'),
    lat: N(-23.5969), lng: N(-46.6833),
    horaPega: S('07:00'), horaEntrega: S('13:05'),
    school: S('Escola Estadual Funchal'), schoolId: S(escolaB),
    schoolAddress: S('Rua Funchal, 500 — Vila Olímpia, São Paulo/SP'),
    schoolLat: N(-23.5921), schoolLng: N(-46.6889),
    parentName: S('Sônia Alves'), parentPhone: S('11933332222'), inviteCode: S('TNDUDA01'),
  }),
};
for (const [id, campos] of Object.entries(criancas)) await gravar(`children/${id}`, campos);

// Falta da Duda para HOJE (o dia de São Paulo).
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
await gravar(`absenceDeclarations/${hoje}_dudaTeste`, {
  dateKey: S(hoje), childId: S('dudaTeste'), childName: S('Duda Alves'),
  parentUid: { nullValue: null }, adminUid: S(adminUid),
  type: S('full'), declaredBy: S('parent'), note: S(''),
  createdAt: T(new Date(Date.now() - 2 * 86400000)),
});

// O contador de crianças do motorista acompanha (a fatura multiplica por ele).
const motorista = await ler(`users/${adminUid}`);
motorista.criancasAtivas = I(4);
await gravar(`users/${adminUid}`, motorista);

// O Pedro também começa o dia em casa.
pedro.status = S('home');
pedro.statusUpdatedAt = T(new Date(Date.now() - 86400000));
await gravar(`children/${busca[0].document.name.split('/').pop()}`, pedro);

console.log(`turma de 4 semeada para ${adminUid} · falta da Duda em ${hoje}`);
