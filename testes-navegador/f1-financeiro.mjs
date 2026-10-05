/**
 * F1 — O TIO COM SENHA: A CENTRAL FORA DA ROTA (refeita em 04/10/2026).
 *
 * Fase 2 da "Rota e Central" (2705f9d). A tela trancada com cartões SAIU: fora
 * da rota a Central é do motorista e abre direto no teclado. Esta jornada
 * começa onde a C1 (`c1-auxiliar-na-rota.mjs`) parou — a rota aberta, com a
 * baixa em dinheiro do Lucas e o PIX anotado do Davi feitos SEM a senha — e
 * mede, em ordem:
 *   1. segurar "Encerrar" leva à Central, que pede a senha (primeira vez:
 *      cria no teclado comum, confirma no teclado de banco);
 *   2. o saldo vem com "Perguntar ao Buzi" logo abaixo;
 *   3. é UMA rolagem (05/10/2026, decisão do dono): as mensalidades primeiro
 *      ("Extrato | Mensalidades"), depois Turma e Contas — sem abas;
 *   4. "Iniciar a rota" fica no pé;
 *   5. a trilha do Lucas diz "Baixa dada sem a senha, na rota";
 *   6. sair para o Início e voltar tranca: senha errada, depois a certa.
 *
 * Rodar: node testes-navegador/semear-financeiro.mjs
 *        node testes-navegador/c1-auxiliar-na-rota.mjs
 *        node testes-navegador/f1-financeiro.mjs
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP, garantirSessao, CONTAS } from './lib.mjs';

const SENHA = '2580';
const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'F1-financeiro', perfil: CONTAS.zeFinanceiro().perfil });
// Sem relógio fixo aqui: com ele a callable da senha não volta ("Conferindo
// a senha" para sempre). Encerrar a rota não depende da hora.
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.first().isVisible().catch(() => false);
const r = {};

/** Teclado comum: um botão por número. */
async function digitarComum(senha) {
  for (const d of senha) await tocar(pagina, pagina.getByRole('button', { name: d, exact: true }), d);
}
/** Teclado de banco: acha o botão "a ou b" que tem o número. */
async function digitarNoBanco(senha) {
  for (const d of senha) {
    await tocar(pagina, pagina.getByRole('button', { name: new RegExp(`(^${d} ou \\d$)|(^\\d ou ${d}$)`) }), `o botão com ${d}`);
  }
}
async function irPeloRodape(nome) {
  await tocar(pagina, pagina.getByRole('link', { name: new RegExp(nome) }).last(), nome);
  await esperar(1800);
}

