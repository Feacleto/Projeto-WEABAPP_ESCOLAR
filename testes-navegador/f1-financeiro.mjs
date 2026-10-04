/**
 * F1 — A SENHA DO FINANCEIRO, DA PRIMEIRA VEZ AO DIA A DIA (03/10/2026).
 *
 * Seu Zé (logado, das jornadas M) abre o Financeiro pela primeira vez: cria a
 * senha de 4 números no teclado comum, confirma no teclado de banco, recusa a
 * digital e cai no caixa. Passa pelo caixa (Extrato, Mensalidades, as três
 * portas), sai para o Início e volta — o Financeiro tem de estar TRANCADO.
 * Na tela trancada: lança despesa sem senha (valores escondidos), entra na
 * turma pela senha (uma errada antes) e volta — de novo, trancado.
 *
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP } from './lib.mjs';

const SENHA = '2580';
const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'F1-financeiro' });
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.isVisible().catch(() => false);

/** Teclado comum: um botão por número. */
async function digitarComum(senha) {
  for (const d of senha) {
    await tocar(pagina, pagina.getByRole('button', { name: d, exact: true }), d);
  }
}

/** Teclado de banco: acha o botão "a ou b" que tem o número. */
async function digitarNoBanco(senha) {
  for (const d of senha) {
    const botao = pagina.getByRole('button', { name: new RegExp(`(^${d} ou \\d$)|(^\\d ou ${d}$)`) });
    await tocar(pagina, botao, `o botão com ${d}`);
  }
}

async function irPeloRodape(nome) {
  await tocar(pagina, pagina.getByRole('link', { name: nome }).last(), nome);
  await esperar(1500);
}

