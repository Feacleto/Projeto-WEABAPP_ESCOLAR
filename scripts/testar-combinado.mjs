/**
 * O CONTRATO ENTRE O MOTORISTA E A FAMÍLIA — vigência, parcelas, o que mudou,
 * e o estado (02/10/2026).
 *
 * O contrato deixou de ser remontado a cada abertura: cada versão é gravada, e
 * mudar o combinado depois do aceite é um ADITIVO. Este arquivo trava a régua
 * pura (`src/dominio/cobranca/contratoDaFamilia.js`) e o ESPELHO do servidor
 * (`functions/lib/reguaDoContrato.js`), que tira o hash do aceite — se as
 * duas cópias de `jsonCanonico` divergirem, o hash deixa de ser conferível.
 *
 * COMO RODAR
 *   node scripts/testar-combinado.mjs      (ou: npm run testar:combinado)
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {
  vigenciaPadrao,
  parcelasDaVigencia,
  erroDaVigencia,
  jsonCanonico,
  mesmoConteudo,
  mudancasEntre,
  estadoDoContrato,
  dataBR,
  vigenciaDaCrianca,
} from '../src/dominio/cobranca/contratoDaFamilia.js';

const require = createRequire(import.meta.url);
const servidor = require('../functions/lib/reguaDoContrato.js');

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

console.log('\n═══ A VIGÊNCIA QUE A TELA OFERECE ═══');
checar('em outubro: de hoje até 31/12 do mesmo ano',
  { inicio: '2026-10-02', fim: '2026-12-31' }, vigenciaPadrao(new Date(2026, 9, 2)));
checar('em novembro (menos de 60 dias): pula para o ano seguinte',
  { inicio: '2026-11-15', fim: '2027-12-31' }, vigenciaPadrao(new Date(2026, 10, 15)));
checar('em janeiro: o ano inteiro',
  { inicio: '2027-01-05', fim: '2027-12-31' }, vigenciaPadrao(new Date(2027, 0, 5)));
checar('criança com vigência própria usa a dela',
  { inicio: '2026-02-01', fim: '2026-11-30' },
  vigenciaDaCrianca({ vigenciaInicio: '2026-02-01', vigenciaFim: '2026-11-30' }));
checar('criança sem o campo (cadastro antigo) usa a padrão',
  { inicio: '2026-10-02', fim: '2026-12-31' }, vigenciaDaCrianca({}, new Date(2026, 9, 2)));

console.log('\n═══ AS PARCELAS (a cláusula 7ª) ═══');
checar('02/10 a 31/12 são 3 parcelas, não 12', 3, parcelasDaVigencia('2026-10-02', '2026-12-31'));
checar('o ano inteiro são 12', 12, parcelasDaVigencia('2026-01-01', '2026-12-31'));
checar('12 meses a partir de março: 12', 12, parcelasDaVigencia('2026-03-10', '2027-03-09'));
checar('atravessando o ano: out/26 a dez/27 são 15', 15, parcelasDaVigencia('2026-10-01', '2027-12-31'));
checar('mês começado conta inteiro: 15/01 a 20/02 são 2', 2, parcelasDaVigencia('2026-01-15', '2026-02-20'));
checar('um mês exato: 05/03 a 04/04 é 1', 1, parcelasDaVigencia('2026-03-05', '2026-04-04'));
checar('data inválida não dá parcela', 0, parcelasDaVigencia('2026-02-30', '2026-12-31'));

console.log('\n═══ O QUE A VIGÊNCIA NÃO PODE SER ═══');
checar('fim antes do início', 'O fim precisa vir depois do início.', erroDaVigencia('2026-12-31', '2026-01-01'));
checar('mesma data', 'O fim precisa vir depois do início.', erroDaVigencia('2026-05-01', '2026-05-01'));
checar('sem início', 'Escolha a data de início.', erroDaVigencia('', '2026-12-31'));
checar('mais de 24 meses', 'No máximo 24 meses. Para mais tempo, renove depois.',
  erroDaVigencia('2026-01-01', '2028-06-30'));
checar('24 meses exatos passam', null, erroDaVigencia('2026-01-01', '2027-12-31'));
checar('a vigência normal passa', null, erroDaVigencia('2026-10-02', '2026-12-31'));
checar('data no formato brasileiro', '31/12/2026', dataBR('2026-12-31'));

console.log('\n═══ O JSON CANÔNICO (o hash do aceite depende dele) ═══');
const a = { b: 1, a: { d: [1, { z: 1, y: 2 }], c: 'x' }, n: null };
const b = { n: null, a: { c: 'x', d: [1, { y: 2, z: 1 }] }, b: 1 };
checar('a ordem das chaves não muda o texto', jsonCanonico(a), jsonCanonico(b));
checar('a ordem de uma LISTA muda (lista tem ordem)',
  false, jsonCanonico({ l: [1, 2] }) === jsonCanonico({ l: [2, 1] }));
checar('chave com undefined some (o Firestore não grava undefined)',
  jsonCanonico({ a: 1 }), jsonCanonico({ a: 1, b: undefined }));
const amostras = [a, b, { x: 'ção', y: [null, true, 1.5] }, [], {}, 'texto', 42, null,
  { dados: { finance: { monthlyFee: 450, dueDay: 10 }, period: { inicio: '2026-10-02' } } }];
amostras.forEach((v, i) =>
  checar(`espelho do servidor igual ao do app (amostra ${i + 1})`, jsonCanonico(v), servidor.jsonCanonico(v)));

console.log('\n═══ O MESMO CONTRATO, MONTADO EM HORAS DIFERENTES ═══');
const base = {
  issuedAt: '2026-10-02T10:00:00Z',
  finance: { monthlyFee: 450, dueDay: 10, installments: 3 },
  period: { startDate: '02/10/2026', endDate: '31/12/2026' },
  student: { homeAddress: 'Rua A, 1', school: 'Escola X' },
};
checar('issuedAt diferente não é mudança', true,
  mesmoConteudo(base, { ...base, issuedAt: '2026-10-02T11:00:00Z' }));
checar('mensalidade diferente é mudança', false,
  mesmoConteudo(base, { ...base, finance: { ...base.finance, monthlyFee: 500 } }));

console.log('\n═══ O QUE O ADITIVO MOSTRA EM DESTAQUE ═══');
const depois = {
  ...base,
  finance: { monthlyFee: 500, dueDay: 5, installments: 3 },
  period: { startDate: '02/10/2026', endDate: '31/12/2027' },
};
checar('lista só o que mudou, em linhas legíveis', [
  { rotulo: 'Mensalidade', de: 'R$ 450,00', para: 'R$ 500,00' },
  { rotulo: 'Dia do vencimento', de: 'dia 10', para: 'dia 5' },
  { rotulo: 'Fim do contrato', de: '31/12/2026', para: '31/12/2027' },
], mudancasEntre(base, depois));
checar('nada mudou, nada listado', [], mudancasEntre(base, { ...base }));
checar('milhar no valor', 'R$ 1.200,00',
  mudancasEntre(base, { ...base, finance: { ...base.finance, monthlyFee: 1200 } })[0].para);

console.log('\n═══ EM QUE PÉ ESTÁ O CONTRATO ═══');
checar('nada emitido', 'sem-contrato', estadoDoContrato({}));
checar('primeiro contrato esperando', 'aguardando', estadoDoContrato({ contratoAguardando: 1 }));
checar('aceito', 'aceito', estadoDoContrato({ contratoVigente: { numero: 1 } }));
checar('aceito e com mudança esperando', 'mudanca',
  estadoDoContrato({ contratoVigente: { numero: 1 }, contratoAguardando: 2 }));
checar('o aceite antigo (só contractAcceptedAt) conta como aceito', 'aceito',
  estadoDoContrato({ contractAcceptedAt: { seconds: 1 } }));
checar('ponteiro nulo não é "esperando"', 'sem-contrato', estadoDoContrato({ contratoAguardando: null }));

console.log('\n═══ O QUE O ADITIVO PODE MUDAR NA CRIANÇA (servidor) ═══');
checar('só os quatro campos do combinado passam',
  { monthlyFee: 500, dueDay: 5, vigenciaInicio: '2026-10-02', vigenciaFim: '2027-12-31' },
  servidor.valoresDoAditivo({
    monthlyFee: 500, dueDay: 5, vigenciaInicio: '2026-10-02', vigenciaFim: '2027-12-31',
    parentUid: 'intruso', adminUid: 'outro', active: false,
  }));
checar('dia fora de 1–28 não passa', {}, servidor.valoresDoAditivo({ dueDay: 31 }));
checar('data que não é data não passa', {}, servidor.valoresDoAditivo({ vigenciaFim: '31/12/2027' }));
checar('valor negativo não passa', {}, servidor.valoresDoAditivo({ monthlyFee: -1 }));
checar('nada vira nada', {}, servidor.valoresDoAditivo(null));

console.log('\nA COBRANÇA RESPEITA A VIGÊNCIA (o servidor gera a mensalidade)');
const VIG = ['2026-10-02', '2026-12-31'];
checar('setembro, antes do início: sem mensalidade', false, servidor.mesDentroDaVigencia('2026-09', ...VIG));
checar('outubro, o mês do início: cobra', true, servidor.mesDentroDaVigencia('2026-10', ...VIG));
checar('dezembro, o último: cobra', true, servidor.mesDentroDaVigencia('2026-12', ...VIG));
checar('janeiro, depois do fim: sem mensalidade', false, servidor.mesDentroDaVigencia('2027-01', ...VIG));
checar('março a março: fev/27 é a 12ª parcela', true, servidor.mesDentroDaVigencia('2027-02', '2026-03-10', '2027-03-09'));
checar('e mar/27 seria a 13ª, que o contrato não prevê', false, servidor.mesDentroDaVigencia('2027-03', '2026-03-10', '2027-03-09'));
checar('criança sem vigência gravada continua sendo cobrada', true, servidor.mesDentroDaVigencia('2027-05', undefined, undefined));
const casosParcela = [
  ['2026-10-02', '2026-12-31'], ['2026-01-01', '2026-12-31'], ['2026-03-10', '2027-03-09'],
  ['2026-10-01', '2027-12-31'], ['2026-01-15', '2026-02-20'], ['2026-03-05', '2026-04-04'],
  ['2026-02-30', '2026-12-31'], ['2026-12-31', '2026-01-01'],
];
checar('o servidor conta as parcelas igual à tela, caso a caso', true,
  casosParcela.every(([i, f]) => servidor.parcelasDaVigencia(i, f) === parcelasDaVigencia(i, f)));
checar('e o gerador de mensalidade usa a régua', true,
  readFileSync(new URL('../functions/lib/billing.js', import.meta.url), 'utf8')
    .includes('mesDentroDaVigencia(monthKey, child.vigenciaInicio, child.vigenciaFim)'));

console.log(`\n${'═'.repeat(64)}\n  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
