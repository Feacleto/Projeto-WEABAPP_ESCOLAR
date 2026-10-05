/**
 * O RETRATO DA BASE — o que o Hoje e o Financeiro do painel do dono mostram
 * com a cobrança desligada.
 *
 * O QUE ELE TRAVA
 *   1. "rodou na semana" pela data, com a fronteira dos 7 dias e a data no
 *      futuro (relógio de aparelho errado) contando como NÃO;
 *   2. "pagaria por mês" nunca vira receita: quem nunca rodou não entra, o
 *      vitalício entra com zero, quem tem plano entra com o preço DELE e
 *      quem está no teste entra com a tabela do mensal, sem desconto;
 *   3. o suspenso não pagaria nada;
 *   4. o funil: cada degrau é subconjunto do anterior;
 *   5. onde o número não veio, `null` — nunca zero;
 *   6. a lista de assinantes: quem tem plano primeiro, depois o maior;
 *   7. o ESPELHO do servidor (`functions/lib/reguaDoRetrato.js`), que grava a
 *      foto diária: a mesma resposta caso a caso, o dia de Brasília e a foto
 *      sem uid nem nome.
 *
 * COMO RODAR
 *   node scripts/testar-retrato.mjs
 */

import {
  DIAS_DE_USO,
  jaRodou,
  linhasDosAssinantes,
  pagariaPorMes,
  planoDoAssinante,
  retratoDaBase,
  rodouNosUltimos,
  semanasDasFotos,
} from '../src/dominio/associacao/retratoDaBase.js';
import { FUNDADOR, ORIGEM, precoDaTabela, precoDoMes } from '../src/dominio/associacao/planos.js';
import { createRequire } from 'node:module';

// O espelho é CommonJS e régua pura (só requer `reguaDoServidor`): nenhum SDK
// no caminho, então ele pode entrar na bateria (ver `testar:imports`).
const servidor = createRequire(import.meta.url)('../functions/lib/reguaDoRetrato.js');

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

function bloco(t) {
  console.log('');
  console.log(t);
}

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-10-05');
const MES = '2026-10';

const nunca = { uid: 'a', name: 'Ana', criancasAtivas: 4 };
const parado = { uid: 'b', marcaNome: 'Tia Rose', name: 'Rose Lima', ultimaRota: dia('2026-09-20'), trialInicio: dia('2026-08-01'), criancasAtivas: 22 };
const ativoTeste = { uid: 'c', marcaNome: 'Tio Beto', ultimaRota: dia('2026-10-04'), trialInicio: dia('2026-09-20'), criancasAtivas: 9 };
const ativoMensal = {
  uid: 'd',
  marcaNome: 'Tio Nino',
  plano: 'mensal',
  ultimaRota: dia('2026-10-05'),
  trialInicio: dia('2026-08-12'),
  contratadoEm: dia('2026-08-20'),
  assinaturaAte: dia('2026-11-20'),
  criancasAtivas: 24,
  descontos: [{ origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: null, degrau: 1 }],
};
const vitalicio = {
  uid: 'e',
  marcaNome: 'Tia Lu',
  plano: 'mensal',
  condicaoFundador: FUNDADOR.VITALICIO,
  ultimaRota: dia('2026-10-02'),
  trialInicio: dia('2026-08-05'),
  assinaturaAte: dia('2027-08-05'),
  criancasAtivas: 27,
};
const suspenso = { uid: 'f', marcaNome: 'Tio Gil', suspenso: true, ultimaRota: dia('2026-10-03'), trialInicio: dia('2026-08-20'), criancasAtivas: 18 };

// ───────────────────────── 1. rodou na semana ──────────────────────────────
bloco('─── 1. rodou na semana, pela data ───');
checar('a janela é de 7 dias', 7, DIAS_DE_USO);
checar('rodou hoje conta', true, rodouNosUltimos(ativoMensal, HOJE));
checar('rodou há 6 dias e meio conta', true, rodouNosUltimos({ ultimaRota: new Date(HOJE.getTime() - 6.5 * 864e5) }, HOJE));
checar('rodou há exatos 7 dias já não conta', false, rodouNosUltimos({ ultimaRota: new Date(HOJE.getTime() - 7 * 864e5) }, HOJE));
checar('parado há 15 dias não conta', false, rodouNosUltimos(parado, HOJE));
checar('data no futuro NÃO conta (relógio errado)', false, rodouNosUltimos({ ultimaRota: dia('2026-12-01') }, HOJE));
checar('sem ultimaRota não conta', false, rodouNosUltimos(nunca, HOJE));
checar('aceita Timestamp do Firestore (toDate)', true, rodouNosUltimos({ ultimaRota: { toDate: () => dia('2026-10-03') } }, HOJE));
checar('jaRodou pelo relógio do teste, sem ultimaRota', true, jaRodou({ trialInicio: dia('2026-09-01') }));
checar('jaRodou: quem nunca rodou', false, jaRodou(nunca));

