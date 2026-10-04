/**
 * A TRANCA DO FINANCEIRO — quando o app volta a pedir a senha (03/10/2026).
 *
 * Mede a régua pura `src/dominio/identidade/trancaDoFinanceiro.js` em cada
 * transição que o dono descreveu, e as duas réguas da tela trancada: o selo
 * do plano (`seloDoPlano`) e a turma do mês (`movimentoDaTurma`).
 *
 * O caso que justifica o arquivo é o do VOLTAR: quem entrou direto na turma
 * pela tela trancada e volta ao caixa precisa cair de novo na tela trancada —
 * e quem entrou pelo caixa e foi a uma subtela volta ao caixa aberto. As duas
 * metades são testadas, porque uma régua que sempre tranca passaria na
 * primeira.
 *
 * COMO RODAR
 *   node scripts/testar-tranca.mjs      (ou: npm run testar:tranca)
 */
import {
  CAIXA,
  TAXA,
  TURMA,
  PEDIR_SENHA,
  TOLERANCIA_DO_SEGUNDO_PLANO_MS,
  aoMudarDeRota,
  aoVoltarDoSegundoPlano,
  destravar,
  estadoTrancado,
  normalizarCaminho,
  preferenciaValida,
  prazoDaPreferencia,
  rotaProtegida,
} from '../src/dominio/identidade/trancaDoFinanceiro.js';
import { seloDoPlano } from '../src/dominio/associacao/seloDoPlano.js';

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
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const MIN = 60 * 1000;
const T0 = 1_000_000_000;
const aberto = (destino = CAIXA) => destravar(destino);
const ir = (estado, de, para, { agora = T0, preferencia = PEDIR_SENHA.SEMPRE } = {}) =>
  aoMudarDeRota(estado, { de, para, agora, preferencia });

bloco('1. Que rota pede senha');
checar('/tio/finance', true, rotaProtegida('/tio/finance'));
checar('/tio/finance/ (barra no fim)', true, rotaProtegida('/tio/finance/'));
checar('/tio/finance/turma', true, rotaProtegida('/tio/finance/turma'));
checar('/tio/finance/expenses', true, rotaProtegida('/tio/finance/expenses'));
checar('/tio/finance/report', true, rotaProtegida('/tio/finance/report'));
checar('/tio/taxa', true, rotaProtegida('/tio/taxa'));
checar('/tio/taxa?x=1', true, rotaProtegida('/tio/taxa?x=1'));
checar('/tio/pix (trocar a chave PIX pede senha)', true, rotaProtegida('/tio/pix'));
checar('/tio/pix/ (barra no fim)', true, rotaProtegida('/tio/pix/'));
checar('/tio/pixel não (startsWith casaria)', false, rotaProtegida('/tio/pixel'));
checar('/tio (Início) não', false, rotaProtegida('/tio'));
checar('/tio/financeiro não (startsWith casaria)', false, rotaProtegida('/tio/financeiro'));
checar('/tio/taxas não', false, rotaProtegida('/tio/taxas'));
checar('/tio/planos não', false, rotaProtegida('/tio/planos'));
checar('/pai/finance não (é da família)', false, rotaProtegida('/pai/finance'));
checar('normaliza a barra do fim', CAIXA, normalizarCaminho('/tio/finance/'));

bloco('2. A preferência do aparelho');
checar('padrão é sempre', 'sempre', preferenciaValida(null));
checar('valor estranho vira sempre', 'sempre', preferenciaValida('1h'));
checar('5min fica', '5min', preferenciaValida('5min'));
checar('prazo de sempre é 0', 0, prazoDaPreferencia('sempre'));
checar('prazo de 5min', 5 * MIN, prazoDaPreferencia('5min'));
checar('prazo de 30min', 30 * MIN, prazoDaPreferencia('30min'));

bloco('3. Sair tranca');
checar('trancado continua trancado', false, ir(estadoTrancado(), CAIXA, '/tio').destravado);
checar('sempre: sair para o Início tranca na hora', false, ir(aberto(), CAIXA, '/tio').destravado);
checar('sempre: sair da taxa tranca', false, ir(aberto(TAXA), TAXA, '/tio').destravado);
{
  const fora = ir(aberto(), CAIXA, '/tio', { preferencia: '5min' });
  checar('5min: sair não tranca, anota a hora', { destravado: true, saiuEm: T0 }, {
    destravado: fora.destravado,
    saiuEm: fora.saiuEm,
  });
  const volta4 = ir(fora, '/tio', CAIXA, { agora: T0 + 4 * MIN, preferencia: '5min' });
  checar('5min: voltar em 4 minutos entra direto', true, volta4.destravado);
  checar('e a hora de saída é limpa', null, volta4.saiuEm);
  checar('5min: voltar em 6 minutos tranca', false,
    ir(fora, '/tio', CAIXA, { agora: T0 + 6 * MIN, preferencia: '5min' }).destravado);
  const fora30 = ir(aberto(), CAIXA, '/tio', { preferencia: '30min' });
  checar('30min: voltar em 29 minutos entra', true,
    ir(fora30, '/tio', CAIXA, { agora: T0 + 29 * MIN, preferencia: '30min' }).destravado);
  checar('30min: voltar em 31 minutos tranca', false,
    ir(fora30, '/tio', CAIXA, { agora: T0 + 31 * MIN, preferencia: '30min' }).destravado);
  checar('andar entre telas de fora não muda nada', fora,
    ir(fora, '/tio', '/tio/children', { preferencia: '5min' }));
  checar('trocar a preferência para sempre fora: a volta tranca', false,
    ir(fora, '/tio', CAIXA, { agora: T0 + 1000, preferencia: 'sempre' }).destravado);
}

