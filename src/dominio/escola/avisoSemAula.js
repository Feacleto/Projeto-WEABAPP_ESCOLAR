/**
 * "NÃO TEM AULA" PARA TODAS AS ESCOLAS (14/11/2026, RC2; docs/analise/13a,
 * item g) — régua pura, sem Firebase nem React
 * (`npm run testar:sem-aula-todas`).
 *
 * ── POR QUE CONFIRMAR, E SÓ AQUI
 * Feriado municipal que pega três escolas obrigava a repetir o aviso três
 * vezes. A opção "Todas as escolas" resolve, e é a única que pede
 * confirmação: o push sai e não volta (não existe função que apague um aviso
 * de escola), e "todas" é o toque que mais alcança gente. Uma escola continua
 * indo direto, como sempre foi.
 *
 * ── O NÚMERO É DE FAMÍLIAS, NÃO DE CRIANÇAS
 * Quem recebe o aviso é a CONTA (`parentUid`). Dois irmãos são uma família; a
 * criança cuja mãe não entrou no app não conta — a falta dela é marcada, mas
 * ninguém é avisado. Dizer "vai avisar 8" quando 3 recebem seria a
 * confirmação mentindo justamente no instante em que ele decide.
 *
 * ── O ENVIO CONTINUA ESCOLA POR ESCOLA
 * `createSchoolBroadcast` grava uma escola por vez, em lotes de 15 (o teto de
 * acessos das rules). "Todas" é uma chamada por escola, com as crianças
 * daquela escola — o lote não cresce.
 */

export const TODAS_AS_ESCOLAS = 'todas';

/** A opção só aparece quando há mais de uma escola para escolher. */
export function ofereceTodas(opcoes) {
  return Array.isArray(opcoes) && opcoes.filter((o) => o?.criancas?.length).length >= 2;
}

export function precisaConfirmar(escolaId) {
  return escolaId === TODAS_AS_ESCOLAS;
}

/** As crianças ativas, de todas as escolas oferecidas, sem repetir. */
export function criancasDeTodas(opcoes) {
  const vistas = new Set();
  const lista = [];
  for (const o of Array.isArray(opcoes) ? opcoes : []) {
    for (const c of o?.criancas || []) {
      if (!c?.id || c.active === false || vistas.has(c.id)) continue;
      vistas.add(c.id);
      lista.push(c);
    }
  }
  return lista;
}

/** Quantas FAMÍLIAS recebem o aviso: contas distintas entre as crianças. */
export function familiasComConta(criancas) {
  const contas = new Set();
  for (const c of Array.isArray(criancas) ? criancas : []) {
    if (!c || c.active === false) continue;
    if (typeof c.parentUid === 'string' && c.parentUid) contas.add(c.parentUid);
  }
  return contas.size;
}

/**
 * O envio de "todas": uma entrada por escola, só com as crianças MARCADAS
 * daquela escola. Escola sem nenhuma marcada fica de fora — mandar um aviso
 * vazio criaria um histórico dizendo que ela foi avisada.
 */
export function envioPorEscola(opcoes, desmarcadas = new Set()) {
  const fora = desmarcadas instanceof Set ? desmarcadas : new Set(desmarcadas || []);
  const vistas = new Set();
  const envio = [];
  for (const o of Array.isArray(opcoes) ? opcoes : []) {
    const criancas = (o?.criancas || []).filter((c) => {
      if (!c?.id || c.active === false || fora.has(c.id) || vistas.has(c.id)) return false;
      vistas.add(c.id);
      return true;
    });
    if (criancas.length) envio.push({ escola: o, criancas });
  }
  return envio;
}
