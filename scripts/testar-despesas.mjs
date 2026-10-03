/**
 * O histórico da folha de despesa — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:despesas
 *
 * POR QUE ISTO EXISTE
 * A folha "Lançar despesa" afirma coisas sobre o passado dele: quando foi o
 * último abastecimento, quanto a perua rodou desde então, quanto a auxiliar
 * ganhou. A forma cara de errar é INVENTAR — "rodou 0 km" sem dado, ou o km
 * das rotas para quem também usa a perua no fim de semana. Este teste trava
 * que, sem duas leituras do MESMO contador, nenhum número sai.
 */
import {
  USO_DA_PERUA,
  diasDesde,
  haQuanto,
  kmDesdeOUltimo,
  fraseDoKm,
  leituraDeKm,
  maisLancados,
  mesAnterior,
  normalizarNome,
  salariosRecentes,
  sugestaoDeSalario,
  ultimaDaCategoria,
} from '../src/dominio/cobranca/historicoDeDespesas.js';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}

const hoje = new Date(2026, 9, 3, 9, 0);
const dia = (m, d, h = 12) => ({ toDate: () => new Date(2026, m - 1, d, h) });

console.log('\n1. quanto tempo faz');
igual('mesmo dia', diasDesde(new Date(2026, 9, 3, 23), hoje), 0);
igual('ontem à noite é 1 dia', diasDesde(new Date(2026, 9, 2, 23), hoje), 1);
igual('hoje', haQuanto(dia(10, 3), hoje), 'hoje');
igual('ontem', haQuanto(dia(10, 2), hoje), 'ontem');
igual('dias', haQuanto(dia(9, 28), hoje), 'há 5 dias');
igual('semanas', haQuanto(dia(8, 12), hoje), 'há 7 semanas');
igual('meses', haQuanto(dia(6, 1), hoje), 'há 4 meses');
igual('sem data', haQuanto(null, hoje), '');

console.log('2. a última da categoria');
const lista = [
  { id: 1, category: 'fuel', amount: 250, date: dia(9, 14), kmContador: 1000, kmPainel: 52000 },
  { id: 2, category: 'fuel', amount: 280, date: dia(9, 28), kmContador: 1500, kmPainel: 52600 },
  { id: 3, category: 'maintenance', amount: 420, date: dia(8, 12), description: 'Troca de óleo' },
  { id: 4, category: 'fuel', amount: 10, date: null },
];
igual('a mais recente', ultimaDaCategoria(lista, 'fuel').id, 2);
igual('outra categoria', ultimaDaCategoria(lista, 'maintenance').id, 3);
igual('nenhuma', ultimaDaCategoria(lista, 'tax'), null);
igual('lista vazia', ultimaDaCategoria(null, 'fuel'), null);

console.log('3. o km — nunca inventado');
const ultima = ultimaDaCategoria(lista, 'fuel');
igual('só nas rotas: contador agora − contador gravado',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.SO_ROTA, kmDasRotas: 1912.4 }), { km: 412, fonte: 'rotas' });
igual('só nas rotas ignora o painel digitado',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.SO_ROTA, kmDasRotas: 1600, kmPainelAgora: 99999 }), { km: 100, fonte: 'rotas' });
igual('ponto não é milhar: a folha só deixa digitar dígitos',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.TAMBEM_FORA, kmDasRotas: 1912, kmPainelAgora: '53.012' }), null);
igual('também fora com número',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.TAMBEM_FORA, kmDasRotas: 1912, kmPainelAgora: '53012' }), { km: 412, fonte: 'painel' });
igual('também fora NUNCA usa o contador das rotas',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.TAMBEM_FORA, kmDasRotas: 1912 }), null);
igual('sem resposta à pergunta, sem número',
  kmDesdeOUltimo({ ultima, uso: undefined, kmDasRotas: 1912 }), null);
