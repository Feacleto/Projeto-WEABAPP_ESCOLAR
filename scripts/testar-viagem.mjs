/**
 * A VIAGEM ANDA — quem está em foco e quem pode ser marcado junto (03/10/2026).
 *
 * Trava a régua de `src/dominio/rota/focoDaViagem.js`, que nasceu de dois
 * defeitos achados lendo a rota com quatro crianças:
 *   - depois do primeiro EMBARQUEI, o foco virava "ENTREGUEI NA ESCOLA" da
 *     mesma criança e não andava para a casa seguinte;
 *   - o "TODOS" juntava casas diferentes e escolas diferentes.
 *
 * COMO RODAR
 *   node scripts/testar-viagem.mjs      (ou: npm run testar:viagem)
 */
import {
  pendentesEmOrdem,
  focoDaViagem,
  loteDoFoco,
  lugarDoPasso,
  proximoAAvisar,
  saidaDaViagem,
  quemFicouSemRegistro,
  previsoesDaViagem,
} from '../src/dominio/rota/focoDaViagem.js';
import { getActionForStatus, passoAnterior } from '../src/dominio/rota/acaoDaParada.js';
import {
  pascoa,
  feriadosNacionais,
  diaSemRota,
  ehDiaDeAula,
  fraseDoDiaSemRota,
} from '../src/dominio/rota/calendario.js';
import { createRequire } from 'node:module';
const calServidor = createRequire(import.meta.url)('../functions/lib/reguaDoCalendario.js');

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

// Quatro crianças, casas diferentes. Ana e Bia na Escola A; Caio e Duda na B.
const CRIANCAS = {
  ana: { id: 'ana', address: 'Rua 1, 10', schoolId: 'A' },
  bia: { id: 'bia', address: 'Rua 2, 20', schoolId: 'A' },
  caio: { id: 'caio', address: 'Rua 3, 30', schoolId: 'B' },
  duda: { id: 'duda', address: 'Rua 4, 40', schoolId: 'B' },
};
/** A fila na ordem do relógio, com a ação que a tela calcularia. */
function fila(status, direcao, ordem = ['ana', 'bia', 'caio', 'duda'], criancas = CRIANCAS) {
  return ordem.map((id) => ({
    child: criancas[id],
    status: status[id],
    action: getActionForStatus(status[id], direcao),
  }));
}
const ids = (lista) => lista.map((q) => q.child.id);
const foco = (f, escolhido) => focoDaViagem(pendentesEmOrdem(f), escolhido)?.child.id || null;
const lote = (f, escolhido) => {
  const p = pendentesEmOrdem(f);
  return ids(loteDoFoco(p, focoDaViagem(p, escolhido)));
};

console.log('\n═══ A IDA: PRIMEIRO EMBARCA, DEPOIS ENTREGA ═══');
const casa = { ana: 'home', bia: 'home', caio: 'home', duda: 'home' };
checar('começa pela primeira casa', 'ana', foco(fila(casa, 'pickup')));
checar('na casa da Ana não há "TODOS" (casas diferentes)', [], lote(fila(casa, 'pickup')));
const anaNaPerua = { ...casa, ana: 'onboard' };
checar('⚠️ depois do EMBARQUEI da Ana, o foco ANDA para a Bia', 'bia', foco(fila(anaNaPerua, 'pickup')));
const todosNaPerua = { ana: 'onboard', bia: 'onboard', caio: 'onboard', duda: 'onboard' };
checar('todos na perua: o foco é desembarcar a Ana', 'ana', foco(fila(todosNaPerua, 'pickup')));
checar('⚠️ "TODOS" na Escola A junta SÓ quem estuda lá', ['ana', 'bia'], lote(fila(todosNaPerua, 'pickup')));
const aEntregue = { ...todosNaPerua, ana: 'atSchool', bia: 'atSchool' };
checar('depois da Escola A, o foco vai para a B', 'caio', foco(fila(aEntregue, 'pickup')));
checar('"TODOS" na Escola B', ['caio', 'duda'], lote(fila(aEntregue, 'pickup')));
const tudoEntregue = { ana: 'atSchool', bia: 'atSchool', caio: 'atSchool', duda: 'atSchool' };
checar('ida terminada: sem foco', null, foco(fila(tudoEntregue, 'pickup')));

