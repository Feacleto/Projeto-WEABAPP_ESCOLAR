/**
 * O CONTEÚDO DO CONTRATO DE ASSOCIAÇÃO — o documento que o motorista assina.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Este contrato saiu com valor ZERO duas vezes, em duas causas diferentes, e
 * as duas vezes ele foi hasheado com SHA-256 e aceito eletronicamente. Um
 * documento assinado dizendo que o associado não deve nada.
 *
 * As duas passaram pelo mesmo buraco de forma: `montarContrato` é pura, mas
 * morava dentro de um service que importa Firestore — e este projeto testa com
 * scripts Node puros, então nenhum teste conseguia sequer importá-la.
 *
 * O CASO QUE MAIS IMPORTA AQUI é o bloco 2. Ele afirma que um contrato MENSAL
 * com carência cobra a mensalidade cheia: a carência adia o início, não zera o
 * preço. Quem "simplificar" `mesesCobrados` de volta para
 * `max(0, mesesDoPeriodo - carencia)` derruba exatamente esse bloco.
 *
 * COMO RODAR
 *   node scripts/testar-contrato.mjs      (ou: npm run testar:contrato)
 */

import {
  VERSAO_CONTRATO,
  montarContrato,
  diasParaVencer,
  precisaRenovar,
} from '../src/utils/contratoAssociacao.js';

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

const motorista = {
  uid: 'tio1',
  name: 'Nino da Silva',
  city: 'Santo André',
  email: 'nino@x.com',
  phone: '11999990000',
};

// 10 crianças × R$ 300 = base de R$ 3.000.
const base = { criancas: 10, mensalidadeMedia: 300 };
const config = { diaVencimento: 10 };

// 6% de 3.000 = R$ 180/mês.
const seisPorCento = { modo: 'percentual', valor: 6, periodicidade: 'mensal' };

bloco('1. O contrato mensal sem carência');

const simples = montarContrato({ motorista, negociacao: seisPorCento, base, config });
checar('versão do contrato viaja dentro dele', VERSAO_CONTRATO, simples.versao);
checar('valor por período é a mensalidade', 180, simples.taxa.valorPorPeriodo);
checar('valor mensal reconhecido é o mesmo', 180, simples.taxa.valorMensalReconhecido);
checar('vigência de 12 meses', 12, simples.vigenciaMeses);
checar('a base viaja junto', 10, simples.taxa.baseCriancas);
checar('e a mensalidade média também', 300, simples.taxa.baseMensalidade);
checar('o dia de vencimento é congelado no documento', 10, simples.taxa.diaVencimento);
checar('o associado é identificado', 'Nino da Silva', simples.associado.nome);
checar('a contratada também', true, !!simples.contratada.cnpj);

bloco('2. CARÊNCIA NÃO ZERA A MENSALIDADE — o bug que já foi assinado duas vezes');

// A roleta de entrada concede de 1 a 4 meses. Este é o caminho COMUM.
for (const carencia of [1, 2, 3, 4]) {
  const c = montarContrato({
    motorista, base, config,
    negociacao: { ...seisPorCento, isencaoMeses: carencia },
  });
  checar(
    `mensal com ${carencia} ${carencia === 1 ? 'mês' : 'meses'} de carência cobra 180`,
    180,
    c.taxa.valorPorPeriodo
  );
  checar(
    `  e o mensal reconhecido também é 180 (não ${carencia > 0 ? '0' : '—'})`,
    180,
    c.taxa.valorMensalReconhecido
  );
  checar('  a carência é dita no documento, não descontada do preço', carencia, c.taxa.carenciaMeses);
}

bloco('3. No período em BLOCO, a carência desconta — e aí faz sentido');

// Semestral: o período são 6 meses pagos de uma vez. Dois de carência = paga 4.
const semestral = montarContrato({
  motorista, base, config,
  negociacao: { modo: 'percentual', valor: 6, periodicidade: 'semestral', isencaoMeses: 2 },
});
checar('semestral com 2 de carência paga 4 meses', 720, semestral.taxa.valorPorPeriodo);
// O reconhecido dilui o total pelos 6 meses do período.
checar('e o reconhecido dilui pelos 6 meses', 120, semestral.taxa.valorMensalReconhecido);
checar('vigência do semestral são 6 meses', 6, semestral.vigenciaMeses);

