/**
 * AS ABAS VENDAS E MARKETING — as contas puras de `vendasDoPainel.js`.
 *
 * O QUE ESTE TESTE PROTEGE
 *   PRONTO: roda na semana, passou do 14º dia do teste e NÃO tem plano. Cada
 *   um dos quatro critérios tem o caso que o reprova — sem eles a lista vira
 *   "todo mundo" e a conversa de venda perde o foco.
 *   NULL, NÃO ZERO: mediana sem assinante e percentual sem cadastro são "—".
 *   A PROPOSTA é a da ficha: o texto vem de `mensagemDeProposta`, sem número
 *   escrito aqui.
 *
 * COMO RODAR   node scripts/testar-vendas-do-painel.mjs
 */

import {
  DIAS_DE_TESTE_PARA_CONVERSA,
  fechamentos,
  medianaDiasAteOPlano,
  propostaDoPronto,
  prontosParaConversa,
  resumoDeMarketing,
  resumoDeVendas,
  retencaoPorCanal,
} from '../src/dominio/associacao/vendasDoPainel.js';
import { pagariaPorMes } from '../src/dominio/associacao/retratoDaBase.js';

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

const pronto = {
  uid: 'p1', marcaNome: 'Tio Beto', name: 'Beto Lima', regiao: 'Vila Mariana', phone: '11987654321',
  createdAt: dia('2026-08-20'), trialInicio: dia('2026-09-10'), ultimaRota: dia('2026-10-04'), criancasAtivas: 18,
};
const pequeno = { ...pronto, uid: 'p2', marcaNome: 'Tia Rose', phone: '', criancasAtivas: 6, city: 'Santos', regiao: undefined };
const recente = { ...pronto, uid: 'p3', trialInicio: dia('2026-09-28') }; // 7 dias
const parado = { ...pronto, uid: 'p4', ultimaRota: dia('2026-09-20') };
const futuro = { ...pronto, uid: 'p5', ultimaRota: dia('2026-10-09') };
const comPlano = {
  ...pronto, uid: 'p6', plano: 'mensal', contratadoEm: dia('2026-09-20'), createdAt: dia('2026-09-01'),
  assinaturaAte: dia('2026-11-20'),
};
const suspenso = { ...pronto, uid: 'p7', suspenso: true };
const nunca = { uid: 'p8', name: 'Ana', createdAt: dia('2026-10-02'), criancasAtivas: 3 };

bloco('1. Prontos para conversa');
const lp = prontosParaConversa([pequeno, pronto, recente, parado, futuro, comPlano, suspenso, nunca], HOJE, MES);
checar('só os dois prontos, o de mais crianças primeiro', ['p1', 'p2'], lp.map((x) => x.uid));
checar('teste de 14 dias é o piso', 14, DIAS_DE_TESTE_PARA_CONVERSA);
checar('quem está no 14º dia exato entra', 1, prontosParaConversa([{ ...pronto, trialInicio: dia('2026-09-21') }], HOJE, MES).length);
checar('quem está no 13º dia não entra', 0, prontosParaConversa([{ ...pronto, trialInicio: dia('2026-09-22') }], HOJE, MES).length);
checar('há quantos dias roda', 25, lp[0].diasRodando);
checar('crianças', 18, lp[0].criancas);
checar('lugar: região ganha da cidade', 'Vila Mariana', lp[0].lugar);
checar('lugar: cai na cidade', 'Santos', lp[1].lugar);
checar('quanto pagaria é o de pagariaPorMes', pagariaPorMes(pronto, MES), lp[0].pagaria);
checar('pagaria é número', 'number', typeof lp[0].pagaria);
checar('lista vazia sem erro', [], prontosParaConversa([], HOJE, MES));
checar('entrada que não é lista', [], prontosParaConversa(null, HOJE, MES));
checar('trialInicio como Timestamp', 1, prontosParaConversa([{ ...pronto, trialInicio: { toDate: () => dia('2026-09-10') } }], HOJE, MES).length);
checar('vitalício não é pronto', 0, prontosParaConversa([{ ...pronto, condicaoFundador: 'vitalicio' }], HOJE, MES).length);

