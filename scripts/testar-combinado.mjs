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
  VERSAO_DO_TEXTO,
  TEXTOS_DO_CONTRATO,
  versaoDoTexto,
  regrasDoTexto,
  seAtrasar,
  identificacaoDaContratada,
} from '../src/dominio/cobranca/contratoDaFamilia.js';
import { createHash } from 'node:crypto';

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

console.log('\n═══ A VERSÃO DO TEXTO (o contrato aceito mostra o que foi aceito) ═══');
checar('versão gravada sem a marca é o texto 1', 1, versaoDoTexto({ finance: {} }));
checar('marca desconhecida também é o texto 1 (nunca um texto que não existe)', 1, versaoDoTexto({ versaoDoTexto: 99 }));
checar('o texto novo é o 2', 2, VERSAO_DO_TEXTO);
checar('o 2 é lido como 2', 2, versaoDoTexto({ versaoDoTexto: 2 }));
checar('o texto 1 continua com a multa de 10% que foi aceita', 10, TEXTOS_DO_CONTRATO[1].multa.pct);
checar('o texto 2: multa de 2% (CDC art. 52, § 1º)', 2, regrasDoTexto({ versaoDoTexto: 2 }).multa.pct);
checar('o texto 2: juros de 1% ao mês', 1, regrasDoTexto({ versaoDoTexto: 2 }).juros.pctAoMes);
checar('o texto 2: 7 dias de arrependimento (CDC art. 49)', 7, regrasDoTexto({ versaoDoTexto: 2 }).diasDeArrependimento.n);
checar('o texto 2: 10 dias de aviso antes de suspender', 10, regrasDoTexto({ versaoDoTexto: 2 }).diasDeAvisoAntesDeSuspender.n);
checar('o resumo do texto 1 diz a multa dele', 'Multa de 10%', seAtrasar({}));
checar('o resumo do texto 2 diz multa e juros', 'Multa de 2% e juros de 1% ao mês', seAtrasar({ versaoDoTexto: 2 }));
const v1 = { ...base };
const v2 = { ...base, versaoDoTexto: 2 };
checar('texto diferente é conteúdo diferente (é o que reemite o pendente)', false, mesmoConteudo(v1, v2));
const hashDe = (d) => createHash('sha256').update(jsonCanonico(d)).digest('hex');
checar('a marca do texto entra no hash do aceite', false, hashDe(v1) === hashDe(v2));
checar('e o servidor tira o mesmo hash da versão nova',
  hashDe(v2), createHash('sha256').update(servidor.jsonCanonico(v2)).digest('hex'));

console.log('\n═══ A CONTRATADA PODE SER CPF OU CNPJ (preâmbulo do texto 2) ═══');
checar('CPF: sem representante (ninguém representa a si mesmo)', { tipo: 'CPF', representante: null },
  identificacaoDaContratada({ name: 'João da Silva', document: '123.456.789-09', representative: 'João da Silva' }));
checar('CNPJ com representante de verdade', { tipo: 'CNPJ', representante: 'João da Silva' },
  identificacaoDaContratada({ name: 'Transportes JS Ltda', document: '12.345.678/0001-90', representative: 'João da Silva' }));
checar('CNPJ com o "Representante legal" de reserva: nenhum nome inventado', { tipo: 'CNPJ', representante: null },
  identificacaoDaContratada({ name: 'Transportes JS Ltda', document: '12345678000190', representative: 'Representante legal' }));
checar('CNPJ cujo "representante" é a própria razão social: não repete', { tipo: 'CNPJ', representante: null },
  identificacaoDaContratada({ name: 'JOÃO DA SILVA', document: '12345678000190', representative: 'João da Silva' }));
checar('documento que não é nem um nem outro: tipo desconhecido', { tipo: null, representante: null },
  identificacaoDaContratada({ name: 'X', document: '123', representative: 'Y' }));

console.log('\n═══ A TELA DESENHA O TEXTO DA VERSÃO, E O SERVIÇO GRAVA A MARCA ═══');
// As quebras de linha viram "\n": num clone no Windows o arquivo chega com
// "\r\n", e a busca pelo fim da função (`\n}\n`) passava direto (QA, 05/10/2026).
const tela = readFileSync(new URL('../src/components/contract/ContractView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const servico = readFileSync(new URL('../src/services/contractService.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
checar('o contrato novo sai com a marca do texto atual', true,
  servico.includes('versaoDoTexto = VERSAO_DO_TEXTO') && servico.includes('{ versaoDoTexto }'));
checar('a tela escolhe o texto pela versão gravada', true, tela.includes('versaoDoTexto(data)'));
checar('a multa da cláusula vem da tabela da versão, nunca literal', true,
  !/multa de \d+%/.test(tela) && tela.includes('regras.multa.pct'));
checar('o resumo lê a mesma régua da cláusula', true, tela.includes("['Se atrasar', seAtrasar(data)]"));
checar('o aceite não cita a Lei 14.063 (assinatura com o poder público)', false, tela.includes('14.063'));
const inicioDoResumo = tela.indexOf('export function ResumoDoCombinado');
const resumo = tela.slice(inicioDoResumo, tela.indexOf('\n}\n', inicioDoResumo));
checar('o resumo (que a família vê) não fala em "aditivo" nem "o que muda"', false,
  /aditivo|o que muda/i.test(resumo));
for (const pagina of ['../src/pages/pai/PaiContract.jsx', '../src/pages/tio/TioContract.jsx']) {
  checar(`o aceite ANTIGO é remontado no texto 1 (${pagina.split('/').pop()})`, true,
    readFileSync(new URL(pagina, import.meta.url), 'utf8').includes('child.contractAcceptedAt ? { versaoDoTexto: 1 }'));
}

console.log(`\n${'═'.repeat(64)}\n  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