try {
  await pagina.goto(APP + '/tio/route/now');
  await esperar(4500);
  if (new URL(pagina.url()).pathname === '/login') throw new Error('Sem sessão: rode a C1 antes (ela entra e deixa a rota aberta).');

  // ── 1. Encerrar leva à Central com senha ───────────────────────────────
  await m('1 · segura "Encerrar" com criança na perua');
  const segurar = pagina.getByRole('button', { name: 'Segure para encerrar a rota' }).first();
  await segurar.waitFor({ state: 'visible', timeout: 15000 });
  await segurar.scrollIntoViewIfNeeded();
  const caixa = await segurar.boundingBox();
  await pagina.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await pagina.mouse.down();
  await esperar(1500);
  await pagina.mouse.up();
  await esperar(1200);
  await registrar(pagina, estado, '01-encerrar');
  const mesmoAssim = pagina.getByRole('button', { name: /Encerrar mesmo assim/ });
  if (await visivel(mesmoAssim)) await tocar(pagina, mesmoAssim.last(), 'Encerrar mesmo assim');
  await esperar(4000);
  r.depoisDeEncerrar = new URL(pagina.url()).pathname;
  if (r.depoisDeEncerrar !== '/tio/finance') {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'rota', oque: `Encerrar levou a ${r.depoisDeEncerrar}, e não à Central (/tio/finance).` });
  }
  r.pedeSenha = await visivel(pagina.getByText(/Proteja o seu Financeiro|Digite sua senha/));
  if (!r.pedeSenha) achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: 'Central', oque: 'Depois de encerrar, a Central não pediu a senha.' });
  await registrar(pagina, estado, '02-central-pede-senha');

  await m('primeira vez: cria a senha');
  await tocar(pagina, pagina.getByRole('button', { name: 'Criar senha' }), 'Criar senha');
  await esperar(800);
  await digitarComum('1234');
  await esperar(800);
  await registrar(pagina, estado, '03-senha-facil');
  await digitarComum(SENHA);
  await esperar(1000);
  await registrar(pagina, estado, '04-confirmar-no-banco');
  await digitarNoBanco(SENHA);
  await esperar(3500);
  const agoraNao = pagina.getByRole('button', { name: /Agora não/ });
  if (await visivel(agoraNao)) await tocar(pagina, agoraNao, 'Agora não');
  await esperar(2500);

  // ── 2. Saldo e Buzi ────────────────────────────────────────────────────
  await m('2 · o saldo, com "Perguntar ao Buzi" logo abaixo');
  await registrar(pagina, estado, '05-central', { paginaInteira: true });
  const saldo = pagina.getByText(/^Saldo de /).first();
  const buzi = pagina.getByText(/Perguntar ao Buzi/).first();
  r.saldo = await visivel(saldo);
  r.buzi = await visivel(buzi);
  if (r.saldo && r.buzi) {
    const [a, b] = [await saldo.boundingBox(), await buzi.boundingBox()];
    r.buziAbaixoDoSaldo = b.y > a.y && b.y - a.y < 260;
  }
  if (!r.buzi || r.buziAbaixoDoSaldo === false) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Central', oque: '"Perguntar ao Buzi" não está logo abaixo do saldo.' });

  // ── 3. Uma rolagem só, mensalidades primeiro ───────────────────────
  await m('3 · uma rolagem: mensalidades, depois Turma e Contas');
  r.abasDaCentral = await visivel(pagina.getByRole('tablist', { name: 'Central' }));
  if (r.abasDaCentral) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Central', oque: 'A Central ainda tem abas; a decisão de 05/10 é uma rolagem só.' });
  const yDe = async (loc) => (await loc.first().boundingBox().catch(() => null))?.y ?? null;
  const ordem = {
    mensalidades: await yDe(pagina.getByRole('tablist', { name: 'Extrato ou mensalidades' })),
    turma: await yDe(pagina.getByRole('heading', { name: 'Turma', exact: true })),
    contas: await yDe(pagina.getByRole('heading', { name: 'Contas', exact: true })),
  };
  // boundingBox é relativo à janela, mas a ordem vale na mesma rolagem
  r.ordem = ordem;
  r.ordemCerta = Object.values(ordem).every((y) => y !== null) && ordem.mensalidades < ordem.turma && ordem.turma < ordem.contas;
  if (!r.ordemCerta) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Central', oque: `A ordem da rolagem não é Mensalidades → Turma → Contas: ${JSON.stringify(ordem)}.` });

  // ── 4. Iniciar a rota no pé ────────────────────────────────────────────
  await m('4 · "Iniciar a rota" no pé');
  const iniciar = pagina.getByRole('button', { name: /Iniciar a rota/i }).last();
  r.iniciarNoPe = await visivel(iniciar);
  if (r.iniciarNoPe) {
    const b = await iniciar.boundingBox();
    r.iniciarNaMetadeDeBaixo = b.y > 740 / 2;
  } else {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Central', oque: '"Iniciar a rota" não está à vista no pé da Central.' });
  }

  // ── 5. A trilha do Lucas ───────────────────────────────────────────────
  await m('5 · Mensalidades → Lucas → histórico');
  const lista = pagina.getByRole('tablist', { name: 'Extrato ou mensalidades' });
  await tocar(pagina, lista.getByRole('tab', { name: 'Mensalidades' }), 'Mensalidades');
  await esperar(1500);
  await registrar(pagina, estado, '06-mensalidades', { paginaInteira: true });
  const linhaLucas = pagina.getByText(/Lucas Prado/).first();
  if (await visivel(linhaLucas)) {
    await linhaLucas.scrollIntoViewIfNeeded();
    const historicos = pagina.getByRole('button', { name: /Histórico deste pagamento/ });
    const n = await historicos.count();
    // o histórico mais perto do nome do Lucas
    const yLucas = (await linhaLucas.boundingBox()).y;
    let melhor = null;
    for (let i = 0; i < n; i++) {
      const b = await historicos.nth(i).boundingBox().catch(() => null);
      if (b && b.y > yLucas && (!melhor || b.y < melhor.y)) melhor = { i, y: b.y };
    }
    if (melhor) {
      await tocar(pagina, historicos.nth(melhor.i), 'Histórico deste pagamento');
      await esperar(1500);
    }
    r.trilhaSemSenha = await visivel(pagina.getByText('Baixa dada sem a senha, na rota'));
    await registrar(pagina, estado, '07-trilha-do-lucas', { paginaInteira: true });
    if (!r.trilhaSemSenha) achado(estado, { gravidade: 'atrapalha', lente: 'dinheiro', tela: 'Mensalidades', oque: 'A trilha do Lucas não mostra "Baixa dada sem a senha, na rota".' });
  } else {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Mensalidades', oque: 'O Lucas não aparece na aba Mensalidades.' });
  }

  // ── 6. Sair tranca ─────────────────────────────────────────────────────
  await m('6 · sai para o Início e volta: tem de pedir a senha');
  await irPeloRodape('Início');
  await irPeloRodape('Central');
  await esperar(1500);
  r.trancouAoVoltar = await visivel(pagina.getByText('Digite sua senha'));
  await registrar(pagina, estado, '08-trancado');
  if (!r.trancouAoVoltar) {
    achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: 'Central', oque: 'Voltar à Central depois de sair NÃO pediu a senha.' });
  } else {
    await digitarNoBanco('1111');
    await esperar(3000);
    await registrar(pagina, estado, '09-senha-errada');
    await digitarNoBanco(SENHA);
    await esperar(3500);
    r.abriuComASenha = await visivel(pagina.getByRole('tablist', { name: 'Extrato ou mensalidades' }));
    await registrar(pagina, estado, '10-aberta-de-novo');
    if (!r.abriuComASenha) achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Central', oque: 'A senha certa não abriu a Central.' });
  }
} catch (err) {
  console.error(err);
  achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '—', oque: `A jornada parou: ${err.message}` });
  await registrar(pagina, estado, '99-onde-parou').catch(() => {});
}
estado.resultado = r;
console.log(JSON.stringify(r, null, 2));
await encerrar(contexto, pagina, estado);
