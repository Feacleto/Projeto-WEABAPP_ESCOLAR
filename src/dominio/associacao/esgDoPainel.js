/**
 * AS CONTAS DA ABA ESG DO PAINEL DO DONO (05/10/2026).
 *
 * Só LÊ o que o painel já tem e escreve o que cada número é — e o que NÃO é.
 * ⚠️ Onde o número não existe, ele vem `null` e a tela escreve "—": zero
 * diria "medimos e é nenhum". E toda estimativa leva o rótulo de estimativa,
 * porque um número de ESG sem a conta que o explica é propaganda.
 *
 * ⚠️ Nenhum texto daqui promete garantia de proteção: a plataforma não
 * inspeciona van nem confere CNH (docs/marca.md). O teste reprova as raízes
 * proibidas em todo texto da régua.
 *
 * Puro, sem Firebase: `node scripts/testar-esg-do-painel.mjs`.
 */

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Crianças ativas por motorista que já rodou. `null` sem base. */
export function criancasPorPerua({ criancasAtivas, rodaram } = {}) {
  const c = numero(criancasAtivas);
  const r = numero(rodaram);
  if (c === null || r === null || r <= 0) return null;
  return Math.round((c / r) * 10) / 10;
}

/**
 * Carros a menos no portão: ESTIMATIVA de uma criança por carro. É o teto
 * teórico (cada criança iria num carro de família), nunca medida.
 */
export function carrosAMenos({ criancasAtivas, rodaram } = {}) {
  const c = numero(criancasAtivas);
  const r = numero(rodaram);
  if (c === null || r === null) return null;
  return Math.max(0, c - r);
}

/** Suspensões do registro com motivo preenchido, e o total de ações. */
export function contagemDoRegistro(linhas) {
  if (!Array.isArray(linhas)) return { acoes: null, suspensoesComMotivo: null };
  return {
    acoes: linhas.length,
    suspensoesComMotivo: linhas.filter(
      (l) => l?.acao === 'suspender' && String(l?.motivo || '').trim() !== ''
    ).length,
  };
}

export const TEXTO_DA_ESTIMATIVA =
  'Estimativa: uma criança por carro. É o teto teórico, não uma medição.';

export const LINHA_SOCIAL_FIXA = 'A família não paga nada pelo app.';

export const PENDENCIAS_DE_GOVERNANCA = Object.freeze([
  'Termos 1.4 esperando revisão jurídica',
  'Empresa ainda é MEI: migrar para ME',
]);

export const RODAPE_DO_ESG = 'Nenhum número daqui vira marketing sem a conta que o explica.';

/** Todo texto que a régua escreve, para o teste varrer. */
export function textosDaRegua() {
  return [
    TEXTO_DA_ESTIMATIVA,
    LINHA_SOCIAL_FIXA,
    ...PENDENCIAS_DE_GOVERNANCA,
    RODAPE_DO_ESG,
  ];
}
