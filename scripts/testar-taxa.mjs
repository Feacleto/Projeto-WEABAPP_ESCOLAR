/**
 * A RÉGUA DA TAXA — o dinheiro que a plataforma cobra do motorista.
 *
 * POR QUE ESTE ARQUIVO NÃO EXISTIA ANTES
 * Não foi esquecimento: era IMPOSSÍVEL. As funções moravam em
 * `services/taxaService.js`, atrás de `import { db } from '../firebase/config'`,
 * e este script não consegue nem importar o módulo sem inicializar o Firebase.
 * Lógica pura trancada atrás de um import de Firebase é lógica intestável — e
 * aqui a lógica decide quanto cada parceiro paga, quando vence, e se está
 * isento.
 *
 * O preço disso já foi cobrado duas vezes no vizinho: o contrato de associação
 * saiu com valor ZERO em duas ocasiões diferentes, assinado com hash, por um
 * campo mal lido que nenhum teste podia pegar.
 *
 * COMO RODAR
 *   node scripts/testar-taxa.mjs      (ou: npm run testar:taxa)
 *
 * Sem emulador, sem rede, sem framework — o padrão desta casa.
 */

import {
  PADRAO,
  MODOS,
  limitarDiaVencimento,
  resumirBase,
  taxaPadrao,
  calcularTaxa,
  isentoEm,
  dataDeVencimento,
} from '../src/utils/taxa.js';

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

// ─────────────────────────── o dia do vencimento ───────────────────────────

bloco('1. O dia possível em QUALQUER mês');

checar('dia normal passa', 10, limitarDiaVencimento(10));
checar('o teto é 28, não 31', 28, limitarDiaVencimento(31));
// Dia 30 combinado em janeiro não existe em fevereiro, e empurrar pro mês
// seguinte faria a fatura de fevereiro vencer depois da de março.
checar('dia 30 vira 28', 28, limitarDiaVencimento(30));
checar('zero vira 1', 1, limitarDiaVencimento(0));
checar('negativo vira 1', 1, limitarDiaVencimento(-5));
checar('fração é truncada', 15, limitarDiaVencimento(15.9));
checar('texto vira o padrão da casa', PADRAO.diaVencimento, limitarDiaVencimento('abc'));
checar('ausente vira o padrão da casa', PADRAO.diaVencimento, limitarDiaVencimento(undefined));

bloco('2. O dia vira DATA no fechamento, e o fuso não pode roubar um dia');

// Meio-dia e não meia-noite: em 00:00 qualquer conversão de fuso de uma hora
// joga a data pro dia anterior, e a fatura passaria a vencer no dia 9.
const venc = dataDeVencimento('2026-08', { config: { diaVencimento: 10 } });
checar('mês certo (agosto = índice 7)', 7, venc.getMonth());
checar('dia certo', 10, venc.getDate());
checar('meio-dia, com folga de 12h pra cada lado', 12, venc.getHours());
checar('ano certo', 2026, venc.getFullYear());

// A negociação ganha da régua da casa.
const vencNegociado = dataDeVencimento('2026-08', {
  negociacao: { diaVencimento: 5 },
  config: { diaVencimento: 10 },
});
checar('a negociação vence a régua da casa', 5, vencNegociado.getDate());
checar('mês inválido devolve null', null, dataDeVencimento('nada-disso'));
checar('mês vazio devolve null', null, dataDeVencimento(''));

// ─────────────────────────── a base de cobrança ────────────────────────────

bloco('3. A base sai das crianças ATIVAS, e sem mensalidade não é sem criança');

const turma = [
  { monthlyFee: 300, active: true },
  { monthlyFee: 250, active: true },
  { monthlyFee: 0, active: true }, // cadastrada, valor ainda não combinado
  { monthlyFee: 400, active: false }, // saiu da perua
];
const base = resumirBase(turma);

checar('conta só as ativas', 3, base.criancas);
checar('a soma ignora quem está sem valor', 550, base.base);
checar('e diz quantas estão sem valor', 1, base.semMensalidade);
checar('a desativada não entra na base', true, base.base === 550);
checar('ticket médio divide pelas que TÊM valor', 275, base.ticketMedio);
// O contrato lê `mensalidadeMedia`; o painel lê `ticketMedio`. Mesmo número,
// dois vocabulários — e foi o nome faltando que zerou um contrato assinado.
checar('mensalidadeMedia é o mesmo número que ticketMedio', base.ticketMedio, base.mensalidadeMedia);
checar('menor mensalidade', 250, base.menor);
checar('maior mensalidade', 300, base.maior);

const vazia = resumirBase([]);
checar('turma vazia não divide por zero', 0, vazia.ticketMedio);
checar('turma vazia tem base zero', 0, vazia.base);
checar('lista ausente não estoura', 0, resumirBase(undefined).criancas);

