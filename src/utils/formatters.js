// Formatadores e constantes de exibição em formato brasileiro.

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
