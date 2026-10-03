/**
 * M6 — A ROTA COM AS FERRAMENTAS NOVAS (03/10/2026).
 *
 * Turma de `semear-turma.mjs` (Pedro, Lia, Caio; Duda faltou) e o telefone da
 * escola informado pela mãe na R3. Mede, em ordem:
 *   1. voltar um passo (EMBARQUEI no Pedro desfeito)
 *   2. sem sinal: a marcação não trava a tela e sobe quando o sinal volta
 *   3. recado no caderno de dentro da rota
 *   4. "Vou atrasar" para as famílias desta viagem
 *   5. "Ligar para a escola" no passo da escola
 *   6. na volta, "Ninguém em casa" leva a criança para o fim e o foco segue
 */
import { readFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, APP } from './lib.mjs';

const FS = 'http://127.0.0.1:8085/v1/projects/demo-alobuzinou/databases/(default)/documents';
const ADM = { Authorization: 'Bearer owner' };
const statusNoBanco = async (id) =>
  (await (await fetch(`${FS}/children/${id}`, { headers: ADM })).json()).fields?.status?.stringValue;

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M6-rota-completa' });
const m = (t) => passo(pagina, estado, t);
const ve = (re) => pagina.getByText(re).first().isVisible().catch(() => false);
const nomeEmFoco = () =>
  pagina.evaluate(() => {
    const c = document.querySelector('.shadow-focus.border-primary');
    return c ? c.innerText.split('\n')[0] : null;
  });

async function entrarSePreciso() {
  if (new URL(pagina.url()).pathname !== '/login') return;
  const email = JSON.parse(
    readFileSync(new URL('./resultados/M1-cadastro/resumo.json', import.meta.url), 'utf8')
  ).email;
  const usarEmail = pagina.getByText(/^Usar email$/).first();
  if (await usarEmail.isVisible().catch(() => false)) await tocar(pagina, usarEmail, 'Usar email');
  await pagina.getByLabel('Email', { exact: true }).fill(email);
  await pagina.getByLabel('Senha', { exact: true }).fill('perua123');
  await tocar(pagina, pagina.locator('form button[type=submit]').first(), 'Entrar');
  await esperar(5000);
}
const r = {};