console.log('\n═══ IRMÃOS NA MESMA CASA ═══');
const irmaos = {
  ...CRIANCAS,
  bia: { id: 'bia', address: 'Rua 1, 10', schoolId: 'A' }, // mesma casa da Ana
};
checar('na casa dos irmãos, "TODOS" junta os dois', ['ana', 'bia'], lote(fila(casa, 'pickup', undefined, irmaos)));
checar('endereço com maiúscula e espaço é o mesmo lugar',
  lugarDoPasso({ child: { address: ' Rua 1, 10 ' }, status: 'home', action: { nextStatus: 'onboard' } }),
  lugarDoPasso({ child: { address: 'rua 1, 10' }, status: 'home', action: { nextStatus: 'onboard' } }));
checar('sem endereço, ninguém é o mesmo lugar',
  false,
  lugarDoPasso({ child: { id: 'x' }, status: 'home', action: { nextStatus: 'onboard' } })
    === lugarDoPasso({ child: { id: 'y' }, status: 'home', action: { nextStatus: 'onboard' } }));

console.log('\n═══ A VOLTA: BUSCA NAS ESCOLAS, DEPOIS AS CASAS ═══');
const naEscola = { ana: 'atSchool', bia: 'atSchool', caio: 'atSchool', duda: 'atSchool' };
checar('começa embarcando na Escola A', 'ana', foco(fila(naEscola, 'dropoff')));
checar('"EMBARQUEI — TODOS" na A junta só quem estuda lá', ['ana', 'bia'], lote(fila(naEscola, 'dropoff')));
const aEmbarcou = { ...naEscola, ana: 'onboard', bia: 'onboard' };
checar('⚠️ depois da A, vai buscar a B — não entrega a Ana antes', 'caio', foco(fila(aEmbarcou, 'dropoff')));
const todosVoltando = { ana: 'onboard', bia: 'onboard', caio: 'onboard', duda: 'onboard' };
checar('todos na perua: entrega na ordem do relógio', 'ana', foco(fila(todosVoltando, 'dropoff')));
checar('⚠️ "ENTREGUEI — TODOS" não aparece em casas diferentes', [], lote(fila(todosVoltando, 'dropoff')));

console.log('\n═══ O MOTORISTA ESCOLHE O FOCO ═══');
checar('tocou na Duda: ela vira o foco', 'duda', foco(fila(casa, 'pickup'), 'duda'));
checar('a escolha some quando ela não tem mais o que fazer',
  'ana', foco(fila({ ...casa, duda: 'atSchool' }, 'pickup'), 'duda'));
checar('escolhida que faltou (sem ação) não prende o foco',
  'ana', foco(fila(casa, 'pickup').map((q) => (q.child.id === 'duda' ? { ...q, action: null } : q)), 'duda'));

console.log('\n═══ "VOCÊS SÃO OS PRÓXIMOS" — QUEM RECEBE ═══');
const item = (f, id) => f.find((q) => q.child.id === id);
const prox = (f, movidos) => proximoAAvisar(f, movidos)?.child.id || null;
{
  const f = fila(casa, 'pickup');
  checar('embarcou a Ana em casa: a próxima é a Bia', 'bia', prox(f, item(f, 'ana')));
}
{
  // A Bia faltou hoje: chega sem ação (é assim que a tela a monta).
  const f = fila(casa, 'pickup').map((q) => (q.child.id === 'bia' ? { ...q, action: null } : q));
  checar('⚠️ quem faltou não é avisada: depois da Ana, o Caio', 'caio', prox(f, item(f, 'ana')));
}
{
  const f = fila({ ...casa, ana: 'onboard', bia: 'onboard', caio: 'onboard' }, 'pickup');
  checar('embarcou a última: ninguém mais na ida', null, prox(f, item(f, 'duda')));
}
{
  const f = fila(todosNaPerua, 'pickup');
  checar('desembarcar na escola não avisa ninguém', null, prox(f, item(f, 'ana')));
}
{
  // Volta: embarcaram Ana e Bia na Escola A; Caio e Duda ainda na B.
  const f = fila(naEscola, 'dropoff');
  checar('⚠️ embarcar na escola NÃO é lido como ida (ninguém em casa é avisado)',
    null, prox(f, [item(f, 'ana'), item(f, 'bia')]));
}
{
  // Volta, uma escola só: embarcaram todos.
  const umaEscola = Object.fromEntries(Object.entries(CRIANCAS).map(([k, v]) => [k, { ...v, schoolId: 'A' }]));
  const f = fila(naEscola, 'dropoff', undefined, umaEscola);
  checar('embarcaram todos na escola: a primeira entrega é avisada',
    'ana', prox(f, ['ana', 'bia', 'caio', 'duda'].map((id) => item(f, id))));
}
{
  const f = fila(todosVoltando, 'dropoff');
  checar('entregou a Ana: a próxima entrega é a Bia', 'bia', prox(f, item(f, 'ana')));
}

