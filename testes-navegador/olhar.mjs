/**
 * Uma olhada rápida numa tela, com a sessão da persona — sem roteiro.
 *   node testes-navegador/olhar.mjs motorista /tio inicio-de-novo
 */
import { abrirCelular, passo, registrar, encerrar, esperar, APP } from './lib.mjs';

const [persona = 'motorista', rota = '/tio', nome = 'olhada'] = process.argv.slice(2);
const { contexto, pagina, estado } = await abrirCelular(persona, { jornada: 'olhadas' });
await pagina.goto(APP + rota);
await passo(pagina, estado, `olhando ${rota}`);
await esperar(6000);
await registrar(pagina, estado, nome);
await registrar(pagina, estado, nome + '-inteira', { paginaInteira: true });
const texto = await pagina.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 900));
console.log('\n  TEXTO DA TELA:', texto);
await encerrar(contexto, pagina, estado, { manterAberto: 1500 });
