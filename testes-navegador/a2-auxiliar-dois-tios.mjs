/**
 * A2 — A MESMA AUXILIAR COM DOIS TIOS NO MESMO DIA (05/10/2026, item F4.6).
 *
 * A Cida (`semear-auxiliar-dois-tios.mjs`) trabalha na perua do Tio Nino (A)
 * e na da Tia Rosa (B). No celular DELA, mede em ordem:
 *   1. o topo de Hoje tem a troca de perua (grupo "Escolher a perua"), um
 *      botão por tio, cada perua na cor da marca dele (`paletaDaMarca`);
 *   2. com o Tio Nino: só a turma dele; EMBARQUEI no Pedro vai pelo servidor
 *      (`marcarParadaPelaAuxiliar`) e o `rides` de hoje ganha
 *      `marcadoPelaAuxiliar`;
 *   3. com o Pedro "Na perua", o botão da Tia Rosa fica DESABILITADO, com
 *      "A rota do Tio Nino está rodando." (2b40e64) — e tocar nele não troca;
 *   4. ENTREGUEI NA ESCOLA libera a troca; com a Tia Rosa, só a turma e o PIX
 *      dela, e de volta ao Tio Nino, nada dela; nenhum "R$" em tela nenhuma
 *      da auxiliar (Hoje, Pagamentos sem a senha, Perfil).
 *
 * O relógio NÃO é fixado: a jornada chama callable, e a tela de Hoje mostra
 * a ida e a volta inteiras em qualquer hora (não há "viagem atual" nela).
 *
 * ⚠️ DEPENDE DO EMULADOR DE FUNCTIONS: a marcação é callable, e a cópia da
 * turma (que trava a troca) só muda pelo gatilho `espelharCriancaParaAuxiliar`.
 * Se o gatilho não espelhar em 10 s, a jornada anota o achado e grava a cópia
 * à mão, para medir o resto da tela.
 *
 * Rodar: node testes-navegador/semear-auxiliar-dois-tios.mjs
 *        node testes-navegador/a2-auxiliar-dois-tios.mjs
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP, garantirSessao } from './lib.mjs';
import { paletaDaMarca } from '../src/marca/corDaMarca.js';

const RAIZ = 'http://127.0.0.1:8085/v1';
const FS = `${RAIZ}/projects/demo-alobuzinou/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const ADM = { Authorization: 'Bearer owner' };
const SENHA = 'senha-de-teste-123';
const CONTA = { perfil: 'auxiliar-dois-tios', painel: '/aux', email: 'cida.auxiliar@teste.local', senha: SENHA };

// Os mesmos da semente — o que a tela tem que mostrar, e o que não pode.
const TIO = {
  A: { email: 'tio.nino.aux@teste.local', marca: 'Tio Nino', cor: '#E8590C', pix: '11911112222', criancas: ['Pedro Lima', 'Sofia Reis'] },
  B: { email: 'tia.rosa.aux@teste.local', marca: 'Tia Rosa', cor: '#1971C2', pix: '11933334444', criancas: ['Theo Martins', 'Alice Duarte'] },
};
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** O uid de uma conta do emulador, entrando com a senha (como a semente). */
async function uidDe(email) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  }).then((x) => x.json());
  if (!r.localId) throw new Error(`Sem a conta ${email} no emulador: rode semear-auxiliar-dois-tios.mjs.`);
  return r.localId;
}
const ler = async (caminho) => (await (await fetch(`${FS}/${caminho}`, { headers: ADM })).json()).fields || null;
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

for (const t of Object.values(TIO)) t.uid = await uidDe(t.email);
const PEDRO = 'a2Pedro';

const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'A2-auxiliar-dois-tios', perfil: CONTA.perfil });
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.first().isVisible().catch(() => false);
const r = {};

