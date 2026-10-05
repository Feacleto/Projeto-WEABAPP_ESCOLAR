/**
 * SEMEIA A T1 — PASSAR A FAMÍLIA PARA UM TIO PARCEIRO (05/10/2026, F2.7).
 *
 * Cria, direto nos emuladores, o que a régua da transferência exige
 * (functions/lib/reguaDaTransferencia.js e functions/lib/transferencias.js):
 *   - Tio A (o que sai) e Tio B (o parceiro), `role: 'admin'`, primeiro acesso
 *     completo, os DOIS pagantes;
 *   - a amizade entre eles: uma `indicacoes` com A indicador e B indicado
 *     (`saoParceiros` consulta os dois sentidos; um basta);
 *   - a Ana, criança de A, com a família já no app e contrato aceito, cheia
 *     dos campos que NUNCA podem ir para B (saúde, foto, mensalidade,
 *     horários, recado, contrato) — sem eles, conferir "não foi copiado"
 *     não prova nada;
 *   - uma escola de B com o MESMO nome da escola da Ana (a régua casa pelo
 *     nome, sem acento e sem caixa) e uma viagem antiga da Ana (histórico);
 *   - a responsável (`role: 'parent'`, termos, tour visto, primeiro acesso
 *     completo) e uma mensalidade ANTIGA paga — paga de propósito: sem nada
 *     em aberto, o servidor tira A de `adminUids`, e a jornada confere que
 *     ela ainda lê a mensalidade pelo `parentUid`.
 *
 * "PAGANTE" é `ehPagante` (reguaDaTransferencia.js): `plano` mensal/anual e
 * não `suspenso`. O servidor não olha mais nada. `assinaturaAte` no futuro
 * entra porque as rules (`isAdmin()` → `assinaturaCobreHoje`) e o
 * GuardaDaConta trancariam o tio com a cobrança ligada; o contrato da
 * associação NÃO é semeado — a tela o exige ao assinar, o servidor não.
 *
 * Idempotente: ids fixos; rodar de novo apaga os pedidos de transferência da
 * rodada anterior (contam para o teto de 10 por mês), a criança criada em B,
 * os avisos dos três e regrava o resto.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 * ⚠️ NÃO liga `cobrancaLigada`: quem liga é a t1-transferencia.mjs, depois
 * de guardar o valor de antes, e ela o devolve no fim. Ligada aqui, a jornada
 * leria "ligada" como o valor de antes e deixaria o emulador de todas as
 * sessões com a cobrança ligada.
 */
import { readFileSync } from 'node:fs';

const P = 'demo-alobuzinou';
const RAIZ = `projects/${P}/databases/(default)/documents`;
const FS = `http://127.0.0.1:8085/v1/${RAIZ}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const SENHA = 'senha-de-teste-123';
// A versão dos termos vem do app: escrita à mão, a família caía no reaceite.
const LEGAL = /export const LEGAL_VERSION = '([^']+)'/.exec(
  readFileSync(new URL('../src/pages/legal/legalContent.js', import.meta.url), 'utf8')
)[1];

const T1 = {
  tioA: { email: 'tio.a.transferencia@teste.local', marca: 'Transporte Tio Arnaldo' },
  tioB: { email: 'tio.b.transferencia@teste.local', marca: 'Perua do Tio Bruno' },
  familia: { email: 'familia.transferencia@teste.local' },
  crianca: 't1AnaClara',
  escolaA: 't1EscolaA',
  escolaB: 't1EscolaB',
  indicacao: 't1IndicacaoAB',
  senha: SENHA,
};

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });
const A = (lista) => ({ arrayValue: { values: lista } });
const M = (fields) => ({ mapValue: { fields } });
const NULO = { nullValue: null };

async function gravar(caminho, fields, mascara = null) {
  const q = mascara ? '?' + mascara.map((c) => `updateMask.fieldPaths=${encodeURIComponent(c)}`).join('&') : '';
  const r = await fetch(`${FS}/${caminho}${q}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}
const apagar = (nomeCompleto) => fetch(`http://127.0.0.1:8085/v1/${nomeCompleto}`, { method: 'DELETE', headers: ADM });

/** Os documentos de uma coleção de raiz com `campo == valor` (nome completo de cada um). */
async function onde(colecao, campo, valor) {
  const r = await fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers: ADM,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: S(valor) } },
        limit: 200,
      },
    }),
  }).then((x) => x.json());
  return (Array.isArray(r) ? r : []).filter((x) => x.document).map((x) => x.document);
}

/** Apaga um documento e as subcoleções que a jornada pode ter criado nele. */
async function apagarComFilhos(nome, subcolecoes) {
  for (const sub of subcolecoes) {
    const lista = await fetch(`http://127.0.0.1:8085/v1/${nome}/${sub}?pageSize=200`, { headers: ADM }).then((x) => x.json());
    for (const d of lista.documents || []) await apagar(d.name);
  }
  await apagar(nome);
}

