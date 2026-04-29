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