console.log('\n═══ "A PERUA SAIU" — QUAL VIAGEM, PARA QUEM ═══');
{
  const bloco = {
    direcao: 'ida',
    inicio: 400,
    paradas: [
      { estado: 'normal', child: { parentUid: 'mae-ana' } },
      { estado: 'falta', child: { parentUid: 'mae-bia' } },
      { estado: 'normal', child: { parentUid: 'mae-irmaos' } },
      { estado: 'normal', child: { parentUid: 'mae-irmaos' } },
      { estado: 'normal', child: { parentUid: null } },
    ],
  };
  const s = saidaDaViagem(bloco);
  checar('⚠️ quem faltou não recebe; mãe de irmãos recebe UM', ['mae-ana', 'mae-irmaos'], s.familias);
  checar('a trava é da VIAGEM, não do dia', 'ida-400', s.viagem);
  checar('a viagem da tarde tem outra trava', 'volta-750',
    saidaDaViagem({ ...bloco, direcao: 'volta', inicio: 750 }).viagem);
  checar('sem viagem, nada', null, saidaDaViagem(null));
}

console.log('\n═══ ENCERRAR: QUEM FICOU SEM REGISTRO ═══');
{
  const f = fila({ ana: 'atSchool', bia: 'onboard', caio: 'home', duda: 'home' }, 'pickup')
    .map((q) => (q.child.id === 'duda' ? { ...q, action: null } : q)); // Duda faltou
  const r = quemFicouSemRegistro(f);
  checar('⚠️ quem consta NA PERUA aparece como "entrega"',
    { childId: 'bia', falta: 'entrega' }, { childId: r[0]?.childId, falta: r[0]?.falta });
  checar('quem não embarcou aparece como "embarque"',
    { childId: 'caio', falta: 'embarque' }, { childId: r[1]?.childId, falta: r[1]?.falta });
  checar('quem já foi entregue e quem faltou não aparecem', 2, r.length);
}

console.log('\n═══ A ESCOLHA VALE UM PASSO (achado no M6) ═══');
{
  // Tocou no Caio (embarcar) e marcou: ele vira "na perua" e a escolha some.
  const f = fila({ ...casa, caio: 'onboard' }, 'pickup');
  checar('⚠️ tocou no Caio, marcou EMBARQUEI: o foco NÃO fica preso nele',
    'ana', foco(f, { id: 'caio', passo: 'onboard' }));
  checar('enquanto o passo é o mesmo, a escolha vale',
    'caio', foco(fila(casa, 'pickup'), { id: 'caio', passo: 'onboard' }));
}

console.log('\n═══ NINGUÉM EM CASA: PARA O FIM DA VIAGEM ═══');
{
  const f = fila(todosVoltando, 'dropoff');
  const p = pendentesEmOrdem(f, ['ana']);
  checar('a Ana adiada: o foco vai para a Bia', 'bia', focoDaViagem(p)?.child.id);
  checar('a Ana continua na fila, no fim', 'ana', p[p.length - 1]?.child.id);
}

console.log('\n═══ DESFAZER UM TOQUE ERRADO ═══');
checar('ida: embarcou por engano volta para casa', 'home', passoAnterior('onboard', 'pickup'));
checar('ida: entregou na escola por engano volta para a perua', 'onboard', passoAnterior('atSchool', 'pickup'));
checar('ida: em casa não tem para onde voltar', null, passoAnterior('home', 'pickup'));
checar('volta: embarcou na escola por engano volta para a escola', 'atSchool', passoAnterior('onboard', 'dropoff'));
checar('volta: entregou por engano volta para a perua', 'onboard', passoAnterior('delivered', 'dropoff'));
checar('volta: na escola não tem para onde voltar', null, passoAnterior('atSchool', 'dropoff'));

