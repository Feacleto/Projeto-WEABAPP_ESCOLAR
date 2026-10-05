/**
 * R2 — A MÃE, JÁ COM CONTA, ACEITA O CONTRATO E CHEGA AO INÍCIO.
 *
 * Continua de onde a R1 para: ela já entrou pelo link, e o app põe na frente
 * dela o contrato (a versão GRAVADA) e depois o primeiro acesso da família.
 * O roteiro reconhece cada tela pelo texto, age nela e registra todas.
 */
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP, garantirSessao, CONTAS } from './lib.mjs';

import { readFileSync } from 'node:fs';
// A conta que a R1 criou (o e-mail vai para `resultados/mae.txt`).
const EMAIL = readFileSync(new URL('./resultados/mae.txt', import.meta.url), 'utf8').trim();
const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'R2-aceite' });
const m = (t) => passo(pagina, estado, t);
const ve = (re) => pagina.getByText(re).first().isVisible().catch(() => false);

try {
  await pagina.goto(APP + '/pai');
  await esperar(4000);
  // Daqui em diante a ordem é do app. Até 10 telas, reconhecidas pelo texto.
  for (let i = 0; i < 10; i += 1) {
    const url = new URL(pagina.url()).pathname;
    if (await ve(/Aceito os|Antes de começar|Termos de Uso/) && (await pagina.locator('input[type=checkbox]').count()) > 0 && !(await ve(/Assinar contrato/))) {
      await m('os termos');
      await registrar(pagina, estado, `termos-${i}`);
      const caixas = pagina.locator('input[type=checkbox]');
      for (let k = 0; k < (await caixas.count()); k += 1) await caixas.nth(k).check().catch(() => {});
      await tocar(pagina, pagina.getByRole('button', { name: /Continuar|Aceitar|Concordo/ }).first(), 'aceitar os termos');
      await esperar(3000);
      continue;
    }
    if (await ve(/Assinar contrato/)) {
      await m('o contrato do Pedro, para ler e aceitar');
      await registrar(pagina, estado, `contrato-${i}`);
      await registrar(pagina, estado, `contrato-inteiro-${i}`, { paginaInteira: true });
      const texto = await pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
      console.log('\n  CONTRATO QUE ELA LÊ:', texto.match(/CLÁUSULA 7ª[^|]*/)?.[0]);
      console.log('  VIGÊNCIA:', texto.match(/CLÁUSULA 9ª[^|]*/)?.[0]);
      const nome = pagina.getByLabel('Seu nome completo');
      if (!(await nome.inputValue())) await digitar(pagina, nome, 'Mariana Souza', 'nome completo');
      await tocar(pagina, pagina.getByText(/Li e aceito/).first(), 'Li e aceito');
      await registrar(pagina, estado, `contrato-marcado-${i}`);
      await tocar(pagina, pagina.getByRole('button', { name: /Assinar contrato/ }), 'Aceitar contrato');
      await esperar(5000);
      continue;
    }
    if (url === '/login') {
      // Reiniciar o emulador derruba a sessão do navegador (não é o app).
      await garantirSessao(pagina, estado, CONTAS.mariana());
      continue;
    }
    if (await ve(/^Sobre Pedro$/)) {
      await m('o primeiro acesso: sobre o Pedro');
      await registrar(pagina, estado, `card-filho-${i}`);
      await pagina.getByLabel('Aniversário').fill('2018-05-14');
      await digitar(pagina, pagina.getByLabel(/Turma/), '2º ano B', 'turma');
      await registrar(pagina, estado, `card-filho-preenchido-${i}`);
      await tocar(pagina, pagina.getByRole('button', { name: /Entrar no app|Continuar|Próximo/ }).last(), 'Entrar no app');
      await esperar(3000);
      continue;
    }
    if (await ve(/^Próximo$/) && (await ve(/^Pular$/))) {
      await m('o tour da família');
      for (let k = 0; k < 6 && (await ve(/^Próximo$|^Concluir$|^Começar$/)); k += 1) {
        await registrar(pagina, estado, `tour-${i}-${k}`);
        await tocar(pagina, pagina.getByRole('button', { name: /^Próximo$|^Concluir$|^Começar$/ }).first(), 'Próximo');
        await esperar(1200);
      }
      continue;
    }
    if (url.startsWith('/pai')) {
      await m(`dentro do app: ${url}`);
      await registrar(pagina, estado, `dentro-${i}`);
      await registrar(pagina, estado, `dentro-inteiro-${i}`, { paginaInteira: true });
      break;
    }
    await registrar(pagina, estado, `desconhecida-${i}`);
    await esperar(3000);
  }
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a jornada parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  await encerrar(contexto, pagina, estado);
}