async function conta(email) {
  let r = await fetch(`${AUTH}/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  }).then((x) => x.json());
  if (!r.localId) {
    r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
    }).then((x) => x.json());
  }
  if (!r.localId) throw new Error(`Não consegui criar nem entrar em ${email}: ${JSON.stringify(r)}`);
  return r.localId;
}

const uidA = await conta(T1.tioA.email);
const uidB = await conta(T1.tioB.email);
const uidF = await conta(T1.familia.email);

// ── A rodada anterior sai ─────────────────────────────────────────────────
// Os pedidos de A contam para o teto do mês (abertos, concluídos e
// cancelados): sem apagar, a 11ª rodada ouviria "Você já passou 10 famílias".
for (const campo of ['deUid', 'paraUid']) {
  for (const d of await onde('transferenciasDeFamilia', campo, campo === 'deUid' ? uidA : uidB)) await apagar(d.name);
}
// A criança que o aceite criou na turma de B (e qualquer outra de B).
for (const d of await onde('children', 'adminUid', uidB)) await apagarComFilhos(d.name, ['rides', 'contratos', 'proximidade']);
// Os avisos dos três: o sino velho confunde quem olha os prints.
for (const uid of [uidA, uidB, uidF]) {
  for (const d of await onde('notifications', 'userId', uid)) await apagar(d.name);
}
// A Ana volta inteira (a jornada a deixa inativa e com `transferidaPara`).
await apagarComFilhos(`${RAIZ}/children/${T1.crianca}`, ['rides', 'contratos', 'proximidade']);

const agora = new Date();
const daquiA = (dias) => new Date(agora.getTime() + dias * 86400000);
const mesAntes = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
const MES_ANTES = `${mesAntes.getFullYear()}-${String(mesAntes.getMonth() + 1).padStart(2, '0')}`;


// ── Os dois tios ──────────────────────────────────────────────────────────
const tio = (email, nome, marca, doc, fone) => ({
  role: S('admin'), email: S(email), name: S(nome), phone: S(fone), gender: S('male'),
  marcaNome: S(marca), city: S('São Paulo'), uf: S('SP'), regiao: S('Vila Olímpia'),
  companyName: S(nome), companyDocument: S(doc), companyAddress: S('Rua das Trovas, 10, São Paulo/SP'),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(new Date(2026, 8, 1)),
  tutorialDone: B(true), turmaConcluidaEm: T(new Date(2026, 8, 1)),
  // PAGANTE: `plano` é o que `ehPagante` lê; `assinaturaAte` é o que as
  // rules e o GuardaDaConta leem com a cobrança ligada.
  plano: S('mensal'), assinaturaAte: T(daquiA(60)), documentoDaAssinatura: S(doc.replace(/\D/g, '')),
  pixKey: S(fone.replace(/\D/g, '')), pixKeyType: S('phone'),
  createdAt: T(new Date(2026, 6, 1)),
});
await gravar(`users/${uidA}`, {
  ...tio(T1.tioA.email, 'Arnaldo Pereira Souza', T1.tioA.marca, '529.982.247-25', '(11) 97777-1111'),
  criancasAtivas: I(1),
});
await gravar(`users/${uidB}`, {
  ...tio(T1.tioB.email, 'Bruno Carvalho Dias', T1.tioB.marca, '111.444.777-35', '(11) 96666-2222'),
  criancasAtivas: I(0),
});

// PARCEIROS: A indicou B (`parceirosDe` em reguaDaComunidade.js).
await gravar(`indicacoes/${T1.indicacao}`, {
  indicadorUid: S(uidA), indicadoUid: S(uidB), estado: S('ativa'),
  chave: S('11966662222'), nome: S('Bruno'), telefone: S('(11) 96666-2222'),
  criadoEm: T(new Date(2026, 7, 1)), ativadaEm: T(new Date(2026, 8, 1)),
});

// ── As escolas: o mesmo nome dos dois lados, com caixa diferente ─────────
const ESCOLA = 'EMEF Vila Olímpia';
const END_ESCOLA = 'Rua Gomes de Carvalho, 400 — Vila Olímpia, São Paulo/SP';
await gravar(`schools/${T1.escolaA}`, {
  adminUid: S(uidA), name: S(ESCOLA), nome: S(ESCOLA), address: S(END_ESCOLA), endereco: S(END_ESCOLA),
  lat: N(-23.5955), lng: N(-46.687), createdAt: T(new Date(2026, 6, 1)),
});
await gravar(`schools/${T1.escolaB}`, {
  adminUid: S(uidB), name: S('emef vila olimpia'), nome: S('emef vila olimpia'), address: S(END_ESCOLA),
  endereco: S(END_ESCOLA), lat: N(-23.5955), lng: N(-46.687), createdAt: T(new Date(2026, 6, 1)),
});

// ── A criança de A ────────────────────────────────────────────────────────
const contratoAceito = new Date(2026, 7, 5, 20);
await gravar(`children/${T1.crianca}`, {
  // O que VAI (CAMPOS_QUE_VAO).
  name: S('Ana Clara Ribeiro'), gender: S('female'), birthDate: S('2018-03-14'),
  turma: S('2º ano B'), professora: S('Dona Célia'),
  parentName: S('Paula Ribeiro'), parentEmail: S(T1.familia.email), parentPhone: S('(11) 95555-3333'),
  parentPhoneChave: S('11955553333'), parent2Name: S('Marcos Ribeiro'), parent2Phone: S('(11) 94444-4444'),
  address: S('Rua Funchal, 210 — Vila Olímpia, São Paulo/SP'), cep: S('04551-060'),
  lat: N(-23.5921), lng: N(-46.6889),
  school: S(ESCOLA), schoolAddress: S(END_ESCOLA), schoolPhone: S('(11) 3333-4444'),
  schoolLat: N(-23.5955), schoolLng: N(-46.687),
  // O vínculo e o dono.
  adminUid: S(uidA), parentUid: S(uidF), active: B(true), inviteStatus: S('used'),
  createdAt: T(new Date(2026, 7, 1)),
  // O que NUNCA vai (CAMPOS_QUE_NUNCA_VAO): cada um com valor, para a
  // ausência na criança nova ser prova.
  saudeNotas: S('Alergia a amendoim'), saudeConsentidaEm: T(new Date(2026, 7, 6)),
  photoURL: S('https://example.invalid/ana.jpg'), fotoDaTurmaConsentida: B(true),
  monthlyFee: N(380), dueDay: I(10), vigenciaInicio: S('2026-08-01'), vigenciaFim: S('2026-12-31'),
  horaPega: S('06:40'), horaEntrega: S('12:40'), period: S('morning'),
  pickupPeriod: S('morning'), dropoffPeriod: S('morning'), status: S('home'),
  statusUpdatedAt: T(new Date(2026, 9, 1, 12)), notes: S('Desce sempre pelo portão lateral'),
  altResponsibles: A([M({ name: S('Vó Neusa'), phone: S('(11) 93333-0000') })]),
  inviteCode: S('TNT1ANA1'), schoolId: S(T1.escolaA), autorizacaoDeclarada: T(new Date(2026, 7, 1)),
  contratoVigente: M({
    numero: I(1), tipo: S('contrato'), aceitoEm: T(contratoAceito), aceitoNome: S('Paula Ribeiro'),
    inicio: S('2026-08-01'), fim: S('2026-12-31'), hash: S('t1-hash-de-teste'),
  }),
  contratoAguardando: NULO,
  contractVersion: I(1), contractAcceptedAt: T(contratoAceito), contractAcceptedByUid: S(uidF),
  contractAcceptedName: S('Paula Ribeiro'), contractHash: S('t1-hash-de-teste'),
});
await gravar(`children/${T1.crianca}/contratos/1`, {
  numero: I(1), tipo: S('contrato'), status: S('aceito'), adminUid: S(uidA), familia: S(uidF),
  dados: M({ version: I(1), monthlyFee: N(380) }), emitidoEm: T(new Date(2026, 7, 5, 9)),
  aceitoEm: T(contratoAceito), aceitoPorUid: S(uidF), aceitoNome: S('Paula Ribeiro'), hash: S('t1-hash-de-teste'),
  substitui: NULO, mudancas: NULO, novosValores: NULO,
});
// O histórico: uma viagem de 1º/10 (dentro dos 60 dias da retenção).
await gravar(`children/${T1.crianca}/rides/2026-10-01`, {
  dateKey: S('2026-10-01'), adminUid: S(uidA), childId: S(T1.crianca),
  marcos: M({ embarqueEmCasa: T(new Date(2026, 9, 1, 6, 42)), delivered: T(new Date(2026, 9, 1, 12, 45)) }),
});

// ── A família ─────────────────────────────────────────────────────────────
await gravar(`users/${uidF}`, {
  role: S('parent'), email: S(T1.familia.email), name: S('Paula Ribeiro'), phone: S('(11) 95555-3333'),
  phoneChave: S('11955553333'),
  childIds: A([S(T1.crianca)]), childId: S(T1.crianca), adminUid: S(uidA), adminUids: A([S(uidA)]),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(new Date(2026, 7, 5)),
  // Sem estes dois, o card do primeiro acesso e o tour cobrem o Início.
  tutorialDone: B(true), avisosPerguntadosEm: T(new Date(2026, 7, 5)),
  createdAt: T(new Date(2026, 7, 5)),
});

// A mensalidade ANTIGA, paga: fica com A e continua da família para ler.
await gravar(`payments/${T1.crianca}_${MES_ANTES}`, {
  adminUid: S(uidA), childId: S(T1.crianca), childName: S('Ana Clara Ribeiro'), parentUid: S(uidF),
  month: S(MES_ANTES), amount: N(380), status: S('paid'), paymentMethod: S('pix'),
  paidAt: T(new Date(mesAntes.getFullYear(), mesAntes.getMonth(), 8, 10)),
  dueDate: T(new Date(mesAntes.getFullYear(), mesAntes.getMonth(), 10)),
  createdAt: T(mesAntes),
});

console.log(JSON.stringify({ uidA, uidB, uidF, crianca: T1.crianca, mesDaMensalidade: MES_ANTES }));
console.log(`Semeado. Logins (senha ${SENHA}): ${T1.tioA.email} · ${T1.tioB.email} · ${T1.familia.email}`);
