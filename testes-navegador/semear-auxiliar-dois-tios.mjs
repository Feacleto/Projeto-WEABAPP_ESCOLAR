/**
 * SEMEIA A AUXILIAR COM DOIS TIOS (05/10/2026, jornada A2 · item F4.6).
 *
 * Cria, direto nos emuladores: o Tio Nino (A) e a Tia Rosa (B), motoristas
 * com o primeiro acesso completo e marcas de cores diferentes; duas crianças
 * em cada perua, com horário; a Cida, auxiliar dos dois; os DOIS vínculos já
 * aceitos; e a cópia da turma de cada um.
 *
 * O VÍNCULO É POR PAR, e a forma vem do servidor, não da memória:
 * `auxiliares/{motoristaUid}_{auxiliarUid}` com os campos que
 * `aceitarConviteDeAuxiliar` grava (functions/lib/auxiliares.js) e
 * `periodos` aberto como `abrirPeriodo` (reguaDoAuxiliar.js). As rules
 * (`match /turmaDaAuxiliar`, o ramo da auxiliar no `allow get` de `users`)
 * abrem a turma e o doc do tio SÓ por esse id — é ele que tem que existir.
 * `users.motoristaUids` é a lista dos tios ativos (o `motoristaUid` singular
 * saiu com o vínculo por par).
 *
 * A CÓPIA DA TURMA é semeada à mão, com a lista fechada
 * `CAMPOS_DA_TURMA_DA_AUXILIAR`: no emulador sem functions os gatilhos
 * (`espelharCriancaParaAuxiliar`) não rodam, e a tela dela só lê a cópia.
 *
 * Idempotente: ids fixos; cada rodada volta todas as crianças para "Em casa",
 * apaga a viagem de hoje, a rota aberta e a senha dos pagamentos dela.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 * Login da auxiliar: cida.auxiliar@teste.local / senha-de-teste-123
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const P = 'demo-alobuzinou';
const RAIZ = 'http://127.0.0.1:8085/v1';
const FS = `${RAIZ}/projects/${P}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const SENHA = 'senha-de-teste-123';
// A versão dos termos vem do app: escrita à mão, a conta cairia no reaceite.
const LEGAL = /export const LEGAL_VERSION = '([^']+)'/.exec(
  readFileSync(new URL('../src/pages/legal/legalContent.js', import.meta.url), 'utf8')
)[1];
// A lista fechada vem do servidor: se ela mudar lá, a cópia daqui acompanha.
// Importada, não lida por regex: a régua é pura (sem SDK) e um comentário
// novo dentro do array já quebrou a leitura por texto (05/10/2026).
const CAMPOS = createRequire(import.meta.url)('../functions/lib/reguaDoAuxiliar.js').CAMPOS_DA_TURMA_DA_AUXILIAR;

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });
const NULO = { nullValue: null };
const ARR = (lista) => ({ arrayValue: { values: lista } });
const MAPA = (fields) => ({ mapValue: { fields } });

async function gravar(caminho, fields) {
  const r = await fetch(`${FS}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}
const apagar = (caminho) => fetch(`${FS}/${caminho}`, { method: 'DELETE', headers: ADM });
async function apagarColecao(caminho) {
  const lista = await fetch(`${FS}/${caminho}?pageSize=300`, { headers: ADM }).then((x) => x.json());
  for (const d of lista.documents || []) await fetch(`${RAIZ}/${d.name}`, { method: 'DELETE', headers: ADM });
}

/** Cria a conta; se já existe, entra para saber o uid. */
async function conta(email) {
  const corpo = JSON.stringify({ email, password: SENHA, returnSecureToken: true });
  const h = { 'Content-Type': 'application/json' };
  let r = await fetch(`${AUTH}/accounts:signUp?key=demo`, { method: 'POST', headers: h, body: corpo }).then((x) => x.json());
  if (!r.localId) r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, { method: 'POST', headers: h, body: corpo }).then((x) => x.json());
  if (!r.localId) throw new Error(`Não consegui criar nem entrar em ${email}: ${JSON.stringify(r)}`);
  return r.localId;
}