igual('último lançamento sem contador gravado',
  kmDesdeOUltimo({ ultima: { kmPainel: 1 }, uso: USO_DA_PERUA.SO_ROTA, kmDasRotas: 1912 }), null);
igual('sem contador agora', kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.SO_ROTA }), null);
igual('diferença negativa não vira número',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.TAMBEM_FORA, kmPainelAgora: 100 }), null);
igual('sem último lançamento', kmDesdeOUltimo({ ultima: null, uso: USO_DA_PERUA.SO_ROTA, kmDasRotas: 10 }), null);
igual('zero rodado é número de verdade',
  kmDesdeOUltimo({ ultima, uso: USO_DA_PERUA.SO_ROTA, kmDasRotas: 1500 }), { km: 0, fonte: 'rotas' });
igual('frase das rotas', fraseDoKm({ km: 3180, fonte: 'rotas' }), 'Desde então a perua rodou 3.180 km nas rotas');
igual('frase do painel', fraseDoKm({ km: 412, fonte: 'painel' }), 'Desde então a perua rodou 412 km pelo painel');
igual('sem km, sem frase', fraseDoKm(null), '');
igual('leitura vazia', leituraDeKm(''), null);
igual('leitura negativa', leituraDeKm(-3), null);
igual('leitura com vírgula', leituraDeKm('12,5'), 12.5);

console.log('4. o que ele mais lança em Outros');
const outros = [
  { category: 'other', description: 'Pedágio', date: dia(10, 2) },
  { category: 'other', description: 'pedagio ', date: dia(9, 20) },
  { category: 'other', description: 'PEDÁGIO', date: dia(9, 10) },
  { category: 'other', description: 'Lavagem', date: dia(9, 25) },
  { category: 'other', description: 'Estacionamento', date: dia(9, 1) },
  { category: 'other', description: 'Lavagem', date: dia(8, 25) },
  { category: 'other', description: 'Estacionamento', date: dia(8, 1) },
  { category: 'other', description: '', date: dia(8, 1) },
  { category: 'fuel', description: 'Pedágio', date: dia(8, 1) },
  { category: 'other', description: 'Multa', date: dia(7, 1) },
];
igual('normaliza caixa e acento', normalizarNome('  PEDÁGIO  da  Imigrantes'), 'pedagio da imigrantes');
igual('conta, ordena e mostra a grafia mais recente', maisLancados(outros, { limite: 3 }), [
  { nome: 'Pedágio', vezes: 3 },
  { nome: 'Lavagem', vezes: 2 },
  { nome: 'Estacionamento', vezes: 2 },
]);
igual('limite', maisLancados(outros, { limite: 1 }).length, 1);
igual('nome vazio e outra categoria não contam', maisLancados(outros, { limite: 10 }).reduce((n, q) => n + q.vezes, 0), 8);

console.log('5. o salário da auxiliar');
const salarios = [
  { category: 'monitor', amount: 900, monthKey: '2026-09' },
  { category: 'monitor', amount: 450, monthKey: '2026-08' },
  { category: 'monitor', amount: 450, monthKey: '2026-08' },
  { category: 'monitor', amount: 850, date: dia(7, 5) },
  { category: 'monitor', amount: 800, monthKey: '2026-06' },
  { category: 'monitor', amount: 950, monthKey: '2026-10' },
  { category: 'fuel', amount: 300, monthKey: '2026-09' },
];
igual('três meses antes do atual, somados', salariosRecentes(salarios, '2026-10'), [
  { mes: '2026-09', valor: 900 },
  { mes: '2026-08', valor: 900 },
  { mes: '2026-07', valor: 850 },
]);
igual('sugestão é o do mês passado', sugestaoDeSalario(salarios, '2026-10'), 900);
igual('mês passado sem lançamento: sem sugestão', sugestaoDeSalario(salarios, '2026-12'), null);
igual('mês anterior vira o ano', mesAnterior('2026-01'), '2025-12');

console.log(`\n${ok} ok, ${bad} falharam`);
process.exit(bad ? 1 : 0);