// ───────────────────────── 2. pagaria por mês ──────────────────────────────
bloco('─── 2. "pagaria" é potencial, nunca receita ───');
checar('quem nunca rodou não entra (null, não zero)', null, pagariaPorMes(nunca, MES));
checar('vitalício entra com zero (zero ali é medição)', 0, pagariaPorMes(vitalicio, MES));
checar(
  'quem tem plano entra com o preço DELE, desconto dentro',
  precoDoMes({ criancas: 24, plano: 'mensal', descontos: ativoMensal.descontos, mes: MES }).liquido,
  pagariaPorMes(ativoMensal, MES)
);
checar('o preço do Tio Nino é R$ 99,12 (24 × 5,90 − 30%)', 99.12, pagariaPorMes(ativoMensal, MES));
checar(
  'quem está no teste entra com a TABELA do mensal, sem desconto',
  precoDaTabela({ criancas: 9, plano: 'mensal' }),
  pagariaPorMes(ativoTeste, MES)
);
checar('teste pequeno paga o mínimo de tabela (R$ 49)', 49, pagariaPorMes({ trialInicio: HOJE, criancasAtivas: 3 }, MES));

// ───────────────────────── 3. o retrato ────────────────────────────────────
bloco('─── 3. o retrato da base ───');
const base = [nunca, parado, ativoTeste, ativoMensal, vitalicio, suspenso];
const r = retratoDaBase({
  parceiros: base,
  agora: HOJE,
  mes: MES,
  criancasAtivas: 104,
  criancasComFamilia: 70,
  baixasNoMes: 41,
});
checar('motoristas cadastrados', 6, r.motoristas);
checar('já rodaram alguma vez', 5, r.rodaram);
checar('rodaram na semana', 4, r.rodaramNaSemana);
checar('nunca rodaram', 1, r.nuncaRodaram);
checar('planos: um vitalício, um mensal, quatro em teste', { vitalicio: 1, mensal: 1, anual: 0, teste: 4 }, r.planos);
checar('assinantes = vitalício + mensal + anual', 2, r.assinantes);
checar(
  'pagaria: suspenso e quem nunca rodou ficam FORA',
  Math.round((pagariaPorMes(parado, MES) + pagariaPorMes(ativoTeste, MES) + 99.12 + 0) * 100) / 100,
  r.pagariaPorMes
);
checar('fração com família', 70 / 104, r.fracaoComFamilia);
checar('baixas do mês passam como vieram', 41, r.baixasNoMes);

// ───────────────────────── 4. o funil ──────────────────────────────────────
bloco('─── 4. o funil é de subconjuntos ───');
checar('degraus', [6, 5, 4, 2], r.funil.map((f) => f.n));
checar('nenhum degrau passa o anterior', true, r.funil.every((f, i) => i === 0 || f.n <= r.funil[i - 1].n));
{
  // Quem tem plano e PAROU de rodar não entra no último degrau, senão ele
  // passaria o de cima.
  const so = retratoDaBase({ parceiros: [{ ...ativoMensal, ultimaRota: dia('2026-09-01') }], agora: HOJE, mes: MES });
  checar('assinante parado não fura o funil', [1, 1, 0, 0], so.funil.map((f) => f.n));
}

// ───────────────────────── 5. null, nunca zero ─────────────────────────────
bloco('─── 5. onde o número não veio, null ───');
const vazio = retratoDaBase({ parceiros: [], agora: HOJE, mes: MES });
checar('base vazia: pagaria é null', null, vazio.pagariaPorMes);
checar('contagens que não vieram ficam null', [null, null, null], [vazio.criancasAtivas, vazio.criancasComFamilia, vazio.baixasNoMes]);
checar('sem crianças ativas, a fração é null', null, retratoDaBase({ parceiros: [], criancasAtivas: 0, criancasComFamilia: 0 }).fracaoComFamilia);
checar('com família acima do total é cortado em 100%', 1, retratoDaBase({ parceiros: [], criancasAtivas: 10, criancasComFamilia: 12 }).fracaoComFamilia);
checar('sem argumentos não quebra', 0, retratoDaBase().motoristas);

// ───────────────────────── 6. a lista de assinantes ────────────────────────
bloco('─── 6. a lista de assinantes ───');
const linhas = linhasDosAssinantes({ parceiros: base, agora: HOJE, mes: MES });
checar('vitalício, mensal e depois o teste do maior para o menor', ['Tia Lu', 'Tio Nino', 'Tia Rose', 'Tio Gil', 'Tio Beto', 'Ana'], linhas.map((l) => l.nome));
checar('o nome é a marca; o civil vem junto', ['Tia Rose', 'Rose Lima'], [linhas[2].nome, linhas[2].nomeCivil]);
checar('o desconto travado aparece', 0.3, linhas[1].descontoTravado);
checar('suspenso aparece como suspenso', 'suspenso', linhas.find((l) => l.uid === 'f').degrau);
checar('plano do vitalício', 'vitalicio', planoDoAssinante(vitalicio));
checar('plano de quem está no teste', 'teste', planoDoAssinante(ativoTeste));

