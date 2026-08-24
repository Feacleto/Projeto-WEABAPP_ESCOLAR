/**
 * Sondagem das Firestore Security Rules contra o banco DE VERDADE.
 *
 * POR QUE ISTO EM VEZ DE TESTE DE UNIDADE
 * O teste com @firebase/rules-unit-testing roda contra o emulador e exige
 * dependência nova nos dois package.json. Isto aqui usa só a API pública e o
 * `fetch` do node: sonda o ambiente REAL, com as contas reais, e responde a
 * pergunta que importa — "o que está publicado agora deixa passar?".
 *
 * As duas coisas não competem: teste de unidade pega regressão antes do
 * deploy, sondagem pega o que está no ar. Hoje só existe a segunda.
 *
 * O QUE ELE PROVA
 * Cada sonda é um furo real que foi fechado esta semana. Se alguma passar de
 * VERDE pra VERMELHO um dia, é porque a regra correspondente foi reaberta.
 *
 * SEGURANÇA DA PRÓPRIA SONDAGEM
 * As sondas de ESCRITA são desenhadas pra serem inócuas se derem certo — e o
 * script avisa alto se der, porque escrita que passa aqui é falha grave. A
 * sonda de auto-promoção grava num campo que já vale false; se ela passar, o
 * script reverte e grita.
 *
 * USO
 *   node scripts/auditar-regras.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

const CONTAS = {
  motorista: { email: 'motorista.teste@alobuzinou.com', senha: 'TesteTio2026!' },
  responsavel: { email: 'pai.teste@alobuzinou.com', senha: 'TestePai2026!' },
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

async function entrar({ email, senha }) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (j.error) throw new Error(`${email}: ${j.error.message}`);
  return { uid: j.localId, token: j.idToken };
}

async function anonimo() {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (j.error) return null; // login anônimo desligado no projeto
  return { uid: j.localId, token: j.idToken };
}

function auth(sessao) {
  return sessao ? { Authorization: `Bearer ${sessao.token}` } : {};
}

async function listar(colecao, sessao) {
  const r = await fetch(`${DOCS}${colecao}?pageSize=1`, { headers: auth(sessao) });
  return { ok: r.ok, status: r.status };
}

async function escrever(caminho, campos, sessao) {
  const i = caminho.lastIndexOf('/');
  const col = caminho.slice(0, i);
  const id = caminho.slice(i + 1);
  const r = await fetch(`${DOCS}${col}?documentId=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(sessao) },
    body: JSON.stringify({ fields: campos }),
  });
  return { ok: r.ok, status: r.status };
}

async function atualizar(caminho, campos, sessao) {
  const mask = Object.keys(campos).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const r = await fetch(`${DOCS}${caminho}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth(sessao) },
    body: JSON.stringify({ fields: campos }),
  });
  return { ok: r.ok, status: r.status };
}

/**
 * Consulta com filtro de igualdade — o `runQuery` do Firestore.
 *
 * Precisou existir porque as sondas de escopo não são sobre "pode ler o
 * documento X", são sobre "a CONSULTA prova o escopo". `listar()` acima faz
 * GET na coleção, que é justamente a consulta SEM filtro: serve pra provar a
 * negativa, e nunca conseguiria provar a positiva.
 */
