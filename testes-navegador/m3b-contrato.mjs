/**
 * M3b — O MOTORISTA COMPLETA OS DADOS DO CONTRATO E CONFERE O DO PEDRO.
 *
 * Sem nome, CPF/CNPJ e cidade da parte contratada o contrato não nasce, e a
 * família não tem o que assinar. O teste parte de onde o motorista estaria —
 * o Início — e procura o caminho sozinho: "Meu transporte" → o aviso de que
 * falta o cadastro → o perfil → os dados → o contrato da criança.
 */
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP } from './lib.mjs';

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M3b-contrato' });
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.isVisible().catch(() => false);

try {
  await pagina.goto(APP + '/tio');
  await esperar(3500);
  await m('Início: onde está o aviso do contrato?');
  await registrar(pagina, estado, 'inicio-com-pedro');
  await registrar(pagina, estado, 'inicio-com-pedro-inteiro', { paginaInteira: true });

  await m('abre "Meu transporte"');
  await tocar(pagina, pagina.getByText('Meu transporte').first(), 'Meu transporte');
  await esperar(1200);
  await registrar(pagina, estado, 'meu-transporte');
  await registrar(pagina, estado, 'meu-transporte-inteiro', { paginaInteira: true });

  const completar = pagina.getByText(/Complete seus dados de contrato/).first();
  if (await visivel(completar)) {
    await tocar(pagina, completar, 'Complete seus dados de contrato');
  } else {
    await pagina.goto(APP + '/tio/profile');
  }
  await pagina.waitForURL(/\/tio\/profile/, { timeout: 15000 });
  await esperar(1500);
  await m('o perfil: onde ficam os dados do contrato?');
  await registrar(pagina, estado, 'perfil-topo');
  await registrar(pagina, estado, 'perfil-inteiro', { paginaInteira: true });

  await m('"Dados da empresa" → Preencher');
  await tocar(pagina, pagina.getByRole('button', { name: /Preencher|Editar/ }).last(), 'Preencher');
  await esperar(800);
  await registrar(pagina, estado, 'dados-vazio');
  await digitar(pagina, pagina.getByLabel('CPF ou CNPJ'), '12345678909', 'CPF');
  await digitar(pagina, pagina.getByLabel('Seu endereço'), 'Rua das Palmeiras, 200, Vila Olímpia, São Paulo/SP', 'endereço');
  await registrar(pagina, estado, 'dados-preenchido');
  await tocar(pagina, pagina.getByRole('button', { name: /^Salvar/ }).last(), 'Salvar');
  await esperar(1500);
  await registrar(pagina, estado, 'dados-salvos');

  await m('o contrato do Pedro');
  await pagina.goto(APP + '/tio/children');
  await esperar(2500);
  await registrar(pagina, estado, 'turma');
  // Primeiro como uma pessoa faria: toca no NOME.
  await tocar(pagina, pagina.getByText(/Pedro/).first(), 'Pedro (o nome)');
  await esperar(1500);
  await registrar(pagina, estado, 'tocou-no-nome');
  // Não abriu a ficha (só expandiu o cartão): a ficha abre pela FOTO.
  if (/\/tio\/children$/.test(new URL(pagina.url()).pathname)) {
    await tocar(pagina, pagina.locator('img').filter({ hasNot: pagina.locator('svg') }).nth(1), 'a foto do Pedro');
    await esperar(2000);
  }
  await registrar(pagina, estado, 'ficha-pedro');
  await registrar(pagina, estado, 'ficha-pedro-inteira', { paginaInteira: true });
  const contrato = pagina.getByText('Contrato de transporte').first();
  await tocar(pagina, contrato, 'Contrato de transporte');
  await esperar(2500);
  await registrar(pagina, estado, 'contrato');
  await registrar(pagina, estado, 'contrato-inteiro', { paginaInteira: true });
  const texto = await pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 2500));
  console.log('\n  TEXTO DO CONTRATO:', texto);
} catch (err) {
  console.error('\n  ✗ a jornada parou:', err.message.split('\n')[0]);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = err.message.split('\n')[0];
} finally {
  await encerrar(contexto, pagina, estado);
}
