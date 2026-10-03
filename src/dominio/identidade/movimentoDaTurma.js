/**
 * QUEM ENTROU E QUEM SAIU DA TURMA, MÊS A MÊS (03/10/2026).
 *
 * Entrada é o mês em que a criança foi cadastrada (`createdAt`). Saída é o
 * mês em que ele a tirou da turma (`inativadoEm`).
 *
 * ⚠️ `inativadoEm` NASCEU EM OUTUBRO DE 2026. Antes dele, tirar a criança só
 * gravava `active: false`, sem data — então não há como saber EM QUE MÊS
 * alguém saiu antes disso. A régua não chuta: mês anterior a
 * `INICIO_DAS_SAIDAS` sai com `saidasContadas: false` e a tela diz, numa
 * linha, de quando em diante as saídas são contadas. "0 saíram" num mês sem
 * dado seria a tela afirmando algo que ela não sabe.
 *
 * Puro: sem Firebase, sem React (`npm run testar:turma`).
 */

/** O primeiro mês em que a saída tem data gravada. */
export const INICIO_DAS_SAIDAS = '2026-10';

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') return paraData(valor.toDate());
  if (typeof valor.seconds === 'number') return new Date(valor.seconds * 1000);
  if (typeof valor === 'string' || typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 'AAAA-MM' de uma data, em hora local. */
export function mesDe(valor) {
  const d = paraData(valor);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Os `quantos` meses terminando em `mesAtual`, do mais novo para o mais velho. */
export function mesesAte(mesAtual, quantos = 6) {
  const [a, m] = String(mesAtual || '').split('-').map(Number);
  if (!a || !m) return [];
  const lista = [];
  for (let i = 0; i < quantos; i += 1) {
    const d = new Date(a, m - 1 - i, 1);
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

const porNome = (a, b) => a.localeCompare(b, 'pt-BR');

/**
 * Entradas e saídas de cada mês.
 *
 * Devolve `[{ mes, entraram: [nomes], sairam: [nomes], saidasContadas }]`,
 * do mês atual para trás. Criança sem nome aparece como "Sem nome" — some da
 * contagem, nunca.
 */
export function movimentoDaTurma({ criancas = [], mesAtual, meses = 6, inicioDasSaidas = INICIO_DAS_SAIDAS } = {}) {
  return mesesAte(mesAtual, meses).map((mes) => {
    const entraram = [];
    const sairam = [];
    for (const c of criancas || []) {
      const nome = String(c?.name || '').trim() || 'Sem nome';
      if (mesDe(c?.createdAt) === mes) entraram.push(nome);
      if (mesDe(c?.inativadoEm) === mes) sairam.push(nome);
    }
    return {
      mes,
      entraram: entraram.sort(porNome),
      sairam: sairam.sort(porNome),
      saidasContadas: mes >= inicioDasSaidas,
    };
  });
}

/**
 * O resumo da porta "Turma e contratos" no caixa: quantas crianças ativas
 * agora, e quantas entraram e saíram no mês olhado.
 */
export function resumoDaTurma({ criancas = [], mes, inicioDasSaidas = INICIO_DAS_SAIDAS } = {}) {
  const ativas = (criancas || []).filter((c) => c?.active === true).length;
  const [linha] = movimentoDaTurma({ criancas, mesAtual: mes, meses: 1, inicioDasSaidas });
  return {
    ativas,
    entraram: linha ? linha.entraram.length : 0,
    sairam: linha && linha.saidasContadas ? linha.sairam.length : null,
  };
}

/** "1 entrou" / "2 entraram"; "1 saiu" / "2 saíram". */
export function frasesDoMovimento({ entraram, sairam }) {
  const e = entraram === 1 ? '1 entrou' : `${entraram} entraram`;
  const s = sairam === null || sairam === undefined ? null : sairam === 1 ? '1 saiu' : `${sairam} saíram`;
  return { entraram: e, sairam: s };
}
