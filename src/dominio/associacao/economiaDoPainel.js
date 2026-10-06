/**
 * AS CONTAS DA ABA ECONOMIA DO PAINEL DO DONO.
 *
 * Nada aqui cobra: quem cobra é `precoDoMes`. Esta é a vitrine do dono — ele
 * mexe num controle e vê o que um motorista pagaria. Por isso os números vêm
 * todos de `planos.js` e de `vitrineDoPlano.js`, nunca escritos de novo.
 *
 * Puro: sem Firebase, sem React.
 */
import { PLANO, centavos, precoDaTabela, precoDoMes } from './planos.js';
import { PRECO_DO_CONCORRENTE, pesoNaReceita } from './vitrineDoPlano.js';

/** Os tamanhos de turma da tabela "preço por tamanho". */
export const TAMANHOS_DA_TABELA = [5, 8, 10, 15, 20, 30, 40, 50, 60];

/** Os degraus da escada que o simulador oferece (0 = sem desconto). */
export const DEGRAUS_DA_ESCADA = [0, 0.1, 0.2, 0.3];

export const MENSALIDADE_MEDIA_PADRAO = 300;

// `precoDoMes` ignora desconto quando não sabe o mês. O da escada aqui é
// vitalício (`ate: null`), então qualquer mês serve; este só destrava a conta.
const MES_DA_SIMULACAO = '2026-01';

/**
 * Simula UMA turma. A escada de fechamento só vale no mensal (o anual já é
 * metade do preço), então no anual o desconto é ignorado — e a tela desliga o
 * controle em vez de deixar o dono achar que ele valeu.
 */
export function simularTurma({
  criancas,
  plano = PLANO.MENSAL,
  escada = 0,
  mensalidade = MENSALIDADE_MEDIA_PADRAO,
  indicacoes = 0,
} = {}) {
  const n = Math.max(0, Math.floor(Number(criancas) || 0));
  const fracao = plano === PLANO.MENSAL ? Number(escada) || 0 : 0;
  const descontos = fracao > 0 ? [{ origem: 'fechamento', fracao, ate: null }] : null;
  const r = precoDoMes({
    criancas: n,
    plano,
    descontos,
    indicacoesAtivas: indicacoes,
    mes: MES_DA_SIMULACAO,
  });
  if (r.liquido === null) return null;

  const mercado = centavos(n * PRECO_DO_CONCORRENTE.porCrianca);
  return {
    ...r,
    criancas: n,
    porCrianca: n > 0 ? centavos(r.liquido / n) : null,
    mercado,
    // Negativo quando o app sai mais caro: a aba do dono mostra o número real,
    // ao contrário da tela do motorista, que cala a comparação desfavorável.
    diferencaParaOMercado: centavos(mercado - r.liquido),
    peso: pesoNaReceita({ liquido: r.liquido, receita: n * (Number(mensalidade) || 0) }),
  };
}

/** A tabela "preço por tamanho de turma". */
export function tabelaPorTamanho(tamanhos = TAMANHOS_DA_TABELA) {
  return tamanhos.map((criancas) => {
    const mensal = precoDaTabela({ criancas, plano: PLANO.MENSAL });
    const anual = precoDaTabela({ criancas, plano: PLANO.ANUAL });
    return {
      criancas,
      mensal,
      anual,
      mensalPorCrianca: centavos(mensal / criancas),
      anualPorCrianca: centavos(anual / criancas),
    };
  });
}

export const FAIXAS_DE_TURMA = [
  { id: 'f1', rotulo: '1 a 8 crianças', min: 1, max: 8 },
  { id: 'f2', rotulo: '9 a 20 crianças', min: 9, max: 20 },
  { id: 'f3', rotulo: '21 a 40 crianças', min: 21, max: 40 },
  { id: 'f4', rotulo: 'Mais de 40', min: 41, max: Infinity },
];

/**
 * Agrupa as linhas de `getRetratoDaBase().assinantes` por tamanho de turma.
 * Quem tem zero criança fica de fora: ainda não tem turma, e contá-lo puxaria a
 * primeira faixa para baixo. `pagaria` que não veio (null) soma zero.
 */
export function agruparPorFaixa(assinantes = []) {
  const faixas = FAIXAS_DE_TURMA.map((f) => ({ ...f, motoristas: 0, criancas: 0, pagaria: 0 }));
  (Array.isArray(assinantes) ? assinantes : []).forEach((a) => {
    const n = Number(a?.criancas) || 0;
    if (n < 1) return;
    const faixa = faixas.find((f) => n >= f.min && n <= f.max);
    faixa.motoristas += 1;
    faixa.criancas += n;
    faixa.pagaria += Number(a.pagaria) || 0;
  });
  return faixas.map((f) => ({ ...f, pagaria: centavos(f.pagaria) }));
}