try {
  await pagina.goto(APP + '/tio');
  await esperar(3000);
  await entrarSePreciso();
  await pagina.goto(APP + '/tio');
  await esperar(3500);
  await m('INICIAR ROTA');
  // Fim de semana ou feriado: o lugar do botão diz o dia (calendario.js).
  const mesmoAssim = pagina.getByRole('button', { name: /Rodar mesmo assim/ }).first();
  if (await mesmoAssim.isVisible().catch(() => false)) {
    await tocar(pagina, mesmoAssim, 'Rodar mesmo assim');
    await esperar(600);
  }
  await tocar(pagina, pagina.getByRole('button', { name: /INICIAR ROTA/i }).first(), 'INICIAR ROTA');
  await esperar(4000);

  // 1. VOLTAR UM PASSO
  await m('1 · EMBARQUEI no Pedro… e voltar');
  await tocar(pagina, pagina.getByRole('button', { name: /^EMBARQUEI$/ }).first(), 'EMBARQUEI');
  await esperar(2500);
  await tocar(pagina, pagina.getByText(/^Pedro Henrique Souza$/).last(), 'o Pedro na lista');
  await esperar(1200);
  r.focoAoTocarNoPedro = await nomeEmFoco();
  await tocar(pagina, pagina.getByRole('button', { name: /^Desfazer$/ }).first(), 'Desfazer');
  await esperar(700);
  await registrar(pagina, estado, 'voltar-confirmacao');
  await tocar(pagina, pagina.getByRole('button', { name: /^Voltar um passo$/ }).last(), 'confirmar');
  await esperar(2500);
  r.pedroDepoisDeVoltar = await statusNoBanco('6UqkIJx3kk5oMUs7FjdV');
  r.focoDepoisDeVoltar = await nomeEmFoco();
  await registrar(pagina, estado, 'depois-de-voltar');

  // 2. SEM SINAL
  await m('2 · sem sinal: EMBARQUEI no Pedro');
  await contexto.setOffline(true);
  const t0 = Date.now();
  await tocar(pagina, pagina.getByRole('button', { name: /^EMBARQUEI$/ }).first(), 'EMBARQUEI sem sinal');
  await esperar(3500);
  r.semSinalAvisou = await ve(/Sem sinal agora/);
  r.focoSemSinal = await nomeEmFoco();
  r.msAteLiberar = Date.now() - t0;
  await registrar(pagina, estado, 'sem-sinal');
  await contexto.setOffline(false);
  await esperar(5000);
  r.pedroDepoisDoSinal = await statusNoBanco('6UqkIJx3kk5oMUs7FjdV');

  // 3. RECADO
  await m('3 · recado sobre a Lia');
  await tocar(pagina, pagina.getByRole('button', { name: /^Recado$/ }).first(), 'Recado');
  await esperar(1000);
  await registrar(pagina, estado, 'recado');
  await tocar(pagina, pagina.getByRole('button', { name: /^Enviar recado$/ }), 'Enviar recado');
  await esperar(2500);
  r.recadoEnviado = await ve(/Recado (enviado|salvo)/);

  // 4. VOU ATRASAR
  await m('4 · Vou atrasar');
  await tocar(pagina, pagina.getByRole('button', { name: /Vou atrasar/ }).first(), 'Vou atrasar');
  await esperar(1000);
  await registrar(pagina, estado, 'vou-atrasar');
  r.leituraDoAtraso = await pagina.evaluate(() =>
    (document.body.innerText.match(/Pelo combinado[^\n]*|Você está no horário[^\n]*/) || [null])[0]
  );
  await tocar(pagina, pagina.getByRole('button', { name: /^(Enviar para|Salvar no caderno)/ }).first(), 'Enviar');
  await esperar(2500);
  r.atrasoEnviado = await ve(/Aviso (enviado|salvo)/);

  // 5. LIGAR PARA A ESCOLA (todos embarcados, passo da escola)
  await m('5 · embarcar o resto e ver "Ligar para a escola"');
  for (let i = 0; i < 2; i += 1) {
    const b = pagina.getByRole('button', { name: /^EMBARQUEI$/ }).first();
    if (await b.isVisible().catch(() => false)) {
      await tocar(pagina, b, 'EMBARQUEI');
      await esperar(2500);
    }
  }
  r.ligarParaEscola = await ve(/Ligar para a escola/);
  await registrar(pagina, estado, 'passo-da-escola');
  await tocar(pagina, pagina.getByRole('button', { name: /TODOS OS 2/ }).first(), 'ENTREGUEI NA ESCOLA — TODOS');
  await esperar(800);
  await tocar(pagina, pagina.getByRole('button', { name: /^Confirmar$/ }).last(), 'Confirmar');
  await esperar(2500);
  const b = pagina.getByRole('button', { name: /^ENTREGUEI NA ESCOLA$/ }).first();
  if (await b.isVisible().catch(() => false)) {
    await tocar(pagina, b, 'ENTREGUEI NA ESCOLA (Caio)');
    await esperar(2500);
  }

  // 6. A VOLTA: NINGUÉM EM CASA
  await m('6 · a volta (12h50)');
  await tocar(pagina, pagina.getByRole('button', { name: /12h50/ }).first(), 'a viagem das 12h50');
  await esperar(2000);
  for (let i = 0; i < 3; i += 1) {
    const todos = pagina.getByRole('button', { name: /EMBARQUEI — TODOS/ }).first();
    if (await todos.isVisible().catch(() => false)) {
      await tocar(pagina, todos, 'EMBARQUEI — TODOS');
      await esperar(800);
      await tocar(pagina, pagina.getByRole('button', { name: /^Confirmar$/ }).last(), 'Confirmar');
      await esperar(2500);
      continue;
    }
    const um = pagina.getByRole('button', { name: /^EMBARQUEI$/ }).first();
    if (await um.isVisible().catch(() => false)) {
      await tocar(pagina, um, 'EMBARQUEI');
      await esperar(2500);
    }
  }
  r.focoAntesDoNinguem = await nomeEmFoco();
  await registrar(pagina, estado, 'volta-entregas');
  await tocar(pagina, pagina.getByRole('button', { name: /Ninguém em casa/ }).first(), 'Ninguém em casa');
  await esperar(1500);
  r.focoDepoisDoNinguem = await nomeEmFoco();
  await registrar(pagina, estado, 'ninguem-em-casa');

  await m('encerrar');
  await tocar(pagina, pagina.getByRole('button', { name: /^Encerrar$/ }).first(), 'Encerrar');
  await esperar(800);
  await tocar(pagina, pagina.getByRole('button', { name: /^Confirmar$/ }).first(), 'Confirmar');
  await esperar(3000);
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a jornada parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  console.log('\n  RESULTADOS:', JSON.stringify(r, null, 2));
  await encerrar(contexto, pagina, estado);
}
