/**
 * A CONTA DE FALTAS — pura, sem Firebase, testável.
 *
 * Mora em `utils` e não no serviço pelo mesmo motivo do `dominio/rota/horarios`:
 * três telas precisam do mesmo número (a ficha da criança, o painel do pai e
 * o histórico por mês), e contagem repetida em três lugares é como elas
 * divergem — uma conta "últimos 7 dias", outra "esta semana", e o pai lê dois
 * números diferentes pro mesmo filho no mesmo dia.
 *
 * `dateKey` é 'YYYY-MM-DD', o mesmo id que `absenceDeclarations` usa.
 *
 * A ARITMÉTICA DE MÊS NÃO MORA AQUI. `addMonths`, `getCurrentMonthKey` e
 * `formatMonthLabel` já existiam em `formatters` e são usados pelas TELAS
 * direto — esta
 * primeira versão os reescreveu com outro nome, que é exatamente o que o
 * `taxaService` avisa em voz alta: "três funções somando mês no mesmo código
 * é como elas divergem numa virada de ano". Duas já bastavam pra doer.
 */
/** 'YYYY-MM-DD' → Date local à meia-noite. Fora do formato, `null`. */
export function dataDaChave(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  if (!m) return null;
  // Meses em JS são 0-based, e construir com números (em vez de `new
  // Date('2026-08-29')`) evita o parse como UTC — que joga o dia pra trás em
  // qualquer fuso a oeste de Greenwich, o Brasil inteiro incluído.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * As faltas de um mês, mais recentes primeiro.
 *
 * O filtro é por PREFIXO da chave e não por comparação de Date: `dateKey`
 * já nasce 'YYYY-MM-DD', então `startsWith('2026-08')` é a mesma pergunta
 * sem construir data nenhuma — e sem a chance de errar fuso no caminho.
 */
export function faltasDoMes(historico, mesKey) {
  return (historico || [])
    .filter((a) => String(a.dateKey || '').startsWith(`${mesKey}-`))
    .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
}

/**
 * Quantas faltas no mês corrente e no total — o par que a ficha mostra.
 *
 * CONTA O QUE JÁ ACONTECEU, e não o que está marcado pra frente. Um aviso
 * pra semana que vem é combinado, não falta: somá-lo faria o motorista abrir
 * a ficha e ler que a criança faltou um dia que ainda não chegou.
 */
export function resumoDeFaltas(historico, hoje = new Date()) {
  const lista = historico || [];
  const ano = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const chaveHoje = `${ano}-${mm}-${String(hoje.getDate()).padStart(2, '0')}`;
  const mes = `${ano}-${mm}`;

  let noMes = 0;
  let total = 0;
  let futuras = 0;
  for (const a of lista) {
    const k = String(a.dateKey || '');
    if (!k) continue;
    if (k > chaveHoje) {
      futuras += 1;
      continue;
    }
    total += 1;
    if (k.startsWith(`${mes}-`)) noMes += 1;
  }
  return { noMes, total, futuras };
}