const TIOS = {
  A: {
    email: 'tio.nino.aux@teste.local', nome: 'Antônio Nino Ferreira', genero: 'male',
    marca: 'Tio Nino', cor: '#E8590C', pix: '11911112222', doc: '529.982.247-25',
    escola: ['a2EscolaA', 'EMEF Jardim Paulista', -23.5710, -46.6560],
    criancas: [
      ['a2Pedro', 'Pedro Lima', 'male', '06:40', '12:40'],
      ['a2Sofia', 'Sofia Reis', 'female', '06:50', '12:50'],
    ],
    aceitoEm: new Date(2026, 8, 1, 8),
  },
  B: {
    email: 'tia.rosa.aux@teste.local', nome: 'Rosa Maria Campos', genero: 'female',
    marca: 'Tia Rosa', cor: '#1971C2', pix: '11933334444', doc: '111.444.777-35',
    escola: ['a2EscolaB', 'EE Moema', -23.6010, -46.6650],
    criancas: [
      ['a2Theo', 'Theo Martins', 'male', '07:10', '13:10'],
      ['a2Alice', 'Alice Duarte', 'female', '07:20', '13:20'],
    ],
    aceitoEm: new Date(2026, 8, 15, 8),
  },
};
const AUX = { email: 'cida.auxiliar@teste.local', nome: 'Aparecida Souza', telefone: '11955556666' };

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const agora = new Date();
const mesPassado = (() => {
  const d = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

for (const t of Object.values(TIOS)) t.uid = await conta(t.email);
const auxUid = await conta(AUX.email);

// ── Os dois tios ────────────────────────────────────────────────────────
for (const [letra, t] of Object.entries(TIOS)) {
  await gravar(`users/${t.uid}`, {
    role: S('admin'), email: S(t.email), name: S(t.nome), phone: S(`(11) 9${letra === 'A' ? '1111' : '3333'}-0000`),
    gender: S(t.genero), marcaNome: S(t.marca), marcaCor: S(t.cor), city: S('São Paulo'), uf: S('SP'),
    companyName: S(t.nome), companyDocument: S(t.doc), companyAddress: S('Rua de teste, 10, São Paulo/SP'),
    termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(new Date(2026, 7, 1)),
    tutorialDone: B(true), pixKey: S(t.pix), pixKeyType: S('phone'),
    criancasAtivas: { integerValue: String(t.criancas.length) }, createdAt: T(new Date(2026, 7, 1)),
  });
  // A rota de ontem não pode estar aberta.
  await apagar(`liveLocation/${t.uid}`);

  const [escolaId, escolaNome, lat, lng] = t.escola;
  await gravar(`schools/${escolaId}`, {
    adminUid: S(t.uid), name: S(escolaNome), nome: S(escolaNome),
    address: S(`${escolaNome}, São Paulo/SP`), endereco: S(`${escolaNome}, São Paulo/SP`),
    lat: N(lat), lng: N(lng), createdAt: T(new Date(2026, 7, 1)),
  });

  // A cópia de antes sai inteira: criança de outra rodada não pode sobrar.
  await apagarColecao(`turmaDaAuxiliar/${t.uid}/criancas`);
  await apagarColecao(`turmaDaAuxiliar/${t.uid}/faltas`);
  await gravar(`turmaDaAuxiliar/${t.uid}`, { ativa: B(true) });

  let i = 0;
  for (const [id, nome, genero, pega, entrega] of t.criancas) {
    i += 1;
    // O doc INTEIRO, com o que a auxiliar NÃO pode ver (mensalidade, saúde,
    // endereço): é o que a cópia precisa deixar de fora.
    const crianca = {
      adminUid: S(t.uid), name: S(nome), gender: S(genero), active: B(true), status: S('home'),
      monthlyFee: N(380), dueDay: { integerValue: '10' }, saudeNotas: S('Alergia a amendoim'),
      school: S(escolaNome), schoolName: S(escolaNome), schoolId: S(escolaId),
      horaPega: S(pega), horaEntrega: S(entrega), period: S('morning'),
      pickupPeriod: S('morning'), dropoffPeriod: S('morning'),
      address: S(`Rua de teste, ${i}${letra === 'A' ? '0' : '5'} — São Paulo/SP`),
      lat: N(lat + 0.002 * i), lng: N(lng + 0.002 * i),
      parentName: S(`Responsável de ${nome.split(' ')[0]}`), parentPhone: S(`(11) 9${letra === 'A' ? '7777' : '8888'}-000${i}`),
      createdAt: T(new Date(2026, 7, 1)),
    };
    // PATCH sem máscara substitui o doc: some o `statusUpdatedAt` da rodada anterior.
    await gravar(`children/${id}`, crianca);
    await apagar(`children/${id}/rides/${hoje}`);
    const copia = {};
    for (const k of CAMPOS) if (crianca[k] !== undefined) copia[k] = crianca[k];
    await gravar(`turmaDaAuxiliar/${t.uid}/criancas/${id}`, copia);
  }
}

// ── A auxiliar e os dois vínculos ───────────────────────────────────────
await gravar(`users/${auxUid}`, {
  role: S('auxiliar'), name: S(AUX.nome), email: S(AUX.email), phone: S(AUX.telefone),
  motoristaUids: ARR([S(TIOS.A.uid), S(TIOS.B.uid)]),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(new Date(2026, 8, 1)),
  privacyAcceptedAt: T(new Date(2026, 8, 1)), createdAt: T(new Date(2026, 8, 1)),
});
for (const t of Object.values(TIOS)) {
  await gravar(`auxiliares/${t.uid}_${auxUid}`, {
    motoristaUid: S(t.uid), auxiliarUid: S(auxUid), nome: S(AUX.nome), telefone: S(AUX.telefone),
    valorMensal: NULO, marcaDoMotorista: S(t.marca), ativa: B(true), encerradoEm: NULO,
    aceitoEm: T(t.aceitoEm), periodos: ARR([MAPA({ de: T(t.aceitoEm), ate: NULO })]),
  });
  // Um recibo de cada tio no mês passado: a aba Pagamentos tem valor DENTRO,
  // e a jornada confere que ele não aparece sem a senha dela.
  await gravar(`pagamentosDaAuxiliar/${t.uid}_${auxUid}_${mesPassado}`, {
    motoristaUid: S(t.uid), auxiliarUid: S(auxUid), nomeDaAuxiliar: S(AUX.nome), mes: S(mesPassado),
    valor: N(t === TIOS.A ? 900 : 750), anotadoEm: T(new Date(agora.getFullYear(), agora.getMonth(), 2, 18)),
    recebidoEm: NULO,
  });
}
// Cada rodada começa sem a senha dos pagamentos: a aba abre na criação.
for (const c of ['configFinanceiro', 'senhasDoFinanceiro']) await apagar(`${c}/${auxUid}`);

const ids = { A: TIOS.A.uid, B: TIOS.B.uid, auxiliar: auxUid, hoje, mesPassado };
console.log(JSON.stringify(ids));
console.log(`Semeado. login da auxiliar: ${AUX.email} / ${SENHA}`);