console.log('\n═══ A PREVISÃO: COMBINADO + ATRASO REAL ═══');
{
  const comHora = (f, horas) => f.map((q) => ({ ...q, hora: horas[q.child.id] }));
  const horas = { ana: '06:40', bia: '06:50', caio: '06:55', duda: '07:00' };
  const as = (h, m) => { const d = new Date(2026, 9, 5); d.setHours(h, m, 0, 0); return d; };
  const f = comHora(fila(casa, 'pickup'), horas);
  const p = previsoesDaViagem(f, item(f, 'ana'), as(6, 52)); // 12 min atrasado
  checar('12 min de atraso na Ana: Bia por volta de 07:02', { childId: 'bia', campo: 'previsaoIda', previsao: '07:02' },
    { childId: p[0]?.childId, campo: p[0]?.campo, previsao: p[0]?.previsao });
  checar('e as outras que esperam também', ['caio', 'duda'], p.slice(1).map((x) => x.childId));
  const adiantado = previsoesDaViagem(f, item(f, 'ana'), as(6, 33)); // 7 min adiantado
  checar('adiantado também prevê (chega mais cedo)', '06:43', adiantado[0]?.previsao);
  const noHorario = previsoesDaViagem(f, item(f, 'ana'), as(6, 43));
  checar('menos de 5 min: previsão APAGADA (null), vale o combinado', [null, null, null], noHorario.map((x) => x.previsao));
  const foraDeHora = previsoesDaViagem(f, item(f, 'ana'), as(1, 20));
  checar('rota fora do horário (mais de 90 min): nada', [], foraDeHora);
  const naEscola = comHora(fila(todosNaPerua, 'pickup'), horas);
  checar('desembarque na escola não mexe na previsão', [], previsoesDaViagem(naEscola, item(naEscola, 'ana'), as(7, 30)));
  const volta = comHora(fila(todosVoltando, 'dropoff'), { ana: '12:40', bia: '12:50', caio: '13:00', duda: '13:05' });
  const pv = previsoesDaViagem(volta, item(volta, 'ana'), as(12, 55)); // 15 min
  checar('na volta: entregou a Ana com 15 min de atraso, Bia ~13:05', 'previsaoVolta:13:05', `${pv[0]?.campo}:${pv[0]?.previsao}`);
}

console.log('\n═══ DIA SEM ROTA: FIM DE SEMANA E FERIADO NACIONAL ═══');
{
  const dia = (a, m, d) => new Date(a, m - 1, d);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  checar('Páscoa 2026 é 5 de abril', '2026-04-05', iso(pascoa(2026)));
  checar('Páscoa 2025 é 20 de abril', '2025-04-20', iso(pascoa(2025)));
  checar('Páscoa 2027 é 28 de março', '2027-03-28', iso(pascoa(2027)));
  checar('Carnaval 2026 (terça, 17/02)', { tipo: 'feriado', nome: 'Carnaval' }, diaSemRota(dia(2026, 2, 17)));
  checar('Sexta-feira Santa 2026 (03/04)', 'Sexta-feira Santa', diaSemRota(dia(2026, 4, 3))?.nome);
  checar('Corpus Christi 2026 (04/06)', 'Corpus Christi', diaSemRota(dia(2026, 6, 4))?.nome);
  checar('12 de outubro', 'Feriado: Nossa Senhora Aparecida', fraseDoDiaSemRota(diaSemRota(dia(2026, 10, 12))));
  checar('Consciência Negra conta desde 2024', 'Dia da Consciência Negra', diaSemRota(dia(2026, 11, 20))?.nome);
  checar('sábado', 'Hoje é sábado', fraseDoDiaSemRota(diaSemRota(dia(2026, 10, 3))));
  checar('domingo', 'Hoje é domingo', fraseDoDiaSemRota(diaSemRota(dia(2026, 10, 4))));
  checar('segunda comum é dia de aula', true, ehDiaDeAula(dia(2026, 10, 5)));
  checar('feriado na sexta não é dia de aula', false, ehDiaDeAula(dia(2026, 4, 3)));
  let iguais = true;
  for (let ano = 2024; ano <= 2040; ano += 1) {
    if (JSON.stringify(feriadosNacionais(ano)) !== JSON.stringify(calServidor.feriadosNacionais(ano))) iguais = false;
  }
  checar('espelho do servidor igual ao do app, 2024 a 2040', true, iguais);
}

console.log(`\n${'═'.repeat(64)}\n  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
