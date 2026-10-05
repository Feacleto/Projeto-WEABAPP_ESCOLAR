/**
 * M7 — MAPA DESLIGADO, PERUA QUEBRADA E O DIA SEM ROTA, DOS DOIS LADOS
 * (03/10/2026).
 *
 * Três telas que o código mostrava erradas:
 *   - sábado: o lugar do "INICIAR ROTA" diz que dia é ("Rodar mesmo assim");
 *   - mapa desligado: nenhuma posição era gravada (faltava `merge`), e o
 *     painel da família não tinha o estado `SEM_MAPA` (quebraria a tela);
 *   - perua quebrada vira estado da rota, e "Resolvido" o desfaz.
 *
 * Etapas por variável: ETAPA=motorista-inicia | mae-olha | motorista-resolve
 * | motorista-encerra. O roteiro chamador roda as quatro em sequência.
 */
import { readFileSync } from 'node:fs';
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, APP, garantirSessao, CONTAS } from './lib.mjs';

const ETAPA = process.env.ETAPA;
const persona = ETAPA.startsWith('mae') ? 'responsavel' : 'motorista';
const { contexto, pagina, estado } = await abrirCelular(persona, { jornada: `M7-${ETAPA}` });
const m = (t) => passo(pagina, estado, t);
const texto = () => pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));

async function entrar() {
  await garantirSessao(pagina, estado, persona === 'motorista' ? CONTAS.ze() : CONTAS.mariana());
}

try {
  const inicio = persona === 'motorista' ? '/tio' : '/pai';
  await pagina.goto(APP + inicio);
  await esperar(3000);
  await entrar();
  await pagina.goto(APP + inicio);
  await esperar(4000);

  if (ETAPA === 'motorista-inicia') {
    await m('sábado: o lugar do botão');
    await registrar(pagina, estado, 'dia-sem-rota');
    console.log('\n  LUGAR DO BOTÃO:', ((await texto()).match(/(Hoje é [^|]*|Feriado: [^|]*)/) || ['(sem aviso de dia)'])[0]);
    await tocar(pagina, pagina.getByRole('button', { name: /Rodar mesmo assim/ }).first(), 'Rodar mesmo assim');
    await esperar(600);
    await tocar(pagina, pagina.getByRole('button', { name: /INICIAR ROTA/i }).first(), 'INICIAR ROTA');
    await esperar(6000);
    await m('Problema na perua');
    await tocar(pagina, pagina.getByRole('button', { name: /Problema na perua/ }).first(), 'Problema na perua');
    await esperar(800);
    await tocar(pagina, pagina.getByRole('button', { name: /^(Enviar para|Salvar no caderno)/ }).first(), 'Enviar');
    await esperar(3000);
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await registrar(pagina, estado, 'barra-com-problema');
    console.log('  BARRA:', ((await texto()).match(/Problema na perua avisado[^|]*/) || ['(não apareceu)'])[0]);
  }
  if (ETAPA === 'mae-olha') {
    await m('a tela da mãe');
    await registrar(pagina, estado, 'tela-da-mae');
    await registrar(pagina, estado, 'tela-da-mae-inteira', { paginaInteira: true });
    const t = await texto();
    console.log('\n  MÃE VÊ:', (t.match(/(O motorista avisou um problema[^|]*|Este motorista prefere não mostrar[^|]*|A rota de hoje já começou[^|]*|Sem posição[^|]*)/g) || ['(nenhum estado de rota)']).join(' / '));
  }
  if (ETAPA === 'motorista-resolve') {
    await pagina.goto(APP + '/tio/route/now');
    await esperar(4000);
    await tocar(pagina, pagina.getByRole('button', { name: /^Resolvido$/ }).first(), 'Resolvido');
    await esperar(3000);
    await registrar(pagina, estado, 'resolvido');
  }
  if (ETAPA === 'motorista-encerra') {
    await pagina.goto(APP + '/tio/route/now');
    await esperar(4000);
    await tocar(pagina, pagina.getByRole('button', { name: /^Encerrar$/ }).first(), 'Encerrar');
    await esperar(800);
    await tocar(pagina, pagina.getByRole('button', { name: /^Confirmar$/ }).first(), 'Confirmar');
    await esperar(3000);
  }
} catch (err) {
  const linha = err.message.split(String.fromCharCode(10))[0];
  console.error('  ✗ a etapa parou:', linha);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = linha;
} finally {
  await encerrar(contexto, pagina, estado, { manterAberto: 1500 });
}
