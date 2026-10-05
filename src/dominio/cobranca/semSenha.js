/**
 * O QUE A ROTA MOSTRA SEM A SENHA — régua pura (04/10/2026, simulação "Rota e
 * Central" aprovada pelo dono).
 *
 * Na rota, a tela é o lugar da AUXILIAR. Ela vê a mensalidade em aberto da
 * criança da porta, mas só o MÊS — nunca o valor. As duas contas abaixo são
 * as únicas que a tela sem senha faz com uma mensalidade, e nenhuma delas toca
 * em `amount`. `npm run testar:sem-senha` confere as duas.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "2026-10" → "outubro". Mês fora do formato vira "este mês", nunca o texto cru. */
export function nomeDoMesDaMensalidade(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes || ''));
  const i = m ? Number(m[2]) - 1 : -1;
  return MESES[i] || 'este mês';
}

/**
 * A mensalidade em aberto de cada criança: a MAIS ANTIGA, porque é a que a
 * família deve primeiro. Recebe a lista de `pending` do motorista e devolve
 * `{ [childId]: payment }`. Sem `childId`, a mensalidade não é de ninguém na
 * porta e fica de fora.
 */
export function emAbertoPorCrianca(pendentes) {
  const porCrianca = {};
  for (const p of Array.isArray(pendentes) ? pendentes : []) {
    if (!p?.childId || p?.status !== 'pending') continue;
    const atual = porCrianca[p.childId];
    if (!atual || String(p.month || '') < String(atual.month || '')) porCrianca[p.childId] = p;
  }
  return porCrianca;
}
