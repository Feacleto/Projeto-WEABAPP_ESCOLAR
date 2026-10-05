/**
 * M3c — O MOTORISTA CONFERE E MUDA O COMBINADO DO PEDRO (02/10/2026).
 *
 * Fase 1 do contrato: o contrato virou documento gravado por versão, com a
 * vigência escolhida pelo motorista. Antes de a família entrar, mudar o valor
 * reemite o contrato; depois do aceite, vira um aditivo (isso a jornada R2
 * mede, com a família do outro lado).
 *
 * O caminho de quem procura sozinho: a turma → a ficha → "Contrato e
 * mensalidade" → Mudar → o contrato.
 */
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP, garantirSessao, CONTAS } from './lib.mjs';

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M3c-combinado' });
const m = (t) => passo(pagina, estado, t);

try {
  await pagina.goto(APP + '/tio/children');
  await esperar(2500);
  // Reiniciar o emulador derruba a sessão do navegador (não é o app).
  if (new URL(pagina.url()).pathname === '/login') {
    await garantirSessao(pagina, estado, CONTAS.ze());
    await pagina.goto(APP + '/tio/children');
    await esperar(2500);
  }
  await m('a turma → a ficha do Pedro');
  await tocar(pagina, pagina.locator('img').filter({ hasNot: pagina.locator('svg') }).nth(1), 'a foto do Pedro');
  await esperar(2500);
  const cartao = pagina.getByText('Contrato e mensalidade').first();
  await cartao.scrollIntoViewIfNeeded();
  await esperar(1500);
  await m('o cartão "Contrato e mensalidade"');
  await registrar(pagina, estado, 'cartao-do-combinado');

  await m('Mudar: a folha do combinado');
  await tocar(pagina, pagina.getByRole('button', { name: /Mudar/ }).first(), 'Mudar');
  await esperar(1200);
  await registrar(pagina, estado, 'folha-combinado');
  await registrar(pagina, estado, 'folha-combinado-inteira', { paginaInteira: true });
  const fee = pagina.getByLabel('Mensalidade (R$)');
  await fee.fill('');
  await digitar(pagina, fee, process.env.VALOR || '500', 'mensalidade');
  await tocar(pagina, pagina.getByRole('button', { name: /12 meses/ }), '12 meses');
  await esperar(600);
  await registrar(pagina, estado, 'folha-preenchida');
  await tocar(pagina, pagina.getByRole('button', { name: /^Salvar$|Mandar o contrato novo/ }).last(), 'Salvar');
  await esperar(3000);
  await registrar(pagina, estado, 'depois-de-salvar');

  await m('Ver o contrato');
  await tocar(pagina, pagina.getByRole('button', { name: /Ver o contrato/ }).first(), 'Ver o contrato');
  await esperar(3000);
  await registrar(pagina, estado, 'contrato');
  await registrar(pagina, estado, 'contrato-inteiro', { paginaInteira: true });
  const texto = await pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  const clausula7 = texto.match(/CLÁUSULA 7ª[^|]*/)?.[0];
  const clausula9 = texto.match(/CLÁUSULA 9ª[^|]*/)?.[0];
  const versoes = texto.match(/Versão \d+[^|]*/g);
  console.log('\n  CLÁUSULA 7:', clausula7);
  console.log('  CLÁUSULA 9:', clausula9);
  console.log('  VERSÕES:', versoes);
} catch (err) {
  console.error('\n  ✗ a jornada parou:', err.message.split('\n')[0]);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = err.message.split('\n')[0];
} finally {
  await encerrar(contexto, pagina, estado);
}
