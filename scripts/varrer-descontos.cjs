/**
 * VARRE `users` PROCURANDO OS DESCONTOS QUE A RÉGUA VAI DEIXAR DE RECONHECER.
 *
 * ── POR QUE ISTO EXISTE, E POR QUE ELE VEM ANTES DO CORTE
 * Três instrumentos de desconto estão sendo apagados da régua por não terem
 * mais nenhum usuário previsto:
 *
 *   `origem: 'antecipacao'`     o nome antigo do fechamento, quando era 50% fixo
 *   `origem: 'roleta'`          apagada em 07/09/2026 — o critério dela era sorte
 *   `condicaoFundador: 'metade'` as doze vagas nunca concedidas
 *
 * ⚠️ **A FALHA DE APAGAR CEDO DEMAIS É SILENCIOSA.** Nenhum erro aparece em
 * lugar nenhum: `descontosVigentes` simplesmente para de somar aquela origem,
 * a fatura do mês seguinte sai maior, e a primeira pessoa a descobrir é o
 * motorista — que vai perguntar por que a conta dele subiu sem ninguém ter
 * avisado. Num produto em que o desconto é o argumento de venda, essa é a
 * conversa mais cara que existe.
 *
 * O CLAUDE.md já registrava essa pendência para a roleta desde 07/09/2026
 * ("confira `users.descontos` antes de considerar a remoção terminada"), e
 * ela nunca foi conferida. Este script é a conferência, das três de uma vez.
 *
 * ── SÓ LÊ. NÃO ESCREVE NADA, E NÃO TEM FLAG PARA ESCREVER.
 * O que fazer com o que ele achar é decisão de quem lê o relatório: migrar a
 * origem, converter em concessão com prazo, ou manter o instrumento vivo. Um
 * script que "conserta sozinho" um desconto de alguém é a mesma classe de erro
 * que ele veio evitar.
 *
 * ── COMO USAR
 *   VARRER_EMAIL=dono@exemplo.com VARRER_SENHA=... node scripts/varrer-descontos.cjs
 *
 * Precisa da conta do DONO: `users` só é legível inteiro por ela. Com uma
 * conta de motorista o script sai com `permission-denied`, que é a rule
 * fazendo o trabalho dela.
 *
 * EMULADOR: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
 * FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` — os endereços mudam sozinhos.
 *
 * Node puro e REST, sem `firebase-admin`: é o padrão dos outros scripts desta
 * pasta, e evita que a manutenção precise de uma chave de serviço.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

/** As origens que saem da régua. `fechamento` e `concessao` FICAM. */
const ORIGENS_CONDENADAS = ['antecipacao', 'roleta'];
/** A condição de fundador que sai. `vitalicio` FICA — é contrato assinado. */
const FUNDADOR_CONDENADO = 'metade';

