/**
 * SEMEIA OS DOIS MOTORISTAS DO TESTE DA "SUA PERUA" (03/10/2026).
 *
 * 1. O Seu Beto, com história: turma de cinco crianças (contratos que
 *    VENCEM daqui a ~45 dias, para a renovação aparecer em destaque),
 *    mensalidades do mês e DOZE MESES de despesas — combustível com litros,
 *    posto e tanque cheio (o preço do diesel subindo de R$ 5,80 para
 *    R$ 6,40), manutenção a cada três meses e o salário da auxiliar. Um mês
 *    ficou SEM combustível de propósito: é o aviso âmbar do "Preciso
 *    aumentar?". A perua dele já é Diesel S10 e há dois postos guardados.
 * 2. O novato, com o primeiro acesso completo e NADA mais — nem turma, nem
 *    despesa, nem combustível escolhido.
 *
 * Idempotente: ids fixos, e cada rodada APAGA as despesas que a jornada
 * anterior lançou (as do `addExpense` têm id aleatório) e o
 * `configFinanceiro` / `senhasDoFinanceiro` dos dois — toda rodada começa da
 * primeira vez na senha, sem plano da troca e sem nada anotado.
 *
 * ⚠️ Só fala com o emulador (`demo-alobuzinou`). Nada aqui toca produção.
 * Logins:  perua.beto@teste.local / senha-de-teste-123
 *          perua.novato@teste.local / senha-de-teste-123
 */
const P = 'demo-alobuzinou';
const RAIZ = `http://127.0.0.1:8085/v1/projects/${P}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const SENHA = 'senha-de-teste-123';
export const BETO = 'perua.beto@teste.local';
export const NOVATO = 'perua.novato@teste.local';

// A versão dos termos é lida do app: semear com a velha cai na tela de
// "Atualização dos termos" e a jornada nunca chega ao Financeiro.
import { readFileSync } from 'node:fs';
const LEGAL = readFileSync(new URL('../src/pages/legal/legalContent.js', import.meta.url), 'utf8').match(/LEGAL_VERSION\s*=\s*'([^']+)'/)[1];

const S = (v) => ({ stringValue: v });
const N = (v) => ({ doubleValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (d) => ({ timestampValue: d.toISOString() });
const NULO = { nullValue: null };
const M = (fields) => ({ mapValue: { fields } });
const A = (values) => ({ arrayValue: { values } });

async function gravar(caminho, fields) {
  const r = await fetch(`${RAIZ}/${caminho}`, { method: 'PATCH', headers: ADM, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}
const apagar = (caminho) => fetch(`${RAIZ}/${caminho}`, { method: 'DELETE', headers: ADM });

async function contaDe(email) {
  const corpo = JSON.stringify({ email, password: SENHA, returnSecureToken: true });
  const h = { 'Content-Type': 'application/json' };
  let r = await fetch(`${AUTH}/accounts:signUp?key=demo`, { method: 'POST', headers: h, body: corpo }).then((x) => x.json());
  if (!r.localId) {
    r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, { method: 'POST', headers: h, body: corpo }).then((x) => x.json());
  }
  if (!r.localId) throw new Error(`Não consegui criar nem entrar em ${email}: ` + JSON.stringify(r));
  return r.localId;
}

/** Apaga TODAS as despesas do motorista (as fixas voltam logo depois). */
async function limparDespesas(uid) {
  const r = await fetch(`${RAIZ}:runQuery`, {
    method: 'POST',
    headers: ADM,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'expenses' }],
        where: { fieldFilter: { field: { fieldPath: 'adminUid' }, op: 'EQUAL', value: S(uid) } },
      },
    }),
  }).then((x) => x.json());
  let n = 0;
  for (const linha of r) {
    if (!linha.document) continue;
    await fetch(`http://127.0.0.1:8085/v1/${linha.document.name}`, { method: 'DELETE', headers: ADM });
    n += 1;
  }
  return n;
}

const perfil = (email, nome, marca) => ({
  role: S('admin'), email: S(email), name: S(nome), phone: S('(11) 97777-1234'),
  gender: S('male'), marcaNome: S(marca), city: S('São Paulo'), uf: S('SP'), regiao: S('Vila Olímpia'),
  termsVersion: S(LEGAL), privacyVersion: S(LEGAL), termsAcceptedAt: T(new Date(2026, 8, 1)),
  tutorialDone: B(true), pixKey: S('11977771234'), pixKeyType: S('phone'),
  createdAt: T(new Date(2025, 9, 1)),
});

const agora = new Date();
const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Dia `d` do mês `atras` meses antes do atual, sem passar de hoje. */
const diaDoMes = (atras, d, h = 9) => {
  const data = new Date(agora.getFullYear(), agora.getMonth() - atras, d, h);
  return data > agora ? new Date(agora.getFullYear(), agora.getMonth(), Math.max(1, agora.getDate() - 1), h) : data;
};

// ── 1. O Seu Beto ──────────────────────────────────────────────────────
const beto = await contaDe(BETO);
for (const c of ['configFinanceiro', 'senhasDoFinanceiro']) await apagar(`${c}/${beto}`);
const apagadasBeto = await limparDespesas(beto);

