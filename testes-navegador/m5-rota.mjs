/**
 * M5 — O MOTORISTA FAZ A IDA COM QUATRO CRIANÇAS (03/10/2026).
 *
 * Turma de `semear-turma.mjs`: Pedro (06:40) e Lia (06:50) no Colégio Santa
 * Maria; Caio (06:55) e Duda (07:00) na Escola Estadual Funchal — e a Duda
 * avisou falta hoje.
 *
 * O que esta jornada mede, porque foi o que o código mostrou quebrado:
 *   - a aba Rota aparece ao iniciar e some ao encerrar;
 *   - o FOCO ANDA de casa em casa depois de cada EMBARQUEI;
 *   - o "TODOS" na escola só junta quem estuda lá;
 *   - quem faltou fica em cinza e fora do foco;
 *   - encerrar com alguém pendente mostra QUEM antes do "Confirmar".
 */
import { readFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, APP } from './lib.mjs';

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M5-rota' });
const m = (t) => passo(pagina, estado, t);
const ve = (re) => pagina.getByText(re).first().isVisible().catch(() => false);
const texto = () => pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
const abas = () =>
  pagina.evaluate(() =>
    [...document.querySelectorAll('nav a')].map((a) => a.innerText.trim()).filter(Boolean)
  );
const focoAgora = async () => {
  const t = await texto();
  const botao = (t.match(/(EMBARQUEI[^|]*|ENTREGUEI[^|]*)/) || [])[0];
  return botao || '(sem botão)';
};

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

try {
  await pagina.goto(APP + '/tio');
  await esperar(3000);
  await entrarSePreciso();
  await pagina.goto(APP + '/tio');
  await esperar(3500);
  await m('o Início antes da rota');
  await registrar(pagina, estado, 'inicio-antes');
  console.log('\n  ABAS ANTES:', await abas());

  await m('INICIAR ROTA');
  // Fim de semana ou feriado: o lugar do botão diz o dia (calendario.js).
  const mesmoAssim = pagina.getByRole('button', { name: /Rodar mesmo assim/ }).first();
  if (await mesmoAssim.isVisible().catch(() => false)) {
    await tocar(pagina, mesmoAssim, 'Rodar mesmo assim');
    await esperar(600);
  }
  await tocar(pagina, pagina.getByRole('button', { name: /INICIAR ROTA/i }).first(), 'INICIAR ROTA');
  await esperar(4000);
  console.log('  ABAS EM ROTA:', await abas(), '· tela:', new URL(pagina.url()).pathname);
  await registrar(pagina, estado, 'rota-aberta');
  await registrar(pagina, estado, 'rota-aberta-inteira', { paginaInteira: true });
  console.log('  FOCO 1:', await focoAgora());

  for (let i = 1; i <= 3; i += 1) {
    await m(`EMBARQUEI ${i}`);
    const botao = pagina.getByRole('button', { name: /^EMBARQUEI$/ }).first();
    await tocar(pagina, botao, 'EMBARQUEI');
    await esperar(2500);
    await registrar(pagina, estado, `depois-embarque-${i}`);
    console.log(`  FOCO depois do embarque ${i}:`, await focoAgora());
  }

  await m('na escola: o TODOS junta só quem estuda lá');
  await registrar(pagina, estado, 'na-escola');
  const t = await texto();
  console.log('  TODOS NA TELA:', (t.match(/[^|]*TODOS OS \d[^|]*/) || ['(nenhum)'])[0]);
  console.log('  DUDA:', (t.match(/Duda[^|]*\|[^|]*/) || ['(não achei)'])[0]);

  await m('Encerrar com gente pendente');
  await tocar(pagina, pagina.getByRole('button', { name: /^Encerrar$/ }).first(), 'Encerrar');
  await esperar(800);
  await registrar(pagina, estado, 'encerrar-aviso');
  console.log('  AVISO AO ENCERRAR:', (await texto()).match(/(Ainda na perua[^|]*|Sem embarque[^|]*)/)?.[0] || '(nenhum)');
  await tocar(pagina, pagina.getByRole('button', { name: /^Confirmar$/ }).first(), 'Confirmar');
  await esperar(4000);
  console.log('  ABAS DEPOIS:', await abas(), '· tela:', new URL(pagina.url()).pathname);
  await registrar(pagina, estado, 'depois-de-encerrar');
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a jornada parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  await encerrar(contexto, pagina, estado);
}