function lerEnv() {
  const bruto = fs.readFileSync(path.join(RAIZ, '.env'), 'utf8');
  const env = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const i = linha.indexOf('=');
    if (i > 0 && !linha.trim().startsWith('#')) {
      env[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return env;
}

function endereços(projectId) {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return {
    docs: fsHost
      ? `http://${fsHost}/v1/projects/${projectId}/databases/(default)/documents/`
      : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`,
    identity: authHost
      ? `http://${authHost}/identitytoolkit.googleapis.com/v1/`
      : 'https://identitytoolkit.googleapis.com/v1/',
    emulando: !!fsHost,
  };
}

async function entrar(identity, apiKey, email, senha) {
  const r = await fetch(`${identity}accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`login de ${email}: ${j.error.message}`);
  return { uid: j.localId, token: j.idToken };
}

async function listar(docs, token, colecao) {
  const out = [];
  let pageToken = '';
  do {
    const url =
      `${docs}${colecao}?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.error) throw new Error(`listar ${colecao}: ${j.error.message}`);
    for (const d of j.documents || []) out.push(d);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

/**
 * O formato REST do Firestore aninha tudo em `{tipo: valor}`. Isto desembrulha
 * só o que este script precisa ler — um array de mapas.
 */
function lerDescontos(doc) {
  const bruto = doc.fields && doc.fields.descontos;
  const itens = (bruto && bruto.arrayValue && bruto.arrayValue.values) || [];
  return itens.map((v) => {
    const f = (v.mapValue && v.mapValue.fields) || {};
    return {
      origem: f.origem && f.origem.stringValue,
      fracao:
        (f.fracao && (f.fracao.doubleValue ?? f.fracao.integerValue)) ?? null,
      // `ate: null` é vitalício e `ate` ausente é descartado — a distinção é
      // estrita na régua, então o relatório precisa saber diferenciar.
      ate:
        f.ate === undefined
          ? '(ausente)'
          : f.ate.nullValue !== undefined
            ? 'null (vitalício)'
            : f.ate.stringValue,
    };
  });
}

function nomeDe(doc) {
  const f = doc.fields || {};
  return (
    (f.marcaNome && f.marcaNome.stringValue) ||
    (f.name && f.name.stringValue) ||
    (f.email && f.email.stringValue) ||
    '(sem nome)'
  );
}

async function main() {
  const env = lerEnv();
  const KEY = env.VITE_FIREBASE_API_KEY;
  const PID = env.VITE_FIREBASE_PROJECT_ID;
  if (!KEY || !PID) throw new Error('Faltam VITE_FIREBASE_* no .env');

  const email = process.env.VARRER_EMAIL;
  const senha = process.env.VARRER_SENHA;
  if (!email || !senha) {
    console.error(
      'Faltam as credenciais do DONO.\n' +
        '  VARRER_EMAIL=... VARRER_SENHA=... node scripts/varrer-descontos.cjs'
    );
    process.exit(1);
  }

  const { docs, identity, emulando } = endereços(PID);
  console.log(`\nAlvo: ${emulando ? 'EMULADOR' : 'PRODUÇÃO'} (${PID})`);

  const sessao = await entrar(identity, KEY, email, senha);
  console.log(`Autenticado como ${email}\n`);

  const usuarios = await listar(docs, sessao.token, 'users');
  console.log(`${usuarios.length} documentos em 'users'.\n`);

  const achados = { antecipacao: [], roleta: [], metade: [], outras: [] };

  for (const doc of usuarios) {
    const id = doc.name.split('/').pop();
    const quem = `${nomeDe(doc)}  (${id})`;

    const condicao =
      doc.fields &&
      doc.fields.condicaoFundador &&
      doc.fields.condicaoFundador.stringValue;
    if (condicao === FUNDADOR_CONDENADO) achados.metade.push(quem);

    for (const d of lerDescontos(doc)) {
      if (!d.origem) continue;
      const linha = `${quem}  —  fração ${d.fracao}, até ${d.ate}`;
      if (ORIGENS_CONDENADAS.includes(d.origem)) {
        achados[d.origem].push(linha);
      } else if (!['fechamento', 'concessao'].includes(d.origem)) {
        // ⚠️ ORIGEM DESCONHECIDA JÁ É ACHADO. `descontosVigentes` ignora o que
        // não reconhece — em silêncio —, então um desconto com origem escrita
        // errada nunca valeu e ninguém foi avisado.
        achados.outras.push(`${linha}  [origem '${d.origem}']`);
      }
    }
  }

  const secao = (titulo, lista, nota) => {
    console.log(`── ${titulo}: ${lista.length}`);
    lista.forEach((l) => console.log(`   ${l}`));
    if (!lista.length) console.log('   nenhum');
    if (nota && lista.length) console.log(`   ⚠️ ${nota}`);
    console.log('');
  };

  secao(
    "descontos com origem 'antecipacao'",
    achados.antecipacao,
    'apagar ORIGEM.ANTECIPACAO faria a fatura destes subirem. Migre para \'fechamento\' antes.'
  );
  secao(
    "descontos com origem 'roleta'",
    achados.roleta,
    'a régua já NÃO os reconhece — estes já deixaram de valer, em silêncio.'
  );
  secao(
    "motoristas com condicaoFundador 'metade'",
    achados.metade,
    'apagar FUNDADOR.METADE tiraria 50% da conta destes. Converta em concessão registrada antes.'
  );
  secao(
    'descontos com origem fora da régua',
    achados.outras,
    'estes nunca valeram: descontosVigentes ignora o que não reconhece.'
  );

  const total =
    achados.antecipacao.length +
    achados.roleta.length +
    achados.metade.length +
    achados.outras.length;

  console.log('─'.repeat(64));
  if (total === 0) {
    console.log('  Nada encontrado. O corte da régua pode seguir.');
  } else {
    console.log(`  ${total} caso(s). O corte NÃO deve seguir antes de resolvê-los.`);
  }
  console.log('─'.repeat(64) + '\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n' + (e && e.message ? e.message : e) + '\n');
  process.exit(1);
});