const grupo = () => pagina.getByRole('group', { name: 'Escolher a perua' });
const botaoDe = (k) => grupo().getByRole('button', { name: `Perua de ${TIO[k].marca}` });
// O botão da troca tem o MESMO texto da faixa; o grupo não mora em <section>,
// então a seção que contém o texto é só a faixa.
const faixa = (k) => pagina.locator('section').filter({ has: pagina.getByText(`Perua de ${TIO[k].marca}`, { exact: true }) });
const ida = () => pagina.locator('section').filter({ has: pagina.getByRole('heading', { name: /^Ida/ }) });
const cartaoNaIda = (nome) => ida().locator('div.rounded-2xl').filter({ hasText: nome });

/** Nenhum "R$" na tela inteira — a auxiliar não vê valor sem a senha dela. */
async function semValor(onde) {
  const texto = await pagina.evaluate(() => document.body.innerText);
  const achou = texto.match(/R\$\s?[\d.,•]*/g);
  r[`semValor:${onde}`] = !achou;
  if (achou) achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: onde, oque: `Aparece valor na tela da auxiliar: ${achou.slice(0, 3).join(', ')}` });
}

/**
 * Com a perua `k` escolhida, só a turma DELA: as crianças do outro tio não
 * aparecem, e a marca dele só no botão da troca (fora do grupo, nunca).
 */
async function soATurmaDe(k, onde) {
  const outro = k === 'A' ? 'B' : 'A';
  // Uma cópia do corpo sem o grupo da troca e sem a legenda do kit.
  const fora = await pagina.evaluate((rotulo) => {
    const copia = document.body.cloneNode(true);
    copia.querySelectorAll(`[role="group"][aria-label="${rotulo}"], #tn-legenda, .tn-rotulo, script, style`).forEach((e) => e.remove());
    return copia.textContent;
  }, 'Escolher a perua');
  const minhas = [];
  for (const nome of TIO[k].criancas) minhas.push(await visivel(pagina.getByText(nome, { exact: true })));
  const vazou = TIO[outro].criancas.filter((nome) => fora.includes(nome));
  if (fora.includes(TIO[outro].marca)) vazou.push(`a marca "${TIO[outro].marca}"`);
  if (fora.includes(TIO[outro].pix)) vazou.push('a chave PIX do outro tio');
  r[`turma:${onde}`] = { minhas, vazou };
  if (minhas.some((v) => !v)) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: onde, oque: `Com a perua de ${TIO[k].marca}, faltam crianças dela na tela (${JSON.stringify(minhas)}).` });
  }
  if (vazou.length) {
    achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: onde, oque: `Com a perua de ${TIO[k].marca}, aparece dado de ${TIO[outro].marca}: ${vazou.join(', ')}.` });
  }
}

/** A faixa do topo e o botão escolhido na cor do tio (a mesma régua do app). */
async function naCorDe(k, onde) {
  const cor = paletaDaMarca(TIO[k].cor);
  const fundo = await faixa(k).first().evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => null);
  const borda = await botaoDe(k).first().evaluate((el) => getComputedStyle(el).borderTopColor).catch(() => null);
  r[`cor:${onde}`] = { fundo, esperado: rgb(cor.marca), borda, bordaEsperada: rgb(cor.primary) };
  if (fundo !== rgb(cor.marca) || borda !== rgb(cor.primary)) {
    achado(estado, { gravidade: 'atrapalha', lente: 'UX', tela: onde, oque: `A perua de ${TIO[k].marca} não está na cor dele: faixa ${fundo} (esperado ${rgb(cor.marca)}), botão ${borda} (esperado ${rgb(cor.primary)}).` });
  }
}