bloco('4. Voltar dentro do Financeiro (a regra do dono)');
{
  const pelaTurma = aberto(TURMA);
  checar('entrar direto na turma marca entrada direta', true, pelaTurma.entradaDireta);
  checar('entrar pelo caixa não marca', false, aberto(CAIXA).entradaDireta);
  // O Buzi vale como o caixa: ele leva ao caixa, e pedir a senha de novo
  // nesse toque seria pedir duas vezes para a mesma coisa (04/10/2026).
  checar('entrar pelo Buzi não marca', false, aberto('/tio/finance/buzi').entradaDireta);
  checar('entrar pelo caixa com barra no fim não marca', false, aberto('/tio/finance/').entradaDireta);
  checar('entrou direto na turma e voltou ao caixa: TRANCA', false,
    ir(pelaTurma, TURMA, CAIXA).destravado);
  checar('entrou direto na taxa e voltou ao caixa: TRANCA', false,
    ir(aberto(TAXA), TAXA, CAIXA).destravado);
  checar('entrou direto na turma e foi às despesas: segue aberto', true,
    ir(pelaTurma, TURMA, '/tio/finance/expenses').destravado);
  const peloCaixa = aberto(CAIXA);
  const naTurma = ir(peloCaixa, CAIXA, TURMA);
  checar('pelo caixa, ir à turma: aberto', true, naTurma.destravado);
  checar('pelo caixa, voltar da turma ao caixa: CONTINUA ABERTO', true,
    ir(naTurma, TURMA, CAIXA).destravado);
  checar('pelo caixa, ir à taxa e voltar: aberto', true,
    ir(ir(peloCaixa, CAIXA, TAXA), TAXA, CAIXA).destravado);
  checar('a mesma rota de novo não muda nada', pelaTurma, ir(pelaTurma, TURMA, TURMA));
  // Entrada direta que sai e volta dentro do prazo cai no caixa ABERTO: a
  // regra do voltar é sobre andar DENTRO do Financeiro.
  const fora = ir(pelaTurma, TURMA, '/tio', { preferencia: '5min' });
  checar('entrada direta, saiu e voltou no prazo pela aba: aberto', true,
    ir(fora, '/tio', CAIXA, { agora: T0 + MIN, preferencia: '5min' }).destravado);
}

bloco('5. O segundo plano');
{
  const base = { naRotaProtegida: true, preferencia: 'sempre' };
  checar('sempre: escolher uma foto (10 s) não tranca', true,
    aoVoltarDoSegundoPlano(aberto(), { ...base, escondeuEm: T0, agora: T0 + 10_000 }).destravado);
  checar('sempre: passou da tolerância, tranca', false,
    aoVoltarDoSegundoPlano(aberto(), {
      ...base, escondeuEm: T0, agora: T0 + TOLERANCIA_DO_SEGUNDO_PLANO_MS + 1,
    }).destravado);
  checar('5min: 4 minutos escondido, aberto', true,
    aoVoltarDoSegundoPlano(aberto(), {
      ...base, preferencia: '5min', escondeuEm: T0, agora: T0 + 4 * MIN,
    }).destravado);
  checar('5min: 6 minutos escondido, tranca', false,
    aoVoltarDoSegundoPlano(aberto(), {
      ...base, preferencia: '5min', escondeuEm: T0, agora: T0 + 6 * MIN,
    }).destravado);
  checar('fora das rotas protegidas o segundo plano não decide', true,
    aoVoltarDoSegundoPlano(aberto(), {
      ...base, naRotaProtegida: false, escondeuEm: T0, agora: T0 + 60 * MIN,
    }).destravado);
  checar('sem hora de esconder, nada muda', true,
    aoVoltarDoSegundoPlano(aberto(), { ...base, escondeuEm: null, agora: T0 }).destravado);
}

bloco('6. O selo do plano (sem valor em reais)');
{
  const agora = new Date(2026, 9, 3, 12);
  checar('mensal sem fatura: Em dia', { nome: 'Mensal', selo: 'Em dia', tom: 'ok' },
    seloDoPlano({ plano: 'mensal', agora }));
  checar('anual com fatura ainda a vencer: Em dia', 'Em dia',
    seloDoPlano({ plano: 'anual', fatura: { status: 'aberta', vencimento: new Date(2026, 9, 10) }, agora }).selo);
  checar('mensal com fatura vencida: Atrasado', 'Atrasado',
    seloDoPlano({ plano: 'mensal', fatura: { status: 'aberta', vencimento: new Date(2026, 8, 25) }, agora }).selo);
  checar('mensal com fatura quitada: Em dia', 'Em dia',
    seloDoPlano({ plano: 'mensal', fatura: { status: 'quitada', vencimento: new Date(2026, 8, 25) }, agora }).selo);
  checar('sem plano, teste rodando: Em teste', 'Em teste',
    seloDoPlano({ trialInicio: new Date(2026, 8, 1), agora }).selo);
  checar('sem plano, teste nem começou: Em teste', 'Em teste', seloDoPlano({ agora }).selo);
  checar('sem plano, teste acabou: Teste acabou', 'Teste acabou',
    seloDoPlano({ trialInicio: new Date(2026, 0, 1), agora }).selo);
  checar('nenhum selo fala em reais', false,
    JSON.stringify(seloDoPlano({ plano: 'mensal', agora })).includes('R$'));
}

// A turma do mês é medida em scripts/testar-turma.mjs: a régua é uma só.

console.log(`\n${ok} ok, ${bad} falha(s)`);
if (bad) {
  console.log(falhas.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