try {
  await pagina.goto(APP + '/tio');
  await esperar(3500);
  if (new URL(pagina.url()).pathname === '/login') {
    // A conta vem de semear-financeiro.mjs.
    await m('entra com a conta do Seu Zé');
    // A abertura do login no celular dura ~8 s e não aceita toque; o aviso de
    // cookies cobre o formulário.
    await esperar(9000);
    const cookies = pagina.getByRole('button', { name: 'Aceitar todos' });
    if (await visivel(cookies)) await tocar(pagina, cookies, 'Aceitar todos');
    const usarEmail = pagina.getByText(/^(Usar email|Entrar com e-mail)$/).first();
    if (await visivel(usarEmail)) await tocar(pagina, usarEmail, 'Usar email');
    await pagina.getByLabel('Email', { exact: true }).fill('ze.financeiro@teste.local');
    await pagina.getByLabel('Senha', { exact: true }).fill('senha-de-teste-123');
    await tocar(pagina, pagina.locator('form button[type=submit]').first(), 'Entrar');
    await esperar(6000);
  }
  await irPeloRodape('Financeiro');

  // ── Primeira vez ───────────────────────────────────────────────────────
  await m('primeira vez: "Proteja o seu Financeiro"');
  await registrar(pagina, estado, '01-primeira-vez');
  await tocar(pagina, pagina.getByRole('button', { name: 'Criar senha' }), 'Criar senha');
  await esperar(800);

  await m('senha fácil é recusada (1234)');
  await digitarComum('1234');
  await esperar(800);
  await registrar(pagina, estado, '02-senha-facil');

  await m(`cria ${SENHA} no teclado comum`);
  await digitarComum(SENHA);
  await esperar(1000);
  await m('confirma no teclado de banco');
  await registrar(pagina, estado, '03-confirmar-no-banco');
  await digitarNoBanco(SENHA);
  await esperar(3500);
  await registrar(pagina, estado, '04-senha-criada');
  const agoraNao = pagina.getByRole('button', { name: /Agora não/ });
  if (await visivel(agoraNao)) await tocar(pagina, agoraNao, 'Agora não');
  else achado(estado, { gravidade: 'alta', lente: 'fluxo', texto: 'Depois de criar a senha não apareceu o "Agora não".' });
  await esperar(2500);

  // ── O caixa ────────────────────────────────────────────────────────────
  await m('o caixa aberto');
  await registrar(pagina, estado, '05-caixa', { paginaInteira: true });
  const mensalidades = pagina.getByRole('tab', { name: 'Mensalidades' });
  if (await visivel(mensalidades)) {
    await tocar(pagina, mensalidades, 'Mensalidades');
    await esperar(1000);
    await registrar(pagina, estado, '06-aba-mensalidades', { paginaInteira: true });
  }

  await m('porta: Despesas do mês');
  await tocar(pagina, pagina.getByRole('button', { name: /Despesas do mês/ }).or(pagina.getByRole('link', { name: /Despesas do mês/ })).first(), 'Despesas do mês');
  await esperar(2000);
  await registrar(pagina, estado, '07-despesas', { paginaInteira: true });
  await pagina.goBack();
  await esperar(1500);

  await m('porta: Turma e contratos');
  await tocar(pagina, pagina.getByRole('button', { name: /Turma e contratos/ }).or(pagina.getByRole('link', { name: /Turma e contratos/ })).first(), 'Turma e contratos');
  await esperar(2000);
  await registrar(pagina, estado, '08-turma', { paginaInteira: true });
  await pagina.goBack();
  await esperar(1500);
  if (!(await visivel(pagina.getByText(/^Saldo de /)))) {
    achado(estado, { gravidade: 'alta', lente: 'fluxo', texto: 'Voltar da turma (entrando pelo caixa) não voltou ao caixa aberto.' });
  }

  // ── Sair tranca ────────────────────────────────────────────────────────
  await m('sai para o Início e volta: tem de estar trancado');
  await irPeloRodape('Início');
  await esperar(1500);
  await irPeloRodape('Financeiro');
  await esperar(2000);
  await registrar(pagina, estado, '09-trancado', { paginaInteira: true });
  if (!(await visivel(pagina.getByText('Abrir caixa')))) {
    achado(estado, { gravidade: 'critica', lente: 'seguranca', texto: 'Voltar ao Financeiro depois de sair NÃO mostrou a tela trancada.' });
  }

  // ── Sem senha: lançar despesa ──────────────────────────────────────────
  await m('Lançar despesa sem senha: valores escondidos');
  await tocar(pagina, pagina.getByRole('button', { name: /Lançar despesa/ }).first(), 'Lançar despesa');
  await esperar(2000);
  await registrar(pagina, estado, '10-despesa-sem-senha');
  const auxiliar = pagina.getByRole('button', { name: 'Auxiliar', exact: true });
  if (await visivel(auxiliar)) {
    await tocar(pagina, auxiliar, 'Auxiliar');
    await esperar(1200);
    await registrar(pagina, estado, '11-auxiliar-sem-senha');
  }
  await pagina.keyboard.press('Escape');
  await esperar(1000);
  const fechar = pagina.getByRole('button', { name: /Fechar|Cancelar/ }).first();
  if (await visivel(fechar)) await tocar(pagina, fechar, 'Fechar');
  await esperar(1000);

  // ── Pela senha, direto na turma ────────────────────────────────────────
  await m('Minha turma → senha errada, depois a certa');
  await tocar(pagina, pagina.getByRole('button', { name: /Minha turma/ }).first(), 'Minha turma');
  await esperar(1500);
  await registrar(pagina, estado, '12-teclado-de-banco');
  await digitarNoBanco('1111' === SENHA ? '2222' : '1111');
  await esperar(3000);
  await registrar(pagina, estado, '13-senha-errada');
  await digitarNoBanco(SENHA);
  await esperar(3500);
  await registrar(pagina, estado, '14-turma-pela-senha', { paginaInteira: true });

  await m('voltar da turma: de volta à tela trancada');
  await tocar(pagina, pagina.getByRole('button', { name: /Voltar/ }).first(), 'Voltar');
  await esperar(2000);
  await registrar(pagina, estado, '15-depois-de-voltar');
  if (!(await visivel(pagina.getByText('Abrir caixa')))) {
    achado(estado, { gravidade: 'alta', lente: 'fluxo', texto: 'Voltar da turma (entrando pela tela trancada) não voltou à tela trancada.' });
  }
} catch (err) {
  console.error(err);
  achado(estado, { gravidade: 'critica', lente: 'teste', texto: `A jornada parou: ${err.message}` });
  await registrar(pagina, estado, '99-onde-parou').catch(() => {});
}
await encerrar(contexto, pagina, estado);
