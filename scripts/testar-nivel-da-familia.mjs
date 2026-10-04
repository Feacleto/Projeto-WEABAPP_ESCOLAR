/**
 * O NÍVEL DA FAMÍLIA — `src/dominio/identidade/nivelDaFamilia.js`.
 *
 * Mede a régua com o relógio injetado: o Bronze no 1º dia, a Prata que pede
 * engajamento, o Ouro que oscila mês a mês, o "Já paguei" valendo mais que a
 * baixa do tio, os pontos de falta e a janela de 30 dias que anda sozinha.
 * E as invariantes de leitura: nenhuma frase fala em "pagador", e nada desta
 * régua é gravado nem lido por mais ninguém.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  calcularNivelDaFamilia,
  pontosDaFalta,
  pontosNaJanela,
  mesesDecididos,
  maiorAtrasoEmAberto,
  dataQueConta,
  fraseDoNivel,
  NIVEIS_DA_FAMILIA,
} from '../src/dominio/identidade/nivelDaFamilia.js';

let ok = 0;
let bad = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function checar(nome, esperado, obtido) {
  if (igual(esperado, obtido)) {
    ok += 1;
    console.log(`  ok  ${nome}`);
  } else {
    bad += 1;
    console.log(`  \x1b[31mFALHA\x1b[0m  ${nome}\n        esperado ${JSON.stringify(esperado)}\n        obtido   ${JSON.stringify(obtido)}`);
  }
}
const bloco = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// Relógio: 15/10/2026, 12h, no fuso do aparelho.
const AGORA = new Date(2026, 9, 15, 12, 0).getTime();
const D = (a, m, d, h = 12, min = 0) => new Date(a, m - 1, d, h, min);
const HORAS = { pega: '06:40', entrega: '12:30' };

// Mensalidade: vence dia 10 do mês.
function mensal(mes, { aviso = null, baixa = null, status = null, crianca = 'c1' } = {}) {
  const [a, m] = mes.split('-').map(Number);
  return {
    month: mes,
    childId: crianca,
    dueDate: D(a, m, 10, 0, 0),
    claimedAt: aviso,
    paidAt: baixa,
    status: status || (baixa ? 'paid' : aviso ? 'claimed' : 'pending'),
  };
}
const emDia = (mes, extra = {}) => {
  const [a, m] = mes.split('-').map(Number);
  return mensal(mes, { aviso: D(a, m, 8), baixa: D(a, m, 9), ...extra });
};
const atrasada = (mes, dia = 13) => {
  const [a, m] = mes.split('-').map(Number);
  return mensal(mes, { aviso: D(a, m, dia), baixa: D(a, m, dia) });
};

const base = { avisosLigados: true, segundoResponsavel: true, horas: HORAS, agora: AGORA };
const nivelDe = (p) => calcularNivelDaFamilia({ ...base, ...p }).nivel;

bloco('1 · OS TRÊS NÍVEIS');
checar('sem avisos ligados: sem selo', 'sem_nivel', nivelDe({ avisosLigados: false, pagamentos: [] }));
checar('avisos ligados: Bronze no 1º dia', 'bronze', nivelDe({ segundoResponsavel: false, pagamentos: [] }));
checar('sem mensalidade no app: a Prata não exige pagamento', 'prata', nivelDe({ pagamentos: [] }));
checar('sem mensalidade no app: nunca Ouro', 'prata', nivelDe({ pagamentos: [], faltas: [] }));
checar('Prata pede o segundo responsável', 'bronze',
  nivelDe({ segundoResponsavel: false, pagamentos: [emDia('2026-09')] }));
checar('uma mensalidade em dia: Prata', 'prata', nivelDe({ pagamentos: [emDia('2026-09')] }));
checar('duas seguidas em dia: Ouro', 'ouro', nivelDe({ pagamentos: [emDia('2026-09'), emDia('2026-10')] }));
checar('os níveis são quatro, na ordem', ['sem_nivel', 'bronze', 'prata', 'ouro'], NIVEIS_DA_FAMILIA);

bloco('2 · O OURO OSCILA');
checar('a mais recente atrasada: cai para Prata', 'prata',
  nivelDe({ pagamentos: [emDia('2026-08'), emDia('2026-09'), atrasada('2026-10')] }));
checar('um mês em dia depois do atraso ainda não basta', 'prata',
  nivelDe({ pagamentos: [atrasada('2026-09'), emDia('2026-10')] }));
checar('dois meses em dia depois do atraso: Ouro de volta', 'ouro',
  nivelDe({ pagamentos: [atrasada('2026-08'), emDia('2026-09'), emDia('2026-10')] }));
checar('pagar NO DIA do vencimento é em dia', 'ouro', nivelDe({
  pagamentos: [emDia('2026-09'), mensal('2026-10', { aviso: D(2026, 10, 10, 22) })],
}));
checar('mês ainda dentro do prazo e sem pagar: vale o que está decidido', 'ouro', nivelDe({
  agora: D(2026, 10, 5).getTime(),
  pagamentos: [emDia('2026-08'), emDia('2026-09'), mensal('2026-10')],
}));
checar('venceu ontem e não pagou: perde o Ouro', 'prata', nivelDe({
  agora: D(2026, 10, 11).getTime(),
  pagamentos: [emDia('2026-08'), emDia('2026-09'), mensal('2026-10')],
}));

bloco('3 · VALE O "JÁ PAGUEI" DELA, NÃO A BAIXA DO TIO');
checar('avisou no dia 8, tio deu baixa no dia 20: em dia', true,
  mesesDecididos([mensal('2026-10', { aviso: D(2026, 10, 8), baixa: D(2026, 10, 20) })], AGORA)[0].emDia);
checar('avisou e o tio ainda não deu baixa: conta', D(2026, 10, 8).getTime(),
  dataQueConta(mensal('2026-10', { aviso: D(2026, 10, 8) })));
checar('sem aviso dela, vale a baixa', D(2026, 10, 9).getTime(),
  dataQueConta(mensal('2026-10', { baixa: D(2026, 10, 9) })));
checar('baixa sem aviso: em dia, mas a Prata pede o "Já paguei"', 'bronze',
  nivelDe({ pagamentos: [mensal('2026-10', { baixa: D(2026, 10, 9) })] }));
checar('aberta não conta como paga', null, dataQueConta(mensal('2026-10')));

bloco('4 · IRMÃOS SÃO UMA FAMÍLIA SÓ');
checar('dois irmãos em dia no mês: um mês em dia', [{ mes: '2026-10', emDia: true }],
  mesesDecididos([emDia('2026-10'), emDia('2026-10', { crianca: 'c2' })], AGORA).map(({ mes, emDia: e }) => ({ mes, emDia: e })));
checar('um irmão atrasado derruba o mês', false,
  mesesDecididos([emDia('2026-10'), { ...atrasada('2026-10'), childId: 'c2' }], AGORA)[0].emDia);

bloco('5 · ATRASO LONGO');
checar('aberta há 5 dias', 5, maiorAtrasoEmAberto([mensal('2026-10')], AGORA));
checar('aberta há 5 dias: continua Prata', 'prata', nivelDe({ pagamentos: [emDia('2026-09'), mensal('2026-10')] }));
checar('aberta há mais de 7 dias: Bronze', 'bronze', nivelDe({
  agora: D(2026, 10, 19).getTime(),
  pagamentos: [emDia('2026-09'), mensal('2026-10')],
}));
checar('pagou o atraso: sai do Bronze na hora', 'prata', nivelDe({
  agora: D(2026, 10, 19).getTime(),
  pagamentos: [emDia('2026-09'), atrasada('2026-10', 19)],
}));

bloco('6 · OS PONTOS DE FALTA');
const falta = (dateKey, criada, extra = {}) => ({ dateKey, type: 'full', declaredBy: 'parent', createdAt: criada, ...extra });
checar('avisou na véspera: 0', 0, pontosDaFalta(falta('2026-10-14', D(2026, 10, 13, 20)), HORAS));
checar('avisou 1h10 antes: 0', 0, pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 5, 30)), HORAS));
checar('avisou exatamente 1h antes: 0', 0, pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 5, 40)), HORAS));
checar('avisou 30 min antes: 1', 1, pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 6, 10)), HORAS));
checar('avisou depois da hora: 1', 1, pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 7, 0)), HORAS));
checar('o tio marcou na hora: 2', 2,
  pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 6, 45), { declaredBy: 'admin' }), HORAS));
checar('o tio registrou com antecedência (ela avisou por fora): 0', 0,
  pontosDaFalta(falta('2026-10-14', D(2026, 10, 12, 18), { declaredBy: 'admin' }), HORAS));
checar('"não tem aula" para a escola inteira: 0', 0,
  pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 6, 45), { declaredBy: 'admin', broadcastId: 'b1' }), HORAS));
checar('falta só da volta mede contra a hora da volta: 11h no dia é com antecedência', 0,
  pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 11, 0), { type: 'no-dropoff' }), HORAS));
checar('falta só da volta às 12h: em cima da hora', 1,
  pontosDaFalta(falta('2026-10-14', D(2026, 10, 14, 12, 0), { type: 'no-dropoff' }), HORAS));

bloco('7 · A JANELA DE 30 DIAS E A TOLERÂNCIA');
const doisMeses = [emDia('2026-09'), emDia('2026-10')];
const uma = [falta('2026-10-14', D(2026, 10, 14, 6, 30))];
const duas = [...uma, falta('2026-10-07', D(2026, 10, 7, 6, 30))];
checar('UM aviso em cima da hora em 30 dias: tolerado, continua Ouro', 'ouro', nivelDe({ pagamentos: doisMeses, faltas: uma }));
checar('dois em 30 dias: cai para Prata', 'prata', nivelDe({ pagamentos: doisMeses, faltas: duas }));
checar('um "Faltou" do tio sozinho já tira o Ouro', 'prata', nivelDe({
  pagamentos: doisMeses,
  faltas: [falta('2026-10-14', D(2026, 10, 14, 6, 45), { declaredBy: 'admin' })],
}));
checar('a falta de 31 dias atrás já saiu da conta', 1, pontosNaJanela([
  ...uma, falta('2026-09-14', D(2026, 9, 14, 6, 30)),
], HORAS, AGORA));
checar('falta marcada para o futuro não conta', 0, pontosNaJanela([
  falta('2026-10-20', D(2026, 10, 20, 6, 30)),
], HORAS, AGORA));
const r = calcularNivelDaFamilia({ ...base, pagamentos: doisMeses, faltas: duas });
checar('diz quando o Ouro pode voltar (a mais antiga sai da janela)', '2026-11-06', r.faltaSaiDaJanelaEm);

bloco('8 · O QUE ELA LÊ');
const PROIBIDAS = ['pagador', 'devedor', 'inadimpl', 'caloteir', 'nota', 'pontuação', 'pontos'];
const frases = [
  fraseDoNivel({ nivel: 'sem_nivel' }),
  fraseDoNivel({ nivel: 'bronze' }),
  fraseDoNivel({ nivel: 'prata', temMensalidades: false, itens: {} }),
  fraseDoNivel({ nivel: 'prata', temMensalidades: true, itens: { faltasAvisadas: true } }, { diaDoVencimento: 10 }),
  fraseDoNivel({ nivel: 'prata', temMensalidades: true, itens: { faltasAvisadas: false } }),
  fraseDoNivel({ nivel: 'ouro' }),
];
for (const f of frases) {
  checar(`"${f.slice(0, 40)}…" não fala em pagador nem em pontos`, [],
    PROIBIDAS.filter((p) => f.toLowerCase().includes(p)));
}
checar('a frase da Prata diz o dia', true, frases[3].includes('até o dia 10'));
checar('sonda: a checagem pega "bom pagador"', ['pagador'],
  PROIBIDAS.filter((p) => 'Você é bom pagador'.includes(p)));

bloco('9 · SÓ ELA VÊ, E NADA É GRAVADO');
const fonte = readFileSync(new URL('../src/dominio/identidade/nivelDaFamilia.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
checar('a régua não importa nada', false, /^\s*import\s/m.test(fonte));
function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : [];
  });
}
const raiz = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const quemUsa = arquivos(raiz)
  .filter((p) => /nivelDaFamilia|useNivelDaFamilia/.test(readFileSync(p, 'utf8')))
  .map((p) => p.replace(/\\/g, '/').split('/src/')[1])
  .filter((p) => p !== 'dominio/identidade/nivelDaFamilia.js');
const foraDaFamilia = quemUsa.filter((p) => /pages\/tio\/|components\/admin\/|pages\/admin\//.test(p));
checar('nenhuma tela do motorista nem do dono lê o nível da família', [], foraDaFamilia);
const gravam = quemUsa.filter((p) => /services\//.test(p));
checar('nenhum service grava o nível da família', [], gravam);

console.log(`\n${ok} ok, ${bad} falha(s)`);
process.exit(bad ? 1 : 0);
