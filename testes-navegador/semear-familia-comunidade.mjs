/**
 * SEMEIA A FAMÍLIA DA JORNADA R4 — FOTO DA TURMA E ESTRELAS (05/10/2026).
 *
 * Cria, direto nos emuladores: o Tio Zeca (motorista com primeiro acesso
 * completo e marca), a Sofia (criança ativa dele, contrato já aceito) e a
 * mãe dela, a Renata (responsável vinculada, termos aceitos, tour feito,
 * primeiro acesso completo). A Sofia nasce SEM `fotoDaTurmaConsentida` e a
 * Renata SEM avaliação do semestre: é o que faz as duas perguntas aparecerem
 * no Início dela. E uma foto da turma "para as famílias", válida, do tio.
 *
 * Idempotente: ids fixos, e o PATCH sem máscara SUBSTITUI o documento
 * inteiro — a resposta da foto da rodada anterior some junto. A nota do
 * semestre corrente é apagada.
 *
 * ⚠️ O tio não tem conta no Auth: a jornada é só da família, e o Firestore
 * só precisa do documento `users/{uid}` dele (marca, e o escopo das rules).
 * ⚠️ A foto é gravada pelo REST, com uma imagem em `data:` no `url`. No app
 * ela nasce pela callable `publicarFotoDaTurma`, depois de subir o arquivo ao
 * Storage — aqui pulamos os dois de propósito: a R4 mede o que a FAMÍLIA vê,
 * e a publicação é jornada do tio.
 * ⚠️ O "Agora não" da avaliação mora no localStorage do aparelho
 * (`alobuzinou:avaliacao-do-tio-adiada`), não no banco: quem zera é o perfil
 * próprio do Chrome (`perfis/mae-comunidade`). Se ele já tiver tocado o
 * "Agora não" numa rodada, apague a pasta do perfil.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 * Login: mae.comunidade@teste.local / senha-de-teste-123
 */
import { readFileSync } from 'node:fs';

const P = 'demo-alobuzinou';
const FS = `http://127.0.0.1:8085/v1/projects/${P}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const EMAIL = 'mae.comunidade@teste.local';
const SENHA = 'senha-de-teste-123';
// A versão dos termos vem do app: escrita à mão, a mãe cairia no reaceite.
const LEGAL = /export const LEGAL_VERSION = '([^']+)'/.exec(
  readFileSync(new URL('../src/pages/legal/legalContent.js', import.meta.url), 'utf8')
)[1];

const TIO = 'comTioZeca';
const CRIANCA = 'comSofia';
const FOTO = 'comFotoDiaDasCriancas';

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });
const A = (lista) => ({ arrayValue: { values: lista } });

/** "2026-2", em UTC — a mesma conta de `semestreDe` (dominio/identidade/comunidade.js). */
function semestreDe(d = new Date()) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1 <= 6 ? 1 : 2}`;
}

async function gravar(caminho, fields) {
  const r = await fetch(`${FS}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}

// A conta da mãe: cria; se já existe, entra para saber o uid.
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
const mae = r.localId;
if (!mae) throw new Error('Não consegui criar nem entrar na conta da mãe: ' + JSON.stringify(r));

const desde = new Date(2026, 6, 1);

// O tio: primeiro acesso completo (nome, WhatsApp, gênero, marca, cidade,
// dados do contrato) e a marca que aparece no cabeçalho dela.
await gravar(`users/${TIO}`, {
  role: S('admin'), email: S('tio.zeca@teste.local'), name: S('José Carlos Prado'),
  phone: S('(11) 97777-1234'), gender: S('male'), marcaNome: S('Tio Zeca'),
  city: S('São Paulo'), uf: S('SP'), companyName: S('José Carlos Prado'),
  companyDocument: S('123.456.789-09'), companyAddress: S('Rua das Acácias, 50, São Paulo'),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(desde),
  tutorialDone: B(true), pixKey: S('11977771234'), pixKeyType: S('phone'),
  criancasAtivas: I(1), createdAt: T(desde),
});

// A Sofia: ativa, com aniversário (senão o card do primeiro acesso pede) e
// o aceite antigo do contrato (`contractAcceptedAt`): `estadoDoContrato`
// responde "aceito" e o ParentContractGate deixa passar. Sem
// `fotoDaTurmaConsentida` — a pergunta precisa aparecer.
await gravar(`children/${CRIANCA}`, {
  adminUid: S(TIO), parentUid: S(mae), name: S('Sofia Ramos'), gender: S('female'),
  active: B(true), status: S('home'), birthDate: S('2018-04-12'),
  monthlyFee: N(380), dueDay: I(10), createdAt: T(desde),
  schoolName: S('EMEF Vila Olímpia'), school: S('EMEF Vila Olímpia'),
  parentName: S('Renata Ramos'), parentPhone: S('(11) 96666-4321'),
  address: S('Rua das Acácias, 120 — Vila Olímpia, São Paulo/SP'),
  lat: N(-23.5940), lng: N(-46.6850), horaPega: S('06:50'), horaEntrega: S('12:50'),
  period: S('morning'), pickupPeriod: S('morning'), dropoffPeriod: S('morning'),
  inviteStatus: S('used'), contractAcceptedAt: T(new Date(2026, 6, 2)),
  contractAcceptedByUid: S(mae), contractAcceptedName: S('Renata Ramos'),
});

// A mãe: termos aceitos, tour feito, nome e WhatsApp preenchidos e o passo
// dos avisos já visto (`avisosPerguntadosEm`) — `passosDoResponsavel` fica
// vazio e o card do primeiro acesso não cobre o Início.
await gravar(`users/${mae}`, {
  role: S('parent'), email: S(EMAIL), name: S('Renata Ramos'), phone: S('(11) 96666-4321'),
  childIds: A([S(CRIANCA)]), childId: S(CRIANCA), adminUid: S(TIO), adminUids: A([S(TIO)]),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(desde),
  tutorialDone: B(true), avisosPerguntadosEm: T(desde), createdAt: T(desde),
});

// Nenhuma nota neste semestre: a avaliação precisa aparecer no Início.
await fetch(`${FS}/avaliacoesDoTio/${TIO}_${mae}_${semestreDe()}`, { method: 'DELETE', headers: ADM });

// A foto da turma, "para as famílias", válida por mais 29 dias. `criancas`
// vazio: a Sofia ainda não deu o "sim" quando a semente roda.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#1f8a5b"/>' +
  '<text x="160" y="110" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">Turma do Tio Zeca</text></svg>';
await gravar(`fotosDaTurma/${FOTO}`, {
  adminUid: S(TIO), publico: S('familias'), criancas: A([]), epoca: S('Dia das Crianças'),
  legenda: S('Festa na perua'), caminho: S(`fotosDaTurma/${TIO}/semente.jpg`),
  url: S('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)),
  criadaEm: T(new Date()), expiraEm: T(new Date(Date.now() + 29 * 86400000)),
});

console.log(`Semeado. mãe=${mae}  tio=${TIO}  criança=${CRIANCA}  login: ${EMAIL} / ${SENHA}`);