// ───────────────────────── 7. o espelho do servidor ────────────────────────
bloco('─── 7. o espelho do servidor: a foto diária ───');
{
  const app = { jaRodou, rodouNosUltimos, planoDoAssinante, pagariaPorMes };
  const planosM = [undefined, 'mensal', 'anual', 'bimestral'];
  const fundadores = [null, 'vitalicio', 'metade'];
  const ultimas = [null, dia('2026-10-05'), dia('2026-09-29'), dia('2026-09-28'), dia('2026-12-01')];
  const descontosM = [
    undefined,
    [{ origem: 'fechamento', fracao: 0.3, ate: null, degrau: 1 }],
    [{ origem: 'concessao', fracao: 0.2, ate: '2026-09' }],
  ];
  const matriz = [];
  let n = 0;
  for (const plano of planosM)
    for (const condicaoFundador of fundadores)
      for (const ultimaRota of ultimas)
        for (const d of descontosM)
          for (const criancasAtivas of [0, 3, 9, 24, 41, 60]) {
            n += 1;
            matriz.push({
              uid: `p${n}`,
              plano,
              condicaoFundador,
              ultimaRota,
              trialInicio: n % 3 ? dia('2026-08-01') : null,
              descontos: d,
              indicacoesAtivas: n % 4,
              criancasAtivas,
              suspenso: n % 11 === 0,
            });
          }
  const divergem = matriz.filter((p) => {
    const a = [app.jaRodou(p), app.rodouNosUltimos(p, HOJE), app.planoDoAssinante(p), app.pagariaPorMes(p, MES)];
    const sv = [servidor.jaRodou(p), servidor.rodouNosUltimos(p, HOJE), servidor.planoDoAssinante(p), servidor.pagariaPorMes(p, MES)];
    return JSON.stringify(a) !== JSON.stringify(sv);
  });
  checar(`o espelho responde igual nos ${matriz.length} motoristas da matriz`, [], divergem.map((p) => p.uid));

  const args = { parceiros: matriz, agora: HOJE, mes: MES, criancasAtivas: 900, criancasComFamilia: 610, baixasNoMes: 412 };
  const semFunil = ({ funil: _f, ...resto }) => resto;
  checar('o retrato inteiro bate (o funil é só da tela)', semFunil(retratoDaBase(args)), servidor.retratoDaBase(args));
  checar('base vazia bate', semFunil(retratoDaBase()), servidor.retratoDaBase());
  checar('a janela de uso é a mesma', DIAS_DE_USO, servidor.DIAS_DE_USO);

  checar('23h50 de Brasília (02:50 UTC) ainda é o dia de Brasília', '2026-10-05', servidor.chaveDoDia(new Date('2026-10-06T02:50:00Z')));
  checar('00h10 de Brasília já é o dia seguinte', '2026-10-06', servidor.chaveDoDia(new Date('2026-10-06T03:10:00Z')));
  checar('o mês das baixas sai do dia de Brasília', '2026-10', servidor.mesDoDia(new Date('2026-11-01T02:00:00Z')));

  const foto = servidor.fotoDoDia(servidor.retratoDaBase(args), new Date('2026-10-06T02:50:00Z'));
  checar(
    'a foto tem SÓ os campos da lista fechada',
    ['assinantes', 'baixasNoMes', 'criancasAtivas', 'criancasComFamilia', 'dia', 'motoristas', 'pagariaPorMes', 'planos', 'rodaram', 'rodaramNaSemana'],
    Object.keys(foto).sort()
  );
  checar('nenhum uid ou nome escapa para a foto', false, /"uid"|"name"|"marcaNome"|"p\d+"/.test(JSON.stringify(foto)));
  checar('o id da foto é o dia de Brasília', '2026-10-05', foto.dia);
  checar('contagem que não veio fica null na foto', null, servidor.fotoDoDia({ motoristas: 1 }).criancasAtivas);
}

// ───────────────────────── 8. uma barra por semana ─────────────────────────
bloco('─── 8. a evolução: a última foto de cada semana ───');
{
  const f = (dia, r) => ({ dia, rodaramNaSemana: r, motoristas: 60 });
  const fotos = [f('2026-09-21', 30), f('2026-09-27', 33), f('2026-09-28', 34), f('2026-10-04', 38), f('2026-10-05', 39)];
  const s = semanasDasFotos(fotos);
  checar('segunda 21/09 a domingo 27/09 é uma semana', ['2026-09-21', '2026-09-28', '2026-10-05'], s.map((x) => x.semana));
  checar('vale a ÚLTIMA foto da semana, nunca a soma', [33, 38, 39], s.map((x) => x.rodaramNaSemana));
  checar('fora de ordem dá o mesmo', s, semanasDasFotos([...fotos].reverse()));
  checar('semana sem foto não vira zero, some', 2, semanasDasFotos([f('2026-08-03', 5), f('2026-10-05', 9)]).length);
  checar('só as últimas N semanas', ['2026-09-28', '2026-10-05'], semanasDasFotos(fotos, 2).map((x) => x.semana));
  checar('foto com dia torto é ignorada', 0, semanasDasFotos([{ dia: '05/10/2026', rodaramNaSemana: 3 }, { rodaramNaSemana: 1 }]).length);
  checar('sem fotos, lista vazia', [], semanasDasFotos());
}

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
