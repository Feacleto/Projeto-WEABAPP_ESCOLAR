/**
 * O extrato do caixa — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:extrato
 *
 * POR QUE ISTO EXISTE
 * O caixa do motorista virou um extrato de banco (03/10/2026): entrou e saiu,
 * por dia, com "Hoje" e "Ontem". As três formas de ele mentir são as que este
 * teste trava: contar como entrada o que ainda não é dinheiro na mão (quem só
 * AVISOU que pagou), perder uma linha sem data, e misturar a ordem dos dias.
 */
import { montarExtrato, rotuloDoDia, chaveDoDia } from '../src/dominio/cobranca/extratoDoMes.js';

let ok = 0;
let bad = 0;
function igual(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) ok++;
  else {
    bad++;
    console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
  }
}

const hoje = new Date(2026, 9, 3, 15, 0);
const em = (d, h = 10) => new Date(2026, 9, d, h, 0);
const ts = (d, h) => ({ toDate: () => em(d, h) });
const rotulos = { fuel: 'Combustível', monitor: 'Salário da auxiliar', other: 'Outros' };

console.log('\n1. o rótulo do dia');
igual('hoje', rotuloDoDia('2026-10-03', hoje), 'Hoje, 03/10');
igual('ontem', rotuloDoDia('2026-10-02', hoje), 'Ontem, 02/10');
igual('antes', rotuloDoDia('2026-10-01', hoje), '01/10');
igual('ontem atravessa o mês', rotuloDoDia('2026-09-30', new Date(2026, 9, 1, 8)), 'Ontem, 30/09');
igual('chave local', chaveDoDia(em(3, 23)), '2026-10-03');
igual('chave de lixo', chaveDoDia('não é data'), null);

console.log('2. o que entra');
const pagamentos = [
  { id: 'a', status: 'paid', amount: 350, childName: 'Miguel', paymentMethod: 'pix', paidAt: ts(3, 9) },
  { id: 'b', status: 'paid', amount: 350, childName: 'Laura', paymentMethod: 'cash', paidAt: ts(2, 18) },
  { id: 'c', _display: 'claimed', status: 'claimed', amount: 350, childName: 'Sofia' },
  { id: 'd', _display: 'overdue', status: 'pending', amount: 350, childName: 'Lucas' },
  { id: 'e', status: 'paid', amount: 320, childName: 'Pedro', paymentMethod: 'card', paidAt: ts(1, 8) },
];
const despesas = [
  { id: 'x', amount: 280, category: 'fuel', date: ts(3, 7) },
  { id: 'y', amount: 900, category: 'monitor', date: ts(1, 12) },
  { id: 'z', amount: 18.4, category: 'other', description: 'Pedágio', date: ts(2, 9) },
];
const r = montarExtrato({ pagamentos, despesas, rotulos, hoje });
igual('entrou só o pago', r.entrou, 1020);
igual('saiu soma as despesas', r.saiu, 1198.4);
igual('avisou que pagou não entra', r.grupos.flatMap((g) => g.movimentos).some((m) => m.titulo.includes('Sofia')), false);
igual('atrasado não entra', r.grupos.flatMap((g) => g.movimentos).some((m) => m.titulo.includes('Lucas')), false);
igual('dias do mais novo ao mais velho', r.grupos.map((g) => g.rotulo), ['Hoje, 03/10', 'Ontem, 02/10', '01/10']);
igual('dentro do dia, mais novo primeiro', r.grupos[0].movimentos.map((m) => m.id), ['p:a', 'd:x']);
igual('forma do pagamento', r.grupos[1].movimentos.find((m) => m.id === 'p:b').detalhe, 'Dinheiro');
igual('cartão', r.grupos[2].movimentos.find((m) => m.id === 'p:e').detalhe, 'Cartão');
igual('título da mensalidade', r.grupos[0].movimentos[0].titulo, 'Mensalidade · Miguel');
igual('despesa sem nome leva a categoria', r.grupos[0].movimentos[1], {
  id: 'd:x', tipo: 'saida', titulo: 'Combustível', detalhe: 'Despesa', valor: 280, quando: em(3, 7),
});
const pedagio = r.grupos[1].movimentos.find((m) => m.id === 'd:z');
igual('despesa com nome: o nome e a categoria', [pedagio.titulo, pedagio.detalhe], ['Pedágio', 'Outros']);
igual('auxiliar com o nome dela', r.grupos[2].movimentos.find((m) => m.id === 'd:y').titulo, 'Salário da auxiliar');
igual('valor sempre positivo', r.grupos.flatMap((g) => g.movimentos).every((m) => m.valor > 0), true);

console.log('3. o que não tem data');
const semData = montarExtrato({
  pagamentos: [{ id: 's', status: 'paid', amount: 100, childName: 'Ana' }],
  despesas: [],
  rotulos,
  hoje,
});
igual('não some: grupo "Sem data"', semData.grupos.map((g) => g.rotulo), ['Sem data']);
const baixaPendente = montarExtrato({
  pagamentos: [{ id: 'p', status: 'paid', amount: 100, childName: 'Ana', paidAt: null, claimedAt: ts(2, 8) }],
  hoje,
});
igual('baixa sem hora do servidor cai no aviso', baixaPendente.grupos[0].rotulo, 'Ontem, 02/10');
const categoriaDesconhecida = montarExtrato({ despesas: [{ id: 'q', amount: 5, category: 'xyz', date: ts(3) }], rotulos, hoje });
igual('categoria desconhecida vira Outros', categoriaDesconhecida.grupos[0].movimentos[0].titulo, 'Outros');
igual('nada', montarExtrato({ hoje }), { grupos: [], entrou: 0, saiu: 0 });
igual('centavos', montarExtrato({ despesas: [{ id: 1, amount: 0.1, date: ts(1) }, { id: 2, amount: 0.2, date: ts(1) }], hoje }).saiu, 0.3);

console.log(`\n${ok} ok, ${bad} falharam`);
process.exit(bad ? 1 : 0);
