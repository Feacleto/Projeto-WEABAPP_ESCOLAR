/**
 * R2b — O MOTORISTA MUDOU A MENSALIDADE; A MÃE VÊ O AVISO E ACEITA O ADITIVO.
 *
 * Depende da M3c rodada com `VALOR=520` (a mudança esperando aceite). O aviso
 * não bloqueia o app: mora no Início, e leva para /pai/contrato, onde o que
 * muda aparece em destaque antes do texto inteiro.
 */
import { readFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, APP, garantirSessao, CONTAS } from './lib.mjs';

const EMAIL = readFileSync(new URL('./resultados/mae.txt', import.meta.url), 'utf8').trim();
const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'R2b-aditivo' });
const m = (t) => passo(pagina, estado, t);

try {
  await pagina.goto(APP + '/pai');
  await esperar(4000);
  await garantirSessao(pagina, estado, CONTAS.mariana());
  await m('o Início: o aviso da mudança');
  await registrar(pagina, estado, 'inicio-com-aviso');
  await tocar(pagina, pagina.getByText(/contrato novo para assinar/).first(), 'o aviso da mudança');
  await esperar(3000);
  await m('o que muda, antes do texto inteiro');
  await registrar(pagina, estado, 'aditivo');
  await registrar(pagina, estado, 'aditivo-inteiro', { paginaInteira: true });
  await tocar(pagina, pagina.getByText(/Li e aceito/).first(), 'Li e aceito');
  await tocar(pagina, pagina.getByRole('button', { name: /Assinar contrato/ }), 'Assinar contrato');
  await esperar(4000);
  await registrar(pagina, estado, 'depois-do-aceite');
  await pagina.goto(APP + '/pai');
  await esperar(3500);
  await m('o Início sem o aviso');
  await registrar(pagina, estado, 'inicio-sem-aviso');
  const aindaAviso = await pagina.getByText(/contrato novo para assinar/).first().isVisible().catch(() => false);
  console.log('\n  AVISO AINDA NA TELA?', aindaAviso);
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a jornada parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  await encerrar(contexto, pagina, estado);
}