// Centavo somado em ponto flutuante acumula erro, e a base multiplica tudo.
const comCentavo = resumirBase([
  { monthlyFee: 287.5, active: true },
  { monthlyFee: 287.5, active: true },
  { monthlyFee: 287.5, active: true },
]);
checar('soma de centavos fecha redonda', 862.5, comCentavo.base);

// ────────────────────────────── o cálculo ──────────────────────────────────

bloco('4. A régua da casa: percentual, com piso');

checar('percentual simples', 100, taxaPadrao(2000, { percentual: 5, piso: 25 }));
// Fatura de R$ 4,50 custa mais pra emitir e conferir do que rende.
checar('abaixo do piso, cobra o piso', 25, taxaPadrao(100, { percentual: 5, piso: 25 }));
checar('base zero cai no piso', 25, taxaPadrao(0, { percentual: 5, piso: 25 }));
// 2240 * 0.04 = 89.60000000000001 em ponto flutuante.
checar('arredonda pra centavo, uma vez só', 89.6, taxaPadrao(2240, { percentual: 4, piso: 0 }));

bloco('5. A negociação, e o que ela diz ao painel');

const cfg = { percentual: 5, piso: 25 };

const semNegociacao = calcularTaxa({ base: 2000, negociacao: null, config: cfg });
checar('sem negociação, cobra o padrão', 100, semNegociacao.cobrada);
checar('e marca que não foi negociada', false, semNegociacao.negociada);
checar('efetivo é o percentual real', 5, semNegociacao.efetivo);

const percentual = calcularTaxa({
  base: 2000, config: cfg,
  negociacao: { modo: MODOS.PERCENTUAL, valor: 4 },
});
checar('percentual negociado', 80, percentual.cobrada);
checar('delta contra o padrão', -20, percentual.delta);
checar('efetivo negociado', 4, percentual.efetivo);
checar('não é fixo, então acompanha crescimento', false, percentual.naoAcompanhaCrescimento);

const fixo = calcularTaxa({
  base: 2000, config: cfg,
  negociacao: { modo: MODOS.FIXO, valor: 150 },
});
checar('fixo ignora a base', 150, fixo.cobrada);
// Entra criança, a plataforma recebe o mesmo. A tela avisa; quem decide é o dono.
checar('fixo avisa que não acompanha crescimento', true, fixo.naoAcompanhaCrescimento);

bloco('6. Gratuidade é MODO, não valor zero — e a diferença aparece no painel');

const gratis = calcularTaxa({
  base: 2000, config: cfg,
  negociacao: { modo: MODOS.GRATUITO, valor: 0 },
});
checar('gratuito cobra zero', 0, gratis.cobrada);
checar('e se declara gratuito', true, gratis.gratuito);
// Sem esta exceção o painel alertaria o dono contra a própria escolha dele.
checar('gratuidade NÃO é "abaixo do piso"', false, gratis.abaixoDoPiso);

// O mesmo zero, sem o modo, é outra coisa: é preço mal negociado.
const zeroSemModo = calcularTaxa({
  base: 2000, config: cfg,
  negociacao: { modo: MODOS.PERCENTUAL, valor: 0 },
});
checar('zero sem modo cobra zero igual', 0, zeroSemModo.cobrada);
checar('mas ESSE dispara o alerta de piso', true, zeroSemModo.abaixoDoPiso);
checar('e não se declara gratuito', false, zeroSemModo.gratuito);

bloco('7. Base zero não vira NaN na tela');

const semBase = calcularTaxa({ base: 0, negociacao: null, config: cfg });
checar('efetivo com base zero é 0, não NaN', 0, semBase.efetivo);
checar('padrão efetivo com base zero é 0', 0, semBase.padraoEfetivo);

// ────────────────────────────── a isenção ──────────────────────────────────

bloco('8. A isenção cobre até um MÊS, inclusive ele');

const negoc = { isencaoAte: '2026-09' };
checar('mês anterior está isento', true, isentoEm(negoc, '2026-08'));
checar('o próprio mês do limite está isento', true, isentoEm(negoc, '2026-09'));
checar('o mês seguinte NÃO está', false, isentoEm(negoc, '2026-10'));
// Virada de ano: comparação de string 'YYYY-MM' ordena certo.
checar('dezembro contra janeiro do ano seguinte', false, isentoEm({ isencaoAte: '2026-12' }, '2027-01'));
checar('e janeiro do mesmo ano está dentro', true, isentoEm({ isencaoAte: '2026-12' }, '2026-01'));
checar('sem negociação não é erro, é zero isenção', false, isentoEm(null, '2026-08'));
checar('negociação sem isenção também', false, isentoEm({ modo: 'percentual' }, '2026-08'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
