/**
 * TESTE DAS REGRAS DO STORAGE, CONTRA O EMULADOR.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `storage.rules` guarda foto de criança, comprovante bancário, logo da marca
 * e agora o contrato de papel de cada família — e não tinha teste nenhum. O
 * `testar-regras.mjs` cobre só o Firestore, então toda a auditoria do projeto
 * passava ao largo desses caminhos.
 *
 * E o risco ali é da mesma classe que já mordeu o Firestore: os caminhos são
 * DETERMINÍSTICOS (`childPhotos/{childId}`, `contratosAnteriores/{childId}`).
 * Quem souber um id alcança o arquivo, então uma regra frouxa não é "leitura
 * ampla" — é o contrato e a foto da criança de um concorrente a uma URL de
 * distância. Foi exatamente o furo do `paymentReceipts`.
 *
 * COMO RODAR
 *   npx firebase emulators:start --only auth,firestore,storage
 *   node scripts/testar-storage.mjs
 *
 * AS REGRAS DE STORAGE LEEM O FIRESTORE (`firestore.get(...)`), então o
 * emulador do Firestore precisa estar de pé junto e o cenário é semeado lá.
 * Sem isso as regras negam tudo e o relatório fica verde pelo motivo errado —
 * que é a armadilha que o teste de Firestore já documenta.
 *
 * CADA CASO TEM SONDA POSITIVA E NEGATIVA, pela mesma razão de lá: negativa
 * sozinha passa verde até com o `match` inteiro apagado.
 */
const PID = 'projeto-tio-nino-digital';
const BUCKET = `${PID}.firebasestorage.app`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
const FS = `http://127.0.0.1:8085/v1/projects/${PID}/databases/(default)/documents`;
const ST = `http://127.0.0.1:9199/v0/b/${BUCKET}/o`;

const ADM = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const S = (v) => ({ stringValue: v });
const B = (v) => ({ booleanValue: v });

let ok = 0;
let bad = 0;
const falhas = [];

function checar(bloco, nome, esperado, status) {
  const passou = esperado === 'PASSA' ? status < 300 : status >= 300;
  console.log(
    `${passou ? '  ok ' : ' FALHA'} ${nome.padEnd(52)} ${esperado.padEnd(5)} → ${status}`
  );
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`[${bloco}] ${nome} — esperado ${esperado}, veio ${status}`);
  }
}

