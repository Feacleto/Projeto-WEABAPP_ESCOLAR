// Formatadores e constantes de exibição em formato brasileiro.

/**
 * Arredonda dinheiro pro centavo. Use no FIM de toda soma.
 *
 * Trinta mensalidades de R$ 287,50 somadas em `reduce` dão
 * 8624.999999999998. `formatCurrency` esconde (mostra R$ 8.625,00), então
 * ninguém vê — até o número entrar numa COMPARAÇÃO. E entra: `total === 0`
 * decide se uma fatura está quitada.
 *
 * O `taxaService` já fazia isso, com o motivo escrito, numa função privada
 * chamada `centavos`. O resto do app somava direto: o recebido do mês, a
 * dívida acumulada, o total de despesas por categoria, a receita da
 * plataforma no painel do dono.
 *
 * Arredondar UMA vez no fim, e não a cada parcela: arredondar no meio acumula
 * o erro em vez de eliminá-lo.
 */
export function emCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/**
 * O primeiro nome — a forma como o app chama as pessoas.
 *
 * Estava reinventado em 40 lugares, com dois problemas.
 *
 * O primeiro é visível: `.split(' ')[0]` sem fallback renderiza literalmente
 * `undefined` quando o nome falta — acontecia na lista de aniversariantes e
 * no toast do aviso da agenda.
 *
 * O segundo é de voz: os fallbacks divergiam entre 'Aluno', 'a criança',
 * 'seu filho', 'Criança', 'A criança', 'Você', 'Tio' e ''. Num app que
 * escolhe cada palavra com cuidado, a mesma ausência de nome aparecia de oito
 * jeitos. O fallback é parâmetro porque ele DEPENDE do lugar: numa lista de
 * crianças 'a criança' cabe, num cumprimento não.
 *
 * `split` por espaços com `trim()`, e não `split(' ')`: nome com espaço à esquerda
 * ou espaço duplo devolvia string vazia na versão ingênua.
 */
export function primeiroNome(nome, fallback = '') {
  const limpo = String(nome ?? '').trim();
  if (!limpo) return fallback;
  return limpo.split(/\s+/)[0] || fallback;
}

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

// Aceita Date, timestamp do Firestore (com .toDate()), ou ISO string.
export function formatDate(input) {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(input) {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatMonthLabel(monthKey) {
  // Recebe "YYYY-MM" e retorna "Abril/2026"
  if (!monthKey) return '—';
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

// "YYYY-MM" do mês corrente — usado como chave de payments
export function getCurrentMonthKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export const PERIOD_LABELS = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

function toDate(input) {
  if (!input) return null;
  if (input?.toDate) return input.toDate(); // Firestore Timestamp
  if (input instanceof Date) return input;
  const d = new Date(input);
  return isNaN(d) ? null : d;
}

/**
 * Distância no tempo em português coloquial, com "tom" pra colorir o pill.
 * Retorna { label, tone } onde tone é uma das categorias:
 *   - 'today'      → hoje (verde, destaque)
 *   - 'yesterday'  → ontem (amarelo)
 *   - 'recent'     → essa semana (azul claro)
 *   - 'older'      → mais antigo (cinza)
 *
 * Exemplos:
 *   agora           → { label: 'Hoje',         tone: 'today' }
 *   ontem           → { label: 'Ontem',        tone: 'yesterday' }
 *   2 dias atrás    → { label: 'Há 2 dias',    tone: 'recent' }
 *   8 dias atrás    → { label: 'Há 1 semana',  tone: 'older' }
 *   45 dias atrás   → { label: 'Há 1 mês',     tone: 'older' }
 */
export function formatRelativeTime(input, now = new Date()) {
  const d = toDate(input);
  if (!d) return { label: '—', tone: 'older' };

  // Zera horário pra comparar "dias inteiros" — evita "ontem de manhã virar hoje"
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffMs = today - start;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: 'Hoje', tone: 'today' };
  if (diffDays === 1) return { label: 'Ontem', tone: 'yesterday' };
  if (diffDays < 7) {
    return { label: `Há ${diffDays} dias`, tone: 'recent' };
  }
  if (diffDays < 14) return { label: 'Há 1 semana', tone: 'older' };
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return { label: `Há ${weeks} semanas`, tone: 'older' };
  }
  if (diffDays < 60) return { label: 'Há 1 mês', tone: 'older' };
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return { label: `Há ${months} meses`, tone: 'older' };
  }
  const years = Math.floor(diffDays / 365);
  return {
    label: years === 1 ? 'Há 1 ano' : `Há ${years} anos`,
    tone: 'older',
  };
}

/**
 * Idade em anos a partir de `birthDate` ('YYYY-MM-DD').
 *
 * Existe pra a lista de crianças poder dizer "Miguel, 7 anos" — a idade é o
 * que o tio usa pra distinguir dois irmãos e pra saber com quem está
 * falando na porta. Devolve null quando não há data, e o chamador
 * simplesmente omite.
 */
export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  // Ainda não fez aniversário este ano.
  const beforeBirthday =
    today.getMonth() < d.getMonth() ||
    (today.getMonth() === d.getMonth() && today.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;

  if (age < 0 || age > 30) return null; // data digitada errada
  return age;
}

/** "7 anos" / "1 ano" — ou null quando não há data. */
export function formatAge(birthDate) {
  const age = ageFromBirthDate(birthDate);
  if (age == null) return null;
  return age === 1 ? '1 ano' : `${age} anos`;
}

/**
 * Soma (ou subtrai) meses de uma chave 'YYYY-MM'.
 *
 * Estava definida dentro do TioFinance. Subiu pra cá quando o seletor de
 * mês passou a ser compartilhado com a tela de despesas — duas cópias da
 * mesma aritmética de data divergem na primeira correção.
 *
 * Usa `new Date(y, m - 1 + delta, 1)`, que já trata a virada de ano: mês
 * 13 vira janeiro do ano seguinte sem código extra.
 */
export function addMonths(monthKey, delta) {
  const [y, m] = String(monthKey).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
