/**
 * R3 — A MÃE INFORMA O TELEFONE DA ESCOLA (03/10/2026).
 *
 * Pedido do dono: opcional, qualquer um dos dois lados cadastra, e quem
 * cadastra mostra para os outros. A Mariana abre a ficha do Pedro, informa o
 * número, e ele passa a valer para o motorista e para a família da Lia (mesma
 * escola) — medido pelo M6 do lado dele.
 */
import { readFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP, garantirSessao, CONTAS } from './lib.mjs';
const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'R3-escola' });
const m = (t) => passo(pagina, estado, t);

try {
  await pagina.goto(APP + '/pai/child');
  await esperar(4000);
  if (new URL(pagina.url()).pathname === '/login') {
    await garantirSessao(pagina, estado, CONTAS.mariana());
    await pagina.goto(APP + '/pai/child');
    await esperar(4000);
  }
  await m('a ficha do Pedro: o telefone da escola');
  await registrar(pagina, estado, 'ficha');
  await tocar(pagina, pagina.getByText(/Informar o telefone da escola/).first(), 'Informar o telefone da escola');
  await esperar(800);
  await digitar(pagina, pagina.getByLabel('Telefone da escola'), '1133334444', 'telefone');
  await registrar(pagina, estado, 'telefone-digitado');
  await tocar(pagina, pagina.getByRole('button', { name: /^Salvar$/ }).first(), 'Salvar');
  await esperar(5000);
  await registrar(pagina, estado, 'telefone-salvo');
  const ligar = await pagina.getByText(/Ligar para a escola/).first().isVisible().catch(() => false);
  console.log('\n  "LIGAR PARA A ESCOLA" APARECEU PARA ELA?', ligar);
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a jornada parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  await encerrar(contexto, pagina, estado);
}