async function criarLogin(email) {
  const r = await fetch(`${AUTH}:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha123', returnSecureToken: true }),
  });
  const d = await r.json();
  if (!d.idToken) throw new Error(`login falhou pra ${email}: ${JSON.stringify(d)}`);
  return { uid: d.localId, t: d.idToken };
}

const semear = (caminho, fields) =>
  fetch(`${FS}/${caminho}`, {
    method: 'PATCH',
    headers: ADM,
    body: JSON.stringify({ fields }),
  });

/** Sobe 1 pixel de JPEG. O conteúdo não importa; o content-type sim. */
const enviar = (caminho, sessao, tipo = 'image/jpeg') =>
  fetch(`${ST}?uploadType=media&name=${encodeURIComponent(caminho)}`, {
    method: 'POST',
    headers: { 'Content-Type': tipo, Authorization: `Bearer ${sessao.t}` },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  }).then((r) => r.status);

const baixar = (caminho, sessao) =>
  fetch(`${ST}/${encodeURIComponent(caminho)}`, {
    headers: { Authorization: `Bearer ${sessao.t}` },
  }).then((r) => r.status);

/** Semeia direto, sem passar por regra — é o Admin do emulador. */
const plantar = (caminho, tipo = 'image/jpeg') =>
  fetch(`${ST}?uploadType=media&name=${encodeURIComponent(caminho)}`, {
    method: 'POST',
    headers: { 'Content-Type': tipo, Authorization: 'Bearer owner' },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });

async function main() {
  console.log('\n═══ elenco ═══');
  const tio1 = await criarLogin(`s.tio1.${Date.now()}@teste.local`);
  const tio2 = await criarLogin(`s.tio2.${Date.now()}@teste.local`);
  const pai1 = await criarLogin(`s.pai1.${Date.now()}@teste.local`);

  await semear(`users/${tio1.uid}`, { role: S('admin'), name: S('Tio Um') });
  await semear(`users/${tio2.uid}`, { role: S('admin'), name: S('Tio Dois') });
  await semear(`users/${pai1.uid}`, {
    role: S('parent'),
    name: S('Pai Um'),
    adminUid: S(tio1.uid),
    childId: S('skid1'),
  });
  await semear('children/skid1', {
    name: S('Ana'),
    adminUid: S(tio1.uid),
    parentUid: S(pai1.uid),
    active: B(true),
  });
  console.log(`  tio1=${tio1.uid.slice(0, 6)}  tio2=${tio2.uid.slice(0, 6)}  pai1=${pai1.uid.slice(0, 6)}`);

  // ── O CONTRATO DE PAPEL — o caminho que entrou agora e nunca foi testado.
  console.log('\n═══ CONTRATO ANTERIOR ═══');
  checar('contrato', 'o motorista da criança anexa o contrato', 'PASSA',
    await enviar('contratosAnteriores/skid1', tio1));
  checar('contrato', 'OUTRO motorista anexa no lugar dele', 'NEGA',
    await enviar('contratosAnteriores/skid1', tio2));
  checar('contrato', 'o responsável anexa (quem paga não define o preço)', 'NEGA',
    await enviar('contratosAnteriores/skid1', pai1));
  checar('contrato', 'o responsável LÊ o contrato dele', 'PASSA',
    await baixar('contratosAnteriores/skid1', pai1));
  checar('contrato', 'outro motorista lê o contrato da família alheia', 'NEGA',
    await baixar('contratosAnteriores/skid1', tio2));
  checar('contrato', 'PDF é aceito (o que o banco e o cartório geram)', 'PASSA',
    await enviar('contratosAnteriores/skid1', tio1, 'application/pdf'));
  checar('contrato', 'executável disfarçado de anexo', 'NEGA',
    await enviar('contratosAnteriores/skid1', tio1, 'application/x-msdownload'));

  // ── O LOGO DA MARCA — público dentro do app, escrito só pelo dono dele.
  console.log('\n═══ LOGO DA MARCA ═══');
  checar('logo', 'o motorista sobe o próprio logo', 'PASSA',
    await enviar(`marcaLogos/${tio1.uid}`, tio1));
  checar('logo', 'outro motorista troca o logo dele', 'NEGA',
    await enviar(`marcaLogos/${tio1.uid}`, tio2));
  checar('logo', 'o responsável VÊ o logo (vai no cabeçalho dele)', 'PASSA',
    await baixar(`marcaLogos/${tio1.uid}`, pai1));

  // ── FOTO DA CRIANÇA — o caminho determinístico que mais assusta.
  console.log('\n═══ FOTO DA CRIANÇA ═══');
  await plantar('childPhotos/skid1');
  checar('foto', 'o motorista dela sobe a foto', 'PASSA',
    await enviar('childPhotos/skid1', tio1));
  checar('foto', 'o responsável dela sobe a foto', 'PASSA',
    await enviar('childPhotos/skid1', pai1));
  checar('foto', 'motorista de OUTRA operação sobrescreve a foto', 'NEGA',
    await enviar('childPhotos/skid1', tio2));
  checar('foto', 'o motorista dela lê a foto', 'PASSA',
    await baixar('childPhotos/skid1', tio1));
  checar('foto', 'o responsável dela lê a foto', 'PASSA',
    await baixar('childPhotos/skid1', pai1));
  // O rosto de uma criança não é "público dentro do app": quem precisa ver
  // são o motorista dela e o responsável dela, e mais ninguém.
  checar('foto', 'motorista de OUTRA operação LÊ a foto', 'NEGA',
    await baixar('childPhotos/skid1', tio2));

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${ok} passaram, ${bad} falharam`);
  if (falhas.length) {
    console.log('─'.repeat(64));
    falhas.forEach((f) => console.log('  ✗ ' + f));
  }
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\nO teste não chegou a rodar:', e.message);
  console.error('O emulador está de pé? auth + firestore + storage.');
  process.exit(1);
});