await gravar(`users/${beto}`, { ...perfil(BETO, 'Roberto Carlos Nunes', 'Perua do Beto'), criancasAtivas: I(5) });

// A perua já é Diesel S10 e há dois postos na memória (vistos há 3 e 10 dias).
await gravar(`configFinanceiro/${beto}`, {
  combustivelDaPerua: S('diesel_s10'),
  postos: A([
    M({ nome: S('Posto Shell Vila Olímpia'), preco: N(6.39), tipo: S('diesel_s10'), vistoEm: T(new Date(agora.getTime() - 3 * 864e5)) }),
    M({ nome: S('Ipiranga da Marginal'), preco: N(6.29), tipo: S('diesel_s10'), vistoEm: T(new Date(agora.getTime() - 10 * 864e5)) }),
  ]),
});

const fimDoContrato = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 45);
const inicioDoContrato = new Date(fimDoContrato.getFullYear() - 1, fimDoContrato.getMonth(), fimDoContrato.getDate() + 1);
const criancas = [
  ['peruaAna', 'Ana Beatriz Souza', 480, 10],
  ['peruaCaio', 'Caio Henrique Lima', 480, 10],
  ['peruaDuda', 'Maria Eduarda Reis', 450, 5],
  ['peruaEnzo', 'Enzo Gabriel Prado', 480, 15],
  ['peruaLivia', 'Lívia Martins', 500, 10],
];
for (const [id, nome, valor, venc] of criancas) {
  await gravar(`children/${id}`, {
    adminUid: S(beto), name: S(nome), monthlyFee: N(valor), dueDay: I(venc), active: B(true),
    status: S('home'), createdAt: T(new Date(2025, 9, 20)), schoolName: S('Colégio Vila Olímpia'),
    parentName: S('Responsável de ' + nome.split(' ')[0]), parentPhone: S('(11) 91234-5678'),
    vigenciaInicio: S(iso(inicioDoContrato)), vigenciaFim: S(iso(fimDoContrato)),
  });
}
const mes = mk(agora);
for (const [cid, nome, valor, venc] of criancas) {
  const pago = cid !== 'peruaEnzo';
  await gravar(`payments/${cid}_${mes}`, {
    adminUid: S(beto), childId: S(cid), childName: S(nome), parentUid: NULO, month: S(mes),
    amount: N(valor), status: S(pago ? 'paid' : 'pending'), paymentMethod: pago ? S('pix') : NULO,
    paidAt: pago ? T(diaDoMes(0, 2, 8)) : NULO, dueDate: T(new Date(agora.getFullYear(), agora.getMonth(), venc)),
    createdAt: T(diaDoMes(0, 1, 0)),
  });
}

// 12 meses (11 atrás até o atual). O preço do litro sobe ~R$ 0,05 por mês.
const MES_SEM_COMBUSTIVEL = 5;
const postos = ['Posto Shell Vila Olímpia', 'Ipiranga da Marginal'];
let n = 0;
const despesa = async (cat, valor, desc, data, extra = {}) => {
  n += 1;
  await gravar(`expenses/perua${String(n).padStart(3, '0')}`, {
    adminUid: S(beto), category: S(cat), amount: N(valor), description: S(desc),
    date: T(data), monthKey: S(mk(data)), createdAt: T(data), ...extra,
  });
};
for (let atras = 11; atras >= 0; atras -= 1) {
  const preco = Math.round((5.8 + (11 - atras) * 0.055) * 100) / 100;
  if (atras !== MES_SEM_COMBUSTIVEL) {
    // Dois abastecimentos por mês (no mês atual, só os que já aconteceram).
    const dias = atras === 0 ? [1, 2] : [5, 19];
    for (const [k, d] of dias.entries()) {
      const litros = k === 0 ? 62 + (atras % 3) : 41.5;
      await despesa('fuel', Math.round(litros * preco * 100) / 100, '', diaDoMes(atras, d, 7), {
        litros: N(litros), tipoCombustivel: S('diesel_s10'), posto: S(postos[k]), tanqueCheio: B(k === 0),
      });
    }
  }
  if (atras > 0) await despesa('monitor', 900 + (11 - atras) * 10, 'Salário da Cida', diaDoMes(atras, 1, 10));
  if (atras % 3 === 1) await despesa('maintenance', 380 + (11 - atras) * 30, 'Revisão e pneu', diaDoMes(atras, 12));
}

// ── 2. O novato ────────────────────────────────────────────────────────
const novato = await contaDe(NOVATO);
for (const c of ['configFinanceiro', 'senhasDoFinanceiro']) await apagar(`${c}/${novato}`);
const apagadasNovato = await limparDespesas(novato);
await gravar(`users/${novato}`, { ...perfil(NOVATO, 'Nelson Vieira Santos', 'Transporte do Nelson'), criancasAtivas: I(0) });

console.log(
  `Semeado. Beto uid=${beto} (${n} despesas; ${apagadasBeto} apagadas antes) · ` +
    `novato uid=${novato} (${apagadasNovato} apagadas antes). Senha: ${SENHA}`
);