async function consultar(colecao, campo, valor, sessao) {
  const r = await fetch(`${DOCS.replace(/\/$/, '')}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(sessao) },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: {
          fieldFilter: {
            field: { fieldPath: campo },
            op: 'EQUAL',
            value: { stringValue: valor },
          },
        },
        limit: 1,
      },
    }),
  });
  return { ok: r.ok, status: r.status };
}

async function apagar(caminho, sessao) {
  const r = await fetch(`${DOCS}${caminho}`, {
    method: 'DELETE',
    headers: auth(sessao),
  });
  return { ok: r.ok, status: r.status };
}

const resultados = [];
function registrar(nome, passou, detalhe) {
  resultados.push({ nome, passou, detalhe });
  console.log(`${passou ? '  OK  ' : ' FALHA'} ${nome}${detalhe ? '  — ' + detalhe : ''}`);
}

async function main() {
  console.log('\nSondagem das rules — ambiente REAL (' + PID + ')\n');

  const anon = await anonimo();
  const tio = await entrar(CONTAS.motorista);
  const pai = await entrar(CONTAS.responsavel);

  console.log('sessão anônima: ' + (anon ? 'criada (login anônimo LIGADO)' : 'indisponível'));
  console.log('');

  // ── 1. anônimo não lê a posição ao vivo da perua ────────────────────────
  // Era o pior furo da semana: visitante criava users/{uid} e passava a ler
  // isto, que é onde a van está com as crianças dentro.
  if (anon) {
    const r = await listar('liveLocation', anon);
    registrar('anônimo NÃO lê liveLocation', !r.ok, 'HTTP ' + r.status);
  } else {
    registrar('anônimo NÃO lê liveLocation', true, 'login anônimo desligado');
  }

  // ── 2. anônimo não lista crianças ───────────────────────────────────────
  // O doc tem nome, endereço de casa, escola e telefone do responsável.
  if (anon) {
    const r = await listar('children', anon);
    registrar('anônimo NÃO lista children', !r.ok, 'HTTP ' + r.status);
  } else {
    registrar('anônimo NÃO lista children', true, 'login anônimo desligado');
  }

  // ── 3. anônimo não cria o próprio doc de usuário ────────────────────────
  // Este era o passo 1 da escalada de privilégio.
  if (anon) {
    const r = await escrever(
      `users/${anon.uid}`,
      { role: { stringValue: 'parent' }, childIds: { arrayValue: { values: [] } } },
      anon
    );
    registrar('anônimo NÃO cria users/{uid}', !r.ok, 'HTTP ' + r.status);
    if (r.ok) console.log('     !!! ESCALADA REABERTA — apague users/' + anon.uid);
  } else {
    registrar('anônimo NÃO cria users/{uid}', true, 'login anônimo desligado');
  }

  // ── 4. responsável sem perfil não lê crianças ───────────────────────────
  // Conta autenticada mas sem doc em users/ não é usuário do app.
  {
    const r = await listar('children', pai);
    registrar('conta sem perfil NÃO lista children', !r.ok, 'HTTP ' + r.status);
  }

  // ── 5. o motorista lê as próprias crianças ──────────────────────────────
  // O oposto: a regra tem que DEIXAR o trabalho acontecer.
  {
    const r = await listar('children', tio);
    // OBSOLETA DESDE O ESCOPO POR MOTORISTA — agora ela testa o CONTRÁRIO.
    //
    // Esta sonda nasceu quando `children` era `if isAdmin()`: listar a
    // coleção inteira era o comportamento certo, e o 200 provava que a regra
    // deixava o trabalho acontecer. Com `adminUid`, listar SEM filtro passou
    // a ser exatamente o que não pode — e é o que a sonda 12 verifica.
    //
    // Duas sondas testando o mesmo gesto com expectativas opostas é pior que
    // uma só: uma delas vai estar sempre vermelha, e a vermelha permanente é
    // a que ensina a ignorar o relatório. Quem prova a positiva agora é a
    // sonda 11, que consulta COM o filtro de escopo.
    registrar(
      'motorista NÃO lista children sem filtro (era a sonda 5)',
      !r.ok,
      'HTTP ' + r.status
    );
  }

  // ── 6. motorista não se auto-promove a dono ─────────────────────────────
  // `superAdmin` abre o /admin, que mostra o negócio inteiro da plataforma.
  {
    const r = await atualizar(
      `users/${tio.uid}`,
      { superAdmin: { booleanValue: true } },
      tio
    );
    registrar('motorista NÃO grava superAdmin em si', !r.ok, 'HTTP ' + r.status);
    if (r.ok) {
      console.log('     !!! AUTO-PROMOÇÃO PASSOU — revertendo agora');
      await atualizar(`users/${tio.uid}`, { superAdmin: { booleanValue: false } }, tio);
    }
  }

  // ── 7. motorista não muda o próprio papel ───────────────────────────────
  {
    const r = await atualizar(`users/${tio.uid}`, { role: { stringValue: 'parent' } }, tio);
    registrar('motorista NÃO troca o próprio role', !r.ok, 'HTTP ' + r.status);
    if (r.ok) {
      console.log('     !!! TROCA DE PAPEL PASSOU — revertendo agora');
      await atualizar(`users/${tio.uid}`, { role: { stringValue: 'admin' } }, tio);
    }
  }

  // ── 8. bônus de entrada é só de leitura pro dono dele ───────────────────
  {
    const r = await escrever(
      `entryBonuses/${tio.uid}`,
      { meses: { integerValue: '4' } },
      tio
    );
    registrar('motorista NÃO grava o próprio bônus', !r.ok, 'HTTP ' + r.status);
    if (r.ok) console.log('     !!! A ROLETA VIROU CAMPO EDITÁVEL');
  }

  // ── 9. depoimento público não é editável nem pelo autor ─────────────────
  {
    const r = await escrever(
      'feedbacks/sonda-auditoria',
      { uid: { stringValue: tio.uid }, allowTestimonial: { booleanValue: true } },
      tio
    );
    // create é permitido (é assim que se avalia); o que não pode é editar
    // depois. Se criou, apagamos não dá — delete é false. Então só reportamos.
    registrar(
      'feedbacks aceita criar (esperado)',
      true,
      r.ok ? 'criou sonda-auditoria — apague pelo console' : 'HTTP ' + r.status
    );
  }

  // ── 10. config da plataforma é do DONO, não do motorista ───────────────
  //
  // `platformConfig/*` guarda interruptor que vale pra plataforma inteira (a
  // janela de avaliação hoje; o que vier depois). A regra é `write: if
  // isOwner()`.
  //
  // O motorista é a sonda certa aqui — e não o responsável — porque ele é o
  // papel que QUASE passa: no código inteiro `role: 'admin'` significa
  // motorista, e foi exatamente por isso que este documento não foi parar em
  // `appState/init`, cuja regra é `allow update: if isAdmin()`. Se algum dia
  // alguém "simplificar" movendo isto pra lá, esta linha fica vermelha no
  // mesmo dia.
  //
  // Grava `reviewOpen: false` porque falso é o estado seguro: se a sonda
  // passar (ruim), o efeito colateral é fechar a janela de avaliação, não
  // abrir. Mesma doutrina da sonda de superAdmin.
  //
  // Passa nos dois mundos — com a regra publicada, `isOwner()` barra; sem
  // ela, o default nega. É guarda de superfície, não detector de deploy.
  {
    const r = await atualizar(
      'platformConfig/app',
      { reviewOpen: { booleanValue: false } },
      tio
    );
    registrar(
      'motorista NÃO escreve config da plataforma',
      !r.ok,
      'HTTP ' + r.status
    );
    if (r.ok) {
      console.log('     !!! UM PARCEIRO MANDA NA PLATAFORMA INTEIRA');
    }
  }

  // ── 11. o motorista LÊ as próprias crianças (sonda POSITIVA) ───────────
  //
  // POR QUE UMA POSITIVA IMPORTA AQUI
  // Sonda negativa passa verde com ou sem a regra publicada: sem regra, o
  // default nega, e o verde não prova nada sobre o deploy. Esta é a única do
  // bloco que EXIGE a regra no ar — e ela também pega o backfill esquecido,
  // porque consulta por `adminUid`, o campo que o backfill escreve.
  {
    const r = await consultar('children', 'adminUid', tio.uid, tio);
    registrar(
      'motorista LÊ as próprias crianças (escopo publicado)',
      r.ok,
      'HTTP ' + r.status
    );
  }

  // ── 12. consulta SEM escopo é recusada inteira ─────────────────────────
  // O outro lado da moeda: sem o filtro por `adminUid`, o Firestore não
  // devolve "as que ele pode ver" — devolve erro. É por isso que toda tela
  // do motorista teve que passar a filtrar.
  {
    const r = await listar('children', tio);
    registrar('motorista NÃO lista children sem escopo', !r.ok, 'HTTP ' + r.status);
  }

  // ── 13. motorista não cadastra criança na conta de outro ───────────────
  // Sem o `adminUid == request.auth.uid` no create, dava pra nascer dado já
  // fora do alcance de quem ele pertence — e o dono legítimo nunca saberia.
  {
    const id = `sonda-escopo-${tio.uid.slice(0, 6)}`;
    const r = await escrever(
      `children/${id}`,
      {
        name: { stringValue: 'SONDA — apague se aparecer' },
        adminUid: { stringValue: 'uid-de-outro-motorista' },
        active: { booleanValue: false },
      },
      tio
    );
    registrar(
      'motorista NÃO cria criança de outro motorista',
      !r.ok,
      'HTTP ' + r.status
    );
    if (r.ok) {
      console.log('     !!! DADO NASCENDO NA CONTA DE OUTRO PARCEIRO');
      await apagar(`children/${id}`, tio);
    }
  }

  // ── 14. motorista não levanta a própria suspensão ──────────────────────
  // Suspensão que o suspenso desfaz não é suspensão. `suspenso` está fora do
  // que o próprio usuário escreve: quem mexe é o dono.
  {
    // ESCREVE `true`, NÃO `false` — e a diferença é a sonda inteira.
    //
    // A versão anterior gravava `false` num campo que já valia `false`. Isso
    // é diff VAZIO, e diff vazio nenhuma regra bloqueia: `affectedKeys()`
    // devolve conjunto vazio, `hasAny([...])` dá falso, e a escrita passa —
    // corretamente, porque nada mudou. A sonda lia esse 200 e gritava
    // "O SUSPENSO SE DESSUSPENDE" todo dia, contra uma regra que funciona.
    //
    // Sonda que grita sem motivo é pior que sonda que não existe: ensina a
    // ignorar o alarme, e aí o dia em que ele for de verdade ninguém olha.
    //
    // `true` é mudança real e é o gesto que importa — o motorista SUSPENSO
    // tentando mexer no próprio estado. Fica `true` se passar, e aí o grito
    // é justo.
    const r = await atualizar(
      `users/${tio.uid}`,
      { suspenso: { booleanValue: true } },
      tio
    );
    registrar(
      'motorista NÃO escreve o próprio `suspenso`',
      !r.ok,
      'HTTP ' + r.status
    );
    if (r.ok) console.log('     !!! O SUSPENSO SE DESSUSPENDE');
  }

  // ── 15. motorista não provisiona conta ─────────────────────────────────
  // Criar `users/{outro}` é poder do DONO (fila de parceiros). Na mão do
  // parceiro, seria criar motorista — ou criar um doc pra um uid alheio.
  {
    const alvo = `sonda-provisionamento-${tio.uid.slice(0, 6)}`;
    const r = await escrever(
      `users/${alvo}`,
      {
        role: { stringValue: 'admin' },
        name: { stringValue: 'SONDA — apague se aparecer' },
        createdAt: { timestampValue: new Date().toISOString() },
        provisionedBy: { stringValue: tio.uid },
      },
      tio
    );
    registrar('motorista NÃO provisiona conta', !r.ok, 'HTTP ' + r.status);
    if (r.ok) {
      console.log('     !!! PARCEIRO CRIANDO CONTA DE MOTORISTA');
      await apagar(`users/${alvo}`, tio);
    }
  }

  const falhas = resultados.filter((r) => !r.passou);
  console.log('');
  console.log('─'.repeat(60));
  if (falhas.length === 0) {
    console.log(`${resultados.length} sondas, nenhuma falha.`);
  } else {
    console.log(`${falhas.length} FALHA(S) de ${resultados.length}:`);
    for (const f of falhas) console.log('  - ' + f.nome);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('\nFALHOU: ' + e.message);
  process.exit(1);
});