// Carência maior que o período inteiro não vira número negativo.
const semestralGratis = montarContrato({
  motorista, base, config,
  negociacao: { modo: 'percentual', valor: 6, periodicidade: 'semestral', isencaoMeses: 9 },
});
checar('carência maior que o período não fica negativa', 0, semestralGratis.taxa.valorPorPeriodo);

bloco('4. Os três modos de cobrança');

const fixo = montarContrato({
  motorista, base, config,
  negociacao: { modo: 'fixo', valor: 150, periodicidade: 'mensal' },
});
checar('fixo ignora a base', 150, fixo.taxa.valorPorPeriodo);
checar('e o rótulo diz que é fixo', true, fixo.taxa.rotuloRegra.includes('fixos'));

const gratuito = montarContrato({
  motorista, base, config,
  negociacao: { modo: 'gratuito', valor: 0, periodicidade: 'mensal' },
});
checar('gratuito cobra zero', 0, gratuito.taxa.valorPorPeriodo);
checar('e o rótulo diz gratuidade', 'gratuidade integral', gratuito.taxa.rotuloRegra);

const comDesconto = montarContrato({
  motorista, base, config,
  negociacao: { ...seisPorCento, descontoAntecipacao: 10 },
});
checar('desconto de antecipação de 10% sobre 180', 162, comDesconto.taxa.valorPorPeriodo);

bloco('5. Base vazia não inventa número');

const semBase = montarContrato({
  motorista, config, negociacao: seisPorCento,
  base: { criancas: 0, mensalidadeMedia: 0 },
});
checar('sem criança, sem cobrança', 0, semBase.taxa.valorPorPeriodo);
checar('e sem NaN', true, Number.isFinite(semBase.taxa.valorMensalReconhecido));

const semNegociacao = montarContrato({ motorista, base, config, negociacao: null });
checar('sem negociação não estoura', true, Number.isFinite(semNegociacao.taxa.valorPorPeriodo));

bloco('6. O dia de vencimento respeita o teto de 28');

const dia31 = montarContrato({
  motorista, base, config,
  negociacao: { ...seisPorCento, diaVencimento: 31 },
});
checar('dia 31 vira 28 dentro do contrato', 28, dia31.taxa.diaVencimento);
// A negociação ganha da régua da casa, e o contrato congela o resultado.
const dia5 = montarContrato({
  motorista, base, config,
  negociacao: { ...seisPorCento, diaVencimento: 5 },
});
checar('a negociação vence a régua da casa', 5, dia5.taxa.diaVencimento);

bloco('7. A vigência e a janela de renovação');

const agora = new Date();
const daquiA30 = new Date(agora.getTime() + 30 * 86400000).toISOString();
const daquiA200 = new Date(agora.getTime() + 200 * 86400000).toISOString();

checar('30 dias para vencer', 30, diasParaVencer({ conteudo: { vigenciaFim: daquiA30 } }));
checar('está na janela de 60 dias', true, precisaRenovar({ conteudo: { vigenciaFim: daquiA30 } }));
checar('200 dias ainda não pede renovação', false, precisaRenovar({ conteudo: { vigenciaFim: daquiA200 } }));
checar('sem vigência não é erro, é null', null, diasParaVencer({ conteudo: {} }));
checar('e sem contrato também', null, diasParaVencer(null));
checar('contrato sem data não pede renovação', false, precisaRenovar(null));

bloco('8. O documento é estável — é ele que vira hash');

// Se a forma mudar sem querer, o hash de um contrato reemitido não bate com o
// do aceito, e a prova de "o que foi assinado" se perde.
const chaves = Object.keys(simples).sort();
checar('as chaves de topo são as esperadas', [
  'associado', 'contratada', 'emitidoEm', 'taxa',
  'versao', 'vigenciaFim', 'vigenciaInicio', 'vigenciaMeses',
], chaves);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
