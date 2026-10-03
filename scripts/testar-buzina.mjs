/**
 * A BUZINA DIGITAL — quando vale, o que diz, e quem a fecha (03/10/2026).
 *
 * Três defeitos achados no teste de código, e os três passavam calados:
 *   - depois do "Estou indo!" o "Fechar" girava para sempre;
 *   - a chamada nunca expirava e voltava a tocar no dia seguinte;
 *   - de manhã a frase dizia "chegou pra ENTREGAR".
 *
 * Rode: npm run testar:buzina
 */
import { readFileSync } from 'node:fs';
import {
  buzinaValendo,
  momentoDaBuzina,
  fraseDaBuzina,
  VALIDADE_DA_BUZINA_MIN,
} from '../src/dominio/rota/buzina.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const ler = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const AGORA = Date.parse('2026-10-05T06:45:00-03:00');
const minAtras = (m) => AGORA - m * 60_000;

bloco('1 · A CHAMADA VENCE SOZINHA');
checar('tocando há 2 min, vale', true,
  buzinaValendo({ status: 'ringing', createdAt: minAtras(2) }, AGORA));
checar('respondida há 10 min, ainda vale (ele espera na porta)', true,
  buzinaValendo({ status: 'acknowledged', createdAt: minAtras(10) }, AGORA));
checar(`passou de ${VALIDADE_DA_BUZINA_MIN} min, não vale mais`, false,
  buzinaValendo({ status: 'ringing', createdAt: minAtras(VALIDADE_DA_BUZINA_MIN) }, AGORA));
checar('a de ontem nunca toca hoje', false,
  buzinaValendo({ status: 'ringing', createdAt: minAtras(60 * 20) }, AGORA));
checar('encerrada não vale', false,
  buzinaValendo({ status: 'resolved', createdAt: minAtras(1) }, AGORA));
checar('sem carimbo do servidor ainda (acabou de nascer), vale', true,
  buzinaValendo({ status: 'ringing', createdAt: null }, AGORA));
checar('Timestamp do Firestore também é lido', true,
  buzinaValendo({ status: 'ringing', createdAt: { toMillis: () => minAtras(1) } }, AGORA));

bloco('2 · BUSCAR OU ENTREGAR');
checar('em casa, a perua vem buscar', 'buscar', momentoDaBuzina('home'));
checar('na perua, vem entregar', 'entregar', momentoDaBuzina('onboard'));
checar('de manhã a frase pede a CRIANÇA', 'O motorista está na porta para buscar Pedro. Pode descer?',
  fraseDaBuzina({ momento: 'buscar', nomeDaCrianca: 'Pedro Henrique Lima' }));
checar('à tarde, pede quem recebe', 'O motorista está na porta para entregar Lia. Pode descer?',
  fraseDaBuzina({ momento: 'entregar', nomeDaCrianca: 'Lia' }));
checar('chamada antiga sem `momento` cai no buscar, não quebra', true,
  fraseDaBuzina({ nomeDaCrianca: 'Caio' }).includes('buscar Caio'));

bloco('3 · AS TELAS E A ROTA');
const modal = ler('src/components/call/IncomingCallModal.jsx');
const onAck = modal.slice(modal.indexOf('const onAck'), modal.indexOf('const onDismiss'));
checar('o "Estou indo!" devolve o botão também no SUCESSO', true, /finally\s*\{[\s\S]*setSubmitting\(false\)/.test(onAck));
checar('o Fechar depois de responder NÃO encerra a chamada do motorista', true,
  modal.includes('onClick={() => setFechadaId(call.id)}'));
const hook = ler('src/hooks/usePendingCall.js');
checar('os dois lados filtram pela validade, com relógio próprio', 2,
  (hook.match(/buzinaValendo\(/g) || []).length);
checar('embarcar fecha a buzina daquela criança', true,
  ler('src/components/route/OperacaoDaRota.jsx').includes("motivo: 'embarque'"));
checar('encerrar a rota fecha todas', true,
  ler('src/components/route/ControleDeRota.jsx').includes("motivo: 'fim_da_rota'"));

bloco('4 · SONDA POSITIVA');
checar('o detector do finally reprovaria o código antigo', false,
  /finally\s*\{[\s\S]*setSubmitting\(false\)/.test(
    "try { await acknowledgeCall(call.id); } catch (err) { setSubmitting(false); }"
  ));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
