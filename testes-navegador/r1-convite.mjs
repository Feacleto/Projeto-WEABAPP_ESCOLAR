/**
 * R1 + R2 — A MÃE ABRE O CONVITE, CRIA A CONTA E ACEITA O CONTRATO.
 *
 * A Mariana recebeu pelo WhatsApp o link que o motorista mandou na M3
 * (`resultados/convite.txt`). Ela não usa Google: entra com e-mail e senha.
 * Depois do cadastro, o app pode pôr na frente dela, em qualquer ordem, os
 * termos, o contrato (a versão GRAVADA, esperando aceite) e o primeiro acesso
 * da família. O roteiro reconhece cada tela pelo texto e age nela — e
 * registra todas, que é o que interessa: o que ela vê, e em que ordem.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP } from './lib.mjs';

const LINK = readFileSync(new URL('./resultados/convite.txt', import.meta.url), 'utf8')
  .trim()
  .replace(/^https?:\/\/[^/]+/, APP);
const EMAIL = `mariana.${Date.now() % 100000}@teste.local`;

const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'R1-convite', limpar: true });
const m = (t) => passo(pagina, estado, t);
const ve = (re) => pagina.getByText(re).first().isVisible().catch(() => false);

try {
  await m('abre o link do WhatsApp');
  await pagina.goto(LINK);
  await esperar(4000);
  await registrar(pagina, estado, 'previa');
  await registrar(pagina, estado, 'previa-inteira', { paginaInteira: true });

  await m('"Entrar e acompanhar"');
  await tocar(pagina, pagina.getByRole('button', { name: /Entrar e acompanhar/ }), 'Entrar e acompanhar');
  await esperar(1200);
  await registrar(pagina, estado, 'folha-de-entrar');

  await m('não usa Google: entra com e-mail');
  const semGoogle = pagina.getByText(/Não uso Google/);
  if (await semGoogle.isVisible().catch(() => false)) {
    await tocar(pagina, semGoogle, 'Não uso Google');
    await esperar(600);
  }
  await digitar(pagina, pagina.getByLabel('Seu email'), EMAIL, 'e-mail');
  await digitar(pagina, pagina.getByLabel('Sua senha'), 'mariana123', 'senha');
  await registrar(pagina, estado, 'folha-preenchida');
  await tocar(pagina, pagina.getByRole('button', { name: /^Continuar$/ }), 'Continuar');
  // Guarda já: a R2 continua desta conta mesmo se esta jornada parar adiante.
  writeFileSync(new URL('./resultados/mae.txt', import.meta.url), EMAIL);
  await esperar(6000);

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
    if (url.startsWith('/pai')) {
      await m(`dentro do app: ${url}`);
      await registrar(pagina, estado, `dentro-${i}`);
      await registrar(pagina, estado, `dentro-inteiro-${i}`, { paginaInteira: true });
      break;
    }
    await registrar(pagina, estado, `desconhecida-${i}`);
    await esperar(3000);
  }
  estado.email = EMAIL;
} catch (err) {
  console.error('\n  ✗ a jornada parou:', err.message.split('\n')[0]);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = err.message.split('\n')[0];
} finally {
  await encerrar(contexto, pagina, estado);
}