bloco('2. A proposta é a da ficha');
const pr = propostaDoPronto(pronto, HOJE, MES);
checar('tem assunto', 'string', typeof pr.assunto);
checar('o texto chama pelo primeiro nome', true, pr.texto.includes('Beto'));
checar('o link abre o WhatsApp dele', true, /wa\.me\//.test(pr.link));
checar('sem telefone, sem link', null, propostaDoPronto(pequeno, HOJE, MES).link || null);

bloco('3. Fechamentos e mediana');
const f1 = { ...comPlano, uid: 'f1', createdAt: dia('2026-08-01'), contratadoEm: dia('2026-08-11') }; // 10
const f2 = { ...comPlano, uid: 'f2', createdAt: dia('2026-08-01'), contratadoEm: dia('2026-08-31') }; // 30
const f3 = { ...comPlano, uid: 'f3', createdAt: dia('2026-08-01'), contratadoEm: dia('2026-08-21') }; // 20
const semData = { ...comPlano, uid: 'f4', contratadoEm: undefined };
checar('mediana ímpar', 20, medianaDiasAteOPlano([f1, f2, f3]));
checar('mediana par arredonda', 20, medianaDiasAteOPlano([f1, f2]));
checar('mediana sem assinante é null', null, medianaDiasAteOPlano([pronto, nunca]));
checar('mediana ignora quem não tem as duas datas', 10, medianaDiasAteOPlano([f1, semData]));
checar('mediana não é zero sem dados', true, medianaDiasAteOPlano([]) === null);
checar('fechamentos: mais recente primeiro, sem data no fim', ['f2', 'f3', 'f1', 'f4'], fechamentos([f1, semData, f2, f3, pronto]).map((x) => x.uid));
checar('fechamentos traz o plano', 'mensal', fechamentos([f1])[0].plano);
checar('vitalício aparece como vitalício', 'vitalicio', fechamentos([{ uid: 'v', condicaoFundador: 'vitalicio' }])[0].plano);
const rv = resumoDeVendas([pronto, f1, f2, nunca], HOJE, MES);
checar('resumo: prontos', 1, rv.prontos);
checar('resumo: assinantes', 2, rv.assinantes);
checar('resumo: mediana', 20, rv.medianaDias);
checar('resumo: hora por fechado ainda não é medida', null, rv.horaPorFechado);

bloco('4. Marketing: cadastros do mês');
const ind = { uid: 'i1', createdAt: dia('2026-10-01'), origem: { canal: 'indicacao' } };
const goo = { uid: 'g1', createdAt: dia('2026-10-03'), origem: { canal: 'google' } };
const velho = { uid: 'o1', createdAt: dia('2026-09-30'), origem: { canal: 'indicacao' } };
const m = resumoDeMarketing([ind, goo, velho, nunca], HOJE);
checar('cadastros no mês (3 de outubro)', 3, m.cadastrosNoMes);
checar('% por indicação sobre os do mês', 33, m.percentualPorIndicacao);
checar('visitas ao site: o site não conta', null, m.visitasAoSite);
checar('sem motoristas: cadastros null', null, resumoDeMarketing([], HOJE).cadastrosNoMes);
checar('sem cadastro no mês: % null, não zero', null, resumoDeMarketing([velho], HOJE).percentualPorIndicacao);
checar('sem cadastro no mês: cadastros é 0 medido', 0, resumoDeMarketing([velho], HOJE).cadastrosNoMes);

bloco('5. Qual porta traz quem fica');
const base = [
  { uid: 'a', origem: { canal: 'indicacao' }, ultimaRota: dia('2026-10-04'), trialInicio: dia('2026-09-20') },
  { uid: 'b', origem: { canal: 'indicacao' }, ultimaRota: dia('2026-09-01'), trialInicio: dia('2026-08-20') },
  { uid: 'c', origem: { canal: 'indicacao' } },
  { uid: 'd', origem: { canal: 'indicacao' }, trialInicio: dia('2026-09-20') },
  { uid: 'e', origem: { canal: 'google' }, ultimaRota: dia('2026-10-05'), trialInicio: dia('2026-10-01') },
  { uid: 'f' },
  { uid: 'g', origem: { canal: 'canal-inventado' } },
];
const r = retencaoPorCanal(base, HOJE);
const ind2 = r.find((x) => x.canal === 'indicacao');
checar('indicação: 4 cadastros', 4, ind2.n);
checar('indicação: 3 de 4 rodaram a 1ª rota', 75, ind2.percentualRodou);
checar('indicação: 1 de 4 roda na semana', 25, ind2.percentualNaSemana);
checar('google: 100% e 100%', [100, 100], [r.find((x) => x.canal === 'google').percentualRodou, r.find((x) => x.canal === 'google').percentualNaSemana]);
const direto = r.find((x) => x.canal === 'direto');
checar('sem origem e canal inventado caem em "direto"', 2, direto.n);
checar('direto nunca rodou: 0% medido, não null', 0, direto.percentualRodou);
checar('maior canal primeiro', 'indicacao', r[0].canal);
checar('rótulo pronto', 'Indicação de motorista', ind2.rotulo);
checar('sem motoristas: null', null, retencaoPorCanal([], HOJE));
checar('ultimaRota no futuro não conta como semana', 0, retencaoPorCanal([{ uid: 'x', origem: { canal: 'rua' }, ultimaRota: dia('2026-10-20') }], HOJE)[0].percentualNaSemana);

console.log('');
console.log(`${ok} ok, ${bad} falha(s)`);
if (bad) {
  falhas.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