/** Espera a cópia da turma espelhar o status; sem gatilho, grava à mão. */
async function copiaEspelha(status) {
  const caminho = `turmaDaAuxiliar/${TIO.A.uid}/criancas/${PEDRO}`;
  for (let i = 0; i < 20; i++) {
    if ((await ler(caminho))?.status?.stringValue === status) return true;
    await esperar(500);
  }
  achado(estado, { gravidade: 'atrapalha', lente: 'teste', tela: 'turmaDaAuxiliar', oque: `O gatilho não espelhou "${status}" na cópia em 10 s (o emulador de functions está de pé?). A jornada grava à mão para seguir.` });
  await fetch(`${FS}/${caminho}?updateMask.fieldPaths=status&updateMask.fieldPaths=statusUpdatedAt`, {
    method: 'PATCH', headers: { ...ADM, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: status }, statusUpdatedAt: { timestampValue: new Date().toISOString() } } }),
  });
  return false;
}

try {
  await m('entra com a conta da Cida');
  await garantirSessao(pagina, estado, CONTA);
  await pagina.goto(APP + '/aux');
  await esperar(3000);

  // ── 1. A troca de perua, na cor de cada tio ─────────────────────────────
  await m('1 · Hoje: a troca entre as duas peruas');
  r.temTroca = await visivel(grupo());
  if (!r.temTroca) throw new Error('Não há o grupo "Escolher a perua": a conta vê dois tios ativos?');
  r.botoes = await grupo().getByRole('button').evaluateAll((els) => els.map((e) => ({ texto: e.innerText.trim(), escolhida: e.getAttribute('aria-pressed') })));
  if (r.botoes.length !== 2) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: `A troca tem ${r.botoes.length} botões, e não um por tio.` });
  // A escolha fica no aparelho: a rodada anterior pode ter deixado a Tia Rosa.
  if ((await botaoDe('A').getAttribute('aria-pressed')) !== 'true') {
    await tocar(pagina, botaoDe('A'), `Perua de ${TIO.A.marca}`);
    await esperar(1500);
  }
  await registrar(pagina, estado, '01-hoje-tio-nino', { paginaInteira: true });
  await naCorDe('A', 'Hoje · Tio Nino');
  // O botão NÃO escolhido leva a bolinha na cor do outro tio.
  r.bolinhaDaTiaRosa = await botaoDe('B').locator('span[aria-hidden="true"]').first()
    .evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => null);
  if (r.bolinhaDaTiaRosa !== rgb(paletaDaMarca(TIO.B.cor).marca)) {
    achado(estado, { gravidade: 'melhoria', lente: 'UX', tela: 'Hoje', oque: `O botão da Tia Rosa não mostra a cor dela (${r.bolinhaDaTiaRosa}).` });
  }

  // ── 2. A turma do Tio Nino e o EMBARQUEI pelo servidor ───────────────────
  await m('2 · só a turma do Tio Nino; EMBARQUEI no Pedro');
  await soATurmaDe('A', 'Hoje · Tio Nino');
  await semValor('Hoje · Tio Nino');
  await tocar(pagina, cartaoNaIda('Pedro Lima').getByRole('button', { name: 'EMBARQUEI' }), 'EMBARQUEI');
  r.toastEmbarque = await pagina.getByText(/^Marcado\./).first().innerText({ timeout: 15000 }).catch(() => null);
  if (!r.toastEmbarque) {
    const erro = await pagina.locator('[role="status"]').first().innerText().catch(() => null);
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: `EMBARQUEI não confirmou "Marcado." (veio: ${erro}).` });
  }
  await esperar(1500);
  const ride = await ler(`children/${PEDRO}/rides/${HOJE}`);
  r.rideDoPedro = ride && {
    marcadoPelaAuxiliar: ride.marcadoPelaAuxiliar?.booleanValue,
    adminUid: ride.adminUid?.stringValue === TIO.A.uid ? 'Tio Nino' : ride.adminUid?.stringValue,
    marcos: Object.keys(ride.marcos?.mapValue?.fields || {}),
  };
  if (!ride || ride.marcadoPelaAuxiliar?.booleanValue !== true || !r.rideDoPedro.marcos.includes('onboard')) {
    achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'rides', oque: `A viagem de hoje do Pedro não tem marcadoPelaAuxiliar + onboard: ${JSON.stringify(r.rideDoPedro)}` });
  }
  r.pedroNoBanco = (await ler(`children/${PEDRO}`))?.status?.stringValue;
  r.copiaEspelhouEmbarque = await copiaEspelha('onboard');
  await esperar(1500);
  await registrar(pagina, estado, '02-pedro-na-perua', { paginaInteira: true });

  // ── 3. Com criança dentro, a troca trava ─────────────────────────────────
  await m('3 · Pedro na perua: a perua da Tia Rosa fica travada');
  await botaoDe('B').waitFor({ state: 'visible' });
  for (let i = 0; i < 10 && !(await botaoDe('B').isDisabled()); i++) await esperar(500);
  r.trocaTravada = await botaoDe('B').isDisabled();
  r.avisoDaTrava = await visivel(pagina.getByText(`A rota do ${TIO.A.marca} está rodando.`, { exact: true }));
  if (!r.trocaTravada) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: 'Com o Pedro na perua do Tio Nino, o botão da Tia Rosa continua habilitado.' });
  if (!r.avisoDaTrava) achado(estado, { gravidade: 'atrapalha', lente: 'UX', tela: 'Hoje', oque: `Não aparece "A rota do ${TIO.A.marca} está rodando." com a troca travada.` });
  // O toque de quem insiste: forçado, porque o botão está desabilitado.
  await botaoDe('B').tap({ force: true, timeout: 3000 }).catch(() => {});
  await esperar(1200);
  r.continuouNoTioNino = (await botaoDe('A').getAttribute('aria-pressed')) === 'true'
    && (await visivel(faixa('A'))) && (await visivel(pagina.getByText('Pedro Lima', { exact: true })));
  if (!r.continuouNoTioNino) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: 'Tocar na Tia Rosa com o Pedro na perua trocou de perua.' });
  await registrar(pagina, estado, '03-troca-travada');
  await semValor('Hoje · troca travada');

  // ── 4. Entregue na escola: a troca libera ────────────────────────────────
  await m('4 · ENTREGUEI NA ESCOLA; a troca libera');
  await tocar(pagina, cartaoNaIda('Pedro Lima').getByRole('button', { name: 'ENTREGUEI NA ESCOLA' }), 'ENTREGUEI NA ESCOLA');
  await pagina.getByText(/^Marcado\./).first().waitFor({ timeout: 15000 }).catch(() => {});
  await esperar(1500);
  const ride2 = await ler(`children/${PEDRO}/rides/${HOJE}`);
  r.marcosDepois = Object.keys(ride2?.marcos?.mapValue?.fields || {});
  if (!r.marcosDepois.includes('atSchool')) achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'rides', oque: `ENTREGUEI NA ESCOLA não gravou o marco atSchool: ${r.marcosDepois.join(', ')}` });
  r.copiaEspelhouEscola = await copiaEspelha('atSchool');
  for (let i = 0; i < 10 && (await botaoDe('B').isDisabled()); i++) await esperar(500);
  r.trocaLiberada = !(await botaoDe('B').isDisabled());
  if (!r.trocaLiberada) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: 'Com o Pedro na escola, a perua da Tia Rosa continua travada.' });

  await m('4 · troca para a Tia Rosa: só a turma dela');
  await tocar(pagina, botaoDe('B'), `Perua de ${TIO.B.marca}`);
  await esperar(2500);
  r.escolhidaB = (await botaoDe('B').getAttribute('aria-pressed')) === 'true';
  if (!r.escolhidaB) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Hoje', oque: 'Tocar na perua da Tia Rosa não trocou.' });
  await registrar(pagina, estado, '04-hoje-tia-rosa', { paginaInteira: true });
  await naCorDe('B', 'Hoje · Tia Rosa');
  await soATurmaDe('B', 'Hoje · Tia Rosa');
  await semValor('Hoje · Tia Rosa');

  // O PIX da perua é o da Tia Rosa, não o do Tio Nino.
  const pix = pagina.getByRole('button', { name: /Mostrar PIX da perua/ });
  if (await visivel(pix)) {
    await tocar(pagina, pix.first(), 'Mostrar PIX da perua');
    await esperar(1000);
    r.pixDaTiaRosa = await visivel(pagina.getByText(TIO.B.pix, { exact: true }));
    r.pixDoTioNinoNaTela = await visivel(pagina.getByText(TIO.A.pix, { exact: true }));
    await registrar(pagina, estado, '05-pix-da-tia-rosa');
    await semValor('PIX da Tia Rosa');
    if (!r.pixDaTiaRosa || r.pixDoTioNinoNaTela) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dinheiro', tela: 'PIX da perua', oque: `Na perua da Tia Rosa o PIX não é o dela (dela: ${r.pixDaTiaRosa}, do Tio Nino: ${r.pixDoTioNinoNaTela}).` });
    }
    await pagina.keyboard.press('Escape');
    await esperar(800);
  } else {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Hoje · Tia Rosa', oque: '"Mostrar PIX da perua" não aparece (a Tia Rosa tem chave).' });
  }
  // Nenhuma criança da Tia Rosa foi marcada: a marcação do Pedro não vazou.
  r.viagensDaTiaRosa = [];
  for (const id of ['a2Theo', 'a2Alice']) if (await ler(`children/${id}/rides/${HOJE}`)) r.viagensDaTiaRosa.push(id);
  if (r.viagensDaTiaRosa.length) achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'rides', oque: `Há viagem de hoje em criança da Tia Rosa sem ninguém marcar: ${r.viagensDaTiaRosa.join(', ')}` });

  // ── E o contrário: de volta ao Tio Nino, nada da Tia Rosa ────────────────
  await m('4 · de volta ao Tio Nino: nada da Tia Rosa');
  await tocar(pagina, botaoDe('A'), `Perua de ${TIO.A.marca}`);
  await esperar(2500);
  await soATurmaDe('A', 'Hoje · Tio Nino de novo');
  r.pedroNaEscola = await visivel(cartaoNaIda('Pedro Lima').getByText('Na escola', { exact: true }));
  if (!r.pedroNaEscola) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Hoje · Tio Nino', oque: 'Depois da troca, o Pedro não aparece "Na escola".' });
  await registrar(pagina, estado, '06-tio-nino-de-novo');

  // ── As outras telas dela, sem a senha ────────────────────────────────────
  await m('5 · Pagamentos sem a senha: nenhum valor');
  await tocar(pagina, pagina.getByRole('link', { name: /Pagamentos/ }).last(), 'Pagamentos');
  await esperar(2500);
  await registrar(pagina, estado, '07-pagamentos-sem-senha');
  await semValor('Pagamentos sem senha');

  await m('5 · Perfil: os dois tios, nenhum valor');
  await tocar(pagina, pagina.getByRole('link', { name: /Perfil/ }).last(), 'Perfil');
  await esperar(2000);
  r.perfilDizOsDois = await visivel(pagina.getByText(`Auxiliar na perua de ${TIO.A.marca} e de ${TIO.B.marca}`, { exact: true }));
  if (!r.perfilDizOsDois) achado(estado, { gravidade: 'melhoria', lente: 'UX', tela: 'Perfil', oque: 'O Perfil não diz que ela é auxiliar das duas peruas.' });
  await registrar(pagina, estado, '08-perfil', { paginaInteira: true });
  await semValor('Perfil');
} catch (err) {
  console.error(err);
  achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '—', oque: `A jornada parou: ${err.message}` });
  await registrar(pagina, estado, '99-onde-parou').catch(() => {});
}
estado.resultado = r;
console.log(JSON.stringify(r, null, 2));
await encerrar(contexto, pagina, estado);
