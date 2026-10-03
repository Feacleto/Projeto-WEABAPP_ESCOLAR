/**
 * O horário de costume — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:costume
 *
 * POR QUE ISTO EXISTE
 * A ficha da criança diz "costuma entrar na perua por volta de 6h43" para o
 * motorista E para a família. É uma afirmação sobre um hábito, e as duas
 * formas de ela mentir são as que este teste trava: um dia fora da curva
 * puxando o número (por isso mediana) e um hábito afirmado com uma viagem só
 * (por isso o piso). E o embarque da TARDE, na escola, não pode entrar na
 * conta do embarque em casa.
 */
import {
  minutoDoDia,
  medianaDosMinutos,
  costumeDaCrianca,
  horaFalada,
  MINIMO_DE_VIAGENS,
} from '../src/dominio/rota/horarioDeCostume.js';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}
const em = (h, m) => new Date(2026, 9, 1, h, m);
const ts = (h, m) => ({ toDate: () => em(h, m) });

console.log('\n1. o minuto do dia');
igual('Date', minutoDoDia(em(6, 43)), 403);
igual('Timestamp', minutoDoDia(ts(12, 51)), 771);
igual('vazio', minutoDoDia(null), null);
igual('lixo', minutoDoDia('não é data'), null);

console.log('2. a mediana');
igual('ímpar', medianaDosMinutos([400, 410, 405]), 405);
igual('par arredonda', medianaDosMinutos([400, 401, 410, 411]), 406);
igual('abaixo do piso', medianaDosMinutos([400, 410]), null);
igual(`piso é ${MINIMO_DE_VIAGENS}`, MINIMO_DE_VIAGENS, 3);
igual('dia fora da curva não puxa', medianaDosMinutos([403, 405, 404, 420 + 300, 402]), 404);
igual('ignora não-número', medianaDosMinutos([400, null, 'x', 402, 404]), 402);

console.log('3. o costume da criança');
const viagens = [
  { marcos: { embarqueEmCasa: ts(6, 41), onboard: ts(12, 30), delivered: ts(12, 52) } },
  { marcos: { embarqueEmCasa: ts(6, 44), onboard: ts(12, 31), delivered: ts(12, 49) } },
  { marcos: { embarqueEmCasa: ts(6, 43), onboard: ts(12, 29), delivered: ts(12, 55) } },
  // passou mal: levada de volta às 7h — não pode virar a "chegada de costume"
  { marcos: { embarqueEmCasa: ts(6, 42), delivered: ts(7, 5) } },
];
const c = costumeDaCrianca(viagens);
igual('embarque em casa', horaFalada(c.embarque), '6h43');
igual('chegada robusta ao dia raro', horaFalada(c.chegada), '12h51');
igual('quantas viagens', c.viagens, 4);
igual('o embarque da escola (onboard da tarde) não entra',
  costumeDaCrianca([
    { marcos: { onboard: ts(12, 30) } },
    { marcos: { onboard: ts(12, 30) } },
    { marcos: { onboard: ts(12, 30) } },
  ]).embarque, null);
igual('sem viagens', costumeDaCrianca([]), { embarque: null, chegada: null, viagens: 0 });

console.log('4. a hora falada');
igual('com minutos', horaFalada(403), '6h43');
igual('hora cheia', horaFalada(420), '7h');
igual('minuto com zero', horaFalada(365), '6h05');
igual('nada', horaFalada(null), '');

console.log(`\n  ${ok} passaram, ${bad} falharam\n`);
process.exit(bad ? 1 : 0);
